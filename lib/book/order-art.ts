/**
 * **One order's own artwork, bound to the published book.**
 *
 * The photo path's last step. The captain has downloaded the clean pages
 * (`./artwork.ts`), had an image tool replace the child with one resembling the
 * buyer's, and uploaded the result against the order
 * (`./order-upload.ts`, `lib/artwork/store.ts`). This is what turns that into a
 * book the one renderer can draw.
 *
 * ## The custom look is the order's own look, repainted
 *
 * The brief asks for *"a custom look used by that order alone"*, and the
 * cheapest honest way to have one is **not** to invent a thirteenth look id.
 * `BookFill.lookId` already names the look this order was composed against, and
 * everything the order carries — the name, the dedication, the photograph, the
 * fingerprint, the order record — names it too. So the derived book keeps that
 * id and changes **which pixels it points at**, which is exactly what a look
 * is: `lib/book/types.ts` § `Look` is explicit that a look *"contributes
 * nothing but what is drawn underneath"*.
 *
 * The alternative — a new look id on the order — would change
 * `orderFingerprint`, and the fingerprint is the order's reference and Stripe's
 * idempotency key. Repainting an order must not rename it.
 *
 * ## Why the derived book has one look and one cover
 *
 * `validateBook` refuses a page with uploaded artwork that is missing for any
 * look the book offers (`art.lookMissing`) — correctly, because in a published
 * book that is a chooser offering a tile that renders a blank page. A book
 * carrying one order's artwork offers exactly one look, so it declares exactly
 * one, and the genders question goes with it: a gender whose grid is empty is
 * its own refusal (`gender.noLooks`) and this book has no grid.
 *
 * The same argument applies to the covers. A regenerated **cover** is an
 * uploaded image, which cannot have its ground recoloured, and a book offering
 * three cover choices that change nothing visible is `cover.choiceDoesNothing`.
 * The order chose one cover; the derived book offers that one.
 *
 * **This is a print-time derivation and never a published book.** It is not
 * written to `templates/`, nothing restamps a `rev` for it, and it is built
 * fresh from the committed template on every download. `rev` is deliberately
 * carried through unchanged: it names the published document the buyer approved
 * — the words, the slots, the page order, the limits, none of which this
 * touches — and `fill.staleRevision` would otherwise fire on every order the
 * moment its artwork landed. What changed is recorded where it belongs, in the
 * artwork version, which goes in the download's own filename.
 */

import { coverOf, lookOf, pageSequence } from "./derive";
import type { ArtworkVersion } from "../artwork/store";
import type { AssetRef } from "../template/types";
import type { BookFill, BookPage, BookTemplate } from "./types";

/**
 * The book this order prints from, given the artwork uploaded against it.
 *
 * A page the upload does not cover **keeps the artwork it already had**, which
 * is what makes the twelve-page default of the clean-artwork download work: the
 * left-hand halves and the babyless opening spread are the same in every look
 * and were never regenerated, so they draw exactly as they did before.
 *
 * `null` artwork returns the book unchanged rather than a special case, so a
 * caller does not have to ask whether an order has artwork before deciding
 * which book to render.
 */
export function bookWithOrderArtwork(
  book: BookTemplate,
  fill: BookFill,
  artwork: ArtworkVersion | null,
): BookTemplate {
  if (!artwork || artwork.pages.length === 0) return book;

  const look = lookOf(book, fill.lookId);
  const cover = coverOf(book, fill.coverId);
  const byPage = new Map<string, AssetRef>(artwork.pages.map((p) => [p.pageId, p.asset]));

  /**
   * Artwork for the looks this derived book no longer offers, dropped.
   *
   * It offers exactly one — see this file's docblock — and `validateBook`
   * reports `art.lookUnknown` for a page declaring artwork for a look the book
   * does not have. Since `printProblems` is every problem `validateBook` finds,
   * leaving the released artwork for the other eleven looks on the page would
   * **refuse to print this order**, which is the kind of failure that only
   * appears once a second look has been delivered.
   */
  const only = (byLook: Record<string, AssetRef>): Record<string, AssetRef> =>
    Object.fromEntries(Object.entries(byLook).filter(([id]) => id === look.id));

  const repaint = (page: BookPage): BookPage => {
    const asset = byPage.get(page.id);
    const already = page.art.kind === "asset" ? only(page.art.byLook) : {};
    if (!asset) {
      // The page keeps the artwork it had — which is the released look's own
      // pages for an order of a look the captain has delivered, and the drawn
      // placeholder for one they have not.
      return page.art.kind === "asset" ? { ...page, art: { ...page.art, byLook: already } } : page;
    }
    return {
      ...page,
      // Merged into whatever the page already declared, so the clean-artwork
      // download's twelve-page default leaves the other thirteen pages exactly
      // as they were, whichever state the project's artwork is in.
      art: {
        kind: "asset",
        byLook: { ...already, [look.id]: asset },
        ...(page.art.kind === "asset" && page.art.scene ? { scene: page.art.scene } : {}),
      },
    };
  };

  return {
    ...book,
    // One look, one cover, no gender question — see this file's docblock. The
    // look's own `gender` tag goes with the question: a look tagged for a grid
    // the book no longer offers is `look.genderUnknown`, and this book has no
    // grid because nobody is choosing anything on it.
    genders: undefined,
    looks: [{ ...look, gender: undefined }],
    covers: [cover],
    cover: repaint(book.cover),
    pages: book.pages.map(repaint),
  };
}

/** Which pages of the book a version replaces, in reading order. For the admin page. */
export function artworkPageIds(book: BookTemplate, artwork: ArtworkVersion): string[] {
  const covered = new Set(artwork.pages.map((p) => p.pageId));
  return pageSequence(book)
    .map((p) => p.id)
    .filter((id) => covered.has(id));
}
