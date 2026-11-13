/**
 * **S3 over HTTP, signed by hand — the part two buckets share.**
 *
 * R2 speaks S3, and S3 request signing is **AWS Signature Version 4**: a
 * published, frozen algorithm with official test vectors, which is the reason
 * this file exists instead of a dependency. The alternative is an AWS SDK — a
 * few megabytes of client, credential-provider chains, retry middleware and a
 * region resolver — to make a handful of requests whose shapes are all written
 * out by their callers. This repository already hand-writes a PDF writer, a PNG
 * writer and a JPEG size reader for the same trade, and the trade is better
 * here than in any of those: `test/order-store.test.ts` signs AWS's own
 * documented example request and compares the signature to the one AWS
 * publishes for it, so the hard part is checked against the specification
 * rather than against itself.
 *
 * ## Why it is its own module
 *
 * It was inside `lib/orders/r2.ts` while there was one bucket. There are now
 * **two**, for two unrelated reasons, and they must not share a bucket:
 *
 * | Bucket | Variables | Holds | Public? |
 * |---|---|---|---|
 * | the orders bucket | `R2_BUCKET` | `orders/<ref>.json`, `photos/<sha256>.<ext>` | **no** |
 * | the looks bucket | `R2_LOOKS_BUCKET` + `R2_PUBLIC_BASE` | the looks' pages, the portrait tiles, the golden ghost halves, the covers | **yes**, over a custom domain |
 *
 * `lib/artwork/r2.ts` § Two buckets and never one says why attaching a public
 * domain to the orders bucket is the thing that may not happen. What both of
 * them genuinely share is the signing, so the signing is here and neither of
 * them owns it. `lib/orders/r2.ts` re-exports every name it used to export, so
 * nothing that was reading it had to learn a new module.
 *
 * **What is not checked anywhere is the bucket.** No test in this repository
 * touches a live R2 bucket, because there is no credential in a public
 * repository to touch one with. So what is proven is the signing, the request
 * shaping and the lifecycle above it; what is not proven is that Cloudflare
 * accepts it. Every PR that touches this path says so plainly rather than
 * implying a green suite means a working bucket.
 */

import { createHash, createHmac } from "node:crypto";

/** What it takes to reach one bucket. An account id is a credential here. */
export interface R2Credentials {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** R2 has one region and it is the literal string `auto`. */
const REGION = "auto";
const SERVICE = "s3";

/** `<accountId>.r2.cloudflarestorage.com` — the S3 endpoint, never the CDN. */
export function r2Host(accountId: string): string {
  return `${accountId}.r2.cloudflarestorage.com`;
}

const hex = (bytes: Uint8Array | Buffer) => Buffer.from(bytes).toString("hex");
const sha = (data: string | Uint8Array) => hex(createHash("sha256").update(data).digest());
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

/**
 * Per RFC 3986, which is **not** what `encodeURIComponent` does.
 *
 * It leaves `!`, `'`, `(`, `)` and `*` alone, and SigV4's canonical request is
 * a string comparison against what the service encoded — so a key with a
 * bracket in it would sign correctly here and be rejected there. No key this
 * code writes contains one; signing them properly costs five characters and
 * removes the question.
 */
function uriEncode(raw: string): string {
  return encodeURIComponent(raw).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** A path, encoded segment by segment: the separators are structure, not data. */
function canonicalPath(path: string): string {
  return path.split("/").map(uriEncode).join("/");
}

export interface SignedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

/**
 * **The signing key, derived from the secret by four chained HMACs.**
 *
 * Exported because AWS publishes a worked example of exactly this derivation,
 * and `test/order-store.test.ts` checks against it. It is the half of SigV4
 * most likely to be subtly wrong — the literal `"AWS4"` prefix, the order of
 * the four steps, the final `"aws4_request"` — and all of it is unobservable
 * from the outside unless the whole signature is wrong.
 */
export function signingKey(options: {
  secretAccessKey: string;
  dateStamp: string;
  region: string;
  service: string;
}): Buffer {
  const kDate = hmac(`AWS4${options.secretAccessKey}`, options.dateStamp);
  const kRegion = hmac(kDate, options.region);
  const kService = hmac(kRegion, options.service);
  return hmac(kService, "aws4_request");
}

export interface SignatureParts {
  /** AWS's own term. The request reduced to the exact string that gets hashed. */
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
  signedHeaders: string;
  scope: string;
  headers: Record<string, string>;
  canonicalQuery: string;
  path: string;
}

/**
 * **The whole of SigV4, with its intermediate strings exposed.**
 *
 * The intermediates are returned because AWS publishes them for a worked
 * example, and checking against a published canonical request and a published
 * string-to-sign is the difference between testing this code and testing it
 * against itself. The final signature is then an HMAC of one checked value
 * under another, which has nowhere left to hide a mistake.
 *
 * The steps are AWS's own, in AWS's own order, and the names below are the
 * names in their specification so the two can be read side by side.
 */
export function signatureParts(options: {
  method: string;
  /** The path after the host, starting with a slash. Not yet encoded. */
  path: string;
  /** Query parameters, sorted and encoded here. */
  query?: Record<string, string>;
  host: string;
  headers?: Record<string, string>;
  /** The body, or the empty string. Hashed, never logged. */
  body?: Uint8Array | string;
  secretAccessKey: string;
  region?: string;
  service?: string;
  /** Passed in rather than read, so the signature is a pure function of its inputs. */
  now: Date;
}): SignatureParts {
  const region = options.region ?? REGION;
  const service = options.service ?? SERVICE;
  const amzDate = options.now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha(options.body ?? "");

  const headers: Record<string, string> = {
    host: options.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...Object.fromEntries(
      Object.entries(options.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    ),
  };

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names
    .map((n) => `${n}:${headers[n].trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const signedHeaders = names.join(";");

  const query = options.query ?? {};
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`)
    .join("&");

  const path = canonicalPath(options.path);
  const canonicalRequest = [
    options.method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha(canonicalRequest)].join("\n");
  const signature = hex(
    hmac(signingKey({ secretAccessKey: options.secretAccessKey, dateStamp, region, service }), stringToSign),
  );

  return { canonicalRequest, stringToSign, signature, signedHeaders, scope, headers, canonicalQuery, path };
}

/** One signed request, ready for `fetch`. */
export function signV4(options: Parameters<typeof signatureParts>[0] & { accessKeyId: string }): SignedRequest {
  const parts = signatureParts(options);
  return {
    url: `https://${options.host}${parts.path}${parts.canonicalQuery ? `?${parts.canonicalQuery}` : ""}`,
    method: options.method,
    headers: {
      ...parts.headers,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${parts.scope}, ` +
        `SignedHeaders=${parts.signedHeaders}, Signature=${parts.signature}`,
    },
  };
}

/** Just enough of `fetch` for this path, so a test can hand it a fake. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: Uint8Array },
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }>;

/** `fetch`, shaped as the seam above. The only caller that reaches a network. */
export function realFetch(): FetchLike {
  return (url, init) =>
    fetch(url, {
      method: init.method,
      headers: init.headers,
      // `fetch` will not take a `Uint8Array` view as a body in every runtime's
      // type definitions; the underlying buffer always works.
      body: init.body ? (init.body as unknown as BodyInit) : undefined,
    });
}

/**
 * Every `<Key>` in a ListObjectsV2 response.
 *
 * A regular expression over XML is normally a poor idea and is the right trade
 * here, for `test/config.test.ts`'s reason stated about YAML: the alternative
 * is an XML parser whose only consumer is this line, and the shape being read
 * is one element of one well-known response. **Order is not taken from this
 * list** by either caller — the orders store sorts records by their own
 * `createdAt`, and the artwork store sorts version numbers it parsed out of the
 * keys — because a bucket's modified time is not a fact about the thing stored.
 */
export function keysIn(xml: string): string[] {
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) =>
    m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
  );
}

/**
 * The continuation token of a truncated ListObjectsV2 response, or null.
 *
 * **A listing that stops at a thousand keys is the failure this guards**, and
 * it is not hypothetical: the looks bucket holds one object per page per look
 * plus a screen-sized copy of each, which is already past a thousand at six
 * looks and will be past three thousand at fourteen. A caller that read only
 * the first page would quietly report half the artwork as missing, and the
 * pages it reported would be the alphabetically early ones — a bug that looks
 * like a bad import rather than like a bad listing.
 *
 * `IsTruncated` is checked as well as the token, because a well-formed
 * untruncated response carries neither and a malformed one must read as "no
 * more" rather than as a loop.
 */
export function nextContinuationToken(xml: string): string | null {
  if (!/<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml)) return null;
  const match = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml);
  return match ? match[1] : null;
}
