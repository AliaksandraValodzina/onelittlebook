/**
 * **The captain's released artwork, on this machine — and what the repository
 * keeps instead of it.**
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
 * `./store.ts` is one interface and five operations with a local
 * implementation, written for the photo path. This reuses it: one key per set,
 * versions that only ever accumulate, a manifest of `AssetRef`s beside the
 * pages. Two storage seams would be two migrations the day the captain picks
 * between Vercel Blob and the R2 content origin, and the one that got missed
 * would be the one holding the pictures. That decision is still the captain's:
 * `./store.ts` § THE DECISION THE CAPTAIN HAS NOT MADE states both candidates
 * and chooses neither.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";
import { value } from "../env";
import type { AssetRef } from "../template/types";
import type { BookTemplate } from "../book/types";
import type { PreviewAsset } from "../book/preview-art";
import { bookWithReleaseArtwork } from "../book/release-art";
import { DEFAULT_ARTWORK_DIR, localArtworkStore, type ArtworkStore } from "./store";

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
 * A key the local store will turn into a path segment.
 *
 * Checked for the same reason an order reference is, even though every value
 * here is a constant of this repository rather than anything from a request:
 * the check is what makes that still true after somebody wires a set name to
 * something a user typed.
 */
const RELEASE_KEY = /^(tiles|ghosts|look-[a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function isReleaseSet(value: unknown): boolean {
  return typeof value === "string" && RELEASE_KEY.test(value);
}

/** The pageId a portrait is stored under, inside the `tiles` set. */
export function tilePageId(lookId: string): string {
  return `tile-${lookId}`;
}

export function lookOfTilePageId(pageId: string): string | null {
  return pageId.startsWith("tile-") ? pageId.slice("tile-".length) : null;
}

/** The store, rooted wherever this environment says. */
export function releaseStoreFromEnv(env: Record<string, string | undefined> = process.env): ArtworkStore {
  const configured = value(env, RELEASE_ARTWORK_DIR_VAR);
  return localArtworkStore(
    configured ? path.resolve(configured) : path.join(process.cwd(), DEFAULT_RELEASE_ARTWORK_DIR),
    isReleaseSet,
  );
}

/** The directory `releaseStoreFromEnv` reads, for the one listing the interface has no operation for. */
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
  /** Where it was read from, in a sentence. Never a credential. */
  describe: string;
  /** One line per set, for the admin page and for `npm run artwork -- status`. */
  sets: Array<{ set: string; version: number; at: string; pages: number }>;
}

export function emptyReleaseArtwork(describe = "nothing"): ReleaseArtwork {
  return { pages: {}, tiles: {}, ghosts: {}, describe, sets: [] };
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
 * **Driven by the book's own look list** rather than by a directory listing,
 * which is what keeps it honest in two directions: a set for a look the book
 * does not offer is ignored rather than bound to nothing, and the five
 * interface operations are enough — no "list everything" capability every
 * future implementation would have to provide.
 *
 * Only the **current** version of each set is bound. The earlier ones are still
 * on disk, which is the recovery this store exists for; nothing draws them.
 */
export async function releaseArtworkFor(
  book: BookTemplate,
  store: ArtworkStore = releaseStoreFromEnv(),
): Promise<ReleaseArtwork> {
  const out = emptyReleaseArtwork(store.describe);

  for (const look of book.looks) {
    const version = await store.current(lookSet(look.id));
    if (!version || version.pages.length === 0) continue;
    const pages: Record<string, AssetRef> = {};
    for (const page of version.pages) pages[page.pageId] = page.asset;
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
      if (lookId && book.looks.some((l) => l.id === lookId)) out.tiles[lookId] = page.asset;
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
    for (const page of ghosts.pages) out.ghosts[page.pageId] = asPreviewAsset(page.asset);
    out.sets.push({
      set: GHOSTS_SET,
      version: ghosts.version,
      at: ghosts.at,
      pages: ghosts.pages.length,
    });
  }

  return out;
}

/**
 * **The one line a route adds: the published book, bound to what is on disk.**
 *
 * Every server component and every route that draws or prints this book calls
 * this instead of using `FIRST_BOOK` directly, and that is the whole of the
 * wiring. With nothing delivered it returns the committed book unchanged —
 * which is why a fresh clone, the test suite and CI are untouched by any of
 * this — and `lib/book/release-art.ts` carries the argument for what it changes
 * when something has been.
 */
export async function bookAsDelivered(
  book: BookTemplate,
  store: ArtworkStore = releaseStoreFromEnv(),
): Promise<BookTemplate> {
  return bookWithReleaseArtwork(book, await releaseArtworkFor(book, store));
}

// ---------------------------------------------------------------------------
// Reading one picture back by its digest
// ---------------------------------------------------------------------------

/**
 * Every digest this machine holds, to where it is.
 *
 * `lib/assets/resolve.ts` is handed an `AssetRef` and nothing else, so the one
 * question it has to be able to ask is *"do you have these bytes"* — which the
 * five-operation interface cannot answer without being told the set, the
 * version and the page id. The index below is that lookup, built out of the
 * manifests the store already keeps, through the store's own operations, with
 * **one exception**: enumerating which sets exist is a directory listing, and
 * that is the one line in this file that knows the local implementation's
 * layout. A bucket implementation would list a prefix instead, which is the
 * same operation under a different name.
 *
 * Every version is indexed, not only the current one, so a picture that is no
 * longer bound is still readable — that is the point of never overwriting.
 */
type Located = { set: string; version: number; pageId: string };

let cached: { root: string; entries: Map<string, Located>; missed: Set<string> } | null = null;

/** For tests, and for anything that has just written artwork and wants to read it. */
export function forgetReleaseArtwork(): void {
  cached = null;
}

async function setsOn(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && isReleaseSet(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
}

async function index(
  root: string,
  store: ArtworkStore,
): Promise<Map<string, Located>> {
  if (cached && cached.root === root) return cached.entries;
  const entries = new Map<string, Located>();
  for (const set of await setsOn(root)) {
    for (const version of await store.versions(set)) {
      for (const page of version.pages) {
        entries.set(page.asset.sha256, { set, version: version.version, pageId: page.pageId });
      }
    }
  }
  cached = { root, entries, missed: new Set() };
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
  const root = releaseRoot(env);
  const store = releaseStoreFromEnv(env);
  if (cached?.root === root && cached.missed.has(digest)) return null;
  let found = (await index(root, store)).get(digest);
  if (!found) {
    // One rebuild on a miss: a dev server started before an import would
    // otherwise answer 404 for artwork that is on the disk, and the person
    // looking at the screen has no way to know the answer is "restart it". The
    // miss is then remembered, because the commonest absent digest is a
    // buyer's own photograph — which lives somewhere else entirely and would
    // rebuild this index on every page of a print file.
    forgetReleaseArtwork();
    found = (await index(root, store)).get(digest);
    if (!found) {
      cached?.missed.add(digest);
      return null;
    }
  }
  return store.read(found.set, found.version, found.pageId);
}
