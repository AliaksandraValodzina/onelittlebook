/**
 * **The shop's copy, as data — and every number in it derived.**
 *
 * The sentences are the captain's, taken from the approved artefacts. They are
 * here rather than inside the components for two reasons, and the second is the
 * one that matters:
 *
 * **A page and a test should read the same list.** `test/shop-no-theatre.test.tsx`
 * walks every string the shop can show and asserts that none of the forbidden
 * elements — a struck-out price, a countdown, an invented review count, a
 * hand-made claim — appears in any of them. A claim typed into JSX is a claim
 * that check cannot see coming.
 *
 * **A number a human typed is a number that can drift.** `lib/product.ts` makes
 * writing an unsupplied figure impossible and the same discipline applies to
 * copy: the page count comes from the page list, the trim from the artboard
 * less its declared bleed, the dispatch window from the module the confirmation
 * email reads it out of, and the prices from `EDITIONS`. The artefact says
 * "Twenty-four pages, 8 inches square"; this says the same thing and would say
 * something else the day the book's page size is answered — see
 * `docs/print.md` § The square trim nobody has pinned down.
 *
 * ## What is deliberately not here
 *
 * The artefacts put a five-star row above the empty review slot on the book
 * page, under a caption admitting it is a placeholder. The stars are gone and
 * the caption stays: a star row with no review behind it is an invented rating
 * even when the words beside it are honest, and the captain's own list of
 * things that must not appear anywhere names star ratings. The band itself is
 * kept exactly because it says, out loud, that nothing goes there until
 * somebody has written one.
 */

import { FIRST_BOOK } from "../../templates/first-book";
import { trimBox } from "../template/defaults";
import { CHANGE_WINDOW_HOURS, DISPATCH_WINDOW } from "../email/order";
import { EDITIONS, priceOf, upgradeFrom, editionOf, differenceOf } from "../book/editions";

const book = FIRST_BOOK;
const trim = trimBox(book.page.canvas);

/** `8` — whole inches where the number is whole, which this trim is. */
export const trimInches = (trim.width / 72).toFixed(2).replace(/\.?0+$/, "");

/** Where the book is made and how fast it leaves. One sentence, used twice. */
export const RIBBON = `Designed and printed in Australia · dispatched in ${DISPATCH_WINDOW}`;

// ---------------------------------------------------------------------------
// The landing page
// ---------------------------------------------------------------------------

export const HERO = {
  heading: "A book with their name all the way through it.",
  sub:
    "Twelve illustrated spreads of a day in their life, one of your own photographs, and " +
    "your words in the front.",
  primary: "See the book",
  secondary: "How it works",
  fine: "Read every page before you pay. No account, no watermark.",
} as const;

/**
 * The caption under every render of the cover.
 *
 * There is no photograph of a printed book in this repository because nothing
 * has been printed. The caption says so rather than letting a flat picture
 * imply an object, and it goes the day the captain takes the photograph.
 */
export const RENDER_CAPTION =
  "A render for now — a photograph of the printed book replaces this the day one is printed";

export interface TrustItem {
  icon: "book" | "star" | "van" | "heart" | "eye";
  title: string;
  line: string;
}

export const TRUST: readonly TrustItem[] = [
  {
    icon: "book",
    title: "See the whole book first",
    line: "Every page, unwatermarked, before anything is paid",
  },
  {
    icon: "star",
    title: "Your words and your photograph",
    line: "A dedication and a picture of your own in the front",
  },
  {
    icon: "van",
    title: "Printed in Australia",
    line: `Dispatched in ${DISPATCH_WINDOW}`,
  },
] as const;

export const SHELF_HEADING = "Our books";
export const SHELF_ASIDE = "One for now — more on the way";

export const HOW_HEADING = "Meaningful gifts, made in minutes";

export interface HowStep {
  icon: "book" | "pen" | "photo" | "open";
  heading: string;
  line: string;
}

export const HOW: readonly HowStep[] = [
  {
    icon: "book",
    heading: "Pick the baby",
    line: "Twelve to choose from, so one of them looks like yours.",
  },
  {
    icon: "pen",
    heading: "Add their name",
    line: "It goes on the cover and runs all the way through the story.",
  },
  {
    icon: "photo",
    heading: "Your photograph and your words",
    line: "One picture and a dedication, on the first spread.",
  },
  {
    icon: "open",
    heading: "Read it all, then order",
    line: `Every page shown before you pay. Nothing is printed for ${CHANGE_WINDOW_HOURS} hours.`,
  },
] as const;

/**
 * **"Thoughtfully made" — and not a word about hands.**
 *
 * The captain's list of things that must not appear anywhere includes *any*
 * hand-made or hand-painted claim, with reason: the artwork is generated and
 * then chosen and corrected, which is composition rather than craft, and the
 * FAQ says so plainly a screen later. The register this band is reaching for —
 * "there is only one title because each one takes as long as it takes" — is
 * available without the claim, so it is made without it.
 */
export const MADE = {
  heading: "Thoughtfully made",
  body:
    "Every spread is composed for this book alone, fitted to the page and checked one at a " +
    "time before anything is printed — which is why there is only one title on the shelf, " +
    "and why the next one takes as long as it takes.",
  action: "Read how it is made",
  picture: "a photograph of the printed book in someone’s hands goes here",
} as const;

export interface Question {
  q: string;
  a: string;
}

/**
 * **The artwork answer is load-bearing and is not softened.**
 *
 * *"The illustrations are generated with AI tools…"* is the captain's own
 * sentence and the brief says to keep it. It appears on both the landing page
 * and the book page, in the same words, which is why it is one constant.
 */
export const AI_ANSWER =
  "The illustrations are generated with AI tools and then chosen, corrected and composed " +
  "by us, spread by spread, for this book alone. They are not stock pictures bought from a " +
  "library. We would rather say so plainly than let you find out later.";

/**
 * **The typo answer stops one sentence short of the artefact's.**
 *
 * Both artefacts end it *"After that, say so anyway — the first reprint is on
 * us."* That sentence advertises the captain's standing goodwill policy, and
 * `docs/pricing.md` is explicit that the policy is *"applied quietly when
 * somebody asks, and never advertised, so that it stays goodwill rather than an
 * invitation. **Nothing that reaches the markup may mention it.**"* The written
 * rule carries its reasoning and the artefact's sentence does not, so the rule
 * wins and the omission is recorded here rather than silently made.
 */
const TYPO_ANSWER =
  `Tell us within ${CHANGE_WINDOW_HOURS} hours and it is fixed free, because it will not ` +
  "have been printed yet.";

const RETURN_ANSWER =
  "A book printed with a particular child's name in it cannot be resold, so it cannot be " +
  "returned for a change of mind. Anything actually wrong with the object is reprinted free.";

export const LANDING_QUESTIONS: readonly Question[] = [
  {
    q: "How is the book personalised?",
    a:
      "You choose which baby appears in it, type the name that goes on the cover and through " +
      "the story, add one of your own photographs, and write a dedication for the first page. " +
      "Nothing else is laid out by you — every page is already composed.",
  },
  {
    q: "Can I see it before I pay?",
    a:
      "Yes, all of it. Every page, with your name and your picture in place, with no " +
      "watermark and without making an account. That is deliberate: a book with somebody's " +
      "child in it should not be bought sight unseen.",
  },
  { q: "What if I spell the name wrong?", a: TYPO_ANSWER },
  {
    q: "How much is it and how long does it take?",
    a:
      EDITIONS.map((e) => `${priceOf(e.price)} ${e.label.toLowerCase()}`).join(", ") +
      `. Printed and dispatched in ${DISPATCH_WINDOW}; shipping time is on top and depends ` +
      "where you are.",
  },
  { q: "How is the artwork made?", a: AI_ANSWER },
  { q: "Can it be returned?", a: RETURN_ANSWER },
] as const;

// ---------------------------------------------------------------------------
// The book page
// ---------------------------------------------------------------------------

export interface PageFact {
  icon: "book" | "eye" | "van" | "heart";
  line: string;
}

/**
 * The four facts beside the cover, each derived from something that knows it.
 *
 * The page count is the page list's own length and the size is the artboard
 * less its declared bleed — the same arithmetic `lib/book/product.ts` does, for
 * the same reason: the trim is an open question and a typed "8 inches" is a
 * claim that would survive being answered.
 */
export const PAGE_FACTS: readonly PageFact[] = [
  { icon: "book", line: `${book.pages.length} pages inside, ${trimInches} inches square` },
  { icon: "eye", line: "Read every page before you pay — no account, no watermark" },
  { icon: "van", line: `Printed in Australia, dispatched in ${DISPATCH_WINDOW}` },
  { icon: "heart", line: "Recommended as a gift for a new baby, 0–3" },
] as const;

export const PAGE_CTA = {
  action: "Preview the whole book",
  under: "Takes about three minutes. Nothing is paid until you have read it.",
} as const;

/** `From AUD 59 · hardcover AUD 69`, split so the second half can be small. */
export const PRICE_LINE = {
  main: `From ${priceOf(EDITIONS[0].price)}`,
  aside: `· ${EDITIONS[1].label.toLowerCase()} ${priceOf(EDITIONS[1].price)}`,
} as const;

export const PAGE_QUESTIONS: readonly Question[] = [
  {
    q: "How is the book personalised?",
    a:
      `You choose which of ${book.looks.length} babies appears throughout, type the name ` +
      "that goes on the cover and into the story, add one photograph of your own and write a " +
      "dedication for the opening spread. Nothing else is laid out by you — every page is " +
      "already composed, so it cannot come out wrong.",
  },
  {
    q: "What is the story?",
    a:
      "One ordinary, enormous day in a first year, told across twelve spreads: waking, " +
      "breakfast, being carried, first steps, the bath, the cake. Written to be read aloud at " +
      "bedtime and to still make sense in ten years.",
  },
  {
    q: "Delivery and getting it right",
    a:
      `Dispatched in ${DISPATCH_WINDOW}; shipping is on top and depends where you are. ` +
      `Nothing goes to the press for ${CHANGE_WINDOW_HOURS} hours after you order, so a typo ` +
      "can be fixed free. Anything wrong with the book itself is reprinted free.",
  },
] as const;

/** The `Size & quality` disclosure, which is a table rather than a paragraph. */
export const SPEC: readonly { term: string; value: string }[] = [
  { term: "Pages", value: `${book.pages.length} inside, plus a cover` },
  { term: "Size", value: `${trimInches} inches square` },
  {
    term: "Binding",
    value: (() => {
      const up = upgradeFrom(EDITIONS[0].id);
      const base = EDITIONS[0].label;
      return up
        ? `${base}, or ${up.label.toLowerCase()} for ${differenceOf(editionOf(EDITIONS[0].id), up)} more`
        : base;
    })(),
  },
  { term: "Printing", value: "Full colour, printed in Australia" },
] as const;

export const STRIP: readonly { icon: string; line: string }[] = [
  { icon: "🎁", line: "Made for one child" },
  { icon: "👀", line: "Read it all before paying" },
  { icon: "🇦🇺", line: "Printed in Australia" },
  { icon: "↩️", line: `${CHANGE_WINDOW_HOURS} hours to change anything` },
] as const;

export const THREE_MINUTES = {
  eyebrow: "Ready when you are",
  heading: "Three minutes to make it theirs",
} as const;

/**
 * **The empty review slot, kept empty on purpose.**
 *
 * The band stays because the sentence in it is the strongest trust signal on
 * the page: a shop that leaves the testimonial slot visibly empty and says why
 * is a shop that has not written one. The stars the artefact drew above it are
 * gone — see this module's own docblock.
 */
export const REVIEW_SLOT = {
  quote:
    "This is where the first real review goes — and nothing goes here until somebody has " +
    "written one.",
  who: "A placeholder, deliberately. Inventing one would undo everything else on this page.",
} as const;

export const HELP = {
  eyebrow: "If it is not right, we will make it right",
  heading: "A real person, every time",
  picture: "a photograph of you, or of the book being packed, goes here",
  lines: [
    { icon: "✉️", strong: "Answered within a day.", rest: "By the person who made the book." },
    {
      icon: "⏱️",
      strong: `${CHANGE_WINDOW_HOURS} hours to change anything`,
      rest: "after you order — it has not been printed yet.",
    },
    {
      icon: "🖨️",
      strong: "Our mistake, our cost.",
      rest: "Anything wrong with the object is reprinted free.",
    },
    {
      icon: "✍️",
      strong: "Checked once more before it prints.",
      rest: "The spelling is shown back to you on its own screen.",
    },
  ],
} as const;

/**
 * The questions at the foot of the book page.
 *
 * A different five from the right-hand column's three: those answer *what am I
 * buying*, these answer *can I trust you*. The artwork answer is in both lists
 * on the artefact's own instruction — it is the question that decides the sale
 * for the buyer who is going to ask it either way.
 */
export const PAGE_BOTTOM_QUESTIONS: readonly Question[] = [
  {
    q: "Can I really see the whole book before paying?",
    a:
      "Yes — every page, with the name and photograph in place, unwatermarked and without an " +
      "account. Most personalised-book shops do this; the ones that do not are usually selling " +
      "a file rather than an object.",
  },
  { q: "How is the artwork made?", a: AI_ANSWER },
  { q: "What if I spell the name wrong?", a: TYPO_ANSWER },
  { q: "Can it be returned?", a: RETURN_ANSWER },
  { q: "Will there be more books?", a: "Yes, one at a time. This is the first." },
] as const;
