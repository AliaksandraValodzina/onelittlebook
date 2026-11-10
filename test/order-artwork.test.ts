/**
 * **One order's regenerated artwork: checked, versioned, and never in git.**
 *
 * The photo path's return leg. The captain has had an image tool replace the
 * child on the clean pages (`test/clean-artwork.test.ts` is the outward leg)
 * and uploads the result against one order. Three things have to be true and
 * each one is a way this goes wrong quietly:
 *
 * **It is held to the same contract the twelve pre-made looks are.** A page
 * that is 3599 px renders, a page with an alpha channel renders, and both look
 * perfectly fine in a browser — they are found on paper, by a customer, after
 * the money is spent. `docs/look-upload-contract.md` § 2 is the agreement and
 * `lib/book/upload.ts` § `pageAgainstContract` is the single implementation, so
 * these tests check that the per-order path *reuses* it rather than that it has
 * its own copy of the rules.
 *
 * **A re-upload is recoverable.** A character swap that looks right in a
 * thumbnail and wrong at 3600 px is discovered after the replacement is
 * uploaded, and an image model will not regenerate the earlier pages
 * identically. So every version stays readable.
 *
 * **It is never committed.** It is a picture of one family's child, this
 * repository is public, and git history is permanent. That is asserted against
 * `.gitignore` itself, because a gitignore line is a one-line thing to lose in
 * a merge and this is the one whose loss cannot be undone.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { checkOrderArtwork, pageForArtworkName } from "../lib/book/order-upload";
import {
  ARTWORK_DIR_VAR,
  DEFAULT_ARTWORK_DIR,
  artworkBytesFor,
  artworkStoreFromEnv,
  localArtworkStore,
  NotAnOrderReference,
} from "../lib/artwork/store";
import { artworkPageIds, bookWithOrderArtwork } from "../lib/book/order-art";
import { validateBook } from "../lib/book/validate";
import { printProblems } from "../lib/book/print";
import { pageSequence, pageTemplateFor, rightHandPages, spreadSideOf } from "../lib/book/derive";
import { renderPrintPng } from "../lib/render/raster";
import { hexAt, raster } from "./pixels";
import type { BookTemplate } from "../lib/book/types";

const REF = "BK-7QX4K2P";
const SIZE = FIRST_BOOK.page.print.pixels.width;

/**
 * A page of the right size and shape, in one flat colour.
 *
 * **Memoised**, because a 3600 x 3600 PNG costs about a second to encode and
 * these tests need a dozen of them. A suite that takes a minute to make its
 * fixtures is a suite somebody stops running.
 */
const made = new Map<string, Uint8Array>();
function page(
  colour: [number, number, number],
  options: { size?: number; alpha?: boolean; depth?: 8 | 16 } = {},
): Uint8Array {
  const size = options.size ?? SIZE;
  const key = `${colour.join(",")}-${size}-${options.alpha ?? false}-${options.depth ?? 8}`;
  const already = made.get(key);
  if (already) return already;
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < size * size; i++) {
    png.data[i * 4] = colour[0];
    png.data[i * 4 + 1] = colour[1];
    png.data[i * 4 + 2] = colour[2];
    png.data[i * 4 + 3] = 255;
  }
  const bytes = new Uint8Array(
    PNG.sync.write(png, {
      colorType: options.alpha ? 6 : 2,
      inputHasAlpha: true,
      bitDepth: options.depth ?? 8,
    }),
  );
  made.set(key, bytes);
  return bytes;
}

const temporary: string[] = [];
async function directory(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "olb-artwork-"));
  temporary.push(dir);
  return dir;
}
afterAll(async () => {
  for (const dir of temporary) await rm(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------

describe("the captain's own filenames", () => {
  it("maps spread-and-side onto the page the book says it is", () => {
    // Derived from `spreads()`, so this is a statement about the book rather
    // than about arithmetic somebody wrote down.
    for (const [index, page] of pageSequence(FIRST_BOOK).entries()) {
      const side = spreadSideOf(FIRST_BOOK, index);
      if (!side) continue;
      const name = `spread-${String(side.spread).padStart(2, "0")}-${side.side}.png`;
      expect(pageForArtworkName(FIRST_BOOK, name), name).toEqual({ index });
      expect(pageForArtworkName(FIRST_BOOK, `${page.id}.png`), page.id).toEqual({ index });
    }
  });

  it("takes the cover by name", () => {
    expect(pageForArtworkName(FIRST_BOOK, "cover.png")).toEqual({ index: 0 });
    expect(pageForArtworkName(FIRST_BOOK, "00-cover-clean.png")).toEqual({ index: 0 });
  });

  it("takes back the name the clean-artwork download handed over", () => {
    // The likeliest thing a person does with a file they were given is save
    // over it, so the name that went out has to be a name that comes back.
    const index = rightHandPages(FIRST_BOOK)[2];
    const side = spreadSideOf(FIRST_BOOK, index)!;
    const given =
      `${REF}-${String(index).padStart(2, "0")}-${pageSequence(FIRST_BOOK)[index].id}` +
      `-spread-${String(side.spread).padStart(2, "0")}-${side.side}-clean.png`;
    expect(pageForArtworkName(FIRST_BOOK, given)).toEqual({ index });
  });

  it("refuses a name it cannot place, rather than guessing", () => {
    for (const [name, code] of [
      ["final-FINAL.png", "artwork.nameUnrecognised"],
      ["page-006.jpg", "artwork.notPngName"],
      ["page-099.png", "artwork.pageUnknown"],
      ["spread-40-left.png", "artwork.spreadUnknown"],
    ] as const) {
      expect(pageForArtworkName(FIRST_BOOK, name), name).toMatchObject({ code });
    }
  });

  it("refuses a name whose two halves disagree", () => {
    // Half-renamed by hand. Guessing which half is right is how page nine ends
    // up where page six should be, in a book nobody looks at again.
    expect(pageForArtworkName(FIRST_BOOK, "page-006-spread-09-right.png")).toMatchObject({
      code: "artwork.nameAmbiguous",
    });
  });
});

describe("the upload, against the contract the looks are held to", () => {
  it("accepts a partial upload of the right-hand pages", () => {
    const files = rightHandPages(FIRST_BOOK).map((index) => ({
      name: `${pageSequence(FIRST_BOOK)[index].id}.png`,
      bytes: page([200, 40, 180]),
    }));
    const check = checkOrderArtwork(FIRST_BOOK, files);
    expect(check.problems).toEqual([]);
    expect(check.pages.map((p) => p.index)).toEqual(rightHandPages(FIRST_BOOK));
  });

  it("reports every problem in one pass rather than the first", () => {
    const check = checkOrderArtwork(FIRST_BOOK, [
      { name: "page-004.png", bytes: page([0, 0, 0], { size: SIZE - 1 }) },
      { name: "page-006.png", bytes: page([0, 0, 0], { alpha: true }) },
      { name: "page-008.png", bytes: new Uint8Array([1, 2, 3, 4]) },
      { name: "nonsense.png", bytes: page([0, 0, 0]) },
    ]);
    const codes = check.problems.map((p) => p.code).sort();
    expect(codes).toEqual([
      "artwork.nameUnrecognised",
      "page.hasAlpha",
      "page.notPng",
      "page.wrongSize",
    ]);
  });

  it("uses the same page rules as `npm run looks`, not a second copy of them", () => {
    // The codes are `page.*` — `lib/book/upload.ts`'s own, produced by
    // `pageAgainstContract`. A per-order path with its own rules would have its
    // own codes, and the one that was wrong would be the one nobody read.
    const wrong = checkOrderArtwork(FIRST_BOOK, [
      { name: "page-004.png", bytes: page([0, 0, 0], { size: 100 }) },
    ]);
    expect(wrong.problems[0].code.startsWith("page.")).toBe(true);
    expect(wrong.problems[0].detail).toContain(`${SIZE}`);
  });

  it("follows the book's declared page size rather than a constant", () => {
    const small: BookTemplate = {
      ...FIRST_BOOK,
      page: { ...FIRST_BOOK.page, print: { ...FIRST_BOOK.page.print, pixels: { width: 300, height: 300 } } },
    };
    const files = [{ name: "page-004.png", bytes: page([0, 0, 0], { size: 300 }) }];
    expect(checkOrderArtwork(small, files).problems).toEqual([]);
    // Paired: the same bytes against the real book are the wrong size, so the
    // assertion above is following the book and not accepting anything.
    expect(checkOrderArtwork(FIRST_BOOK, files).problems.map((p) => p.code)).toEqual([
      "page.wrongSize",
    ]);
  });

  it("refuses two files for one page, and refuses nothing at all", () => {
    const twice = checkOrderArtwork(FIRST_BOOK, [
      { name: "page-004.png", bytes: page([1, 1, 1]) },
      { name: "spread-02-right.png", bytes: page([2, 2, 2]) },
    ]);
    expect(twice.problems.map((p) => p.code)).toEqual(["artwork.duplicatePage"]);
    expect(checkOrderArtwork(FIRST_BOOK, []).problems.map((p) => p.code)).toEqual([
      "artwork.noFiles",
    ]);
  });
});

describe("the store, which is outside the repository", () => {
  it("adds a version and keeps the one before it", async () => {
    const store = localArtworkStore(await directory());
    const first = await store.put(
      REF,
      [{ pageId: "page-004", bytes: page([10, 20, 30]) }],
      new Date("2026-11-10T09:00:00Z"),
    );
    const second = await store.put(
      REF,
      [{ pageId: "page-004", bytes: page([200, 40, 180]) }],
      new Date("2026-11-10T10:00:00Z"),
    );
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect((await store.current(REF))?.version).toBe(2);

    // The whole point: the bad swap is discovered after the replacement, and
    // what was there before is still there.
    const back = await store.read(REF, 1, "page-004");
    expect(back).not.toBeNull();
    expect(back).toEqual(page([10, 20, 30]));
    expect((await store.versions(REF)).map((v) => v.version)).toEqual([1, 2]);
  });

  it("measures the pixels and the digest out of the bytes", async () => {
    const store = localArtworkStore(await directory());
    const bytes = page([5, 5, 5]);
    const version = await store.put(REF, [{ pageId: "cover", bytes }], new Date());
    const asset = version.pages[0].asset;
    expect(asset.px).toEqual([SIZE, SIZE]);
    expect(asset.mime).toBe("image/png");
    const supplied = await artworkBytesFor(store, REF, version);
    expect(supplied.get(asset.sha256)).toEqual(bytes);
  });

  it("refuses the artwork if a file has been swapped under its name", async () => {
    // `lib/orders/store.ts` § photoFor's rule, and the same mistake: a wrong
    // object under the right name would print the wrong child.
    const root = await directory();
    const store = localArtworkStore(root);
    const version = await store.put(REF, [{ pageId: "cover", bytes: page([5, 5, 5]) }], new Date());
    await writeFile(path.join(root, REF, "v0001", "cover.png"), page([9, 9, 9]));
    await expect(artworkBytesFor(store, REF, version)).rejects.toThrow(/does not match its digest/);
  });

  it("answers nothing for an order nobody has uploaded for", async () => {
    const store = localArtworkStore(await directory());
    expect(await store.versions(REF)).toEqual([]);
    expect(await store.current(REF)).toBeNull();
    expect(await store.read(REF, 1, "cover")).toBeNull();
  });

  it("checks the reference before it becomes a path segment", async () => {
    const store = localArtworkStore(await directory());
    for (const bad of ["../../etc", "", "orders/BK-ABCDEFG", "BK-ABC"]) {
      await expect(store.versions(bad), bad).rejects.toThrow(NotAnOrderReference);
    }
  });

  it("reads its directory from the environment and says where it is", () => {
    const configured = artworkStoreFromEnv({ [ARTWORK_DIR_VAR]: "/tmp/somewhere-else" });
    expect(configured.describe).toContain("/tmp/somewhere-else");
    const fallback = artworkStoreFromEnv({});
    expect(fallback.describe).toContain(DEFAULT_ARTWORK_DIR);
    // Never a credential, and there is none to leak: it is a directory.
    expect(fallback.describe).toContain("this machine only");
  });
});

describe("no customer's artwork can reach git", () => {
  const ignore = readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");

  it("excludes the directory the store writes to by default", () => {
    const rules = ignore
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    expect(rules).toContain(`${DEFAULT_ARTWORK_DIR}/`);
  });

  it("writes outside every directory this repository commits", () => {
    // `fixtures/assets/` holds the shop's *own* artwork — the same pictures for
    // every buyer — which is why that one can be committed. A regenerated child
    // is one order's private document and goes nowhere near it.
    for (const committed of ["fixtures", "data", "public", "templates"]) {
      expect(DEFAULT_ARTWORK_DIR.startsWith(committed)).toBe(false);
    }
  });
});

describe("the book an order prints from once its artwork is uploaded", () => {
  const index = rightHandPages(FIRST_BOOK)[1];
  const pageId = pageSequence(FIRST_BOOK)[index].id;
  const MAGENTA: [number, number, number] = [200, 40, 180];

  /** The same book at a size a test can afford to make a page of. */
  const SMALL: BookTemplate = {
    ...FIRST_BOOK,
    page: { ...FIRST_BOOK.page, print: { ...FIRST_BOOK.page.print, pixels: { width: 200, height: 200 } } },
  };

  async function uploaded() {
    const store = localArtworkStore(await directory());
    const version = await store.put(
      REF,
      [{ pageId, bytes: page(MAGENTA, { size: 200 }) }],
      new Date("2026-11-10T10:00:00Z"),
    );
    return { store, version };
  }

  it("is a book of one look and one cover, and it validates", async () => {
    const { version } = await uploaded();
    const book = bookWithOrderArtwork(SMALL, FIXTURE_BOOK_FILL, version);
    expect(book.looks.map((l) => l.id)).toEqual([FIXTURE_BOOK_FILL.lookId]);
    expect(book.covers.map((c) => c.id)).toEqual([FIXTURE_BOOK_FILL.coverId]);
    expect(book.genders).toBeUndefined();
    expect(validateBook(book)).toEqual([]);
    expect(printProblems(book, FIXTURE_BOOK_FILL)).toEqual([]);
  });

  it("keeps the published book's id and revision, so an order is not renamed", async () => {
    const { version } = await uploaded();
    const book = bookWithOrderArtwork(SMALL, FIXTURE_BOOK_FILL, version);
    expect(book.id).toBe(FIRST_BOOK.id);
    expect(book.rev).toBe(FIRST_BOOK.rev);
  });

  it("repaints the pages that were uploaded and no others", async () => {
    const { version } = await uploaded();
    const book = bookWithOrderArtwork(SMALL, FIXTURE_BOOK_FILL, version);
    expect(artworkPageIds(book, version)).toEqual([pageId]);
    for (const [at, p] of pageSequence(book).entries()) {
      expect(p.art.kind, p.id).toBe(at === index ? "asset" : "drawn");
    }
  });

  it("returns the book untouched when there is no artwork", () => {
    expect(bookWithOrderArtwork(SMALL, FIXTURE_BOOK_FILL, null)).toBe(SMALL);
  });

  it("draws the uploaded artwork, read back out of the print file's pixels", async () => {
    const { store, version } = await uploaded();
    const book = bookWithOrderArtwork(SMALL, FIXTURE_BOOK_FILL, version);
    const chosen = { lookId: FIXTURE_BOOK_FILL.lookId, coverId: FIXTURE_BOOK_FILL.coverId };
    const supplied = await artworkBytesFor(store, REF, version);

    const template = pageTemplateFor(book, index, chosen);
    const rendered = await renderPrintPng(template, { schema: 1, templateId: template.id, templateRev: template.rev, photos: {}, texts: {} }, supplied);
    const middle = raster(rendered.png, template);
    const at = hexAt(middle, template.canvas.width / 2, template.canvas.height / 2);
    expect(at.toLowerCase()).toBe("#c828b4");

    // The paired negative: the same page of the published book is not that
    // colour, so the assertion above is reading the upload and not a happy
    // coincidence of the placeholder's palette.
    const plain = pageTemplateFor(SMALL, index, chosen);
    const before = await renderPrintPng(plain, { schema: 1, templateId: plain.id, templateRev: plain.rev, photos: {}, texts: {} });
    expect(hexAt(raster(before.png, plain), plain.canvas.width / 2, plain.canvas.height / 2).toLowerCase()).not.toBe(
      "#c828b4",
    );
  });
});
