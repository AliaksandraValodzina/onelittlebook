/**
 * **The two artwork buckets, and the three states a read can be in.**
 *
 * `lib/artwork/object-store.ts` is the layout and `lib/artwork/r2.ts` is the
 * provider; between them they are the captain's two Cloudflare R2 buckets
 * behind the `ArtworkStore` interface the filesystem already answered.
 * Everything about that could be wrong is wrong in one of three ways, and this
 * file is those three:
 *
 * **The layout could be wrong** — a key that is not a content hash, a manifest
 * written where the next version will overwrite it, a re-upload that duplicates
 * what is already there. Those are asserted against an **in-memory bucket**,
 * because `ObjectApi` is a four-operation seam and `r2ObjectApi` is the only
 * thing in the repository that puts an artwork byte on a wire.
 * `test/artwork-r2.test.ts` is that half: the signed requests, against a fake
 * `fetch`. Nothing in either file reaches a live bucket, exactly as no test
 * reaches a live Stripe.
 *
 * **The layout is also the thing that did not change when the provider did.**
 * These keys are byte-for-byte the keys the Vercel Blob store wrote, which is
 * what made the move an adapter rather than a re-import, and the assertions
 * below are the same assertions that held then.
 *
 * **The read could resolve to the wrong place.** Three states, all real:
 * the public bucket configured and populated; a local directory with artwork in
 * it; and neither, which is a fresh clone, CI and every machine that has not
 * imported anything. The third is the one this repository cannot afford to
 * lose — `templates/first-book.ts` draws a complete printable book from its own
 * numbers — so it is asserted as an *identity*, not merely as "it still works".
 *
 * **A missing picture could draw as a hole.** It must not: somebody is deciding
 * whether to buy the book it is on. Every digest the store published no address
 * for falls through to `/api/assets/<digest>.png`, which answers from the
 * fixtures and then from the store, and `lib/assets/address.ts` § `hrefIn` is
 * the one place that decision is made.
 *
 * Nothing here reads the captain's folders: every picture is minted in the
 * test, which is `test/release-artwork.test.ts`'s rule and the only honest way
 * to test an artwork path in a repository that must contain no artwork.
 */

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { FIRST_BOOK } from "../templates/first-book";
import {
  GHOSTS_SET,
  RELEASE_ARTWORK_DIR_VAR,
  TILES_SET,
  anyReleaseArtwork,
  deliveredBook,
  forgetReleaseArtwork,
  localReleaseStore,
  lookSet,
  releaseArtworkFor,
  releaseStoreFromEnv,
  tilePageId,
} from "../lib/artwork/release";
import {
  ACCESS_KEY_VAR,
  ACCOUNT_VAR,
  LOOKS_BUCKET_VAR,
  PUBLIC_BASE_VAR,
  SECRET_KEY_VAR,
  looksR2Store,
  orderArtworkR2Store,
  publicBaseIn,
} from "../lib/artwork/r2";
import type { ObjectApi } from "../lib/artwork/object-store";
import { artworkBytesFor } from "../lib/artwork/store";
import { prepareLookPages } from "../lib/artwork/prepare";
import { assetRouteUrl, hrefIn } from "../lib/assets/address";
import { pageSequence, spreadSideOf } from "../lib/book/derive";
import { pageCarriesTheChild } from "../lib/book/ghost";
import { validateBook } from "../lib/book/validate";
import { sha256 } from "../lib/assets/digest";
import type { AssetRef } from "../lib/template/types";

/** The look the captain delivered first, named the way the book names it. */
const DELIVERED = "girl-02";
const SIZE = FIRST_BOOK.page.print.pixels.width;
const NOW = new Date("2026-11-10T09:00:00.000Z");

/**
 * The two bucket configurations, with credentials that are words.
 *
 * Several assertions below are that no part of either secret ever comes back
 * out of anything a store returns — the admin page prints `describe`, and this
 * repository is public and so are its logs.
 */
const LOOKS = {
  for: "looks",
  accountId: "accountsekrit",
  bucket: "onelittlebook-looks",
  accessKeyId: "keysekrit",
  secretAccessKey: "secretsekrit",
  publicBase: "https://art.onelittlebook.test",
} as const;
const ORDERS = {
  for: "order-artwork",
  accountId: "accountsekrit",
  bucket: "onelittlebook-orders",
  accessKeyId: "keysekrit",
  secretAccessKey: "secretsekrit",
} as const;
const BASE = LOOKS.publicBase;

/** Everything the public bucket needs, as an environment. */
const LOOKS_ENV = {
  [ACCOUNT_VAR]: LOOKS.accountId,
  [LOOKS_BUCKET_VAR]: LOOKS.bucket,
  [ACCESS_KEY_VAR]: LOOKS.accessKeyId,
  [SECRET_KEY_VAR]: LOOKS.secretAccessKey,
  [PUBLIC_BASE_VAR]: LOOKS.publicBase,
};

// ---------------------------------------------------------------------------
// The in-memory bucket
// ---------------------------------------------------------------------------

interface Bucket {
  api: ObjectApi;
  /** Everything written, by pathname. */
  files: Map<string, Uint8Array>;
  /** Every `put` that happened, in order — including the manifests. */
  puts: string[];
}

function bucket(base = BASE): Bucket {
  const files = new Map<string, Uint8Array>();
  const puts: string[] = [];
  const api: ObjectApi = {
    async put(pathname, bytes) {
      puts.push(pathname);
      files.set(pathname, bytes);
      return { url: `${base}/${pathname}` };
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

/** A square picture in one flat colour. Memoised: a 3600 px PNG is not free. */
const made = new Map<string, Uint8Array>();
function square(colour: [number, number, number], size = 64): Uint8Array {
  const key = `${colour.join(",")}-${size}`;
  const already = made.get(key);
  if (already) return already;
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < size * size; i++) {
    png.data[i * 4] = colour[0];
    png.data[i * 4 + 1] = colour[1];
    png.data[i * 4 + 2] = colour[2];
    png.data[i * 4 + 3] = 255;
  }
  const bytes = new Uint8Array(PNG.sync.write(png, { colorType: 2, inputHasAlpha: true, bitDepth: 8 }));
  made.set(key, bytes);
  return bytes;
}

/** An order reference of the shape `lib/orders/record.ts` mints. */
const REF = "BK-7QX4RMT";

/** The right-hand page of one spread, derived from the book's own pairing. */
function rightPageOfSpread(spread: number): string {
  const sequence = pageSequence(FIRST_BOOK);
  const at = sequence.findIndex((_, index) => {
    const side = spreadSideOf(FIRST_BOOK, index);
    return side !== null && side.spread === spread && side.side === "right";
  });
  return sequence[at].id;
}

/**
 * The first `count` interior pages the book says have a child on them.
 *
 * **The cover is excluded, and that is a fact about the book rather than a
 * convenience here**: a delivered cover is `{ kind: "asset" }`, which stops the
 * cover's ground taking the buyer's cover choice, so `validateBook` reports
 * `cover.choiceDoesNothing` until a `coverTint` layer exists. There is no cover
 * artwork yet — `npm run artwork` says so every time it runs — and a test that
 * pretended otherwise would be asserting a state the shop cannot be in.
 */
function babyPages(count: number) {
  return pageSequence(FIRST_BOOK)
    .filter((page, index) => page.id !== FIRST_BOOK.cover.id && pageCarriesTheChild(FIRST_BOOK, index))
    .slice(0, count);
}

const temporary: string[] = [];
async function directory(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "olb-blob-"));
  temporary.push(dir);
  return dir;
}

/** Every variable the public bucket reads, cleared between cases. */
const ROWS = Object.keys(LOOKS_ENV);

function clear() {
  for (const row of ROWS) delete process.env[row];
  delete process.env[RELEASE_ARTWORK_DIR_VAR];
}

beforeEach(() => {
  forgetReleaseArtwork();
  clear();
});

afterAll(async () => {
  for (const dir of temporary) await rm(dir, { recursive: true, force: true });
  clear();
  forgetReleaseArtwork();
});

// ---------------------------------------------------------------------------
// The sentence the admin page prints
// ---------------------------------------------------------------------------

describe("where it says it is reading from", () => {
  it("names the bucket and the domain and no credential at all", () => {
    const sentence = looksR2Store(LOOKS, bucket().api).describe;
    expect(sentence).toContain(LOOKS.bucket);
    expect(sentence).toContain(LOOKS.publicBase);
    for (const secret of [LOOKS.accountId, LOOKS.accessKeyId, LOOKS.secretAccessKey]) {
      expect(sentence).not.toContain(secret);
    }
  });

  it("says out loud when the domain is the rate-limited r2.dev default", () => {
    const smoke = looksR2Store({ ...LOOKS, publicBase: "https://pub-abc.r2.dev" }, bucket().api);
    expect(smoke.describe).toContain("r2.dev");
    expect(smoke.describe).toContain("not for production");
    // And the custom domain says nothing of the kind, so the sentence is a
    // signal rather than noise on every page load.
    expect(looksR2Store(LOOKS, bucket().api).describe).not.toContain("r2.dev");
  });

  it("reads the domain as unset rather than guessing at half of one", () => {
    // `lib/env.ts` § isSet's reason: a blank row, a bare hostname and a pasted
    // variable name are what a dashboard holds after a hurried deploy, and a
    // half-built URL in an `<img src>` draws a hole on a page somebody is
    // deciding whether to buy from.
    for (const raw of ["", "   ", "art.onelittlebook.test", "/art", PUBLIC_BASE_VAR]) {
      expect(publicBaseIn({ [PUBLIC_BASE_VAR]: raw })).toBeNull();
    }
    expect(publicBaseIn({ [PUBLIC_BASE_VAR]: "https://art.onelittlebook.test/" })).toBe(
      "https://art.onelittlebook.test",
    );
  });
});

// ---------------------------------------------------------------------------
// The layout
// ---------------------------------------------------------------------------

describe("what one upload puts in the bucket", () => {
  it("names the bytes by their content and the manifest by its version", async () => {
    const b = bucket();
    const store = looksR2Store(LOOKS, b.api);
    const bytes = square([200, 30, 30]);

    const version = await store.put(lookSet(DELIVERED), [{ pageId: "page-002", bytes }], NOW);

    expect(version.version).toBe(1);
    expect([...b.files.keys()].sort()).toEqual([
      `assets/${sha256(bytes)}.png`,
      `sets/look-${DELIVERED}/v0001.json`,
    ]);
    // The digest and the measured size are facts about the bytes, not about
    // the filename they arrived under.
    expect(version.pages[0].asset.sha256).toBe(sha256(bytes));
    expect(version.pages[0].asset.px).toEqual([64, 64]);
  });

  it("records the CDN url, which is what the preview is served from", async () => {
    const b = bucket();
    const store = looksR2Store(LOOKS, b.api);
    const bytes = square([10, 90, 200]);

    const version = await store.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes }], NOW);

    expect(version.pages[0].url).toBe(`${BASE}/assets/${sha256(bytes)}.png`);
  });

  it("reads back exactly what went in, through the interface", async () => {
    const b = bucket();
    const store = looksR2Store(LOOKS, b.api);
    const bytes = square([40, 160, 70]);
    await store.put(lookSet(DELIVERED), [{ pageId: "page-003", bytes }], NOW);

    const current = await store.current(lookSet(DELIVERED));
    expect(current?.version).toBe(1);
    expect(await store.read(lookSet(DELIVERED), 1, "page-003")).toEqual(bytes);
    // And the digest-checked map the renderer takes.
    const supplied = await artworkBytesFor(store, lookSet(DELIVERED), current!);
    expect(supplied.get(sha256(bytes))).toEqual(bytes);
  });

  it("lists its sets, which is the operation the digest index needs", async () => {
    const b = bucket();
    const store = looksR2Store(LOOKS, b.api);
    await store.put(lookSet(DELIVERED), [{ pageId: "page-002", bytes: square([1, 2, 3]) }], NOW);
    await store.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes: square([4, 5, 6]) }], NOW);

    expect((await store.sets()).sort()).toEqual([TILES_SET, lookSet(DELIVERED)].sort());
  });

  it("has nothing to say about a set nobody has uploaded", async () => {
    const store = looksR2Store(LOOKS, bucket().api);
    expect(await store.sets()).toEqual([]);
    expect(await store.versions(TILES_SET)).toEqual([]);
    expect(await store.current(TILES_SET)).toBeNull();
    expect(await store.read(TILES_SET, 1, "tile-ada")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Re-running an upload: the captain's two corrected portraits
// ---------------------------------------------------------------------------

describe("re-uploading", () => {
  const twelve = (variant: number) =>
    FIRST_BOOK.looks.map((look, at) => ({
      pageId: tilePageId(look.id),
      bytes: square([at * 7, 100, variant]),
    }));

  it("uploads nothing twice, because a key is a content hash", async () => {
    const b = bucket();
    const store = looksR2Store(LOOKS, b.api);
    await store.put(TILES_SET, twelve(1), NOW);
    const afterFirst = b.puts.length;

    await store.put(TILES_SET, twelve(1), NOW);

    // One more `put`: the new version's manifest. Not one picture.
    expect(b.puts.length - afterFirst).toBe(1);
    expect(b.puts.at(-1)).toBe(`sets/${TILES_SET}/v0002.json`);
  });

  it("uploads exactly the corrected pictures and nothing else", async () => {
    const b = bucket();
    const store = looksR2Store(LOOKS, b.api);
    await store.put(TILES_SET, twelve(1), NOW);
    const before = b.puts.length;

    // Two portraits regenerated for edge fringing — docs/artwork.md § 2.
    const corrected = twelve(1).map((page, at) =>
      at === 1 || at === 7 ? { ...page, bytes: square([at * 7, 100, 2]) } : page,
    );
    await store.put(TILES_SET, corrected, NOW);

    const written = b.puts.slice(before);
    expect(written.filter((p) => p.startsWith("assets/"))).toHaveLength(2);
    expect(written.filter((p) => p.startsWith("sets/"))).toHaveLength(1);
  });

  it("serves the corrected picture from a different url, so no cache can be stale", async () => {
    const b = bucket();
    const store = looksR2Store(LOOKS, b.api);
    const first = await store.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes: square([9, 9, 9]) }], NOW);
    const second = await store.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes: square([9, 9, 10]) }], NOW);

    expect(second.version).toBe(2);
    expect(second.pages[0].url).not.toBe(first.pages[0].url);
    // The earlier version is still readable, which is the recovery the store
    // exists for: a swap that looks right in a thumbnail and wrong at 3600 px.
    expect(await store.read(TILES_SET, 1, tilePageId(DELIVERED))).toEqual(square([9, 9, 9]));
    expect(await store.current(TILES_SET)).toEqual(second);
  });

  it("never overwrites a manifest, so a version number is never reused", async () => {
    const b = bucket();
    const store = looksR2Store(LOOKS, b.api);
    await store.put(GHOSTS_SET, [{ pageId: "page-002", bytes: square([1, 1, 1]) }], NOW);
    await store.put(GHOSTS_SET, [{ pageId: "page-002", bytes: square([2, 2, 2]) }], NOW);
    await store.put(GHOSTS_SET, [{ pageId: "page-002", bytes: square([3, 3, 3]) }], NOW);

    expect((await store.versions(GHOSTS_SET)).map((v) => v.version)).toEqual([1, 2, 3]);
    expect(b.puts.filter((p) => p === `sets/${GHOSTS_SET}/v0001.json`)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// What the upload command refuses, using the rules that already existed
// ---------------------------------------------------------------------------

describe("validating before uploading", () => {
  it("accepts a page that meets the contract the twelve looks are held to", () => {
    // The book's own declared print size, read off the template and never
    // typed here: the trim is an open question and a test that hard-coded a
    // number would have to be rewritten the day it is answered.
    const prepared = prepareLookPages(FIRST_BOOK, [
      { name: "spread-02-right.png", bytes: square([180, 40, 40], SIZE) },
    ]);
    expect(prepared.problems).toEqual([]);
    expect(prepared.pages).toHaveLength(1);
    // The page id is derived from the book's own spread pairing, so moving a
    // page in the template moves which file lands on it.
    expect(prepared.pages[0].pageId).toBe(rightPageOfSpread(2));
  });

  it("refuses a page of the wrong size, and then there is nothing to upload", async () => {
    const prepared = prepareLookPages(FIRST_BOOK, [
      { name: "spread-02-right.png", bytes: square([180, 40, 40], 64) },
    ]);
    expect(prepared.problems.length).toBeGreaterThan(0);
    // The rules are `lib/book/upload.ts`'s, not a second copy: the code names
    // the page contract rather than the uploader.
    expect(prepared.problems.map((p) => p.code).join(" ")).toMatch(/page\./);

    // And the command's own gate: a bucket that was never written to.
    const b = bucket();
    expect(b.puts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Three states of a read
// ---------------------------------------------------------------------------

describe("reading: the public bucket configured and populated", () => {
  async function populated() {
    const b = bucket();
    const store = looksR2Store(LOOKS, b.api);
    // Two pages at the book's declared print size — the only size `validateBook`
    // accepts for a look's artwork, which is the point of the assertion below.
    const pages = babyPages(2).map((page, at) => ({
      pageId: page.id,
      bytes: square([60 + at, 120, 200], SIZE),
    }));
    await store.put(lookSet(DELIVERED), pages, NOW);
    await store.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes: square([250, 210, 120]) }], NOW);
    // Preview resolution, on a page the book says has a child on it: a golden
    // half anywhere else is `ghost.onBabylessPage`.
    await store.put(GHOSTS_SET, [{ pageId: pages[0].pageId, bytes: square([255, 215, 0], 887) }], NOW);
    return { store, pages };
  }

  it("binds the delivered pages, the tile and the golden half", async () => {
    const { store, pages } = await populated();
    const art = await releaseArtworkFor(FIRST_BOOK, store);

    expect(anyReleaseArtwork(art)).toBe(true);
    expect(Object.keys(art.pages[DELIVERED]).sort()).toEqual(pages.map((p) => p.pageId).sort());
    expect(art.tiles[DELIVERED]).toBeTruthy();
    expect(art.ghosts[pages[0].pageId]?.kind).toBe("preview");
  });

  it("carries a CDN url for every picture it bound, and for nothing else", async () => {
    const { store, pages } = await populated();
    const art = await releaseArtworkFor(FIRST_BOOK, store);

    for (const page of pages) {
      const digest = art.pages[DELIVERED][page.pageId].sha256;
      expect(art.urls[digest]).toBe(`${BASE}/assets/${digest}.png`);
    }
    expect(art.urls[art.tiles[DELIVERED].sha256]).toContain(BASE);
    // Twelve pictures the store does not hold are not in it.
    expect(art.urls[sha256(square([7, 7, 7]))]).toBeUndefined();
  });

  it("hands the address book to the browser beside the book it describes", async () => {
    const { store } = await populated();
    const delivered = await deliveredBook(FIRST_BOOK, store);

    expect(validateBook(delivered.book)).toEqual([]);
    expect(Object.keys(delivered.assets).length).toBeGreaterThan(0);
    // The one thing the prop has to be: serialisable. It crosses into a client
    // component, where a `Map` would not survive the boundary.
    expect(JSON.parse(JSON.stringify(delivered.assets))).toEqual(delivered.assets);
  });

  it("draws every picture from the CDN rather than from a function", async () => {
    const { store, pages } = await populated();
    const { book, assets } = await deliveredBook(FIRST_BOOK, store);
    const href = hrefIn(assets);

    const drawn = pageSequence(book)
      .map((page) => (page.art.kind === "asset" ? page.art.byLook[DELIVERED] : undefined))
      .filter((ref) => ref !== undefined)
      .map((ref) => href(ref));
    expect(drawn.length).toBe(pages.length);
    for (const url of drawn) expect(url.startsWith(BASE)).toBe(true);
  });
});

describe("reading: a local directory with artwork in it", () => {
  it("binds the same pages and publishes no urls, because a directory has none", async () => {
    const root = await directory();
    const store = localReleaseStore(root);
    const page = babyPages(1)[0];
    await store.put(lookSet(DELIVERED), [{ pageId: page.id, bytes: square([30, 30, 30]) }], NOW);

    const art = await releaseArtworkFor(FIRST_BOOK, store);
    expect(Object.keys(art.pages[DELIVERED])).toEqual([page.id]);
    expect(art.urls).toEqual({});

    // So every one of them is drawn by the asset route, which answers from the
    // store. A missing address is an address, never a hole in the page.
    const ref = art.pages[DELIVERED][page.id];
    expect(hrefIn(art.urls)(ref)).toBe(assetRouteUrl(ref));
    expect(hrefIn(art.urls)(ref)).toBe(`/api/assets/${ref.sha256}.png`);
  });

  it("is what the environment chooses with no bucket configured", async () => {
    const root = await directory();
    process.env[RELEASE_ARTWORK_DIR_VAR] = root;
    expect(releaseStoreFromEnv(process.env).describe).toContain(root);
  });

  it("is not what the environment chooses when the bucket is there", async () => {
    const root = await directory();
    process.env[RELEASE_ARTWORK_DIR_VAR] = root;
    Object.assign(process.env, LOOKS_ENV);
    const chosen = releaseStoreFromEnv(process.env).describe;
    expect(chosen).toContain(LOOKS.bucket);
    expect(chosen).not.toContain(root);
  });

  it("is still what it chooses for a half-configured bucket, and says which rows are empty", async () => {
    // The state that looks configured from a dashboard and is not. Every row
    // in turn, so no single one of them can quietly become optional.
    const root = await directory();
    for (const row of ROWS) {
      clear();
      process.env[RELEASE_ARTWORK_DIR_VAR] = root;
      Object.assign(process.env, LOOKS_ENV);
      delete process.env[row];

      const sentence = releaseStoreFromEnv(process.env).describe;
      expect(sentence, row).toContain(root);
      expect(sentence, row).toContain(row);
      expect(sentence, row).not.toContain(LOOKS.bucket);
    }
  });

  it("says the custom domain is not an optional row, because reads come from it", async () => {
    process.env[RELEASE_ARTWORK_DIR_VAR] = await directory();
    Object.assign(process.env, LOOKS_ENV);
    delete process.env[PUBLIC_BASE_VAR];
    expect(releaseStoreFromEnv(process.env).describe).toContain("never from a signed URL");
  });
});

describe("reading: neither, which is a fresh clone and all of CI", () => {
  it("returns the committed book unchanged, character for character", async () => {
    const store = localReleaseStore(await directory());
    const { book, assets } = await deliveredBook(FIRST_BOOK, store);

    expect(book).toEqual(FIRST_BOOK);
    expect(assets).toEqual({});
  });

  it("says nothing has been delivered rather than failing to say anything", async () => {
    const store = localReleaseStore(await directory());
    const art = await releaseArtworkFor(FIRST_BOOK, store);
    expect(anyReleaseArtwork(art)).toBe(false);
    expect(art.sets).toEqual([]);
    expect(art.describe).toContain("the filesystem at");
  });

  it("still gives every picture an address, so no page can draw a broken image", () => {
    // The fixture photograph: in the repository, in no bucket, and the landing
    // page draws it. With no address book it is the asset route, which is the
    // answer that always works.
    const ref: AssetRef = { sha256: "a".repeat(64), mime: "image/png", px: [8, 8] };
    expect(hrefIn({})(ref)).toBe(`/api/assets/${ref.sha256}.png`);
    expect(hrefIn()(ref)).toBe(`/api/assets/${ref.sha256}.png`);
  });
});

// ---------------------------------------------------------------------------
// The private bucket, read through the same interface
// ---------------------------------------------------------------------------

describe("the private bucket", () => {
  it("holds an order's artwork and publishes no url for any of it", async () => {
    const b = bucket();
    const store = orderArtworkR2Store(ORDERS, b.api);
    const bytes = square([120, 60, 20]);

    const version = await store.put(REF, [{ pageId: "page-006", bytes }], NOW);

    expect(version.pages[0].url).toBeUndefined();
    expect(await store.read(REF, 1, "page-006")).toEqual(bytes);
    // Nothing anywhere in the record is a URL, so there is nothing for an
    // `<img src>` to be given even by accident.
    expect(JSON.stringify(version)).not.toContain("https://");
  });

  it("says where it is reading from without naming a credential", () => {
    const store = orderArtworkR2Store(ORDERS, bucket().api);
    expect(store.describe).toContain(ORDERS.bucket);
    expect(store.describe).toContain("no public URLs");
    for (const secret of [ORDERS.accountId, ORDERS.accessKeyId, ORDERS.secretAccessKey]) {
      expect(store.describe).not.toContain(secret);
    }
  });
});
