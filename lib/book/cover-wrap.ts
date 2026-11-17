/**
 * **The printable cover: back, spine and front, as one wide image.**
 *
 * Printify's cover print area is not a square. It is one wide file carrying the
 * **back cover, the spine and the front** in a single piece, because a book is
 * printed flat and wrapped round the block. This module produces that file, and
 * there are two ways it can:
 *
 * **From the wrap the captain delivered**, which is the ordinary path now:
 * one wordless wrap per look per product, and the title drawn onto its front
 * panel — `suppliedCoverWrapTemplate`. The back cover and the spine are the
 * captain's own artwork, and the only thing this module adds is the words.
 *
 * **Composed from the square**, which is what a look with no delivered wrap
 * still gets: the cover page's render on the right, a wash of the look's colour
 * on the left, the spine between them — `coverWrapTemplate`. That is a fresh
 * clone, the whole test suite, and every look still being drawn.
 *
 * ## The decisions behind both, and the order they were taken in
 *
 * On **15 November 2026**, asked whether to generate three files per look — a
 * softcover wrap, a hardcover wrap and a square — the captain chose one square
 * per look with the shop composing the wrap. On **17 November** the answer
 * changed, because the captain uploads spreads to Printify directly and what
 * that actually produces per look is **two finished wraps**: softcover
 * 4790 × 2400 and hardcover 5370 × 2850. So the wraps are the source and the
 * square is **cut out of the softcover's front panel** rather than supplied
 * beside it — `lib/book/cover-upload.ts` § Why the square is cut and never
 * supplied is the reason, and it is the one that matters: a separately exported
 * square and a wrap are composed by hand twice, and the day they differ a buyer
 * previews one cover and receives another.
 *
 * The constraint that decided the first shape still holds and still decides the
 * second: **the hardcover's spine is wider than the softcover's**, so no wrap
 * of either kind can be stretched into the other. What changed is only who
 * draws the back cover.
 *
 * ## Nothing here is the softcover's numbers
 *
 * Every length below is derived from a `MeasuredTemplate` — panel, spine,
 * bleed and safety inset — and the softcover's figures appear in this file
 * nowhere. That is what makes the hardcover a configuration rather than a
 * second composition, and it is why `wrapGeometry` takes a template rather
 * than a product name.
 *
 * ## A product nobody has measured produces nothing
 *
 * `COVER_PRODUCTS` is a union with the template on one arm only, so there is
 * nowhere to put an estimate — the same arrangement as `lib/shop/shipping.ts`
 * § `RATES` (null until the real table exists), `lib/product.ts` § `Fact`
 * (no `value` on the unconfirmed arm) and `lib/book/editions.ts` (no field for
 * a "was"). Asking for a hardcover wrap today raises
 * `CoverWrapUnavailable`, whose message names the file to fetch and the four
 * numbers to read out of it. A plausible wrong file is the worst outcome
 * available here: it looks right on screen, and it is wrong on a hinge.
 *
 * **That is still true now that the captain has delivered hardcover wraps.**
 * The file is accepted, checked against the size it has to be, stored and
 * reported; what it cannot do is take a title, because where the title goes
 * depends on where the front panel starts and only the hardcover's own
 * template says. `lib/print/printify.ts` § `HARDCOVER_COVER_WRAP_DERIVED`
 * carries the arithmetic that was *not* used and why.
 *
 * ## The site never learns this module exists
 *
 * The wrap is downstream of the website rather than beside it: nothing in
 * `app/_book/` or `app/_shop/` imports this file, the picker and the preview
 * show the square cover, and a product with no measured template cannot make
 * any part of the shop fail. `test/cover-wrap.test.ts` reads the import graph
 * off disk and says so.
 *
 * **It is still the one renderer.** A wrap is a `PageTemplate` on a non-square
 * canvas, drawn by `lib/render/svg.ts` and rasterised by
 * `lib/render/raster.ts`, exactly as every page of the book is. There is no
 * compositor in this repository and this module did not become one — which is
 * why the supplied path is an image layer and two translated layers rather than
 * anything that touches a pixel.
 */

import type { AssetRef, Box, Colour, Layer, PageFill, PageTemplate, Pt } from "../template/types";
import {
  bleedPxOf,
  frontPanelPxOf,
  panelPxOf,
  pointsOf,
  spinePxOf,
  HARDCOVER_COVER_WRAP_DERIVED,
  SOFTCOVER_COVER_WRAP,
  type DerivedWrap,
  type MeasuredTemplate,
  type Px,
} from "../print/printify";
import { lookOf, pageFillFor, pageTemplateFor } from "./derive";
import type { BookFill, BookTemplate, CoverProductId } from "./types";

// ---------------------------------------------------------------------------
// The products
// ---------------------------------------------------------------------------

/**
 * The product ids themselves live in `./types.ts` and are re-exported here.
 *
 * They moved the day a `Look` started carrying one delivered wrap per product:
 * the format cannot name a type only the print path can see, and two lists of
 * two strings is two places for a third product to be forgotten.
 */
export { COVER_PRODUCT_IDS, isCoverProductId } from "./types";
export type { CoverProductId } from "./types";

/**
 * One product a wrap could be made for.
 *
 * A union, and the whole design is that **`template` exists on one arm only**.
 * There is no optional template, no `estimated` flag and no fallback to the
 * other product's numbers, so "we have not opened this file yet" is a state
 * the type system carries rather than a comment somebody has to honour.
 */
export type CoverProduct =
  | {
      id: CoverProductId;
      label: string;
      measured: true;
      template: MeasuredTemplate;
    }
  | {
      id: CoverProductId;
      label: string;
      measured: false;
      /** Printify's blueprint, so whoever fetches the template knows where to look. */
      blueprint: number;
      /** What has to be read, from which file, in whose words. */
      needs: string;
      /**
       * **The supplied size, counted off the captain's own exports.**
       *
       * The one thing that is known about an unmeasured product, and it is
       * enough for the one question intake asks: *is this file the right
       * size?* `lib/print/printify.ts` § `DerivedWrap` is why it is a
       * different type from a template and cannot be used as one — there is
       * nothing in it a title could be positioned against.
       */
      derived: DerivedWrap;
    };

/**
 * **The softcover is configured and the hardcover is not.**
 *
 * The softcover's numbers were read out of Printify's own PSD and are in
 * `lib/print/printify.ts` with the filename beside them. The hardcover's
 * template has not been opened, and its spine is the number that cannot be
 * guessed: a hardcover's board and hinge make it wider than a softcover's by
 * an amount that depends on the page count and the stock, so the only honest
 * value is the one in its own template.
 */
export const COVER_PRODUCTS: Record<CoverProductId, CoverProduct> = {
  softcover: {
    id: "softcover",
    label: "Softcover",
    measured: true,
    template: SOFTCOVER_COVER_WRAP,
  },
  hardcover: {
    id: "hardcover",
    label: "Hardcover",
    measured: false,
    blueprint: 2737,
    needs:
      "nobody has opened the hardcover's cover template. Somebody signed in to the Printify " +
      "account opens the Product Creator for blueprint 2737 (Hardcover Photo Book), 8 x 8 in, " +
      "downloads its cover template — the softcover's is " +
      "Template_Custom_SoftcoverBook_8x8_Cover.psd, so the hardcover's will be named to match — " +
      "and reads four numbers out of the file: the whole supplied area in pixels, the finished " +
      "size in pixels, the safety zone per panel in pixels, and the resolution. Those go into " +
      "lib/print/printify.ts as a MeasuredTemplate and this entry flips to the measured arm; " +
      "nothing else changes. A hardcover spine is WIDER than a softcover one, so the " +
      "softcover's numbers are not a starting point — a wrap built from them would put the " +
      "panels off the hinge and cut into the back cover, and it would look correct on screen. " +
      "The captain's delivered hardcover wraps are accepted, stored and reported meanwhile: " +
      "the bytes are right whatever anybody believes about the panel, and nothing has to be " +
      "re-delivered when the template is read. What waits is the title, which is the one " +
      "thing that cannot be placed without the measurement.",
    derived: HARDCOVER_COVER_WRAP_DERIVED,
  },
};

/**
 * **How big a supplied wrap for this product has to be.**
 *
 * The measured arm answers out of Printify's own template; the unmeasured one
 * answers out of the size somebody counted. This is the only question both arms
 * can answer, which is why it is a function and not a field — a `suppliedArea`
 * on the product would be a place to put an estimate for a product that has
 * neither.
 */
export function suppliedAreaOf(id: CoverProductId): Px {
  const product = COVER_PRODUCTS[id];
  return product.measured ? product.template.area : product.derived.area;
}

/** A wrap that was asked for and cannot honestly be made. */
export class CoverWrapUnavailable extends Error {
  constructor(readonly product: Extract<CoverProduct, { measured: false }>) {
    super(`no cover wrap for the ${product.label.toLowerCase()}: ${product.needs}`);
    this.name = "CoverWrapUnavailable";
  }
}

/**
 * The product, or a refusal. **The one door**, so no caller can reach a
 * template by any route that skips the check.
 */
export function measuredProduct(
  id: CoverProductId,
): Extract<CoverProduct, { measured: true }> {
  const product = COVER_PRODUCTS[id];
  if (!product.measured) throw new CoverWrapUnavailable(product);
  return product;
}

// ---------------------------------------------------------------------------
// The geometry
// ---------------------------------------------------------------------------

export type WrapSide = "back" | "front";

/**
 * A wrap's lengths, in the page units a `PageTemplate` is written in.
 *
 * Everything is derived from the template's four measured sizes. Nothing in
 * this interface knows which product it describes, which is what lets the
 * hardcover be a configuration rather than a second set of functions.
 */
export interface WrapGeometry {
  template: MeasuredTemplate;
  /** The print size, which is the supplied area in its own pixels. */
  pixels: Px;
  /**
   * **Page units per pixel of the template** — the one number the whole
   * geometry is scaled by, carried so that every function below works in
   * whatever unit the geometry was built in.
   *
   * It is `72 ÷ dpi` by default, which makes a point a point: that is the
   * composed-from-a-square wrap, whose artboard is the supplied area at the
   * template's own resolution. The **supplied** wrap uses a different unit on
   * purpose — see § `suppliedWrapGeometry`.
   */
  perPx: number;
  /** The artboard, in those units. */
  canvas: { width: Pt; height: Pt };
  /** How far inside every edge the cut runs. */
  bleed: Pt;
  /** One finished panel. */
  panel: { width: Pt; height: Pt };
  /** The bare strip between the panels. */
  spine: Pt;
}

/**
 * The wrap's lengths, from the template's four measured sizes.
 *
 * `perPx` is the unit and defaults to a real point. Everything below derives
 * from this object rather than from the template, so handing it a different
 * unit moves the whole wrap into that unit and no function has to be told.
 */
export function wrapGeometry(
  template: MeasuredTemplate,
  perPx: number = pointsOf(1, template.dpi),
): WrapGeometry {
  const pt = (px: number) => px * perPx;
  const panel = panelPxOf(template);
  return {
    template,
    pixels: template.area,
    perPx,
    canvas: { width: pt(template.area.width), height: pt(template.area.height) },
    bleed: pt(bleedPxOf(template)),
    panel: { width: pt(panel.width), height: pt(panel.height) },
    spine: pt(spinePxOf(template)),
  };
}

/**
 * The region one panel is **drawn** into: the finished panel plus the bleed on
 * the three edges it touches.
 *
 * The inner edge is the spine's, exactly — nothing bleeds across the spine,
 * because the spine is the fold and a picture folded round one is a picture
 * with a crease through it.
 */
export function panelRegion(g: WrapGeometry, side: WrapSide): Box {
  const outer = g.bleed + g.panel.width;
  return side === "back"
    ? { x: 0, y: 0, width: outer, height: g.canvas.height }
    : { x: outer + g.spine, y: 0, width: outer, height: g.canvas.height };
}

/** The strip between the panels, full height, bleed included above and below. */
export function spineRegion(g: WrapGeometry): Box {
  return { x: g.bleed + g.panel.width, y: 0, width: g.spine, height: g.canvas.height };
}

/** One panel as it is after the cut. */
export function panelTrim(g: WrapGeometry, side: WrapSide): Box {
  const x = side === "back" ? g.bleed : g.bleed + g.panel.width + g.spine;
  return { x, y: g.bleed, width: g.panel.width, height: g.panel.height };
}

/**
 * Printify's green box for one panel: the safety zone, **centred in the
 * panel**.
 *
 * Centred because that is what the measured numbers say and nothing more — the
 * template states a safety *size* per panel (7.40 × 7.50 in against a 7.75 in
 * panel), not two insets, so the honest reading of a size with no offset is
 * that it sits in the middle of the thing it is a size of. The vertical inset
 * then comes out equal to the bleed and the horizontal a little larger, which
 * is what a wrap-round cover wants: the edge nearest the spine is the one a
 * binding eats.
 */
export function panelSafe(g: WrapGeometry, side: WrapSide): Box {
  const trim = panelTrim(g, side);
  const safe = {
    width: g.template.safety.width * g.perPx,
    height: g.template.safety.height * g.perPx,
  };
  return {
    x: trim.x + (trim.width - safe.width) / 2,
    y: trim.y + (trim.height - safe.height) / 2,
    width: safe.width,
    height: safe.height,
  };
}

/**
 * **The box the display cover was cut out of**, in this geometry's units.
 *
 * `panelTrim` is the panel as the arithmetic says it is —
 * x = 2427.5 px on the softcover, which is not a column of pixels. This is the
 * whole-pixel window the cut was actually taken from
 * (`lib/print/printify.ts` § `frontPanelPxOf`), which is where the square has
 * to be put back for the title to land on the same artwork it landed on in the
 * preview. Half a pixel apart, and the half that matters is the one the ink is
 * measured against.
 */
export function frontPanelBox(g: WrapGeometry): Box {
  const cut = frontPanelPxOf(g.template);
  return {
    x: cut.x * g.perPx,
    y: cut.y * g.perPx,
    width: cut.width * g.perPx,
    height: cut.height * g.perPx,
  };
}

/**
 * `Canvas.safe` for a wrap: the **larger** of a panel safety zone's two insets.
 *
 * The format carries one scalar inside the trim and a wrap has a safety zone
 * *per panel* with a spine between, so the uniform value is the conservative
 * reading of the two — the same direction `docs/print.md` argues for bleed.
 * `panelSafe` is what anything asking a real question reads.
 */
export function uniformSafeOf(g: WrapGeometry): Pt {
  return Math.max(
    (g.panel.width - g.template.safety.width * g.perPx) / 2,
    (g.panel.height - g.template.safety.height * g.perPx) / 2,
  );
}

// ---------------------------------------------------------------------------
// The wash
// ---------------------------------------------------------------------------

/**
 * **The colour the back and the spine are painted.**
 *
 * The captain's decision is *"a plain wash, drawn from that look's own
 * palette"*, and a `Look` has no palette to read: it carries a placeholder
 * baby's three colours — which are a child's skin, hair and babygro and would
 * be a strange thing to paint a back cover with — a portrait tile, and nothing
 * else. So the wash is answered in the order a reader would expect:
 *
 * **`Look.wash` when the look declares one.** That is the field the captain's
 * sentence asks for, and it is where a per-look wash goes when the cover
 * squares are delivered with their own palettes.
 *
 * **Otherwise `BookTemplate.coverColour`**, the one colour the book states its
 * cover is, so the back of the book is the same colour as the front of it by
 * construction with nothing typed here. It is the drawn cover's own `ground`
 * as well — `templates/first-book.ts` § `COVER_COLOUR` reads it twice on
 * purpose — so this answer holds whether the cover is the placeholder or the
 * captain's delivered square, which is what the third branch here used to be
 * for. That branch was the colourway the buyer picked, and it went with the
 * chooser on 17 November.
 *
 * It is never a colour this module invents, which is the property worth
 * keeping: a back cover in a colour nobody declared is a printed object nobody
 * approved.
 */
export function wrapWash(book: BookTemplate, fill: BookFill): Colour {
  return lookOf(book, fill.lookId)?.wash ?? book.coverColour;
}

// ---------------------------------------------------------------------------
// The composition
// ---------------------------------------------------------------------------

/** The layer ids a wrap is made of. Named so a test can take one out. */
export const WRAP_LAYER = {
  back: "wrap-back",
  spine: "wrap-spine",
  front: "wrap-front",
} as const;

export function coverWrapTemplateId(book: BookTemplate, id: CoverProductId): string {
  return `${book.id}/cover-wrap-${id}`;
}

/**
 * The wrap, as a `PageTemplate` the one renderer already knows how to draw.
 *
 * `front` is an `AssetRef` for the square cover's **own render** — produced by
 * `lib/book/print.ts` § `renderCoverWrapPng`, which hashes those bytes and
 * hands them to the renderer through the `supplied` seam `lib/render/raster.ts`
 * already has. Taking a ref rather than bytes is what keeps this module pure
 * and testable: it composes, and something else rasterises.
 *
 * **The square is cover-fitted to the panel region, which is the one placement
 * decision here.** An `image` layer covers its frame — the renderer's existing
 * `preserveAspectRatio="xMidYMid slice"` — so a square front scaled to a
 * panel-plus-bleed region loses a little of its own bleed off the left and
 * right and nothing else. The consequence is worth stating because it is the
 * opposite of a risk: the square's trim lands *inside* the panel's trim rather
 * than outside it, so no part of the cover the buyer approved can fall off the
 * cut. What shows in the margin is the square's own full-bleed artwork, which
 * is what bleed is for. `test/cover-wrap.test.ts` measures where the title's
 * ink actually lands and asserts it is inside the panel's safety zone.
 */
export function coverWrapTemplate(
  book: BookTemplate,
  fill: BookFill,
  id: CoverProductId,
  front: AssetRef,
): PageTemplate {
  const product = measuredProduct(id);
  const g = wrapGeometry(product.template);
  const wash = wrapWash(book, fill);

  const layers: Layer[] = [
    {
      id: WRAP_LAYER.back,
      kind: "shape",
      frame: panelRegion(g, "back"),
      shape: { kind: "rect", fill: wash },
    },
    {
      /**
       * **The spine is bare.** No title, no name, no text at all — the
       * captain's decision, and there is nothing in this layer that could
       * carry any: it is a rectangle. It is its own layer rather than part of
       * the back's wash because its width is the one number that differs
       * between the two products, and because the day the captain wants a
       * hairline or a different wash on it, this is the line to change.
       */
      id: WRAP_LAYER.spine,
      kind: "shape",
      frame: spineRegion(g),
      shape: { kind: "rect", fill: wash },
    },
    {
      id: WRAP_LAYER.front,
      kind: "image",
      frame: panelRegion(g, "front"),
      asset: front,
    },
  ];

  return {
    schema: 1,
    id: coverWrapTemplateId(book, id),
    // The book's own revision, exactly as `./derive.ts` stamps a page: a wrap
    // is traceable to the book it was composed from, and `validateTemplate`
    // has a stamped revision to check.
    rev: book.rev,
    name: `${book.name} — ${product.label.toLowerCase()} cover wrap`,
    canvas: {
      unit: "pt",
      width: g.canvas.width,
      height: g.canvas.height,
      bleed: g.bleed,
      /**
       * **The uniform inset the format carries, and the wrap's real safety is
       * not uniform.**
       *
       * `Canvas.safe` is one scalar inside the trim, which cannot express a
       * safety zone *per panel* — and a wrap has two of them with the spine
       * between. So this declares the **larger** of the panel safety's two
       * insets, which is the conservative direction for the same reason
       * `docs/print.md` gives for over-declaring bleed, and `panelSafe` is
       * what anything asking a real question reads. Nothing is validated
       * against this value on a wrap, because a wrap carries no slots: there
       * is no customer content on it at all, only the square cover the buyer
       * already approved.
       */
      safe: uniformSafeOf(g),
      /**
       * The book's own page background, and **not** the wash.
       *
       * A wrap's three regions tile the artboard exactly, so this is never
       * seen — which is precisely why it must not be the wash. If a panel ever
       * failed to draw, a cream gap says *a piece is missing* and a wash-
       * coloured gap says *this is the design*. `templates/first-book.ts`
       * makes the same argument for the page: a missing picture must look like
       * one.
       */
      background: book.page.canvas.background,
    },
    print: {
      pixels: { width: g.pixels.width, height: g.pixels.height },
      colourSpace: "srgb",
      encoding: "png",
    },
    layers,
  };
}

/**
 * A fill with nothing in it, naming the wrap it belongs to.
 *
 * A wrap has no slots — the front panel is a finished image and the spine is
 * bare — so this is empty by construction rather than by stripping, and
 * `validateFill` sees a matching pair.
 */
export function coverWrapFill(book: BookTemplate, id: CoverProductId): PageFill {
  return {
    schema: 1,
    templateId: coverWrapTemplateId(book, id),
    templateRev: book.rev,
    photos: {},
    texts: {},
  };
}

// ---------------------------------------------------------------------------
// The wrap the captain delivered
// ---------------------------------------------------------------------------

/**
 * **The wrap this look was delivered for this product, if there is one.**
 *
 * The one door onto `Look.wraps`, so nothing reads that field directly and
 * "the captain has not delivered this one" is a single answer rather than an
 * optional chain repeated at four call sites.
 */
export function deliveredWrapOf(
  book: BookTemplate,
  lookId: string,
  id: CoverProductId,
): AssetRef | undefined {
  return lookOf(book, lookId)?.wraps?.[id];
}

/** The layer ids a wrap composed from a delivered file is made of. */
export const SUPPLIED_WRAP_LAYER = {
  /** The captain's whole wordless wrap: back cover, spine and front, one image. */
  art: "wrap-supplied",
} as const;

/**
 * **The geometry of a supplied wrap, in the cover page's own units.**
 *
 * One number is different from `wrapGeometry`'s default and it is the whole
 * of the design here: `perPx` is chosen so that the **finished front panel is
 * exactly `book.page.canvas.width` across**. In that unit the cover page's
 * layers can be dropped onto the wrap by **translation alone** — no scaling of
 * a frame, no scaling of a type size, no scaling of a baseline or a line
 * height or a shadow.
 *
 * That is what "the title is drawn from one slot" means mechanically. The
 * alternative was to scale every length on every layer into the wrap's own
 * points, which is a second arithmetic for the one thing on a printed cover
 * that has to agree with what the buyer approved — and the first field somebody
 * forgot to scale would be a title printed at the wrong size on a finished
 * object.
 *
 * The identity it rests on: the display cover **is** this panel, cut out of
 * this file, drawn edge to edge across the cover page's artboard. So
 * `612 pt ≡ 2325 px ≡ the finished panel`, in the preview and on the press,
 * and the title occupies the same fraction of the same square in both.
 *
 * The book's artboard over-declares its own bleed by 6.25%
 * (`docs/print.md` § The page the book declares is not the page Printify
 * prints), and that over-declaration lands *inside* the real trim here, which
 * is the safe direction: the title ends up further from the cut than the page
 * says it is, never nearer.
 */
export function suppliedWrapGeometry(
  book: BookTemplate,
  template: MeasuredTemplate,
): WrapGeometry {
  return wrapGeometry(template, book.page.canvas.width / frontPanelPxOf(template).width);
}

/**
 * **The wrap as the captain's own file with the title drawn on its front
 * panel.**
 *
 * Two layers and no composition: the delivered wrap across the whole artboard,
 * and then **the cover page's own layers above its artwork**, translated onto
 * the front panel. Those come out of `pageTemplateFor` — the one derivation —
 * with the reserved `"art"` layer dropped, because the artwork on a supplied
 * wrap is the supplied wrap. Everything else about them is whatever the cover
 * page says today.
 *
 * So there is no second title, no second type size and no second box. Change
 * `templates/first-book.ts` § `cover-title` and both the display cover and the
 * press file move together, which is the property this exists for.
 *
 * **The back and the spine are the captain's.** There is no wash layer at all
 * on this path: `Look.wash` exists for the composed wrap, where the back cover
 * has to be invented, and inventing one over a delivered back cover would
 * paint out artwork somebody drew.
 */
export function suppliedCoverWrapTemplate(
  book: BookTemplate,
  fill: BookFill,
  id: CoverProductId,
  wrap: AssetRef,
): PageTemplate {
  const product = measuredProduct(id);
  const g = suppliedWrapGeometry(book, product.template);
  const front = frontPanelBox(g);

  // The cover page's furniture, exactly as the preview draws it, moved onto the
  // panel. `artLayer`'s id is reserved by `./validate.ts` precisely so that it
  // can be identified here rather than guessed at by position.
  const furniture = pageTemplateFor(book, 0, { lookId: fill.lookId })
    .layers.filter((layer) => layer.id !== "art")
    .map((layer): Layer => ({
      ...layer,
      frame: { ...layer.frame, x: layer.frame.x + front.x, y: layer.frame.y + front.y },
    }));

  return {
    schema: 1,
    id: coverWrapTemplateId(book, id),
    rev: book.rev,
    name: `${book.name} — ${product.label.toLowerCase()} cover wrap`,
    canvas: {
      unit: "pt",
      width: g.canvas.width,
      height: g.canvas.height,
      bleed: g.bleed,
      safe: uniformSafeOf(g),
      // Cream and never the wash, for `coverWrapTemplate`'s reason: a gap has
      // to look like a missing piece and not like the design.
      background: book.page.canvas.background,
    },
    print: {
      pixels: { width: g.pixels.width, height: g.pixels.height },
      colourSpace: "srgb",
      encoding: "png",
    },
    layers: [
      {
        id: SUPPLIED_WRAP_LAYER.art,
        kind: "image",
        frame: { x: 0, y: 0, width: g.canvas.width, height: g.canvas.height },
        asset: wrap,
      },
      ...furniture,
    ],
  };
}

/**
 * The fill for a supplied wrap: **the cover page's own fill**, renamed.
 *
 * A composed wrap has no slots and `coverWrapFill` is therefore empty. This one
 * carries the title, so its fill is the buyer's — and it is the cover page's
 * fill rather than a fresh one for the same reason the layers are the cover
 * page's: `pageFillFor` is where `{name}` becomes a name, and a second
 * substitution here would be a second answer to what the front of the book
 * says.
 */
export function suppliedCoverWrapFill(
  book: BookTemplate,
  fill: BookFill,
  id: CoverProductId,
): PageFill {
  return {
    ...pageFillFor(book, 0, fill),
    templateId: coverWrapTemplateId(book, id),
    templateRev: book.rev,
  };
}
