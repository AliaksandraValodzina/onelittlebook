/**
 * **A screen derivative cannot reach a print file, asserted by the compiler.**
 *
 * `lib/artwork/screen.ts` carries the argument: the preview shows a spread
 * about 700 px wide out of a 3600 px page, so the browser is sent a 1600 px
 * WebP instead — and **the same picture in a print file is a soft,
 * low-resolution printed book, which cannot be undone after a box has been
 * posted.** It is the one failure of this product that nobody finds out about
 * until a family opens it.
 *
 * `test/no-fold-in-a-print-file.ts` is the same device for the spread fold and
 * carries the reasoning for the device itself: **this file is not a test and
 * runs nothing.** Every statement in it is a call that *must not compile*,
 * marked `@ts-expect-error`, and `tsc` reports an unused `@ts-expect-error` as
 * an error — so the day one of these becomes legal, `npm run lint` goes red
 * with nothing for anybody to remember. It is `.ts` and not `.test.ts` because
 * `vitest.config.mts` collects `test/**\/*.test.{ts,tsx}` and ignores this,
 * while `tsconfig.json` includes it.
 *
 * Where the fold is *not a thing drawn on a page at all*, a derivative is
 * one notch weaker and one notch different: it **is** a picture, and the
 * guarantee is that it is never a picture the format can name. It has no
 * `sha256` anywhere — the store keys it by the digest of the **master** and
 * carries its address in a `ScreenAddress` — which is the trick
 * `lib/book/preview-art.ts` plays with `digest` for the golden halves, for the
 * same reason.
 *
 * `test/screen-derivatives.test.ts` is the other half, and reads the bytes, the
 * import graph and the two renders of one page.
 */

import { MY_FOREVER } from "../templates/my-forever";
import { FIXTURE_FILL } from "../fixtures/order";
import { assetUrl, loadAsset } from "../lib/assets/resolve";
import { verifySupplied } from "../lib/assets/supplied";
import { renderPageSvg } from "../lib/render/svg";
import { renderPrintSvg } from "../lib/render/raster";
import { screenHrefIn } from "../lib/assets/screen";
import { orderArtworkR2Store } from "../lib/artwork/r2";
import type {
  AssetAddresses,
  ScreenAddress,
  ScreenAddresses,
} from "../lib/assets/address";
import type { PageArt } from "../lib/book/types";
import type { Layer, PageFill } from "../lib/template/types";

/** One derivative's address, as the public store reports it. */
const SMALL: ScreenAddress = {
  kind: "screen",
  url: "https://store.public.blob.vercel-storage.com/screen/" + "0".repeat(64) + "-w1600.webp",
  width: 1600,
};
const SCREEN: ScreenAddresses = { ["0".repeat(64)]: SMALL };
const MASTERS: AssetAddresses = { ["0".repeat(64)]: "https://store.example/assets/x.png" };

/**
 * The calls that are correct, so the refusals below are not failing for some
 * unrelated reason. (A file of nothing but expected errors passes when the
 * imports are broken.)
 *
 * The first is the whole of what this feature *is*: one renderer, one
 * template, one fill, and an `href` that prefers the smaller copy.
 */
renderPageSvg(MY_FOREVER, FIXTURE_FILL, { href: screenHrefIn(SCREEN, MASTERS) });
renderPageSvg(MY_FOREVER, FIXTURE_FILL, { href: assetUrl });
void renderPrintSvg(MY_FOREVER, FIXTURE_FILL);

// --- The print path has no argument a derivative could arrive in -----------

// `renderPrintSvg(template, fill, supplied?)`, and `supplied` is a
// `Map<string, Uint8Array>` of bytes. There is no options object, which is the
// same structural fact that makes `guides` and `ghost` unreachable from here.
// @ts-expect-error the print path takes no options object, so no href of any kind
void renderPrintSvg(MY_FOREVER, FIXTURE_FILL, { href: screenHrefIn(SCREEN, MASTERS) });

// And the one argument it does take is bytes, not addresses: an address book
// cannot be passed as the supplied-bytes map.
// @ts-expect-error a map of addresses is not a map of bytes
void renderPrintSvg(MY_FOREVER, FIXTURE_FILL, SCREEN);

// --- The renderer has no resolution option, because resolution is an address -

// This is the half that keeps "one renderer" honest. There is no `screen`
// option, no `size` option and no `forPrint` flag: the only thing that differs
// between the two uses is the function that turns a ref into a URL, which
// `renderPageSvg`'s own docblock calls "an *address*, not a drawing".
// @ts-expect-error RenderOptions has exactly two options and neither is a resolution
renderPageSvg(MY_FOREVER, FIXTURE_FILL, { href: assetUrl, screen: SCREEN });

// --- Nor can a derivative be named by the format ---------------------------

// A `ScreenAddress` is not an `AssetRef`: no `sha256`, no `mime`, no measured
// `px`. So it cannot be loaded as bytes…
// @ts-expect-error a screen address is not an asset reference
void loadAsset(SMALL);

// …nor verified as a supplied picture…
// @ts-expect-error a screen address is not an asset reference
void verifySupplied([SMALL], {});

// …nor put on a page as the artwork of a look…
const art: PageArt = {
  kind: "asset",
  // @ts-expect-error a screen address cannot be a look's page artwork
  byLook: { "girl-01": SMALL },
};
void art;

// …nor drawn as an `image` layer…
const smuggled: Layer = {
  id: "small",
  kind: "image",
  frame: { x: 0, y: 0, width: 10, height: 10 },
  // @ts-expect-error a screen address is not an asset and cannot be drawn as one
  asset: SMALL,
};
void smuggled;

// …nor stand in for the buyer's own photograph in a fill, which is the one
// picture in this product that arrives from outside it.
const fill: PageFill = {
  schema: 1,
  templateId: MY_FOREVER.id,
  templateRev: MY_FOREVER.rev,
  // @ts-expect-error a screen address is not a photograph
  photos: { photo: { asset: SMALL } },
};
void fill;

// --- The two address books are not each other -----------------------------

// `AssetAddresses` is *where those exact bytes are*; `ScreenAddresses` is
// *where a smaller picture made from them is*. Conflating them is how a
// 1600 px page would end up in a print file, so they are different shapes.
// @ts-expect-error a screen address is not a URL string
const asMasters: AssetAddresses = SCREEN;
void asMasters;
// @ts-expect-error a URL string is not a screen address
const asScreens: ScreenAddresses = MASTERS;
void asScreens;

// --- And the private store cannot hold one at all --------------------------

// Derivatives exist to be fetched from a CDN, and the order-artwork bucket is
// private — no custom domain, no URL for anything in it: a guessable URL for a
// page regenerated from a photograph of one family's child is the worst thing
// this product could leak. So the two operations are on `PublicArtworkStore`
// only and the private store has no such method —
// `lib/artwork/object-store.ts` § objectScreenStore says why that is a separate
// factory rather than two more cases in the shared one, and it takes the public
// base as a non-optional string so there is nothing to compose it onto.
const orders = orderArtworkR2Store({
  for: "order-artwork",
  accountId: "account",
  bucket: "onelittlebook-orders",
  accessKeyId: "key",
  secretAccessKey: "secret",
});
// @ts-expect-error the private store has no screen derivatives
void orders.putScreens([]);
// @ts-expect-error the private store has no screen derivatives
void orders.screens();
