/**
 * **The interior verses' face, and the two things a change of it can get
 * wrong.**
 *
 * The captain asked on 19 November whether the book's font can change too,
 * having just chosen a face for the cover. `templates/first-book.ts`
 * § `storySlot` records the arithmetic that set the verses where they are —
 * 15 pt chosen against a measured 480 pt line, a 500 pt box, 20 pt of headroom
 * on the worst line — and **every one of those numbers is Special Elite's.**
 *
 * What makes that dangerous rather than merely undocumented is that the build
 * cannot see it. `validateBook` counts characters, and a character count is
 * face-independent: the exact same book, set in a face half again as wide,
 * passes every check this repository has and prints with four lines of every
 * verse running off the paper. `test/book-verses.test.ts` is the one place the
 * proxy is checked against the thing it stands for, and it checks it in **one
 * face** — the committed one. This file is that check turned into a question
 * about the others.
 *
 * Two claims are asserted here and they are different in kind:
 *
 *  - **The committed face fits, measured**, with the headroom the template's
 *    own docblock claims — so the day somebody edits a verse or a type size,
 *    the number in that docblock is checked rather than trusted. The paired
 *    control is the same face at a larger size, which must be reported as not
 *    fitting, with the size it would need landing back at the declared one.
 *
 *  - **The captain's hand-marked positions cannot be moved by a change
 *    of face at all**, which is a structural fact and not a lucky one:
 *    `lib/render/svg.ts` § `drawTextSlot` sets every line at an absolute
 *    baseline, so `VERSE_TOP_ON` is declared data. The assertion is that the
 *    ink stays inside each page's own box in every vendored face, and the
 *    control is the same measurement at a size that must break out — without
 *    which "it fits" would be a sentence that passes against a renderer drawing
 *    nothing.
 *
 * Every number is measured out of the pixels. `lib/book/verse-fit.ts` renders
 * each page twice, once with its verse and once with the slot taken out, and
 * reads the ink's bounding box out of the difference — `test/pixels.ts`'s
 * method, and the control it asks for is built into the measurement: a page
 * that drew nothing returns `null`, which no containment assertion can pass.
 *
 * **Nothing here decides the captain's answer.** A candidate is held to drawing
 * at all and to standing where the slot says; it is deliberately *not* held to
 * the width, because a face wider than Special Elite is a face that needs a
 * smaller size, and that is a design decision for the captain rather than a
 * failing test. `npm run verse-faces` reports it beside the pictures and
 * `docs/verse-face.md` is the recommendation.
 */

import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { checkName, facesTheNameIsSetIn, nameLimit } from "../lib/book/name";
import { safeBox } from "../lib/template/defaults";
import { pageSequence } from "../lib/book/derive";
import { coverTitleSlot } from "../lib/book/title-fit";
import {
  longestVerse,
  verseBlanksFor,
  verseFitFor,
  verseInkOn,
  verseLines,
  versePages,
  verseSlotOn,
  versesIn,
} from "../lib/book/verse-fit";
import { FACES, isCandidate } from "../lib/render/fonts";

const LIMIT = nameLimit(FIRST_BOOK);
const LONGEST = "M".repeat(LIMIT);
const PAGES = versePages(FIRST_BOOK);

/** The slot every verse shares, read off the first verse page rather than named. */
const SLOT = verseSlotOn(pageSequence(FIRST_BOOK)[PAGES[0]]);

/** The face the verses are actually set in, read off the slot rather than named. */
const SET_IN = SLOT.font;

const FILL = { ...FIXTURE_BOOK_FILL, name: LONGEST };

/**
 * One point of slack, which is two pixels at `lib/book/verse-fit.ts`
 * § `VERSE_RENDER_WIDTH` and the antialiasing of the outermost stem.
 */
const SLACK = 1;

/** Long enough for eleven render pairs of a photographic page. */
const PATIENCE = 180_000;

describe("the verses fit their box in the face they are set in", () => {
  it("is set in a face the registry has, and not in one of the cover's candidates", () => {
    // The committed default, asserted as a fact about this book. The captain
    // picks whether it changes; until they have, the verses are on the decided
    // face — and `isCandidate` is what would notice a candidate being quietly
    // promoted by a sheet-rendering command.
    expect(Object.keys(FACES)).toContain(SET_IN);
    expect(isCandidate(SET_IN)).toBe(false);
  });

  it("accepts the name it is measured with, which is what makes it the worst case", () => {
    expect(checkName(FIRST_BOOK, LONGEST).ok).toBe(true);
    expect(LONGEST.length).toBe(LIMIT);
  });

  it(
    "holds the widest verse in the book, with the headroom the template claims",
    async () => {
      const fit = await verseFitFor(FIRST_BOOK, FILL, SET_IN, { name: LONGEST });

      // The control, built in: a page that drew no words differs nowhere, and
      // `ink` comes back `null` on it.
      expect(fit.drewNothing, `verses drew nothing in ${fit.family}`).toEqual([]);
      expect(fit.needsSize, `${fit.family} needs ${fit.needsSize} pt to fit`).toBeNull();
      expect(fit.spare, `${fit.family} overflows by ${-fit.spare} pt`).toBeGreaterThan(-SLACK);

      /**
       * **The 20 pt of headroom, checked rather than trusted.**
       *
       * `templates/first-book.ts` § `storySlot` states it in a table: the
       * widest line of the twelve verses measures 480 pt at 15 pt in Special
       * Elite, in a 500 pt box. That was measured once, by hand, and has been
       * a sentence in a docblock ever since. This is the same measurement made
       * by the suite, so a verse edited longer, a type size nudged or a face
       * switched moves it and says by how much.
       *
       * Bounded both ways on purpose. Too little headroom is a line at the
       * cut line; a *lot* more than claimed means the docblock's arithmetic no
       * longer describes the book, which is the same defect pointing the other
       * way. Ten points each side of the claim — two thirds of a type size,
       * wide enough for a rasteriser upgrade and narrow enough to notice an
       * edit.
       */
      const claimed = 20;
      const said =
        `the widest verse is ${fit.widest.id} at ` +
        `${fit.widest.ink?.width.toFixed(1)} pt in a ${fit.box.width} pt box at ${fit.size} pt, ` +
        `so the headroom is ${fit.spare.toFixed(1)} pt where the template claims ${claimed}`;
      expect(fit.spare, said).toBeGreaterThan(claimed - 10);
      expect(fit.spare, said).toBeLessThan(claimed + 10);
    },
    PATIENCE,
  );

  it(
    "stays inside the page's safe area on every verse page, where the guillotine is not",
    async () => {
      const fit = await verseFitFor(FIRST_BOOK, FILL, SET_IN, { name: LONGEST });
      const safe = safeBox(FIRST_BOOK.page.canvas);
      for (const page of fit.pages) {
        expect(page.ink, `${page.id} drew nothing`).not.toBeNull();
        if (!page.ink) continue;
        expect(page.ink.x, page.id).toBeGreaterThanOrEqual(safe.x - SLACK);
        expect(page.ink.x + page.ink.width, page.id).toBeLessThanOrEqual(safe.x + safe.width + SLACK);
        expect(page.ink.y, page.id).toBeGreaterThanOrEqual(safe.y - SLACK);
        expect(page.ink.y + page.ink.height, page.id).toBeLessThanOrEqual(
          safe.y + safe.height + SLACK,
        );
      }
    },
    PATIENCE,
  );

  it(
    "would overflow if the type were larger, which is what makes the fit a measurement",
    async () => {
      /**
       * The paired control, and the one place `needsSize` is checked against
       * an answer that is known in advance.
       *
       * A fit assertion that passed at every size would be checking nothing,
       * so the same face is measured half again as large and must be reported
       * as not fitting. What makes this more than a sign check is the second
       * assertion: the size it says the book needs must come back to the
       * **declared** size, because the declared size is — measured above — the
       * largest integer at which the widest verse fits. So the bisection is
       * being asked a question whose answer the suite already knows.
       *
       * It also exercises the two ways the arithmetic went wrong before it was
       * measured: at 22.5 pt every verse is set wider than the page, so the
       * ink is **clipped** and a proportion computed from it over-estimates;
       * and the page that measures widest among clipped pages is arbitrary, so
       * a bisection on that one page returned 17. `lib/book/verse-fit.ts`
       * § `needsSize` has both.
       */
      const fit = await verseFitFor(FIRST_BOOK, FILL, SET_IN, {
        name: LONGEST,
        size: SLOT.size * 1.5,
      });
      expect(fit.drewNothing).toEqual([]);
      expect(fit.spare).toBeLessThan(0);
      expect(fit.clipped, "nothing was clipped, so this is not the control it claims to be").toBe(
        true,
      );
      expect(fit.needsSize, `it says ${fit.needsSize} pt where the book is set at ${SLOT.size}`).toBe(
        SLOT.size,
      );
    },
    PATIENCE,
  );
});

/**
 * **The captain's hand-marked positions, and why no face can move one.**
 *
 * On 13 November the captain screenshotted the interior spreads and drew a
 * rectangle on each showing where that verse belongs;
 * `templates/first-book.ts` § `VERSE_TOP_ON` is those marks and
 * `test/book-verses.test.ts` § *"every verse sits where the captain marked it"*
 * states the numbers. Those are the captain's own work and a change of face
 * must not quietly redo it.
 *
 * It cannot, and the reason is worth asserting rather than believing:
 * `lib/render/svg.ts` § `drawTextSlot` sets line *i* at
 * `frame.y + baseline + lineHeight * i`, absolutely. Not one of those three
 * numbers is a font metric, so the block's position is declared data. What a
 * face does change is how far the ink reaches **above the first baseline and
 * below the last** — its ascent and descent — and the 160 pt box has roughly
 * fifteen points of slack for both together.
 *
 * So the measurement is: in every vendored face, does the ink stay inside each
 * page's own box? And the control is the same measurement at a size where it
 * must not.
 */
describe("a change of face moves none of the captain's marks", () => {
  it("changes only the font field, so every frame is still the captain's number", () => {
    // Cheap, and the thing that would notice `versesIn` growing a second
    // responsibility: the marks are `frame.y` and they are compared face to
    // face rather than to a list of numbers, which `test/book-verses.test.ts`
    // already holds.
    const before = PAGES.map((i) => verseSlotOn(pageSequence(FIRST_BOOK)[i]));
    for (const key of Object.keys(FACES)) {
      const after = PAGES.map((i) => verseSlotOn(pageSequence(versesIn(FIRST_BOOK, key))[i]));
      for (const [at, slot] of after.entries()) {
        expect(slot.font, `${key} on page ${at}`).toBe(key);
        expect({ ...slot, font: "" }, `${key} changed more than the face`).toEqual({
          ...before[at],
          font: "",
        });
      }
    }
  });

  it(
    "keeps the ink inside every page's own box, in every vendored face",
    async () => {
      // One blank render per page, shared by every face — the slot is gone
      // from the blank half, so it does not depend on the face at all.
      const blanks = await verseBlanksFor(FIRST_BOOK, FILL);
      for (const key of Object.keys(FACES)) {
        const fit = await verseFitFor(FIRST_BOOK, FILL, key, { name: LONGEST, blanks });
        expect(fit.drewNothing, `${fit.family} drew no type on these pages`).toEqual([]);
        const said =
          `${fit.family} reaches ${fit.above.toFixed(1)} pt above its box and ` +
          `${fit.below.toFixed(1)} pt below, where the allowance is ` +
          `${fit.tolerance.toFixed(1)} pt`;
        expect(fit.tallOn, said).toEqual([]);
        expect(fit.marksHold, said).toBe(true);
      }
    },
    PATIENCE * 4,
  );

  it(
    "would report a mark that had to move, which is what makes the claim an assertion",
    async () => {
      // The control for the case above. At four times the type size the block
      // is far taller than the 160 pt box the marks were drawn around, so
      // `marksHold` must be false and `tallOn` must name pages. Without this
      // the assertion above would pass against a book whose verses drew
      // nothing, and against a tolerance wide enough to swallow anything.
      const fit = await verseFitFor(FIRST_BOOK, FILL, SET_IN, {
        name: LONGEST,
        size: SLOT.size * 4,
      });
      expect(fit.marksHold).toBe(false);
      expect(fit.tallOn.length).toBeGreaterThan(0);
      // **Upward**, and measured rather than guessed: the line height is
      // declared and does not scale with the type, so quadrupling the size
      // overlaps the lines rather than lengthening the block. What leaves the
      // box is the first line's ascent above a baseline that has not moved —
      // 22.6 pt above a 19 pt allowance, where the descent below the last
      // baseline is still only 4.3. Asserted on the worse of the two so the
      // control does not depend on which way a future line height tips it.
      expect(Math.max(fit.above, fit.below)).toBeGreaterThan(fit.tolerance);
      expect(fit.tallOn.length, "only some pages broke out of a box they all share").toBe(
        PAGES.length,
      );
    },
    PATIENCE,
  );
});

describe("every vendored face really can set the verses", () => {
  /**
   * **The deployment bug, measured once per face.**
   *
   * `lib/render/raster.ts` runs with `loadSystemFonts: false` and matches by
   * the family **inside** the file, so a family the rasteriser cannot find
   * draws no type and throws nothing. `test/fonts.test.ts` compares the
   * registry's string with the file's; this is the half that proves the match
   * works end to end for a six-line block of body copy rather than for three
   * words on a cover.
   *
   * One render pair per face, on the page the fit is decided on, and **nothing
   * is asserted about the width** — a face wider than Special Elite needs a
   * smaller size, which is the captain's decision and `npm run verse-faces`'s
   * report. Turning it into a failure here would be this file choosing.
   */
  const decided = PAGES[PAGES.findIndex((i) => pageSequence(FIRST_BOOK)[i].id === "page-009")] ?? PAGES[0];

  for (const key of Object.keys(FACES)) {
    it(
      `${key} draws a full verse, standing where the slot says`,
      async () => {
        const page = pageSequence(FIRST_BOOK)[decided];
        const slot = verseSlotOn(page);
        const ink = await verseInkOn(versesIn(FIRST_BOOK, key), FILL, decided);
        expect(
          ink,
          `${FACES[key].family} drew no type — the rasteriser has no such family`,
        ).not.toBeNull();
        if (!ink) return;

        const grow = slot.size * 0.3 + SLACK;
        expect(ink.y, `${key} sets above its box`).toBeGreaterThan(slot.frame.y - grow);
        expect(ink.y + ink.height, `${key} sets below its box`).toBeLessThan(
          slot.frame.y + slot.frame.height + grow,
        );

        // And it really is a full verse rather than one surviving line, so the
        // containment is not satisfied by a render that lost most of it.
        const drawn = (page.story ?? "").split("\n").filter((l) => l !== "").length;
        expect(ink.height, `${key} drew less than ${drawn} lines`).toBeGreaterThan(
          (drawn - 1) * (slot.lineHeight ?? slot.size),
        );
      },
      PATIENCE,
    );
  }
});

/**
 * **The interior and the cover are two decisions, and `versesIn` is where they
 * could have become one.**
 *
 * The cover's title is a `storyText` slot too — `templates/first-book.ts`
 * § `cover`, because a title is authored words with `{name}` in them — so
 * `pagesWithSlot(book, SLOT.story)` returns the cover first and a helper that
 * re-faced "every story slot" would re-face the cover as well. The captain
 * chose the cover's face on 19 November from its own sheet and is choosing the
 * verses' from this one — separate sheets, separate measurements
 * (`docs/cover-face.md` and `docs/verse-face.md`) — and a command that silently
 * moved both would make one sheet a lie about the other. The face this reads
 * comes off the cover's own slot and is never named here: naming it cost a line
 * the day it moved.
 */
describe("re-facing the verses leaves the cover exactly as it is", () => {
  it("never touches the cover's title, in any face", () => {
    const before = coverTitleSlot(FIRST_BOOK);
    for (const key of Object.keys(FACES)) {
      const after = versesIn(FIRST_BOOK, key);
      expect(after.cover, `${key} changed the cover`).toEqual(FIRST_BOOK.cover);
      expect(coverTitleSlot(after).font, `${key} re-faced the cover's title`).toBe(before.font);
    }
  });

  it("does not count the cover as a verse page", () => {
    // The cover is index 0 — `lib/book/derive.ts` § `pageSequence` — and the
    // count is read off the book's own pages rather than stated, because how
    // many spreads there are has already moved once.
    expect(PAGES).not.toContain(0);
    expect(PAGES.length).toBe(FIRST_BOOK.pages.filter((p) => p.story).length);
  });
});

/**
 * **The two facts about a change of verse face that no picture of a page can
 * show**, both read off the book rather than restated.
 */
describe("what a change of verse face would also change", () => {
  it("is one of the faces every buyer's name is checked against", () => {
    // `lib/book/name.ts` § `facesTheNameIsSetIn` adds the face of any slot
    // whose authored copy carries `{name}`, and most verses do — so the verse
    // face decides which names the shop accepts, exactly as the cover's does.
    // Asserted as a fact about this book, so that the day the verses move to a
    // face with a narrower `cmap`, `checkName` is known to be part of the cost.
    expect(facesTheNameIsSetIn(FIRST_BOOK)).toContain(SET_IN);
    const other = Object.keys(FACES).find((k) => k !== SET_IN)!;
    expect(facesTheNameIsSetIn(versesIn(FIRST_BOOK, other))).toContain(other);
    expect(facesTheNameIsSetIn(versesIn(FIRST_BOOK, other))).not.toContain(SET_IN);
  });

  it("is a six-line block in a box sized for exactly six", () => {
    // The vertical budget a face has no say in, stated so the reason the
    // captain's marks survive is legible rather than lucky.
    // `templates/first-book.ts` § `VERSE_HEIGHT`: six lines at 26 pt is
    // 156 pt, which is what the 160 pt box holds — so the box is sized for
    // exactly this verse and a seventh line would not fit it. The four points
    // left over, plus the baseline's own offset, are where an ascent and a
    // descent live, and they are what every face in the table clears.
    const verse = verseLines(FIRST_BOOK);
    const lh = SLOT.lineHeight ?? SLOT.size;
    expect(verse.lines).toBe(verse.allowed);
    expect(verse.lines * lh, "six lines do not fit the box").toBeLessThanOrEqual(SLOT.frame.height);
    expect((verse.lines + 1) * lh, "the box would hold a seventh line").toBeGreaterThan(
      SLOT.frame.height,
    );
  });

  it("is measured at the longest verse the book has, counted off the copy", () => {
    const longest = longestVerse(FIRST_BOOK, LONGEST);
    expect(longest.chars).toBeLessThanOrEqual(SLOT.maxChars);
    expect(longest.chars).toBeGreaterThan(0);
  });
});
