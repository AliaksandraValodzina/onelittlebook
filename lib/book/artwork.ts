/**
 * **The artwork pages with no words on them — the file that goes into an image
 * model, and the one rule that cannot be broken.**
 *
 * The captain sells two ways. *Choose a look* picks one of the finished
 * folders and needs nothing generated. *Upload a photograph* is a hand-made
 * premium service: the captain takes this book's artwork into an image tool,
 * replaces the child with one resembling the buyer's own, and uploads the
 * result back against the order (`./order-upload.ts`, `lib/artwork/store.ts`).
 *
 * This module makes the file that goes *out*.
 *
 * ## TEXT NEVER MAKES A ROUND TRIP THROUGH AN IMAGE MODEL
 *
 * **This is a correctness requirement and not a convenience.** The existing
 * download (`./print.ts`) has the child's name rendered onto the page in a
 * handwritten face. Put that file into an image model to have the character
 * swapped and the model will *redraw* the lettering: the captain's own earlier
 * artwork survey found roughly twenty-five pieces carrying garbled near-words,
 * which is this failure and nothing else. A printed book with a mangled name is
 * unsellable, and nobody notices in a thumbnail.
 *
 * So the order is fixed and is the whole design of the photo path:
 *
 * 1. **clean pages out** — artwork only, no name, no dedication, no story, no
 *    buyer photograph, at the book's own full print size;
 * 2. **regenerated art back in** — the same pages with a different child on
 *    them, checked against `docs/look-upload-contract.md` by `./order-upload.ts`;
 * 3. **the renderer draws the words afterwards**, exactly as it always has.
 *
 * **If you are about to add the name to this download, or to feed
 * `renderBookPagePng`'s output to a model instead, that is the mistake.** The
 * two downloads exist as two downloads for this reason and no other.
 *
 * ## How "no text" is structural rather than remembered
 *
 * `cleanArtworkTemplate` removes **every `textSlot` and every `photoSlot`**
 * from the derived page before the renderer sees it, so there is no text layer
 * to draw. `cleanArtworkFill` then hands the renderer a fill with no texts and
 * no photos in it, so even a slot that somehow survived would have nothing to
 * set. Two locks on one door, and `test/clean-artwork.test.ts` reads the bytes
 * of the real render to prove it — paired, as `test/pixels.ts` requires, with
 * the same assertion against the ordinary render, which *does* carry the name.
 *
 * What is **kept** is everything the book draws for itself: the artwork, and
 * furniture like the cover's cream panel. That is deliberate. The model is
 * being asked to replace a child in a finished page, and a page with the panel
 * but no lettering is the page as it will print minus the words — where a page
 * with the panel removed would invite a child drawn where the name goes.
 *
 * ## Why the right-hand pages are the default
 *
 * Each of the captain's twelve spreads is one 2.000:1 scene cut down the
 * middle: the baby on one half, the quiet half taking the story text. So the
 * **right-hand page of each spread is the only page a character swap has to
 * touch** — twelve pages rather than twenty-five, and the left halves are the
 * same file in every look anyway (`docs/look-upload-contract.md` § 4), so
 * regenerating them is wasted work and a chance to introduce a difference
 * between looks that should not exist.
 *
 * Twelve is not written down here. `rightHandPages` counts one per spread out
 * of `spreads()`, so a book with a different number of spreads has a different
 * number of pages in this download and no edit is needed.
 *
 * **Node only.** It rasterises.
 */

import type { Layer, PageFill, PageTemplate } from "../template/types";
import { renderPrintPng, type PrintResult } from "../render/raster";
import { buildZip, type ZipEntry } from "../zip";
import {
  isCover,
  pageCount,
  pageSequence,
  pageTemplateFor,
  rightHandPages,
  spreadSideOf,
} from "./derive";
import { BookNotPrintable, orderFileStem } from "./print";
import { validateBook } from "./validate";
import type { BookFill, BookTemplate } from "./types";

/**
 * Which pages the download carries.
 *
 * `right` is the default for the reason above. `all` is the twenty-four
 * interior pages, for a book being regenerated wholesale. `everything` adds
 * the cover, which carries the child too and is the one page the twelve-page
 * default genuinely leaves out — it is a separate value rather than part of
 * `all` because the cover is a separate object everywhere else in this
 * codebase and quietly folding it in would make "all 24" mean twenty-five.
 */
export type CleanSelection = "right" | "all" | "everything";

export const CLEAN_SELECTIONS: readonly CleanSelection[] = ["right", "all", "everything"];

export function isCleanSelection(value: unknown): value is CleanSelection {
  return typeof value === "string" && (CLEAN_SELECTIONS as readonly string[]).includes(value);
}

/** The pages a selection names, as indices into `pageSequence`. */
export function cleanArtworkPages(book: BookTemplate, which: CleanSelection): number[] {
  const interior = Array.from({ length: pageCount(book) - 1 }, (_, i) => i + 1);
  if (which === "right") return rightHandPages(book);
  if (which === "all") return interior;
  return [0, ...interior];
}

/**
 * One page of the book as **artwork only**.
 *
 * Built from `pageTemplateFor` rather than beside it, so the artwork, the
 * look's contribution and the cover tint are the same derivation the printed
 * page uses — the clean file and the finished file are the same picture with
 * the words taken off, which is the only way a character swapped into one
 * lands correctly in the other.
 */
export function cleanArtworkTemplate(
  book: BookTemplate,
  index: number,
  fill: BookFill,
): PageTemplate {
  const template = pageTemplateFor(book, index, {
    lookId: fill.lookId,
    coverId: fill.coverId,
  });
  return { ...template, layers: template.layers.filter(isNotASlot) };
}

/** A layer nothing a buyer supplied can reach. The first of the two locks. */
function isNotASlot(layer: Layer): boolean {
  return layer.kind !== "textSlot" && layer.kind !== "photoSlot";
}

/**
 * A fill with nothing in it. The second lock.
 *
 * It names the template it belongs to so `validateFill` and the renderer see a
 * matching pair, and it carries no text and no photograph — so the only way a
 * word could be drawn into this file is for somebody to put a slot layer back
 * *and* to fill it.
 */
export function cleanArtworkFill(book: BookTemplate, index: number): PageFill {
  return {
    schema: 1,
    templateId: `${book.id}/${pageSequence(book)[index]?.id ?? "missing"}`,
    templateRev: book.rev,
    photos: {},
    texts: {},
  };
}

/** One page's clean artwork, at the book's declared print size. */
export async function renderCleanArtworkPng(
  book: BookTemplate,
  index: number,
  fill: BookFill,
): Promise<PrintResult> {
  return renderPrintPng(cleanArtworkTemplate(book, index, fill), cleanArtworkFill(book, index));
}

/**
 * What one page is called inside the archive.
 *
 * Both spellings, in one name: the page id the contract uses and the
 * spread-and-side the captain uses for their own files. So the file that comes
 * back can be named either way and `./order-upload.ts` maps it — and a person
 * looking at `…-07-page-006-spread-03-right-clean.png` does not have to work
 * out which spread it is.
 *
 * The leading two digits are the position in reading order, zero-padded, so
 * `ls`, Finder, a zip listing and Printify's uploader all sort the pages the
 * same way. `docs/look-upload-contract.md` § 1 makes the same argument about
 * `page-NNN`.
 */
export function cleanEntryName(book: BookTemplate, index: number, ref?: string): string {
  const page = pageSequence(book)[index];
  const side = spreadSideOf(book, index);
  const where = side ? `-spread-${String(side.spread).padStart(2, "0")}-${side.side}` : "";
  const prefix = ref ? `${ref}-` : "";
  return `${prefix}${String(index).padStart(2, "0")}-${page.id}${where}-clean.png`;
}

export interface CleanArtworkResult {
  zip: Uint8Array;
  /** The pages actually in the archive, as indices into `pageSequence`. */
  pages: number[];
  filename: string;
}

/**
 * The clean artwork for one order, as a ZIP.
 *
 * It refuses on `validateBook` rather than on `printProblems`: this file does
 * not carry a single thing the buyer typed, so an over-long dedication is not a
 * reason the captain cannot have the artwork — and refusing to hand over the
 * pages that would let them *fix* an order would be exactly the wrong way
 * round. A book whose artwork is missing is still a refusal, because there
 * would be nothing in the file.
 *
 * `onPage` is called before each render so a route or a script can print
 * progress; a twelve-page render is of the order of fifteen seconds.
 */
export async function renderCleanArtworkZip(
  book: BookTemplate,
  fill: BookFill,
  options: {
    which?: CleanSelection;
    /** The order's reference, put in front of every entry name when given. */
    ref?: string;
    onPage?: (index: number, id: string, total: number) => void;
  } = {},
): Promise<CleanArtworkResult> {
  const problems = validateBook(book);
  if (problems.length) throw new BookNotPrintable(problems);

  const which = options.which ?? "right";
  const pages = cleanArtworkPages(book, which);
  const sequence = pageSequence(book);
  const entries: ZipEntry[] = [];

  for (const index of pages) {
    options.onPage?.(index, sequence[index].id, pages.length);
    const result = await renderCleanArtworkPng(book, index, fill);
    entries.push({ name: cleanEntryName(book, index, options.ref), bytes: result.png });
  }

  entries.push({
    name: `${options.ref ? `${options.ref}-` : ""}HOW-TO-SEND-THESE-BACK.txt`,
    bytes: new TextEncoder().encode(instructions(book, fill, pages, options.ref)),
  });

  const { width, height } = book.page.print.pixels;
  return {
    zip: buildZip(entries),
    pages,
    filename:
      `${options.ref ? `${options.ref}-` : ""}${orderFileStem(book, fill)}` +
      `-clean-${which}-${pages.length}pages-${width}x${height}.zip`,
  };
}

/**
 * The note in the archive.
 *
 * **Every number in it is derived from the book**, which is the only reason it
 * can be trusted: a hand-typed "3600 × 3600" in a text file is a claim that
 * goes on being made after the page size changes, and the page size is the one
 * number `docs/print.md` says is still open. The filenames it asks for are
 * generated from the same mapping `./order-upload.ts` reads, so what it asks
 * for and what is accepted cannot drift.
 */
function instructions(
  book: BookTemplate,
  fill: BookFill,
  pages: number[],
  ref?: string,
): string {
  const { width, height } = book.page.print.pixels;
  const sequence = pageSequence(book);
  const lines = [
    `${book.name} — clean artwork${ref ? ` for order ${ref}` : ""}`,
    "",
    "WHAT THIS IS",
    "",
    "The artwork of this book with NO TEXT DRAWN ON IT. No name, no dedication,",
    "no story line, no photograph. The pages are the look's own artwork at full",
    `print size, ${width} x ${height} pixels each.`,
    "",
    "WHY THERE IS NO TEXT ON IT, AND WHY THAT MATTERS",
    "",
    "Text must never make a round trip through an image model. A model asked to",
    "replace the child on a page redraws the lettering too, and what comes back",
    "is a garbled near-word in a handwritten face. A printed book with a mangled",
    "name on the cover is unsellable, and it is not obvious in a thumbnail.",
    "",
    "So: these clean pages go into the image tool, the regenerated pages come",
    "back, and the name, the dedication and the story are drawn afterwards by the",
    "renderer, the same way they always are.",
    "",
    "WHAT TO SEND BACK",
    "",
    `${pages.length} page(s), each ${width} x ${height} pixels exactly, PNG, sRGB, 8 bits per`,
    "channel, NO alpha channel, full bleed to all four edges. Those are the rules",
    "in docs/look-upload-contract.md and the upload is checked against them; a",
    "page that fails is reported rather than quietly accepted.",
    "",
    "Name each file for the page it replaces. Either spelling is accepted:",
    "",
  ];
  for (const index of pages) {
    const side = spreadSideOf(book, index);
    const theirs = side ? `spread-${String(side.spread).padStart(2, "0")}-${side.side}.png` : "—";
    const label = isCover(index) ? "the cover" : `page ${index} in reading order`;
    lines.push(`  ${sequence[index].id}.png    or  ${theirs.padEnd(22)}  (${label})`);
  }
  lines.push(
    "",
    "A re-upload replaces the previous one and the previous one is kept, so a bad",
    "swap found later can be rolled back.",
    "",
    `Drawn against ${book.id} revision ${book.rev}, look "${fill.lookId}", cover "${fill.coverId}".`,
    "",
  );
  return lines.join("\n");
}
