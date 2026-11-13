/**
 * **The two artwork buckets on Cloudflare R2, behind the one `ArtworkStore`
 * interface.**
 *
 * `./store.ts` § THE DECISION is the argument for there being two stores rather
 * than one; `./object-store.ts` is the layout and the version arithmetic. This
 * is the provider: an `ObjectApi` over S3-compatible HTTP, signed by
 * `lib/r2/sigv4.ts`, and two constructors that compose it into the two typed
 * stores.
 *
 * | Bucket | Variables | Access | Holds |
 * |---|---|---|---|
 * | the looks bucket | `R2_LOOKS_BUCKET` + `R2_PUBLIC_BASE` | **public**, over a custom domain | the looks' pages, the portrait tiles, the golden ghost halves, the covers |
 * | the order-artwork bucket | `R2_ORDERS_BUCKET` | **private**, no domain, no URLs | one order's regenerated artwork |
 *
 * ## Why R2 at all, and what it replaced
 *
 * Both halves were on Vercel Blob — `olb-looks` public and `olb-orders`
 * private. The public one **filled up**: 1.03 GB across 331 files against a
 * 1 GB limit, with the last upload landing a look's masters and not its screen
 * copies. Fourteen looks at twenty-four pages is 336 images plus covers, about
 * 2.5 GB, so it was never going to fit at any point rather than being a tier
 * short. R2 is 10 GB free with no egress charge, which matters for a shop whose
 * whole promise is that anybody can read the entire book with no account.
 *
 * The private half followed for a different reason: it was **empty**, nothing
 * is in production and no real order exists, so there was no data to migrate
 * and one provider is one set of credentials, one adapter and one failure mode
 * instead of two. Nothing has been deleted from either Blob store;
 * `.env.example` § Vercel Blob, retired says what is still sitting there.
 *
 * ## TWO BUCKETS AND NEVER ONE, WHICH IS THE WHOLE SAFETY ARGUMENT
 *
 * A public custom domain is attached to a **bucket**, not to a prefix. So the
 * moment the looks bucket and an order's artwork share a bucket, every page
 * regenerated from a photograph of one family's child is readable by anybody
 * who can guess — or walk — a key. That is the worst thing this product could
 * do, and "they are under different prefixes" is not a defence: nothing in
 * Cloudflare's model makes a prefix private inside a public bucket.
 *
 * With both halves on one provider that guard matters **more** than it did when
 * they were on two, because the only thing separating them in a signed request
 * is the bucket name in the path. So there are five walls, not four:
 *
 * 1. **The store types.** `PublicArtworkStore` and `PrivateArtworkStore` are
 *    mutually unassignable, with no cast anywhere (`./store.ts`).
 * 2. **The config types.** `LooksBucket` and `OrderArtworkBucket` below are
 *    mutually unassignable too — a `for` tag, and `publicBase` exists on one of
 *    them and **does not exist at all** on the other. There is nowhere to put a
 *    public base on the private bucket's configuration, so a private store with
 *    URLs is not a thing this module can be asked for.
 * 3. **The keys.** The looks store is keyed by `isReleaseSet` and the order
 *    store by `isReference`, so a key that arrived through a `string` the
 *    compiler cannot see into is refused before it becomes a pathname.
 * 4. **The URLs.** The private store has no public base, so
 *    `./object-store.ts` writes no `url` on anything it stores, and
 *    `objectScreenStore` — which only exists to make URLs — cannot be composed
 *    against it, because it takes a non-optional `string`.
 * 5. **The bucket names, which is the new one.** `looksBucketIn` **refuses** a
 *    public bucket whose name matches any private bucket this environment
 *    names, and says which row collided. One API token covers both buckets, by
 *    design and by the captain's instruction, so a copy-paste in a dashboard is
 *    exactly how the two would become one — and it would look configured.
 *
 * `test/artwork-separation.test.ts` is all five and
 * `test/no-order-asset-in-the-public-store.ts` is the compiler's half.
 *
 * ## The seam, and why there is one
 *
 * `r2ObjectApi` is the only thing here that touches a network, and it takes its
 * `fetch` as an argument. That is the same arrangement `lib/stripe/` and
 * `lib/orders/r2.ts` have for the same reason: the store's behaviour — the key
 * layout, the version arithmetic, the refusal of a bad key, the digest in the
 * manifest — is asserted against an in-memory bucket, and the *bytes on the
 * wire* are asserted against a fake `fetch`, with **no test reaching a live
 * bucket** and no mock of a library pretending to be a test of our code.
 *
 * **What no test here proves is that Cloudflare accepts the request.** There is
 * no credential in a public repository to find out with. The signing is checked
 * against AWS's published vectors in `test/order-store.test.ts`; the rest is
 * the first real upload, and the PR says so.
 */

import { value } from "../env";
import { isReference } from "../orders/record";
import { isReleaseSet } from "./keys";
import {
  objectArtworkStore,
  objectScreenStore,
  type ObjectApi,
} from "./object-store";
import {
  keysIn,
  nextContinuationToken,
  r2Host,
  realFetch,
  signV4,
  type FetchLike,
  type R2Credentials,
} from "../r2/sigv4";
import type { PrivateArtworkStore, PublicArtworkStore } from "./store";

// ---------------------------------------------------------------------------
// The variables
// ---------------------------------------------------------------------------

/** The account, the key and the secret. One token may cover both buckets. */
export const ACCOUNT_VAR = "R2_ACCOUNT_ID";
export const ACCESS_KEY_VAR = "R2_ACCESS_KEY_ID";
export const SECRET_KEY_VAR = "R2_SECRET_ACCESS_KEY";

/** The **public** bucket, and the custom domain in front of it. */
export const LOOKS_BUCKET_VAR = "R2_LOOKS_BUCKET";
export const PUBLIC_BASE_VAR = "R2_PUBLIC_BASE";

/** The **private** bucket an order's regenerated artwork goes in. */
export const ORDER_ARTWORK_BUCKET_VAR = "R2_ORDERS_BUCKET";

/**
 * Every variable in this environment that names a bucket **nothing public may
 * ever be served out of**.
 *
 * `R2_BUCKET` is the order records and the buyers' photographs
 * (`lib/orders/r2.ts`) and `R2_ORDERS_BUCKET` is the per-order artwork. Both
 * are private, both may legitimately be the same bucket, and neither may ever
 * be the one a custom domain is attached to. Named here rather than imported
 * from `lib/orders/config.ts` so that this module — the one that decides what
 * is public — is the one place the list of what is not can be read.
 */
export const PRIVATE_BUCKET_VARS = [ORDER_ARTWORK_BUCKET_VAR, "R2_BUCKET"] as const;

// ---------------------------------------------------------------------------
// The two configurations, which cannot be mistaken for each other
// ---------------------------------------------------------------------------

/**
 * **The public bucket.** `publicBase` is required and is a field the private
 * configuration does not have, which is wall 2 in this file's docblock.
 */
export interface LooksBucket extends R2Credentials {
  readonly for: "looks";
  /** The custom domain, no trailing slash. Reads come from here, never signed. */
  publicBase: string;
}

/**
 * **The private bucket.** No `publicBase`, and the `for` tag is what stops a
 * `LooksBucket` being passed here by structural width — it has every field this
 * one has.
 */
export interface OrderArtworkBucket extends R2Credentials {
  readonly for: "order-artwork";
}

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

/** One ListObjectsV2 page is at most this many keys, and R2 caps it here too. */
const PAGE_SIZE = 1000;

/**
 * **The four operations, against one R2 bucket.**
 *
 * `publicBase` is only ever used to answer "where did these bytes end up", and
 * `null` means the honest answer is nowhere a URL can reach —
 * `./object-store.ts` then writes no `url` at all.
 */
export function r2ObjectApi(
  credentials: R2Credentials,
  options: { publicBase?: string | null; fetch?: FetchLike } = {},
): ObjectApi {
  const host = r2Host(credentials.accountId);
  const publicBase = options.publicBase ?? null;
  const doFetch = options.fetch ?? realFetch();

  async function send(
    method: string,
    key: string,
    body?: Uint8Array,
    extra?: { headers?: Record<string, string>; query?: Record<string, string> },
  ) {
    const signed = signV4({
      method,
      path: `/${credentials.bucket}${key ? `/${key}` : ""}`,
      query: extra?.query,
      host,
      headers: extra?.headers,
      body,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      now: new Date(),
    });
    return doFetch(signed.url, { method, headers: signed.headers, body });
  }

  /**
   * A refusal from the bucket, naming the request and **never what it was
   * signed with**. The repository is public and so are its logs; a message
   * carrying a credential is a credential published. The prefix is the one
   * `lib/orders/r2.ts` uses, so `scripts/upload-artwork.ts` can tell a bucket
   * saying no from a bug in this repository.
   */
  async function refuse(what: string, response: { status: number; text(): Promise<string> }) {
    const body = await response.text().catch(() => "");
    throw new Error(`R2 refused to ${what}: HTTP ${response.status} ${body.slice(0, 200)}`);
  }

  return {
    async put(pathname, bytes, { contentType }) {
      const response = await send("PUT", pathname, bytes, {
        headers: { "content-type": contentType },
      });
      if (!response.ok) await refuse(`write ${pathname}`, response);
      // The pathname IS the content hash, so there is no suffix to add and no
      // overwrite to worry about: identical bytes are already there.
      return { url: publicBase ? `${publicBase}/${pathname}` : pathname };
    },

    async has(pathname) {
      const response = await send("HEAD", pathname);
      if (response.status === 404) return false;
      if (!response.ok) await refuse(`check ${pathname}`, response);
      return true;
    },

    async pathnames(prefix) {
      // **Paged to exhaustion.** A single listing stops at a thousand keys and
      // the looks bucket is already past that at six looks — a caller reading
      // one page would report most of the artwork as missing and the pages it
      // did report would be the alphabetically early ones.
      const out: string[] = [];
      let token: string | null = null;
      do {
        const response = await send("GET", "", undefined, {
          query: {
            "list-type": "2",
            prefix,
            "max-keys": String(PAGE_SIZE),
            ...(token ? { "continuation-token": token } : {}),
          },
        });
        if (!response.ok) await refuse(`list ${prefix}`, response);
        const xml = await response.text();
        for (const key of keysIn(xml)) out.push(key);
        token = nextContinuationToken(xml);
      } while (token);
      return out;
    },

    async bytes(pathname) {
      // **Read with a signed request even from the public bucket.** A read is a
      // read; going through the CDN here would make what the server sees depend
      // on a cache, and `lib/assets/resolve.ts` is already digest-checking
      // whatever comes back. The public base exists to put in an `<img src>`,
      // which is the browser's job and not this one's.
      const response = await send("GET", pathname);
      if (response.status === 404) return null;
      if (!response.ok) await refuse(`read ${pathname}`, response);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

// ---------------------------------------------------------------------------
// The two stores
// ---------------------------------------------------------------------------

/**
 * **The looks bucket — the captain's released artwork, publicly readable.**
 *
 * Keyed by `isReleaseSet`, so `tiles`, `ghosts` and `look-<id>` are the only
 * things that can be written to it and an order reference is refused before it
 * becomes a pathname. The return type says the same thing to the compiler.
 *
 * `describe` names the bucket and the domain and **nothing else**: an account
 * id is a credential here (`.env.example` says so) and the key and secret are
 * never anywhere near a string this function returns.
 */
export function looksR2Store(config: LooksBucket, api?: ObjectApi): PublicArtworkStore {
  const reach = api ?? r2ObjectApi(config, { publicBase: config.publicBase });
  return {
    holds: "released",
    ...objectScreenStore(reach, config.publicBase),
    ...objectArtworkStore(reach, {
      describe:
        `the public R2 bucket ${config.bucket}, served from ${config.publicBase}` +
        (isDefaultR2Domain(config.publicBase)
          ? " — which is r2.dev, Cloudflare's rate-limited default and not for production traffic"
          : ""),
      keyIsValid: isReleaseSet,
      publicBase: config.publicBase,
    }),
  };
}

/**
 * **The order-artwork bucket — one order's regenerated artwork, private.**
 *
 * Keyed by `isReference`, so only an order reference can be written to it, and
 * it records **no URLs**: the only way to see one of these pictures is a server
 * read behind `lib/admin/guard.ts`. `app/api/admin/artwork/[ref]/route.ts` is
 * that read and it has never changed through two providers, which is what the
 * interface was for.
 */
export function orderArtworkR2Store(
  config: OrderArtworkBucket,
  api?: ObjectApi,
): PrivateArtworkStore {
  return {
    holds: "per-order",
    ...objectArtworkStore(api ?? r2ObjectApi(config, { publicBase: null }), {
      describe: `the private R2 bucket ${config.bucket} — no public URLs, read behind /admin`,
      keyIsValid: isReference,
      publicBase: null,
    }),
  };
}

// ---------------------------------------------------------------------------
// What this environment describes
// ---------------------------------------------------------------------------

/** Cloudflare's default per-bucket address: fine for a smoke test, not for traffic. */
export function isDefaultR2Domain(base: string): boolean {
  try {
    return new URL(base).hostname.endsWith(".r2.dev");
  } catch {
    return false;
  }
}

/**
 * The custom domain, normalised, or null for anything that is not one.
 *
 * An absolute `http(s)` origin with no trailing slash. A value that is not a
 * URL — a bare hostname, a path, a pasted variable name — reads as **unset**,
 * for `lib/env.ts` § `isSet`'s reason: those are what a dashboard holds after a
 * hurried deploy, and a half-built URL in an `<img src>` draws a hole on a page
 * somebody is deciding whether to buy from.
 */
export function publicBaseIn(env: Record<string, string | undefined>): string | null {
  const raw = value(env, PUBLIC_BASE_VAR);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

function credentialsIn(
  env: Record<string, string | undefined>,
  bucketVar: string,
): R2Credentials | null {
  const accountId = value(env, ACCOUNT_VAR);
  const bucket = value(env, bucketVar);
  const accessKeyId = value(env, ACCESS_KEY_VAR);
  const secretAccessKey = value(env, SECRET_KEY_VAR);
  return accountId && bucket && accessKeyId && secretAccessKey
    ? { accountId, bucket, accessKeyId, secretAccessKey }
    : null;
}

/** Which of the rows a store needs are empty. For a refusal that names them. */
export function missingFor(
  env: Record<string, string | undefined>,
  which: "looks" | "order-artwork",
): string[] {
  const rows =
    which === "looks"
      ? [ACCOUNT_VAR, LOOKS_BUCKET_VAR, ACCESS_KEY_VAR, SECRET_KEY_VAR, PUBLIC_BASE_VAR]
      : [ACCOUNT_VAR, ORDER_ARTWORK_BUCKET_VAR, ACCESS_KEY_VAR, SECRET_KEY_VAR];
  return rows.filter((row) =>
    row === PUBLIC_BASE_VAR ? publicBaseIn(env) === null : !value(env, row),
  );
}

/**
 * **The public bucket this environment names, or null — and never one that is
 * also a private bucket.**
 *
 * Wall 5. The collision is refused rather than resolved, and it is refused
 * here rather than inside the store, because the store is handed a
 * configuration and cannot see what else the environment said. Falling back to
 * the local directory is the right answer to it: a shop reading the captain's
 * laptop is a shop with no artwork, which is a state this repository is built
 * to be fine in, and a shop serving a customer's child from a CDN is not.
 */
export function looksBucketIn(env: Record<string, string | undefined>): LooksBucket | null {
  const credentials = credentialsIn(env, LOOKS_BUCKET_VAR);
  const publicBase = publicBaseIn(env);
  if (!credentials || !publicBase) return null;
  if (publicBucketCollision(env)) return null;
  return { for: "looks", ...credentials, publicBase };
}

/**
 * The variable whose bucket is the same as the public one, or null.
 *
 * A sentence rather than a boolean, because the only useful thing to say about
 * this state is which row to go and change.
 */
export function publicBucketCollision(env: Record<string, string | undefined>): string | null {
  const looks = value(env, LOOKS_BUCKET_VAR);
  if (!looks) return null;
  for (const row of PRIVATE_BUCKET_VARS) {
    if (value(env, row) === looks) return row;
  }
  return null;
}

/** The private artwork bucket this environment names, or null. */
export function orderArtworkBucketIn(
  env: Record<string, string | undefined>,
): OrderArtworkBucket | null {
  const credentials = credentialsIn(env, ORDER_ARTWORK_BUCKET_VAR);
  return credentials ? { for: "order-artwork", ...credentials } : null;
}
