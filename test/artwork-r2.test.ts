/**
 * **The bytes on the wire, and the three states the artwork read can be in.**
 *
 * `test/artwork-buckets.test.ts` asserts the *layout* against an in-memory
 * bucket: content-addressed keys, versions that only accumulate, a manifest
 * that is never rewritten. This file is the half below that — the four
 * operations of `ObjectApi` as **actual HTTP requests**, against a `fetch` the
 * test hands in.
 *
 * The split is the one `lib/stripe/` and `lib/orders/r2.ts` already have, for
 * the reason stated there: a mock of a library is a test of the library. What
 * is asserted here is the request this repository would send — the host, the
 * bucket in the path, the content type, the signature, the paging — because
 * every one of those is a thing that can be wrong in a way no in-memory bucket
 * would ever notice.
 *
 * **What no test here proves is that Cloudflare accepts it.** There is no
 * credential in a public repository to find out with. The signing algorithm is
 * checked against AWS's own published vectors in `test/order-store.test.ts`;
 * the rest is the first real upload.
 *
 * Nothing in this file is artwork. Every picture is minted here, which is
 * `test/release-artwork.test.ts`'s rule and the only honest way to test an
 * artwork path in a repository that must contain no artwork.
 */

import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { TILES_SET, lookSet, tilePageId } from "../lib/artwork/release";
import {
  ACCESS_KEY_VAR,
  ACCOUNT_VAR,
  LOOKS_BUCKET_VAR,
  ORDER_ARTWORK_BUCKET_VAR,
  PUBLIC_BASE_VAR,
  SECRET_KEY_VAR,
  isDefaultR2Domain,
  looksBucketIn,
  looksR2Store,
  missingFor,
  orderArtworkBucketIn,
  orderArtworkR2Store,
  r2ObjectApi,
} from "../lib/artwork/r2";
import { assetPath, manifestPath } from "../lib/artwork/object-store";
import { SCREEN_WIDTH, screenKey } from "../lib/artwork/keys";
import { keysIn, nextContinuationToken } from "../lib/r2/sigv4";
import { sha256 } from "../lib/assets/digest";
import type { FetchLike } from "../lib/r2/sigv4";

const LOOKS = {
  for: "looks",
  accountId: "accountsekrit",
  bucket: "onelittlebook-looks",
  accessKeyId: "keyidsekrit",
  secretAccessKey: "secretsekrit",
  publicBase: "https://art.onelittlebook.test",
} as const;

const ORDERS = {
  for: "order-artwork",
  accountId: "accountsekrit",
  bucket: "onelittlebook-orders",
  accessKeyId: "keyidsekrit",
  secretAccessKey: "secretsekrit",
} as const;

const REF = "BK-7QX4RMT";
const NOW = new Date("2026-11-13T09:00:00.000Z");
/** A real 8 px PNG: `artworkPageFor` measures the bytes and will not be lied to. */
function picture(): Uint8Array {
  const png = new PNG({ width: 8, height: 8 });
  png.data.fill(90);
  return new Uint8Array(PNG.sync.write(png, { colorType: 2, inputHasAlpha: true, bitDepth: 8 }));
}
const PICTURE = picture();
const DIGEST = sha256(PICTURE);

// ---------------------------------------------------------------------------
// The fake wire
// ---------------------------------------------------------------------------

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Uint8Array;
}

/** A `fetch` that records every request and answers from a table of replies. */
function wire(
  reply: (sent: Sent, at: number) => { status?: number; body?: string | Uint8Array } = () => ({}),
): { fetch: FetchLike; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetchLike: FetchLike = async (url, init) => {
    const at = sent.length;
    sent.push({ url, method: init.method, headers: init.headers, body: init.body });
    const answer = reply(sent[at], at);
    const status = answer.status ?? 200;
    const body = answer.body ?? "";
    return {
      ok: status >= 200 && status < 300,
      status,
      async text() {
        return typeof body === "string" ? body : new TextDecoder().decode(body);
      },
      async arrayBuffer() {
        const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      },
    };
  };
  return { fetch: fetchLike, sent };
}

/** A ListObjectsV2 body, optionally truncated with a continuation token. */
function listing(keys: string[], next?: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>' +
    `<IsTruncated>${next ? "true" : "false"}</IsTruncated>` +
    (next ? `<NextContinuationToken>${next}</NextContinuationToken>` : "") +
    keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join("") +
    "</ListBucketResult>"
  );
}

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

describe("a write to the looks bucket", () => {
  it("is a signed PUT at the bucket's own path on the S3 endpoint", async () => {
    const w = wire();
    const api = r2ObjectApi(LOOKS, { publicBase: LOOKS.publicBase, fetch: w.fetch });

    const where = await api.put(assetPath(DIGEST), PICTURE, { contentType: "image/png" });

    expect(w.sent).toHaveLength(1);
    const [sent] = w.sent;
    expect(sent.method).toBe("PUT");
    // The S3 endpoint and never the CDN: a write goes to the account's own
    // host, and the custom domain is a read-only front for it.
    expect(sent.url).toBe(
      `https://${LOOKS.accountId}.r2.cloudflarestorage.com/${LOOKS.bucket}/${assetPath(DIGEST)}`,
    );
    expect(sent.url).not.toContain(LOOKS.publicBase);
    expect(sent.body).toEqual(PICTURE);
    expect(sent.headers["content-type"]).toBe("image/png");

    // And the answer is the CDN URL, which is what the manifest records and
    // what the preview is served from.
    expect(where.url).toBe(`${LOOKS.publicBase}/${assetPath(DIGEST)}`);
  });

  it("signs with SigV4 over the exact body, naming the key and never the secret", async () => {
    const w = wire();
    const api = r2ObjectApi(LOOKS, { fetch: w.fetch });
    await api.put(assetPath(DIGEST), PICTURE, { contentType: "image/png" });

    const { headers } = w.sent[0];
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=keyidsekrit\//);
    expect(headers.authorization).toContain("/auto/s3/aws4_request");
    expect(headers.authorization).toMatch(/Signature=[0-9a-f]{64}$/);
    // The payload hash is the body's own digest, which is what makes a tampered
    // body a rejected request rather than a stored one.
    expect(headers["x-amz-content-sha256"]).toBe(DIGEST);
    // The paired negative: nothing on the wire carries the secret itself.
    expect(JSON.stringify(w.sent[0].headers)).not.toContain(LOOKS.secretAccessKey);
  });

  it("refuses with a sentence that names the request and no credential", async () => {
    const w = wire(() => ({ status: 403, body: "SignatureDoesNotMatch" }));
    const api = r2ObjectApi(LOOKS, { fetch: w.fetch });

    await expect(api.put("assets/x.png", PICTURE, { contentType: "image/png" })).rejects.toThrow(
      /R2 refused to write assets\/x\.png: HTTP 403/,
    );
    // `scripts/upload-artwork.ts` matches that prefix to tell a bucket saying
    // no from a bug in this repository, and the repository's logs are public.
    await expect(
      api.put("assets/x.png", PICTURE, { contentType: "image/png" }),
    ).rejects.not.toThrow(new RegExp(LOOKS.secretAccessKey));
  });

  it("writes the manifest as json, so a browser reading it gets json", async () => {
    // `has` is answered 404 throughout, so the picture is written rather than
    // skipped as already there.
    const w = wire((sent) => (sent.method === "HEAD" ? { status: 404 } : {}));
    const store = looksR2Store(
      LOOKS,
      r2ObjectApi(LOOKS, { publicBase: LOOKS.publicBase, fetch: w.fetch }),
    );

    await store.put(TILES_SET, [{ pageId: tilePageId("girl-02"), bytes: PICTURE }], NOW);

    const types = w.sent.filter((s) => s.method === "PUT").map((s) => ({
      url: s.url,
      type: s.headers["content-type"],
    }));
    expect(types).toEqual([
      {
        url: `https://${LOOKS.accountId}.r2.cloudflarestorage.com/${LOOKS.bucket}/${assetPath(DIGEST)}`,
        type: "image/png",
      },
      {
        url:
          `https://${LOOKS.accountId}.r2.cloudflarestorage.com/${LOOKS.bucket}/` +
          manifestPath(TILES_SET, 1),
        type: "application/json",
      },
    ]);
  });

  it("writes a screen derivative as webp, which is the whole point of making one", async () => {
    const w = wire((sent) => (sent.method === "HEAD" ? { status: 404 } : {}));
    const store = looksR2Store(LOOKS, r2ObjectApi(LOOKS, {
      publicBase: LOOKS.publicBase,
      fetch: w.fetch,
    }));

    const made = await store.putScreens([
      { of: DIGEST, width: SCREEN_WIDTH, bytes: new Uint8Array([82, 73, 70, 70]) },
    ]);

    const put = w.sent.find((s) => s.method === "PUT")!;
    expect(put.headers["content-type"]).toBe("image/webp");
    expect(put.url).toContain(screenKey(DIGEST, SCREEN_WIDTH));
    // The address handed to the browser is on the custom domain, never on the
    // S3 endpoint — that one needs a signature and an `<img>` has none.
    expect(made[DIGEST].url).toBe(`${LOOKS.publicBase}/${screenKey(DIGEST, SCREEN_WIDTH)}`);
  });
});

describe("a read", () => {
  it("is a signed GET, even from the public bucket", async () => {
    // Deliberate: a server read going through the CDN would make what the
    // renderer sees depend on a cache. The public base exists for an
    // `<img src>`, which is the browser's job.
    const w = wire(() => ({ body: PICTURE }));
    const api = r2ObjectApi(LOOKS, { publicBase: LOOKS.publicBase, fetch: w.fetch });

    expect(await api.bytes(assetPath(DIGEST))).toEqual(PICTURE);
    expect(w.sent[0].method).toBe("GET");
    expect(w.sent[0].url).toContain(".r2.cloudflarestorage.com/");
    expect(w.sent[0].url).not.toContain("art.onelittlebook.test");
    expect(w.sent[0].headers.authorization).toContain("AWS4-HMAC-SHA256");
  });

  it("answers null for a key that is not there, rather than throwing", async () => {
    // The ordinary state of a store nobody has uploaded to. A thrown error here
    // is a page somebody is waiting on going blank.
    const w = wire(() => ({ status: 404, body: "NoSuchKey" }));
    const api = r2ObjectApi(LOOKS, { fetch: w.fetch });
    expect(await api.bytes(assetPath(DIGEST))).toBeNull();
    expect(await api.has(assetPath(DIGEST))).toBe(false);
  });

  it("answers has() from a HEAD, so an idempotent upload costs no bytes", async () => {
    const w = wire();
    const api = r2ObjectApi(LOOKS, { fetch: w.fetch });
    expect(await api.has(assetPath(DIGEST))).toBe(true);
    expect(w.sent[0].method).toBe("HEAD");
    expect(w.sent[0].body).toBeUndefined();
  });

  it("surfaces a refusal that is not a 404, so a rotated key is not read as empty", async () => {
    // The failure this guards is the quiet one: a token scoped to the other
    // bucket answers 403, and "no artwork" would look exactly like a fresh
    // clone while the shop drew placeholders for every page.
    const w = wire(() => ({ status: 403, body: "AccessDenied" }));
    const api = r2ObjectApi(LOOKS, { fetch: w.fetch });
    await expect(api.bytes(assetPath(DIGEST))).rejects.toThrow(/R2 refused to read/);
    await expect(api.has(assetPath(DIGEST))).rejects.toThrow(/R2 refused to check/);
    await expect(api.pathnames("sets/")).rejects.toThrow(/R2 refused to list/);
  });
});

// ---------------------------------------------------------------------------
// The listing, which is the one that breaks silently
// ---------------------------------------------------------------------------

describe("listing a prefix", () => {
  it("is ListObjectsV2 with the prefix in the query", async () => {
    const w = wire(() => ({ body: listing(["sets/tiles/v0001.json"]) }));
    const api = r2ObjectApi(LOOKS, { fetch: w.fetch });

    expect(await api.pathnames("sets/")).toEqual(["sets/tiles/v0001.json"]);
    expect(w.sent[0].url).toContain("list-type=2");
    expect(w.sent[0].url).toContain("prefix=sets%2F");
  });

  it("pages to exhaustion, which is the bug a six-look bucket already has", async () => {
    // One page is a thousand keys. Twenty-four pages a look, plus a screen
    // copy of each, is past that at six looks and past three thousand at
    // fourteen — and a caller that read one page would report most of the
    // artwork as missing while looking like a bad import.
    const pages = [
      { keys: ["assets/a.png", "assets/b.png"], next: "token-one" },
      { keys: ["assets/c.png"], next: "token-two" },
      { keys: ["assets/d.png"], next: undefined },
    ];
    const w = wire((_sent, at) => ({ body: listing(pages[at].keys, pages[at].next) }));
    const api = r2ObjectApi(LOOKS, { fetch: w.fetch });

    expect(await api.pathnames("assets/")).toEqual([
      "assets/a.png",
      "assets/b.png",
      "assets/c.png",
      "assets/d.png",
    ]);
    expect(w.sent).toHaveLength(3);
    // The first request carries no token and each one after it carries the
    // previous answer's.
    expect(w.sent[0].url).not.toContain("continuation-token");
    expect(w.sent[1].url).toContain("continuation-token=token-one");
    expect(w.sent[2].url).toContain("continuation-token=token-two");
  });

  it("stops rather than looping when a response is truncated and says nothing more", async () => {
    // The paired negative of the case above. A malformed answer has to read as
    // "no more" — a loop here is a function that never returns.
    const w = wire(() => ({ body: listing(["assets/a.png"], undefined) }));
    const api = r2ObjectApi(LOOKS, { fetch: w.fetch });
    expect(await api.pathnames("assets/")).toEqual(["assets/a.png"]);
    expect(w.sent).toHaveLength(1);

    expect(nextContinuationToken(listing([], "t"))).toBe("t");
    expect(nextContinuationToken(listing([]))).toBeNull();
    expect(nextContinuationToken("<IsTruncated>true</IsTruncated>")).toBeNull();
    expect(keysIn(listing(["a&amp;b"]))).toEqual(["a&b"]);
  });
});

// ---------------------------------------------------------------------------
// The private bucket, on the same wire
// ---------------------------------------------------------------------------

describe("the private bucket's requests", () => {
  it("go to its own bucket and carry no public domain anywhere", async () => {
    const w = wire((sent) => (sent.method === "HEAD" ? { status: 404 } : {}));
    const store = orderArtworkR2Store(ORDERS, r2ObjectApi(ORDERS, {
      publicBase: null,
      fetch: w.fetch,
    }));

    const version = await store.put(REF, [{ pageId: "page-006", bytes: PICTURE }], NOW);

    for (const sent of w.sent) {
      // The bucket is the first path segment on every request, listings
      // included — which is the only thing in a signed request that separates
      // this bucket from the public one.
      expect(new URL(sent.url).pathname.split("/")[1]).toBe(ORDERS.bucket);
      expect(sent.url).not.toContain(LOOKS.bucket);
      expect(sent.url).not.toContain("art.onelittlebook.test");
    }
    // And nothing it recorded is an address, which is the type's promise kept
    // at runtime on the wire this test is watching.
    expect(version.pages[0].url).toBeUndefined();
    expect(JSON.stringify(version)).not.toContain("https://");
  });
});

// ---------------------------------------------------------------------------
// What this environment describes
// ---------------------------------------------------------------------------

describe("reading the environment", () => {
  const BOTH = {
    [ACCOUNT_VAR]: LOOKS.accountId,
    [ACCESS_KEY_VAR]: LOOKS.accessKeyId,
    [SECRET_KEY_VAR]: LOOKS.secretAccessKey,
    [LOOKS_BUCKET_VAR]: LOOKS.bucket,
    [PUBLIC_BASE_VAR]: LOOKS.publicBase,
    [ORDER_ARTWORK_BUCKET_VAR]: ORDERS.bucket,
  };

  it("builds each bucket from its own rows", () => {
    expect(looksBucketIn(BOTH)).toEqual(LOOKS);
    expect(orderArtworkBucketIn(BOTH)).toEqual(ORDERS);
  });

  it("names every empty row rather than the first one, which is the whole refusal", () => {
    // A refusal that names one row sends somebody back four times. This is the
    // shape `lib/checkout.ts` § REQUIRED has for the same reason.
    expect(missingFor({}, "looks").sort()).toEqual(
      [ACCOUNT_VAR, LOOKS_BUCKET_VAR, ACCESS_KEY_VAR, SECRET_KEY_VAR, PUBLIC_BASE_VAR].sort(),
    );
    expect(missingFor({}, "order-artwork").sort()).toEqual(
      [ACCOUNT_VAR, ORDER_ARTWORK_BUCKET_VAR, ACCESS_KEY_VAR, SECRET_KEY_VAR].sort(),
    );
    // The custom domain is in the public list and not in the private one,
    // which is `publicBase` not existing on the private configuration said in
    // a second place.
    expect(missingFor({}, "order-artwork")).not.toContain(PUBLIC_BASE_VAR);
    expect(missingFor(BOTH, "looks")).toEqual([]);
    expect(missingFor(BOTH, "order-artwork")).toEqual([]);
  });

  it("knows r2.dev from a custom domain, because one of them is for traffic", () => {
    expect(isDefaultR2Domain("https://pub-0123456789.r2.dev")).toBe(true);
    expect(isDefaultR2Domain("https://art.onelittlebook.com")).toBe(false);
    // Not a substring match: a domain that merely mentions it is a real one.
    expect(isDefaultR2Domain("https://r2.dev.onelittlebook.com")).toBe(false);
    expect(isDefaultR2Domain("nonsense")).toBe(false);
  });

  it("is null for either bucket with nothing set, which is a fresh clone", () => {
    expect(looksBucketIn({})).toBeNull();
    expect(orderArtworkBucketIn({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The keys came across unchanged, which is what made this an adapter
// ---------------------------------------------------------------------------

describe("the key layout", () => {
  it("is the same layout the previous provider wrote, so nothing was re-imported", () => {
    // Spelled out rather than derived, because this is the one assertion whose
    // whole job is to be a record of what the keys were. A page's bytes are
    // named by their own digest, a version's manifest by its padded number,
    // and a derivative by the digest of the master it came from.
    expect(assetPath(DIGEST)).toBe(`assets/${DIGEST}.png`);
    expect(manifestPath(lookSet("girl-02"), 1)).toBe("sets/look-girl-02/v0001.json");
    expect(manifestPath(TILES_SET, 42)).toBe("sets/tiles/v0042.json");
    expect(screenKey(DIGEST, 1600)).toBe(`screen/${DIGEST}-w1600.webp`);
  });

  it("carries no provider, no account and no domain in any of it", () => {
    // Which is what makes the next move an adapter too. A key with an account
    // id or a store id in it would have had to be rewritten this time.
    const keys = [
      assetPath(DIGEST),
      manifestPath(TILES_SET, 1),
      screenKey(DIGEST, SCREEN_WIDTH),
    ];
    for (const key of keys) {
      expect(key).not.toContain(LOOKS.accountId);
      expect(key).not.toContain(LOOKS.bucket);
      expect(key).not.toContain("r2");
      expect(key).not.toContain("blob");
      expect(key).not.toMatch(/^https?:/);
    }
  });
});
