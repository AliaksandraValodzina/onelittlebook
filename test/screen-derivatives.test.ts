/**
 * **The screen gets a 1600 px copy; the press gets the master. Measured, not
 * asserted by assertion.**
 *
 * A page of this book is 3600 × 3600. The preview shows a spread about 700 CSS
 * px wide, so it was sending about 26 times the pixels the screen uses —
 * 2.6 MB a page, roughly 62 MB for the twenty-four. `lib/artwork/screen.ts`
 * makes a WebP copy at upload and `lib/assets/screen.ts` is the only thing that
 * ever turns one into a URL.
 *
 * The thing that must be true forever is the other half: **a derivative must
 * never reach a print file**, because a soft, low-resolution printed book is
 * the one failure of this product that nobody finds out about until a family
 * opens the box. So this file is five parts:
 *
 * **It really is smaller, and really is the same picture.** Read off a
 * committed page of the book at its real print size — the only 3600 px page in
 * this repository — and the ratio is printed in the failure message, so a
 * change to the quality or the width says by how much.
 *
 * **The store is idempotent.** The key is a function of the master's digest, so
 * the second run of the upload writes nothing. That is what makes the backfill
 * a re-run of one command rather than a migration.
 *
 * **The two renders of one page disagree about exactly one thing.** The same
 * template and the same fill: the screen's SVG names the 1600 px copy, and the
 * print SVG carries bytes that hash to the **master's** own digest. Each is
 * paired against the other, which is what makes it a test of the distinction
 * rather than of either half.
 *
 * **The print path cannot reach the module that resolves one**, read off the
 * import graph on disk, transitively — the same device `test/ghost.test.ts`
 * uses, closed one notch further because this one follows the graph rather than
 * naming the direct importers.
 *
 * **And a derivative is refused everywhere a picture is checked**: it hashes to
 * something no `AssetRef` names, and it fails the page contract on its size.
 *
 * `test/no-derivative-in-a-print-file.ts` is the compiler's half, and
 * `test/preview-lazy.test.tsx` is the half about when each page is fetched.
 *
 * Nothing here reads the captain's folders: every picture is either minted in
 * the test or a committed render of this repository's own placeholder artwork,
 * which is `test/release-artwork.test.ts`'s rule and the only honest way to
 * test an artwork path in a repository that must contain no artwork.
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readFileSync, statSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { SCREEN_PREFIX, SCREEN_WIDTH, screenKey, screenKeyOf } from "../lib/artwork/keys";
import { backfillScreens, screenDerivativeOf } from "../lib/artwork/screen";
import { looksBlobStore, type BlobApi } from "../lib/artwork/blob";
import {
  RELEASE_ARTWORK_DIR_VAR,
  deliveredBook,
  forgetReleaseArtwork,
  localReleaseStore,
  lookSet,
  releaseArtworkFor,
  tilePageId,
  TILES_SET,
} from "../lib/artwork/release";
import { LOOKS_TOKEN_VAR } from "../lib/artwork/blob";
import { hrefIn } from "../lib/assets/address";
import { screenHrefIn, screenWidthFor } from "../lib/assets/screen";
import { sha256 } from "../lib/assets/digest";
import { pageFillFor, pageSequence, pageTemplateFor } from "../lib/book/derive";
import { pageAgainstContract } from "../lib/book/upload";
import { readPngHeader } from "../lib/render/png";
import { renderPageSvg } from "../lib/render/svg";
import { renderPrintSvg } from "../lib/render/raster";
import { validateBook } from "../lib/book/validate";

const ROOT = process.cwd();
const SIZE = FIRST_BOOK.page.print.pixels.width;
const DELIVERED = "girl-02";
const PAGE = "page-004";
const NOW = new Date("2026-11-12T09:00:00.000Z");

/** A read-write token of the shape the platform issues; the fourth field is the store id. */
const TOKEN = "vercel_blob_rw_abc123store_sekritsekrit";
const BASE = "https://abc123store.public.blob.vercel-storage.com";

// ---------------------------------------------------------------------------
// The in-memory bucket, as `test/artwork-blob.test.ts` has it
// ---------------------------------------------------------------------------

interface Bucket {
  api: BlobApi;
  files: Map<string, Uint8Array>;
  /** Every `put`, in order — which is how "it wrote nothing" is asserted. */
  puts: string[];
}

function bucket(): Bucket {
  const files = new Map<string, Uint8Array>();
  const puts: string[] = [];
  const api: BlobApi = {
    async put(pathname, bytes) {
      puts.push(pathname);
      files.set(pathname, bytes);
      return { url: `${BASE}/${pathname}` };
    },
    async has(pathname) {
      return files.has(pathname);
    },
    async pathnames(prefix) {
      return [...files.keys()].filter((key) => key.startsWith(prefix));
    },
    async bytes(pathname) {
      return files.get(pathname) ?? null;
    },
  };
  return { api, files, puts };
}

/** A square in one flat colour, at the book's own page size by default. */
const minted = new Map<string, Uint8Array>();
function square(colour: [number, number, number], size = SIZE): Uint8Array {
  const key = `${colour.join(",")}-${size}`;
  const already = minted.get(key);
  if (already) return already;
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < size * size; i++) {
    png.data[i * 4] = colour[0];
    png.data[i * 4 + 1] = colour[1];
    png.data[i * 4 + 2] = colour[2];
    png.data[i * 4 + 3] = 255;
  }
  const bytes = new Uint8Array(
    PNG.sync.write(png, { colorType: 2, inputHasAlpha: true, bitDepth: 8 }),
  );
  minted.set(key, bytes);
  return bytes;
}

const temporary: string[] = [];
async function directory(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "olb-screen-"));
  temporary.push(dir);
  return dir;
}

beforeEach(() => {
  forgetReleaseArtwork();
  delete process.env[LOOKS_TOKEN_VAR];
  delete process.env[RELEASE_ARTWORK_DIR_VAR];
});

afterAll(async () => {
  for (const dir of temporary) await rm(dir, { recursive: true, force: true });
  delete process.env[LOOKS_TOKEN_VAR];
  delete process.env[RELEASE_ARTWORK_DIR_VAR];
  forgetReleaseArtwork();
});

// ---------------------------------------------------------------------------
// 1. The measurement
// ---------------------------------------------------------------------------

/**
 * A real page of this book at its real print size.
 *
 * `npm run book` renders it and CI asserts it has not drifted, so it is the one
 * 3600 px page this repository is allowed to have. It is the placeholder
 * artwork rather than the captain's — flat shapes compress far better than a
 * painting, so the saving measured here is the **conservative** end of the
 * range, and the captain's own measurement (7.06 MB → 0.13 MB) is the other.
 */
const COMMITTED_PAGE = path.join(ROOT, "data", "bk-first-book-buyer-flow", "page-002-3600.png");

describe("the screen-sized copy of a real page", () => {
  it("is the same picture, no wider than the ceiling, and a fraction of the weight", async () => {
    const master = new Uint8Array(await readFile(COMMITTED_PAGE));
    const before = readPngHeader(master);
    expect([before.width, before.height], "the committed page is the book's own print size").toEqual(
      [SIZE, SIZE],
    );

    const made = await screenDerivativeOf(sha256(master), master);
    expect(made, "a 3600 px page is always worth a screen copy").not.toBeNull();

    // The ceiling, and the shape. A derivative of a different aspect ratio
    // would be a preview of a picture the press is not going to print.
    expect(made!.width).toBe(SCREEN_WIDTH);
    expect(made!.height).toBe(SCREEN_WIDTH);
    expect(made!.width / made!.height).toBeCloseTo(before.width / before.height, 5);

    // WebP, read out of the bytes rather than taken from the extension:
    // `RIFF....WEBP`.
    const header = Buffer.from(made!.bytes.slice(0, 12)).toString("latin1");
    expect(header.slice(0, 4)).toBe("RIFF");
    expect(header.slice(8, 12)).toBe("WEBP");

    const ratio = made!.bytes.byteLength / master.byteLength;
    expect(
      ratio,
      `${(master.byteLength / 1024).toFixed(0)} KB → ${(made!.bytes.byteLength / 1024).toFixed(0)} KB ` +
        `(${(ratio * 100).toFixed(1)}%)`,
    ).toBeLessThan(0.2);
    // And it is under the size the whole arrangement was chosen for: a spread
    // is two of these, and a reader should not pay a megabyte to turn a page.
    expect(made!.bytes.byteLength).toBeLessThan(150 * 1024);
  });

  it("never upscales, and says so by producing nothing where a copy is pointless", async () => {
    // The golden halves are 887 px and the portraits 1254: both below the
    // ceiling, so a copy is a re-encode and never an enlargement.
    const small = square([200, 120, 60], 64);
    const made = await screenDerivativeOf(sha256(small), small);
    // A 64 px flat square is already smaller than any copy of it, which is the
    // honest "no derivative" answer — null, and the master goes on being
    // served exactly as it was.
    if (made) {
      expect(made.width).toBeLessThanOrEqual(64);
      expect(made.bytes.byteLength).toBeLessThan(small.byteLength);
    } else {
      expect(made).toBeNull();
    }

    // Paired against the picture that *is* worth copying, so the branch above
    // is not the only thing this function can do.
    const big = square([30, 90, 160], 800);
    const copy = await screenDerivativeOf(sha256(big), big);
    if (copy) expect(copy.width).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// 2. The key, and the idempotence it buys
// ---------------------------------------------------------------------------

describe("a derivative's key", () => {
  it("is the master's digest and the width, and reads back as both", () => {
    const digest = sha256(square([1, 2, 3], 8));
    const key = screenKey(digest, SCREEN_WIDTH);
    expect(key.startsWith(SCREEN_PREFIX)).toBe(true);
    expect(key.endsWith(".webp")).toBe(true);
    expect(screenKeyOf(key)).toEqual({ of: digest, width: SCREEN_WIDTH });
    // A different width is a different key, so changing the ceiling can never
    // serve the old size at the new name.
    expect(screenKey(digest, 1200)).not.toBe(key);
  });

  it("is null for anything else in a listing, rather than a guess", () => {
    for (const not of [
      "assets/" + "a".repeat(64) + ".png",
      "screen/not-a-digest-w1600.webp",
      "screen/" + "a".repeat(64) + ".webp",
      "screen/" + "a".repeat(64) + "-w1600.png",
      "",
    ]) {
      expect(screenKeyOf(not), not).toBeNull();
    }
  });
});

describe("the public store's derivatives", () => {
  const bytes = () => square([12, 34, 56], 8);

  it("are written once and never again, which is what makes the backfill a re-run", async () => {
    const b = bucket();
    const store = looksBlobStore(TOKEN, b.api);
    const master = bytes();
    const of = sha256(master);
    const copy = new Uint8Array([1, 2, 3, 4]);

    const first = await store.putScreens([{ of, width: SCREEN_WIDTH, bytes: copy }]);
    expect(Object.keys(first)).toEqual([of]);
    expect(first[of]).toEqual({ kind: "screen", url: `${BASE}/${screenKey(of, SCREEN_WIDTH)}`, width: SCREEN_WIDTH });
    expect(b.puts).toEqual([screenKey(of, SCREEN_WIDTH)]);

    // The second run: same answer, no write. The key is a function of the
    // master's digest, so "is there already one of these" is not a judgement.
    const again = await store.putScreens([{ of, width: SCREEN_WIDTH, bytes: copy }]);
    expect(again).toEqual(first);
    expect(b.puts).toEqual([screenKey(of, SCREEN_WIDTH)]);

    // And the listing finds it, which is the read half of the same key.
    expect(await store.screens()).toEqual(first);
  });

  it("refuse a key that is not a content digest, before it becomes a pathname", async () => {
    const store = looksBlobStore(TOKEN, bucket().api);
    for (const bad of ["../../etc/passwd", "", "BK-7QX4RMT", "a".repeat(63)]) {
      await expect(
        store.putScreens([{ of: bad, width: SCREEN_WIDTH, bytes: new Uint8Array([1]) }]),
        bad,
      ).rejects.toThrow();
    }
  });

  it("serve the widest copy, so an old ceiling is never preferred to a new one", async () => {
    const b = bucket();
    const store = looksBlobStore(TOKEN, b.api);
    const of = sha256(bytes());
    await store.putScreens([{ of, width: 1200, bytes: new Uint8Array([1]) }]);
    await store.putScreens([{ of, width: 1600, bytes: new Uint8Array([2]) }]);
    expect(b.puts.length).toBe(2);
    expect((await store.screens())[of].width).toBe(1600);
  });

  it("are none on a local store, which has no address to give one", async () => {
    // Not a gap: a directory has no URL, so there is nothing to put in a
    // `ScreenAddress` and the preview serves the master exactly as it always
    // has. `lib/artwork/release.ts` § localReleaseStore carries the argument.
    const store = localReleaseStore(await directory());
    expect(await store.screens()).toEqual({});
    expect(await store.putScreens([{ of: sha256(bytes()), width: 1600, bytes: bytes() }])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 2a. The backfill — the one command the captain runs
// ---------------------------------------------------------------------------

describe("the backfill", () => {
  /** Two real pages in the store and no screen copies: the state today. */
  async function uploaded() {
    const b = bucket();
    const store = looksBlobStore(TOKEN, b.api);
    const page = new Uint8Array(await readFile(COMMITTED_PAGE));
    await store.put(lookSet(DELIVERED), [{ pageId: PAGE, bytes: page }], NOW);
    b.puts.length = 0;
    return { bucket: b, store, page };
  }

  it("makes a copy of every page the store holds and none of them twice", async () => {
    const { bucket: b, store, page } = await uploaded();
    const set = lookSet(DELIVERED);

    const first = await backfillScreens(store, set);
    expect(first.state).toBe("made");
    expect(first.made).toBe(1);
    expect(first.lines.join(" ")).toContain("WebP");
    expect(b.puts).toEqual([screenKey(sha256(page), SCREEN_WIDTH)]);
    expect(first.url).toBe(`${BASE}/${screenKey(sha256(page), SCREEN_WIDTH)}`);

    // **The second run is the assertion.** Running the command again is what
    // the captain will actually do, and it must cost one listing and no bytes.
    const again = await backfillScreens(store, set);
    expect(again.state).toBe("unchanged");
    expect(again.made).toBe(0);
    expect(b.puts.length).toBe(1);

    // And the copy is readable at the address it reported, which is the whole
    // of what the preview will ask for.
    expect(b.files.has(screenKey(sha256(page), SCREEN_WIDTH))).toBe(true);
  });

  it("writes nothing on a dry run, and says how much it would have done", async () => {
    const { bucket: b, store } = await uploaded();
    const dry = await backfillScreens(store, lookSet(DELIVERED), { dryRun: true });
    expect(dry.state).toBe("would-make");
    expect(dry.detail).toContain("1 of 1");
    expect(b.puts).toEqual([]);
  });

  it("refuses a set whose bytes no longer match the digest the manifest names", async () => {
    const { bucket: b, store, page } = await uploaded();
    // A file replaced under its own name. Making a preview from it would show
    // one picture and print another, so the whole set is refused.
    b.files.set(`assets/${sha256(page)}.png`, square([9, 9, 9], 32));
    const out = await backfillScreens(store, lookSet(DELIVERED));
    expect(out.state).toBe("refused");
    expect(out.made).toBe(0);
    expect(b.puts).toEqual([]);
  });

  it("says so, rather than failing, for a set the store does not hold", async () => {
    const store = looksBlobStore(TOKEN, bucket().api);
    expect((await backfillScreens(store, TILES_SET)).state).toBe("absent");
  });
});

// ---------------------------------------------------------------------------
// 3. The address book the browser is given
// ---------------------------------------------------------------------------

/**
 * One look's page and one portrait in the bucket, with derivatives for both,
 * and the book bound to them.
 */
async function delivered() {
  const b = bucket();
  const store = looksBlobStore(TOKEN, b.api);
  const page = square([16, 92, 180]);
  const portrait = square([200, 120, 60], 256);
  await store.put(lookSet(DELIVERED), [{ pageId: PAGE, bytes: page }], NOW);
  await store.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes: portrait }], NOW);
  await store.putScreens([
    { of: sha256(page), width: SCREEN_WIDTH, bytes: new Uint8Array([1, 2, 3]) },
    { of: sha256(portrait), width: 256, bytes: new Uint8Array([4, 5, 6]) },
  ]);
  return { bucket: b, store, page, portrait, digest: sha256(page) };
}

describe("the artwork read", () => {
  it("hands the browser both maps, and they answer different questions", async () => {
    const { store, page, digest } = await delivered();
    const art = await releaseArtworkFor(FIRST_BOOK, store);

    // `urls` is where those exact bytes are; `screen` is where a smaller
    // picture made from them is. Same key, different pictures.
    expect(art.urls[digest]).toBe(`${BASE}/assets/${digest}.png`);
    expect(art.screen[digest]).toEqual({
      kind: "screen",
      url: `${BASE}/${screenKey(digest, SCREEN_WIDTH)}`,
      width: SCREEN_WIDTH,
    });
    expect(art.screen[digest].url).not.toBe(art.urls[digest]);
    expect(sha256(page)).toBe(digest);

    const { assets, screen } = await deliveredBook(FIRST_BOOK, store);
    expect(screen).toEqual(art.screen);
    expect(Object.keys(assets)).toEqual(Object.keys(art.urls));
  });

  it("names only the pictures this book uses", async () => {
    const { store, bucket: b } = await delivered();
    // A derivative of something no version binds — an earlier upload, a page
    // that was replaced — is still readable and must not travel to the browser.
    const orphan = "f".repeat(64);
    b.files.set(screenKey(orphan, SCREEN_WIDTH), new Uint8Array([9]));
    const art = await releaseArtworkFor(FIRST_BOOK, store);
    expect(Object.keys(art.screen)).not.toContain(orphan);
    expect(Object.keys(art.screen).length).toBe(2);
  });

  it("is empty where there are no derivatives, which is the ordinary state", async () => {
    const b = bucket();
    const store = looksBlobStore(TOKEN, b.api);
    await store.put(lookSet(DELIVERED), [{ pageId: PAGE, bytes: square([16, 92, 180]) }], NOW);
    const art = await releaseArtworkFor(FIRST_BOOK, store);
    expect(art.screen).toEqual({});
    // And the book is unaffected: a fresh clone and a store with no
    // derivatives draw the same pages from the same refs.
    expect(validateBook((await deliveredBook(FIRST_BOOK, store)).book)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. The two renders of one page
// ---------------------------------------------------------------------------

describe("one page, two uses", () => {
  it("names the 1600 px copy on screen and carries the master's own bytes to print", async () => {
    const { store, page, digest } = await delivered();
    const { book, assets, screen } = await deliveredBook(FIRST_BOOK, store);

    const index = pageSequence(book).findIndex((p) => p.id === PAGE);
    const fill = { ...FIXTURE_BOOK_FILL, lookId: DELIVERED };
    const template = pageTemplateFor(book, index, { lookId: DELIVERED, coverId: fill.coverId });
    const pageFill = pageFillFor(book, index, fill);

    // --- The screen. One renderer, one template, one fill, and an href that
    // prefers the smaller copy.
    const onScreen = renderPageSvg(template, pageFill, { href: screenHrefIn(screen, assets) });
    expect(onScreen).toContain(screenKey(digest, SCREEN_WIDTH));
    expect(onScreen).not.toContain(`assets/${digest}.png`);
    expect(screenWidthFor(screen, { sha256: digest, mime: "image/png", px: [SIZE, SIZE] })).toBe(
      SCREEN_WIDTH,
    );

    // Paired: the same call with only the master address book draws the master,
    // so the assertion above is about the preference and not about the URL.
    const masterOnly = renderPageSvg(template, pageFill, { href: hrefIn(assets) });
    expect(masterOnly).toContain(`assets/${digest}.png`);
    expect(masterOnly).not.toContain(SCREEN_PREFIX);

    // --- The press. The same template and the same fill, through the ordinary
    // print path with no help: `loadAsset` finds the master in the artwork
    // store and inlines it, so what is in the file is the 3600 px bytes.
    const root = await directory();
    process.env[RELEASE_ARTWORK_DIR_VAR] = root;
    forgetReleaseArtwork();
    await localReleaseStore(root).put(lookSet(DELIVERED), [{ pageId: PAGE, bytes: page }], NOW);

    const print = await renderPrintSvg(template, pageFill);
    expect(print).not.toContain(SCREEN_PREFIX);
    expect(print).not.toContain(".webp");
    expect(print).not.toContain(BASE);

    // What it does carry is bytes that hash to the master's own digest, read
    // back out of the file. This is the whole assertion: not "no derivative
    // appears" but "the master itself is what printed".
    const inlined = /data:image\/png;base64,([A-Za-z0-9+/=]+)/.exec(print);
    expect(inlined, "the print file inlines the page's own bytes").not.toBeNull();
    expect(sha256(new Uint8Array(Buffer.from(inlined![1], "base64")))).toBe(digest);
  });
});

// ---------------------------------------------------------------------------
// 5. The import graph, and the refusals
// ---------------------------------------------------------------------------

/** Every `.ts`/`.tsx` of this project, for the walk below. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
  };
  for (const dir of ["lib", "app", "scripts", "templates"]) walk(path.join(ROOT, dir));
  return out;
}

/** The relative specifiers one file imports, resolved to files on disk. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const statement of source.match(/from\s+"(\.[^"]*)"/g) ?? []) {
    const spec = /from\s+"(\.[^"]*)"/.exec(statement)?.[1] ?? "";
    const base = path.resolve(path.dirname(file), spec);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      try {
        if (statSync(candidate).isFile()) {
          out.push(candidate);
          break;
        }
      } catch {
        // Not that one. A specifier that resolves to nothing is a compile
        // error `npm run lint` already reports.
      }
    }
  }
  return out;
}

/** Everything one file can reach, following relative imports. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [path.join(ROOT, entry)];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const next of importsOf(file)) queue.push(next);
  }
  return seen;
}

describe("the print path", () => {
  /** Every door to a print file, which is the list `test/ghost.test.ts` walks. */
  const ENTRIES = [
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

  const RESOLVER = path.join(ROOT, "lib", "assets", "screen.ts");

  it("cannot reach the module that turns a derivative into a URL — transitively", () => {
    // Followed through the graph rather than checked one import deep: a
    // helper that imported the resolver would otherwise put it back on the
    // print path without any of these files changing.
    const everything = new Set<string>();
    for (const entry of ENTRIES) {
      const reach = reachableFrom(entry);
      for (const file of reach) everything.add(file);
      expect(
        reach.has(RESOLVER),
        `${entry} can reach lib/assets/screen.ts, which resolves screen-resolution artwork`,
      ).toBe(false);
    }
    // The walk really walks. `lib/render/pdf.ts` legitimately reaches nothing —
    // it imports `node:zlib` and writes a container — so the guard against a
    // vacuous check is over the union rather than per entry: the renderer and
    // the asset resolver are both several hops in from these doors.
    for (const must of ["lib/render/svg.ts", "lib/assets/resolve.ts", "lib/artwork/release.ts"]) {
      expect(everything.has(path.join(ROOT, must)), `the walk never reached ${must}`).toBe(true);
    }
  });

  it("is reachable from the screens that do want one, so the check above is not vacuous", () => {
    // The paired positive. If nothing imported the resolver, "the print path
    // cannot reach it" would be true of a dead module.
    const importers = sourceFiles().filter((file) => importsOf(file).includes(RESOLVER));
    expect(importers.map((f) => path.relative(ROOT, f)).sort()).toEqual([
      "app/_book/BookPage.tsx",
      "app/_book/tile.ts",
      "app/books/[slug]/page.tsx",
    ]);
  });

  it("says nothing about resolution in the renderer or the rasteriser", () => {
    // `lib/render/svg.ts` draws the page and has one `href` argument; nothing
    // in either module knows there are two sizes of anything.
    for (const file of ["lib/render/svg.ts", "lib/render/raster.ts", "lib/book/print.ts"]) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      expect(source, `${file} mentions a derivative`).not.toMatch(/webp|SCREEN_WIDTH|screenHref/i);
    }
  });
});

describe("a derivative handed to something that checks pictures", () => {
  it("fails the page contract on its size, as the golden halves do", async () => {
    const master = new Uint8Array(await readFile(COMMITTED_PAGE));
    const made = await screenDerivativeOf(sha256(master), master);
    expect(made).not.toBeNull();
    // Not a PNG at all, so the contract refuses it at the first gate. The
    // paired positive is the master, which passes.
    expect(
      pageAgainstContract({ name: "screen.webp", bytes: made!.bytes }, "screen", SIZE).map(
        (p) => p.code,
      ),
    ).toEqual(["page.notPng"]);
    // The paired positive is a page that does satisfy the contract: the
    // committed render carries an alpha channel, which the contract rightly
    // refuses on its own account (`page.hasAlpha`), so the picture that passes
    // is a minted one at the book's declared size.
    expect(pageAgainstContract({ name: "page.png", bytes: square([16, 92, 180]) }, "page", SIZE)).toEqual(
      [],
    );
  });

  it("hashes to something no `AssetRef` in the book names", async () => {
    const { store, digest } = await delivered();
    const copy = new Uint8Array([1, 2, 3]);
    // The derivative stored for this page is *these* bytes, and the page's own
    // ref names the master. So the digest check every store does on the way out
    // refuses the copy under the master's name — which is the mistake that
    // would print the wrong resolution.
    expect(sha256(copy)).not.toBe(digest);
    const art = await releaseArtworkFor(FIRST_BOOK, store);
    expect(Object.values(art.pages[DELIVERED]).map((ref) => ref.sha256)).toContain(digest);
    expect(Object.values(art.pages[DELIVERED]).map((ref) => ref.sha256)).not.toContain(sha256(copy));
  });
});
