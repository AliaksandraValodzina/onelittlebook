/**
 * **A spread is one open book, and the fold that says so can never print.**
 *
 * The preview used to draw two rounded panels with a white gap between them,
 * which read as two pictures side by side. The captain's generation brief
 * composes every spread around the binding — *"the vertical centre line is the
 * book fold; no face, hand or key object within 8% of it"* — so the quiet
 * middle of every picture is where the fold is, and a preview that draws a gap
 * there is showing the buyer a composition mistake that is not in the artwork.
 *
 * `lib/book/fold.ts` carries the argument for the treatment and for its shape.
 * This file is the evidence, in four parts:
 *
 * **The fold is drawn.** One container per spread, the two leaves meeting with
 * no gap, and one gutter overlay on the join — counted off `spreads()` rather
 * than listed, so a book of a different length is still covered.
 *
 * **A single page has no fold.** The cover is a group of one and is the panel
 * it always was, which is the same branch the *One page* toggle takes.
 *
 * **It cannot reach a print file.** A gutter shadow baked into a print file is
 * a grey smear down the middle of a real book and cannot be undone after
 * printing, so the guarantee is the shape of the code: there is no render
 * option, no layer kind and no asset a fold could arrive as —
 * `test/no-fold-in-a-print-file.ts` is that half, carried by `tsc`. Here the
 * bytes of every print render are read, the import graph is read off disk, and
 * the fold module is asked by reflection whether it can produce anything but a
 * class name and a measurement.
 *
 * **It darkens nothing the buyer supplied.** The band's reach is measured
 * against every photograph and text slot in the book, out of the template's own
 * frames — including the opening spread, which carries the buyer's photograph,
 * dedication and from-line. The paired negative is a deliberately wide fold,
 * which really does reach the dedication, so the check can fail.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import BookProvider from "../app/_book/BookProvider";
import Preview from "../app/_book/Preview";
import { DEFAULT_MARKET } from "../lib/shop/market";
import {
  pageCount,
  pageFillFor,
  pageSequence,
  pageTemplateFor,
  spreadSideOf,
  spreads,
} from "../lib/book/derive";
import { renderPageSvg } from "../lib/render/svg";
import { renderPrintSvg } from "../lib/render/raster";
import { assetUrl } from "../lib/assets/resolve";
import * as FOLD_MODULE from "../lib/book/fold";
import { SPREAD_FOLD, foldBand, foldReachIn } from "../lib/book/fold";

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");
const CSS = read("app", "shop.css");
const CHOSEN = { lookId: FIXTURE_BOOK_FILL.lookId, coverId: FIXTURE_BOOK_FILL.coverId };

/** The preview as a visitor arrives at it: two pages at a time, the default. */
const preview = renderToStaticMarkup(
  <BookProvider book={FIRST_BOOK} market={DEFAULT_MARKET}>
    <Preview />
  </BookProvider>,
);

/** How many times a string occurs. The counts below are all derived, not typed. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// ---------------------------------------------------------------------------

describe("two pages are one open book", () => {
  const groups = spreads(FIRST_BOOK);
  const pairs = groups.filter((g) => g.length === 2);
  const alone = groups.filter((g) => g.length === 1);

  it("is a book with both kinds of group in it, so the counts below mean something", () => {
    // The cover is a group of one and the spreads are groups of two. Without
    // both, half of what follows would be vacuously true.
    expect(pairs.length).toBeGreaterThan(1);
    expect(alone.length).toBeGreaterThan(0);
  });

  it("puts one container, one pair of leaves and one gutter on each spread", () => {
    expect(count(preview, `class="${SPREAD_FOLD.open}"`)).toBe(pairs.length);
    expect(count(preview, `class="${SPREAD_FOLD.leaves}"`)).toBe(pairs.length);
    expect(count(preview, SPREAD_FOLD.crease)).toBe(pairs.length);
  });

  it("draws no fold on a page with nothing facing it", () => {
    // The cover's group. The *One page* toggle takes this same branch for every
    // page, and it cannot be driven here — effects do not run in
    // `renderToStaticMarkup` and there is no DOM in this suite — so the branch
    // is exercised through the book's own group of one.
    const creases = count(preview, SPREAD_FOLD.crease);
    expect(creases).toBe(groups.length - alone.length);
    expect(creases).toBeLessThan(groups.length);
  });

  it("leaves the single-page panel exactly as it was", () => {
    // "The one-page view is unchanged" is the instruction, and the panel is
    // Tailwind utilities in the component rather than anything derived, so it
    // is asserted as the string it is.
    expect(preview).toContain(
      'class="grid grid-cols-1 gap-1 overflow-hidden rounded-xl shadow-xl shadow-black/15"',
    );
  });

  it("keeps the page caption the captain asked to keep", () => {
    // Useful, and explicitly in scope: the captain can see which pages they are
    // looking at. Derived from the sequence rather than typed.
    for (const group of spreads(FIRST_BOOK)) {
      const caption = group
        .map((i) => {
          const id = pageSequence(FIRST_BOOK)[i].id;
          return id === "cover" ? "Cover" : `Page ${Number(id.replace("page-", ""))}`;
        })
        .join(" · ");
      expect(preview, caption).toContain(caption);
    }
  });

  it("is one surface: the two leaves meet, with no gap between them", () => {
    // The whole complaint. `gap: 0` in the leaves rule, and the gap that used
    // to be there — `gap-1` on a two-column grid — is gone from the component.
    const rule = /\.spread-leaves\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";
    expect(rule).toContain("grid-template-columns: 1fr 1fr");
    expect(rule).toMatch(/gap:\s*0;/);
    expect(read("app", "_book", "Preview.tsx")).not.toContain("grid-cols-2");
  });

  it("is one container, with the page shadow on its outside edges", () => {
    // Not a rounded box per page: the corners and the shadow are on the
    // container, and `overflow: hidden` is what makes the outer corners round
    // while the join stays square.
    const rule = /\.spread-open\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";
    expect(rule).toContain("position: relative");
    expect(rule).toContain("overflow: hidden");
    expect(rule).toMatch(/border-radius:/);
    expect(rule).toMatch(/box-shadow:/);
  });

  it("shades the join, and lifts the crease on it", () => {
    const rule = /\.spread-fold\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";
    // A gradient across the band — the soft wide ramp is the curvature into the
    // binding and the tight stops at the middle are the crease — centred on the
    // join, over the top, and not in anybody's way.
    expect(rule).toContain("linear-gradient");
    expect(rule).toContain("left: 50%");
    expect(rule).toContain("pointer-events: none");
    expect(rule).toContain("var(--fold-deep)");
    expect(rule).toContain("var(--fold-lift)");
    // Nothing to read and nothing to press.
    expect(preview).toMatch(
      new RegExp(`class="${SPREAD_FOLD.crease}"[^>]*aria-hidden="true"`),
    );
  });

  it("is a crease and not a black bar", () => {
    // The deepest tint in the gradient. A gutter heavy enough to swallow the
    // middle of a picture is the failure mode the captain named, so the alpha
    // is asserted rather than left to taste.
    const deep = /--fold-deep:\s*rgb\([^)]*?\/\s*(\d+)%\s*\)/.exec(CSS);
    expect(deep, "the deep tint is not declared as a percentage alpha").not.toBeNull();
    expect(Number(deep![1])).toBeLessThanOrEqual(30);
    expect(Number(deep![1])).toBeGreaterThan(0);
  });
});

describe("it holds up on a phone", () => {
  it("scales with the spread rather than being a number of pixels", () => {
    // A fixed band would be a hairline on a desktop and a bar on a phone. The
    // width is a percentage of the container, so a 320 px spread and a 900 px
    // one get the same fold.
    expect(foldBand()).toMatch(/^[\d.]+%$/);
    expect(preview).toContain(`width:${foldBand()}`);
  });

  it("lightens the crease at phone width rather than narrowing it", () => {
    // Narrowing it at that size stops it reading as a fold at all; a paler one
    // still does. Four tints, overridden in one place.
    const query = /@media \(max-width: 560px\) \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
    expect(query).toContain(".spread-open");
    const alphaIn = (text: string, name: string) =>
      Number(new RegExp(`--${name}:\\s*rgb\\([^)]*?/\\s*(\\d+)%`).exec(text)?.[1] ?? NaN);
    const wide = /\.spread-open\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";
    for (const tint of ["fold-soft", "fold-mid", "fold-deep", "fold-lift"]) {
      expect(alphaIn(query, tint), tint).toBeLessThan(alphaIn(wide, tint));
    }
  });
});

describe("the fold darkens nothing the buyer supplied", () => {
  /**
   * Every photograph and text slot in the book, against the band's reach.
   *
   * Measured out of the template's own frames in the page's own units, which is
   * what `foldReachIn` is for: a right-hand page's gutter edge is `x = 0` and a
   * left-hand page's is `x = width`, and `spreadSideOf` says which a page is.
   * Nothing here is typed, so moving a slot or widening the band fails this.
   */
  function intrusions(reach: (width: number) => number): string[] {
    const out: string[] = [];
    for (let index = 0; index < pageCount(FIRST_BOOK); index++) {
      const side = spreadSideOf(FIRST_BOOK, index)?.side;
      if (!side) continue; // the cover has no facing page and so no fold
      const template = pageTemplateFor(FIRST_BOOK, index, CHOSEN);
      const width = template.canvas.width;
      const band = reach(width);
      for (const layer of template.layers) {
        if (layer.kind !== "photoSlot" && layer.kind !== "textSlot") continue;
        const { x, width: w } = layer.frame;
        const clear = side === "right" ? x >= band : x + w <= width - band;
        if (!clear) out.push(`${pageSequence(FIRST_BOOK)[index].id}/${layer.id}`);
      }
    }
    return out;
  }

  it("finds slots to measure at all, so the check below is not vacuous", () => {
    // The opening spread's three among them: the photograph, the dedication and
    // the from-line, which are the ones the instruction names.
    const measured = intrusions(() => 0);
    expect(measured).toEqual([]);
    const everything = intrusions((w) => w);
    expect(everything.length).toBeGreaterThan(4);
    expect(everything).toContain("page-002/photo");
    expect(everything).toContain("page-002/dedication");
  });

  it("reaches none of them", () => {
    expect(intrusions((w) => foldReachIn(w))).toEqual([]);
  });

  it("would reach the dedication if it were wide, so the check can fail", () => {
    // A quarter of a page is five times the real reach. The opening spread is
    // the shallowest margin in the book on the right-hand side, which is why it
    // is the one named.
    const wide = intrusions((w) => foldReachIn(w, { ...SPREAD_FOLD, reach: 0.25 }));
    expect(wide).toContain("page-002/dedication");
  });

  it("stays inside the margin the artwork was composed with", () => {
    // *"No face, hand or key object within 8% of [the centre line]"*. Read as
    // 8% of the spread that is ±8%, and read as 8% of a page it is ±8% of a
    // page; the band reaches `reach` of a page on each side, so it is at or
    // inside the margin on either reading.
    expect(SPREAD_FOLD.reach).toBeLessThanOrEqual(0.08);
  });
});

describe("the fold cannot reach a print file", () => {
  /** The fold's marks. One string each, so a failure names which one leaked. */
  const MARKS = [SPREAD_FOLD.open, SPREAD_FOLD.leaves, SPREAD_FOLD.crease, "fold-deep"];

  it("is in the preview, which is what makes its absence below meaningful", () => {
    for (const mark of MARKS.slice(0, 3)) expect(preview, mark).toContain(mark);
    expect(CSS).toContain("--fold-deep");
  });

  it("appears in no print render of any page of the book", async () => {
    for (let index = 0; index < pageCount(FIRST_BOOK); index++) {
      const id = pageSequence(FIRST_BOOK)[index].id;
      const print = await renderPrintSvg(
        pageTemplateFor(FIRST_BOOK, index, CHOSEN),
        pageFillFor(FIRST_BOOK, index, FIXTURE_BOOK_FILL),
      );
      for (const mark of MARKS) expect(print, `${id} leaked ${mark}`).not.toContain(mark);
      // And no gradient across the middle of the page under any other name.
      expect(print, id).not.toContain("gutter");
    }
  });

  it("appears in no screen render of a page either, because it is not on a page", () => {
    // The distinction worth drawing: `guides` and `ghost` are things the
    // renderer *can* draw and the print path declines to ask for. The fold is
    // not a thing a page has — it lives between two of them — so it is absent
    // from both renders of every page, and the only difference between the two
    // paths is still how an asset is addressed.
    const index = pageSequence(FIRST_BOOK).findIndex((p) => p.id === "page-002");
    const screen = renderPageSvg(
      pageTemplateFor(FIRST_BOOK, index, CHOSEN),
      pageFillFor(FIRST_BOOK, index, FIXTURE_BOOK_FILL),
      { href: assetUrl },
    );
    for (const mark of MARKS) expect(screen, mark).not.toContain(mark);
  });

  it("would notice a mark if one were there, so the checks above can fail", () => {
    expect(`<g class="${SPREAD_FOLD.crease}">`).toContain(SPREAD_FOLD.crease);
  });

  it("is not a word the renderer or the format knows", () => {
    // If the gutter ever became something a `PageTemplate` could declare, "no
    // fold in a print file" would be a property of the data — checked by a
    // validator somebody has to remember to keep — rather than of the code.
    for (const dir of [["lib", "render"], ["lib", "template"]]) {
      for (const file of sourceFiles(path.join(ROOT, ...dir))) {
        const source = readFileSync(file, "utf8");
        const where = path.relative(ROOT, file);
        for (const mark of MARKS) expect(source, `${where} names ${mark}`).not.toContain(mark);
        expect(source.toLowerCase(), `${where} names a gutter`).not.toContain("gutter");
      }
    }
  });

  it("is not reached from any module that could put one in a file", () => {
    // Read off disk rather than reasoned about, exactly as `test/ghost.test.ts`
    // reads it for the ghost, so a wiring mistake made next year fails here
    // instead of in a customer's book.
    const files = [
      "lib/render/svg.ts",
      "lib/render/raster.ts",
      "lib/render/pdf.ts",
      "lib/book/print.ts",
      "lib/book/artwork.ts",
      "lib/book/order-art.ts",
      "scripts/render-book.ts",
      "scripts/render-print.ts",
      "app/api/book/print/route.ts",
      "app/api/print/route.ts",
      "app/api/admin/print/[ref]/route.ts",
      "app/api/admin/pages/[ref]/route.ts",
      "app/api/admin/artwork/[ref]/route.ts",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      const imports = source.match(/^import[\s\S]*?from\s+"[^"]+";/gm) ?? [];
      for (const statement of imports) {
        expect(statement, `${file} imports the fold module`).not.toMatch(/\/fold"/);
      }
    }
  });

  it("is reached from exactly one component, and from no module at all", () => {
    // The preview is the only thing that mounts a fold. Specifiers are
    // **resolved** rather than matched as text, for the reason the ghost test
    // gives: `"./fold"` and `"../book/fold"` are the same module.
    const target = path.join(ROOT, "lib", "book", "fold.ts");
    const importers = ["app", "lib", "scripts", "templates"]
      .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
      .filter((file) =>
        (readFileSync(file, "utf8").match(/from\s+"(\.[^"]*)"/g) ?? []).some((statement) => {
          const spec = /from\s+"(\.[^"]*)"/.exec(statement)?.[1] ?? "";
          return path.resolve(path.dirname(file), `${spec}.ts`) === target;
        }),
      );
    expect(importers.map((f) => path.relative(ROOT, f)).sort()).toEqual([
      "app/_book/Preview.tsx",
    ]);
  });

  it("produces nothing but class names and a measurement, asked by reflection", () => {
    // The structural claim in `lib/book/fold.ts`, checked rather than read: a
    // module that cannot return a drawing cannot hand one to the renderer. A
    // function here is called with no arguments, which is enough to see what
    // kind of thing it makes.
    const seen = Object.entries(FOLD_MODULE);
    expect(seen.length).toBeGreaterThan(1);
    for (const [name, value] of seen) {
      const produced =
        typeof value === "function" ? (value as () => unknown)() : value;
      if (produced !== null && typeof produced === "object") {
        for (const [key, inner] of Object.entries(produced)) {
          expect(["string", "number"], `${name}.${key}`).toContain(typeof inner);
        }
        continue;
      }
      expect(["string", "number"], name).toContain(typeof produced);
    }
  });

  it("keeps the compiler's half of the proof on disk", () => {
    // `test/no-fold-in-a-print-file.ts` is a file of calls that must not
    // compile. `tsc` reports an unused `@ts-expect-error` as an error, so `npm
    // run lint` is the gate — but only while the directives are still there.
    const file = read("test", "no-fold-in-a-print-file.ts");
    expect(count(file, "@ts-expect-error")).toBeGreaterThanOrEqual(5);
    // The four doors it closes, each named in the file.
    expect(file).toContain("renderPrintSvg(MY_FOREVER, FIXTURE_FILL, { fold: SPREAD_FOLD })");
    expect(file).toContain("ghost: SPREAD_FOLD");
    expect(file).toContain("const layers: Layer[]");
    expect(file).toContain("asset: SPREAD_FOLD");
    // And it is not collected by the runner, which is why it may contain them.
    expect(read("vitest.config.mts")).not.toContain("no-fold-in-a-print-file");
  });
});

/** Every `.ts`/`.tsx` under a directory. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
