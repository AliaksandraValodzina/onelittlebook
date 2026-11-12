/**
 * **The baby's name, which is refused rather than quietly changed.**
 *
 * This is the one field in the product where the font-coverage guard earns its
 * whole existence, and the reason is in the captain's own specification: *"a
 * name goes on the pages."* The failure runs like this. The rasteriser is
 * loaded with `loadSystemFonts: false` and the two vendored TTFs, so a
 * codepoint neither carries prints as **nothing at all**. A browser does the
 * opposite — give it `font-family: "Indie Flower"` and a Cyrillic letter and it
 * substitutes whatever face the device has, and the name looks perfect. The
 * buyer approves a cover they can read and a hardback arrives with a hole in
 * their child's name on six pages.
 *
 * **So an unwritable name is refused at the keystroke, with a sentence saying
 * why, and nothing is substituted and nothing is dropped.**
 *
 * That is a deliberate departure from `lib/editor/text.ts`, which *drops*
 * characters it cannot set, and from `lib/editor/lines.ts`, which clamps a
 * dedication as it is typed. Both are right for what they handle: a word on a
 * scrapbook page and a paragraph with a counter running down are things a
 * person can watch happen and correct. A name is not. Dropping the accent out
 * of "Zoé" leaves "Zo", which is a *different, plausible name* printed
 * several times over — and the buyer who typed it has no reason to look again. A
 * refusal is the only outcome they cannot miss.
 *
 * **It asks every face the name is actually set in.** The name appears on
 * several pages and nothing says they are set in the same face; a name the
 * handwritten face can write and the typewriter cannot would print cleanly on
 * the cover and as a gap on page ten. So the check unions the coverage of every
 * face the name reaches — which is **not** the same list as the `babyName`
 * slots, because `{name}` is substituted into the captain's authored copy too
 * (`./slots.ts` § `NAME_TOKEN`). The twelve verses are set in the typewriter
 * face and the name slots are set in the handwritten one, and the two faces
 * genuinely differ: `hand` writes Vietnamese and `typewriter` does not, so a
 * name checked against the name slots alone would be accepted and then print
 * with a hole in it on eleven interior pages. `facesTheNameIsSetIn` is that
 * list; the **length** question is `nameLimit`, which is deliberately not
 * answered from the copy — a story slot's `maxChars` is a budget for a whole
 * verse and says nothing about how long a name may be.
 *
 * **Since 12 November this book has no `babyName` slot at all.** The captain's
 * two lone names went — page one's because the dedication facing it already
 * says the name, page twenty-four's with it — so the name now reaches the
 * pages only inside authored copy: the cover's title and eleven verses. Three
 * things follow, and each is written where it happens: the length is declared
 * on the book (`./types.ts` § `nameMaxChars`), the confirm screen's face comes
 * from the first slot the name lands in rather than from a name slot
 * (`nameSlotFont`), and `./validate.ts` asks whether the name reaches the book
 * **at all** rather than whether a `babyName` slot exists.
 */

import { FACES } from "../render/fonts";
import { unsettable } from "../render/coverage";
import { measuredLength } from "../template/defaults";
import type { TextSlotLayer } from "../template/types";
import { stripInvisible } from "../editor/text";
import { NAME_TOKEN, SLOT } from "./slots";
import { pageSequence } from "./derive";
import type { BookTemplate } from "./types";

/** Every text slot in the book carrying a given role, cover included. */
export function slotsForRole(book: BookTemplate, role: string): TextSlotLayer[] {
  return pageSequence(book).flatMap((page) =>
    (page.layers ?? []).flatMap((l) => (l.kind === "textSlot" && l.slot === role ? [l] : [])),
  );
}

/**
 * The limits a value in this role has to satisfy on **every** page it appears
 * on.
 *
 * The tightest of each, which is the only safe reduction: a name that fits five
 * of six boxes overflows the sixth, and the sixth is a printed page. A role with
 * no slots at all returns a zero limit, which `validateBook` has already
 * reported as `book.noNameSlot` — it is not this function's job to decide what
 * to do about a book that cannot hold what it asks for.
 */
export function limitsForRole(
  book: BookTemplate,
  role: string,
): { maxChars: number; faces: string[] } {
  const slots = slotsForRole(book, role);
  return {
    maxChars: slots.reduce((least, s) => Math.min(least, s.maxChars), Infinity) || 0,
    faces: [...new Set(slots.map((s) => s.font))],
  };
}

/**
 * Every face the buyer's name is actually set in, anywhere in the book.
 *
 * The `babyName` slots, **plus** the slot of every page whose authored copy
 * carries `{name}`. The second half is the one that is easy to forget and
 * invisible when you do: a name reaches the typewriter face only because the
 * captain put the child's name inside the verses, and the page that proves it
 * is page three rather than the cover.
 *
 * Derived from the book every time rather than declared, so moving a `{name}`
 * into a slot set in a third face moves this with it.
 */
export function facesTheNameIsSetIn(book: BookTemplate): string[] {
  const faces = slotsForRole(book, SLOT.name).map((s) => s.font);
  for (const page of pageSequence(book)) {
    if (!page.story?.includes(NAME_TOKEN)) continue;
    for (const layer of page.layers ?? []) {
      if (layer.kind === "textSlot" && layer.slot === SLOT.story) faces.push(layer.font);
    }
  }
  return [...new Set(faces)];
}

export type NameVerdict =
  | { ok: true; name: string }
  | {
      ok: false;
      /** Stable and greppable, like a `Problem.code`. Never the sentence. */
      code: "empty" | "unprintable" | "tooLong";
      /** What to show the buyer. Written here so the rule and the reason cannot drift. */
      message: string;
      /** The characters the press cannot write, in the order they first appear. */
      unsettable: string[];
    };

/**
 * Is this a name this book can print?
 *
 * The whitespace tidying **is** applied to the accepted value — collapsing two
 * spaces and trimming the ends changes nothing a buyer meant and a trailing
 * space shifts a centred name off centre in the print file. What is never
 * applied is a change to the *letters*.
 */
export function checkName(book: BookTemplate, raw: string): NameVerdict {
  // The *length* from `nameLimit`, the *faces* from everywhere the name
  // actually lands — see `facesTheNameIsSetIn` for why those are two lists.
  const maxChars = nameLimit(book);
  const faces = facesTheNameIsSetIn(book);
  const tidied = stripInvisible(typeof raw === "string" ? raw : "")
    .replace(/[\u0009-\u000d]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (tidied.length === 0) {
    return {
      ok: false,
      code: "empty",
      message: "The book needs a name — it goes on the cover and inside.",
      unsettable: [],
    };
  }

  // Unioned across every face the name is set in, de-duplicated in first-seen
  // order so the message reads the way the buyer typed it.
  const bad: string[] = [];
  for (const face of faces) {
    for (const ch of unsettable(face, tidied)) if (!bad.includes(ch)) bad.push(ch);
  }
  if (bad.length) {
    const chars = bad.map((c) => `“${c}”`).join(" ");
    const names = [...new Set(faces.map((f) => FACES[f]?.family ?? f))].join(" and ");
    return {
      ok: false,
      code: "unprintable",
      message:
        `The press cannot print ${chars}. The book is set in ${names}, and ${
          bad.length === 1 ? "that character" : "those characters"
        } would come out as a gap in the name on every page — so the name is not changed and ` +
        "not accepted. Latin letters, numbers, spaces, hyphens and apostrophes all work.",
      unsettable: bad,
    };
  }

  // Measured against the tightest box, the way the renderer and the validator
  // measure it — `measuredLength` is the one definition all three share.
  const widest = slotsForRole(book, SLOT.name).reduce(
    (most, slot) => Math.max(most, measuredLength(slot, tidied)),
    tidied.length,
  );
  if (widest > maxChars) {
    return {
      ok: false,
      code: "tooLong",
      message:
        `That is ${widest} characters and the name is set large enough that ${maxChars} is ` +
        "all the page holds. A shorter form of it will print beautifully; a longer one would " +
        "run off the cover.",
      unsettable: [],
    };
  }

  return { ok: true, name: tidied };
}

/**
 * **How long a name this book may be given, and the one answer everything
 * asks.**
 *
 * The tightest of `BookTemplate.nameMaxChars` and every `babyName` slot the
 * book has. Both halves matter and for different reasons:
 *
 * - **The declared number** is the source since 12 November, when the
 *   captain's two lone names went and the name stopped having a box of its
 *   own. `limitsForRole` over no slots is `Infinity`, which is not a limit —
 *   it would accept any name and hand `validateBook` an `Infinity` to
 *   substitute into the copy. `lib/book/types.ts` § `nameMaxChars` is why the
 *   number is declared rather than derived from the verses.
 * - **The slots, still tightest-wins**, because the old rule was right: a name
 *   that fits five boxes of six overflows the sixth and the sixth is a printed
 *   page. This book has no `babyName` slot and a book that has one gets the
 *   same arithmetic it always did.
 *
 * It is the counter the form shows beside the field, the length `checkName`
 * refuses past, and the name `validateBook` substitutes into every `{name}` in
 * the copy — so the cover's title and the twelve verses are checked against
 * exactly what the form will let a buyer type.
 */
export function nameLimit(book: BookTemplate): number {
  return Math.min(book.nameMaxChars, limitsForRole(book, SLOT.name).maxChars);
}

/**
 * The face the name is set in, for a screen that has to show it in that face.
 *
 * **The first slot the name actually lands in, in reading order** — which
 * since 12 November is the cover's title, because the captain's two lone name
 * slots went and the name reaches the pages only inside authored copy. The
 * confirm-the-spelling screen uses this so that the letterforms somebody
 * approves are the letterforms that print; the browser would otherwise set the
 * name in the page's UI font, which is showing them one thing and asking them
 * to approve another. The cover is also the right screen answer on its own
 * merits: it is the face the buyer will see the name in largest.
 *
 * Asked of the book rather than named, so a book that still has a `babyName`
 * slot before its cover title gets that one. The cover comes first in
 * `pageSequence`, so in practice a title carrying `{name}` wins — which is
 * what this book wants.
 *
 * A book whose name lands in two faces still returns one here, and that is the
 * honest limit of a single screen: `checkName` is the part that has to consider
 * all of them, and it does.
 */
export function nameSlotFont(book: BookTemplate): string {
  for (const page of pageSequence(book)) {
    for (const layer of page.layers ?? []) {
      if (layer.kind !== "textSlot") continue;
      if (layer.slot === SLOT.name) return layer.font;
      if (layer.slot === SLOT.story && page.story?.includes(NAME_TOKEN)) return layer.font;
    }
  }
  return "hand";
}
