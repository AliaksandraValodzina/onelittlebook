/**
 * **The fold down the middle of a spread. It is screen chrome, and it is a
 * kind of thing a print file cannot contain.**
 *
 * ## What it is for
 *
 * A spread of this book is one picture across two pages, and the captain's own
 * generation brief composes every one of them around the binding: *"the
 * vertical centre line is the book fold; no face, hand or key object within 8%
 * of it."* The preview used to draw two rounded panels with a white gap between
 * them, which made that deliberately quiet middle read as an empty gap between
 * two separate pictures. Drawing the fold makes the composition legible: the
 * two halves meet, the paper bends into the binding, and the quiet middle is
 * where the binding is.
 *
 * ## WHY IT IS CSS AND NOT A LAYER, AN ART KIND OR A RENDER OPTION
 *
 * **A gutter shadow baked into a print file is a grey smear down the middle of
 * a real book, and it cannot be undone after printing.** The physical book
 * makes its own fold; a printed page is a flat raster, and shading it for a
 * curvature the paper is about to have for real is a defect in the same family
 * as a trim mark inside the book.
 *
 * `lib/render/ghost.ts` § WHY THIS IS A RENDER OPTION makes the argument for
 * the previous member of this family, and the pattern `CLAUDE.md` states is
 * *"an option on the render call that the print path does not pass"*. The fold
 * goes one step further than `guides` and `ghost`, because it does not have to
 * be an option at all:
 *
 * **It is not a thing that is drawn on a page.** It spans two pages and lives
 * in the space where they meet, which no `PageTemplate` describes — the
 * renderer draws one page at a time and has no notion of a facing page. So the
 * fold is a **DOM element and a stylesheet rule** laid over the two rendered
 * pages by the browser: see `app/shop.css` § the open book, and
 * `app/_book/Preview.tsx`, which is the only component that mounts one.
 *
 * The guarantee is therefore not "the print path does not pass the option" but
 * "there is no option, and nothing in this module produces anything the
 * renderer accepts". A `SpreadFold` is three class names and a fraction. It is
 * not an `Art`, a `Layer`, a `ShapeSpec` or a `GhostOptions` — its `kind` is
 * none of theirs and it carries no `frame` — so TypeScript refuses it
 * everywhere a renderer would take it.
 * `test/no-fold-in-a-print-file.ts` is a file of calls that must not compile,
 * exactly as `test/no-order-asset-in-the-public-store.ts` is for the two
 * artwork stores, so `npm run lint` is half the gate;
 * `test/spread-fold.test.tsx` is the other half and reads the rendered bytes.
 *
 * ## The one number
 *
 * `reach` is how far the shading reaches out from the join, as a fraction of
 * **one page's** width. That is the unit a template's slot frames are in, so
 * the keep-clear claim this module makes about the buyer's photograph and
 * dedication is checked against the template's own boxes rather than against a
 * number somebody typed twice — `test/spread-fold.test.tsx` § the opening
 * spread does that arithmetic.
 *
 * The stylesheet gets the same number through `foldBand`, so the paint and the
 * test cannot disagree about where the shading goes.
 */

/**
 * The fold, as the browser needs it: what to call the three elements, and how
 * far the shading reaches.
 *
 * **`kind` is `"fold"`, which is not a kind anything in
 * `lib/template/types.ts` has.** That is deliberate and it is the structural
 * guard: a value of this type cannot be put in a template's `layers`, cannot be
 * an `image` layer's asset, and cannot be passed as `RenderOptions.ghost`.
 */
export interface SpreadFold {
  /** Discriminates it for a reader. The structural guard is the whole shape. */
  kind: "fold";
  /** The one container around the whole spread. The page shadow is on this. */
  open: string;
  /** The two pages, meeting, with no gap. */
  leaves: string;
  /** The gutter shading itself: an overlay, `aria-hidden`, no pointer events. */
  crease: string;
  /**
   * How far the shading reaches out from the join, as a fraction of **one
   * page's** width.
   *
   * 0.08 is half of the keep-clear the generation brief asks of the artwork
   * when that 8% is read as 8% of the spread, and exactly it when read as 8% of
   * a page — so the shading is at or inside the margin the pictures were
   * composed with on either reading. What actually settles it is the test,
   * which measures this against the slots on the opening spread.
   */
  reach: number;
}

/**
 * The fold. One of them, because there is one way a book opens.
 *
 * It is a value rather than three string literals in a component so that the
 * test looking for the fold's marks in the preview — and for their absence in
 * every print render — is looking for the same strings the preview writes.
 */
export const SPREAD_FOLD: SpreadFold = {
  kind: "fold",
  open: "spread-open",
  leaves: "spread-leaves",
  crease: "spread-fold",
  reach: 0.08,
};

/**
 * The width of the shaded band, as a CSS length the overlay element can take.
 *
 * A spread is two pages wide, so a band reaching `reach` of a page out on
 * **each** side of the join is `reach` of the spread — the twos cancel, which
 * is worth stating because it is the step a reader checks twice.
 *
 * It is handed to the element inline rather than written in the stylesheet so
 * that `SpreadFold.reach` is the only place the number exists; `app/shop.css`
 * owns the gradient and the position and no measurement.
 */
export function foldBand(fold: SpreadFold = SPREAD_FOLD): string {
  return `${Number((fold.reach * 100).toFixed(4))}%`;
}

/**
 * How far from the gutter edge of a page the shading reaches, in that page's
 * own units.
 *
 * The preview does not need this; the test does, and so would anybody moving a
 * slot on the opening spread. A page's gutter edge is `x = 0` on a right-hand
 * page and `x = width` on a left-hand one, so a caller asks with the side it
 * has.
 */
export function foldReachIn(pageWidth: number, fold: SpreadFold = SPREAD_FOLD): number {
  return pageWidth * fold.reach;
}
