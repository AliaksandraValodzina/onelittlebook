/**
 * **The artwork store's layout and version arithmetic, over any object store.**
 *
 * `./store.ts` is the interface and its reasoning; `./r2.ts` is the bucket this
 * repository actually talks to. This is the part in between: the key layout, the
 * content addressing, the version arithmetic and the refusal of a bad key, over
 * a **four-operation seam** that knows nothing about any provider.
 *
 * It was inside `lib/artwork/blob.ts` while the artwork was on Vercel Blob. It
 * is here now because the move to R2 had to be a *new implementation of the
 * seam* and not a rewrite of the layout — and the only way to be sure the
 * layout came across unchanged is for it to be the same code. The keys below
 * are byte-for-byte the keys the Blob store wrote, which is also what the
 * captain's existing uploads are under.
 *
 * ## The layout, and why the bytes are content-addressed
 *
 * ```
 *   assets/<sha256>.png            the bytes, named by their own content
 *   sets/<set>/v0001.json          one version's manifest
 *   screen/<sha256>-w1600.webp     a screen-sized copy of those bytes
 * ```
 *
 * The third line is the only one named after **another** picture's content
 * rather than its own, and `./keys.ts` § `screenKey` says why: a reader holds
 * the master's digest and needs to know whether a screen-sized copy of it
 * exists without a second manifest to consult. It is read by
 * `objectScreenStore` below, which only the public store composes in.
 *
 * **A picture's key is its digest**, which buys three things this path actually
 * needs. A corrected page is *different bytes*, so it lands on a new key and no
 * CDN anywhere can serve the stale one — "I uploaded it and the old one is
 * still showing" is the failure that would otherwise be unanswerable. Re-running
 * the upload with nothing changed uploads **nothing**, because every key is
 * already there. And a page that appears in two versions is stored once.
 *
 * **The keys are portable, which is the point of them being this dull.** They
 * are a hash, a set name and a padded integer: no provider's identifier, no
 * store id, no URL and no account in any of them. That is what made the move
 * off Vercel Blob a new `ObjectApi` and nothing else, and it is what will make
 * the next move the same — `docs/artwork.md` § The keys outlive the provider.
 *
 * **The manifest is the thing that is versioned**, which is the whole of how
 * `put` keeps its promise never to overwrite (`./store.ts` § Versions): the
 * bytes are immutable and shared, and a version is a list naming which of them
 * a page was at that moment.
 *
 * In the public bucket the manifest is public too, and that is not an oversight:
 * it is page ids, digests and sizes **of pictures that are already public**, and
 * a reader who can list them learns nothing they could not learn by opening the
 * preview. In the private bucket it is private with everything else.
 *
 * ## Public is a URL; private has nowhere to put one
 *
 * `ObjectStoreConfig.publicBase` is the whole of the difference, and it is one
 * field rather than two: a store with a public base records a URL on every page
 * it writes (`./manifest.ts` § `ArtworkPage.url`), which is what lets a
 * twenty-five page preview be twenty-five CDN reads instead of twenty-five
 * function invocations; a store without one records **no URL at all**, because
 * there is no URL — reads go through the authenticated admin route.
 *
 * There used to be an `access: "public" | "private"` beside it, which was the
 * same fact in a second encoding and therefore a way for the two to disagree.
 * The bucket decides who may read it; this field decides whether we know a URL.
 * `./r2.ts` § Two buckets and never one is how the first half is arranged.
 */

import {
  NotAnOrderReference,
  SCREEN_PREFIX,
  isArtworkPageId,
  screenKey,
  screenKeyOf,
  versionDir,
  versionOfDir,
} from "./keys";
import {
  artworkPageFor,
  manifestBytes,
  readManifest,
  type ArtworkPage,
  type ArtworkVersion,
} from "./manifest";
import type {
  ArtworkStore,
  PublicArtworkStore,
  ScreenAddress,
  ScreenUpload,
} from "./store";

/** Where the bytes go, keyed by their own content hash. */
export const ASSET_PREFIX = "assets/";
/** Where a version's manifest goes. */
export const SET_PREFIX = "sets/";

export function assetPath(digest: string): string {
  return `${ASSET_PREFIX}${digest}.png`;
}

export function manifestPath(set: string, version: number): string {
  return `${SET_PREFIX}${set}/${versionDir(version)}.json`;
}

/**
 * **The four things this store does to a bucket.**
 *
 * Deliberately smaller than any provider's client: no delete, no copy, no
 * multipart, no folded listing. Every operation the seam does not have is one
 * the in-memory implementation in the tests would have to be right about for no
 * reason — and one more thing a future provider's adapter would have to
 * implement for no reason.
 *
 * **There is no `access` argument on any of them.** Which bucket this is
 * reaching was decided when the api was built, and whether a URL exists is
 * `ObjectStoreConfig.publicBase`. A per-call access flag would be a third
 * encoding of the same fact and the one a caller could get wrong.
 */
export interface ObjectApi {
  /** Writes bytes at an exact pathname and answers where they ended up. */
  put(
    pathname: string,
    bytes: Uint8Array,
    options: { contentType: string },
  ): Promise<{ url: string }>;
  /** Is there already something at this pathname? */
  has(pathname: string): Promise<boolean>;
  /** Every pathname under a prefix. Paged to exhaustion by the implementation. */
  pathnames(prefix: string): Promise<string[]>;
  /** The bytes at a pathname, or null if there are none. */
  bytes(pathname: string): Promise<Uint8Array | null>;
}

export interface ObjectStoreConfig {
  /** How the admin page names where it is reading from. Never a credential. */
  describe: string;
  keyIsValid: (value: unknown) => boolean;
  /** The origin public URLs are served from, or null for a private bucket. */
  publicBase: string | null;
}

export function objectArtworkStore(api: ObjectApi, config: ObjectStoreConfig): ArtworkStore {
  const checked = (key: string) => {
    if (!config.keyIsValid(key)) {
      // Checked before it becomes part of a pathname, exactly as the local
      // store checks it before it becomes a path segment. This is also the
      // runtime half of the wall between the two buckets: the public store's
      // check is `isReleaseSet`, which no order reference satisfies.
      throw new NotAnOrderReference(`${JSON.stringify(key)} is not an artwork store key`);
    }
    return key;
  };

  /**
   * Manifests already read, by set and version.
   *
   * Sound because a manifest is **never rewritten**: a new import is a new
   * version at a new pathname. Without it, `artworkBytesFor` over a
   * twenty-four page book would re-fetch the same manifest twenty-four times.
   */
  const manifests = new Map<string, ArtworkVersion | null>();

  async function manifest(set: string, version: number): Promise<ArtworkVersion | null> {
    const key = `${set}/${version}`;
    const already = manifests.get(key);
    if (already !== undefined) return already;
    const bytes = await api.bytes(manifestPath(set, version));
    let parsed: ArtworkVersion | null = null;
    if (bytes) {
      try {
        parsed = readManifest(JSON.parse(new TextDecoder().decode(bytes)), version);
      } catch {
        // A manifest that is not JSON is a version that does not exist, which
        // is the same answer as a missing one: the earlier versions are still
        // readable and the shop still draws. Never a thrown error on a read
        // path somebody's page is waiting on.
        parsed = null;
      }
    }
    manifests.set(key, parsed);
    return parsed;
  }

  async function versionNumbers(set: string): Promise<number[]> {
    const prefix = `${SET_PREFIX}${checked(set)}/`;
    const out: number[] = [];
    for (const pathname of await api.pathnames(prefix)) {
      const name = pathname.slice(prefix.length).replace(/\.json$/, "");
      const version = versionOfDir(name);
      if (version !== null) out.push(version);
    }
    return out.sort((a, b) => a - b);
  }

  return {
    describe: config.describe,

    async sets() {
      const found = new Set<string>();
      for (const pathname of await api.pathnames(SET_PREFIX)) {
        const rest = pathname.slice(SET_PREFIX.length);
        const slash = rest.indexOf("/");
        if (slash <= 0) continue;
        const set = rest.slice(0, slash);
        if (config.keyIsValid(set)) found.add(set);
      }
      return [...found];
    },

    async versions(set: string) {
      const out: ArtworkVersion[] = [];
      for (const version of await versionNumbers(set)) {
        const read = await manifest(set, version);
        if (read) out.push(read);
      }
      return out;
    },

    async current(set: string) {
      // Highest first, so the normal case is one manifest fetched and not
      // every version of a set that has been re-imported four times.
      const numbers = (await versionNumbers(set)).reverse();
      for (const version of numbers) {
        const read = await manifest(set, version);
        if (read) return read;
      }
      return null;
    },

    async put(set: string, pages: Array<{ pageId: string; bytes: Uint8Array }>, now: Date) {
      const key = checked(set);
      const version = ((await versionNumbers(key)).at(-1) ?? 0) + 1;

      const written: ArtworkPage[] = [];
      for (const page of pages) {
        if (!isArtworkPageId(page.pageId)) {
          throw new NotAnOrderReference(`${JSON.stringify(page.pageId)} is not a page id`);
        }
        const record = artworkPageFor(page.pageId, page.bytes, `${key} ${page.pageId} v${version}`);
        const pathname = assetPath(record.asset.sha256);
        // Already there means *these bytes* are already there — the key is
        // their hash — so re-running an upload with one corrected page uploads
        // one page. `scripts/upload-artwork.ts` reports both halves of that.
        const url = (await api.has(pathname))
          ? publicUrl(config, pathname)
          : (await api.put(pathname, page.bytes, { contentType: "image/png" })).url;
        written.push({
          ...record,
          // A private bucket records no URL, because there is no URL. This is
          // the line that keeps an order's artwork out of an `<img src>`.
          ...(config.publicBase ? { url } : {}),
        });
      }

      const record: ArtworkVersion = { version, at: now.toISOString(), pages: written };
      await api.put(manifestPath(key, version), manifestBytes(record), {
        contentType: "application/json",
      });
      manifests.set(`${key}/${version}`, record);
      return record;
    },

    async read(set: string, version: number, pageId: string) {
      if (!isArtworkPageId(pageId)) return null;
      const found = await manifest(checked(set), version);
      const page = found?.pages.find((p) => p.pageId === pageId);
      if (!page) return null;
      return api.bytes(assetPath(page.asset.sha256));
    },
  };
}

/**
 * **The screen-sized half, which only a public bucket can have.**
 *
 * Two operations, and they are a **separate factory from
 * `objectArtworkStore`** rather than two more cases inside it. The reason is
 * the wall this path is built around: if the shared implementation grew a
 * `putScreens`, the *private* store would have the method too — an object with
 * a way to write a photograph-derived page of somebody's child under a
 * guessable `screen/<digest>-w1600.webp` key in a bucket a custom domain is
 * pointed at. `PrivateArtworkStore` not declaring it would be a type keeping a
 * secret from a runtime that had it. So only the looks store composes this in,
 * and the orders store has no such function to call.
 *
 * It takes the public base as a **non-optional string**, so there is no way to
 * compose it against a bucket that has no URLs: a store with nowhere to serve
 * from is a store that must not have these two operations at all.
 *
 * The layout is one flat prefix (`./keys.ts` § `screenKey`), so **one listing
 * answers "what derivatives exist"** and there is no manifest to keep in step
 * with the one the masters already have.
 */
export function objectScreenStore(
  api: ObjectApi,
  publicBase: string,
): Pick<PublicArtworkStore, "screens" | "putScreens"> {
  const addressOf = (of: string, width: number): ScreenAddress => ({
    kind: "screen",
    url: `${publicBase}/${screenKey(of, width)}`,
    width,
  });

  return {
    async screens() {
      const out: Record<string, ScreenAddress> = {};
      for (const pathname of await api.pathnames(SCREEN_PREFIX)) {
        const parsed = screenKeyOf(pathname);
        if (!parsed) continue;
        // Widest wins, so a bucket that still holds a derivative made at an
        // earlier `SCREEN_WIDTH` serves the sharper of the two rather than
        // whichever the listing happened to reach second.
        if ((out[parsed.of]?.width ?? 0) < parsed.width) {
          out[parsed.of] = addressOf(parsed.of, parsed.width);
        }
      }
      return out;
    },

    async putScreens(items: readonly ScreenUpload[]) {
      const out: Record<string, ScreenAddress> = {};
      for (const item of items) {
        if (!/^[0-9a-f]{64}$/.test(item.of)) {
          // The key is built out of this string. A digest is the only thing it
          // is ever allowed to be, checked before it becomes a pathname for
          // `objectArtworkStore`'s reason.
          throw new NotAnOrderReference(`${JSON.stringify(item.of)} is not a content digest`);
        }
        const pathname = screenKey(item.of, item.width);
        // **The idempotence, in one line.** The key is a function of the
        // master's digest and the width, so a derivative already there is the
        // derivative of those exact bytes: re-running the upload uploads
        // nothing, and running it against a bucket that already holds the
        // masters uploads only what is missing.
        if (!(await api.has(pathname))) {
          await api.put(pathname, item.bytes, { contentType: "image/webp" });
        }
        out[item.of] = addressOf(item.of, item.width);
      }
      return out;
    },
  };
}

/** The URL a public pathname is served at, or the pathname itself for a private one. */
function publicUrl(config: ObjectStoreConfig, pathname: string): string {
  return config.publicBase ? `${config.publicBase}/${pathname}` : pathname;
}
