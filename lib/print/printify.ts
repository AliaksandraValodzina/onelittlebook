/**
 * **Printify's own templates, as numbers somebody read out of the files.**
 *
 * Every size in this module came out of a PSD header, and the file it came out
 * of is named beside it. That is the whole point of the module: `docs/print.md`
 * spent a fortnight reasoning about a print area nobody had opened, and the
 * reasoning was wrong in both directions at once — the trim was taken to be
 * 8.00 in when the finished panel is 7.75, and the bleed was declared at
 * 0.25 in when it is 0.125. A measurement with a filename attached cannot be
 * argued with, and a measurement without one is what this replaces.
 *
 * ## What is derived here and never typed
 *
 * **The bleed**, which is `(area − finished) ÷ 2` and comes out the same on
 * both axes — 37.5 px, 0.125 in at 300 dpi. **The spine**, which is what is
 * left of the finished width once both panels are taken out of it. **Every
 * inch figure**, which is pixels over dpi. Typing any of them would be typing
 * a number that is already in the file above it, and the first edit would make
 * the two disagree.
 *
 * ## What a product without a template looks like
 *
 * **It looks like nothing, and that is deliberate.** There is no `estimated`
 * field, no "about the same as the softcover", and no default. A product whose
 * template nobody has opened has no `MeasuredTemplate` at all — see
 * `lib/book/cover-wrap.ts` § `COVER_PRODUCTS`, which is a union with the
 * template on one arm only, exactly as `lib/shop/shipping.ts` leaves `RATES`
 * null and `lib/product.ts` keeps `value` off the unconfirmed arm. The
 * hardcover's spine is wider than the softcover's and by an amount only its
 * own template says, so a wrap composed from these numbers would be a
 * plausible wrong file: the back cover would be cut into and the spine would
 * not land on the hinge.
 */

/** A size in pixels. The unit every number in a Printify template is in. */
export interface Px {
  width: number;
  height: number;
}

/**
 * One Printify print-area template, as read out of the file it ships in.
 *
 * `area` is the **whole supplied image**, bleed included — the thing the
 * renderer produces and the captain uploads. `finished` is what is left after
 * the guillotine. `safety` is the box inside one panel that Printify's own
 * guide layer marks green, and `docs/print.md` § Does Printify want bleed?
 * quotes their instruction to keep every key visual inside it.
 */
export interface MeasuredTemplate {
  /** The file these numbers were read out of. Never a product page, never a guess. */
  file: string;
  /** The SKU range printed in the template, which is how a reader finds the product. */
  sku?: string;
  /** Printify's own blueprint number, for the Product Creator. */
  blueprint?: number;
  dpi: number;
  /** The whole supplied area, bleed included. */
  area: Px;
  /** The finished object, after the cut. */
  finished: Px;
  /**
   * The safety zone of **one panel**, which is the same for both panels of a
   * cover wrap because the two panels are the same size.
   */
  safety: Px;
  /**
   * One panel's own finished size, when the product is not square.
   *
   * **Absent means the panel is a square of the finished height**, which is
   * what an 8 × 8 book is and is why nothing below has to be told. A product
   * with a portrait panel declares it here, and the spine stays derived — it
   * is the finished width less both panels either way.
   */
  panel?: Px;
}

/**
 * **The softcover photo book's cover wrap, measured 15 November 2026.**
 *
 * Read out of the header of `Template_Custom_SoftcoverBook_8x8_Cover.psd`,
 * downloaded from Printify's Product Creator for the product its own template
 * names *"8.00 x 8.00 CUSTOM SOFTCOVER BOOK"*. Three facts and the arithmetic
 * that follows from them:
 *
 * | | |
 * |---|---|
 * | Supplied area | 4790 × 2400 px = 15.967 × 8.000 in, RGB 8-bit |
 * | Finished | 4715 × 2325 px = 15.717 × 7.750 in |
 * | Safety zone, per panel | 2220 × 2250 px = 7.40 × 7.50 in |
 *
 * — so the bleed is 37.5 px, **0.125 in**, equal on both axes; the finished
 * panel is **7.75 in square**, not the 8.00 the product is *called*; and the
 * spine is 4715 − 2 × 2325 = **65 px, 0.217 in**. "8 × 8" is the product's
 * name and not its trim, which is the single most expensive sentence on this
 * page.
 *
 * The PSD itself is the captain's download and is deliberately not in this
 * repository: it is somebody else's template, and the four sizes above are the
 * whole of what this codebase needs from it.
 */
export const SOFTCOVER_COVER_WRAP: MeasuredTemplate = {
  file: "Template_Custom_SoftcoverBook_8x8_Cover.psd",
  sku: "11687–11853",
  blueprint: 2733,
  dpi: 300,
  area: { width: 4790, height: 2400 },
  finished: { width: 4715, height: 2325 },
  safety: { width: 2220, height: 2250 },
};

/**
 * **The interior page's supplied area, from the same download.**
 *
 * 2400 × 2400 px at 300 dpi, which is **8.00 in square** — the number that
 * settles `docs/print.md`'s long-running question about what 3600 px is 3600
 * of. The interior template's own finished size and safety zone were not read,
 * so they are not here; what the cover template says about the product is that
 * 0.125 in comes off each edge, which would make the finished page 7.75 in
 * square, and that is an inference rather than a measurement until somebody
 * opens the interior file's guide layers.
 *
 * **The book does not declare this yet, and `docs/print.md` § The page the
 * book declares is not the page Printify prints says so plainly.**
 * `templates/first-book.ts` declares a 612 pt (8.5 in) artboard with 18 pt of
 * bleed, which overstates the page by 6.25% and cannot be corrected without
 * re-authoring every coordinate in the template — so it is reported rather
 * than quietly changed. Nothing in the cover wrap depends on it: the wrap's
 * geometry comes from the numbers above and the square cover is fitted to the
 * panel, which is scale-invariant.
 */
export const SOFTCOVER_INTERIOR_AREA: Px = { width: 2400, height: 2400 };

/** Inches, at a template's own resolution. The only place pixels become inches. */
export function inchesOf(px: number, dpi: number): number {
  return px / dpi;
}

/** Points, at a template's own resolution. A page template's unit is the point. */
export function pointsOf(px: number, dpi: number): number {
  return (px / dpi) * 72;
}

/**
 * How far inside the supplied area the cut runs, in pixels.
 *
 * Derived from the height, and `test/cover-wrap.test.ts` asserts that the width
 * agrees — they do, at 37.5 px, which is what makes one number honest.
 * A template whose axes disagreed would be a template with two bleeds, and the
 * right response to that is to read the file again rather than to average them.
 */
export function bleedPxOf(t: MeasuredTemplate): number {
  return (t.area.height - t.finished.height) / 2;
}

/** The same thing on the other axis, so a test can ask whether they agree. */
export function bleedPxAcross(t: MeasuredTemplate): number {
  return (t.area.width - t.finished.width) / 2;
}

/** One panel's finished size — declared when the product is not square. */
export function panelPxOf(t: MeasuredTemplate): Px {
  return t.panel ?? { width: t.finished.height, height: t.finished.height };
}

/**
 * The spine, in pixels: the finished width less both panels.
 *
 * **Never measured directly and never estimated.** It is the one number on a
 * cover wrap that nobody publishes, because it is a consequence of the paper
 * and the binding — which is exactly why a hardcover wrap cannot be derived
 * from a softcover one, and why `lib/book/cover-wrap.ts` refuses rather than
 * stretching.
 */
export function spinePxOf(t: MeasuredTemplate): number {
  return t.finished.width - 2 * panelPxOf(t).width;
}
