/**
 * **The captain's released artwork — in `olb-looks`, or on this machine, or
 * nowhere at all — and what the repository keeps instead of it.**
 *
 * Three sets were delivered on 10 November and `docs/artwork.md` is the
 * inventory, including the two portraits being regenerated and the mapping from
 * the captain's numbering to the look ids. This module is where they live and
 * how they are read back.
 *
 * ## Why none of it is in the repository, not even the manifest
 *
 * **The pixels** are 155 MB for one look of twenty-four pages, 22 MB of
 * portraits and 24 MB of ghost spreads. Twelve looks is the better part of two
 * gigabytes. The repository is public and git history is permanent, so a
 * gigabyte committed once is a gigabyte everybody clones forever, and
 * `.gitignore` excludes the directory this writes to —
 * `test/release-artwork.test.ts` asserts that rule the same way
 * `test/order-artwork.test.ts` asserts it for a customer's own child.
 *
 * **The manifest** — the ids, the digests, the measured sizes — could have been
 * committed, and the reason it is not is the one property this repository
 * cannot afford to lose: *a fresh clone and the test suite must keep working
 * with no artwork at all.* A committed manifest naming bytes nobody has is a
 * book that declares twenty-four uploaded pages and cannot draw one of them.
 * Every page would render as empty cream, `npm test` would go red on a clean
 * checkout, and the placeholder that made this whole flow testable before any
 * artwork existed (`lib/book/types.ts` § `BabySpec`) would be dead code.
 *
 * So the manifest lives **beside the bytes**, written by `npm run artwork`, and
 * is read at request time. Present, the real pages draw; absent,
 * `templates/first-book.ts` draws exactly what it has always drawn. Nothing in
 * the repository changes when artwork lands — including `FIRST_BOOK.rev`, which
 * is what keeps `npm run print`'s byte-identity gate meaningful on every
 * machine.
 *
 * ## The consequence of that, stated plainly
 *
 * **The artwork binding is environment state, so it is outside the book's
 * `rev`.** `lib/book/rev.ts` exists so a reprint of a year-old order is the
 * document the buyer approved; a re-import of corrected artwork changes what a
 * reprint *looks like* without changing the rev, and this module cannot fix
 * that on its own. Two things keep it from being dangerous today: the store
 * **never overwrites** — a re-import is a new version and every earlier one
 * stays readable — and `lib/book/order-art.ts` already pins a photo-path
 * order's own artwork in the order's record. Pinning a chosen-look order to an
 * artwork version is the task that follows the storage decision, because the
 * honest place to record it is wherever the bytes end up living.
 *
 * ## The store is the per-order seam, not a second one
 *
 * `./store.ts` is one interface and six operations, written for the photo path.
 * This reuses it: one key per set, versions that only ever accumulate, a
 * manifest of `AssetRef`s beside the pages. Two storage seams would have been
 * two migrations the day the captain picked a bucket, and the one that got
 * missed would have been the one holding the pictures.
 *
 * ## Where the bytes actually are now
 *
 * The captain picked Vercel Blob and created two stores; this half reads the
 * **public** one, `olb-looks`, through `./blob.ts`. Three states, and all three
 * are real:
 *
 * 1. **`BLOB_READ_WRITE_TOKEN` set** — the looks' pages, the portrait tiles and
 *    the golden halves come out of `olb-looks`, each with a CDN URL, which is
 *    what `urls` below carries and why a twenty-five page preview is not
 *    twenty-five function invocations.
 * 2. **A local directory with artwork in it** — the captain's own machine after
 *    `npm run artwork`. No URLs: a directory has no address, so every picture is
 *    served by `/api/assets/<digest>.png`.
 * 3. **Neither** — a fresh clone, CI, and anybody who has not imported
 *    anything. `templates/first-book.ts` draws every page from its own numbers
 *    and the book is complete and printable. This is the state the whole test
 *    suite runs in and it is not a degraded one.
 *
 * `test/artwork-blob.test.ts` asserts all three, because each is how the others
 * go wrong.
 */

import path from "node:path";
import { value } from "../env";
import type { AssetAddresses } from "../assets/address";
import type { AssetRef } from "../template/types";
import type { BookTemplate } from "../book/types";
import type { PreviewAsset } from "../book/preview-art";
import { bookWithReleaseArtwork } from "../book/release-art";
import { isReleaseSet } from "./keys";
import { LOOKS_TOKEN_VAR, looksBlobStore, looksTokenIn } from "./blob";
import {
  DEFAULT_ARTWORK_DIR,
  localArtworkStore,
  type ArtworkStore,
  type PublicArtworkStore,
} from "./store";

/** The variable that moves the whole of it somewhere else. */
export const RELEASE_ARTWORK_DIR_VAR = "RELEASE_ARTWORK_DIR";

/**
 * Where it writes with nothing configured: inside the directory the per-order
 * store already uses, so **one `.gitignore` rule covers both** and there is no
 * second line to lose in a merge. An order's key is `BK-…` and a release set's
 * is `tiles`, `ghosts` or `look-…`, so the two cannot collide.
 */
export const DEFAULT_RELEASE_ARTWORK_DIR = path.join(DEFAULT_ARTWORK_DIR, "release");

/** The two sets that are not a look. Named, because they are keys on disk. */
export const TILES_SET = "tiles";
export const GHOSTS_SET = "ghosts";

/** One look's finished pages. The folder name *is* the look id, as ever. */
export function lookSet(lookId: string): string {
  return `look-${lookId}`;
}

/**
 * A key a store will turn into a path segment or a blob prefix.
 *
 * Re-exported rather than defined here: it moved to `./keys.ts` the day there
 * were two implementations, because the one thing the filesystem and the bucket
 * may not disagree about is what a key may contain. `./keys.ts` carries the
 * reasoning.
 */
export { isReleaseSet };

/** The pageId a portrait is stored under, inside the `tiles` set. */
export function tilePageId(lookId: string): string {
  return `tile-${lookId}`;
}

export function lookOfTilePageId(pageId: string): string | null {
  return pageId.startsWith("tile-") ? pageId.slice("tile-".length) : null;
}

/**
 * The local store, tagged as the only kind of thing it may hold.
 *
 * The tag and the key check are the **same fact** stated twice — a store keyed
 * by release set names holds released artwork — so they are set together here
 * and nowhere else. `./store.ts` § The one thing that may never cross says what
 * the tag is for.
 */
export function localReleaseStore(root: string): PublicArtworkStore {
  return { holds: "released", ...localArtworkStore(root, isReleaseSet) };
}

/**
 * The store this environment describes: `olb-looks` when it is configured, this
 * machine's filesystem when it is not.
 *
 * Both answer the same six operations, so **nothing below this line knows which
 * one it got** — which is the entire reason the interface was written before
 * either existed.
 */
export function releaseStoreFromEnv(
  env: Record<string, string | undefined> = process.env,
): PublicArtworkStore {
  const token = looksTokenIn(env);
  if (token) return looksBlobStore(token);
  return localReleaseStore(releaseRoot(env));
}

/** The directory the local store reads under this environment. */
export function releaseRoot(env: Record<string, string | undefined> = process.env): string {
  const configured = value(env, RELEASE_ARTWORK_DIR_VAR);
  return configured ? path.resolve(configured) : path.join(process.cwd(), DEFAULT_RELEASE_ARTWORK_DIR);
}

/**
 * What the captain has delivered, as the book needs it.
 *
 * `null` nowhere here: an empty object for every axis is the "nothing delivered"
 * state and `anyReleaseArtwork` is the question a caller actually asks, so no
 * call site has to handle both a null and an empty map.
 */
export interface ReleaseArtwork {
  /** Look id -> page id -> the finished page image. Partial on purpose. */
  pages: Record<string, Record<string, AssetRef>>;
  /** Look id -> the chooser's portrait tile, flattened onto white at import. */
  tiles: Record<string, AssetRef>;
  /** Page id -> the preview-only golden half. Never an `AssetRef`. */
  ghosts: Record<string, PreviewAsset>;
  /**
   * Digest -> public URL, for the pictures that have one.
   *
   * Filled from `ArtworkPage.url`, which the public Blob store records and the
   * local filesystem store does not — a directory has no address. **Empty is
   * the normal state** and means every picture is served by
   * `/api/assets/<digest>.png`, which answers from wherever the bytes are.
   * `lib/assets/address.ts` is that rule and the reason a URL is not allowed
   * anywhere near an `AssetRef`.
   */
  urls: AssetAddresses;
  /** Where it was read from, in a sentence. Never a credential. */
  describe: string;
  /** One line per set, for the admin page and for `npm run artwork -- status`. */
  sets: Array<{ set: string; version: number; at: string; pages: number }>;
}

export function emptyReleaseArtwork(describe = "nothing"): ReleaseArtwork {
  return { pages: {}, tiles: {}, ghosts: {}, urls: {}, describe, sets: [] };
}

export function anyReleaseArtwork(art: ReleaseArtwork): boolean {
  return (
    Object.keys(art.pages).length > 0 ||
    Object.keys(art.tiles).length > 0 ||
    Object.keys(art.ghosts).length > 0
  );
}

/** An `AssetRef` out of the store, retyped as the preview-only thing it is. */
export function asPreviewAsset(ref: AssetRef): PreviewAsset {
  return {
    kind: "preview",
    digest: ref.sha256,
    mime: "image/png",
    px: ref.px ?? [0, 0],
    ...(ref.label ? { label: ref.label } : {}),
  };
}

/**
 * The artwork for one book, read through the store.
 *
 * **Driven by the book's own look list** rather than by a listing of the store,
 * which is what keeps it honest: a set for a look the book does not offer is
 * ignored rather than bound to nothing.
 *
 * Only the **current** version of each set is bound. The earlier ones are still
 * on disk, which is the recovery this store exists for; nothing draws them.
 */
export async function releaseArtworkFor(
  book: BookTemplate,
  store: ArtworkStore = releaseStoreFromEnv(),
): Promise<ReleaseArtwork> {
  const out = emptyReleaseArtwork(store.describe);
  // The address book is filled by the same read that produced the refs, which
  // is what makes it exact: a digest is in it only because this store just
  // said it holds those bytes at that URL.
  const urls: Record<string, string> = {};

  for (const look of book.looks) {
    const version = await store.current(lookSet(look.id));
    if (!version || version.pages.length === 0) continue;
    const pages: Record<string, AssetRef> = {};
    for (const page of version.pages) {
      pages[page.pageId] = page.asset;
      if (page.url) urls[page.asset.sha256] = page.url;
    }
    out.pages[look.id] = pages;
    out.sets.push({
      set: lookSet(look.id),
      version: version.version,
      at: version.at,
      pages: version.pages.length,
    });
  }

  const tiles = await store.current(TILES_SET);
  if (tiles) {
    for (const page of tiles.pages) {
      const lookId = lookOfTilePageId(page.pageId);
      // A portrait for a look the book does not offer is dropped here rather
      // than reported: the twelve portraits arrived before eleven of the looks
      // have any pages, and a look that is renamed one day should not break a
      // chooser over a tile.
      if (lookId && book.looks.some((l) => l.id === lookId)) {
        out.tiles[lookId] = page.asset;
        if (page.url) urls[page.asset.sha256] = page.url;
      }
    }
    out.sets.push({
      set: TILES_SET,
      version: tiles.version,
      at: tiles.at,
      pages: tiles.pages.length,
    });
  }

  const ghosts = await store.current(GHOSTS_SET);
  if (ghosts) {
    for (const page of ghosts.pages) {
      out.ghosts[page.pageId] = asPreviewAsset(page.asset);
      if (page.url) urls[page.asset.sha256] = page.url;
    }
    out.sets.push({
      set: GHOSTS_SET,
      version: ghosts.version,
      at: ghosts.at,
      pages: ghosts.pages.length,
    });
  }

  out.urls = urls;
  return out;
}

/** The book bound to the delivered artwork, and where that artwork is readable. */
export interface Delivered {
  book: BookTemplate;
  /**
   * The address book for the pictures the book now names, for the one screen
   * that cannot ask the environment anything: the browser. It travels as a prop
   * and is `{}` whenever the store has no public URLs.
   */
  assets: AssetAddresses;
}

/**
 * **The one line a route adds: the published book, bound to what the store has.**
 *
 * Every server component and every route that draws or prints this book calls
 * this instead of using `FIRST_BOOK` directly, and that is the whole of the
 * wiring. With nothing delivered it returns the committed book unchanged —
 * which is why a fresh clone, the test suite and CI are untouched by any of
 * this — and `lib/book/release-art.ts` carries the argument for what it changes
 * when something has been.
 *
 * **`deliveredBook` is the same read with the address book kept**, for the
 * routes that hand the book to a client component. One read, two answers: a
 * page that called `bookAsDelivered` and then asked for the URLs separately
 * would read every manifest twice, which over a bucket is twice the network.
 */
export async function deliveredBook(
  book: BookTemplate,
  store: ArtworkStore = releaseStoreFromEnv(),
): Promise<Delivered> {
  const art = await releaseArtworkFor(book, store);
  return { book: bookWithReleaseArtwork(book, art), assets: art.urls };
}

export async function bookAsDelivered(
  book: BookTemplate,
  store: ArtworkStore = releaseStoreFromEnv(),
): Promise<BookTemplate> {
  return (await deliveredBook(book, store)).book;
}

// ---------------------------------------------------------------------------
// Reading one picture back by its digest
// ---------------------------------------------------------------------------

/**
 * Every digest this store holds, to where it is.
 *
 * `lib/assets/resolve.ts` is handed an `AssetRef` and nothing else, so the one
 * question it has to be able to ask is *"do you have these bytes"* — which the
 * interface cannot answer without being told the set, the version and the page
 * id. The index below is that lookup, built out of the manifests the store
 * already keeps, **entirely through the store's own operations**: enumerating
 * the sets was a `readdir` here until the bucket arrived and needed to list a
 * prefix instead, which is why `sets` is the sixth operation rather than a
 * special case in this file.
 *
 * Every version is indexed, not only the current one, so a picture that is no
 * longer bound is still readable — that is the point of never overwriting.
 *
 * It is keyed by the store's own `describe`, which changes when the environment
 * points somewhere else, so a test that swaps `RELEASE_ARTWORK_DIR` or sets a
 * Blob token does not read the previous store's index.
 */
type Located = { set: string; version: number; pageId: string };

let cached: { key: string; entries: Map<string, Located>; missed: Set<string> } | null = null;

/** For tests, and for anything that has just written artwork and wants to read it. */
export function forgetReleaseArtwork(): void {
  cached = null;
}

async function index(store: ArtworkStore): Promise<Map<string, Located>> {
  if (cached && cached.key === store.describe) return cached.entries;
  const entries = new Map<string, Located>();
  for (const set of await store.sets()) {
    for (const version of await store.versions(set)) {
      for (const page of version.pages) {
        entries.set(page.asset.sha256, { set, version: version.version, pageId: page.pageId });
      }
    }
  }
  cached = { key: store.describe, entries, missed: new Set() };
  return entries;
}

/**
 * The bytes for a digest, or null.
 *
 * **It does not verify the digest and that is deliberate**: both callers
 * already do, because both already have to for the fixture store —
 * `lib/assets/resolve.ts` throws `AssetDigestMismatch` and
 * `app/api/assets/[key]/route.ts` answers 500. Checking here as well would be a
 * third implementation of the rule and the only thing a third implementation
 * adds is a third place for it to be wrong. The rule itself is not optional: a
 * file replaced under its own name would print the wrong child.
 */
export async function releaseBytesFor(
  digest: string,
  env: Record<string, string | undefined> = process.env,
): Promise<Uint8Array | null> {
  if (!/^[0-9a-f]{64}$/.test(digest)) return null;
  const store = releaseStoreFromEnv(env);
  if (cached?.key === store.describe && cached.missed.has(digest)) return null;
  let found = (await index(store)).get(digest);
  if (!found) {
    // One rebuild on a miss: a dev server started before an import would
    // otherwise answer 404 for artwork that is on the disk, and the person
    // looking at the screen has no way to know the answer is "restart it". The
    // miss is then remembered, because the commonest absent digest is a
    // buyer's own photograph — which lives somewhere else entirely and would
    // rebuild this index on every page of a print file.
    forgetReleaseArtwork();
    found = (await index(store)).get(digest);
    if (!found) {
      cached?.missed.add(digest);
      return null;
    }
  }
  return store.read(found.set, found.version, found.pageId);
}
