/**
 * **The contact sheets, with every look delivered — which is the state the
 * command had never been run in.**
 *
 * `npm run cover-faces` draws the cover title's candidate faces on the
 * captain's own covers so the face can be chosen by looking at it. On
 * 19 November, against the captain's real store, it wrote **nothing**: an
 * empty `full/`, an empty `look/`, no sheets, and `336 problem(s):
 * art.wrongSize` three hundred and thirty-six times.
 *
 * The number is the shape of the bug. **336 is fourteen looks by twenty-four
 * interior pages** — every delivered page of every delivered look at once —
 * and it arrived because the sheets are drawn small. `atRenderWidth` rewrites
 * `page.print.pixels` to make a 560 px picture affordable, that field is *the
 * book's declared print size*, and `renderBookPagePng` gates on
 * `printProblems`, which holds every look's artwork to it. So a book that
 * validates perfectly at its own 3600 px became three hundred and thirty-six
 * refusals at 560, against a declaration that existed only inside the script.
 *
 * **The two sizes were never in disagreement**, which is why nothing declared
 * moves here: the book declares 3600 × 3600 (`templates/first-book.ts`
 * § `print`), `npm run artwork:upload` holds the captain's pages to the same
 * number, and the pages are 3600 × 3600. The 560 was the script's own
 * measuring device leaking into a product declaration.
 *
 * **Why three looks passed and fourteen did not**, which is the half that let
 * this reach the captain as done: the cover page is measured against the
 * printed front panel as a **floor** (`lib/book/validate.ts` § the cover is a
 * different object), so it is immune to the rescale. Only *interior* pages are
 * held to an equality. A store with covers and no interior pages therefore has
 * nothing to refuse — and that is exactly what a worker with no credentials
 * for the artwork store sees. Any check that runs against a partly-filled
 * store will keep missing this, so every fixture below is **fourteen looks of
 * interior pages**.
 *
 * Nothing here reads the captain's folders. The artwork is minted in the test,
 * which is `test/release-artwork.test.ts`'s rule and the only honest way to
 * test an artwork path in a repository that must contain no artwork — and the
 * interior refs carry no bytes at all, because `art.wrongSize` is read off
 * `AssetRef.px` and not off a file.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { emptyReleaseArtwork, type ReleaseArtwork } from "../lib/artwork/release";
import { bookWithReleaseArtwork } from "../lib/book/release-art";
import { pageFillFor, pageSequence, pageTemplateFor } from "../lib/book/derive";
import { renderPrintPng } from "../lib/render/raster";
import { BookNotPrintable, printProblems, problemReport } from "../lib/book/print";
import { validateBook } from "../lib/book/validate";
import { atRenderWidth, coverPngAt, coverTitleIn, coverTitleSlot } from "../lib/book/title-fit";
import { frontPanelPxOf, SOFTCOVER_COVER_WRAP } from "../lib/print/printify";
import { FACES } from "../lib/render/fonts";
import { changedBox, raster } from "./pixels";
import type { BookTemplate } from "../lib/book/types";
import type { AssetRef } from "../lib/template/types";

/** Every number here is the book's or the panel's. None is typed twice. */
const DECLARED = FIRST_BOOK.page.print.pixels.width;
const PANEL = frontPanelPxOf(SOFTCOVER_COVER_WRAP).width;
const LOOKS = FIRST_BOOK.looks.length;
const INTERIOR = pageSequence(FIRST_BOOK).filter((p) => p.id !== FIRST_BOOK.cover.id);
const TITLE = coverTitleSlot(FIRST_BOOK);

/** The width the sheets are drawn at — the one the command actually asks for. */
const SHEET_PX = 560;

/** A digest-shaped hash of a name. No bytes: nothing below renders an interior page. */
function ref(key: string, px: number): AssetRef {
  return { sha256: createHash("sha256").update(key).digest("hex"), mime: "image/png", px: [px, px] };
}

/**
 * The captain's store as it actually is: every look, every interior page.
 *
 * `cover` decides whether the looks also carry the display cover cut out of
 * their wrap. It is a separate argument because the cover is the page the
 * rescale could never break, so the two halves of the fixture have to be
 * movable independently or the test cannot tell them apart.
 */
function deliveredBook(options: { pagePx?: number; cover?: boolean } = {}): BookTemplate {
  const pagePx = options.pagePx ?? DECLARED;
  const art: ReleaseArtwork = emptyReleaseArtwork("minted in test/cover-faces.test.ts");
  for (const look of FIRST_BOOK.looks) {
    art.pages[look.id] = {};
    for (const page of INTERIOR) {
      art.pages[look.id][page.id] = ref(`${look.id}/${page.id}`, pagePx);
    }
    if (options.cover) {
      art.pages[look.id][FIRST_BOOK.cover.id] = ref(`${look.id}/cover`, PANEL);
    }
  }
  return bookWithReleaseArtwork(FIRST_BOOK, art);
}

// ---------------------------------------------------------------------------
// The fixture is the thing three looks could not be
// ---------------------------------------------------------------------------

describe("the fourteen-look store the command had never been run against", () => {
  it("is every look, and the book the shop serves out of it is clean", () => {
    const book = deliveredBook({ cover: true });
    expect(book.looks.length).toBe(LOOKS);
    for (const page of pageSequence(book)) {
      expect(page.art.kind, page.id).toBe("asset");
      // With every look delivered the placeholder fallback is gone — which is
      // `lib/book/release-art.ts`'s rule and what makes this the full state
      // rather than a partial import wearing its clothes.
      expect(page.art.kind === "asset" ? page.art.scene : undefined, page.id).toBeUndefined();
    }
    expect(validateBook(book)).toEqual([]);
    expect(printProblems(book, FIXTURE_BOOK_FILL)).toEqual([]);
  });

  it("refuses an interior page that really is the wrong size, so the gate still has teeth", () => {
    // The pair for every assertion below: the declaration is not being
    // loosened, and a 3000 px page is still three hundred and thirty-six
    // refusals at the book's own size.
    const wrong = printProblems(deliveredBook({ pagePx: 3000, cover: true }), FIXTURE_BOOK_FILL);
    expect(wrong.map((p) => p.code)).toEqual(Array(LOOKS * INTERIOR.length).fill("art.wrongSize"));
    expect(wrong.length).toBe(336);
  });

  it("reproduces the 19 November failure exactly: the rescale is what refused it", () => {
    // The bug, written down as the thing it was. `atRenderWidth` is a render
    // size; `printProblems` reads it as the declared print size.
    const book = deliveredBook({ cover: true });
    const refused = printProblems(atRenderWidth(book, SHEET_PX), FIXTURE_BOOK_FILL);
    expect(refused.length).toBe(LOOKS * INTERIOR.length);
    expect([...new Set(refused.map((p) => p.code))]).toEqual(["art.wrongSize"]);
    // And the cover is not among them, which is why a covers-only store passed.
    expect(refused.some((p) => p.where.endsWith(FIRST_BOOK.cover.id))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The fix: the gate is the book's, the width is the picture's
// ---------------------------------------------------------------------------

describe("the cover as a picture, at a width the sheets can afford", () => {
  /**
   * The cover left **drawn** here, deliberately: a delivered cover would be an
   * `AssetRef` whose bytes this repository is not allowed to contain, and the
   * three hundred and thirty-six refusals were never about the cover anyway.
   * The interior pages are all fourteen looks' worth, which is the half that
   * did the refusing.
   */
  const book = deliveredBook();

  it("draws it, with every look delivered and at the sheet's own width", async () => {
    const png = await coverPngAt(book, FIXTURE_BOOK_FILL, SHEET_PX);
    const read = PNG.sync.read(Buffer.from(png));
    expect(read.width).toBe(SHEET_PX);
    expect(read.height).toBe(SHEET_PX);
  }, 60_000);

  it("has the title's ink on it, which is the only reason the sheet exists", async () => {
    // The pairing `test/pixels.ts` asks for: the same cover with the title slot
    // taken out, so this cannot pass against a renderer that drew nothing.
    //
    // The bare half is rendered **past** `coverPngAt`, because a cover with
    // authored words and no `storyText` slot to set them in is a book the gate
    // rightly refuses (`page.storyGoesNowhere`) — which is itself the gate
    // proving it is still there. The half under test is the gated one.
    const sized = atRenderWidth(book, SHEET_PX);
    const bare: BookTemplate = {
      ...sized,
      cover: { ...sized.cover, layers: (sized.cover.layers ?? []).filter((l) => l.id !== TITLE.id) },
    };
    const chosen = { lookId: FIXTURE_BOOK_FILL.lookId };
    const [withTitle, without] = await Promise.all([
      coverPngAt(book, FIXTURE_BOOK_FILL, SHEET_PX),
      renderPrintPng(
        pageTemplateFor(bare, 0, chosen),
        pageFillFor(bare, 0, FIXTURE_BOOK_FILL),
      ).then((r) => r.png),
    ]);
    const template = pageTemplateFor(sized, 0, chosen);
    const ink = changedBox(raster(withTitle, template), raster(without, template));
    expect(ink).not.toBeNull();
    // Inside the corner the captain marked, in the template's own units.
    expect(ink!.x).toBeGreaterThanOrEqual(TITLE.frame.x - 2);
    expect(ink!.width).toBeLessThanOrEqual(TITLE.frame.width + 2);
  }, 120_000);

  it("draws every candidate face, which is what the sheet is a sheet of", async () => {
    for (const key of Object.keys(FACES)) {
      const png = await coverPngAt(coverTitleIn(book, key), FIXTURE_BOOK_FILL, SHEET_PX);
      expect(PNG.sync.read(Buffer.from(png)).width, key).toBe(SHEET_PX);
    }
  }, 300_000);

  it("still refuses a book the print path refuses, and refuses it at the declared size", async () => {
    await expect(
      coverPngAt(deliveredBook({ pagePx: 3000 }), FIXTURE_BOOK_FILL, SHEET_PX),
    ).rejects.toThrow(BookNotPrintable);
    const thrown = await coverPngAt(deliveredBook({ pagePx: 3000 }), FIXTURE_BOOK_FILL, SHEET_PX)
      .then(() => null)
      .catch((e: unknown) => (e instanceof BookNotPrintable ? e : null));
    expect(thrown).not.toBeNull();
    // The numbers it names are the book's own, not the width that was asked for.
    expect(thrown!.message).toContain(`${DECLARED}×${DECLARED}`);
    expect(thrown!.message).not.toContain(`${SHEET_PX}×${SHEET_PX}`);
  });
});

// ---------------------------------------------------------------------------
// A failure that says what to do
// ---------------------------------------------------------------------------

describe("the refusal names the look, the page and the numbers", () => {
  const problems = printProblems(deliveredBook({ pagePx: 3000, cover: true }), FIXTURE_BOOK_FILL);

  it("tallies the codes once instead of printing one of them 336 times", () => {
    const report = problemReport(problems);
    expect(report.split("\n")[0]).toBe(`336 problem(s): art.wrongSize ×336`);
    // The old message was the code repeated per problem. Three hundred and
    // thirty-six of anything on one line is a line nobody reads.
    expect(report.split("art.wrongSize").length - 1).toBeLessThan(10);
  });

  it("names a look, a page and both sizes in full", () => {
    const report = problemReport(problems);
    expect(report).toContain(FIRST_BOOK.looks[0].id);
    expect(report).toContain(`${FIRST_BOOK.id}/${INTERIOR[0].id}`);
    expect(report).toContain(`3000×3000`);
    expect(report).toContain(`${DECLARED}×${DECLARED}`);
    expect(report).toContain(`…and ${problems.length - 4} more`);
  });

  it("is what BookNotPrintable says, so a script that prints the message says it too", () => {
    expect(new BookNotPrintable(problems).message).toBe(problemReport(problems));
  });

  it("says plainly that nothing was written, and no longer asks the print path for a small picture", () => {
    // Read off disk, for `test/spread-fold.test.ts`'s reason: the sentence a
    // reader needs is a property of the command's own bytes, and the command
    // cannot be imported without running it.
    const source = readFileSync("scripts/cover-faces.ts", "utf8");
    expect(source).toContain("NOTHING WAS WRITTEN");
    expect(source).toContain("npm run artwork -- status");
    // The gate runs before the directories, which is what makes the sentence
    // true: an empty `full/` and an empty `look/` is how this was read as done.
    expect(source.indexOf("refusalsIn(delivered")).toBeLessThan(source.indexOf('mkdir(path.join(out, "full")'));
    // And the picture no longer comes from the print path's own entry point:
    // the import is gone, which is the only form of "does not call it" a file
    // read can actually assert.
    expect(source).toMatch(/import \{[^}]*coverPngAt/);
    expect(source).not.toMatch(/import \{[^}]*renderBookPagePng/);
  });
});
