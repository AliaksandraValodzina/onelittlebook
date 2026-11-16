/**
 * **The printable cover: back, spine and front, composed from one square.**
 *
 * The shop draws a square front — `book.cover`, the page the picker, the
 * preview and the basket all show. Printify wants something else entirely: one
 * wide image carrying the **back cover, the spine and the front** in a single
 * piece, because a softcover is printed flat and wrapped round the block. This
 * module is the join, and it adds nothing to the book: a wrap is the square
 * cover on the right, a wash of the look's own colour on the left, and the
 * spine between them.
 *
 * ## The captain's decision, 15 November 2026, and why it is this shape
 *
 * Asked whether to generate three files per look — a softcover wrap, a
 * hardcover wrap and a square — they chose **one square per look**, with a
 * plain wash for the back, a **bare spine** carrying no title and no name, and
 * the shop composing the wrap.
 *
 * The reason is the constraint that decides everything here: **the hardcover's
 * spine is wider than the softcover's.** A hardcover wrap therefore cannot be
 * made by stretching a softcover one — the panels would land off the hinge and
 * the back cover would be cut into — so a wrap has to be composed from panels
 * at each product's own dimensions. Composing also makes a spine-width change
 * a number in `lib/print/printify.ts` rather than thirteen regenerated images,
 * which is the difference between a correction and a re-delivery.
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
 * ## The square is untouched, and the site never learns this module exists
 *
 * The front panel is **the square cover's own render**, placed as an image
 * layer and cover-fitted to the panel. So the wrap is downstream of the
 * website rather than beside it: nothing in `app/_book/` or `app/_shop/`
 * imports this file, the picker and the preview keep showing the square, and a
 * product with no measured template cannot make any part of the shop fail.
 * `test/cover-wrap.test.ts` reads the import graph off disk and says so.
 *
 * **It is still the one renderer.** A wrap is a `PageTemplate` — three layers
 * on a non-square canvas — drawn by `lib/render/svg.ts` and rasterised by
 * `lib/render/raster.ts`, exactly as every page of the book is. There is no
 * compositor in this repository and this module did not become one.
 */

import type { AssetRef, Box, Colour, Layer, PageFill, PageTemplate, Pt } from "../template/types";
import {
  bleedPxOf,
  panelPxOf,
  pointsOf,
  spinePxOf,
  SOFTCOVER_COVER_WRAP,
  type MeasuredTemplate,
  type Px,
} from "../print/printify";
import { coverOf, lookOf } from "./derive";
import type { BookFill, BookTemplate } from "./types";

// ---------------------------------------------------------------------------
// The products
// ---------------------------------------------------------------------------

export type CoverProductId = "softcover" | "hardcover";

export const COVER_PRODUCT_IDS: readonly CoverProductId[] = ["softcover", "hardcover"];

export function isCoverProductId(value: unknown): value is CoverProductId {
  return typeof value === "string" && (COVER_PRODUCT_IDS as readonly string[]).includes(value);
}

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
      "panels off the hinge and cut into the back cover, and it would look correct on screen.",
  },
};

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
  /** The artboard, in points. */
  canvas: { width: Pt; height: Pt };
  /** How far inside every edge the cut runs. */
  bleed: Pt;
  /** One finished panel. */
  panel: { width: Pt; height: Pt };
  /** The bare strip between the panels. */
  spine: Pt;
}

export function wrapGeometry(template: MeasuredTemplate): WrapGeometry {
  const pt = (px: number) => pointsOf(px, template.dpi);
  const panel = panelPxOf(template);
  return {
    template,
    pixels: template.area,
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
    width: pointsOf(g.template.safety.width, g.template.dpi),
    height: pointsOf(g.template.safety.height, g.template.dpi),
  };
  return {
    x: trim.x + (trim.width - safe.width) / 2,
    y: trim.y + (trim.height - safe.height) / 2,
    width: safe.width,
    height: safe.height,
  };
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
 * **Otherwise the cover's own ground**, which for this book is the colourway
 * the buyer picked — `SceneSpec.groundFromCover` on the cover page — so the
 * back of the book is the same colour as the front of it by construction, in
 * every one of the three colourways, with nothing typed here.
 *
 * **Otherwise the chosen colourway**, which is the state a delivered cover
 * image is in: there is no scene to read a ground off, and the one colour the
 * book states for this buyer's cover is the one they chose.
 *
 * It is never a colour this module invents, which is the property worth
 * keeping: a back cover in a colour nobody picked is a printed object nobody
 * approved.
 */
export function wrapWash(book: BookTemplate, fill: BookFill): Colour {
  const look = lookOf(book, fill.lookId);
  if (look?.wash) return look.wash;
  const scene = book.cover.art.kind === "drawn" ? book.cover.art.scene : null;
  if (!scene || scene.groundFromCover) return coverOf(book, fill.coverId).colour;
  return scene.ground;
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
      safe: Math.max(
        (g.panel.width - pointsOf(product.template.safety.width, product.template.dpi)) / 2,
        (g.panel.height - pointsOf(product.template.safety.height, product.template.dpi)) / 2,
      ),
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
