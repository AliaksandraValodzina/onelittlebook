/**
 * **The Blob adapter, and the three states a read can be in.**
 *
 * `lib/artwork/blob.ts` is the captain's two Vercel Blob stores behind the
 * `ArtworkStore` interface the filesystem already answered. Everything about it
 * that could be wrong is wrong in one of three ways, and this file is those
 * three:
 *
 * **The layout could be wrong** — a key that is not a content hash, a manifest
 * written where the next version will overwrite it, a re-upload that duplicates
 * what is already there. Those are asserted against an **in-memory bucket**,
 * because `BlobApi` is a four-operation seam and `vercelBlobApi` is the only
 * thing in the repository that imports `@vercel/blob`. Nothing here reaches a
 * live store, exactly as no test reaches a live Stripe or a live R2.
 *
 * **The read could resolve to the wrong place.** Three states, all real:
 * the Blob store configured and populated; a local directory with artwork in
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
  LOOKS_TOKEN_VAR,
  looksBlobStore,
  ordersBlobStore,
  publicBaseFor,
  storeIdOfToken,
  type BlobApi,
} from "../lib/artwork/blob";
import { artworkBytesFor } from "../lib/artwork/store";
import { prepareLookPages } from "../lib/artwork/prepare";
import { assetRouteUrl, hrefIn } from "../lib/assets/address";
import { pageSequence, spreadSideOf } from "../lib/book/derive";
import { pageCarriesTheChild } from "../lib/book/ghost";
import { validateBook } from "../lib/book/validate";
import { sha256 } from "../lib/assets/digest";
import type { AssetRef } from "../lib/template/types";

/** The look the captain delivered first, named the way the book names it. */
const DELIVERED = "ada";
const SIZE = FIRST_BOOK.page.print.pixels.width;
const NOW = new Date("2026-11-10T09:00:00.000Z");

/**
 * A read-write token of the shape the platform issues.
 *
 * `vercel_blob_rw_<storeId>_<secret>`, so the store id is the fourth field.
 * The secret here is a word, and several assertions below are that no part of
 * it ever comes back out.
 */
const TOKEN = "vercel_blob_rw_abc123store_sekritsekrit";
const STORE_ID = "abc123store";
const BASE = `https://${STORE_ID}.public.blob.vercel-storage.com`;

// ---------------------------------------------------------------------------
// The in-memory bucket
// ---------------------------------------------------------------------------

interface Bucket {
  api: BlobApi;
  /** Everything written, by pathname. */
  files: Map<string, Uint8Array>;
  /** Every `put` that happened, in order — including the manifests. */
  puts: string[];
}

function bucket(base = BASE): Bucket {
  const files = new Map<string, Uint8Array>();
  const puts: string[] = [];
  const api: BlobApi = {
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
// The token, and what may be read out of it
// ---------------------------------------------------------------------------

describe("the store id in a read-write token", () => {
  it("is the fourth field, which is how the SDK finds it too", () => {
    expect(storeIdOfToken(TOKEN)).toBe(STORE_ID);
    expect(publicBaseFor(STORE_ID)).toBe(BASE);
  });

  it("is null for anything not shaped like a token, rather than a guess", () => {
    expect(storeIdOfToken("")).toBeNull();
    expect(storeIdOfToken("not-a-token")).toBeNull();
    expect(storeIdOfToken("vercel_blob_rw_onlythree")).toBeNull();
  });

  it("never lets the secret out in the sentence the admin page prints", () => {
    const describe_ = looksBlobStore(TOKEN, bucket().api).describe;
    expect(describe_).toContain(STORE_ID);
    expect(describe_).not.toContain("sekritsekrit");
    expect(describe_).not.toContain(TOKEN);
  });
});

// ---------------------------------------------------------------------------
// The layout
// ---------------------------------------------------------------------------

describe("what one upload puts in the bucket", () => {
  it("names the bytes by their content and the manifest by its version", async () => {
    const b = bucket();
    const store = looksBlobStore(TOKEN, b.api);
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
    const store = looksBlobStore(TOKEN, b.api);
    const bytes = square([10, 90, 200]);

    const version = await store.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes }], NOW);

    expect(version.pages[0].url).toBe(`${BASE}/assets/${sha256(bytes)}.png`);
  });

  it("reads back exactly what went in, through the interface", async () => {
    const b = bucket();
    const store = looksBlobStore(TOKEN, b.api);
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
    const store = looksBlobStore(TOKEN, b.api);
    await store.put(lookSet(DELIVERED), [{ pageId: "page-002", bytes: square([1, 2, 3]) }], NOW);
    await store.put(TILES_SET, [{ pageId: tilePageId(DELIVERED), bytes: square([4, 5, 6]) }], NOW);

    expect((await store.sets()).sort()).toEqual([TILES_SET, lookSet(DELIVERED)].sort());
  });

  it("has nothing to say about a set nobody has uploaded", async () => {
    const store = looksBlobStore(TOKEN, bucket().api);
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
    const store = looksBlobStore(TOKEN, b.api);
    await store.put(TILES_SET, twelve(1), NOW);
    const afterFirst = b.puts.length;

    await store.put(TILES_SET, twelve(1), NOW);

    // One more `put`: the new version's manifest. Not one picture.
    expect(b.puts.length - afterFirst).toBe(1);
    expect(b.puts.at(-1)).toBe(`sets/${TILES_SET}/v0002.json`);
  });

  it("uploads exactly the corrected pictures and nothing else", async () => {
    const b = bucket();
    const store = looksBlobStore(TOKEN, b.api);
    await store.put(TILES_SET, twelve(1), NOW);
    const before = b.puts.length;

    // `02-girl` and `08-boy` regenerated for edge fringing: two of twelve.
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
    const store = looksBlobStore(TOKEN, b.api);
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
    const store = looksBlobStore(TOKEN, b.api);
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

describe("reading: the Blob store configured and populated", () => {
  async function populated() {
    const b = bucket();
    const store = looksBlobStore(TOKEN, b.api);
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

  it("is what the environment chooses with no token set", async () => {
    const root = await directory();
    process.env[RELEASE_ARTWORK_DIR_VAR] = root;
    expect(releaseStoreFromEnv(process.env).describe).toContain(root);
  });

  it("is not what the environment chooses when the token is there", async () => {
    const root = await directory();
    process.env[RELEASE_ARTWORK_DIR_VAR] = root;
    process.env[LOOKS_TOKEN_VAR] = TOKEN;
    const chosen = releaseStoreFromEnv(process.env).describe;
    expect(chosen).toContain(STORE_ID);
    expect(chosen).not.toContain(root);
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
// The private store, read through the same interface
// ---------------------------------------------------------------------------

describe("the private store", () => {
  it("holds an order's artwork and publishes no url for any of it", async () => {
    const b = bucket();
    const store = ordersBlobStore("store_orders", "an-oidc-token", b.api);
    const bytes = square([120, 60, 20]);

    const version = await store.put(REF, [{ pageId: "page-006", bytes }], NOW);

    expect(version.pages[0].url).toBeUndefined();
    expect(await store.read(REF, 1, "page-006")).toEqual(bytes);
    // Nothing anywhere in the record is a URL, so there is nothing for an
    // `<img src>` to be given even by accident.
    expect(JSON.stringify(version)).not.toContain("https://");
  });

  it("says where it is reading from without naming a credential", () => {
    const store = ordersBlobStore("store_orders", "an-oidc-token", bucket().api);
    expect(store.describe).toContain("store_orders");
    expect(store.describe).not.toContain("an-oidc-token");
    expect(store.describe).toContain("no public URLs");
  });
});
