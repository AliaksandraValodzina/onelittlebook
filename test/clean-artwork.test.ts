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
 * declared trim is known to overstate the object and is revisitable on a
 * printed proof (`docs/print.md`), and a suite of hand-typed coordinates is a
 * suite that has to be rewritten the day it moves.
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
  isCover,
  pageCount,
  pageFillFor,
  pageSequence,
  pageTemplateFor,
  pagesCarryingTheChild,
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

const CHOSEN = { lookId: FIXTURE_BOOK_FILL.lookId };

/** The same book at a size a test can afford to render several of. */
function at(pixels: number): BookTemplate {
  return {
    ...FIRST_BOOK,
    page: { ...FIRST_BOOK.page, print: { ...FIRST_BOOK.page.print, pixels: { width: pixels, height: pixels } } },
  };
}

const SMALL = at(240);

/**
 * The slot a page actually sets the child's name in, and its box — asked of the
 * template **and of the fill**, never typed.
 *
 * On the cover that is the *title*'s slot: the name reaches the front of the
 * book inside the captain's "When {name} Turned One" rather than in a
 * `babyName` slot of its own. Asking which slot the fill puts the name into is
 * what makes this follow the name wherever the template puts it, which is the
 * whole point of a test about words not being painted into artwork.
 */
function nameBearingSlotOn(book: BookTemplate, index: number): TextSlotLayer {
  const fill = pageFillFor(book, index, FIXTURE_BOOK_FILL);
  const layer = pageTemplateFor(book, index, CHOSEN).layers.find(
    (l): l is TextSlotLayer =>
      l.kind === "textSlot" && (fill.texts?.[l.slot] ?? "").includes(FIXTURE_BOOK_FILL.name),
  );
  if (!layer) throw new Error(`page ${index} sets the child's name in no slot`);
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
  const slot = nameBearingSlotOn(FIRST_BOOK, COVER);
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

/**
 * **Which pages a character swap regenerates, asserted against the template.**
 *
 * This download defaulted to the twelve right-hand pages on the stated
 * assumption that the left halves were the same picture in every look. They are
 * not — a spread is one wide scene and the child's limbs cross the fold, which
 * `lib/book/artwork.ts` § Which pages a character swap has to touch measures —
 * and the consequence was a printed book with the buyer's child on one page of
 * a spread and the stock look's arm facing it.
 *
 * So the assertions below are deliberately two-sided: a left-hand page that
 * carries the child **is** in the set, and the pages of the babyless opening
 * spread are **not**. Either half alone would let the old bug back — "every
 * page" passes the first and "every right-hand page" passes the second — and
 * every number comes off the book.
 */
describe("which pages the download carries", () => {
  /** Both halves of the spread the book declares has no child in it. */
  const babyless = pageSequence(FIRST_BOOK).flatMap((page, index) =>
    page.childless ? [index] : [],
  );

  it("defaults to every page the child is on, counted off the book", () => {
    const swap = cleanArtworkPages(FIRST_BOOK, "swap");
    expect(swap).toEqual(pagesCarryingTheChild(FIRST_BOOK));
    // Every page of the book except the spread declared childless — derived at
    // both ends, so a book with a different number of spreads needs no edit
    // here either.
    expect(babyless.length).toBeGreaterThan(0);
    expect(swap.length).toBe(pageCount(FIRST_BOOK) - babyless.length);
    expect(swap).toEqual([...Array(pageCount(FIRST_BOOK)).keys()].filter((i) => !babyless.includes(i)));
  });

  it("includes the left-hand pages, which is the bug this set exists to fix", () => {
    const swap = cleanArtworkPages(FIRST_BOOK, "swap");
    const lefts = swap.filter((i) => spreadSideOf(FIRST_BOOK, i)?.side === "left");
    const rights = swap.filter((i) => spreadSideOf(FIRST_BOOK, i)?.side === "right");

    // One of each per spread that carries the child, and the two counts agree:
    // a spread is regenerated whole or not at all, because it is one picture.
    expect(lefts.length).toBe(rights.length);
    expect(rights.length).toBe(spreads(FIRST_BOOK).length - 1 - 1);
    // The arm the captain noticed is on spread four's left page, so name that
    // page by derivation and assert it specifically.
    const spreadFourLeft = spreads(FIRST_BOOK)[4][0];
    expect(spreadSideOf(FIRST_BOOK, spreadFourLeft)).toEqual({ spread: 4, side: "left" });
    expect(swap).toContain(spreadFourLeft);
    // The paired negative: this is exactly what the old default did not carry.
    expect(rightHandPages(FIRST_BOOK)).not.toContain(spreadFourLeft);
    expect(swap.length).toBeGreaterThan(rightHandPages(FIRST_BOOK).length);
  });

  it("excludes the babyless spread, and the cover is not it", () => {
    const swap = cleanArtworkPages(FIRST_BOOK, "swap");
    for (const index of babyless) {
      expect(swap, `${pageSequence(FIRST_BOOK)[index].id} has no child on it`).not.toContain(index);
    }
    // Both halves of it, not merely the half with the photograph on it: the
    // spread is one picture and regenerating half of one is the same bug.
    expect(babyless.map((i) => spreadSideOf(FIRST_BOOK, i)?.side)).toEqual(["left", "right"]);
    // The cover carries the child and is in the set — it is the page the old
    // twelve-page default also left out, and a stock child on the front of a
    // book whose inside has the buyer's is the same fault.
    expect(swap).toContain(0);
  });

  it("regenerates a spread whole when only one half of it is declared childless", () => {
    // A book nobody would author, which is the point: the two halves of one
    // scene disagreeing must resolve towards regenerating the picture, never
    // towards half of it.
    const half: BookTemplate = {
      ...FIRST_BOOK,
      pages: FIRST_BOOK.pages.map((page, at) => (at === 2 ? { ...page, childless: true } : page)),
    };
    const spread = spreads(half)[2];
    expect(spread).toContain(3);
    for (const index of spread) expect(pagesCarryingTheChild(half)).toContain(index);
  });

  it("offers the whole book as the other selection", () => {
    const everything = cleanArtworkPages(FIRST_BOOK, "everything");
    expect(everything.length).toBe(pageCount(FIRST_BOOK));
    expect(everything[0]).toBe(0);
    // The default nests inside it, which is what makes the two a choice rather
    // than two different lists.
    for (const index of cleanArtworkPages(FIRST_BOOK, "swap")) {
      expect(everything).toContain(index);
    }
  });

  it("reads only the two selections it offers", () => {
    expect(isCleanSelection("swap")).toBe(true);
    expect(isCleanSelection("everything")).toBe(true);
    // `right` and `all` were the old spellings and are gone: a saved URL asking
    // for the twelve right-hand pages must fall back to the correct set rather
    // than keep working.
    for (const bad of ["", "right", "all", "left", "SWAP", "1", null, undefined, 3]) {
      expect(isCleanSelection(bad), String(bad)).toBe(false);
    }
  });
});

describe("the archive the captain downloads", () => {
  it("holds one clean page per selected page, plus the note, named in reading order", async () => {
    const result = await renderCleanArtworkZip(SMALL, FIXTURE_BOOK_FILL, {
      which: "swap",
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
    const result = await renderCleanArtworkZip(SMALL, FIXTURE_BOOK_FILL, { which: "swap" });
    const first = cleanEntryName(SMALL, result.pages[0]);
    const bytes = readZipEntry(result.zip, first);
    expect(bytes).not.toBeNull();
    expect([...bytes!.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytes!.length).toBeGreaterThan(1000);
  });

  it("carries a note whose numbers come from the book rather than from a sentence", async () => {
    const note = async (book: BookTemplate) => {
      const result = await renderCleanArtworkZip(book, FIXTURE_BOOK_FILL, { which: "swap" });
      return new TextDecoder().decode(readZipEntry(result.zip, "HOW-TO-SEND-THESE-BACK.txt")!);
    };
    const small = await note(SMALL);
    expect(small).toContain("240 x 240");
    // Both spellings of a page that is in the download, named by derivation:
    // the first interior page the child is on, which is a **left** half.
    const first = pagesCarryingTheChild(SMALL).filter((i) => !isCover(i))[0];
    const side = spreadSideOf(SMALL, first)!;
    expect(side.side).toBe("left");
    expect(small).toContain(`${pageSequence(SMALL)[first].id}.png`);
    expect(small).toContain(`spread-0${side.spread}-left.png`);
    // And the opening spread, which the download leaves out, is not asked for.
    expect(small).not.toContain("spread-01-right.png");
    expect(small).not.toContain("page-002.png");
    // It says the rule, in the file the captain is holding when they are about
    // to put a page into an image tool.
    expect(small).toContain("Text must never make a round trip through an image model");

    // The paired negative: the size in the note is derived, so a book with a
    // different declared page size produces a different sentence. A hand-typed
    // "3600 x 3600" would pass the assertion above and keep passing the day
    // `docs/print.md`'s declared trim is ever corrected.
    const other = await note(at(300));
    expect(other).toContain("300 x 300");
    expect(other).not.toContain("240 x 240");
  });

  it("names the file for the order, the book revision and what is inside it", async () => {
    const result = await renderCleanArtworkZip(SMALL, FIXTURE_BOOK_FILL, {
      which: "everything",
      ref: "BK-7QX4K2P",
    });
    expect(result.filename).toContain("BK-7QX4K2P");
    expect(result.filename).toContain(FIRST_BOOK.rev);
    expect(result.filename).toContain("clean-everything");
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
    const result = await renderCleanArtworkZip(SMALL, overlong, { which: "swap" });
    expect(result.pages.length).toBe(pagesCarryingTheChild(SMALL).length);
  });
});
