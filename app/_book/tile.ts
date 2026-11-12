/**
 * **One look's tile: the captain's portrait of that baby, or page one of the
 * book drawn with them.**
 *
 * The drawing is here and the markup is not, because two screens show the same
 * tile in two shapes — the chooser's grid and the flow's carousel — and the
 * thing that must not differ between them is *which picture is shown and of
 * what*. `CLAUDE.md`'s rule for the editor is the same rule: the arithmetic is
 * pure and shared, the React is glue and is not.
 *
 * ## Two kinds of tile, and the order is the point
 *
 * **A delivered portrait wins.** The captain delivered a set of them — head and
 * shoulders on white, flattened at import — and approved them as the tiles on
 * 10 November. A head on white says **which baby** and nothing else, which is
 * exactly what the research asks the chooser to communicate; a whole page
 * shrunk to a tile says *which picture* in a sixth of the pixels. It is also
 * what Wonderbly does. `Look.tile` carries the rest of that reasoning,
 * including what it reverses in `docs/look-upload-contract.md` § 4.
 *
 * **Otherwise the tile is the book**, which is what it has always been:
 * `BookTemplate.tilePage` of the real book, drawn by the one renderer with that
 * look's baby in it. That is not a legacy path — it is the tile for every look
 * nobody has delivered a portrait for, and it is the whole chooser on a machine
 * with no artwork at all. `validateBook` refuses a babyless `tilePage`, so this
 * cannot quietly become a row of identical tiles.
 *
 * Neither kind is a separately supplied thumbnail of the kind that can drift
 * from the book it is advertising: the portrait is the look's own id in the
 * artwork manifest, and the page is the page.
 *
 * It renders with **no name**, so a half-typed name does not flicker across
 * a full grid while somebody is still deciding.
 *
 * `lookPanel` at the foot of this file is the same decision for the chooser's
 * one large picture, where the preference order is different because the space
 * is: a whole page is the best thing to put there and the worst thing to put in
 * a tile.
 */

import { isCover, lookOf, pageFillFor, pageTemplateFor, tileIndexOf } from "../../lib/book/derive";
import { deliveredPagesFor } from "../../lib/book/release-art";
import { renderPageSvg } from "../../lib/render/svg";
import { type AssetAddresses, type ScreenAddresses } from "../../lib/assets/address";
import { screenHrefIn } from "../../lib/assets/screen";
import type { BookTemplate } from "../../lib/book/types";
import type { AssetRef } from "../../lib/template/types";

/**
 * What to put in the tile's box: a picture to point an `<img>` at, or an SVG
 * string to inline.
 *
 * A union rather than one string, because an `<img>` and a `dangerouslySet`
 * inline SVG are genuinely different markup and the component has to know
 * which it is holding.
 */
export type LookTile =
  | { kind: "portrait"; src: string; width: number; height: number }
  | { kind: "page"; svg: string };

/**
 * The URL for a tile's bytes.
 *
 * **`assets` and not `assetUrl`**, for the reason this function existed before
 * there was an address book: this runs in a client component, where reading
 * `process.env.R2_PUBLIC_BASE_URL` would be reading a value the browser does
 * not have. What the browser *is* given is the address book the server built
 * from the artwork store (`lib/assets/address.ts`), so a delivered portrait
 * comes off the CDN, and anything the store published no address for is
 * answered by `app/api/assets/[key]/route.ts` out of wherever the bytes are.
 *
 * **`screen` first, where there is one.** A tile is shown at a couple of
 * hundred pixels and a portrait is delivered at 1254; the chooser draws one per
 * look, so the grid used to be several megabytes of pictures nobody was going
 * to look at closely. `lib/assets/screen.ts` is the preference and the reason
 * it cannot reach a print file.
 */
export function lookTile(
  book: BookTemplate,
  lookId: string,
  coverId: string,
  assets?: AssetAddresses,
  screen?: ScreenAddresses,
): LookTile {
  const href = screenHrefIn(screen, assets);
  const look = lookOf(book, lookId);
  if (look?.tile) {
    const [width, height] = look.tile.px ?? [0, 0];
    return { kind: "portrait", src: href(look.tile), width, height };
  }
  return { kind: "page", svg: lookTileSvg(book, lookId, coverId, href) };
}

/** The page-drawn tile. Not exported: `lookTile` above is the one way in. */
function lookTileSvg(
  book: BookTemplate,
  lookId: string,
  coverId: string,
  href: (ref: AssetRef) => string,
): string {
  const index = tileIndexOf(book);
  return renderPageSvg(
    pageTemplateFor(book, index, { lookId, coverId }),
    pageFillFor(book, index, {
      schema: 1,
      bookId: book.id,
      bookRev: book.rev,
      lookId,
      coverId,
      name: "",
      dedication: "",
    }),
    { href },
  );
}

// ---------------------------------------------------------------------------
// The chooser's big picture
// ---------------------------------------------------------------------------

/**
 * **What the chooser's panel shows beside the grid, in three states.**
 *
 * The panel is the large picture of the baby being chosen, and it is here
 * rather than in the screen for `lookTile`'s reason: *which picture is shown
 * and of what* is a decision about the artwork the machine has, not about
 * markup. The three arms are the three honest answers, in preference order:
 *
 * **`page`** — a page of the real book, with this look's delivered artwork on
 * it. The most honest thing there is, because it is the object the buyer is
 * choosing. The tile page is preferred so the panel and the pressed tile are
 * the same picture; any other delivered page is better than no artwork, and a
 * delivered cover is the last of them because a cover says *which book* where
 * an interior page says *which baby*.
 *
 * **`portrait`** — this look's delivered portrait, shown large. Head and
 * shoulders on white says which baby and nothing else, which is all the panel
 * is for; a look with a portrait but no pages is the ordinary state of this
 * shop today (`docs/artwork.md`).
 *
 * **`drawn`** — the tile page drawn from numbers, with the look's placeholder
 * baby in it. **Unchanged, and not a legacy path**: it is the panel on a fresh
 * clone, in CI and on every look nobody has drawn yet, which is what keeps the
 * whole flow testable and deployable with no artwork at all.
 *
 * `page` and `drawn` are the same component at different indices — `BookPage`
 * draws whatever the bound book has on that page — and they are separate arms
 * because the difference between "the captain's artwork" and "our placeholder"
 * is the thing a reviewer and a test need to be able to see.
 */
export type LookPanel =
  | { kind: "page"; index: number }
  | { kind: "portrait"; src: string; width: number; height: number }
  | { kind: "drawn"; index: number };

export function lookPanel(
  book: BookTemplate,
  lookId: string,
  assets?: AssetAddresses,
  screen?: ScreenAddresses,
): LookPanel {
  const delivered = deliveredPagesFor(book, lookId);
  const tile = tileIndexOf(book);
  // The tile page first, then the first interior page, then whatever is left —
  // which can only be the cover. Nothing counts pages: the list is the book's.
  const page = delivered.includes(tile)
    ? tile
    : (delivered.find((index) => !isCover(index)) ?? delivered[0]);
  if (page !== undefined) return { kind: "page", index: page };

  const look = lookOf(book, lookId);
  if (look?.tile) {
    const [width, height] = look.tile.px ?? [0, 0];
    return { kind: "portrait", src: screenHrefIn(screen, assets)(look.tile), width, height };
  }
  return { kind: "drawn", index: tile };
}
