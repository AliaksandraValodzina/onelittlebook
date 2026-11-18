/**
 * **The cover's title, and the one thing a change of face can get wrong: a
 * name that no longer fits.**
 *
 * The cover is the only place the buyer's name reaches the front of the book —
 * inside the captain's own words, *"When {name} Turned One"* — and
 * `templates/first-book.ts` § `cover` sizes it from a **character count** of
 * sixteen, because `lib/render/svg.ts` is not allowed to measure. A count is a
 * proxy for a width, and a proxy only means something while somebody has
 * checked it against the thing it stands for **in the face the type is set
 * in**. `test/book-text.test.ts` checks the count; this file checks the width.
 *
 * It matters now rather than in the abstract because the face is an open
 * question: `lib/render/fonts.ts` vendors nine candidates for the cover title
 * and a heavy rounded display face is far wider than a handwritten one at the
 * same size. Sixteen characters of one face is eleven of another, and the way
 * that arrives is a printed cover with a child's name running off both sides of
 * the panel.
 *
 * Every number here is **measured out of the pixels** —
 * `lib/book/title-fit.ts` renders the cover twice, once with the title and once
 * with the slot taken out, and reads the ink's bounding box out of the
 * difference. The controls are the ones `test/pixels.ts` asks for and they are
 * built into the measurement: a title that drew nothing returns `null`, which
 * no containment assertion can pass, and the overflow case below is asserted
 * against a size that must fail.
 */

import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { nameLimit } from "../lib/book/name";
import { checkName } from "../lib/book/name";
import { maxCharsPerLineOf } from "../lib/template/defaults";
import {
  coverTitleIn,
  coverTitleSlot,
  atRenderWidth,
  titleFitFor,
  titleInkFor,
} from "../lib/book/title-fit";
import { FACES, isCandidate } from "../lib/render/fonts";

const SLOT = coverTitleSlot(FIRST_BOOK);
const LIMIT = nameLimit(FIRST_BOOK);
const LONGEST = "M".repeat(LIMIT);
const ACROSS = maxCharsPerLineOf(SLOT);

/** The face the cover is actually set in, read off the slot rather than named. */
const SET_IN = SLOT.font;

/**
 * A render width this file can afford one pair of per face.
 *
 * The question is where ink lands, which the page answers at any size, and the
 * answer comes back in page units either way. 1200 across a 612-point canvas is
 * just under two pixels to the point, so a point of overflow is two pixels and
 * the assertions carry a slack of one point.
 */
const WIDTH = 1200;
const SLACK = 1;

describe("the cover's title fits its own box, in the face it is set in", () => {
  it("is set in a face the registry has, and not in one of the candidates", () => {
    // The committed default, asserted as a fact about this book. The captain
    // picks the new one; until they have, the cover is on the decided face.
    expect(Object.keys(FACES)).toContain(SET_IN);
    expect(isCandidate(SET_IN)).toBe(false);
  });

  it("accepts the name it is measured with, which is what makes it the worst case", () => {
    expect(checkName(FIRST_BOOK, LONGEST).ok).toBe(true);
    expect(LONGEST.length).toBe(LIMIT);
  });

  it("holds the longest name the form takes, measured and not asserted", async () => {
    const fit = await titleFitFor(FIRST_BOOK, FIXTURE_BOOK_FILL, SET_IN, { renderWidth: WIDTH });

    // The control, built in: a cover that drew no title at all differs
    // nowhere, and `ink` comes back `null`.
    expect(fit.ink, `the title drew nothing in ${fit.family}`).not.toBeNull();
    expect(fit.needsSize, `${fit.family} needs ${fit.needsSize} pt to fit`).toBeNull();
    expect(fit.spare, `${fit.family} overflows by ${-fit.spare} pt`).toBeGreaterThan(-SLACK);

    /**
     * **The headroom, stated — and it is one character and not two.**
     *
     * `test/book-text.test.ts` measures the headroom the *build* enforces and
     * finds two: fourteen characters in a box declared to hold sixteen. This
     * is the same headroom measured as a width, and the width runs out first.
     * Both numbers are true and they answer different questions — the count is
     * what refuses a book, the width is what the press prints — and the
     * smaller of the two is the real margin on the captain's cover.
     *
     * Read off the measurement rather than typed, so a change of face or of
     * size moves it and the failure message says by how much.
     */
    expect(fit.charactersSpare).toBeGreaterThanOrEqual(0);
    expect(fit.charactersSpare).toBeLessThan(ACROSS - LIMIT);
    expect(fit.countBindsFirst).toBe(false);
  });

  it("would overflow if the type were larger, which is what makes the fit a measurement", async () => {
    // The paired control for the assertion above. A check that passed at every
    // size would be checking nothing, so the same face is measured at double
    // the declared size and must be reported as not fitting — with the size it
    // would need, which must land back near the declared one.
    const fit = await titleFitFor(FIRST_BOOK, FIXTURE_BOOK_FILL, SET_IN, {
      size: SLOT.size * 2,
      renderWidth: WIDTH,
    });
    expect(fit.ink).not.toBeNull();
    expect(fit.spare).toBeLessThan(0);
    expect(fit.needsSize).not.toBeNull();
    expect(fit.needsSize!).toBeGreaterThanOrEqual(SLOT.size);
    expect(fit.needsSize!).toBeLessThan(SLOT.size * 2);
  });
});

describe("every vendored candidate really can be set by the rasteriser", () => {
  /**
   * **The deployment bug, measured once per face.**
   *
   * `lib/render/raster.ts` runs with `loadSystemFonts: false` and matches by
   * the family **inside** the file. A family the rasteriser cannot find draws
   * no type and throws nothing — so the only way to know that a candidate the
   * captain might choose would actually print is to print it and look at the
   * pixels. `test/fonts.test.ts` compares the registry's string with the
   * file's; this is the half that proves the match works end to end.
   *
   * One render pair per face, at the longest name, and nothing is asserted
   * about the fit here — that is the comparison's job and
   * `npm run cover-faces` prints it beside the pictures.
   */
  for (const key of Object.keys(FACES).filter(isCandidate)) {
    it(`${key} draws the title, and inside the panel it is printed on`, async () => {
      const book = atRenderWidth(coverTitleIn(FIRST_BOOK, key), WIDTH);
      const ink = await titleInkFor(book, FIXTURE_BOOK_FILL, LONGEST);
      expect(ink, `${FACES[key].family} drew no type — the rasteriser has no such family`).not.toBeNull();

      /**
       * Vertically inside the cream panel the title is set on, which is the
       * constraint a heavier face threatens that a character count cannot see
       * at all. Read off the shape layer rather than typed, so re-drawing the
       * panel moves this with it.
       */
      const panel = (FIRST_BOOK.cover.layers ?? []).find((l) => l.kind === "shape");
      expect(panel, "the cover has no panel to measure against").toBeTruthy();
      if (!panel || !ink) return;
      expect(ink.y, `${key} sets above the panel`).toBeGreaterThan(panel.frame.y - SLACK);
      expect(ink.y + ink.height, `${key} sets below the panel`).toBeLessThan(
        panel.frame.y + panel.frame.height + SLACK,
      );
    });
  }
});
