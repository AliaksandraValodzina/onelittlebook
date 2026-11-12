/**
 * **The one place a screen derivative becomes an address — and the print path
 * may not import it.**
 *
 * `./address.ts` § `hrefIn` answers *"what URL do I put in an `<image>`"* for a
 * picture's own bytes. This answers the narrower question the preview actually
 * has: *"is there a screen-sized copy of this picture, and where"* — and
 * prefers it, because a page shown 700 px wide has no use for 3600 px of it.
 *
 * ## The tension in "one renderer", resolved honestly
 *
 * `lib/render/svg.ts` is the only thing that draws a page and that does not
 * change here. **What differs between the screen and the press is which
 * *resolution of source artwork* is resolved for each**, and that difference
 * lives exactly where every other screen/print difference in this codebase
 * lives: in the `href` function the caller supplies. `renderPageSvg`'s own
 * docblock already calls that "an *address*, not a drawing".
 *
 * So there is still one renderer, one template and one fill. The screen passes
 * `screenHrefIn`; the print path passes a function returning a `data:` URI of
 * the master's own bytes and **cannot** pass this one, because `renderPrintSvg`
 * takes no options object at all. Nobody "simplifying" this later can collapse
 * it into two drawing paths, because there is only ever one drawing path to
 * collapse.
 *
 * ## Why a derivative cannot reach a print file
 *
 * A soft, low-resolution printed book is the worst failure this product has,
 * and unlike a bad preview nobody finds out until a box arrives. Four
 * independent things stand in the way, in order of strength:
 *
 * 1. **A derivative is never an `AssetRef`.** It has no `sha256` field
 *    anywhere — the store keys it by the digest of the *master* and carries its
 *    address in a `ScreenAddress` — so it cannot be put in `PageArt.byLook`, in
 *    an `image` layer, in a `BookFill` photo, or handed to `loadAsset` or
 *    `verifySupplied`. That is the same device `lib/book/preview-art.ts` uses
 *    for the golden halves, for the same reason.
 * 2. **The print path resolves bytes, not URLs**, and it resolves them by
 *    digest: `lib/render/raster.ts` § `inlineAssets` inlines `loadAsset(ref)`
 *    for every ref the template names, and every store it reads verifies the
 *    bytes against that digest. Derivative bytes hash to something else, so
 *    even smuggled in they are refused rather than drawn.
 * 3. **This module is not reachable from the print path**, asserted by walking
 *    the import graph off disk in `test/screen-derivatives.test.ts` — the same
 *    check `test/ghost.test.ts` makes for the ghost.
 * 4. **`test/no-derivative-in-a-print-file.ts`** is a file of calls that must
 *    not compile, so `npm run lint` goes red the day one of them becomes legal.
 *    `test/no-fold-in-a-print-file.ts` carries the reasoning for that device.
 *
 * And a fifth, free: the page contract refuses one on size.
 * `lib/book/upload.ts` § `pageAgainstContract` requires the book's declared
 * page size, which a 1600 px picture is not, so a derivative handed to the look
 * importer is `page.wrongSize`.
 */

import type { AssetRef } from "../template/types";
import {
  NO_ASSET_ADDRESSES,
  NO_SCREEN_ADDRESSES,
  assetRouteUrl,
  hrefIn,
  type AssetAddresses,
  type ScreenAddresses,
} from "./address";

/**
 * The `href` function a **screen** render takes: the derivative where there is
 * one, and everything `hrefIn` would have answered where there is not.
 *
 * The fallback is the whole reason this wraps `hrefIn` rather than replacing
 * it. Three of the four states this shop runs in have no derivatives at all —
 * a fresh clone, a local import, a store uploaded before this existed — and in
 * every one of them the preview must draw the master rather than a hole. The
 * property that path has always had is the one being kept: **a missing picture
 * is never a broken page**, because somebody is deciding whether to buy the
 * book it is on.
 */
export function screenHrefIn(
  screen: ScreenAddresses = NO_SCREEN_ADDRESSES,
  addresses: AssetAddresses = NO_ASSET_ADDRESSES,
  fallback: (ref: AssetRef) => string = assetRouteUrl,
): (ref: AssetRef) => string {
  const master = hrefIn(addresses, fallback);
  return (ref) => screen[ref.sha256]?.url ?? master(ref);
}

/**
 * How wide the picture the screen will actually fetch is, or null when it is
 * the master.
 *
 * For a `data-` attribute and for a test: *"the preview resolved a 1600 px
 * copy of this page"* is the assertion that makes the whole arrangement
 * checkable, and reading it off the same map the `href` came from is what keeps
 * the answer and the request in step.
 */
export function screenWidthFor(screen: ScreenAddresses, ref: AssetRef): number | null {
  return screen[ref.sha256]?.width ?? null;
}
