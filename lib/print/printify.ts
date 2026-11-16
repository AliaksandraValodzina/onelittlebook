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
 *
 * ## What a size somebody counted looks like
 *
 * **A `DerivedWrap`, which is not a `MeasuredTemplate` and cannot be used as
 * one.** The captain exported three hardcover wraps and they were all
 * 5370 × 2850, so that size is known in the only way a size can be known
 * without a template: by counting files. Everything inside it — where the front
 * panel starts, how wide the spine is, how much wrap allowance there is — is
 * arithmetic on two assumptions nobody has checked. So the outer size is
 * recorded in a type with no `finished` and no `safety` on it, which makes it
 * usable for the one question it can answer (*is this file the right size?*)
 * and structurally unusable for the one it cannot (*where does the title go?*).
 * `HARDCOVER_COVER_WRAP_DERIVED` is that record.
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

/**
 * **The box the finished front panel occupies in a supplied wrap**, in that
 * wrap's own pixels.
 *
 * This is the cut. The captain delivers one wordless wrap per product and the
 * display cover is **taken out of it** rather than supplied beside it, for the
 * reason `lib/book/cover-upload.ts` § Why the square is cut and never supplied
 * gives: a separately-exported square and a wrap are composed by hand twice,
 * and the day they differ a buyer previews one cover and receives another.
 * Cutting makes that unrepresentable.
 *
 * Derived from the same four measurements as everything else — the panel, the
 * bleed and the spine — so a product with another template cuts another box.
 *
 * **The trim does not land on a pixel boundary and the cut therefore rounds.**
 * The softcover's bleed is 37.5 px, half a pixel, so the finished panel runs
 * from x = 2427.5 to x = 4752.5 and no window of whole pixels is exactly it.
 * The origin is rounded **up**, which moves the window half a pixel *away from
 * the spine*: the spine is the fold, and a sliver of it on the front of the
 * book is the one error of the two that is visible on a finished object. What
 * is lost instead is half a pixel of panel at the inner edge, replaced by half
 * a pixel of the bleed at the outer one — and bleed is artwork, so nothing is
 * invented. The size stays the panel's own, exactly, which is what makes the
 * cut the same square the captain's own separate export came out at.
 */
export function frontPanelPxOf(t: MeasuredTemplate): Px & { x: number; y: number } {
  const panel = panelPxOf(t);
  return {
    x: Math.ceil(bleedPxOf(t) + panel.width + spinePxOf(t)),
    y: Math.ceil(bleedPxOf(t)),
    width: panel.width,
    height: panel.height,
  };
}

/**
 * **A wrap whose outer size somebody counted and whose insides nobody has
 * measured.**
 *
 * Deliberately **not** a `MeasuredTemplate`: it has no `file`, no `finished`
 * and no `safety`, so TypeScript refuses it everywhere a template goes —
 * `wrapGeometry`, `panelPxOf`, `frontPanelPxOf`, `spinePxOf`, the whole of
 * `lib/book/cover-wrap.ts`. That is the same trick `lib/book/preview-art.ts`
 * plays with `PreviewAsset` against `AssetRef`, and it is here for the same
 * reason: the arithmetic below is self-consistent and unconfirmed, and the one
 * outcome worse than refusing is a title printed 120 px off a hinge.
 *
 * It exists so the thing that *is* known can be used — the supplied size, which
 * is what an uploaded file is checked against — without the thing that is not
 * known being usable at all.
 */
export interface DerivedWrap {
  /** What the file has to be. The only number here anybody actually counted. */
  area: Px;
  /** Derived from the panel coming out square at this resolution. */
  dpi: number;
  /** How the numbers were arrived at, and what they are worth. */
  derivation: string;
  /** What has to be read, from which file, to turn this into a template. */
  needs: string;
  /**
   * The arithmetic, recorded rather than used.
   *
   * Nothing in this repository reads these. They are here so that whoever
   * opens the real template can check it against what was inferred — and so
   * that the inference is written down once instead of re-done from scratch by
   * the next person holding three files of the same size.
   */
  inferred: {
    /** The wrap allowance, each edge: what a hardcover turns round the board. */
    allowance: number;
    /** The spine, which is the number a hardcover cannot share with a softcover. */
    spine: number;
    panel: Px;
  };
}

/**
 * **The hardcover's cover wrap: one size, counted, and nothing else.**
 *
 * The captain exported three of these — girl-01, girl-02 and girl-03 — and all
 * three came out **5370 × 2850 px**. That is a count of files and not a reading
 * of a template, which is the whole distinction this module exists to keep.
 *
 * The arithmetic that follows from it is self-consistent, and that is exactly
 * what makes it dangerous: 2850 − 2400 = 450, so 225 px (0.75 in) of wrap
 * allowance top and bottom; 5370 − 4800 − 450 = 120, so a 120 px (0.40 in)
 * spine with the same allowance each side; panels 2400 square, which is 8.00 in
 * at 300 dpi and matches the interior area exactly. Every one of those numbers
 * is a consequence of assuming the panels are 2400 and the allowance is equal
 * on all four edges, and **neither assumption has been checked against
 * anything**. A hardcover's spine depends on its board and its hinge, and a
 * template is the only thing that says where its front panel starts.
 *
 * So the file is accepted, stored and reported, and **no title is drawn on
 * it** — `lib/book/cover-wrap.ts` § `COVER_PRODUCTS` keeps the hardcover on the
 * unmeasured arm and `measuredProduct` still refuses. The bytes are right
 * whatever we believe about the panel, so keeping them costs nothing and
 * re-delivery costs the captain a day; the title is the one thing that cannot
 * be placed without the measurement, and it is the one thing that waits.
 */
export const HARDCOVER_COVER_WRAP_DERIVED: DerivedWrap = {
  area: { width: 5370, height: 2850 },
  dpi: 300,
  derivation:
    "counted off three files the captain exported on 16 November (girl-01, girl-02, girl-03), " +
    "all three 5370 x 2850. The insides are inferred by assuming 2400 px square panels and an " +
    "equal allowance on all four edges, and neither assumption has been checked against " +
    "Printify's own template.",
  needs:
    "Printify's hardcover 8 x 8 cover template, and the four numbers in its header: the " +
    "supplied area in pixels, the finished size in pixels, the safety zone per panel in " +
    "pixels, and the resolution. Those make a MeasuredTemplate in lib/print/printify.ts and " +
    "flip COVER_PRODUCTS.hardcover to its measured arm; nothing else changes, and the wraps " +
    "already uploaded do not need re-delivering.",
  inferred: {
    allowance: (2850 - 2400) / 2,
    spine: 5370 - 2 * 2400 - (2850 - 2400),
    panel: { width: 2400, height: 2400 },
  },
};
