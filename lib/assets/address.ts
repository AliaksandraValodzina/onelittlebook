/**
 * **Where a picture is, as a string — and nothing that reads a filesystem.**
 *
 * `./resolve.ts` is the server's answer to "give me these bytes"; this is the
 * much smaller question *"what URL do I put in an `<img>`"*, and it is a
 * separate module because **three kinds of caller need the same answer and one
 * of them is the browser**. `app/_book/BookPage.tsx` and `app/_book/tile.ts`
 * are client components: importing `./resolve.ts` there would pull
 * `node:fs/promises` and `process.env` into a bundle that has neither.
 *
 * ## An address is not part of the format
 *
 * `lib/template/types.ts` § `AssetRef` says it out loud — `label` is "never an
 * address" — and the reason is that a template is a document that outlives
 * every bucket it is ever served from. So the mapping from a digest to a URL
 * lives **here and in the environment**, never on the ref, and it arrives at a
 * drawing call as the `href` option `renderPageSvg` already takes.
 *
 * ## The two answers, and what each one means
 *
 * **An address book entry** — `AssetAddresses` below — is a digest the artwork
 * store has told us is *publicly readable at this exact URL*. It comes from the
 * store that holds the bytes (`lib/artwork/blob.ts` writes one; the local
 * filesystem store writes none, because a directory on somebody's laptop has
 * no URL), travels server to client as data, and is why a twenty-five page
 * preview served from a public Blob store is twenty-five CDN reads and not
 * twenty-five function invocations.
 *
 * **`/api/assets/<digest>.<ext>`** is the answer for everything else, and it is
 * a complete answer rather than a fallback in the apologetic sense: that route
 * serves the fixture photographs, then the artwork store, so a digest missing
 * from the address book still draws. That is the property the whole read path
 * is built around — *a missing image must never render as a broken page*,
 * because somebody is deciding whether to buy the book it is on.
 */

import type { AssetRef } from "../template/types";

/** The file extension each mime is stored under. A key is `<sha256>.<ext>`. */
export const ASSET_EXTENSIONS: Record<AssetRef["mime"], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** `<sha256>.<ext>` — the key in every store, because the content is the name. */
export function assetKey(ref: AssetRef): string {
  return `${ref.sha256}.${ASSET_EXTENSIONS[ref.mime]}`;
}

/**
 * Digest → public URL, for the pictures a store has said are publicly readable.
 *
 * A plain record and not a `Map`, because it crosses the server/client boundary
 * as a prop and has to be serialisable. Empty is the normal state: no artwork
 * imported, or an artwork store with no public URLs.
 */
export type AssetAddresses = Readonly<Record<string, string>>;

export const NO_ASSET_ADDRESSES: AssetAddresses = {};

/**
 * **Where one picture's screen-sized copy is readable, and how wide it is.**
 *
 * The preview shows a spread about 700 px wide out of a 3600 px master, so the
 * screen fetches a 1600 px WebP instead and the whole book is a couple of
 * megabytes rather than sixty-two. `lib/artwork/screen.ts` makes them at
 * upload and `lib/artwork/keys.ts` § `screenKey` is where they are kept.
 *
 * **An object and not a URL string, so this and `AssetAddresses` cannot be
 * mistaken for each other by the compiler.** They answer two different
 * questions about the same digest: `AssetAddresses` is *where those exact
 * bytes are*, and this is *where a different, smaller picture made from them
 * is*. Conflating them is how a 1600 px page would end up in a printed book,
 * which is the worst failure this product has — so they are different shapes
 * and the resolver that reads this one (`./screen.ts`) is a module the print
 * path may not import.
 *
 * It lives here rather than with the store that writes it for two reasons:
 * `AssetAddresses` is here, and the two are only legible side by side; and a
 * client component needs this type and may not import `lib/artwork/store.ts`,
 * which reads a filesystem.
 */
export interface ScreenAddress {
  /** Says which kind of thing this is to a reader; the structure is the guard. */
  readonly kind: "screen";
  readonly url: string;
  /** The width actually produced — at most `SCREEN_WIDTH`, never more. */
  readonly width: number;
}

/** Master digest → its screen derivative. Empty is the ordinary state. */
export type ScreenAddresses = Readonly<Record<string, ScreenAddress>>;

export const NO_SCREEN_ADDRESSES: ScreenAddresses = {};

/** The route that answers for a digest nobody has published a URL for. */
export function assetRouteUrl(ref: AssetRef): string {
  return `/api/assets/${assetKey(ref)}`;
}

/**
 * The `href` function a render call takes, given an address book.
 *
 * `fallback` is the only reason this is a factory rather than a function of two
 * arguments: on the server the fallback is `assetUrl`, which also knows about
 * `R2_PUBLIC_BASE_URL`; in the browser it is the route, which is the only
 * address a client component can know. Both end up asking the same question in
 * the same order.
 */
export function hrefIn(
  addresses: AssetAddresses = NO_ASSET_ADDRESSES,
  fallback: (ref: AssetRef) => string = assetRouteUrl,
): (ref: AssetRef) => string {
  return (ref) => addresses[ref.sha256] ?? fallback(ref);
}
