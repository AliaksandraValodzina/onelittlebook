/**
 * **A ghost cannot reach a print file, and here is the proof.**
 *
 * On the photo path the buyer's child does not exist as artwork while they are
 * reading the book — the captain draws them by hand after the order — so the
 * pages the child is on hold their place with a soft white pearlescent glowing
 * silhouette and the caption `GHOST_CAPTION`. `lib/render/ghost.ts` carries the
 * argument for the treatment; `lib/book/ghost.ts` decides which pages get one.
 *
 * **A printed book with a glowing void where the child should be is the worst
 * failure this product has.** It is paid for, it is in a box, and it cannot be
 * undone. So the guarantee is not a flag anybody checks — it is the shape of
 * the code, and this file asserts the shape in four ways:
 *
 * **The print path cannot express a ghost.** `renderPrintSvg` takes a template,
 * a fill and the supplied bytes, and no options object — exactly as it takes no
 * `guides`. There is no argument to put one in.
 *
 * **No module on the print path imports a ghost module**, read off disk, so the
 * next person cannot wire one in by accident and find out in a customer's book.
 *
 * **Handing the print path the ghost *template* produces no ghost**, because
 * the ghost was never in the template. That closes the one hole a reader would
 * reasonably worry about.
 *
 * **And the paired positive**: with the option passed, the ghost really is
 * drawn, the look's own baby really is taken out from under it, and the
 * silhouette stands where that page's scene declares the child stands. Without
 * those, every absence above would be the absence of a feature that does not
 * work.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { GHOST_CAPTION } from "../lib/render/ghost";
import { ghostFor, ghostPreviewOf, pageCarriesTheChild } from "../lib/book/ghost";
import {
  lookOf,
  pageCount,
  pageFillFor,
  pageSequence,
  pageTemplateFor,
  rightHandPages,
} from "../lib/book/derive";
import { renderPageSvg } from "../lib/render/svg";
import { renderPrintSvg } from "../lib/render/raster";
import { assetUrl } from "../lib/assets/resolve";

const CHOSEN = { lookId: FIXTURE_BOOK_FILL.lookId, coverId: FIXTURE_BOOK_FILL.coverId };

/** The ghost's own marks in the output. One string each, so a test is specific. */
const PEARL = 'id="ghost-pearl"';
const HALO = 'id="ghost-halo"';

function previewSvg(index: number): string {
  const page = ghostPreviewOf(FIRST_BOOK, index, CHOSEN);
  return renderPageSvg(page.template, pageFillFor(FIRST_BOOK, index, FIXTURE_BOOK_FILL), {
    href: assetUrl,
    ...(page.ghost ? { ghost: page.ghost } : {}),
  });
}

function ordinarySvg(index: number): string {
  return renderPageSvg(
    pageTemplateFor(FIRST_BOOK, index, CHOSEN),
    pageFillFor(FIRST_BOOK, index, FIXTURE_BOOK_FILL),
    { href: assetUrl },
  );
}

describe("the ghost is drawn, which is what makes its absence elsewhere meaningful", () => {
  const page = rightHandPages(FIRST_BOOK)[3];

  it("puts the caption and the glow on a page the child is on", () => {
    const svg = previewSvg(page);
    expect(svg).toContain(GHOST_CAPTION);
    expect(svg).toContain(PEARL);
    expect(svg).toContain(HALO);
  });

  it("takes the look's own baby out from under it", () => {
    // Otherwise the placeholder for a child who does not exist yet would have
    // another child showing through it, which is the one thing the white glow
    // was chosen over a felt figure to avoid.
    const skin = lookOf(FIRST_BOOK, CHOSEN.lookId).baby!.skin;
    expect(previewSvg(page)).not.toContain(skin);
    // Paired: the ordinary render of that page does draw that look's baby.
    expect(ordinarySvg(page)).toContain(skin);
  });

  it("stands where the page says the child stands, not in the middle of every page", () => {
    // Page twenty-four declares its own `babyAt`, lower on the page than the
    // default, because the scenes alternate to keep the figure out of the
    // gutter. A ghost pinned to one spot would walk straight into it.
    const closing = pageSequence(FIRST_BOOK).findIndex((p) => p.id === "page-024");
    const declared = ghostFor(FIRST_BOOK, closing)!;
    const plain = ghostFor(FIRST_BOOK, page)!;
    expect(declared.at.y).not.toBe(plain.at.y);

    // The head circle's centre, read out of the markup, is the declared
    // fraction of the canvas — derived from the book, never typed.
    const head = /<circle cx="([\d.]+)" cy="([\d.]+)"/.exec(
      previewSvg(closing).slice(previewSvg(closing).indexOf(PEARL)),
    );
    expect(head).not.toBeNull();
    expect(Number(head![1])).toBeCloseTo(FIRST_BOOK.page.canvas.width * declared.at.x, 0);
  });
});

describe("which pages hold a place", () => {
  it("never one the book declares babyless, and the opening spread is two of them", () => {
    const babyless = pageSequence(FIRST_BOOK)
      .map((page, index) => ({ page, index }))
      .filter(({ page }) => page.art.kind === "drawn" && page.art.scene.babyless === true);
    // The control: this book really does have babyless pages — the opening
    // spread, which is the one spread identical across every look.
    expect(babyless.length).toBeGreaterThanOrEqual(2);
    for (const { index, page } of babyless) {
      expect(ghostFor(FIRST_BOOK, index), page.id).toBeNull();
      expect(previewSvg(index)).not.toContain(GHOST_CAPTION);
    }
  });

  it("every other page of the drawn book, counted rather than listed", () => {
    const all = Array.from({ length: pageCount(FIRST_BOOK) }, (_, i) => i);
    const withGhost = all.filter((i) => pageCarriesTheChild(FIRST_BOOK, i));
    const babyless = all.filter((i) => {
      const page = pageSequence(FIRST_BOOK)[i];
      return page.art.kind === "drawn" && page.art.scene.babyless === true;
    });
    expect(withGhost.length).toBe(all.length - babyless.length);
    for (const index of withGhost) expect(previewSvg(index)).toContain(GHOST_CAPTION);
  });

  it("the right-hand pages and the cover once the artwork is uploaded", () => {
    // An uploaded page is an opaque PNG and declares nothing about who is on
    // it, so the answer comes from the shape of the captain's artwork instead:
    // one 2.000:1 scene a spread, with the child on the right-hand half.
    const uploaded = {
      ...FIRST_BOOK,
      cover: { ...FIRST_BOOK.cover, art: asset("cover") },
      pages: FIRST_BOOK.pages.map((p) => ({ ...p, art: asset(p.id) })),
    };
    const all = Array.from({ length: pageCount(uploaded) }, (_, i) => i);
    const withGhost = all.filter((i) => pageCarriesTheChild(uploaded, i));
    expect(withGhost).toEqual([0, ...rightHandPages(uploaded)]);
  });

  function asset(id: string) {
    return {
      kind: "asset" as const,
      byLook: {
        [CHOSEN.lookId]: {
          sha256: "0".repeat(64),
          mime: "image/png" as const,
          px: [FIRST_BOOK.page.print.pixels.width, FIRST_BOOK.page.print.pixels.height] as [
            number,
            number,
          ],
          label: id,
        },
      },
    };
  }
});

describe("the print path", () => {
  it("has no argument a ghost could be passed in", () => {
    // `renderPrintSvg(template, fill, supplied)` and nothing else. The word
    // does not appear in the module, which is the same structural guarantee
    // `guides` has and the reason this is an option rather than a layer kind.
    const source = readFileSync(path.join(process.cwd(), "lib", "render", "raster.ts"), "utf8");
    expect(source.toLowerCase()).not.toContain("ghost");
  });

  it("is not reached from any module that could make one", () => {
    // Read off disk rather than reasoned about, so a wiring mistake made next
    // year fails here instead of in a customer's book.
    const files = [
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
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      const imports = source.match(/^import[\s\S]*?from\s+"[^"]+";/gm) ?? [];
      for (const statement of imports) {
        expect(statement, `${file} imports a ghost module`).not.toMatch(/\/ghost"/);
      }
    }
  });

  it("is reached from exactly one module that can draw one", () => {
    // `lib/render/svg.ts` is the one renderer and the one door. A second
    // importer of `ghostOverlay` would be a second place a ghost could be put
    // on a page, which is the thing being made impossible. Specifiers are
    // **resolved** rather than matched as text, because `"./ghost"` and
    // `"../render/ghost"` are the same module and a regular expression for one
    // of them is a check that quietly stops looking.
    const target = path.join(process.cwd(), "lib", "render", "ghost.ts");
    const importers = sourceFiles()
      // Tests import it by name on purpose — this one does. The rule being
      // asserted is about what the *shipped* code can reach.
      .filter((file) => !file.startsWith(path.join(process.cwd(), "test")))
      .filter((file) =>
        (readFileSync(file, "utf8").match(/from\s+"(\.[^"]*)"/g) ?? []).some((statement) => {
          const spec = /from\s+"(\.[^"]*)"/.exec(statement)?.[1] ?? "";
          return path.resolve(path.dirname(file), `${spec}.ts`) === target;
        }),
      );
    expect(importers.map((f) => path.relative(process.cwd(), f)).sort()).toEqual([
      "lib/book/ghost.ts",
      "lib/render/svg.ts",
    ]);
  });

  it("draws no ghost even when handed the ghost's own template", () => {
    // The hole a reader would reasonably worry about: the preview modifies the
    // page template as well as passing the option, so what if that template
    // reached the press? It is an ordinary babyless page, which is an ordinary
    // page of this format. The ghost was never in it.
    const index = rightHandPages(FIRST_BOOK)[3];
    const page = ghostPreviewOf(FIRST_BOOK, index, CHOSEN);
    return renderPrintSvg(page.template, pageFillFor(FIRST_BOOK, index, FIXTURE_BOOK_FILL)).then(
      (print) => {
        expect(print).not.toContain(GHOST_CAPTION);
        expect(print).not.toContain(PEARL);
        expect(print).not.toContain(HALO);
      },
    );
  });

  it("draws no ghost on any page of the book, on either path", async () => {
    for (let index = 0; index < pageCount(FIRST_BOOK); index++) {
      const fill = pageFillFor(FIRST_BOOK, index, FIXTURE_BOOK_FILL);
      const print = await renderPrintSvg(pageTemplateFor(FIRST_BOOK, index, CHOSEN), fill);
      expect(print, pageSequence(FIRST_BOOK)[index].id).not.toContain(GHOST_CAPTION);
      expect(print, pageSequence(FIRST_BOOK)[index].id).not.toContain(PEARL);
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

describe("the affordance that turns it on", () => {
  /**
   * `/preview?character=photograph`, read off the route's own source for
   * `test/shop-flow.test.tsx`'s reason: these are server components behind a
   * cookie, the suite has no DOM, and what is being asserted is the wiring.
   *
   * It is a query parameter and **not a step of the flow**, which is why
   * `app/_make/HowScreen.tsx` still says plainly that the photograph route is
   * not here — `test/shop-flow.test.tsx` asserts that sentence and it is still
   * true. What this task built is the rendering, the clean-artwork download and
   * the per-order artwork upload behind that route.
   */
  const read = (...parts: string[]) =>
    readFileSync(path.join(process.cwd(), ...parts), "utf8");

  it("is read from the query string by the preview route", () => {
    const route = read("app", "preview", "page.tsx");
    expect(route).toContain('character === "photograph"');
    expect(route).toContain("photoPath={photoPath}");
  });

  it("reaches every page of the preview", () => {
    expect(read("app", "_book", "Preview.tsx")).toContain("photoPath={photoPath}");
    expect(read("app", "_book", "BookPage.tsx")).toContain("ghostPreviewOf");
  });

  it("leaves the flow's own honest refusal alone", () => {
    // The funnel does not sell this route, and a card that looked pressable
    // would be the pretend-success path `lib/checkout.ts` refuses to have.
    const how = read("app", "_make", "HowScreen.tsx");
    expect(how).toContain("Not yet");
    expect(how).toContain("still being made");
  });
});
