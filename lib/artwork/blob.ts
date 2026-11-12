/**
 * **The two Vercel Blob stores, behind the one `ArtworkStore` interface.**
 *
 * `./store.ts` § THE DECISION is the argument for Blob and for there being two
 * stores rather than one; this is the implementation, and it is an **adapter**:
 * six operations against a bucket, the same six the filesystem answers, with no
 * caller above this line knowing which one it is holding.
 *
 * | Store | Access | Reached through | Holds |
 * |---|---|---|---|
 * | `olb-looks` | public | `BLOB_READ_WRITE_TOKEN` | the looks' pages, the portrait tiles, the golden ghost halves |
 * | `olb-orders` | private | `OLB_ORDERS_STORE_ID` + the deployment's OIDC token | one order's regenerated artwork |
 *
 * Those two variable names are the captain's and are already set on the Vercel
 * project for production, preview and development. Nothing here invents a third
 * one, and no value for either is in this repository.
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
 * `blobScreenStore` below, which only the public store composes in.
 *
 * **A picture's key is its digest**, which buys three things this path actually
 * needs. A corrected page is *different bytes*, so it lands on a new key and no
 * CDN anywhere can serve the stale one — the captain is replacing two portraits
 * for edge fringing, and "I uploaded it and the old one is still showing" is
 * the failure that would otherwise be unanswerable. Re-running the upload with
 * nothing changed uploads **nothing**, because every key is already there. And
 * a page that appears in two versions is stored once.
 *
 * **The manifest is the thing that is versioned**, which is the whole of how
 * `put` keeps its promise never to overwrite (`./store.ts` § Versions): the
 * bytes are immutable and shared, and a version is a list naming which of them
 * a page was at that moment.
 *
 * In the public store the manifest is public too, and that is not an oversight:
 * it is page ids, digests and sizes **of pictures that are already public**, and
 * a reader who can list them learns nothing they could not learn by opening the
 * preview. In the private store it is private with everything else.
 *
 * ## The seam, and why there is one
 *
 * `BlobApi` is four operations and `vercelBlobApi` is the only thing in this
 * repository that imports `@vercel/blob`. That is the same arrangement
 * `lib/stripe/` and `lib/orders/r2.ts` have for the same reason: the store's
 * behaviour — the key layout, the version arithmetic, the refusal of a bad key,
 * the digest in the manifest — is then asserted against an in-memory bucket in
 * `test/artwork-blob.test.ts`, with **no test reaching a live store** and no
 * mock of a library pretending to be a test of our code.
 *
 * ## Public is a URL; private is not
 *
 * `put` on the public store records the CDN URL on each page
 * (`./manifest.ts` § `ArtworkPage.url`), which is what lets a twenty-five page
 * preview be twenty-five CDN reads instead of twenty-five function
 * invocations. `put` on the private store records **no URL at all** — there is
 * nothing to record, because a private blob has no address anybody can use, and
 * reads go through the authenticated admin route. The type of the store is what
 * decides which of the two you are calling, and `./store.ts` § The one thing
 * that may never cross says why that is a type and not a convention.
 */

import { value } from "../env";
import { isReference } from "../orders/record";
import {
  NotAnOrderReference,
  SCREEN_PREFIX,
  isArtworkPageId,
  isReleaseSet,
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
  PrivateArtworkStore,
  PublicArtworkStore,
  ScreenAddress,
  ScreenUpload,
} from "./store";

/** The public store's read-write token. The captain's name for it; not ours. */
export const LOOKS_TOKEN_VAR = "BLOB_READ_WRITE_TOKEN";

/**
 * The private store's id.
 *
 * A store id and not a token, because the private store is reached by **OIDC**:
 * a Vercel deployment already proves who it is, so the only thing missing is
 * which store to talk to. That is also why there is no private token anywhere in
 * `.env.example` — there is no second credential to leak.
 */
export const ORDERS_STORE_VAR = "OLB_ORDERS_STORE_ID";

/**
 * The deployment's own OIDC token, which Vercel sets.
 *
 * **Why it is passed explicitly and never left to the SDK.**
 *
 * `@vercel/blob` resolves credentials in this order: an explicit `token`, then
 * an OIDC token plus a store id, **then `BLOB_READ_WRITE_TOKEN` from the
 * environment**. That last step is the hazard this whole module is built
 * around: `BLOB_READ_WRITE_TOKEN` is the *public* store's token, so a private
 * write attempted on a machine with no OIDC token would be silently
 * authenticated against `olb-looks` and would put **a photograph-derived page
 * of somebody's child in the public store**.
 *
 * So `ordersBlobStore` takes the OIDC token as a **required argument**, which
 * means the SDK never gets as far as the environment, and
 * `artworkStoreFromEnv` does not build this store at all when there is no token
 * to give it — it returns the local filesystem store and `describe` says why.
 * That is the familiar trade in this repository: inert and saying so, rather
 * than working in the wrong place.
 */
export const OIDC_TOKEN_VAR = "VERCEL_OIDC_TOKEN";


/** Where the bytes go, keyed by their own content hash. */
const ASSET_PREFIX = "assets/";
/** Where a version's manifest goes. */
const SET_PREFIX = "sets/";

function assetPath(digest: string): string {
  return `${ASSET_PREFIX}${digest}.png`;
}

function manifestPath(set: string, version: number): string {
  return `${SET_PREFIX}${set}/${versionDir(version)}.json`;
}

/**
 * The store id inside a read-write token.
 *
 * A token is `vercel_blob_rw_<storeId>_<secret>`, which is how `@vercel/blob`
 * itself finds the store id, and the fourth field is **not** the secret — the
 * store id is in every public URL the store serves. It is read here so
 * `describe` can name the store without naming the credential;
 * `test/artwork-blob.test.ts` asserts that no part of the token reaches
 * anything this module returns.
 */
export function storeIdOfToken(token: string): string | null {
  const parts = token.split("_");
  return parts.length >= 5 && parts[3] ? parts[3] : null;
}

/** The origin a public store serves from. The SDK builds the same string. */
export function publicBaseFor(storeId: string): string {
  return `https://${storeId}.public.blob.vercel-storage.com`;
}

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

/** Either half of the two ways a Blob store is authenticated. */
export type BlobAuth =
  | { kind: "token"; token: string }
  | { kind: "oidc"; storeId: string; oidcToken: string };

/**
 * The four things this store does to a bucket.
 *
 * Deliberately smaller than the SDK: no delete, no copy, no multipart, no
 * folded listing. Every operation the seam does not have is one the in-memory
 * implementation in the tests would have to be right about for no reason.
 */
export interface BlobApi {
  /** Writes bytes at an exact pathname and answers where they ended up. */
  put(
    pathname: string,
    bytes: Uint8Array,
    options: { access: "public" | "private"; contentType: string },
  ): Promise<{ url: string }>;
  /** Is there already something at this pathname? */
  has(pathname: string): Promise<boolean>;
  /** Every pathname under a prefix. */
  pathnames(prefix: string): Promise<string[]>;
  /** The bytes at a pathname, or null if there are none. */
  bytes(pathname: string, access: "public" | "private"): Promise<Uint8Array | null>;
}

/**
 * The real one — the only importer of `@vercel/blob` in this repository.
 *
 * The SDK is imported lazily so that a build with no Blob store configured
 * never loads it, and so the test suite's in-memory bucket does not drag a
 * network client in behind it.
 */
export function vercelBlobApi(auth: BlobAuth): BlobApi {
  // Always one or the other, explicitly. See § Why the OIDC token is passed
  // explicitly: an empty options object is the one shape that would let the
  // SDK reach `BLOB_READ_WRITE_TOKEN` on its own.
  const options =
    auth.kind === "token"
      ? { token: auth.token }
      : { storeId: auth.storeId, oidcToken: auth.oidcToken };

  return {
    async put(pathname, bytes, { access, contentType }) {
      const { put } = await import("@vercel/blob");
      const result = await put(pathname, Buffer.from(bytes), {
        ...options,
        access,
        contentType,
        // The pathname IS the content hash, so a random suffix would turn one
        // picture into an unbounded number of copies of itself, and an
        // overwrite is never needed: identical bytes are already there.
        addRandomSuffix: false,
      });
      return { url: result.url };
    },

    async has(pathname) {
      const { head } = await import("@vercel/blob");
      try {
        await head(pathname, options);
        return true;
      } catch {
        // `head` throws for a blob that is not there, which is the answer
        // "no" and not an error on this path.
        return false;
      }
    },

    async pathnames(prefix) {
      const { list } = await import("@vercel/blob");
      const out: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ ...options, prefix, ...(cursor ? { cursor } : {}) });
        for (const blob of page.blobs) out.push(blob.pathname);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return out;
    },

    async bytes(pathname, access) {
      const { get } = await import("@vercel/blob");
      const found = await get(pathname, { ...options, access });
      if (!found || !found.stream) return null;
      return new Uint8Array(await new Response(found.stream).arrayBuffer());
    },
  };
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

interface BlobStoreConfig {
  describe: string;
  access: "public" | "private";
  keyIsValid: (value: unknown) => boolean;
  /** The origin public URLs are served from, or null for a private store. */
  publicBase: string | null;
}

function blobArtworkStore(api: BlobApi, config: BlobStoreConfig): ArtworkStore {
  const checked = (key: string) => {
    if (!config.keyIsValid(key)) {
      // Checked before it becomes part of a pathname, exactly as the local
      // store checks it before it becomes a path segment. This is also the
      // runtime half of the wall between the two stores: the public store's
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
    const bytes = await api.bytes(manifestPath(set, version), config.access);
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
          : (await api.put(pathname, page.bytes, { access: config.access, contentType: "image/png" }))
              .url;
        written.push({
          ...record,
          // A private store records no URL, because there is no URL. This is
          // the line that keeps `olb-orders` out of an `<img src>`.
          ...(config.publicBase ? { url } : {}),
        });
      }

      const record: ArtworkVersion = { version, at: now.toISOString(), pages: written };
      await api.put(manifestPath(key, version), manifestBytes(record), {
        access: config.access,
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
      return api.bytes(assetPath(page.asset.sha256), config.access);
    },
  };
}

/**
 * **The screen-sized half of the public store.**
 *
 * Two operations, and they are a **separate factory from
 * `blobArtworkStore`** rather than two more cases inside it. The reason is the
 * wall this module is built around: if the shared implementation grew a
 * `putScreens`, the *private* store would have the method too — an object with
 * a way to write a photograph-derived page of somebody's child under a
 * guessable `screen/<digest>-w1600.webp` key. `PrivateArtworkStore` not
 * declaring it would be a type keeping a secret from a runtime that had it.
 * So only `looksBlobStore` composes this in, and `ordersBlobStore` has no such
 * function to call.
 *
 * The layout is one flat prefix (`./keys.ts` § `screenKey`), so **one listing
 * answers "what derivatives exist"** and there is no manifest to keep in step
 * with the one the masters already have.
 */
function blobScreenStore(
  api: BlobApi,
  publicBase: string | null,
): Pick<PublicArtworkStore, "screens" | "putScreens"> {
  const addressOf = (of: string, width: number): ScreenAddress | null =>
    publicBase
      ? { kind: "screen", url: `${publicBase}/${screenKey(of, width)}`, width }
      : // A store whose token named no store id has no origin to serve from,
        // so there is no address to report and the preview draws the master.
        // Never a guessed URL: a 404 in an `<image href>` draws a hole.
        null;

  return {
    async screens() {
      const out: Record<string, ScreenAddress> = {};
      for (const pathname of await api.pathnames(SCREEN_PREFIX)) {
        const parsed = screenKeyOf(pathname);
        if (!parsed) continue;
        const address = addressOf(parsed.of, parsed.width);
        // Widest wins, so a store that still holds a derivative made at an
        // earlier `SCREEN_WIDTH` serves the sharper of the two rather than
        // whichever the listing happened to reach second.
        if (address && (out[parsed.of]?.width ?? 0) < parsed.width) out[parsed.of] = address;
      }
      return out;
    },

    async putScreens(items: readonly ScreenUpload[]) {
      const out: Record<string, ScreenAddress> = {};
      for (const item of items) {
        if (!/^[0-9a-f]{64}$/.test(item.of)) {
          // The key is built out of this string. A digest is the only thing it
          // is ever allowed to be, checked before it becomes a pathname for
          // `blobArtworkStore`'s reason.
          throw new NotAnOrderReference(`${JSON.stringify(item.of)} is not a content digest`);
        }
        const address = addressOf(item.of, item.width);
        if (!address) continue;
        const pathname = screenKey(item.of, item.width);
        // **The idempotence, in one line.** The key is a function of the
        // master's digest and the width, so a derivative already there is the
        // derivative of those exact bytes: re-running the upload uploads
        // nothing, and running it against a store that already holds the
        // masters uploads only what is missing.
        if (!(await api.has(pathname))) {
          await api.put(pathname, item.bytes, { access: "public", contentType: "image/webp" });
        }
        out[item.of] = address;
      }
      return out;
    },
  };
}

/** The URL a public pathname is served at, or the pathname's own url for a private one. */
function publicUrl(config: BlobStoreConfig, pathname: string): string {
  return config.publicBase ? `${config.publicBase}/${pathname}` : pathname;
}

/**
 * **`olb-looks` — the captain's released artwork, publicly readable.**
 *
 * Keyed by `isReleaseSet`, so `tiles`, `ghosts` and `look-<id>` are the only
 * things that can be written to it and an order reference is refused before it
 * becomes a pathname. The return type says the same thing to the compiler.
 */
export function looksBlobStore(token: string, api?: BlobApi): PublicArtworkStore {
  const storeId = storeIdOfToken(token);
  const base = storeId ? publicBaseFor(storeId) : null;
  const reach = api ?? vercelBlobApi({ kind: "token", token });
  return {
    holds: "released",
    ...blobScreenStore(reach, base),
    ...blobArtworkStore(reach, {
      describe: storeId
        ? `the public Vercel Blob store ${storeId} (olb-looks), served from ${base}`
        : "a public Vercel Blob store (olb-looks)",
      access: "public",
      keyIsValid: isReleaseSet,
      publicBase: base,
    }),
  };
}

/**
 * **`olb-orders` — one order's regenerated artwork, private.**
 *
 * Keyed by `isReference`, so only an order reference can be written to it, and
 * it records **no URLs**: the only way to see one of these pictures is a server
 * read behind `lib/admin/guard.ts`. `app/api/admin/artwork/[ref]/route.ts` is
 * that read and it already existed — nothing about it changes when the bytes
 * move from a directory to a bucket, which is what the interface was for.
 */
export function ordersBlobStore(
  storeId: string,
  oidcToken: string,
  api?: BlobApi,
): PrivateArtworkStore {
  return {
    holds: "per-order",
    ...blobArtworkStore(
      api ?? vercelBlobApi({ kind: "oidc", storeId, oidcToken }),
      {
        describe: `the private Vercel Blob store ${storeId} (olb-orders) — no public URLs, read behind /admin`,
        access: "private",
        keyIsValid: isReference,
        publicBase: null,
      },
    ),
  };
}

/** The public store's token in this environment, or undefined. */
export function looksTokenIn(env: Record<string, string | undefined>): string | undefined {
  return value(env, LOOKS_TOKEN_VAR);
}

/**
 * The private store this environment can actually reach: its id **and** the
 * credential to reach it with, or null.
 *
 * Both or neither, in one function, so no caller can hold half of it.
 */
export function ordersStoreIn(
  env: Record<string, string | undefined>,
): { storeId: string; oidcToken: string } | null {
  const storeId = value(env, ORDERS_STORE_VAR);
  const oidcToken = value(env, OIDC_TOKEN_VAR);
  return storeId && oidcToken ? { storeId, oidcToken } : null;
}

/** Is the private store named but unreachable — the one state worth a sentence? */
export function ordersStoreNamedButUnreachable(
  env: Record<string, string | undefined>,
): boolean {
  return Boolean(value(env, ORDERS_STORE_VAR)) && !value(env, OIDC_TOKEN_VAR);
}
