/**
 * **One look's tile: page one of the book, drawn with that look's baby.**
 *
 * The drawing is here and the markup is not, because two screens show the same
 * tile in two shapes — the chooser's grid and the flow's carousel — and the
 * thing that must not differ between them is *which page is drawn and with
 * what*. `CLAUDE.md`'s rule for the editor is the same rule: the arithmetic is
 * pure and shared, the React is glue and is not.
 *
 * Not a thumbnail, not a crop, not a separately supplied image — a tile that
 * was its own file is a tile that can drift from the book it is advertising,
 * and the first anybody would know is a buyer who chose a baby and got another.
 *
 * **Which page it is comes from the book**, not from a component.
 * `BookTemplate.tilePage` is declared because this book's opening spread is
 * deliberately babyless — the one spread identical across every look, which is
 * what lets it carry the buyer's photograph and words — and tiles drawn from it
 * would be twelve identical pictures under the question "which baby?".
 * `validateBook` refuses a babyless tile page.
 *
 * It renders with **no name**, so a half-typed name does not flicker across
 * twelve tiles while somebody is still deciding.
 */

import { pageFillFor, pageTemplateFor, tileIndexOf } from "../../lib/book/derive";
import { renderPageSvg } from "../../lib/render/svg";
import type { BookTemplate } from "../../lib/book/types";

export function lookTileSvg(book: BookTemplate, lookId: string, coverId: string): string {
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
    { href: (ref) => `/api/assets/${ref.sha256}.png` },
  );
}
