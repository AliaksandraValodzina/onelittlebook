/**
 * **What one version of one set of artwork says about itself.**
 *
 * The record, the tolerant reader for one that was written by an older build,
 * and the one derivation both store implementations have to agree on: an
 * `AssetRef` is **measured out of the bytes**, never copied from a filename or
 * from whatever a tool reported.
 *
 * It is its own module for the same reason `./keys.ts` is: `./store.ts` holds
 * the filesystem implementation and `./blob.ts` holds the bucket, and the one
 * thing that must not differ between them is the shape of the manifest and how
 * the numbers in it were arrived at. Two readers would be two opinions about
 * what a page is, and the wrong one is always the one nobody is reading when a
 * book comes back with the wrong child on page six.
 */

import { sha256 } from "../assets/digest";
import { readPngHeader } from "../render/png";
import { isArtworkPageId } from "./keys";
import type { AssetRef } from "../template/types";

/** One page of one version, named by the page it replaces and by its content. */
export interface ArtworkPage {
  /** A page id of the book — `cover`, `page-001`. Never a filename. */
  pageId: string;
  /**
   * The bytes, by content hash and measured size.
   *
   * An `AssetRef` and not a path, which is what lets the renderer treat this
   * artwork exactly as it treats the twelve looks' artwork: `lib/book/derive.ts`
   * puts an `image` layer on the page and the bytes arrive through the
   * `supplied` seam. Nothing downstream knows this picture came from an order
   * rather than from a release.
   */
  asset: AssetRef;
  /**
   * Where these bytes are publicly readable, when the store holding them is a
   * public one.
   *
   * **Absent means there is no public URL for this picture** — which is the
   * state of every picture in the local filesystem store (a directory on
   * somebody's laptop has no address) and of every picture in the **private**
   * store, where the whole point is that no URL exists. A reader that wants a
   * URL and finds none asks `/api/assets/<digest>.<ext>`, which answers from
   * wherever the bytes actually are; `lib/assets/address.ts` is that rule.
   *
   * It is on the *store's* record and deliberately not on the `AssetRef`:
   * `lib/template/types.ts` § `AssetRef` says a ref carries no address,
   * because a template outlives every bucket it is served from.
   */
  url?: string;
}

export interface ArtworkVersion {
  /** 1, 2, 3 … The highest is the one in use. */
  version: number;
  /** ISO 8601, from the clock the caller passed in. */
  at: string;
  pages: ArtworkPage[];
}

/**
 * The record for one page, derived from its own bytes.
 *
 * The two numbers in `px` are **measured out of the IHDR** and never reported:
 * `placePhoto` and the renderer divide by them, so a wrong pair is a page with
 * the child's head out of the window rather than a validation error.
 */
export function artworkPageFor(
  pageId: string,
  bytes: Uint8Array,
  label: string,
  url?: string,
): ArtworkPage {
  const header = readPngHeader(bytes);
  return {
    pageId,
    asset: {
      sha256: sha256(bytes),
      mime: "image/png",
      px: [header.width, header.height],
      label,
    },
    ...(url ? { url } : {}),
  };
}

/** A manifest read back tolerantly — it may have been written by an older build. */
export function readManifest(raw: unknown, version: number): ArtworkVersion | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<ArtworkVersion>;
  if (!Array.isArray(v.pages)) return null;
  const pages: ArtworkPage[] = [];
  for (const entry of v.pages) {
    const page = entry as Partial<ArtworkPage>;
    const asset = page.asset as Partial<AssetRef> | undefined;
    if (!isArtworkPageId(page.pageId)) continue;
    if (!asset || typeof asset.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(asset.sha256)) continue;
    const px = asset.px;
    if (!Array.isArray(px) || px.length !== 2) continue;
    pages.push({
      pageId: page.pageId,
      asset: {
        sha256: asset.sha256,
        mime: "image/png",
        px: [Number(px[0]), Number(px[1])],
        label: typeof asset.label === "string" ? asset.label : undefined,
      },
      // A URL is only honoured when it is an `https:` one. A manifest is a
      // file this process did not write in the general case, and a `javascript:`
      // string reaching an `<img src>` would be the one way artwork storage
      // could become a scripting hole.
      ...(typeof page.url === "string" && page.url.startsWith("https://") ? { url: page.url } : {}),
    });
  }
  return {
    version: typeof v.version === "number" ? v.version : version,
    at: typeof v.at === "string" ? v.at : "",
    pages,
  };
}

/** The bytes of a manifest, as both stores write it. */
export function manifestBytes(record: ArtworkVersion): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(record, null, 2)}\n`);
}
