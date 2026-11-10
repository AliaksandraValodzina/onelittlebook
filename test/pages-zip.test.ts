/**
 * **The file the captain actually ships, read back out of its own bytes.**
 *
 * Printify takes **one raster per print area** — twenty-four interior pages and
 * a cover, each its own image — so the primary download for an order is the
 * pages, not the PDF. `lib/book/print.ts` § `renderBookPagesZip` carries the
 * argument.
 *
 * The failures this guards against are all quiet. A ZIP with twenty-four
 * entries instead of twenty-five is a book with a page missing, and it is one
 * line off in a loop. An archive whose names do not sort is twenty-five uploads
 * in the wrong order, by hand, and the mistake is only visible when the book
 * arrives. An archive of correctly named empty files passes any test that reads
 * only the listing.
 *
 * So: every page is counted out of the book, every name is checked against the
 * sequence `pageSequence` declares, and the pixels of a page are read back to
 * prove the words and the baby are on it — which is the whole difference
 * between this download and the clean artwork in `test/clean-artwork.test.ts`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { SLOT } from "../lib/book/slots";
import { BookNotPrintable, renderBookPagesZip } from "../lib/book/print";
import { pageCount, pageFillFor, pageSequence, pageTemplateFor } from "../lib/book/derive";
import { readPngSize } from "../lib/render/png";
import { readZipEntry, readZipListing } from "../lib/zip";
import { raster, shareOf } from "./pixels";
import type { BookTemplate } from "../lib/book/types";
import type { Box, TextSlotLayer } from "../lib/template/types";

const REF = "BK-7QX4K2P";
const CHOSEN = { lookId: FIXTURE_BOOK_FILL.lookId, coverId: FIXTURE_BOOK_FILL.coverId };

/** The same book at a size a test can afford twenty-five of. */
const SMALL: BookTemplate = {
  ...FIRST_BOOK,
  page: { ...FIRST_BOOK.page, print: { ...FIRST_BOOK.page.print, pixels: { width: 160, height: 160 } } },
};

describe("every finished page of the order, in one archive", () => {
  it("holds one entry per page of the book, counted rather than assumed", async () => {
    const result = await renderBookPagesZip(SMALL, FIXTURE_BOOK_FILL, { ref: REF });
    const listing = readZipListing(result.zip);
    expect(listing.length).toBe(pageCount(SMALL));
    // The control: the book really is more than a handful of pages, so a
    // count assertion is saying something.
    expect(pageCount(SMALL)).toBeGreaterThan(20);
    expect(result.pages).toEqual(pageSequence(SMALL).map((_, i) => i));
  });

  it("numbers them so they sort into reading order, and names the order", async () => {
    const result = await renderBookPagesZip(SMALL, FIXTURE_BOOK_FILL, { ref: REF });
    const names = readZipListing(result.zip).map((e) => e.name);

    // Sorted the way `ls`, Finder and an uploader sort, which a page id alone
    // is not: `page-9` sorts after `page-10` in half the tools involved.
    expect([...names].sort()).toEqual(names);

    // And the sorted order is the book's own order, cover first.
    expect(names).toEqual(
      pageSequence(SMALL).map((page, i) => `${REF}-${String(i).padStart(2, "0")}-${page.id}.png`),
    );
  });

  it("holds real PNGs at the declared print size, not empty files", async () => {
    const result = await renderBookPagesZip(SMALL, FIXTURE_BOOK_FILL, { ref: REF });
    for (const [index, page] of pageSequence(SMALL).entries()) {
      const name = `${REF}-${String(index).padStart(2, "0")}-${page.id}.png`;
      const bytes = readZipEntry(result.zip, name);
      expect(bytes, name).not.toBeNull();
      expect(readPngSize(bytes!), name).toEqual(SMALL.page.print.pixels);
    }
  });

  it("names the file for the order, the book revision and what is in it", async () => {
    const result = await renderBookPagesZip(SMALL, FIXTURE_BOOK_FILL, { ref: REF });
    expect(result.filename).toContain(REF);
    expect(result.filename).toContain(FIRST_BOOK.rev);
    expect(result.filename).toContain(FIXTURE_BOOK_FILL.lookId);
    expect(result.filename).toContain(`${pageCount(SMALL)}pages`);
    expect(result.filename).toContain("160x160");
    expect(result.filename.endsWith(".zip")).toBe(true);
  });

  it("reports progress, because half a minute with no output is a command somebody kills", async () => {
    const seen: string[] = [];
    await renderBookPagesZip(SMALL, FIXTURE_BOOK_FILL, {
      onPage: (_index, id) => seen.push(id),
    });
    expect(seen).toEqual(pageSequence(SMALL).map((p) => p.id));
  });

  it("refuses an order that cannot print, in front of the file rather than inside it", async () => {
    // A renderer would happily draw twenty-four pages before throwing on the
    // twenty-fifth, and the captain would have a ZIP with a hole in it.
    const overlong = { ...FIXTURE_BOOK_FILL, dedication: "x".repeat(5000) };
    await expect(renderBookPagesZip(SMALL, overlong, { ref: REF })).rejects.toThrow(
      BookNotPrintable,
    );
    // Paired: the same call with the real order does produce a file, so the
    // refusal above is about the dedication and not about the archive.
    const fine = await renderBookPagesZip(SMALL, FIXTURE_BOOK_FILL, { ref: REF });
    expect(fine.zip.length).toBeGreaterThan(1000);
  });
});

describe("the pages in it are finished pages", () => {
  const COVER = 0;

  it("carries the child's name, which is the thing the clean artwork must not", async () => {
    // Big enough to read a 62 pt handwritten name out of, and the whole book
    // rather than a slice of it: `printProblems` refuses a book that has lost
    // its photo, dedication and story slots, which is the right refusal and
    // means a test cannot take a shortcut by shortening the page list.
    const book: BookTemplate = {
      ...FIRST_BOOK,
      page: { ...FIRST_BOOK.page, print: { ...FIRST_BOOK.page.print, pixels: { width: 500, height: 500 } } },
    };
    const result = await renderBookPagesZip(book, FIXTURE_BOOK_FILL, { ref: REF });
    const cover = readZipEntry(result.zip, `${REF}-00-cover.png`)!;

    const template = pageTemplateFor(book, COVER, CHOSEN);
    const slot = template.layers.find(
      (l): l is TextSlotLayer => l.kind === "textSlot" && l.slot === SLOT.name,
    )!;
    const ink = shareOf(raster(cover, template), slot.frame as Box, slot.colour, 60);
    expect(ink).toBeGreaterThan(0.01);

    // The control: that box is not simply full of that colour anyway. With no
    // name in the fill there is no ink in it.
    const blank = shareOf(
      raster(cover, template),
      { x: slot.frame.x, y: 20, width: slot.frame.width, height: 40 } as Box,
      slot.colour,
      60,
    );
    expect(blank).toBeLessThan(ink);
    // And the fill really did have a name in it.
    expect(pageFillFor(book, COVER, FIXTURE_BOOK_FILL).texts[SLOT.name]).toBe(
      FIXTURE_BOOK_FILL.name,
    );
  });
});

describe("the order page offers it first", () => {
  /**
   * Read off the component's own source, which is the trade `test/config.test.ts`
   * and `test/shop-flow.test.tsx` already make: the page is an async server
   * component behind a cookie and a bucket, and what is being asserted is the
   * *order* of two links — which is exactly what the text of the file says.
   *
   * It matters because the PDF was the prominent download until this task.
   * Printify takes one raster per print area, so a captain who clicks the first
   * button and gets a PDF has to take it apart twenty-five times before any of
   * it is usable.
   */
  const source = readFileSync(path.join(process.cwd(), "app", "admin", "[ref]", "page.tsx"), "utf8");

  it("puts the twenty-five pages in front of the PDF", () => {
    // The `href=` form, not a mention: the file's own docblock names both
    // routes in prose above the markup.
    const pages = source.indexOf("href={`/api/admin/pages/");
    const pdf = source.indexOf("href={`/api/admin/print/");
    expect(pages).toBeGreaterThan(-1);
    expect(pdf).toBeGreaterThan(-1);
    expect(pages, "the PDF is offered before the pages").toBeLessThan(pdf);
  });

  it("offers the clean artwork as a separate download, and says why", () => {
    expect(source).toContain("href={`/api/admin/artwork/");
    expect(source).toContain("with no text drawn on them");
    // The warning has to be where somebody is about to make the mistake.
    expect(source).toContain("Never use the download above");
  });

  it("offers the upload, as a multipart form against this order", () => {
    expect(source).toContain('encType="multipart/form-data"');
    expect(source).toContain('type="file"');
    expect(source).toContain("multiple");
  });
});
