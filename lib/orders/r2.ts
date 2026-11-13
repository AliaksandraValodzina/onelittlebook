/**
 * **The orders bucket, over HTTP, signed by hand.**
 *
 * The signing itself is `lib/r2/sigv4.ts` and lives there because **there are
 * now two buckets** — this one and the public looks bucket
 * (`lib/artwork/r2.ts`) — and the one thing they genuinely share is the
 * algorithm. Every name this module used to export it still exports, so nothing
 * that was reading it had to move.
 *
 * **What is not checked here is the bucket.** No test in this repository
 * touches a live R2 bucket, because there is no credential in a public
 * repository to touch one with. So what is proven is the signing, the request
 * shaping and the lifecycle above it; what is not proven is that Cloudflare
 * accepts it. The PR says so plainly rather than implying a green suite means
 * a working bucket.
 *
 * ## Two prefixes, one bucket, and no public domain in front of it
 *
 * `orders/<ref>.json` is the record. `photos/<sha256>.<ext>` is the buyer's
 * photograph. Both are **private**: nothing here writes a public-read ACL and
 * nothing reads them through a CDN base.
 *
 * **`R2_PUBLIC_BASE` is not this bucket's domain and must never be pointed at
 * it.** That variable fronts `R2_LOOKS_BUCKET`, which holds the same
 * twenty-four pictures for every buyer; this bucket holds one customer's name,
 * address, email and a photograph of their child under `orders/<ref>.json`. A
 * reference is short enough to walk, so a public domain over this bucket is a
 * customer list anybody can read. `lib/artwork/r2.ts` § Two buckets and never
 * one is the long version and `test/artwork-separation.test.ts` § 5 asserts that
 * the two bucket variables are read in two different modules, and that a public
 * bucket naming this one is refused rather than served.
 */

import { ASSET_EXTENSIONS } from "../assets/resolve";
import { ORDER_PREFIX, PHOTO_PREFIX } from "./config";
import { readRecord, type OrderRecord } from "./record";
import { keysIn, r2Host, realFetch, signV4, type FetchLike, type R2Credentials } from "../r2/sigv4";
import type { OrderStore } from "./store";
import type { AssetRef } from "../template/types";

/**
 * Re-exported, not redefined. `lib/r2/sigv4.ts` says why they moved; keeping
 * the names reachable from here is what kept the move from being a rename of
 * everything that reads them.
 */
export {
  keysIn,
  signV4,
  signatureParts,
  signingKey,
  type FetchLike,
  type R2Credentials,
  type SignatureParts,
  type SignedRequest,
} from "../r2/sigv4";

export function r2Store(credentials: R2Credentials, fetchLike?: FetchLike): OrderStore {
  const host = r2Host(credentials.accountId);
  const doFetch: FetchLike = fetchLike ?? realFetch();

  async function send(
    method: string,
    key: string,
    body?: Uint8Array | string,
    extra?: { headers?: Record<string, string>; query?: Record<string, string> },
  ) {
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    const signed = signV4({
      method,
      path: `/${credentials.bucket}${key ? `/${key}` : ""}`,
      query: extra?.query,
      host,
      headers: extra?.headers,
      body: bytes,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      now: new Date(),
    });
    return doFetch(signed.url, { method, headers: signed.headers, body: bytes });
  }

  /**
   * A refusal from the bucket, as an error that says which request failed and
   * **never what it was signed with**. The repository is public and so are its
   * logs; a message carrying a credential is a credential published.
   */
  async function refuse(what: string, response: { status: number; text(): Promise<string> }) {
    const body = await response.text().catch(() => "");
    throw new Error(`R2 refused to ${what}: HTTP ${response.status} ${body.slice(0, 200)}`);
  }

  async function getOne(ref: string): Promise<OrderRecord | null> {
    const response = await send("GET", `${ORDER_PREFIX}${ref}.json`);
    if (response.status === 404) return null;
    if (!response.ok) await refuse(`read order ${ref}`, response);
    try {
      return readRecord(JSON.parse(await response.text()));
    } catch {
      return null;
    }
  }

  return {
    describe: `r2://${credentials.bucket}`,

    get: getOne,

    async put(record: OrderRecord) {
      const response = await send("PUT", `${ORDER_PREFIX}${record.ref}.json`, JSON.stringify(record), {
        headers: { "content-type": "application/json" },
      });
      if (!response.ok) await refuse(`write order ${record.ref}`, response);
    },

    async list(limit: number) {
      const response = await send("GET", "", undefined, {
        query: { "list-type": "2", prefix: ORDER_PREFIX, "max-keys": String(Math.max(limit, 1) * 2) },
      });
      if (!response.ok) await refuse("list orders", response);
      const keys = keysIn(await response.text())
        .filter((k) => k.startsWith(ORDER_PREFIX) && k.endsWith(".json"));
      const refs = keys.map((k) => k.slice(ORDER_PREFIX.length, -".json".length));
      const records: OrderRecord[] = [];
      for (const ref of refs) {
        const one = await getOne(ref);
        if (one) records.push(one);
      }
      return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },

    async putPhoto(ref: AssetRef, bytes: Uint8Array) {
      const response = await send("PUT", photoKey(ref), bytes, {
        headers: { "content-type": ref.mime },
      });
      if (!response.ok) await refuse("write a photograph", response);
    },

    async getPhoto(ref: AssetRef) {
      const response = await send("GET", photoKey(ref));
      if (response.status === 404) return null;
      if (!response.ok) await refuse("read a photograph", response);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

/** `photos/<sha256>.<ext>` — the fill's own name for it, under a private prefix. */
export function photoKey(ref: AssetRef): string {
  return `${PHOTO_PREFIX}${ref.sha256}.${ASSET_EXTENSIONS[ref.mime]}`;
}
