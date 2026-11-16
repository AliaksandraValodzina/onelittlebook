/**
 * **A title cannot be placed on a wrap nobody has measured, asserted by the
 * compiler.**
 *
 * The captain has delivered hardcover wraps and they are all 5370 × 2850, so
 * the *size* is known. Where the front panel starts inside one is not: it is
 * arithmetic on two assumptions about a template nobody has opened
 * (`lib/print/printify.ts` § `HARDCOVER_COVER_WRAP_DERIVED`). A title drawn
 * against that arithmetic would be a plausible wrong file — correct on a screen
 * and 120 px off a hinge — which is the failure
 * `lib/book/cover-wrap.ts` § `COVER_PRODUCTS` exists to make impossible.
 *
 * `test/no-derivative-in-a-print-file.ts` carries the reasoning for the device
 * itself: **this file is not a test and runs nothing.** Every statement in it is
 * a call that *must not compile*, marked `@ts-expect-error`, and `tsc` reports
 * an unused `@ts-expect-error` as an error — so the day one of these becomes
 * legal, `npm run lint` goes red with nothing for anybody to remember. It is
 * `.ts` and not `.test.ts` because `vitest.config.mts` collects
 * `test/**\/*.test.{ts,tsx}` and ignores this, while `tsconfig.json` includes
 * it.
 *
 * The device is the same one `lib/book/preview-art.ts` plays with
 * `PreviewAsset` against `AssetRef`: a `DerivedWrap` has **no `file`, no
 * `finished` and no `safety`**, so it is structurally unassignable to a
 * `MeasuredTemplate` and every function that could turn a template into a
 * position refuses it. The thing that *is* known — the supplied area — is
 * reachable through `suppliedAreaOf`, which is how intake checks a file's size
 * without anything being able to place a title.
 *
 * `test/cover-source.test.ts` is the other half and reads the pixels.
 */

import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import {
  COVER_PRODUCTS,
  measuredProduct,
  suppliedAreaOf,
  suppliedCoverWrapTemplate,
  suppliedWrapGeometry,
  wrapGeometry,
} from "../lib/book/cover-wrap";
import {
  HARDCOVER_COVER_WRAP_DERIVED,
  SOFTCOVER_COVER_WRAP,
  bleedPxOf,
  frontPanelPxOf,
  panelPxOf,
  spinePxOf,
} from "../lib/print/printify";

/**
 * The calls that are correct, so the refusals below are not failing for some
 * unrelated reason. (A file of nothing but expected errors passes when the
 * imports are broken.)
 */
const measured = measuredProduct("softcover").template;
wrapGeometry(SOFTCOVER_COVER_WRAP);
suppliedWrapGeometry(FIRST_BOOK, measured);
frontPanelPxOf(measured);
panelPxOf(measured);
spinePxOf(measured);
bleedPxOf(measured);
suppliedCoverWrapTemplate(FIRST_BOOK, FIXTURE_BOOK_FILL, "softcover", {
  sha256: "0".repeat(64),
  mime: "image/png",
  px: [SOFTCOVER_COVER_WRAP.area.width, SOFTCOVER_COVER_WRAP.area.height],
});

/** And the one question an unmeasured product *can* answer: how big the file is. */
const area = suppliedAreaOf("hardcover");
void area.width;
void HARDCOVER_COVER_WRAP_DERIVED.area.height;
void HARDCOVER_COVER_WRAP_DERIVED.inferred.spine;

// ---------------------------------------------------------------------------
// A derived wrap is not a template, so no geometry can be taken from it
// ---------------------------------------------------------------------------

// @ts-expect-error a DerivedWrap has no `finished` and no `safety`: there is
// nothing in it to derive a panel, a spine or a bleed from.
wrapGeometry(HARDCOVER_COVER_WRAP_DERIVED);

// @ts-expect-error the cut the display cover is taken from cannot be computed
// for a product whose panel origin is a guess.
frontPanelPxOf(HARDCOVER_COVER_WRAP_DERIVED);

// @ts-expect-error the unit the title's layers are translated in is derived
// from the front panel's width, which this does not have.
suppliedWrapGeometry(FIRST_BOOK, HARDCOVER_COVER_WRAP_DERIVED);

// @ts-expect-error the spine is the finished width less both panels, and
// neither number is in a derived wrap.
spinePxOf(HARDCOVER_COVER_WRAP_DERIVED);

// @ts-expect-error same for the bleed, which is the area less the finished size.
bleedPxOf(HARDCOVER_COVER_WRAP_DERIVED);

// @ts-expect-error and for the panel.
panelPxOf(HARDCOVER_COVER_WRAP_DERIVED);

// ---------------------------------------------------------------------------
// The product's template is on the measured arm only
// ---------------------------------------------------------------------------

// @ts-expect-error `COVER_PRODUCTS.hardcover` is the unmeasured arm of the
// union, which has no `template` at all — there is nowhere to put an estimate.
void COVER_PRODUCTS.hardcover.template;

// @ts-expect-error the derived size is on the unmeasured arm, so reading it off
// a product without narrowing is refused too: a caller that has not asked which
// arm it is holding cannot reach either number.
void COVER_PRODUCTS.softcover.derived;
