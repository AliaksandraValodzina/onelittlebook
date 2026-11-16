/**
 * **The printable cover, measured rather than declared.**
 *
 * A wrap is the one artefact in this repository whose dimensions come from
 * somebody else's file — Printify's own cover template — so every number it
 * produces has to be checked against that measurement and against nothing
 * else. The rule this file keeps is that **the expected values are read out of
 * the configuration**, never typed a second time: the one place `4790` appears
 * is `lib/print/printify.ts`, beside the name of the PSD it was read from, and
 * the assertions below ask the renderer whether the bytes agree with it.
 *
 * Four things are being established, in order of what they cost to get wrong:
 *
 * **The file is the size Printify asked for**, read out of the PNG header.
 *
 * **The front panel's content lands inside the safety zone**, measured as a
 * difference between two renders — `test/pixels.ts` § `changedBox` — so the
 * box asserted is where the ink *actually* went rather than where a frame says
 * it should.
 *
 * **A hardcover wrap cannot be produced at all**, because nobody has opened
 * its template and its spine is wider than the softcover's by an unknown
 * amount. A plausible wrong wrap is the failure this whole design exists to
 * prevent.
 *
 * **The website's square is untouched** — the same bytes whether a wrap was
 * made or not, and no component on the shop path can even reach this module.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import {
  COVER_PRODUCTS,
  CoverWrapUnavailable,
  WRAP_LAYER,
  coverWrapFill,
  coverWrapTemplate,
  measuredProduct,
  panelRegion,
  panelSafe,
  panelTrim,
  spineRegion,
  wrapGeometry,
  wrapWash,
} from "../lib/book/cover-wrap";
import {
  SOFTCOVER_COVER_WRAP,
  bleedPxAcross,
  bleedPxOf,
  inchesOf,
  panelPxOf,
  pointsOf,
  spinePxOf,
  type MeasuredTemplate,
} from "../lib/print/printify";
import { renderBookPagePng, renderCoverWrapPng } from "../lib/book/print";
import { renderPrintPng } from "../lib/render/raster";
import { renderPageSvg } from "../lib/render/svg";
import { sha256 } from "../lib/assets/digest";
import { validateTemplate } from "../lib/template/validate";
import { contains } from "../lib/template/geometry";
import { pngChunkTypes, readPngHeader } from "../lib/render/png";
import { changedBox, distinctColours, hexAt, isColour, raster } from "./pixels";
import { SLOT } from "../lib/book/slots";
import type { BookTemplate } from "../lib/book/types";
import type { AssetRef, Box, PageTemplate } from "../lib/template/types";

const SOFT = measuredProduct("softcover").template;
const G = wrapGeometry(SOFT);
const FILL = FIXTURE_BOOK_FILL;

// ---------------------------------------------------------------------------
// The measurement, and the arithmetic that falls out of it
// ---------------------------------------------------------------------------

describe("Printify's softcover cover template, as read out of the file", () => {
  it("names the file it was read from, so the numbers can be checked", () => {
    expect(SOFT.file).toMatch(/\.psd$/i);
    expect(SOFT.file).toContain("Softcover");
    expect(SOFT.sku).toBeTruthy();
    // The PSD itself is the captain's download and is deliberately not here.
    expect(() => readFileSync(path.join(process.cwd(), SOFT.file))).toThrow();
  });

  it("has one bleed, because both axes agree on it", () => {
    // Two bleeds would mean the file had been read wrong, and averaging them
    // would be the wrong response: 37.5 px on both axes is what makes a single
    // number honest.
    expect(bleedPxOf(SOFT)).toBe(bleedPxAcross(SOFT));
    expect(inchesOf(bleedPxOf(SOFT), SOFT.dpi)).toBeCloseTo(0.125, 6);
    // Half of what this repository declares on a page — the discrepancy
    // `docs/print.md` § The page the book declares records, and the reason it
    // is reported rather than quietly changed.
    expect(inchesOf(bleedPxOf(SOFT), SOFT.dpi)).toBeLessThan(
      FIRST_BOOK.page.canvas.bleed / 72,
    );
  });

  it("is a 7.75 in panel, not the 8.00 in the product is named after", () => {
    const panel = panelPxOf(SOFT);
    expect(panel.width).toBe(panel.height);
    expect(inchesOf(panel.width, SOFT.dpi)).toBeCloseTo(7.75, 6);
    // "8.00 x 8.00" is in the SKU, and the SKU is a name rather than a trim.
    expect(SOFT.sku).toBeTruthy();
    expect(inchesOf(panel.width, SOFT.dpi)).not.toBeCloseTo(8, 2);
  });

  it("derives a spine nobody published, and it is not zero", () => {
    expect(spinePxOf(SOFT)).toBe(SOFT.finished.width - 2 * panelPxOf(SOFT).width);
    expect(spinePxOf(SOFT)).toBeGreaterThan(0);
    expect(inchesOf(spinePxOf(SOFT), SOFT.dpi)).toBeCloseTo(0.217, 3);
  });

  it("tiles the supplied area exactly: bleed, panel, spine, panel, bleed", () => {
    const across =
      2 * bleedPxOf(SOFT) + 2 * panelPxOf(SOFT).width + spinePxOf(SOFT);
    expect(across).toBe(SOFT.area.width);
    expect(2 * bleedPxOf(SOFT) + panelPxOf(SOFT).height).toBe(SOFT.area.height);
  });

  it("would say something different about a different template", () => {
    // The control. Every number above is arithmetic on the measurement, so a
    // product with another template derives another geometry — which is the
    // property that makes the hardcover a configuration rather than a rewrite.
    const wider: MeasuredTemplate = {
      ...SOFT,
      file: "a-template-nobody-has",
      area: { width: 4890, height: 2400 },
      finished: { width: 4815, height: 2325 },
    };
    expect(spinePxOf(wider)).toBe(spinePxOf(SOFT) + 100);
    expect(bleedPxOf(wider)).toBe(bleedPxOf(SOFT));
    expect(wrapGeometry(wider).spine).toBeGreaterThan(G.spine);
  });
});

// ---------------------------------------------------------------------------
// The composition
// ---------------------------------------------------------------------------

/** A stand-in for the square's render, for the tests that never rasterise. */
const FRONT: AssetRef = {
  sha256: "a".repeat(64),
  mime: "image/png",
  px: [FIRST_BOOK.page.print.pixels.width, FIRST_BOOK.page.print.pixels.height],
};

describe("the wrap, as a page template the one renderer can draw", () => {
  const template = coverWrapTemplate(FIRST_BOOK, FILL, "softcover", FRONT);

  it("is a valid template, which is also how the aspect ratio is checked", () => {
    // `validateTemplate` refuses a print size whose proportions differ from the
    // artboard's — a page that would be stretched or letterboxed, invisibly
    // until it is printed. So this one assertion covers the thing a wrap is
    // most likely to get wrong.
    expect(validateTemplate(template)).toEqual([]);
    expect(template.print.pixels).toEqual(SOFT.area);
    expect(template.canvas.width / template.canvas.height).toBeCloseTo(
      SOFT.area.width / SOFT.area.height,
      9,
    );
  });

  it("is three layers: the back wash, the spine, and the square on the right", () => {
    expect(template.layers.map((l) => l.id)).toEqual([
      WRAP_LAYER.back,
      WRAP_LAYER.spine,
      WRAP_LAYER.front,
    ]);
    const front = template.layers.find((l) => l.id === WRAP_LAYER.front);
    expect(front?.kind).toBe("image");
    expect(front?.frame.x).toBeGreaterThan(spineRegion(G).x);
    expect(panelRegion(G, "back").x).toBe(0);
  });

  it("tiles the artboard with the panels and the spine, leaving no gap", () => {
    const back = panelRegion(G, "back");
    const spine = spineRegion(G);
    const front = panelRegion(G, "front");
    expect(back.x + back.width).toBeCloseTo(spine.x, 9);
    expect(spine.x + spine.width).toBeCloseTo(front.x, 9);
    expect(front.x + front.width).toBeCloseTo(G.canvas.width, 9);
    for (const region of [back, spine, front]) {
      expect(region.y).toBe(0);
      expect(region.height).toBe(G.canvas.height);
    }
  });

  it("keeps each panel's safety zone inside its own trim", () => {
    for (const side of ["back", "front"] as const) {
      expect(contains(panelTrim(G, side), panelSafe(G, side))).toBe(true);
      expect(contains(panelRegion(G, side), panelTrim(G, side))).toBe(true);
    }
    // The size is the template's, in points, and the box is centred in the
    // panel — so the two insets are the panel less the safety zone, halved.
    expect(panelSafe(G, "front").width).toBeCloseTo(
      pointsOf(SOFT.safety.width, SOFT.dpi),
      9,
    );
    expect(panelSafe(G, "front").height).toBeCloseTo(
      pointsOf(SOFT.safety.height, SOFT.dpi),
      9,
    );
  });

  it("draws no word of its own anywhere, which is what a bare spine means", () => {
    // The spine carries no title and no name — the captain's decision — and
    // the way that is kept is that a wrap has no text slot in it at all. Read
    // off the SVG the print path produces rather than off the template, so a
    // layer that somehow drew text would be caught too. The only words on a
    // wrap are the ones already inside the square the buyer approved.
    expect(template.layers.some((l) => l.kind === "textSlot")).toBe(false);
    expect(Object.keys(coverWrapFill(FIRST_BOOK, "softcover").texts)).toEqual([]);
    const svg = renderPageSvg(template, coverWrapFill(FIRST_BOOK, "softcover"), {
      href: () => "data:image/png;base64,",
    });
    expect(svg).not.toContain("<text");
  });

  it("paints the back and the spine the colour the buyer's cover already is", () => {
    // A look declares no palette, so the wash is the cover's own ground — the
    // colourway the buyer picked. Derived, so picking another changes it.
    const other = FIRST_BOOK.covers.find((c) => c.id !== FILL.coverId)!;
    expect(wrapWash(FIRST_BOOK, FILL)).toBe(
      FIRST_BOOK.covers.find((c) => c.id === FILL.coverId)!.colour,
    );
    expect(wrapWash(FIRST_BOOK, { ...FILL, coverId: other.id })).toBe(other.colour);
  });

  it("lets a look declare its own wash, and prefers it", () => {
    const wash = "#123456";
    const book: BookTemplate = {
      ...FIRST_BOOK,
      looks: FIRST_BOOK.looks.map((l) => (l.id === FILL.lookId ? { ...l, wash } : l)),
    };
    expect(wrapWash(book, FILL)).toBe(wash);
  });

  it("is not the book's page background, so a missing panel reads as missing", () => {
    // The ground beneath the ground is cream, never the wash: a gap that is
    // the wash looks like the design, and a gap that is cream looks like the
    // fault it is.
    expect(coverWrapTemplate(FIRST_BOOK, FILL, "softcover", FRONT).canvas.background).toBe(
      FIRST_BOOK.page.canvas.background,
    );
    expect(wrapWash(FIRST_BOOK, FILL)).not.toBe(FIRST_BOOK.page.canvas.background);
  });
});

// ---------------------------------------------------------------------------
// The hardcover, which must refuse
// ---------------------------------------------------------------------------

describe("a product whose template nobody has opened", () => {
  it("is declared in the shape it will be filled in, with no numbers in it", () => {
    const hardcover = COVER_PRODUCTS.hardcover;
    expect(hardcover.measured).toBe(false);
    // There is nowhere to put an estimate: the template is on the other arm of
    // the union. `lib/shop/shipping.ts` leaves `RATES` null for this reason.
    expect("template" in hardcover).toBe(false);
    expect(hardcover.measured === false && hardcover.blueprint).toBe(2737);
  });

  it("refuses, and the refusal says what to fetch and what to read out of it", () => {
    expect(() => measuredProduct("hardcover")).toThrow(CoverWrapUnavailable);
    expect(() => coverWrapTemplate(FIRST_BOOK, FILL, "hardcover", FRONT)).toThrow(
      CoverWrapUnavailable,
    );
    let message = "";
    try {
      measuredProduct("hardcover");
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("2737");
    expect(message).toContain("supplied area");
    expect(message).toContain("safety zone");
    expect(message.toLowerCase()).toContain("spine");
    // The reason it cannot be derived from the softcover's numbers, stated in
    // the refusal rather than only in a docblock.
    expect(message).toContain("WIDER");
  });

  it("refuses before it renders anything", async () => {
    // Not after two seconds of rasterising, and not with a file in hand.
    await expect(
      renderCoverWrapPng(FIRST_BOOK, FILL, { product: "hardcover" }),
    ).rejects.toThrow(CoverWrapUnavailable);
  });
});

// ---------------------------------------------------------------------------
// The bytes
// ---------------------------------------------------------------------------

describe("the file that goes to Printify", () => {
  it(
    "is exactly the supplied area, read out of its own header",
    { timeout: 120_000 },
    async () => {
      const wrap = await renderCoverWrapPng(FIRST_BOOK, FILL);
      // The expected size is the configuration's, not a number typed twice.
      expect(readPngHeader(wrap.png)).toMatchObject({
        width: SOFT.area.width,
        height: SOFT.area.height,
      });
      expect(wrap.pixels).toEqual(SOFT.area);
      expect(wrap.filename).toContain(`${SOFT.area.width}x${SOFT.area.height}`);
      expect(wrap.product).toBe("softcover");

      // 300 dpi across the supplied area, derived from the measurement rather
      // than stamped into the file — `docs/print.md` on why DPI is never a
      // declared field.
      expect(wrap.pixels.width / inchesOf(SOFT.area.width, SOFT.dpi)).toBeCloseTo(300, 6);

      // sRGB, in the file and not only in a document, exactly as every page is.
      const types = pngChunkTypes(wrap.png);
      expect(types[0]).toBe("IHDR");
      expect(types[1]).toBe("sRGB");
      expect(types.indexOf("sRGB")).toBeLessThan(types.indexOf("IDAT"));

      // The same colour type and depth the book's own pages are, derived from
      // one of them rather than asserted as a constant.
      const page = await renderBookPagePng(FIRST_BOOK, 0, FILL);
      const wrapped = readPngHeader(wrap.png);
      const square = readPngHeader(page.png);
      expect(wrapped.bitDepth).toBe(square.bitDepth);
      expect(wrapped.colourType).toBe(square.colourType);
      expect(wrapped.interlaced).toBe(false);

      // **The website's square is unchanged.** The wrap is composed from the
      // cover page's own render, and that render is byte-for-byte the one the
      // preview and the basket show.
      expect(Buffer.from(wrap.front.png)).toEqual(Buffer.from(page.png));
      expect(wrap.front.pixels).toEqual(FIRST_BOOK.page.print.pixels);
    },
  );

  it("puts the wash on the left and the picture on the right", { timeout: 120_000 }, async () => {
    const wrap = await renderCoverWrapPng(FIRST_BOOK, FILL);
    // The scale `raster` works in comes from the artboard, so any composition
    // of this wrap answers for it — the asset ref is not read.
    const sheet = raster(wrap.png, coverWrapTemplate(FIRST_BOOK, FILL, "softcover", FRONT));
    const wash = wrapWash(FIRST_BOOK, FILL);

    const back = panelTrim(G, "back");
    const spine = spineRegion(G);
    expect(isColour(hexAt(sheet, back.x + back.width / 2, back.y + back.height / 2), wash)).toBe(
      true,
    );
    // The spine is the same wash, which is what bare means here.
    expect(isColour(hexAt(sheet, spine.x + spine.width / 2, spine.height / 2), wash)).toBe(true);

    // The back is a plain wash and the front is a picture, which is the whole
    // of "the front panel on the right". A flat region is one colour; the
    // cover's ground alone is a gradient, before the title panel on top of it.
    const middle = (box: Box): Box => ({
      x: box.x + box.width / 4,
      y: box.y + box.height / 4,
      width: box.width / 2,
      height: box.height / 2,
    });
    expect(distinctColours(sheet, middle(back))).toBeLessThanOrEqual(2);
    expect(distinctColours(sheet, middle(panelTrim(G, "front")))).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// Where the front panel's content lands
// ---------------------------------------------------------------------------

/**
 * The same wrap at a size this file can afford four renders of.
 *
 * `test/book-verses.test.ts` makes the argument: the question is where ink
 * lands, in page units, and the answer does not depend on how many pixels it
 * was measured in. 1916 px across 1149.6 pt is 1.67 pixels a point, and the
 * slack below is a point.
 */
const AFFORDABLE = { width: 1916, height: 960 };

/** The book rendered small enough to compose four of, square and wrap alike. */
const SMALL: BookTemplate = {
  ...FIRST_BOOK,
  page: {
    ...FIRST_BOOK.page,
    print: { ...FIRST_BOOK.page.print, pixels: { width: 1200, height: 1200 } },
  },
};

/** The book with the cover's title and its panel taken off. */
function withoutTheTitle(book: BookTemplate): BookTemplate {
  return {
    ...book,
    cover: {
      ...book.cover,
      // The authored words go with the slot: `validateBook` refuses a page
      // that carries a story and nothing to set it in, which is the rule
      // keeping words from silently going nowhere.
      story: undefined,
      layers: (book.cover.layers ?? []).filter(
        (l) => !("slot" in l && l.slot === SLOT.story) && l.id !== "cover-panel",
      ),
    },
  };
}

/** A wrap of one book, rasterised at a size four renders of which are affordable. */
async function wrapRaster(book: BookTemplate, withFront = true) {
  const square = await renderBookPagePng(book, 0, FIXTURE_BOOK_FILL);
  const digest = sha256(square.png);
  const composed = coverWrapTemplate(book, FILL, "softcover", {
    sha256: digest,
    mime: "image/png",
    px: [square.pixels.width, square.pixels.height],
  });
  const template: PageTemplate = {
    ...composed,
    print: { ...composed.print, pixels: AFFORDABLE },
    layers: withFront
      ? composed.layers
      : composed.layers.filter((l) => l.id !== WRAP_LAYER.front),
  };
  const { png } = await renderPrintPng(
    template,
    coverWrapFill(book, "softcover"),
    new Map([[digest, square.png]]),
  );
  return raster(png, template);
}

describe("the front panel's own content", () => {
  it(
    "lands inside Printify's safety zone for that panel",
    { timeout: 120_000 },
    async () => {
      const [titled, bare] = await Promise.all([
        wrapRaster(SMALL),
        wrapRaster(withoutTheTitle(SMALL)),
      ]);
      const ink = changedBox(titled, bare);

      // The control is built in: a title that drew nothing differs nowhere and
      // `changedBox` returns null, which no containment assertion can pass.
      expect(ink).not.toBeNull();

      const safe = panelSafe(G, "front");
      const slack = 1;
      const grown = {
        x: safe.x - slack,
        y: safe.y - slack,
        width: safe.width + 2 * slack,
        height: safe.height + 2 * slack,
      };
      expect(contains(grown, ink as Box), `title ink at ${JSON.stringify(ink)}`).toBe(true);

      // And on the right-hand panel, which is the half of "front panel on the
      // right" a containment assertion alone would not catch: the back panel's
      // safety zone is the same size and would hold the same box.
      expect((ink as Box).x).toBeGreaterThan(spineRegion(G).x + spineRegion(G).width);
    },
  );

  it("covers the whole panel, so no cut can find an edge", { timeout: 120_000 }, async () => {
    const [withFront, without] = await Promise.all([
      wrapRaster(SMALL),
      wrapRaster(SMALL, false),
    ]);
    const drawn = changedBox(withFront, without);
    expect(drawn).not.toBeNull();

    // The square is cover-fitted to the panel region — bleed included — so
    // what it covers is that region, corner to corner. A wrap whose artwork
    // stopped at the trim would print a white edge wherever the guillotine
    // fell outside it.
    const region = panelRegion(G, "front");
    const box = drawn as Box;
    expect(box.x).toBeLessThanOrEqual(region.x + 1);
    expect(box.y).toBeLessThanOrEqual(region.y + 1);
    expect(box.x + box.width).toBeGreaterThanOrEqual(region.x + region.width - 1);
    expect(box.y + box.height).toBeGreaterThanOrEqual(region.y + region.height - 1);
    // And nothing of it reached the spine, which is the fold.
    expect(box.x).toBeGreaterThanOrEqual(spineRegion(G).x + spineRegion(G).width - 1);
  });
});

// ---------------------------------------------------------------------------
// The shop never learns this exists
// ---------------------------------------------------------------------------

describe("the square still serves the website", () => {
  it("is reached from the print path and the owner's page, and nowhere else", () => {
    // Specifiers are **resolved** rather than matched as text, for the reason
    // `test/ghost.test.ts` gives: `"./cover-wrap"` and `"../book/cover-wrap"`
    // are the same module, and a regular expression for one of them is a check
    // that quietly stops looking.
    const target = path.join(process.cwd(), "lib", "book", "cover-wrap.ts");
    const importers = sourceFiles()
      .filter((file) => !file.startsWith(path.join(process.cwd(), "test")))
      .filter((file) =>
        (readFileSync(file, "utf8").match(/from\s+"(\.[^"]*)"/g) ?? []).some((statement) => {
          const spec = /from\s+"(\.[^"]*)"/.exec(statement)?.[1] ?? "";
          return path.resolve(path.dirname(file), `${spec}.ts`) === target;
        }),
      )
      .map((f) => path.relative(process.cwd(), f))
      .sort();

    expect(importers).toEqual([
      "app/admin/[ref]/page.tsx",
      "app/api/admin/cover/[ref]/route.ts",
      "lib/book/print.ts",
      "scripts/render-book.ts",
    ]);
    // Nothing the buyer can reach: no picker, no preview, no basket.
    for (const file of importers) {
      expect(file.startsWith("app/_")).toBe(false);
    }
  });
});

/** Every `.ts`/`.tsx` of this project, so the check above is over all of it. */
function sourceFiles(): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
  };
  for (const dir of ["lib", "app", "scripts", "templates", "test", "fixtures"]) {
    walk(path.join(process.cwd(), dir));
  }
  return out;
}
