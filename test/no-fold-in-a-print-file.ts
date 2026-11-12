/**
 * **The fold cannot reach a print file, asserted by the compiler.**
 *
 * `lib/book/fold.ts` carries the argument: the gutter shading and the
 * curvature are screen chrome, and **a gutter shadow baked into a print file is
 * a grey smear down the middle of a real book, which cannot be undone after
 * printing.** The physical book makes its own fold.
 *
 * `lib/render/ghost.ts` makes the same case one notch weaker for the ghost — it
 * is a *render option* the print path has no argument for. The fold is a notch
 * stronger: it is not a thing that is drawn on a page at all. It spans two
 * pages, no `PageTemplate` describes a facing page, and a `SpreadFold` is three
 * class names and a fraction. So there is no option to decline to pass, and the
 * statements below are the proof that there is also no other door — not a
 * layer, not an asset, not the ghost's own option.
 *
 * **This file is not a test and runs nothing.** Every statement in it is a call
 * that *must not compile*, marked `@ts-expect-error`. `tsc` reports an unused
 * `@ts-expect-error` as an error, so the day one of these becomes legal
 * `npm run lint` goes red — the assertion is carried by the typechecker the
 * whole repository already runs, with nothing to remember. It is `.ts` and not
 * `.test.ts` for the reason `test/no-order-asset-in-the-public-store.ts` gives:
 * `vitest.config.mts` collects `test/**\/*.test.{ts,tsx}` and ignores this,
 * while `tsconfig.json` includes it.
 *
 * `test/spread-fold.test.tsx` is the other half, and reads the bytes.
 */

import { MY_FOREVER } from "../templates/my-forever";
import { FIXTURE_FILL } from "../fixtures/order";
import { assetUrl } from "../lib/assets/resolve";
import { renderPageSvg } from "../lib/render/svg";
import { renderPrintSvg } from "../lib/render/raster";
import { SPREAD_FOLD, foldBand } from "../lib/book/fold";
import type { Layer } from "../lib/template/types";

/**
 * The two calls that are correct, so the refusals below are not failing for
 * some unrelated reason. (A file of nothing but expected errors passes when the
 * imports are broken.)
 */
renderPageSvg(MY_FOREVER, FIXTURE_FILL, { href: assetUrl });
void renderPrintSvg(MY_FOREVER, FIXTURE_FILL);
/** And the fold really is a usable value — the preview hands this to an element. */
const band: string = foldBand(SPREAD_FOLD);
void band;

// --- The print path has no argument a fold could arrive in -----------------

// `renderPrintSvg(template, fill, supplied?)`, and `supplied` is a
// `Map<string, Uint8Array>`. There is no options object, which is the same
// structural fact that makes `guides` and `ghost` unreachable from here.
// @ts-expect-error the print path takes no options object, so no fold
void renderPrintSvg(MY_FOREVER, FIXTURE_FILL, { fold: SPREAD_FOLD });

// --- The screen renderer has no such option either -------------------------

// This is the stronger half. `guides` and `ghost` exist on `RenderOptions`
// because they are things drawn *on a page*; the fold is not, so it is not an
// option anywhere and `renderPageSvg` cannot be asked for one.
// @ts-expect-error RenderOptions has exactly two options and neither is a fold
renderPageSvg(MY_FOREVER, FIXTURE_FILL, { href: assetUrl, fold: SPREAD_FOLD });

// Nor can it be smuggled in as the one option that is also preview-only: a
// `GhostOptions` wants `at`, `size` and `caption`, and a `SpreadFold` has none
// of them.
// @ts-expect-error a fold is not a ghost
renderPageSvg(MY_FOREVER, FIXTURE_FILL, { href: assetUrl, ghost: SPREAD_FOLD });

// --- Nor into the data the print path draws whatever it finds in -----------

// The hole worth closing: the print path draws every layer a template
// declares, so a fold that could *be* a layer would make "no gutter in a print
// file" a property of the data rather than of the code. `kind: "fold"` is not
// one of the three kinds in the `Layer` union.
// @ts-expect-error a fold is not a layer and cannot be put in a template
const layers: Layer[] = [...MY_FOREVER.layers, SPREAD_FOLD];
void layers;

// And it is not a picture: an `image` layer's asset is an `AssetRef`, which
// wants a `sha256` and a measured `px`. This is the same trick
// `lib/book/preview-art.ts` plays with `digest`.
const smuggled: Layer = {
  id: "fold",
  kind: "image",
  frame: { x: 0, y: 0, width: 10, height: 10 },
  // @ts-expect-error a fold is not an asset and cannot be drawn as one
  asset: SPREAD_FOLD,
};
void smuggled;
