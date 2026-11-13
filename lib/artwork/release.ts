/**
 * **The captain's released artwork — in the public R2 bucket, or on this
 * machine, or nowhere at all — and what the repository keeps instead of it.**
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
 * The artwork is in **Cloudflare R2**, in two buckets, and this half reads the
 * **public** one through `./r2.ts` — `./store.ts` § THE DECISION has the
 * numbers that moved it off Vercel Blob. Three states, and all three are real:
 *
 * 1. **The looks bucket configured** — `R2_LOOKS_BUCKET` and `R2_PUBLIC_BASE`
 *    with the account and key beside them. The looks' pages, the portrait tiles
 *    and the golden halves come out of that bucket, each with a URL on the
 *    captain's own domain, which is what `urls` below carries and why a
 *    twenty-five page preview is not twenty-five function invocations.
 * 2. **A local directory with artwork in it** — the captain's own machine after
 *    `npm run artwork`. No URLs: a directory has no address, so every picture is
 *    served by `/api/assets/<digest>.png`.
 * 3. **Neither** — a fresh clone, CI, and anybody who has not imported
 *    anything. `templates/first-book.ts` draws every page from its own numbers
 *    and the book is complete and printable. This is the state the whole test
 *    suite runs in and it is not a degraded one.
 *
 * `test/artwork-buckets.test.ts` asserts all three, because each is how the
 * others go wrong.
 */

import path from "node:path";
import { value } from "../env";
import type { AssetAddresses } from "../assets/address";
import type { AssetRef } from "../template/types";
import type { BookTemplate } from "../book/types";
import type { PreviewAsset } from "../book/preview-art";
import { bookWithReleaseArtwork } from "../book/release-art";
import { isReleaseSet } from "./keys";
import { PUBLIC_BASE_VAR, looksBucketIn, looksR2Store, missingFor, publicBucketCollision } from "./r2";
import {
  DEFAULT_ARTWORK_DIR,
  NO_SCREEN_ADDRESSES,
  localArtworkStore,
  type ArtworkStore,
  type PublicArtworkStore,
  type ScreenAddress,
  type ScreenAddresses,
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
  return {
    holds: "released",
    ...localArtworkStore(root, isReleaseSet),
    /**
     * **A directory holds no screen derivatives, and that is the answer rather
     * than a gap.**
     *
     * A derivative exists for exactly one reason — to send 0.13 MB over a CDN
     * instead of 2.6 MB — and a local store has no CDN and no URL at all
     * (`./store.ts` § `ScreenAddress`). On this machine every picture is served
     * by `/api/assets/<digest>.png` from the local disk, where the 26×
     * saving buys a few milliseconds of loopback. So the honest local answer is
     * "none": the preview falls back to the master exactly as it does for a
     * fresh clone, which is the path `hrefIn` has always taken.
     *
     * Writing the files anyway would be bytes in a directory nothing can
     * address. `npm run artwork:upload` is the command that makes derivatives
     * and it only ever talks to the public R2 bucket.
     */
    async screens() {
      return NO_SCREEN_ADDRESSES;
    },
    async putScreens() {
      return NO_SCREEN_ADDRESSES;
    },
  };
}

/**
 * The store this environment describes: the public R2 bucket when it is
 * configured, this machine's filesystem when it is not.
 *
 * Both answer the same six operations, so **nothing below this line knows which
 * one it got** — which is the entire reason the interface was written before
 * either existed, and the reason the move from Vercel Blob to R2 changed no
 * caller.
 *
 * **Half-configured falls back and says which rows are empty**, and so does a
 * public bucket that is also one of the private ones — `./r2.ts`
 * § `looksBucketIn` is why that collision is refused rather than resolved. The
 * local store with no artwork in it is a state this repository is built to be
 * fine in; a CDN serving a customer's child is not.
 */
export function releaseStoreFromEnv(
  env: Record<string, string | undefined> = process.env,
): PublicArtworkStore {
  const bucket = looksBucketIn(env);
  if (bucket) return looksR2Store(bucket);

  const local = localReleaseStore(releaseRoot(env));
  const collision = publicBucketCollision(env);
  if (collision) {
    return {
      ...local,
      describe:
        `${local.describe} — the public artwork bucket is also ${collision}, which is a ` +
        "private bucket, so it is refused: a custom domain is attached to a bucket and " +
        "not to a prefix",
    };
  }
  const missing = missingFor(env, "looks");
  if (missing.length === LOOKS_ROWS) return local;
  return {
    ...local,
    describe:
      `${local.describe} — the public artwork bucket is half-configured ` +
      `(${missing.join(", ")} empty), so nothing is read from R2` +
      (missing.length === 1 && missing[0] === PUBLIC_BASE_VAR
        ? `: reads come from the custom domain and never from a signed URL, so ${PUBLIC_BASE_VAR} ` +
          "is not optional"
        : ""),
  };
}

/** How many rows the public artwork bucket needs. Derived, never typed twice. */
const LOOKS_ROWS = missingFor({}, "looks").length;

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
   * Filled from `ArtworkPage.url`, which the public bucket's store records and the
   * local filesystem store does not — a directory has no address. **Empty is
   * the normal state** and means every picture is served by
   * `/api/assets/<digest>.png`, which answers from wherever the bytes are.
   * `lib/assets/address.ts` is that rule and the reason a URL is not allowed
   * anywhere near an `AssetRef`.
   */
  urls: AssetAddresses;
  /**
   * Master digest -> **the screen-sized copy of that picture**, for the pages
   * a visitor looks at rather than the file that is printed.
   *
   * A second map beside `urls` and deliberately not folded into it: `urls` is
   * where *those bytes* are, and this is where a different, smaller picture
   * made from them is. `./store.ts` § `ScreenAddress` and
   * `lib/assets/screen.ts` carry the argument for why the two may never be the
   * same map — the one that must never happen is a 1600 px page in a printed
   * book.
   *
   * **Empty is the ordinary state** and means every picture is drawn at full
   * resolution, which is what a fresh clone, CI and a local import all do.
   */
  screen: ScreenAddresses;
  /** Where it was read from, in a sentence. Never a credential. */
  describe: string;
  /** One line per set, for the admin page and for `npm run artwork -- status`. */
  sets: Array<{ set: string; version: number; at: string; pages: number }>;
}

export function emptyReleaseArtwork(describe = "nothing"): ReleaseArtwork {
  return { pages: {}, tiles: {}, ghosts: {}, urls: {}, screen: NO_SCREEN_ADDRESSES, describe, sets: [] };
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
 *
 * **Every set is asked for at once, and the answers are used in the book's own
 * order.** One `current` per look, in a loop with an `await` in it, was
 * fourteen serial round trips to a bucket on the other side of the world
 * before the tiles and the ghosts had even been asked for — about eight
 * seconds on the front of every screen of the buyer flow. The reads are
 * independent, so they are issued together; what must *not* become
 * concurrent is the **order of the result**, which is why `sets` and `pages`
 * are filled by walking `book.looks` over the settled answers rather than by
 * whichever bucket replied first. `test/release-artwork.test.ts` holds that
 * with a store that answers the last look instantly and the first one slowly.
 */
export async function releaseArtworkFor(
  book: BookTemplate,
  store: PublicArtworkStore = releaseStoreFromEnv(),
): Promise<ReleaseArtwork> {
  const out = emptyReleaseArtwork(store.describe);
  // The address book is filled by the same read that produced the refs, which
  // is what makes it exact: a digest is in it only because this store just
  // said it holds those bytes at that URL.
  const urls: Record<string, string> = {};

  const [lookVersions, tiles, ghosts, held] = await Promise.all([
    Promise.all(book.looks.map((look) => store.current(lookSet(look.id)))),
    store.current(TILES_SET),
    store.current(GHOSTS_SET),
    store.screens(),
  ]);

  for (const [i, look] of book.looks.entries()) {
    const version = lookVersions[i];
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

  if (tiles) {
    for (const page of tiles.pages) {
      const lookId = lookOfTilePageId(page.pageId);
      // A portrait for a look the book does not offer is dropped here rather
      // than reported: the portraits arrived before most of the looks
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
  /**
   * The derivatives, **narrowed to the pictures this book actually names**.
   *
   * One listing of one prefix, then a filter — rather than a question per
   * picture — because the whole map travels to the browser as a prop and a
   * store that has been re-uploaded a dozen times holds derivatives for pages
   * no version binds any more. Those are still readable and nothing draws
   * them, which is the same rule the versions themselves follow.
   */
  const screen: Record<string, ScreenAddress> = {};
  for (const digest of Object.keys(urls)) {
    const found = held[digest];
    if (found) screen[digest] = found;
  }
  out.screen = screen;
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
  /**
   * **Where the screen-sized copy of each of those pictures is.**
   *
   * The preview resolves this first and the master second; the print path
   * resolves neither, because it resolves *bytes* by digest and a derivative
   * has no `AssetRef` anywhere. `lib/assets/screen.ts` is the one module that
   * turns this map into an address, and no module the print path imports may
   * import it — `test/screen-derivatives.test.ts` walks the import graph off
   * disk, and `test/no-derivative-in-a-print-file.ts` is the compiler's half.
   */
  screen: ScreenAddresses;
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
  store?: PublicArtworkStore,
): Promise<Delivered> {
  if (!store) return deliveredFromEnv(book);
  return deliveredFrom(book, store);
}

export async function bookAsDelivered(
  book: BookTemplate,
  store?: PublicArtworkStore,
): Promise<BookTemplate> {
  return (await deliveredBook(book, store)).book;
}

async function deliveredFrom(book: BookTemplate, store: PublicArtworkStore): Promise<Delivered> {
  const art = await releaseArtworkFor(book, store);
  return { book: bookWithReleaseArtwork(book, art), assets: art.urls, screen: art.screen };
}

// ---------------------------------------------------------------------------
// The catalogue, held for a minute
// ---------------------------------------------------------------------------

/**
 * **How long a read of the store is reused before it is made again.**
 *
 * The thing being cached is *which version of each set is current* — a fact
 * that changes only when the captain runs `npm run artwork:upload`, a handful
 * of times a week. The cost of not caching it is the whole bucket read on the
 * front of every page of the buyer flow, for every visitor.
 *
 * A minute is chosen against the promise `npm run artwork:upload` makes in its
 * closing line and this file makes above: **an upload is picked up on its own,
 * with no redeploy.** It still is — a minute later at worst, which is what
 * "time-based revalidation" buys and why the window is a minute rather than an
 * hour.
 *
 * **Why a plain in-process memo and not `"use cache"` or `unstable_cache`.**
 * Both of those serialise what they hold into Next's data cache, and what is
 * held here is a read of an *environment*: it is keyed by `store.describe`,
 * which is the whole point — a dev server that repoints `RELEASE_ARTWORK_DIR`,
 * or an environment whose bucket rows are half-filled, must not see the
 * previous store's catalogue. A memo beside `index` below is keyed on exactly
 * that, is identical on the local filesystem store and the bucket (point 3 of
 * this file's header: the no-artwork state stays one cheap read and says
 * nothing), and is dropped by `forgetReleaseArtwork` like every other cache in
 * this module. On Fluid Compute an instance serves many requests, so one read
 * a minute per instance is what this costs.
 */
export const CATALOGUE_TTL_MS = 60_000;

type Held = { key: string; at: number; delivered: Promise<Delivered> };
let catalogue: Held | null = null;

/** The clock, as an argument, so the window itself is testable. */
let now: () => number = () => Date.now();

/** For tests: drive the TTL rather than waiting out a minute of real time. */
export function setCatalogueClock(clock: (() => number) | null): void {
  now = clock ?? (() => Date.now());
}

function deliveredFromEnv(book: BookTemplate): Promise<Delivered> {
  const store = releaseStoreFromEnv();
  // The book is part of the key because `deliveredBook` takes one: a second
  // title would otherwise be served the first one's artwork.
  const key = `${book.id}@${book.rev} ${store.describe}`;
  const at = now();
  if (catalogue && catalogue.key === key && at - catalogue.at < CATALOGUE_TTL_MS) {
    return catalogue.delivered;
  }
  // The promise is cached, not the value, so fourteen visitors arriving
  // together make one read between them rather than fourteen.
  const delivered = deliveredFrom(book, store).catch((err: unknown) => {
    if (catalogue?.delivered === delivered) catalogue = null;
    throw err;
  });
  catalogue = { key, at, delivered };
  return delivered;
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
  catalogue = null;
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
