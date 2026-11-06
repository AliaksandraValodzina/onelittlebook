/**
 * **The book as an object on the page — drawn by the one renderer.**
 *
 * Every cover anywhere in the shop comes through here: the hero, each shelf
 * tile, the book page's gallery, the hardcover screen and the basket line. The
 * artefacts drew it as a CSS block with the name typeset in it, which is the
 * right thing for an artefact and the wrong thing for a shop — a cover drawn
 * twice is a cover that can disagree with itself, and the one that disagrees is
 * always the one the customer is looking at.
 *
 * So this calls `renderPageSvg` on the book's own cover page, which is the same
 * call `lib/render/raster.ts` makes on the way to the print file. The shadow,
 * the fore-edge and the tilt stay in CSS (`.bk` in `app/shop.css`) because they
 * are the *photograph* of the object and must never reach a print file.
 *
 * **No node imports.** This is rendered on the server by the landing and book
 * pages and in the browser by the flow, so the address of an asset arrives as
 * `href` rather than being resolved here — `lib/assets/resolve.ts` reads the
 * filesystem and cannot be imported into a client component. The default is the
 * route that serves the fixture store, which is what the browser can reach.
 */

import type { AssetRef } from "../../lib/template/types";
import type { BookTemplate } from "../../lib/book/types";
import { pageFillFor, pageTemplateFor } from "../../lib/book/derive";
import { renderPageSvg } from "../../lib/render/svg";

/** The browser-safe address: the route that answers out of the fixture store. */
export function apiAssetUrl(ref: AssetRef): string {
  return `/api/assets/${ref.sha256}.png`;
}

export interface CoverProps {
  book: BookTemplate;
  /** What is printed on it. An empty string draws the cover with no name. */
  name: string;
  lookId?: string;
  coverId?: string;
  href?: (ref: AssetRef) => string;
  /** Extra classes on the `.bk` block — the shelf and the basket size it down. */
  className?: string;
}

/**
 * The cover page's index in the sequence.
 *
 * Asked of the sequence rather than assumed to be zero: `pageSequence` is the
 * cover followed by the interior, and a book whose cover moved would otherwise
 * put page one in the hero with no test noticing.
 */
export function coverSvg({
  book,
  name,
  lookId,
  coverId,
  href = apiAssetUrl,
}: Omit<CoverProps, "className">): string {
  const chose = {
    lookId: lookId ?? book.looks[0].id,
    coverId: coverId ?? book.covers[0].id,
  };
  return renderPageSvg(
    pageTemplateFor(book, 0, chose),
    pageFillFor(book, 0, {
      schema: 1,
      bookId: book.id,
      bookRev: book.rev,
      lookId: chose.lookId,
      coverId: chose.coverId,
      name,
      dedication: "",
    }),
    { href },
  );
}

export default function Cover(props: CoverProps) {
  const { className = "" } = props;
  return (
    <div
      className={`bk ${className}`.trim()}
      data-testid="cover"
      // The renderer's output, inlined. The screen path has always done this —
      // see `app/_book/BookPage.tsx` — because an `<img src="data:…">` would be
      // a second encoding of the same drawing.
      dangerouslySetInnerHTML={{ __html: coverSvg(props) }}
    />
  );
}
