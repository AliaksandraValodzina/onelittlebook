/**
 * **The clean artwork provably carries no rendered text.**
 *
 * `lib/book/artwork.ts` opens with why this matters and it is the one rule of
 * the photo path: **text never makes a round trip through an image model.** A
 * model asked to swap the character on a page redraws the lettering too, and
 * what comes back is a garbled near-word in a handwritten face — the captain's
 * own earlier artwork survey found roughly twenty-five pieces in exactly that
 * state. A printed book with a mangled name on the cover is unsellable and
 * nobody notices it in a thumbnail.
 *
 * "Provably" means two things here, and the second is the one that earns its
 * place:
 *
 * **Nothing in the markup can draw a word.** The derived page carries no text
 * slot and no photo slot at all, so there is no `<text>` element in the SVG and
 * no dashed photo placeholder either.
 *
 * **And the pixels agree.** The same page is rasterised twice — once the
 * ordinary way and once clean — and the ink of the name is counted inside the
 * name slot's own box. The ordinary render has ink there and the clean one has
 * none. That is `test/pixels.ts`'s standard: *a test that would pass if the
 * renderer drew nothing is not a test*, so every absence asserted here is
 * paired with the same assertion against the render that does carry it.
 *
 * The numbers are derived throughout — the box out of the template's own slot,
 * the colour off the slot, the page count out of `spreads()` — because the
 * trim is still an open question (`docs/print.md`) and a suite of hand-typed
 * coordinates is a suite that has to be rewritten the day it is answered.
 */

import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { SLOT } from "../lib/book/slots";
import {
  cleanArtworkFill,
  cleanArtworkPages,
  cleanArtworkTemplate,
  cleanEntryName,
  isCleanSelection,
  renderCleanArtworkPng,
  renderCleanArtworkZip,
} from "../lib/book/artwork";
import {
  pageCount,
  pageFillFor,
  pageSequence,
  pageTemplateFor,
  rightHandPages,
  spreadSideOf,
  spreads,
} from "../lib/book/derive";
import { BookNotPrintable } from "../lib/book/print";
import { renderPageSvg } from "../lib/render/svg";
import { renderPrintPng } from "../lib/render/raster";
import { assetUrl } from "../lib/assets/resolve";
import { readZipEntry, readZipListing } from "../lib/zip";
import { raster, shareOf } from "./pixels";
import type { BookTemplate } from "../lib/book/types";
import type { Box, TextSlotLayer } from "../lib/template/types";

const CHOSEN = { lookId: FIXTURE_BOOK_FILL.lookId, coverId: FIXTURE_BOOK_FILL.coverId };

/** The same book at a size a test can afford to render several of. */
function at(pixels: number): BookTemplate {
  return {
    ...FIRST_BOOK,
    page: { ...FIRST_BOOK.page, print: { ...FIRST_BOOK.page.print, pixels: { width: pixels, height: pixels } } },
  };
}

const SMALL = at(240);

/** The name slot on the cover, and its box — asked of the template, never typed. */
function nameSlotOn(book: BookTemplate, index: number): TextSlotLayer {
  const layer = pageTemplateFor(book, index, CHOSEN).layers.find(
    (l): l is TextSlotLayer => l.kind === "textSlot" && l.slot === SLOT.name,
  );
  if (!layer) throw new Error(`page ${index} carries no ${SLOT.name} slot to assert about`);
  return layer;
}

describe("the clean artwork has no words on it", () => {
  it("draws no text element on any page of the book", () => {
    let withText = 0;
    for (let index = 0; index < pageCount(FIRST_BOOK); index++) {
      const clean = renderPageSvg(
        cleanArtworkTemplate(FIRST_BOOK, index, FIXTURE_BOOK_FILL),
        cleanArtworkFill(FIRST_BOOK, index),
        { href: assetUrl },
      );
      expect(clean, `${pageSequence(FIRST_BOOK)[index].id} carries a text element`).not.toContain(
        "<text",
      );

      const ordinary = renderPageSvg(
        pageTemplateFor(FIRST_BOOK, index, CHOSEN),
        pageFillFor(FIRST_BOOK, index, FIXTURE_BOOK_FILL),
        { href: assetUrl },
      );
      if (ordinary.includes("<text")) withText++;
    }
    // The control. If the ordinary render of this book had no words on it
    // either, every assertion above would be vacuous.
    expect(withText).toBeGreaterThan(10);
  });

  it("carries none of the buyer's words anywhere in the markup", () => {
    const index = 0;
    const clean = renderPageSvg(
      cleanArtworkTemplate(FIRST_BOOK, index, FIXTURE_BOOK_FILL),
      cleanArtworkFill(FIRST_BOOK, index),
      { href: assetUrl },
    );
    expect(clean).not.toContain(FIXTURE_BOOK_FILL.name);
    const ordinary = renderPageSvg(
      pageTemplateFor(FIRST_BOOK, index, CHOSEN),
      pageFillFor(FIRST_BOOK, index, FIXTURE_BOOK_FILL),
      { href: assetUrl },
    );
    // Paired: the cover really does carry the child's name, which is the whole
    // reason the ordinary download must not go into an image model.
    expect(ordinary).toContain(FIXTURE_BOOK_FILL.name);
  });

  it("leaves no empty photo window either, which would print a dashed box", () => {
    const photoPage = pageSequence(FIRST_BOOK).findIndex((p) =>
      (p.layers ?? []).some((l) => l.kind === "photoSlot"),
    );
    expect(photoPage).toBeGreaterThan(0);
    const clean = renderPageSvg(
      cleanArtworkTemplate(FIRST_BOOK, photoPage, FIXTURE_BOOK_FILL),
      cleanArtworkFill(FIRST_BOOK, photoPage),
      { href: assetUrl },
    );
    expect(clean).not.toContain("stroke-dasharray");
    // Paired: an ordinary render of that page with no photograph in the fill
    // does draw the dashed hint.
    const empty = renderPageSvg(
      pageTemplateFor(FIRST_BOOK, photoPage, CHOSEN),
      { ...pageFillFor(FIRST_BOOK, photoPage, FIXTURE_BOOK_FILL), photos: {} },
      { href: assetUrl },
    );
    expect(empty).toContain("stroke-dasharray");
  });

  it("still draws the artwork, so it is not simply an empty page", () => {
    const clean = renderPageSvg(
      cleanArtworkTemplate(FIRST_BOOK, 4, FIXTURE_BOOK_FILL),
      cleanArtworkFill(FIRST_BOOK, 4),
      { href: assetUrl },
    );
    const ordinary = renderPageSvg(
      pageTemplateFor(FIRST_BOOK, 4, CHOSEN),
      pageFillFor(FIRST_BOOK, 4, FIXTURE_BOOK_FILL),
      { href: assetUrl },
    );
    // Page four carries no slot at all, so taking the slots off changes
    // nothing: the clean file and the finished file are the same picture.
    expect(clean).toBe(ordinary);
  });
});

describe("the pixels of the clean cover", () => {
  const COVER = 0;
  const slot = nameSlotOn(FIRST_BOOK, COVER);
  const box = slot.frame as Box;
  const book = at(600);

  it("has no ink of the name in the name's own box, where the ordinary render does", async () => {
    const ordinary = await renderPrintPng(
      pageTemplateFor(book, COVER, CHOSEN),
      pageFillFor(book, COVER, FIXTURE_BOOK_FILL),
    );
    const clean = await renderCleanArtworkPng(book, COVER, FIXTURE_BOOK_FILL);

    const inkOrdinary = shareOf(raster(ordinary.png, pageTemplateFor(book, COVER, CHOSEN)), box, slot.colour, 60);
    const inkClean = shareOf(
      raster(clean.png, cleanArtworkTemplate(book, COVER, FIXTURE_BOOK_FILL)),
      box,
      slot.colour,
      60,
    );

    // The paired positive first: the name really is set in that box, in that
    // colour, by the ordinary render.
    expect(inkOrdinary).toBeGreaterThan(0.01);
    // And the clean render has none of it. Not "less of it".
    expect(inkClean).toBe(0);
  });

  it("is the declared print size, read back out of the bytes", async () => {
    const clean = await renderCleanArtworkPng(SMALL, 0, FIXTURE_BOOK_FILL);
    expect(clean.pixels).toEqual(SMALL.page.print.pixels);
  });
});

describe("which pages the download carries", () => {
  it("defaults to one page per spread — the right-hand half, counted not typed", () => {
    const right = cleanArtworkPages(FIRST_BOOK, "right");
    expect(right).toEqual(rightHandPages(FIRST_BOOK));
    // One per spread, with the cover's own group of one excluded.
    expect(right.length).toBe(spreads(FIRST_BOOK).length - 1);
    // Every one of them really is the second page of a spread.
    for (const index of right) {
      expect(spreadSideOf(FIRST_BOOK, index)?.side).toBe("right");
    }
    // And none of them is a left-hand page, which is what makes the default a
    // saving rather than a different arbitrary list.
    expect(right.some((i) => spreadSideOf(FIRST_BOOK, i)?.side === "left")).toBe(false);
  });

  it("offers every interior page, and those plus the cover", () => {
    expect(cleanArtworkPages(FIRST_BOOK, "all").length).toBe(FIRST_BOOK.pages.length);
    expect(cleanArtworkPages(FIRST_BOOK, "all")).not.toContain(0);
    expect(cleanArtworkPages(FIRST_BOOK, "everything").length).toBe(pageCount(FIRST_BOOK));
    expect(cleanArtworkPages(FIRST_BOOK, "everything")[0]).toBe(0);
  });

  it("reads only the three selections it offers", () => {
    expect(isCleanSelection("right")).toBe(true);
    expect(isCleanSelection("all")).toBe(true);
    expect(isCleanSelection("everything")).toBe(true);
    for (const bad of ["", "left", "RIGHT", "1", null, undefined, 3]) {
      expect(isCleanSelection(bad), String(bad)).toBe(false);
    }
  });
});

describe("the archive the captain downloads", () => {
  it("holds one clean page per selected page, plus the note, named in reading order", async () => {
    const result = await renderCleanArtworkZip(SMALL, FIXTURE_BOOK_FILL, {
      which: "right",
      ref: "BK-7QX4K2P",
    });
    const names = readZipListing(result.zip).map((e) => e.name);
    expect(names.length).toBe(result.pages.length + 1);

    for (const index of result.pages) {
      expect(names).toContain(cleanEntryName(SMALL, index, "BK-7QX4K2P"));
    }
    // Numbered so they sort into reading order in every tool that will touch
    // them, which a page id alone does not do.
    const pages = names.filter((n) => n.endsWith("-clean.png"));
    expect([...pages].sort()).toEqual(pages);
    // Every entry says which order it belongs to, so a page on a desk beside
    // another order's page is not a guess.
    for (const name of names) expect(name.startsWith("BK-7QX4K2P-")).toBe(true);
  });

  it("holds real PNGs and not empty files", async () => {
    const result = await renderCleanArtworkZip(SMALL, FIXTURE_BOOK_FILL, { which: "right" });
    const first = cleanEntryName(SMALL, result.pages[0]);
    const bytes = readZipEntry(result.zip, first);
    expect(bytes).not.toBeNull();
    expect([...bytes!.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytes!.length).toBeGreaterThan(1000);
  });

  it("carries a note whose numbers come from the book rather than from a sentence", async () => {
    const note = async (book: BookTemplate) => {
      const result = await renderCleanArtworkZip(book, FIXTURE_BOOK_FILL, { which: "right" });
      return new TextDecoder().decode(readZipEntry(result.zip, "HOW-TO-SEND-THESE-BACK.txt")!);
    };
    const small = await note(SMALL);
    expect(small).toContain("240 x 240");
    expect(small).toContain("page-002.png");
    expect(small).toContain("spread-01-right.png");
    // It says the rule, in the file the captain is holding when they are about
    // to put a page into an image tool.
    expect(small).toContain("Text must never make a round trip through an image model");

    // The paired negative: the size in the note is derived, so a book with a
    // different declared page size produces a different sentence. A hand-typed
    // "3600 x 3600" would pass the assertion above and keep passing the day
    // `docs/print.md`'s open question is answered.
    const other = await note(at(300));
    expect(other).toContain("300 x 300");
    expect(other).not.toContain("240 x 240");
  });

  it("names the file for the order, the book revision and what is inside it", async () => {
    const result = await renderCleanArtworkZip(SMALL, FIXTURE_BOOK_FILL, {
      which: "all",
      ref: "BK-7QX4K2P",
    });
    expect(result.filename).toContain("BK-7QX4K2P");
    expect(result.filename).toContain(FIRST_BOOK.rev);
    expect(result.filename).toContain("clean-all");
    expect(result.filename).toContain(`${result.pages.length}pages`);
    expect(result.filename).toContain("240x240");
  });

  it("refuses when the book's own artwork is incomplete, because the file would be empty", async () => {
    const broken: BookTemplate = { ...SMALL, looks: [] };
    await expect(renderCleanArtworkZip(broken, FIXTURE_BOOK_FILL)).rejects.toThrow(BookNotPrintable);
  });

  it("does not refuse for something the buyer typed, which is what it is for", async () => {
    // An order with an over-long dedication cannot print, and the clean
    // artwork is exactly what the captain needs in order to deal with it. The
    // file carries nothing the buyer typed, so refusing it would be the wrong
    // way round.
    const overlong = { ...FIXTURE_BOOK_FILL, dedication: "x".repeat(5000) };
    const result = await renderCleanArtworkZip(SMALL, overlong, { which: "right" });
    expect(result.pages.length).toBe(rightHandPages(SMALL).length);
  });
});
