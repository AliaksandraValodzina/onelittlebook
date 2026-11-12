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
 */

import { lookOf, pageFillFor, pageTemplateFor, tileIndexOf } from "../../lib/book/derive";
import { renderPageSvg } from "../../lib/render/svg";
import { hrefIn, type AssetAddresses } from "../../lib/assets/address";
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
 */
export function lookTile(
  book: BookTemplate,
  lookId: string,
  coverId: string,
  assets?: AssetAddresses,
): LookTile {
  const href = hrefIn(assets);
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
