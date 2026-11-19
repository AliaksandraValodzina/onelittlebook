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
 * the page. Since 19 November there is no cream panel under the title at all —
 * `templates/first-book.ts` § `TITLE_CORNER` — so the only thing between a
 * too-wide face and the cut line is the measurement below.
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
import { maxCharsPerLineOf, safeBox } from "../lib/template/defaults";
import {
  coverTitleIn,
  coverTitleSlot,
  atRenderWidth,
  titleFitFor,
  titleInkFor,
} from "../lib/book/title-fit";
import { FACES, isCandidate } from "../lib/render/fonts";
import { pageFillFor, pageTemplateFor } from "../lib/book/derive";
import { renderPrintPixels } from "../lib/render/raster";
import type { BookTemplate } from "../lib/book/types";
import type { Layer } from "../lib/template/types";

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
     * **The headroom, stated — and the corner has spent it.**
     *
     * `test/book-text.test.ts` measures the headroom the *build* enforces and
     * finds two: fourteen characters in a box declared to hold sixteen. This
     * is the same headroom measured as a width, and the width runs out first.
     * It used to run out one character later than fourteen; in
     * `templates/first-book.ts` § `TITLE_CORNER`'s narrower box it runs out at
     * exactly fourteen, so the count is now the only margin there is. Both
     * numbers are true and they answer different questions — the count is what
     * refuses a book, the width is what the press prints.
     *
     * Read off the measurement rather than typed, so a change of face or of
     * size moves it and the failure message says by how much.
     */
    expect(fit.charactersSpare).toBeGreaterThanOrEqual(0);
    expect(fit.charactersSpare).toBeLessThan(ACROSS - LIMIT);
    expect(fit.countBindsFirst).toBe(false);
  });

  /**
   * **The bound the cream panel used to be.**
   *
   * While the title sat on an opaque panel, a name wider than its box was
   * still on cream and the failure was ugly rather than unprintable. Since
   * `templates/first-book.ts` § `TITLE_CORNER` there is no panel and the box
   * stops a point short of the page's safe area on its right, so the thing
   * that goes wrong is different in kind: the name runs at the cut line
   * instead of looking wrong on cream. Asserted on
   * the **ink**, which is where it would happen, and not on the frame, which
   * `lib/template/validate.ts` already holds inside the safe area.
   */
  it("keeps the longest name inside the page's safe area, where the panel used to stand", async () => {
    const fit = await titleFitFor(FIRST_BOOK, FIXTURE_BOOK_FILL, SET_IN, { renderWidth: WIDTH });
    expect(fit.ink).not.toBeNull();
    expect(fit.bound).toEqual(safeBox(FIRST_BOOK.page.canvas));
    expect(fit.boundSpare, `the title reaches ${-fit.boundSpare} pt outside the safe area`).toBeGreaterThan(
      -SLACK,
    );

    // The paired control: the same measurement at double the size must report
    // the overflow, so a passing assertion above is not one that passes at any
    // size at all.
    const big = await titleFitFor(FIRST_BOOK, FIXTURE_BOOK_FILL, SET_IN, {
      size: SLOT.size * 2,
      renderWidth: WIDTH,
    });
    expect(big.boundSpare).toBeLessThan(0);
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
       * Vertically inside the box the captain drew, which is the constraint a
       * heavier face threatens that a character count cannot see at all. It
       * used to be read off the cream panel the title was set on; the panel
       * went with the move to the corner — `templates/first-book.ts`
       * § `TITLE_CORNER` — so the box is the slot's own frame now, and the
       * outer bound the page's safe area rather than a shape layer.
       */
      if (!ink) return;
      expect(ink.y, `${key} sets above its box`).toBeGreaterThan(SLOT.frame.y - SLACK);
      expect(ink.y + ink.height, `${key} sets below its box`).toBeLessThan(
        SLOT.frame.y + SLOT.frame.height + SLACK,
      );

      /**
       * **Nothing is asserted about the width here, and that is deliberate.**
       * A candidate wider than Indie Flower runs the name past the box and,
       * for the widest of them, past the safe area — which is exactly what
       * `npm run cover-faces` is for reporting. Turning that into a failure
       * here would be this file deciding the captain's choice for them. The
       * committed face is held to the width above; a candidate is only held
       * to drawing at all, and to standing where the slot says.
       */
    });
  }
});

/**
 * **The panel is gone, asserted in pixels and not in the layer list.**
 *
 * The captain asked for the cream panel removed on 19 November and
 * `templates/first-book.ts` § `TITLE_CORNER` removed it. A test that read
 * `cover.layers` for the absence of a shape would be the template restating
 * itself; what actually matters is that **the only thing the cover's layers
 * put under the title is the artwork**, which is a fact about the printed
 * page. So the cover is rendered three ways and the pixels are compared.
 *
 * The control `test/pixels.ts` asks for is the third render: the old panel
 * re-inserted must make the same comparison fail, or the assertion would pass
 * against a renderer that drew no layers at all.
 */
describe("the title is set on the artwork, with nothing drawn under it", () => {
  const WIDE = 600;

  /** The cover's own ground, with no layers on it at all. */
  function coverWith(layers: BookTemplate["cover"]["layers"]): BookTemplate {
    return { ...FIRST_BOOK, cover: { ...FIRST_BOOK.cover, layers } };
  }

  /** The cover as committed, with only the title taken off. */
  const WITHOUT_TITLE = (FIRST_BOOK.cover.layers ?? []).filter((l) => l.id !== SLOT.id);

  /**
   * The panel exactly as it was until 19 November: a rounded cream rectangle
   * with a white keyline and a drop shadow, moved to sit under the title's new
   * frame so the comparison is about the panel and not about where it was.
   */
  const OLD_PANEL: Layer = {
    id: "cover-panel",
    kind: "shape",
    frame: {
      x: SLOT.frame.x - 20,
      y: SLOT.frame.y - 14,
      width: SLOT.frame.width + 40,
      height: SLOT.frame.height + 28,
    },
    shape: {
      kind: "rect",
      radius: 20,
      fill: "#FBF6EC",
      stroke: { colour: "#FFFFFF", width: 4 },
      shadow: { colour: "#2A1C12", blur: 10, dx: 0, dy: 6 },
    },
  };

  const pixelsOf = async (book: BookTemplate) => {
    const sized = atRenderWidth(book, WIDE);
    const chosen = { lookId: FIXTURE_BOOK_FILL.lookId };
    const { rgba } = await renderPrintPixels(
      pageTemplateFor(sized, 0, chosen),
      pageFillFor(sized, 0, FIXTURE_BOOK_FILL),
    );
    return rgba;
  };

  const same = (a: Uint8Array, b: Uint8Array) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  it("draws nothing at all under the title, and would notice a panel that came back", async () => {
    const [bare, committed, panelled] = await Promise.all([
      pixelsOf(coverWith([])),
      pixelsOf(coverWith(WITHOUT_TITLE)),
      pixelsOf(coverWith([OLD_PANEL, ...WITHOUT_TITLE])),
    ]);

    expect(
      same(bare, committed),
      "the cover draws something besides the title — if that is deliberate, this test is the place to say so",
    ).toBe(true);

    // The control. Without it the assertion above would pass against a cover
    // whose layers drew nothing whatever, including the title.
    expect(same(bare, panelled), "the panel drew nothing, so the comparison proves nothing").toBe(
      false,
    );
  });
});

/**
 * **The title is in the corner, measured against the page and not against the
 * numbers that put it there.**
 *
 * `templates/first-book.ts` § `TITLE_CORNER` derives its frame from a
 * rectangle the captain drew, which is not in this repository — so asserting
 * the frame against those same numbers would prove nothing. What *can* be
 * asserted without circularity is the two properties that make a corner a
 * corner, both read off `page.canvas`: the type is entirely in the top half of
 * the page, and its centre is right of the page's centre. The title the move
 * replaced — three lines centred in the middle of the cover — fails both, and
 * that is the control below.
 */
describe("the title stands in the upper right of the cover", () => {
  const MIDDLE_X = FIRST_BOOK.page.canvas.width / 2;
  const MIDDLE_Y = FIRST_BOOK.page.canvas.height / 2;

  it("sets in the top half, right of centre, at the longest name there is", async () => {
    const ink = await titleInkFor(atRenderWidth(FIRST_BOOK, WIDTH), FIXTURE_BOOK_FILL, LONGEST);
    expect(ink, "the title drew nothing").not.toBeNull();
    if (!ink) return;

    expect(ink.y + ink.height, "the title reaches below the middle of the cover").toBeLessThan(
      MIDDLE_Y,
    );
    expect(ink.x + ink.width / 2, "the title is not right of the cover's centre").toBeGreaterThan(
      MIDDLE_X,
    );
  });

  it("would fail for the centred title it replaced, which is what makes it an assertion", async () => {
    // The pre-19-November frame: 402 pt across, starting at y 226, centred on
    // the page. Written out here because it is a counterexample and not a
    // declaration — nothing reads it but this control.
    const centred: BookTemplate = {
      ...FIRST_BOOK,
      cover: {
        ...FIRST_BOOK.cover,
        layers: (FIRST_BOOK.cover.layers ?? []).map((l) =>
          l.id === SLOT.id
            ? { ...l, frame: { x: 105, y: 226, width: 402, height: 160 }, size: 44, baseline: 48, lineHeight: 52 }
            : l,
        ),
      },
    };
    const ink = await titleInkFor(atRenderWidth(centred, WIDTH), FIXTURE_BOOK_FILL, LONGEST);
    expect(ink).not.toBeNull();
    if (!ink) return;
    expect(ink.y + ink.height).toBeGreaterThan(MIDDLE_Y);
    expect(Math.abs(ink.x + ink.width / 2 - MIDDLE_X)).toBeLessThan(1);
  });
});
