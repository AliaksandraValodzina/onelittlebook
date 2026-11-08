/**
 * **The shelf, as data — because the shop's whole plan is that it grows.**
 *
 * There is one title today and there will be a second. The captain's
 * instruction is specific: *adding a second title must be data, not a layout
 * change.* So the landing page's shelf, the book page's route, the breadcrumb,
 * the footer's "Books" column and the basket's "another book" line all read
 * this one list, and adding a title is an entry here and a template import.
 * `test/shop-landing.test.tsx` proves it by appending a second entry to a copy
 * of the list, rendering the shelf again, and asserting the new title appears
 * with no component edited.
 *
 * ## The placeholder is an entry, not a special case
 *
 * The approved landing page shows one book and a *"the next one is being
 * made"* tile beside it, which is an honest statement of the state of the shop
 * and is also what keeps a one-item grid from reading as a mistake. It is
 * therefore a `kind: "being-made"` entry in the same list rather than markup
 * the shelf adds when it counts one book — a shelf that decided that for itself
 * would need editing on the day there are two.
 *
 * **Nothing here states a price.** A shelf entry names the editions it is sold
 * in and `lib/book/editions.ts` holds the money, because that module is the one
 * with no field for a "was", a percentage or an expiry. `docs/pricing.md`
 * carries the legal reasoning for why that is a position and not a taste.
 *
 * ## Why the slug is here and not the book's `id`
 *
 * `BookTemplate.id` is *"stable forever, never renamed, never reused — an order
 * refers to it"*, so it cannot follow a change of title. A URL can and should:
 * the id of this book is still `the-book-of-you`, which is a name the shop no
 * longer trades a book under, and a customer must never be shown it. The slug
 * is the published address and the id is the key an order names.
 */

import type { BookTemplate } from "../book/types";
import { FIRST_BOOK } from "../../templates/first-book";
import { cheapestIn, priceIn, priceOf } from "../book/editions";
import type { Market } from "./market";

/** A title that can be bought today. */
export interface ShelfTitle {
  kind: "title";
  /** The published address. `/books/<slug>`. Never the template's `id`. */
  slug: string;
  /** The template the page, the tiles and the print file all come from. */
  book: BookTemplate;
  /** One line under the title on the shelf. Shorter than the book's blurb. */
  line: string;
  /** The uppercase pill in the corner of the block, or nothing. */
  badge?: string;
  /** What the book page says above its heading. */
  eyebrow: string;
  /**
   * The book page's own headline.
   *
   * Not `BookTemplate.blurb`, which is the subject line shown in a chooser and
   * reads as a specification. A headline is a sentence the shop says about the
   * book and belongs to the shop, which is also why it can be rewritten without
   * restamping the template's `rev`.
   */
  heading: string;
  /** The sentence the book page leads with, under the heading. */
  description: string;
}

/**
 * The tile that says the shop is not finished.
 *
 * It carries its own words so the shelf renders a list rather than branching on
 * a count, and so the sentence can change without a component changing.
 */
export interface ShelfPlaceholder {
  kind: "being-made";
  /** Two short lines, drawn on the hatched block. */
  placeholder: string;
  heading: string;
  line: string;
  /** What the dead button says. It is not a link and does not pretend to be. */
  action: string;
}

export type ShelfEntry = ShelfTitle | ShelfPlaceholder;

/**
 * **The first title: "When They Were Small".**
 *
 * The name on the shelf is the name on the approved artefacts, and it is now
 * the template's own `name` too — a shop that calls a book one thing on its
 * landing page and another on its order confirmation has two books.
 */
export const WHEN_THEY_WERE_SMALL: ShelfTitle = {
  kind: "title",
  slug: "when-they-were-small",
  book: FIRST_BOOK,
  line: "Twelve illustrated spreads of a first year, with their name through it.",
  badge: "New",
  eyebrow: "A keepsake for a first year",
  heading: "A book about their first year, with their name all the way through it.",
  description:
    "Twelve illustrated spreads of an ordinary day — breakfast in the high chair, first " +
    "steps, the bath, the birthday cake — with the baby you choose, the name you type, one " +
    "of your own photographs and your words in the front.",
};

export const SHELF: readonly ShelfEntry[] = [
  WHEN_THEY_WERE_SMALL,
  {
    kind: "being-made",
    placeholder: "The next one\nis being made",
    heading: "Coming next",
    line: "The shelf is built to hold more. Each new title drops in beside this one.",
    action: "Not yet",
  },
] as const;

/** Every title on the shelf, placeholders dropped. */
export function titles(shelf: readonly ShelfEntry[] = SHELF): ShelfTitle[] {
  return shelf.filter((entry): entry is ShelfTitle => entry.kind === "title");
}

/** The title at a published address, or null — which a route turns into a 404. */
export function titleFor(slug: string, shelf: readonly ShelfEntry[] = SHELF): ShelfTitle | null {
  return titles(shelf).find((title) => title.slug === slug) ?? null;
}

export function pathOf(title: ShelfTitle): string {
  return `/books/${title.slug}`;
}

/**
 * `From USD 49`, in the market being shown.
 *
 * The lowest of the editions, formatted by the module that owns the money. It
 * is "from" because there are two editions and the second is dearer — not
 * because anything was ever more expensive. The market is an argument rather
 * than a default so that a tile cannot quietly quote the wrong currency: a
 * caller with no market to hand is a caller that has not decided yet.
 */
export function fromPrice(market: Market): string {
  return `From ${priceOf(priceIn(cheapestIn(market), market))}`;
}
