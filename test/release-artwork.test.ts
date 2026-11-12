/**
 * **The captain's artwork: bound when it is there, placeholder when it is
 * not — and never in git.**
 *
 * Three sets were delivered on 10 November (`docs/artwork.md`) and every one of
 * them arrives through `lib/artwork/release.ts`, which keeps the pixels out of
 * this repository. That makes **both** states real states, and this file
 * asserts both because each one is how the other goes wrong:
 *
 * **Artwork absent** is a fresh clone, CI, and anybody who has not run the
 * import. The published book has to draw itself from numbers there, exactly as
 * it always has — a shop that needed two gigabytes before it would render a
 * page is a shop nobody can work on. The binding returns the book *identically*
 * in that state, which is a stronger statement than "it still works".
 *
 * **Artwork present** is the captain's machine and, one day, a bucket. The real
 * pages have to reach the print file, the portraits have to reach the chooser,
 * and the golden halves have to reach the photo path's preview **and nothing
 * else**.
 *
 * Nothing here reads the captain's folders: every picture is minted in the
 * test, which is `test/order-reprint.test.ts`'s rule and the only honest way to
 * test an artwork path in a repository that must contain no artwork.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { localArtworkStore, type ArtworkStore } from "../lib/artwork/store";
import {
  DEFAULT_RELEASE_ARTWORK_DIR,
  GHOSTS_SET,
  RELEASE_ARTWORK_DIR_VAR,
  TILES_SET,
  anyReleaseArtwork,
  asPreviewAsset,
  bookAsDelivered,
  forgetReleaseArtwork,
  isReleaseSet,
  lookSet,
  releaseArtworkFor,
  tilePageId,
} from "../lib/artwork/release";
import { bookWithReleaseArtwork, showcaseLook } from "../lib/book/release-art";
import { bookWithOrderArtwork } from "../lib/book/order-art";
import {
  flattenOntoWhite,
  portraitAgainstContract,
  portraitMapping,
  rightHalfOf,
} from "../lib/artwork/import";
import { pageAgainstContract } from "../lib/book/upload";
import { ghostFor, ghostPreviewOf, pageCarriesTheChild } from "../lib/book/ghost";
import { GHOST_CAPTION } from "../lib/render/ghost";
import { lookOf, pageFillFor, pageSequence, pageTemplateFor } from "../lib/book/derive";
import { validateBook } from "../lib/book/validate";
import { printProblems } from "../lib/book/print";
import { renderPrintPng, renderPrintSvg } from "../lib/render/raster";
import { renderPageSvg } from "../lib/render/svg";
import { hasAlphaChannel, readPngHeader } from "../lib/render/png";
import { sha256 } from "../lib/assets/digest";
import { hexAt, isColour, raster, shareOf } from "./pixels";
import type { BookTemplate } from "../lib/book/types";

const SIZE = FIRST_BOOK.page.print.pixels.width;

/** The look the captain delivered first, named the way the book names it. */
const DELIVERED = "girl-02";
/** A look that is still being drawn, for the paired half of every assertion. */
const UNDELIVERED = "girl-01";

const temporary: string[] = [];
async function directory(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "olb-release-"));
  temporary.push(dir);
  return dir;
}
afterAll(async () => {
  for (const dir of temporary) await rm(dir, { recursive: true, force: true });
  delete process.env[RELEASE_ARTWORK_DIR_VAR];
  forgetReleaseArtwork();
});

beforeEach(() => {
  // The index is memoised per process, and every one of these tests writes to a
  // different directory.
  forgetReleaseArtwork();
});

/**
 * A square picture in one flat colour, with an optional soft alpha.
 *
 * **Memoised**, because a 3600 px PNG costs about a second to encode —
 * `test/order-artwork.test.ts` says the same thing for the same reason.
 */
const made = new Map<string, Uint8Array>();
function square(
  colour: [number, number, number],
  options: { size?: number; alpha?: number; width?: number; right?: [number, number, number] } = {},
): Uint8Array {
  const height = options.size ?? SIZE;
  const width = options.width ?? height;
  const key = `${colour.join(",")}-${width}x${height}-${options.alpha ?? 255}-${options.right?.join(",") ?? ""}`;
  const already = made.get(key);
  if (already) return already;
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const use = options.right && x >= width / 2 ? options.right : colour;
      png.data[at] = use[0];
      png.data[at + 1] = use[1];
      png.data[at + 2] = use[2];
      png.data[at + 3] = options.alpha ?? 255;
    }
  }
  const bytes = new Uint8Array(
    PNG.sync.write(png, { colorType: options.alpha === undefined ? 2 : 6, inputHasAlpha: true, bitDepth: 8 }),
  );
  made.set(key, bytes);
  return bytes;
}

/** A store rooted in a fresh directory, and the environment pointed at it. */
async function store(): Promise<ArtworkStore> {
  const root = await directory();
  process.env[RELEASE_ARTWORK_DIR_VAR] = root;
  forgetReleaseArtwork();
  return localArtworkStore(root, isReleaseSet);
}

const NOW = new Date("2026-11-10T09:00:00.000Z");

// ---------------------------------------------------------------------------
// Artwork absent: the fresh clone, and the state this repository ships in
// ---------------------------------------------------------------------------

describe("with no artwork on the machine", () => {
  it("the published book declares none, so a clone draws every page from numbers", () => {
    // The control for everything below: this is what is *committed*, and it is
    // a complete book. A page that declared an uploaded image here would be a
    // page naming bytes a fresh clone does not have.
    for (const page of pageSequence(FIRST_BOOK)) {
      expect(page.art.kind, page.id).toBe("drawn");
      expect(page.ghost, page.id).toBeUndefined();
    }
    for (const look of FIRST_BOOK.looks) {
      expect(look.tile, look.id).toBeUndefined();
      expect(look.baby, look.id).toBeDefined();
    }
  });

  it("binds nothing, and returns the very same object", async () => {
    const art = await releaseArtworkFor(FIRST_BOOK, await store());
    expect(anyReleaseArtwork(art)).toBe(false);
    // `toBe`, not `toEqual`: the binding is a no-op rather than a copy, so
    // nothing downstream can be looking at a book that merely resembles the
    // published one.
    expect(bookWithReleaseArtwork(FIRST_BOOK, art)).toBe(FIRST_BOOK);
    expect(await bookAsDelivered(FIRST_BOOK, await store())).toBe(FIRST_BOOK);
  });

  it("still prints a real page, with the chosen look's baby drawn on it", async () => {
    const index = pageSequence(FIRST_BOOK).findIndex((p) => p.id === "page-004");
    const whole = {
      x: 0,
      y: 0,
      width: FIRST_BOOK.page.canvas.width,
      height: FIRST_BOOK.page.canvas.height,
    };
    const share = async (lookId: string, of: string) => {
      const template = pageTemplateFor(FIRST_BOOK, index, {
        lookId,
        coverId: FIXTURE_BOOK_FILL.coverId,
      });
      expect(template.layers[0].kind).toBe("art");
      const png = await renderPrintPng(template, pageFillFor(FIRST_BOOK, index, FIXTURE_BOOK_FILL));
      return shareOf(raster(png.png, template), whole, lookOf(FIRST_BOOK, of).baby!.skin);
    };

    // The baby really is on the page, in this look's own skin — and the paired
    // negative is the same page drawn with another look, where that skin does
    // not appear at all. Without the pair this would pass against a renderer
    // that drew nothing, since "a colour is absent" is the easiest thing in
    // the world to be true.
    expect(await share(UNDELIVERED, UNDELIVERED)).toBeGreaterThan(0.01);
    // Two hundred times less, rather than zero: a rendered edge is antialiased
    // and a handful of pixels on the way from one colour to another will land
    // on any colour you name.
    expect(await share("girl-05", UNDELIVERED)).toBeLessThan(0.0001);
  });

  it("gives the chooser a tile anyway, drawn from the book", () => {
    // The fallback is not a legacy path: it is the tile for every look nobody
    // has delivered a portrait for, which today is most of them.
    expect(showcaseLook(FIRST_BOOK).id).toBe(FIRST_BOOK.looks[0].id);
  });
});

// ---------------------------------------------------------------------------
// Artwork present: one look, every portrait, the golden halves
// ---------------------------------------------------------------------------

describe("with the first look imported", () => {
  const PAGE = "page-004";
  const COLOUR: [number, number, number] = [16, 92, 180];

  async function delivered(): Promise<{ book: BookTemplate; digest: string }> {
    const art = await store();
    const bytes = square(COLOUR);
    await art.put(lookSet(DELIVERED), [{ pageId: PAGE, bytes }], NOW);
    return { book: await bookAsDelivered(FIRST_BOOK, art), digest: sha256(bytes) };
  }

  it("puts the real page under the look that has it and leaves the rest drawn", async () => {
    const { book, digest } = await delivered();
    const index = pageSequence(book).findIndex((p) => p.id === PAGE);
    const chosen = { coverId: FIXTURE_BOOK_FILL.coverId };

    const real = pageTemplateFor(book, index, { ...chosen, lookId: DELIVERED });
    expect(real.layers[0].kind).toBe("image");
    expect(real.layers[0].kind === "image" ? real.layers[0].asset.sha256 : "").toBe(digest);

    // **The partial state, which is the whole point**: eleven looks are still
    // being drawn, so the same page for one of them is the placeholder rather
    // than a refusal or a blank.
    const other = pageTemplateFor(book, index, { ...chosen, lookId: UNDELIVERED });
    expect(other.layers[0].kind).toBe("art");

    // A page nobody delivered — the cover, which has no artwork at all yet — is
    // untouched for every look.
    expect(pageTemplateFor(book, 0, { ...chosen, lookId: DELIVERED }).layers[0].kind).toBe("art");

    expect(validateBook(book)).toEqual([]);
    expect(showcaseLook(book).id).toBe(DELIVERED);
  });

  it("prints that page from the captain's pixels, through the ordinary print path", async () => {
    const { book } = await delivered();
    const index = pageSequence(book).findIndex((p) => p.id === PAGE);
    const fill = { ...FIXTURE_BOOK_FILL, lookId: DELIVERED };
    const template = pageTemplateFor(book, index, { lookId: DELIVERED, coverId: fill.coverId });

    // No `supplied` map: the bytes are found by `loadAsset`, which means the
    // artwork store is reachable from the real print path and not only from a
    // test's own hand.
    const png = await renderPrintPng(template, pageFillFor(book, index, fill));
    const r = raster(png.png, template);
    const want = `#${COLOUR.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    const hex = hexAt(r, FIRST_BOOK.page.canvas.width / 2, FIRST_BOOK.page.canvas.height / 2);
    expect(isColour(hex, want), `${hex} should be the imported page's own ${want}`).toBe(true);

    // Paired: the same page for a look with no artwork is **not** that colour,
    // so the assertion above is about the import and not about blue.
    const drawn = pageTemplateFor(book, index, { lookId: UNDELIVERED, coverId: fill.coverId });
    const other = raster(
      (await renderPrintPng(drawn, pageFillFor(book, index, { ...fill, lookId: UNDELIVERED }))).png,
      drawn,
    );
    expect(
      isColour(hexAt(other, FIRST_BOOK.page.canvas.width / 2, FIRST_BOOK.page.canvas.height / 2), want),
    ).toBe(false);
  });

  it("still refuses what it refused before", async () => {
    const { book } = await delivered();
    // The binding changes which pixels are underneath and nothing else: the
    // dedication limit, the name the press cannot write and the photograph too
    // small to print are all still checked, on the bound book.
    const tooLong = { ...FIXTURE_BOOK_FILL, lookId: DELIVERED, dedication: "word ".repeat(400) };
    expect(printProblems(book, tooLong).map((p) => p.code)).toContain("fill.textTooLong");
    expect(printProblems(book, { ...FIXTURE_BOOK_FILL, lookId: DELIVERED })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The portraits
// ---------------------------------------------------------------------------

describe("the portraits", () => {
  const white = () => square([255, 255, 255], { size: 8 });

  /** `01-girl.png` … `NN-boy.png` for exactly the looks this book declares. */
  function everyPortraitName(book: BookTemplate = FIRST_BOOK) {
    return (book.genders ?? []).flatMap((gender) =>
      book.looks
        .filter((l) => l.gender === gender.id)
        .map((_, at) => ({
          name: `${String(at + 1).padStart(2, "0")}-${gender.id}.png`,
          bytes: white(),
        })),
    );
  }

  it("accepts the captain's whole folder, counted off the book and not typed", () => {
    // This is `npm run artwork -- portraits <dir>` with the names the captain's
    // folder actually holds — derived from the book, so the day a look is added
    // this test asks for one more file instead of going stale.
    const files = everyPortraitName();
    const mapped = portraitMapping(FIRST_BOOK, files);
    expect(mapped.problems).toEqual([]);
    expect(mapped.portraits).toHaveLength(FIRST_BOOK.looks.length);

    // The paired negative, which is what makes the line above mean something:
    // one more file than the book has looks is refused rather than dropped.
    expect(
      portraitMapping(FIRST_BOOK, [
        ...files,
        { name: `${String(FIRST_BOOK.looks.length).padStart(2, "0")}-girl.png`, bytes: white() },
      ]).problems.map((p) => p.code),
    ).toEqual(["portrait.noLookForNumber"]);
  });

  it("maps the captain's numbering onto the look ids, by number within a gender", () => {
    const names = ["01-girl", "02-girl", "03-girl", "01-boy", "02-boy"].map((n) => ({
      name: `${n}.png`,
      bytes: white(),
    }));
    const mapped = portraitMapping(FIRST_BOOK, names);
    expect(mapped.problems).toEqual([]);

    // Derived from the book's own list rather than typed out, so this follows a
    // look that is renamed or reordered. `docs/artwork.md` is the same table
    // written down for a human.
    const girls = FIRST_BOOK.looks.filter((l) => l.gender === "girl");
    const boys = FIRST_BOOK.looks.filter((l) => l.gender === "boy");
    expect(mapped.portraits.map((p) => p.lookId)).toEqual([
      girls[0].id,
      girls[1].id,
      girls[2].id,
      boys[0].id,
      boys[1].id,
    ]);
    // The one the captain named: the auburn curly girl is `02-girl`, and the
    // look whose pages they delivered first is the one it maps to.
    expect(mapped.portraits[1].lookId).toBe(DELIVERED);
  });

  it("reads the number and not the position, so a folder of one lands in the right place", () => {
    // The hazard this replaced: indexing by position made a folder holding only
    // `05-girl.png` the *first* girl look, silently, and the buyer who chose
    // the first girl got the fifth baby. Nothing about one file says which look
    // it is except its number.
    const fifth = portraitMapping(FIRST_BOOK, [{ name: "05-girl.png", bytes: white() }]);
    expect(fifth.problems).toEqual([]);
    const girls = FIRST_BOOK.looks.filter((l) => l.gender === "girl");
    expect(fifth.portraits[0].lookId).toBe(girls[4].id);
    expect(fifth.portraits[0].lookId).not.toBe(girls[0].id);
  });

  it("refuses a name, a gender and a number it cannot place", () => {
    const bytes = square([255, 255, 255], { size: 8 });
    expect(
      portraitMapping(FIRST_BOOK, [{ name: "baby.png", bytes }]).problems.map((p) => p.code),
    ).toEqual(["portrait.nameUnrecognised"]);
    expect(
      portraitMapping(FIRST_BOOK, [{ name: "01-robot.png", bytes }]).problems.map((p) => p.code),
    ).toEqual(["portrait.genderUnknown"]);
    const girls = FIRST_BOOK.looks.filter((l) => l.gender === "girl").length;
    const tooMany = Array.from({ length: girls + 1 }, (_, i) => ({
      name: `${String(i + 1).padStart(2, "0")}-girl.png`,
      bytes,
    }));
    expect(portraitMapping(FIRST_BOOK, tooMany).problems.map((p) => p.code)).toEqual([
      "portrait.noLookForNumber",
    ]);
    // And the same number twice, which is a folder somebody copied a file into.
    expect(
      portraitMapping(FIRST_BOOK, [
        { name: "01-girl.png", bytes },
        { name: "01-girl copy.png", bytes },
      ]).problems.map((p) => p.code),
    ).toEqual(["portrait.duplicateNumber"]);
  });

  it("flattens onto white, because nothing in the delivered files is opaque", () => {
    // The measured defect: the subject sits at alpha 249–253 and the background
    // is transparent. Unflattened, the tile shows whatever is behind it — and a
    // page folder requires no alpha at all, so it could never pass the page
    // validator either.
    const soft = square([20, 40, 60], { size: 32, alpha: 250 });
    expect(hasAlphaChannel(readPngHeader(soft).colourType)).toBe(true);

    const flat = flattenOntoWhite(soft);
    const header = readPngHeader(flat);
    expect(hasAlphaChannel(header.colourType)).toBe(false);
    expect([header.width, header.height]).toEqual([32, 32]);
    expect(portraitAgainstContract({ name: "01-girl.png", bytes: flat }, "01-girl")).toEqual([]);

    // The colour is composited rather than merely stripped: 250/255 of the
    // subject over white, which is a measurably different number from both.
    const png = PNG.sync.read(Buffer.from(flat));
    const want = Math.round(20 * (250 / 255) + 255 * (1 - 250 / 255));
    expect(png.data[0]).toBe(want);
    expect(png.data[0]).not.toBe(20);

    // Fully transparent becomes white, which is what the background of every
    // one of them is.
    const clear = flattenOntoWhite(square([0, 0, 0], { size: 8, alpha: 0 }));
    expect([...PNG.sync.read(Buffer.from(clear)).data.slice(0, 3)]).toEqual([255, 255, 255]);
  });

  it("refuses a portrait that was not flattened, which is the whole point of doing it", () => {
    const soft = square([20, 40, 60], { size: 32, alpha: 250 });
    expect(
      portraitAgainstContract({ name: "01-girl.png", bytes: soft }, "01-girl").map((p) => p.code),
    ).toEqual(["portrait.hasAlpha"]);
  });

  it("becomes the chooser's tile for the look it belongs to, and only that one", async () => {
    const art = await store();
    const portrait = flattenOntoWhite(square([200, 120, 60], { size: 64, alpha: 250 }));
    await art.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes: portrait }], NOW);
    const book = await bookAsDelivered(FIRST_BOOK, art);

    const tile = lookOf(book, DELIVERED).tile;
    expect(tile?.sha256).toBe(sha256(portrait));
    expect(tile?.px).toEqual([64, 64]);
    expect(lookOf(book, UNDELIVERED).tile).toBeUndefined();
    expect(validateBook(book)).toEqual([]);

    // A portrait is **not** a page and must never be mistaken for one: it fails
    // the page contract on its size, which is the check that keeps a 64 px tile
    // out of a print file.
    expect(
      pageAgainstContract({ name: "tile.png", bytes: portrait }, "tile", SIZE).map((p) => p.code),
    ).toEqual(["page.wrongSize"]);
  });

  it("is refused when it is not square, because the chooser's box is", async () => {
    const art = await store();
    const wide = flattenOntoWhite(square([200, 120, 60], { size: 32, width: 64, alpha: 250 }));
    await art.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes: wide }], NOW);
    const book = await bookAsDelivered(FIRST_BOOK, art);
    expect(validateBook(book).map((p) => p.code)).toEqual(["tile.notSquare"]);
  });
});

// ---------------------------------------------------------------------------
// The golden ghost halves
// ---------------------------------------------------------------------------

describe("the golden ghost spreads", () => {
  const LEFT: [number, number, number] = [10, 20, 30];
  const RIGHT: [number, number, number] = [240, 190, 40];

  it("keeps the right half and discards the left", () => {
    const spread = square(LEFT, { size: 40, width: 80, right: RIGHT });
    const half = rightHalfOf(spread);
    const header = readPngHeader(half);
    expect([header.width, header.height]).toEqual([40, 40]);
    expect(hasAlphaChannel(header.colourType)).toBe(false);

    const png = PNG.sync.read(Buffer.from(half));
    expect([...png.data.slice(0, 3)]).toEqual(RIGHT);
    // Paired: the left half's colour is not in the result anywhere, which is
    // what "discards the left" means.
    for (let i = 0; i < png.data.length; i += 4) {
      expect(png.data[i]).not.toBe(LEFT[0]);
    }
  });

  it("cannot satisfy the page contract, by size and by type", async () => {
    const half = rightHalfOf(square(LEFT, { size: 887, width: 1774, right: RIGHT }));
    // Preview resolution is a quarter of a page's linear resolution. The page
    // contract refuses it with no new code at all.
    expect(
      pageAgainstContract({ name: "spread-02.png", bytes: half }, "spread-02", SIZE).map((p) => p.code),
    ).toEqual(["page.wrongSize"]);

    // And the type refuses it: a `PreviewAsset` carries `digest` where an
    // `AssetRef` carries `sha256`, so there is no assignment that puts one in
    // `PageArt.byLook`. `lib/book/preview-art.ts` carries the argument; this is
    // the runtime half of it.
    const preview = asPreviewAsset({ sha256: sha256(half), mime: "image/png", px: [887, 887] });
    expect(preview.kind).toBe("preview");
    expect("sha256" in preview).toBe(false);
  });

  it("is the photo path's artwork, and the renderer still draws the caption", async () => {
    const art = await store();
    const half = rightHalfOf(square(LEFT, { size: 40, width: 80, right: RIGHT }));
    const index = pageSequence(FIRST_BOOK).findIndex((p) => p.id === "page-004");
    await art.put(GHOSTS_SET, [{ pageId: "page-004", bytes: half }], NOW);
    const book = await bookAsDelivered(FIRST_BOOK, art);
    expect(validateBook(book)).toEqual([]);

    const preview = ghostPreviewOf(book, index, {
      lookId: DELIVERED,
      coverId: FIXTURE_BOOK_FILL.coverId,
    });
    // The golden half is the page's bottom layer, **under** the words — not
    // painted over them, which is what the drawn silhouette does.
    expect(preview.template.layers[0].kind).toBe("image");
    expect(preview.template.layers[0].kind === "image" ? preview.template.layers[0].asset.sha256 : "")
      .toBe(sha256(half));
    expect(preview.ghost?.figure).toBe("supplied");

    const svg = renderPageSvg(preview.template, pageFillFor(book, index, FIXTURE_BOOK_FILL), {
      href: (ref) => `/api/assets/${ref.sha256}.png`,
      ...(preview.ghost ? { ghost: preview.ghost } : {}),
    });
    expect(svg).toContain(GHOST_CAPTION);
    // The drawn silhouette is **not** also there: two placeholders for one
    // child is the thing `GhostOptions.figure` exists to prevent.
    expect(svg).not.toContain('id="ghost-pearl"');

    // Paired: a page with no delivered half still gets the drawn silhouette, so
    // the absence above is a choice rather than a broken ghost.
    const other = pageSequence(FIRST_BOOK).findIndex((p) => p.id === "page-006");
    const drawn = ghostPreviewOf(book, other, {
      lookId: DELIVERED,
      coverId: FIXTURE_BOOK_FILL.coverId,
    });
    expect(drawn.ghost?.figure).toBeUndefined();
    const drawnSvg = renderPageSvg(drawn.template, pageFillFor(book, other, FIXTURE_BOOK_FILL), {
      href: (ref) => `/api/assets/${ref.sha256}.png`,
      ...(drawn.ghost ? { ghost: drawn.ghost } : {}),
    });
    expect(drawnSvg).toContain('id="ghost-pearl"');
  });

  it("leaves the left-hand page alone for a look that has artwork, and not for one that has not", async () => {
    const art = await store();
    // The captain's spreads put the child on the right-hand half only, so the
    // left half of a delivered spread has nobody on it — and a white silhouette
    // standing on an empty floor is worse than no placeholder at all. For a
    // look still being drawn the same page does carry a baby, because the
    // placeholder scenes put one on both halves.
    const page = "page-003";
    const index = pageSequence(FIRST_BOOK).findIndex((p) => p.id === page);
    await art.put(lookSet(DELIVERED), [{ pageId: page, bytes: square([30, 60, 90]) }], NOW);
    const book = await bookAsDelivered(FIRST_BOOK, art);

    expect(pageCarriesTheChild(book, index, DELIVERED)).toBe(false);
    expect(pageCarriesTheChild(book, index, UNDELIVERED)).toBe(true);
    expect(ghostFor(book, index, DELIVERED)).toBeNull();
    expect(ghostFor(book, index, UNDELIVERED)).not.toBeNull();

    // And the right-hand half of the same spread carries one either way.
    const right = pageSequence(FIRST_BOOK).findIndex((p) => p.id === "page-004");
    expect(pageCarriesTheChild(book, right, DELIVERED)).toBe(true);
    expect(pageCarriesTheChild(book, right, UNDELIVERED)).toBe(true);
  });

  it("never reaches a print file, even for the page it is on", async () => {
    const art = await store();
    const half = rightHalfOf(square(LEFT, { size: 40, width: 80, right: RIGHT }));
    const index = pageSequence(FIRST_BOOK).findIndex((p) => p.id === "page-004");
    await art.put(GHOSTS_SET, [{ pageId: "page-004", bytes: half }], NOW);
    const book = await bookAsDelivered(FIRST_BOOK, art);

    // The print path derives the page from `page.art`, which a `PreviewAsset`
    // cannot be. `test/ghost.test.ts` asserts the structural half — no module
    // on the print path so much as imports a ghost module — and this is the
    // observable half: the bytes are not in the file.
    const template = pageTemplateFor(book, index, {
      lookId: DELIVERED,
      coverId: FIXTURE_BOOK_FILL.coverId,
    });
    const print = await renderPrintSvg(template, pageFillFor(book, index, FIXTURE_BOOK_FILL));
    expect(print).not.toContain(sha256(half));
    expect(print).not.toContain(GHOST_CAPTION);
  });

  it("is refused on a page the book says has no child on it", async () => {
    const art = await store();
    const half = rightHalfOf(square(LEFT, { size: 40, width: 80, right: RIGHT }));
    // `page-002` is the right-hand half of the opening spread and is babyless:
    // it carries the buyer's photograph and dedication. Nothing would ever draw
    // a ghost there, which is why the captain's own `spread-01` has no gold
    // figure in it — and why storing one is a refusal rather than a silent
    // nothing.
    const index = pageSequence(FIRST_BOOK).findIndex((p) => p.id === "page-002");
    expect(pageCarriesTheChild(FIRST_BOOK, index)).toBe(false);
    expect(ghostFor(FIRST_BOOK, index)).toBeNull();

    await art.put(GHOSTS_SET, [{ pageId: "page-002", bytes: half }], NOW);
    const book = await bookAsDelivered(FIRST_BOOK, art);
    expect(validateBook(book).map((p) => p.code)).toEqual(["ghost.onBabylessPage"]);
  });

  it("is refused when it is the wrong shape for the page it covers", async () => {
    const art = await store();
    // A whole spread rather than a half: it would be squeezed onto a square
    // page and the child would be half as wide as the captain drew them.
    await art.put(
      GHOSTS_SET,
      [{ pageId: "page-004", bytes: square(LEFT, { size: 40, width: 80, right: RIGHT }) }],
      NOW,
    );
    const book = await bookAsDelivered(FIRST_BOOK, art);
    expect(validateBook(book).map((p) => p.code)).toEqual(["ghost.wrongShape"]);
  });
});

// ---------------------------------------------------------------------------
// The photo path's own artwork, over the released artwork
// ---------------------------------------------------------------------------

describe("an order's own artwork on top of a released look", () => {
  it("prints, with the order's pages winning and the look's kept underneath", async () => {
    const art = await store();
    const kept = "page-006";
    const repainted = "page-004";
    await art.put(
      lookSet(DELIVERED),
      [
        { pageId: kept, bytes: square([10, 110, 10]) },
        { pageId: repainted, bytes: square([10, 10, 110]) },
      ],
      NOW,
    );
    // **A second look, which is what makes this test able to fail.** With one
    // delivered look there is nothing for the derived book to drop; the day the
    // captain delivers the second, every page would carry artwork for a look
    // this order's book does not offer.
    await art.put(lookSet(UNDELIVERED), [{ pageId: repainted, bytes: square([110, 10, 10]) }], NOW);
    const book = await bookAsDelivered(FIRST_BOOK, art);

    const own = square([200, 10, 160]);
    const order = bookWithOrderArtwork(
      book,
      { ...FIXTURE_BOOK_FILL, lookId: DELIVERED },
      {
        version: 1,
        at: NOW.toISOString(),
        pages: [{ pageId: repainted, asset: { sha256: sha256(own), mime: "image/png", px: [SIZE, SIZE] } }],
      },
    );

    // The derived book offers one look, so the released artwork for the other
    // eleven has to go with them — `validateBook` reports `art.lookUnknown`
    // otherwise, `printProblems` is every problem it finds, and the order would
    // refuse to print. That failure only appears once a second look exists,
    // which is why it is asserted now.
    expect(validateBook(order)).toEqual([]);
    expect(order.looks.map((l) => l.id)).toEqual([DELIVERED]);

    const at = (id: string) => {
      const index = pageSequence(order).findIndex((p) => p.id === id);
      const layer = pageTemplateFor(order, index, {
        lookId: DELIVERED,
        coverId: FIXTURE_BOOK_FILL.coverId,
      }).layers[0];
      return layer.kind === "image" ? layer.asset.sha256 : "drawn";
    };
    expect(at(repainted)).toBe(sha256(own));
    expect(at(kept)).toBe(sha256(square([10, 110, 10])));
  });

  it("leaves an order of a look nobody has delivered entirely alone", async () => {
    const art = await store();
    await art.put(lookSet(DELIVERED), [{ pageId: "page-004", bytes: square([10, 10, 110]) }], NOW);
    const book = await bookAsDelivered(FIRST_BOOK, art);
    const order = bookWithOrderArtwork(book, { ...FIXTURE_BOOK_FILL, lookId: UNDELIVERED }, null);
    expect(validateBook(order)).toEqual([]);
    const index = pageSequence(order).findIndex((p) => p.id === "page-004");
    expect(
      pageTemplateFor(order, index, { lookId: UNDELIVERED, coverId: FIXTURE_BOOK_FILL.coverId })
        .layers[0].kind,
    ).toBe("art");
  });
});

// ---------------------------------------------------------------------------
// None of it is ever committed
// ---------------------------------------------------------------------------

describe("no artwork can reach git", () => {
  const ignore = readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");

  it("writes inside the directory .gitignore already excludes", () => {
    const rules = ignore
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    // One rule covers the per-order artwork and the release's, which is one
    // line to lose in a merge instead of two.
    expect(rules.some((rule) => DEFAULT_RELEASE_ARTWORK_DIR.startsWith(rule.replace(/\/$/, "")))).toBe(
      true,
    );
  });

  it("writes outside every directory this repository commits", () => {
    for (const committed of ["fixtures", "data", "public", "templates", "app", "lib"]) {
      expect(DEFAULT_RELEASE_ARTWORK_DIR.startsWith(committed)).toBe(false);
    }
  });

  it("keeps the repository free of the manifest too, so a clone is not a book with holes", () => {
    // The manifest could have been committed — ids and digests are not pixels —
    // and `lib/artwork/release.ts` says why it is not: a manifest naming bytes
    // a fresh clone does not have is a book that declares twenty-four uploaded
    // pages and can draw none of them. The assertion is the published book
    // itself, above: every page `drawn`, every look with a placeholder baby.
    expect(FIRST_BOOK.pages.every((p) => p.art.kind === "drawn")).toBe(true);
  });

  it("checks a set name before it becomes a path segment", async () => {
    const art = localArtworkStore(await directory(), isReleaseSet);
    for (const bad of ["../../etc", "", "look-../x", "BK-7QX4K2P", "tiles/x"]) {
      await expect(art.versions(bad), bad).rejects.toThrow();
    }
    expect(isReleaseSet(lookSet(DELIVERED))).toBe(true);
    expect(isReleaseSet(TILES_SET)).toBe(true);
    expect(isReleaseSet(GHOSTS_SET)).toBe(true);
  });
});
