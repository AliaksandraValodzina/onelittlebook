/**
 * **The cover arrives as two wraps, and the square is cut out of one of them.**
 *
 * The captain uploads spreads to Printify directly, so what they produce per
 * look is two finished wordless wraps — softcover and hardcover — and not a
 * square. Four things are established here, in the order of what they cost to
 * get wrong:
 *
 * **The cut is the front panel and nothing else.** Measured against a synthetic
 * wrap whose panel, spine and bleed are three different colours, so "the window
 * is in the right place" is a statement about pixels rather than about
 * arithmetic. The paired negative is the same cut taken one pixel to the left,
 * which picks up the spine — which is the whole reason the rounding goes the way
 * it does.
 *
 * **The display cover is cut and never supplied, so it cannot disagree with the
 * press.** The same bytes, from the same file, everywhere it is shown.
 *
 * **The title is drawn from one slot.** The box its ink lands in is measured on
 * the display cover *and* on the print wrap, as a difference between two
 * renders, and the two are the same box relative to the panel. That is the
 * assertion the whole design exists to make true: there is no second type size
 * and no second frame.
 *
 * **The hardcover refuses, loudly, with its wrap in hand.** The file is
 * accepted, checked and stored; nothing is cut from it and no title is printed
 * on it, because where its front panel starts is arithmetic nobody has checked
 * against a template.
 */

import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import {
  COVER_PRODUCTS,
  CoverWrapUnavailable,
  SUPPLIED_WRAP_LAYER,
  deliveredWrapOf,
  frontPanelBox,
  measuredProduct,
  panelSafe,
  panelTrim,
  spineRegion,
  suppliedAreaOf,
  suppliedCoverWrapFill,
  suppliedCoverWrapTemplate,
  suppliedWrapGeometry,
  wrapGeometry,
  wrapWash,
} from "../lib/book/cover-wrap";
import {
  HARDCOVER_COVER_WRAP_DERIVED,
  SOFTCOVER_COVER_WRAP,
  bleedPxOf,
  frontPanelPxOf,
  inchesOf,
  panelPxOf,
  spinePxOf,
} from "../lib/print/printify";
import {
  checkCoverWraps,
  coverFileKindOf,
  coverWrapAgainstContract,
  coverWrapFileName,
  coverWrapFileNames,
} from "../lib/book/cover-upload";
import { cutOut, NotAWrap } from "../lib/artwork/import";
import { prepareCoverWraps } from "../lib/artwork/prepare";
import { coverProductOfPageId, coverSet, coverWrapPageId } from "../lib/artwork/release";
import { isReleaseSet } from "../lib/artwork/keys";
import { bookWithReleaseArtwork } from "../lib/book/release-art";
import { bookWithOrderArtwork } from "../lib/book/order-art";
import type { ArtworkVersion } from "../lib/artwork/store";
import { emptyReleaseArtwork } from "../lib/artwork/release";
import { pageFillFor, pageTemplateFor } from "../lib/book/derive";
import { validateBook } from "../lib/book/validate";
import { validateTemplate } from "../lib/template/validate";
import { contains } from "../lib/template/geometry";
import { renderPrintPng, type SuppliedBytes } from "../lib/render/raster";
import { sha256 } from "../lib/assets/digest";
import { hasAlphaChannel, readPngHeader } from "../lib/render/png";
import { AlphaUnreadable, readAlphaChannel } from "../lib/render/png-alpha";
import { COVER_PRODUCT_IDS, type CoverProductId } from "../lib/book/types";
import { SLOT } from "../lib/book/slots";
import { changedBox, hexAt, isColour, raster } from "./pixels";
import type { AssetRef, Box, PageTemplate } from "../lib/template/types";
import type { BookTemplate } from "../lib/book/types";

const SOFT = measuredProduct("softcover").template;
const FILL = FIXTURE_BOOK_FILL;
const LOOK = FILL.lookId;

// ---------------------------------------------------------------------------
// A wrap built so that the cut can be seen
// ---------------------------------------------------------------------------

/** The back cover and the bleed. */
const BACK = { r: 0x22, g: 0x66, b: 0xaa, hex: "#2266aa" };
/** The spine — the fold, and the one colour that must not reach the front. */
const SPINE = { r: 0xee, g: 0x22, b: 0x22, hex: "#ee2222" };
/** The front panel, which is what a cut has to come back holding. */
const FRONT = { r: 0x33, g: 0xbb, b: 0x55, hex: "#33bb55" };

/**
 * A wrap at a product's supplied size, painted in three regions.
 *
 * The regions are derived from the template rather than typed: the front panel
 * is exactly the box `frontPanelPxOf` says the cut is taken from, the spine
 * column is painted **right up to and including** the pixel the panel's true
 * trim runs through — floor(2427.5) = 2427 — and everything else is the back.
 * So a cut one pixel to the left picks up the fold, which is what makes the
 * rounding assertion below a real one.
 */
function syntheticWrap(product: CoverProductId): Uint8Array {
  const area = suppliedAreaOf(product);
  const png = new PNG({ width: area.width, height: area.height });
  const cut = COVER_PRODUCTS[product].measured
    ? frontPanelPxOf(COVER_PRODUCTS[product].template)
    : null;
  const spineFrom = cut ? Math.floor(bleedPxOf(SOFT) + panelPxOf(SOFT).width) : 0;

  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const at = (y * area.width + x) * 4;
      let c = BACK;
      if (cut && x >= spineFrom && x < cut.x) c = SPINE;
      if (
        cut &&
        x >= cut.x &&
        x < cut.x + cut.width &&
        y >= cut.y &&
        y < cut.y + cut.height
      ) {
        c = FRONT;
      }
      png.data[at] = c.r;
      png.data[at + 1] = c.g;
      png.data[at + 2] = c.b;
      png.data[at + 3] = 255;
    }
  }
  return new Uint8Array(PNG.sync.write(png, { colorType: 2, inputHasAlpha: true, bitDepth: 8 }));
}

/** Every colour in a region of a decoded PNG, as `#rrggbb`. */
function coloursIn(bytes: Uint8Array, box: { x: number; y: number; width: number; height: number }) {
  const png = PNG.sync.read(Buffer.from(bytes));
  const seen = new Set<string>();
  for (let y = box.y; y < box.y + box.height; y++) {
    for (let x = box.x; x < box.x + box.width; x++) {
      const at = (y * png.width + x) * 4;
      seen.add(
        "#" + [0, 1, 2].map((c) => png.data[at + c].toString(16).padStart(2, "0")).join(""),
      );
    }
  }
  return seen;
}

const WRAPS = {
  softcover: syntheticWrap("softcover"),
  hardcover: syntheticWrap("hardcover"),
};

function fileFor(product: CoverProductId) {
  return { name: coverWrapFileName(product), bytes: WRAPS[product] };
}

// ---------------------------------------------------------------------------
// The geometry of the cut
// ---------------------------------------------------------------------------

describe("the front panel, as a window of whole pixels", () => {
  const cut = frontPanelPxOf(SOFT);

  it("is the finished panel's own size, exactly", () => {
    expect(cut.width).toBe(panelPxOf(SOFT).width);
    expect(cut.height).toBe(panelPxOf(SOFT).height);
    // 2325 px, which is both what Printify's template says the finished panel
    // is and what the captain's own separate square export came out at — the
    // arithmetic confirmed from two directions.
    expect(inchesOf(cut.width, SOFT.dpi)).toBeCloseTo(7.75, 6);
  });

  it("is inside the supplied area and clear of the spine", () => {
    expect(cut.x).toBeGreaterThanOrEqual(bleedPxOf(SOFT) + panelPxOf(SOFT).width + spinePxOf(SOFT));
    expect(cut.x + cut.width).toBeLessThanOrEqual(SOFT.area.width);
    expect(cut.y + cut.height).toBeLessThanOrEqual(SOFT.area.height);
  });

  it("rounds away from the spine, because the trim is half a pixel out", () => {
    // The bleed is 37.5 px, so the panel's true edge is at x = 2427.5 and no
    // window of whole pixels is exactly it. The origin is rounded **up**: the
    // half pixel that is given up is panel at the inner edge, and the half
    // pixel taken instead is bleed at the outer one. Rounding the other way
    // would put a sliver of the fold on the front of the book.
    const exact = bleedPxOf(SOFT) + panelPxOf(SOFT).width + spinePxOf(SOFT);
    expect(Number.isInteger(exact)).toBe(false);
    expect(cut.x).toBe(Math.ceil(exact));
    expect(cut.x).toBeGreaterThan(exact);
  });

  it("would be a different window for a different template", () => {
    // The control: everything above is arithmetic on the measurement, so a
    // product with a wider spine cuts further right.
    const wider = {
      ...SOFT,
      area: { width: SOFT.area.width + 100, height: SOFT.area.height },
      finished: { width: SOFT.finished.width + 100, height: SOFT.finished.height },
    };
    expect(spinePxOf(wider)).toBe(spinePxOf(SOFT) + 100);
    expect(frontPanelPxOf(wider).x).toBe(cut.x + 100);
  });
});

describe("the cut itself, in pixels", () => {
  const cut = frontPanelPxOf(SOFT);
  const square = cutOut(WRAPS.softcover, SOFT.area, cut);

  it("is the panel's size and carries only the panel's own pixels", () => {
    expect(readPngHeader(square)).toMatchObject({ width: cut.width, height: cut.height });
    expect([...coloursIn(square, { x: 0, y: 0, width: cut.width, height: cut.height })]).toEqual([
      FRONT.hex,
    ]);
  });

  it("would pick up the fold if it were taken one pixel further left", () => {
    // The paired negative, and the reason `frontPanelPxOf` rounds up. The
    // synthetic wrap paints the fold right up to the pixel the true trim runs
    // through, so a window half a pixel wider on the spine side finds it.
    const left = cutOut(WRAPS.softcover, SOFT.area, { ...cut, x: cut.x - 1 });
    expect(coloursIn(left, { x: 0, y: 0, width: 1, height: cut.height })).toEqual(
      new Set([SPINE.hex]),
    );
  });

  it("refuses bytes that are not the size the cut was derived for", () => {
    // The function that would produce the wrong file checks the size itself
    // rather than trusting that intake did. A wrap at the template's finished
    // size would otherwise cut a window out of the back of the book.
    expect(() => cutOut(WRAPS.hardcover, SOFT.area, cut)).toThrow(NotAWrap);
    expect(() =>
      cutOut(WRAPS.softcover, SOFT.area, { ...cut, x: SOFT.area.width - 1 }),
    ).toThrow(NotAWrap);
  });

  it("is a pure function of the bytes, so every copy of it is the same copy", () => {
    // "Byte-identical wherever it is shown" is this, plus the fact that the cut
    // happens once at intake and the result is what is stored.
    expect(sha256(cutOut(WRAPS.softcover, SOFT.area, cut))).toBe(sha256(square));
  });
});

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

describe("the two wraps coming in", () => {
  it("recognises the names it wants, and the ones that are nearly right", () => {
    for (const product of COVER_PRODUCT_IDS) {
      expect(coverFileKindOf(coverWrapFileName(product))).toEqual({ kind: "wrap", product });
      // A token anywhere in the stem, which is `pageForArtworkName`'s rule.
      expect(coverFileKindOf(`${product}.png`)).toEqual({ kind: "wrap", product });
      expect(coverFileKindOf(`girl-01-cover-wrap-${product}.png`)).toEqual({
        kind: "wrap",
        product,
      });
    }
    expect(coverFileKindOf("cover.png")).toEqual({ kind: "productUnnamed" });
    expect(coverFileKindOf("spine.png")).toEqual({ kind: "piece", piece: "spine" });
    expect(coverFileKindOf("cover-back.png")).toEqual({ kind: "piece", piece: "back" });
    // And an interior page is not this module's business at all, which is what
    // lets one partition serve both preparations.
    expect(coverFileKindOf("page-012.png")).toBeNull();
    expect(coverFileKindOf("spread-03-right.png")).toBeNull();
  });

  it("accepts both wraps at their own supplied sizes", () => {
    const check = checkCoverWraps([fileFor("softcover"), fileFor("hardcover")], LOOK);
    expect(check.problems).toEqual([]);
    expect(check.wraps.map((w) => w.product)).toEqual([...COVER_PRODUCT_IDS]);
    // The two sizes are different, which is the fact that makes one wrap
    // unusable as the other and is why they are two files.
    expect(suppliedAreaOf("softcover")).not.toEqual(suppliedAreaOf("hardcover"));
  });

  it("refuses a wrong size and names the number given and the number wanted", () => {
    const check = checkCoverWraps(
      [{ name: coverWrapFileName("softcover"), bytes: WRAPS.hardcover }],
      LOOK,
    );
    const said = check.problems.find((p) => p.code === "cover.wrongSize");
    const got = suppliedAreaOf("hardcover");
    const want = suppliedAreaOf("softcover");
    expect(said?.detail).toContain(`${got.width} × ${got.height}`);
    expect(said?.detail).toContain(`${want.width} × ${want.height}`);
    expect(said?.where).toBe(`${LOOK}/${coverWrapFileName("softcover")}`);
  });

  it("names the two files it wants, out of the product ids", () => {
    expect(coverWrapFileNames()).toEqual(COVER_PRODUCT_IDS.map(coverWrapFileName));
    expect(coverWrapFileNames()).toHaveLength(COVER_PRODUCT_IDS.length);
  });
});

describe("what one look's folder of covers becomes", () => {
  const prepared = prepareCoverWraps(FIRST_BOOK, LOOK, [fileFor("softcover"), fileFor("hardcover")]);

  it("stores both wraps as delivered and cuts the display cover from one", () => {
    expect(prepared.problems).toEqual([]);
    expect(prepared.missing).toEqual([]);

    const ids = prepared.pages.map((p) => p.pageId);
    expect(ids).toContain(coverWrapPageId("softcover"));
    expect(ids).toContain(coverWrapPageId("hardcover"));
    // The display cover goes in under the book's own cover page id, which is
    // what lets it bind through the page machinery and the shop learn nothing.
    expect(ids).toContain(FIRST_BOOK.cover.id);
    expect(ids).toHaveLength(COVER_PRODUCT_IDS.length + 1);

    for (const product of COVER_PRODUCT_IDS) {
      const stored = prepared.pages.find((p) => p.pageId === coverWrapPageId(product))!;
      // Byte for byte: these are what goes to the press.
      expect(Buffer.from(stored.bytes)).toEqual(Buffer.from(WRAPS[product]));
    }
  });

  it("cuts from the softcover and never from the hardcover", () => {
    const cover = prepared.pages.find((p) => p.pageId === FIRST_BOOK.cover.id)!;
    expect(cover.from).toBe(coverWrapFileName("softcover"));
    const cut = frontPanelPxOf(SOFT);
    expect(readPngHeader(cover.bytes)).toMatchObject({ width: cut.width, height: cut.height });
    expect(cover.did).toContain(`${cut.x},${cut.y}`);

    // Only the softcover wrap, and the hardcover says why in a line somebody
    // reads rather than in silence.
    const hardcoverOnly = prepareCoverWraps(FIRST_BOOK, LOOK, [fileFor("hardcover")]);
    expect(hardcoverOnly.problems).toEqual([]);
    expect(hardcoverOnly.pages.map((p) => p.pageId)).toEqual([coverWrapPageId("hardcover")]);
    expect(hardcoverOnly.missing).toEqual(["softcover"]);
    // Both reasons: the decision, and why it could not have gone the other way.
    expect(hardcoverOnly.skipped.join(" ")).toContain("the display cover is the softcover");
    expect(hardcoverOnly.skipped.join(" ")).toContain("nobody has measured the hardcover");
    expect(hardcoverOnly.compare).toBeNull();
  });

  it("writes nothing at all when a wrap is the wrong size", () => {
    const bad = prepareCoverWraps(FIRST_BOOK, LOOK, [
      { name: coverWrapFileName("softcover"), bytes: WRAPS.hardcover },
    ]);
    expect(bad.problems.map((p) => p.code)).toContain("cover.wrongSize");
    // No cut from a refused wrap: the cover page id is not among the pages, so
    // a caller that ignored `problems` still could not store a wrong cover.
    expect(bad.pages.map((p) => p.pageId)).not.toContain(FIRST_BOOK.cover.id);
  });

  it("is keyed under a set of its own, which the key check allows", () => {
    expect(coverSet(LOOK)).not.toBe(`look-${LOOK}`);
    expect(isReleaseSet(coverSet(LOOK))).toBe(true);
    for (const product of COVER_PRODUCT_IDS) {
      expect(coverProductOfPageId(coverWrapPageId(product))).toBe(product);
    }
    // The display cover is not a wrap, which is how one read sorts the set into
    // two different places.
    expect(coverProductOfPageId(FIRST_BOOK.cover.id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The book, bound to what was prepared
// ---------------------------------------------------------------------------

/** The refs and the bytes the renderer needs, out of one prepared folder. */
function delivered() {
  const prepared = prepareCoverWraps(FIRST_BOOK, LOOK, [
    fileFor("softcover"),
    fileFor("hardcover"),
  ]);
  const supplied: SuppliedBytes = new Map();
  const ref = (pageId: string): AssetRef => {
    const page = prepared.pages.find((p) => p.pageId === pageId)!;
    const header = readPngHeader(page.bytes);
    const digest = sha256(page.bytes);
    supplied.set(digest, page.bytes);
    return {
      sha256: digest,
      mime: "image/png",
      px: [header.width, header.height],
    };
  };

  const art = emptyReleaseArtwork("a synthetic delivery");
  art.pages[LOOK] = { [FIRST_BOOK.cover.id]: ref(FIRST_BOOK.cover.id) };
  art.wraps[LOOK] = {
    softcover: ref(coverWrapPageId("softcover")),
    hardcover: ref(coverWrapPageId("hardcover")),
  };
  return { book: bookWithReleaseArtwork(FIRST_BOOK, art), supplied };
}

const DELIVERED = delivered();

describe("the look with its cover delivered", () => {
  it("carries one wrap per product and a cover the shop can draw", () => {
    for (const product of COVER_PRODUCT_IDS) {
      expect(deliveredWrapOf(DELIVERED.book, LOOK, product)).toBeTruthy();
    }
    // Every other look is untouched, which is what makes a partial delivery an
    // ordinary state rather than a release.
    const other = FIRST_BOOK.looks.find((l) => l.id !== LOOK)!;
    expect(deliveredWrapOf(DELIVERED.book, other.id, "softcover")).toBeUndefined();

    const cover = DELIVERED.book.cover;
    expect(cover.art.kind).toBe("asset");
    expect(cover.art.kind === "asset" && cover.art.byLook[LOOK]).toBeTruthy();
  });

  it("is a book the validator accepts, with a cover smaller than a page", () => {
    // The cover is 2325 px and every interior page is 3600. The page rule is
    // still an equality and the cover's is a floor, because the cover is cut
    // from Printify's cover template and not from this book's own declaration.
    expect(validateBook(DELIVERED.book)).toEqual([]);
    const [w] = (DELIVERED.book.cover.art.kind === "asset" &&
      DELIVERED.book.cover.art.byLook[LOOK].px) || [0];
    expect(w).toBe(frontPanelPxOf(SOFT).width);
    expect(w).toBeLessThan(FIRST_BOOK.page.print.pixels.width);
  });

  it("refuses a cover smaller than the panel it is printed on", () => {
    // The paired negative for the floor. A cover of 800 px would render and
    // look plausible on a screen, and print soft.
    const small: BookTemplate = {
      ...DELIVERED.book,
      cover: {
        ...DELIVERED.book.cover,
        art: {
          kind: "asset",
          byLook: { [LOOK]: { sha256: "a".repeat(64), mime: "image/png", px: [800, 800] } },
          scene: DELIVERED.book.cover.art.scene,
        },
      },
    };
    expect(validateBook(small).map((p) => p.code)).toContain("art.coverTooSmall");
  });

  it("refuses a square filed under a wrap's name", () => {
    const squared: BookTemplate = {
      ...DELIVERED.book,
      looks: DELIVERED.book.looks.map((l) =>
        l.id === LOOK
          ? {
              ...l,
              wraps: {
                softcover: { sha256: "b".repeat(64), mime: "image/png" as const, px: [2325, 2325] },
              },
            }
          : l,
      ),
    };
    expect(validateBook(squared).map((p) => p.code)).toContain("cover.wrapNotAWrap");
  });
});

// ---------------------------------------------------------------------------
// One slot, two files
// ---------------------------------------------------------------------------

const G = suppliedWrapGeometry(FIRST_BOOK, SOFT);

/** Pixels per page unit for the two renders below. Small enough to afford four. */
const SCALE = 1.5;

/**
 * The cover page and the wrap at the same pixels-per-point, so ink is
 * comparable.
 *
 * The height is derived from the width the rasteriser was given rather than
 * from the canvas, because that is how `rasterise` derives it — and
 * `renderPrintPng` measures the bytes and refuses a file that is a pixel off,
 * which is the check this would otherwise trip over on a non-square artboard.
 */
function atScale(template: PageTemplate): PageTemplate {
  const width = Math.round(template.canvas.width * SCALE);
  return {
    ...template,
    print: {
      ...template.print,
      pixels: {
        width,
        height: Math.round((width * template.canvas.height) / template.canvas.width),
      },
    },
  };
}

/** The template with the cover's title taken off. */
function withoutTheTitle(template: PageTemplate): PageTemplate {
  return {
    ...template,
    layers: template.layers.filter((l) => !("slot" in l && l.slot === SLOT.story)),
  };
}

async function inkOf(template: PageTemplate, fill: Parameters<typeof renderPrintPng>[1]) {
  const [titled, bare] = await Promise.all([
    renderPrintPng(atScale(template), fill, DELIVERED.supplied),
    renderPrintPng(atScale(withoutTheTitle(template)), fill, DELIVERED.supplied),
  ]);
  const scaled = atScale(template);
  return {
    ink: changedBox(raster(titled.png, scaled), raster(bare.png, scaled)),
    sheet: raster(titled.png, scaled),
  };
}

describe("the title, drawn from one slot onto two different files", () => {
  const display = pageTemplateFor(DELIVERED.book, 0, { lookId: FILL.lookId });
  const wrap = suppliedCoverWrapTemplate(DELIVERED.book, FILL, "softcover", {
    ...deliveredWrapOf(DELIVERED.book, LOOK, "softcover")!,
  });

  it("is the wrap's only addition to the captain's file", () => {
    expect(validateTemplate(wrap)).toEqual([]);
    expect(wrap.print.pixels).toEqual(SOFT.area);
    // The supplied file, and then the cover page's own layers above its
    // artwork. No wash, no spine rectangle: the back cover and the fold are
    // the captain's.
    expect(wrap.layers[0].id).toBe(SUPPLIED_WRAP_LAYER.art);
    expect(wrap.layers.map((l) => l.id).slice(1)).toEqual(
      display.layers.map((l) => l.id).filter((id) => id !== "art"),
    );
    expect(wrap.layers.some((l) => l.kind === "textSlot")).toBe(true);
    // And the fill is the cover page's, so `{name}` is substituted once.
    expect(suppliedCoverWrapFill(DELIVERED.book, FILL, "softcover").texts).toEqual(
      pageFillFor(DELIVERED.book, 0, FILL).texts,
    );
  });

  it("needs no scaling, because the panel is the cover page's own artboard", () => {
    // The whole reason the wrap is expressed in this unit. Every length on
    // every layer is the number the preview drew — frame, type size, baseline,
    // line height, shadow — and the only difference is where the box is.
    const front = frontPanelBox(G);
    expect(front.width).toBeCloseTo(FIRST_BOOK.page.canvas.width, 9);
    expect(front.height).toBeCloseTo(FIRST_BOOK.page.canvas.height, 9);
    for (const layer of display.layers.filter((l) => l.id !== "art")) {
      const moved = wrap.layers.find((l) => l.id === layer.id)!;
      expect(moved.frame.width).toBe(layer.frame.width);
      expect(moved.frame.height).toBe(layer.frame.height);
      expect(moved.frame.x - layer.frame.x).toBeCloseTo(front.x, 9);
      expect(moved.frame.y - layer.frame.y).toBeCloseTo(front.y, 9);
      if (moved.kind === "textSlot" && layer.kind === "textSlot") {
        expect(moved.size).toBe(layer.size);
        expect(moved.baseline).toBe(layer.baseline);
        expect(moved.lineHeight).toBe(layer.lineHeight);
      }
    }
  });

  it(
    "lands in the same place on the display cover and on the press file",
    { timeout: 180_000 },
    async () => {
      const [onScreen, onPress] = await Promise.all([
        inkOf(display, pageFillFor(DELIVERED.book, 0, FILL)),
        inkOf(wrap, suppliedCoverWrapFill(DELIVERED.book, FILL, "softcover")),
      ]);

      // The control is built in: a title that drew nothing differs nowhere and
      // `changedBox` returns null, which no assertion below can be satisfied by.
      expect(onScreen.ink).not.toBeNull();
      expect(onPress.ink).not.toBeNull();

      const screen = onScreen.ink as Box;
      const press = onPress.ink as Box;
      const front = frontPanelBox(G);
      /**
       * **The assertion the whole design exists to make true.**
       *
       * Both boxes come back in their own template's page units, and the wrap's
       * unit is chosen so that the front panel is the cover page's artboard —
       * so the press box less the panel's origin is the screen box, number for
       * number. A second type size or a second frame anywhere would move one of
       * them and not the other.
       *
       * The slack is two pixels of the render these were measured in, which is
       * `test/book-verses.test.ts`'s standard: the question is where ink lands
       * in page units and the answer must not depend on how many pixels it was
       * measured in.
       */
      const slack = 2 / SCALE;
      expect(Math.abs(press.x - front.x - screen.x)).toBeLessThan(slack);
      expect(Math.abs(press.y - front.y - screen.y)).toBeLessThan(slack);
      expect(Math.abs(press.width - screen.width)).toBeLessThan(slack);
      expect(Math.abs(press.height - screen.height)).toBeLessThan(slack);

      // And it is inside Printify's safety zone for that panel, which is the
      // question an ink box exists to answer about a printed object. `panelSafe`
      // works in whatever unit its geometry was built in, so this is the same
      // function the composed wrap is measured with and no conversion.
      const safe = panelSafe(G, "front");
      const grown = {
        x: safe.x - slack,
        y: safe.y - slack,
        width: safe.width + 2 * slack,
        height: safe.height + 2 * slack,
      };
      expect(contains(grown, press), `title ink at ${JSON.stringify(press)}`).toBe(true);
      // On the right-hand panel, which containment alone would not establish:
      // the back panel's safety zone is the same size and would hold the box.
      expect(press.x).toBeGreaterThan(spineRegion(G).x + spineRegion(G).width);
    },
  );

  it(
    "leaves the back cover and the spine as the captain drew them",
    { timeout: 180_000 },
    async () => {
      const sheet = raster(
        (await renderPrintPng(
          atScale(wrap),
          suppliedCoverWrapFill(DELIVERED.book, FILL, "softcover"),
          DELIVERED.supplied,
        )).png,
        atScale(wrap),
      );
      const back = panelTrim(G, "back");
      const spine = spineRegion(G);
      expect(isColour(hexAt(sheet, back.x + back.width / 2, back.y + back.height / 2), BACK.hex)).toBe(
        true,
      );
      expect(isColour(hexAt(sheet, spine.x + spine.width / 2, G.canvas.height / 2), SPINE.hex)).toBe(
        true,
      );
      // Not the wash. There is no wash layer on this path at all: a wash over a
      // delivered back cover would paint out artwork somebody drew.
      expect(isColour(hexAt(sheet, back.x + back.width / 2, back.y + back.height / 2),
        wrapWash(DELIVERED.book, FILL))).toBe(false);
      // And the front panel is the front panel's own colour, so nothing has
      // been placed over the wrong half.
      const front = frontPanelBox(G);
      expect(
        isColour(hexAt(sheet, front.x + front.width * 0.1, front.y + front.height * 0.9), FRONT.hex),
      ).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// The photo path, whose cover is somebody else's child
// ---------------------------------------------------------------------------

describe("an order whose artwork was regenerated", () => {
  /** One regenerated page, as the per-order store would hand it back. */
  const page = (pageId: string): ArtworkVersion => ({
    version: 1,
    at: "2026-11-17T09:00:00.000Z",
    pages: [
      {
        pageId,
        asset: {
          sha256: "c".repeat(64),
          mime: "image/png",
          px: [
            FIRST_BOOK.page.print.pixels.width,
            FIRST_BOOK.page.print.pixels.height,
          ] as [number, number],
        },
      },
    ],
  });

  it("drops the look's wrap when its cover was repainted", () => {
    // The failure this closes: the captain regenerates the child, the cover
    // comes back with the buyer's little one on it — and the wrap is still the
    // stock look's finished cover, so the press prints this buyer's interior
    // behind somebody else's child. Exactly the shape of the twelve
    // regenerated right-hand pages that shipped facing stock-look arms.
    const ordered = bookWithOrderArtwork(DELIVERED.book, FILL, page(FIRST_BOOK.cover.id));
    expect(deliveredWrapOf(ordered, LOOK, "softcover")).toBeUndefined();
    expect(deliveredWrapOf(ordered, LOOK, "hardcover")).toBeUndefined();
    // And the cover is the regenerated one, so the composed wrap carries it.
    expect(
      ordered.cover.art.kind === "asset" && ordered.cover.art.byLook[LOOK].sha256,
    ).toBe("c".repeat(64));
  });

  it("keeps the wrap when the cover was not repainted", () => {
    // The paired positive. An upload of interior pages only leaves the cover
    // exactly as the look delivered it, and the captain's own back cover is
    // better than a wash.
    const ordered = bookWithOrderArtwork(DELIVERED.book, FILL, page("page-006"));
    expect(deliveredWrapOf(ordered, LOOK, "softcover")).toEqual(
      deliveredWrapOf(DELIVERED.book, LOOK, "softcover"),
    );
    // Because the cover is still the one the look delivered, byte for byte.
    const before = DELIVERED.book.cover.art;
    const after = ordered.cover.art;
    expect(after.kind === "asset" && after.byLook[LOOK]).toEqual(
      before.kind === "asset" && before.byLook[LOOK],
    );
  });
});

// ---------------------------------------------------------------------------
// The hardcover
// ---------------------------------------------------------------------------

describe("the hardcover, whose wrap is in hand and whose template is not", () => {
  it("records the size somebody counted and the arithmetic nobody checked", () => {
    const derived = HARDCOVER_COVER_WRAP_DERIVED;
    expect(derived.area).toEqual({ width: 5370, height: 2850 });
    // The arithmetic is self-consistent, which is exactly why it is recorded
    // rather than used: allowance and spine are a consequence of two
    // assumptions about a file nobody has opened.
    expect(2 * derived.inferred.allowance + derived.inferred.panel.height).toBe(derived.area.height);
    expect(
      2 * derived.inferred.allowance + 2 * derived.inferred.panel.width + derived.inferred.spine,
    ).toBe(derived.area.width);
    expect(inchesOf(derived.inferred.panel.width, derived.dpi)).toBeCloseTo(8, 6);
    expect(derived.needs).toContain("safety zone");
    expect(derived.derivation).toContain("counted off three files");
  });

  it("is not a MeasuredTemplate and cannot be used as one", () => {
    // The structural half. `DerivedWrap` has no `finished` and no `safety`, so
    // every function that could place a title refuses it at compile time —
    // `test/no-title-on-an-unmeasured-wrap.ts` is the file of calls that must
    // not compile.
    expect("finished" in HARDCOVER_COVER_WRAP_DERIVED).toBe(false);
    expect("safety" in HARDCOVER_COVER_WRAP_DERIVED).toBe(false);
    expect("template" in COVER_PRODUCTS.hardcover).toBe(false);
  });

  it("still refuses to compose a wrap, with the wrap delivered", () => {
    expect(deliveredWrapOf(DELIVERED.book, LOOK, "hardcover")).toBeTruthy();
    expect(() =>
      suppliedCoverWrapTemplate(
        DELIVERED.book,
        FILL,
        "hardcover",
        deliveredWrapOf(DELIVERED.book, LOOK, "hardcover")!,
      ),
    ).toThrow(CoverWrapUnavailable);
    // And the refusal says the file is kept and what is actually waiting.
    let message = "";
    try {
      measuredProduct("hardcover");
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("accepted, stored and reported");
    expect(message).toContain("supplied area");
    expect(message).toContain("2737");
  });

  it("answers the one question an unmeasured product can answer", () => {
    // How big the file has to be, which is all intake needs and is the only
    // thing the derivation is allowed to decide.
    expect(suppliedAreaOf("hardcover")).toEqual(HARDCOVER_COVER_WRAP_DERIVED.area);
    expect(suppliedAreaOf("softcover")).toEqual(SOFTCOVER_COVER_WRAP.area);
  });
});

// ---------------------------------------------------------------------------
// The alpha channel is measured, not inferred
// ---------------------------------------------------------------------------

/**
 * **Four good wraps were refused for carrying a channel that held nothing.**
 *
 * On 17 November `girl-01/cover-softcover.png` and three others came back with
 * *"colour type 6 carries an alpha channel; paper would show through"*. All
 * four were then measured at alpha 255 on every one of 11,496,000 pixels, and
 * dropping the channel left the colour data byte-identical. The reasoning was
 * right — transparency on a print file is bare paper off the press — and the
 * test was wrong, because having a channel is not being transparent. It had
 * cost five round trips by the time it was measured.
 *
 * So both halves are held here, each against the other: an opaque channel is
 * accepted and a transparent one is refused loudly, with the counts in the
 * message either way. The refusal is the paired negative for the acceptance —
 * a check that accepted everything would pass the first of these and fail the
 * second.
 */

/** The same three-region wrap, written RGBA, with one alpha everywhere. */
function wrapWithAlpha(product: CoverProductId, alpha: number): Uint8Array {
  const area = suppliedAreaOf(product);
  const png = PNG.sync.read(Buffer.from(syntheticWrap(product)));
  for (let i = 0; i < area.width * area.height; i++) png.data[i * 4 + 3] = alpha;
  return new Uint8Array(PNG.sync.write(png, { colorType: 6, inputHasAlpha: true, bitDepth: 8 }));
}

/** The same again, with exactly one pixel let through. One is enough. */
function wrapWithOneHole(product: CoverProductId): Uint8Array {
  const area = suppliedAreaOf(product);
  const png = PNG.sync.read(Buffer.from(syntheticWrap(product)));
  for (let i = 0; i < area.width * area.height; i++) png.data[i * 4 + 3] = 255;
  // In the middle of the front panel, which is the part a buyer sees.
  const cut = frontPanelPxOf(SOFT);
  const at = ((cut.y + 10) * area.width + cut.x + 10) * 4 + 3;
  png.data[at] = 0;
  return new Uint8Array(PNG.sync.write(png, { colorType: 6, inputHasAlpha: true, bitDepth: 8 }));
}

const codesOf = (bytes: Uint8Array) =>
  coverWrapAgainstContract(
    { name: coverWrapFileName("softcover"), bytes },
    "girl-01/cover-softcover.png",
    suppliedAreaOf("softcover"),
    "softcover",
  );

describe("a wrap's alpha channel", () => {
  const area = suppliedAreaOf("softcover");
  const pixels = area.width * area.height;

  it("is read pixel by pixel rather than guessed from the colour type", () => {
    const opaque = readAlphaChannel(wrapWithAlpha("softcover", 255));
    expect(opaque.pixels).toBe(pixels);
    expect(opaque.transparent).toBe(0);
    expect(opaque.lowest).toBe(255);

    // The paired negative, through the same reader: one pixel changed and the
    // count moves by exactly one, so the reading is of the pixels and not of
    // the header.
    const holed = readAlphaChannel(wrapWithOneHole("softcover"));
    expect(holed.pixels).toBe(pixels);
    expect(holed.transparent).toBe(1);
    expect(holed.lowest).toBe(0);

    // And a file with no channel is not read as an opaque one: a failure to
    // measure may never come back as a measurement of nothing.
    expect(() => readAlphaChannel(syntheticWrap("softcover"))).toThrow(AlphaUnreadable);
  });

  it("is accepted when it carries nothing, and the reading says what was looked at", () => {
    const bytes = wrapWithAlpha("softcover", 255);
    expect(hasAlphaChannel(readPngHeader(bytes).colourType)).toBe(true);

    const read = codesOf(bytes);
    expect(read.problems).toEqual([]);
    expect(read.alpha).toEqual({ pixels, transparent: 0, lowest: 255, opaque: 255 });

    // The whole folder, which is the door the import command actually uses.
    const check = checkCoverWraps(
      [{ name: coverWrapFileName("softcover"), bytes }],
      "girl-01",
    );
    expect(check.problems).toEqual([]);
    expect(check.wraps[0].alpha?.transparent).toBe(0);
  });

  it("is refused when it carries transparency, naming what was measured", () => {
    const read = codesOf(wrapWithOneHole("softcover"));
    expect(read.problems.map((p) => p.code)).toEqual(["cover.hasAlpha"]);

    const detail = read.problems[0].detail;
    // The numbers, not an adjective: how many pixels were read, how many are
    // transparent, and how transparent the worst of them is.
    expect(detail).toContain(pixels.toLocaleString("en-US"));
    expect(detail).toContain("1 of them are transparent");
    expect(detail).toContain("the lowest at 0 of 255");
    expect(detail).toContain("paper would show through");

    // Half transparent all over is the same refusal, with a different reading.
    const half = codesOf(wrapWithAlpha("softcover", 128));
    expect(half.problems.map((p) => p.code)).toEqual(["cover.hasAlpha"]);
    expect(half.problems[0].detail).toContain(
      `${pixels.toLocaleString("en-US")} of them are transparent`,
    );
  });

  it("leaves the size refusal exactly where it was", () => {
    // The dimension checks have caught two real mistakes and are untouched by
    // the alpha reading: a wrap at the template's FINISHED SIZE is still
    // refused, whether or not it carries a channel.
    const finished = suppliedAreaOf("hardcover");
    const wrong = {
      name: coverWrapFileName("softcover"),
      bytes: wrapWithAlpha("hardcover", 255),
    };
    const read = coverWrapAgainstContract(wrong, "girl-01", area, "softcover");
    expect(read.problems.map((p) => p.code)).toEqual(["cover.wrongSize"]);
    expect(read.problems[0].detail).toContain(`${finished.width} × ${finished.height}`);
    expect(read.problems[0].detail).toContain(`${area.width} × ${area.height}`);
    // And the opaque channel on that same file is still not a refusal.
    expect(read.alpha?.transparent).toBe(0);
  });

  it("stores an accepted wrap exactly as delivered, and cuts a square with no channel", () => {
    const bytes = wrapWithAlpha("softcover", 255);
    const prepared = prepareCoverWraps(FIRST_BOOK, LOOK, [
      { name: coverWrapFileName("softcover"), bytes },
    ]);
    expect(prepared.problems).toEqual([]);

    // **Stored as supplied.** A channel that is 255 everywhere composites to
    // the same colour on every RIP, so flattening would change the digest —
    // the store's key — and change nothing on paper.
    const wrap = prepared.pages.find((p) => p.product === "softcover")!;
    expect(Array.from(wrap.bytes)).toEqual(Array.from(bytes));
    expect(hasAlphaChannel(readPngHeader(wrap.bytes).colourType)).toBe(true);
    expect(wrap.did).toContain("kept rather than flattened");
    expect(wrap.did).toContain(pixels.toLocaleString("en-US"));

    // The one artefact derived from a wrap drops the channel already, which is
    // the other half of why there is nothing to gain by flattening the wrap.
    const cut = prepared.pages.find((p) => p.pageId === FIRST_BOOK.cover.id)!;
    expect(hasAlphaChannel(readPngHeader(cut.bytes).colourType)).toBe(false);
    const panel = frontPanelPxOf(SOFT);
    expect(coloursIn(cut.bytes, { x: 0, y: 0, width: panel.width, height: panel.height })).toEqual(
      new Set([FRONT.hex]),
    );
  });

  it("refuses a channel it could not measure rather than passing it", () => {
    // Interlaced: the pixels are not in one pass and this reader does not
    // reassemble them. The file is refused under the same code, saying so — a
    // quiet pass on a file nobody read is the failure this whole section exists
    // to prevent.
    const bytes = wrapWithAlpha("softcover", 255);
    const interlaced = Uint8Array.from(bytes);
    interlaced[28] = 1;
    const read = codesOf(interlaced);
    expect(read.problems.map((p) => p.code)).toEqual(["cover.hasAlpha", "cover.interlaced"]);
    expect(read.problems[0].detail).toContain("could not be measured");
    expect(read.alpha).toBeNull();
  });
});
