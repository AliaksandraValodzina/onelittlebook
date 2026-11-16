/**
 * **The published book, bound to the artwork this machine actually has.**
 *
 * `lib/artwork/release.ts` reads the three delivered sets off the store; this
 * turns them into the book the renderer draws. It is the release-side twin of
 * `./order-art.ts` and it is the same shape for the same reasons: a **pure
 * function**, so the whole binding is testable without a filesystem, and one
 * that **keeps `id` and `rev`** rather than minting new ones.
 *
 * ## What it changes, in three sentences
 *
 * A page the captain has delivered becomes `{ kind: "asset" }` with the looks
 * that have artwork in `byLook` **and the page's own drawn scene kept as the
 * fallback**, because most of the looks are still being drawn and a
 * refusal there would mean no real artwork could be seen until the last one
 * landed. A look with a delivered portrait gets it as its chooser `tile`, and a
 * look with delivered cover wraps gets them as its `wraps` — the two things the
 * captain delivers about a *look* rather than about a page. A page
 * with a delivered golden ghost half gets it as its `ghost`, which only the
 * photo path's preview can draw and the type system will not let anybody print.
 *
 * **The cover binds through the page machinery and nothing special.** The
 * display cover is cut out of the softcover wrap at intake
 * (`lib/book/cover-upload.ts`) and stored under the book's own cover page id, so
 * it arrives in `byLook` exactly as page nine does and the picker, the preview
 * and the basket learn nothing new.
 *
 * ## Why the rev is carried through unchanged
 *
 * `./order-art.ts` makes this argument for one order's artwork and it holds
 * here for a different reason. `rev` names the published document the buyer
 * approved — the words, the slots, the page order, the limits — and none of
 * that is what this touches. More to the point, **the artwork is not in the
 * repository** (`lib/artwork/release.ts` § Why none of it is in the
 * repository), so a rev that moved when artwork landed would differ between the
 * captain's machine and a fresh clone: `isStamped` would fail on one of the
 * two, `npm run print`'s byte-identity gate would be meaningless, and every
 * existing order would read as a stale revision the moment the first look was
 * imported.
 *
 * The honest consequence is written down rather than hidden: a re-import of
 * corrected artwork changes what a reprint looks like without changing the rev.
 * `lib/artwork/release.ts` § The consequence of that, stated plainly names what
 * closes it and why that waits on the storage decision.
 */

import { pageSequence } from "./derive";
import type { ReleaseArtwork } from "../artwork/release";
import type { AssetRef } from "../template/types";
import type { BookPage, BookTemplate, Look } from "./types";

/**
 * The book as this machine can draw it.
 *
 * Returns the book **unchanged** when nothing has been delivered, so no call
 * site has to ask whether there is artwork before deciding which book to
 * render — exactly as `bookWithOrderArtwork` returns it unchanged for an order
 * with no artwork.
 */
export function bookWithReleaseArtwork(book: BookTemplate, art: ReleaseArtwork): BookTemplate {
  const lookIds = book.looks.map((l) => l.id);
  const delivered = lookIds.filter((id) => art.pages[id] && Object.keys(art.pages[id]).length);
  const hasTiles = book.looks.some((l) => art.tiles[l.id]);
  const hasWraps = book.looks.some((l) => art.wraps[l.id]);
  const hasGhosts = Object.keys(art.ghosts).length > 0;
  if (delivered.length === 0 && !hasTiles && !hasWraps && !hasGhosts) return book;

  const bind = (page: BookPage): BookPage => {
    const byLook: Record<string, AssetRef> = {};
    for (const id of delivered) {
      const asset = art.pages[id][page.id];
      if (asset) byLook[id] = asset;
    }
    const ghost = art.ghosts[page.id];

    // A page nobody has delivered keeps the artwork it had, which for a page of
    // this book is its drawn scene. Every look whose cover wraps have not landed
    // is in that state for its cover, and a book whose interior is the captain's
    // and whose cover is still the placeholder is visibly unfinished — which is
    // the honest state to be in.
    if (Object.keys(byLook).length === 0) {
      return ghost ? { ...page, ghost } : page;
    }

    const everyLook = Object.keys(byLook).length === lookIds.length;
    return {
      ...page,
      art: {
        kind: "asset",
        byLook: { ...(page.art.kind === "asset" ? page.art.byLook : {}), ...byLook },
        // **Kept while the import is partial and dropped when it is complete**,
        // which is how the strict rule comes back on its own: with every look
        // delivered there is no fallback, so `validateBook` reports
        // `art.lookMissing` again for a look whose artwork went missing.
        ...(everyLook ? {} : { scene: page.art.scene }),
      },
      ...(ghost ? { ghost } : {}),
    };
  };

  /**
   * The look, with the two things the captain delivers *about a look* rather
   * than about a page: its chooser portrait and its cover wraps.
   *
   * Both are absent for almost every look and both are read through one door
   * (`lib/book/cover-wrap.ts` § `deliveredWrapOf` for the second), so a look
   * with neither comes back as the same object and nothing downstream has to
   * ask which state it is in.
   */
  const bound = (look: Look): Look => {
    const tile = art.tiles[look.id];
    const wraps = art.wraps[look.id];
    if (!tile && !wraps) return look;
    return { ...look, ...(tile ? { tile } : {}), ...(wraps ? { wraps } : {}) };
  };

  return {
    ...book,
    looks: book.looks.map(bound),
    cover: bind(book.cover),
    pages: book.pages.map(bind),
  };
}

/**
 * The look to show somebody who has not chosen one.
 *
 * **The first look this machine has finished artwork for**, and the book's own
 * first look when it has none — so the shop's book page shows the real book
 * where there is one and the placeholder where there is not, without either
 * page knowing which state the artwork is in. Derived from the pages rather
 * than declared, because "which looks are delivered" is not something the
 * repository knows (`lib/artwork/release.ts` § Why none of it is in the
 * repository) and a field for it would be a field that goes stale.
 */
export function showcaseLook(book: BookTemplate): Look {
  const delivered = new Set(
    book.pages.flatMap((page) => (page.art.kind === "asset" ? Object.keys(page.art.byLook) : [])),
  );
  return book.looks.find((look) => delivered.has(look.id)) ?? book.looks[0];
}

/**
 * The pages this machine has the captain's artwork for, for one look, as
 * indices into `pageSequence`.
 *
 * **Derived from the pages and not from a manifest**, for `showcaseLook`'s
 * reason: which looks are delivered is environment state
 * (`lib/artwork/release.ts` § Why none of it is in the repository), so the only
 * honest answer is the one the bound book itself carries. Empty is the ordinary
 * state of a fresh clone and of every look still being drawn — a caller that
 * wants to show real artwork has to say what it does with nothing, which is the
 * whole point of returning a list rather than a page.
 */
export function deliveredPagesFor(book: BookTemplate, lookId: string): number[] {
  return pageSequence(book).flatMap((page, index) =>
    page.art.kind === "asset" && page.art.byLook[lookId] ? [index] : [],
  );
}

/** Which pages of the book this binding actually changed, in reading order. For the admin page. */
export function releaseArtworkPageIds(book: BookTemplate, art: ReleaseArtwork): string[] {
  const covered = new Set(
    Object.values(art.pages).flatMap((byPage) => Object.keys(byPage)),
  );
  return pageSequence(book)
    .map((p) => p.id)
    .filter((id) => covered.has(id));
}
