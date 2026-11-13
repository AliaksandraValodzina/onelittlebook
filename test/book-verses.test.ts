/**
 * **The captain's copy, and the one thing that can go wrong with it: a line
 * that does not fit.**
 *
 * The verses are data (`templates/first-book.ts` § `STORY`) and the name is a
 * buyer's, so every line of every verse is really a *family* of lines — one per
 * name anybody can type. The family's worst member is the line with the longest
 * name the form accepts in it, and that is the one nobody ever looks at: the
 * preview a buyer approves has *their* name in it, and a book that overflows
 * for fourteen characters looks perfect for eight.
 *
 * `validateBook` already refuses copy that overflows the slot's **character**
 * limits, and this file is the half that character counts cannot do. A count is
 * a proxy for a width — `lib/render/svg.ts` opens with why the renderer is not
 * allowed to measure — so the proxy has to be checked against the thing it
 * stands for at least once, by somebody, in the real face. That is what this
 * file is: the copy, rasterised, with the ink's own bounding box read back out
 * of the pixels.
 *
 * **It is measured as a difference, not as a colour.** Each page is rendered
 * twice, once with its words and once with the slot taken out, and
 * `changedBox` is where the two differ. Every differing pixel is the text's,
 * exactly, which is what makes "nothing escaped the box" an assertion rather
 * than a tolerance argument with a dark-haired baby.
 *
 * The control is built in: a render that drew no words differs nowhere, and
 * `changedBox` returns `null`, which no containment assertion can pass.
 */

import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { pageFillFor, pageSequence, pageTemplateFor, pagesWithSlot } from "../lib/book/derive";
import { NAME_TOKEN, SLOT } from "../lib/book/slots";
import { checkName, nameLimit } from "../lib/book/name";
import { dedicationSlot, defaultDedication } from "../lib/book/order";
import { validateBook } from "../lib/book/validate";
import { maxCharsPerLineOf, maxLinesOf, safeBox } from "../lib/template/defaults";
import { renderPrintPng } from "../lib/render/raster";
import { changedBox, raster } from "./pixels";
import type { BookPage, BookTemplate } from "../lib/book/types";
import type { Box, TextSlotLayer } from "../lib/template/types";

const CHOSEN = { lookId: FIXTURE_BOOK_FILL.lookId, coverId: FIXTURE_BOOK_FILL.coverId };

/**
 * The longest name the form will accept, as the worst case.
 *
 * `"M".repeat(limit)` is `validateBook`'s own worst case and this file uses the
 * same one on purpose: a test that measured a *different* worst case from the
 * validator would be answering a question the build never asks. The limit is
 * read off the book, so raising it is one edit and this test re-measures.
 *
 * The form really would accept it, which is what makes it the worst case and
 * not a straw man — `checkName` says so below.
 */
const LONGEST = "M".repeat(nameLimit(FIRST_BOOK));

/** A buyer whose child has the longest printable name there is. */
const WORST_FILL = { ...FIRST_BOOK, ...FIXTURE_BOOK_FILL, name: LONGEST } as typeof FIXTURE_BOOK_FILL;

/**
 * The same book at a size this file can afford twenty-four renders of.
 *
 * Two renders per page of words. At the declared 3600 that is most of a minute
 * of CPU to answer a question about where ink lands, which the page answers
 * just as well at a sixth of the width — 1.96 pixels per point, so a point of
 * overflow is two pixels and the assertions below carry a slack of one.
 */
const AFFORDABLE: BookTemplate = {
  ...FIRST_BOOK,
  page: {
    ...FIRST_BOOK.page,
    print: { ...FIRST_BOOK.page.print, pixels: { width: 1200, height: 1200 } },
  },
};

/** Every page of the book that carries words of the captain's — title included. */
const WORDED = pagesWithSlot(FIRST_BOOK, SLOT.story);

function storySlotOn(page: BookPage): TextSlotLayer {
  const layer = (page.layers ?? []).find(
    (l): l is TextSlotLayer => l.kind === "textSlot" && l.slot === SLOT.story,
  );
  if (!layer) throw new Error(`${page.id} carries no ${SLOT.story} slot`);
  return layer;
}

/** The book with one page's words taken away — the other half of the difference. */
function withoutWords(book: BookTemplate, index: number): BookTemplate {
  const id = pageSequence(book)[index].id;
  const strip = <T extends BookPage>(page: T): T =>
    page.id === id
      ? {
          ...page,
          layers: (page.layers ?? []).filter(
            (l) => !("slot" in l) || l.slot !== SLOT.story,
          ),
        }
      : page;
  return { ...book, cover: strip(book.cover), pages: book.pages.map(strip) };
}

async function rasterOf(book: BookTemplate, index: number) {
  const template = pageTemplateFor(book, index, CHOSEN);
  const { png } = await renderPrintPng(template, pageFillFor(book, index, WORST_FILL));
  return raster(png, template);
}

/**
 * Where the ink of one page's words actually landed, in page units.
 *
 * `null` would mean the words drew nothing, and every caller treats that as a
 * failure rather than as a pass — which is the pairing `test/pixels.ts` asks
 * for, built into the measurement instead of written beside it.
 */
async function inkOf(index: number): Promise<Box | null> {
  const [printed, blank] = await Promise.all([
    rasterOf(AFFORDABLE, index),
    rasterOf(withoutWords(AFFORDABLE, index), index),
  ]);
  return changedBox(printed, blank);
}

// ---------------------------------------------------------------------------

describe("the captain's copy is in the book, as the captain wrote it", () => {
  it("gives every spread that carries words a verse, and the cover a title", () => {
    // Counted off the book rather than stated: the number of spreads is
    // `spreads()`'s business and this file must not become a second place that
    // says twelve.
    const verses = FIRST_BOOK.pages.filter((p) => p.story);
    expect(verses.length).toBeGreaterThan(0);
    expect(FIRST_BOOK.cover.story).toBe("When\n{name}\nTurned One");
    // Every page with words has somewhere to put them and vice versa, which is
    // `validateBook`'s rule — asserted here as a fact about this book rather
    // than about the validator.
    expect(WORDED.length).toBe(verses.length + 1);
  });

  it("is the same shape in every verse: a heading, a blank line, four lines", () => {
    for (const page of FIRST_BOOK.pages) {
      if (!page.story) continue;
      const lines = page.story.split("\n");
      expect(lines.length, page.id).toBe(6);
      expect(lines[1], `${page.id}: the line under the heading is blank`).toBe("");
      for (const [at, line] of lines.entries()) {
        if (at === 1) continue;
        expect(line.trim(), `${page.id} line ${at}`).not.toBe("");
      }
    }
  });

  it("carries no straightened or smartened punctuation the captain did not write", () => {
    // The copy is ASCII — straight apostrophes, straight quotes, a plain
    // hyphen. An editor that "improved" one into a curly quote or an en dash
    // would be re-punctuating the poem, and this is the cheapest place to
    // notice. It is also a font question: `typewriter` carries both, so
    // nothing else would ever report it.
    const everything = [FIRST_BOOK.cover.story, ...FIRST_BOOK.pages.map((p) => p.story)]
      .filter((s): s is string => Boolean(s))
      .join("\n");
    expect(everything).not.toMatch(/[‘’“”–—]/);
  });

  it("puts the buyer's name in the words, and leaves the token standing until there is one", () => {
    const withName = FIRST_BOOK.pages.filter((p) => p.story?.includes(NAME_TOKEN));
    // Most of them, and the control that it is not an accident of one page.
    expect(withName.length).toBeGreaterThan(1);
    const index = WORDED.find((i) => pageSequence(FIRST_BOOK)[i].story?.includes(NAME_TOKEN))!;
    expect(pageFillFor(FIRST_BOOK, index, WORST_FILL).texts[SLOT.story]).toContain(LONGEST);
    expect(pageFillFor(FIRST_BOOK, index, WORST_FILL).texts[SLOT.story]).not.toContain(NAME_TOKEN);
    expect(
      pageFillFor(FIRST_BOOK, index, { ...WORST_FILL, name: "" }).texts[SLOT.story],
    ).toContain(NAME_TOKEN);
  });

  it("never burns the name into artwork: every page's words are a slot", () => {
    // The captain's generation brief says the verse and the name "go on in
    // Canva afterwards", which is right for a mock-up and wrong for a product.
    // What makes it impossible here is that there is no other way for a page to
    // have words: the format has no text that is not a slot, and the only text
    // a page can hold is the fill's.
    for (const index of WORDED) {
      const page = pageSequence(FIRST_BOOK)[index];
      expect(storySlotOn(page).kind, page.id).toBe("textSlot");
      expect(page.art.kind, page.id).toBe("drawn");
    }
  });
});

// ---------------------------------------------------------------------------

describe("no line of any verse overflows its slot, with the longest name the form takes", () => {
  it("accepts that name at all, which is what makes it the worst case", () => {
    const verdict = checkName(FIRST_BOOK, LONGEST);
    expect(verdict.ok, `the form refuses "${LONGEST}", so it is not the worst case`).toBe(true);
    expect(LONGEST.length).toBe(nameLimit(FIRST_BOOK));
  });

  it("passes the character limits the build already enforces", () => {
    // `validateBook` substitutes this same name into every line. Stated here as
    // well because the measurement below is only interesting while the cheap
    // check is also green: a book that failed both would be one fault.
    expect(validateBook(FIRST_BOOK).filter((p) => p.code === "text.storyOverflows")).toEqual([]);
  });

  /**
   * **The measurement.** One case per page of words, named by page id so a
   * failure says which verse and by how much.
   */
  for (const index of WORDED) {
    const page = pageSequence(FIRST_BOOK)[index];
    const slot = storySlotOn(page);

    it(`${page.id}: every line is inside its box`, async () => {
      const ink = await inkOf(index);
      expect(ink, `${page.id} drew no words at all`).not.toBeNull();

      /**
       * What the box allows, derived from the slot rather than typed.
       *
       * The frame is where the **first baseline** sits, so the glyphs reach
       * above it by an ascent and below the last baseline by a descent;
       * three-tenths of the type size covers both in these two faces. The
       * extra point is one pixel at the size this file renders at, which is
       * the antialiasing of the outermost stem.
       */
      const grow = slot.size * 0.3 + 1;
      const allowed: Box = {
        x: slot.frame.x - grow,
        y: slot.frame.y - grow,
        width: slot.frame.width + grow * 2,
        height: slot.frame.height + grow * 2,
      };
      const got = ink!;
      const over = {
        left: allowed.x - got.x,
        right: got.x + got.width - (allowed.x + allowed.width),
        top: allowed.y - got.y,
        bottom: got.y + got.height - (allowed.y + allowed.height),
      };
      const said =
        `${page.id}: the words are ${got.width.toFixed(1)} pt wide and ` +
        `${got.height.toFixed(1)} pt tall in a ${slot.frame.width} × ${slot.frame.height} pt ` +
        `box at ${slot.size} pt; over by ` +
        `left ${over.left.toFixed(1)}, right ${over.right.toFixed(1)}, ` +
        `top ${over.top.toFixed(1)}, bottom ${over.bottom.toFixed(1)} pt`;

      expect(over.left, said).toBeLessThanOrEqual(0);
      expect(over.right, said).toBeLessThanOrEqual(0);
      expect(over.top, said).toBeLessThanOrEqual(0);
      expect(over.bottom, said).toBeLessThanOrEqual(0);

      // And it really is a full verse rather than one surviving line, so the
      // containment above is not satisfied by a render that lost most of it.
      const lines = pageFillFor(FIRST_BOOK, index, WORST_FILL).texts[SLOT.story].split("\n");
      const drawn = lines.filter((l) => l !== "").length;
      expect(got.height, said).toBeGreaterThan((drawn - 1) * (slot.lineHeight ?? slot.size));
    }, 120_000);

    it(`${page.id}: stays inside the safe area, which is where the guillotine is not`, async () => {
      const ink = (await inkOf(index))!;
      const safe = safeBox(FIRST_BOOK.page.canvas);
      expect(ink.x, page.id).toBeGreaterThanOrEqual(safe.x);
      expect(ink.x + ink.width, page.id).toBeLessThanOrEqual(safe.x + safe.width);
      expect(ink.y, page.id).toBeGreaterThanOrEqual(safe.y);
      expect(ink.y + ink.height, page.id).toBeLessThanOrEqual(safe.y + safe.height);
    }, 120_000);
  }
});

// ---------------------------------------------------------------------------

/**
 * **Each spread's verse is where the captain put it.**
 *
 * `templates/first-book.ts` § `VERSE_TOP_ON` is a position per page because no
 * single one fits twelve different pictures, and the failure this guards is a
 * silent one: a page dropped out of that table still renders, still fits its
 * box and still passes every measurement above — it just quietly goes back to
 * the shared default and prints over whatever the artwork drew there. So this
 * is the one place in the suite that states the numbers rather than deriving
 * them, which is the point: the table is the captain's marks, and a test that
 * read them off the template could not notice one being lost.
 *
 * The unmarked spread is named here too, so that the day a mark arrives for
 * it this file says which page it was.
 */
describe("every verse sits where the captain marked it", () => {
  /**
   * The captain's marks, keyed by the spread's left page — two rounds, 13
   * November. Where the two rounds disagree the **later** mark is the one
   * here: `page-021` was 122 in round one and is 60 now.
   */
  const MARKED: Record<string, number> = {
    "page-005": 185,
    "page-007": 113,
    "page-009": 177,
    "page-011": 320,
    "page-013": 203,
    "page-015": 138,
    "page-017": 148,
    "page-019": 168,
    "page-021": 60,
    "page-023": 182,
  };

  /** The one spread the captain has not marked, and the median it takes. */
  const UNMARKED = ["page-003"];
  const DEFAULT = 172.5;

  /** Every page of the book that carries a verse — the cover's title is not one. */
  const VERSE_PAGES = FIRST_BOOK.pages.filter((p) => p.story).map((p) => p.id);

  it("marks every spread of words and leaves exactly one on the default", () => {
    // Counted off the book: this file must not become a second place that says
    // how many spreads there are.
    expect(VERSE_PAGES.sort()).toEqual([...Object.keys(MARKED), ...UNMARKED].sort());
  });

  for (const [id, top] of Object.entries(MARKED)) {
    it(`${id}: its verse box starts at ${top}`, () => {
      const page = FIRST_BOOK.pages.find((p) => p.id === id)!;
      expect(storySlotOn(page).frame.y, `${id} lost its own position`).toBe(top);
    });
  }

  for (const id of UNMARKED) {
    it(`${id}: unmarked, so it takes the shared default of ${DEFAULT}`, () => {
      const page = FIRST_BOOK.pages.find((p) => p.id === id)!;
      expect(storySlotOn(page).frame.y, `${id} is the page still on the default`).toBe(DEFAULT);
    });
  }

  it("moved the box and did not resize it: one height, one width, one frame", () => {
    // The captain's rectangles averaged 162 pt tall against this box's 160 and
    // matched its left and right edges, so this was a move. Anything that
    // changed the type while moving it would show up here.
    const slots = VERSE_PAGES.map((id) => storySlotOn(FIRST_BOOK.pages.find((p) => p.id === id)!));
    const first = slots[0];
    for (const slot of slots) {
      expect(slot.frame.x).toBe(first.frame.x);
      expect(slot.frame.width).toBe(first.frame.width);
      expect(slot.frame.height).toBe(first.frame.height);
      expect(slot.size).toBe(first.size);
      expect(slot.lineHeight).toBe(first.lineHeight);
      expect(slot.font).toBe(first.font);
    }
  });

  it("keeps every box inside the safe area, wherever the mark put it", () => {
    const safe = safeBox(FIRST_BOOK.page.canvas);
    for (const id of VERSE_PAGES) {
      const slot = storySlotOn(FIRST_BOOK.pages.find((p) => p.id === id)!);
      expect(slot.frame.y, id).toBeGreaterThanOrEqual(safe.y);
      expect(slot.frame.y + slot.frame.height, id).toBeLessThanOrEqual(safe.y + safe.height);
    }
  });

  it("names the two pages whose mark reaches above the verse_zone", () => {
    // The captain's generation brief reserves the middle 60% of the page —
    // y 122 to 490 — and most marks are inside it. Two are not, and that is
    // the captain looking at the picture rather than at the brief: `page-007`
    // is set at 113 to clear what spread four draws low, and `page-021` is at
    // 60 — 62 pt above the band, the furthest outside it any page goes —
    // because the captain re-marked that spread there having seen the verse in
    // place. On spread eleven the top-left is open window light, so nothing
    // collides today; the artwork does not promise to keep that strip clear if
    // the spread is ever regenerated.
    //
    // They are listed rather than tolerated, so that a page drifting out of
    // the reserved band by accident still fails this. A spread whose artwork
    // is re-drawn to the brief should come back into the band and off this
    // list.
    const side = FIRST_BOOK.page.canvas.height;
    const zone = { top: side * 0.2, bottom: side * 0.8 };
    const outside = VERSE_PAGES.filter((id) => {
      const { frame } = storySlotOn(FIRST_BOOK.pages.find((p) => p.id === id)!);
      return frame.y < zone.top || frame.y + frame.height > zone.bottom;
    });
    expect(outside.sort()).toEqual(["page-007", "page-021"]);
  });
});

// ---------------------------------------------------------------------------

describe("the dedication arrives with the captain's verse in it", () => {
  const slot = dedicationSlot(FIRST_BOOK)!;

  it("is pre-filled, and with this buyer's name rather than a brace token", () => {
    const text = defaultDedication(FIRST_BOOK, "Rosalind");
    expect(text).not.toBe("");
    expect(text).toContain("Rosalind");
    expect(text).not.toContain(NAME_TOKEN);
    expect(text.startsWith("Dear Rosalind,")).toBe(true);
  });

  it("fits the box it is pre-filled into, with the longest name the form takes", () => {
    const worst = defaultDedication(FIRST_BOOK, LONGEST);
    const lines = worst.split("\n");
    const widest = lines.reduce((most, l) => Math.max(most, l.length), 0);
    const said =
      `${worst.length} characters, ${lines.length} lines, widest ${widest} across; ` +
      `the slot takes ${slot.maxChars}, ${maxLinesOf(slot)} and ${maxCharsPerLineOf(slot)}`;
    expect(worst.length, said).toBeLessThanOrEqual(slot.maxChars);
    expect(lines.length, said).toBeLessThanOrEqual(maxLinesOf(slot));
    expect(widest, said).toBeLessThanOrEqual(maxCharsPerLineOf(slot));
    // And the build says the same thing, which is the half that cannot be
    // forgotten when somebody edits the verse.
    expect(validateBook(FIRST_BOOK).filter((p) => p.code.startsWith("dedication."))).toEqual([]);
  });

  it("is refused by the build if it would be re-flowed rather than printed", () => {
    // The failure that has no other reporter: `acceptLines` **wraps** a line
    // wider than the slot takes, so an over-wide default would arrive in the
    // buyer's box silently re-flowed — a different poem, with nothing anywhere
    // saying so.
    const wide: BookTemplate = {
      ...FIRST_BOOK,
      dedicationDefault: "x".repeat(maxCharsPerLineOf(slot) + 1),
    };
    const problem = validateBook(wide).find((p) => p.code === "dedication.defaultOverflows");
    expect(problem?.detail).toContain("the slot takes");

    // Paired against the real one, which is refused by nothing.
    expect(
      validateBook(FIRST_BOOK).find((p) => p.code === "dedication.defaultOverflows"),
    ).toBeUndefined();
  });

  it("prints inside its box, measured in the same pixels as the verses", async () => {
    const index = pagesWithSlot(FIRST_BOOK, SLOT.dedication)[0];
    const filled = { ...WORST_FILL, dedication: defaultDedication(FIRST_BOOK, LONGEST) };
    const template = pageTemplateFor(AFFORDABLE, index, CHOSEN);
    const strip = <T extends BookPage>(p: T): T =>
      p.id === pageSequence(FIRST_BOOK)[index].id
        ? {
            ...p,
            layers: (p.layers ?? []).filter(
              (l) => !("slot" in l) || l.slot !== SLOT.dedication,
            ),
          }
        : p;
    const without: BookTemplate = { ...AFFORDABLE, pages: AFFORDABLE.pages.map(strip) };

    const [printed, blank] = await Promise.all([
      renderPrintPng(template, pageFillFor(AFFORDABLE, index, filled)).then((r) =>
        raster(r.png, template),
      ),
      renderPrintPng(
        pageTemplateFor(without, index, CHOSEN),
        pageFillFor(without, index, filled),
      ).then((r) => raster(r.png, pageTemplateFor(without, index, CHOSEN))),
    ]);
    const ink = changedBox(printed, blank);
    expect(ink, "the pre-filled dedication drew nothing").not.toBeNull();

    const grow = slot.size * 0.3 + 1;
    const said =
      `the pre-filled dedication is ${ink!.width.toFixed(1)} pt wide in a ` +
      `${slot.frame.width} pt box at ${slot.size} pt`;
    expect(ink!.x, said).toBeGreaterThanOrEqual(slot.frame.x - grow);
    expect(ink!.x + ink!.width, said).toBeLessThanOrEqual(slot.frame.x + slot.frame.width + grow);
    expect(ink!.y, said).toBeGreaterThanOrEqual(slot.frame.y - grow);
    expect(ink!.y + ink!.height, said).toBeLessThanOrEqual(
      slot.frame.y + slot.frame.height + grow,
    );
  }, 120_000);
});
