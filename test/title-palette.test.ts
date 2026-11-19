/**
 * **A colour per letter, and whether a colour can be read on a cover at all.**
 *
 * Two capabilities arrived together on 19 November and this file holds both,
 * because they are halves of one answer: `TextSlotLayer.palette` is how a title
 * is set in more than one colour, and `lib/book/title-colour.ts` is the only
 * thing that can say whether any particular colour may be used. The title is
 * set straight onto the captain's cover artwork — no panel since
 * `templates/first-book.ts` § `TITLE_CORNER` — so a colour is never a colour on
 * its own. It is a colour **and a cover**.
 *
 * The standard `test/pixels.ts` sets is kept throughout: **a test that would
 * pass if the renderer drew nothing is not a test.** Every assertion about ink
 * here is paired with the same assertion against a render that does not carry
 * it, and every verdict that passes is paired with one that must fail.
 *
 * The book under test is `FIRST_BOOK` itself and **not** the delivered one, so
 * every number is the drawn placeholder cover's: a fresh clone, CI and the
 * captain's own machine all measure the same pixels. What the artwork store
 * holds is `npm run cover-colour`'s business, and it says so per look.
 */

import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { letteringOf, stepsIn } from "../lib/render/palette";
import { paletteOf } from "../lib/template/defaults";
import { validateTemplate } from "../lib/template/validate";
import { pageFillFor, pageTemplateFor } from "../lib/book/derive";
import { renderPrintPixels } from "../lib/render/raster";
import { atRenderWidth, coverTitleSlot, titleInkFor } from "../lib/book/title-fit";
import {
  LARGE_TEXT_BAR,
  TITLE_INKS,
  TITLE_PALETTES,
  coverTitlePalette,
  contrastOf,
  inkVerdict,
  lightestThatPasses,
  paletteVerdict,
  probePalette,
  titleGroundOf,
} from "../lib/book/title-colour";
import type { BookTemplate } from "../lib/book/types";
import type { PageTemplate } from "../lib/template/types";

const SLOT = coverTitleSlot(FIRST_BOOK);
const WIDTH = 900;
const NAME = "Matilda";

/** Six colours nothing in the artwork is, so a pixel of one is a pixel of ink. */
const SIX = probePalette(6);

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

describe("the cycle is positional, restarts on each line, and spends nothing on a space", () => {
  it("gives each letter the next colour in order", () => {
    expect(letteringOf("abc", ["#111111", "#222222"]).map((l) => l.colour)).toEqual([
      "#111111",
      "#222222",
      "#111111",
    ]);
  });

  it("restarts on every line, so the captain's two fixed lines never move", () => {
    // Each line is handed over separately — that *is* the restart — so the same
    // text twice is the same colours twice, whatever stood between them.
    const first = letteringOf("Turned One", SIX).map((l) => l.colour);
    const second = letteringOf("Turned One", SIX).map((l) => l.colour);
    expect(second).toEqual(first);

    /**
     * The control, and the reason the decision went this way: a cycle that ran
     * straight through the title would start the third line at
     * `4 + name.length`, so two orders whose names differ by one letter would
     * print *"Turned One"* in different colours. Asserted here as the thing
     * that is **not** happening — the same line after a longer name is still
     * the same line.
     */
    const continued = (before: string) =>
      letteringOf(before + "Turned One", SIX)
        .slice(stepsIn(before))
        .map((l) => l.colour);
    expect(continued("MMMM")).not.toEqual(first);
    expect(continued("MMMMMM")).not.toEqual(continued("MMMM"));
  });

  it("takes no colour and no step for a space, so the two words are not slid by one", () => {
    const lettering = letteringOf("Turned One", SIX);
    const space = lettering.find((l) => l.char === " ");
    expect(space?.colour).toBeNull();
    expect(space?.step).toBeNull();

    // "Turned" spends six steps, so with six colours "One" starts again at the
    // first. With the space taking a step it would start at the second — which
    // is the whole of what this decision is about.
    const after = lettering.filter((l) => l.step !== null).map((l) => l.step);
    expect(after).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(lettering.filter((l) => l.char === "O")[0].colour).toBe(SIX[6 % SIX.length]);
    expect(stepsIn("Turned One")).toBe(9);
  });

  it("gives visible punctuation a step, because it is a drawn mark", () => {
    const hyphen = letteringOf("Charlotte-Rose", SIX).find((l) => l.char === "-");
    expect(hyphen?.colour).not.toBeNull();
    expect(stepsIn("Charlotte-Rose")).toBe("Charlotte-Rose".length);
  });
});

describe("the tolerant reader, which is the only thing that reads the field", () => {
  it("answers null for every shape that is not a list of colours", () => {
    expect(paletteOf({})).toBeNull();
    expect(paletteOf({ palette: [] })).toBeNull();
    expect(paletteOf({ palette: ["#112233"] })).toEqual(["#112233"]);
    expect(paletteOf({ palette: "pink" as unknown as string[] })).toBeNull();
    expect(paletteOf({ palette: [1 as unknown as string] })).toBeNull();
  });
});

describe("a template declaring a palette is held to the format's own spelling", () => {
  const withTitle = (extra: Record<string, unknown>): PageTemplate => {
    const template = pageTemplateFor(FIRST_BOOK, 0, { lookId: FIRST_BOOK.looks[0].id });
    return {
      ...template,
      layers: template.layers.map((l) => (l.id === SLOT.id ? { ...l, ...extra } : l)),
    };
  };
  const codes = (extra: Record<string, unknown>) => validateTemplate(withTitle(extra)).map((p) => p.code);

  it("accepts the cover as committed, which carries no palette at all", () => {
    expect(codes({})).toEqual([]);
  });

  it("accepts a palette of real colours", () => {
    expect(codes({ palette: SIX })).toEqual([]);
  });

  it("refuses a declared palette with nothing in it", () => {
    expect(codes({ palette: [] })).toContain("text.paletteEmpty");
  });

  it("refuses a named colour in a palette, and says which entry", () => {
    const problems = validateTemplate(withTitle({ palette: ["#112233", "rebeccapurple"] }));
    expect(problems.map((p) => p.code)).toContain("text.paletteColour");
    expect(problems.find((p) => p.code === "text.paletteColour")?.detail).toContain("[1]");
  });

  it("refuses a malformed single colour too, now the predicate exists", () => {
    expect(codes({ colour: "darkred" })).toContain("text.colourMalformed");
  });
});

// ---------------------------------------------------------------------------
// What the renderer actually draws
// ---------------------------------------------------------------------------

async function pixelsOf(book: BookTemplate): Promise<Uint8Array> {
  const sized = atRenderWidth(book, WIDTH);
  const { rgba } = await renderPrintPixels(
    pageTemplateFor(sized, 0, { lookId: FIXTURE_BOOK_FILL.lookId }),
    pageFillFor(sized, 0, { ...FIXTURE_BOOK_FILL, name: NAME }),
  );
  return rgba;
}

function countOf(rgba: Uint8Array, colours: readonly string[]): Map<string, number> {
  const want = new Map(colours.map((c) => [c.toUpperCase(), 0]));
  for (let i = 0; i < rgba.length; i += 4) {
    const hex = `#${[0, 1, 2].map((c) => rgba[i + c].toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    const at = want.get(hex);
    if (at !== undefined) want.set(hex, at + 1);
  }
  return want;
}

describe("the renderer sets each letter in its own colour", () => {
  it("draws every colour of the palette, and none of them without it", async () => {
    const [palette, plain] = await Promise.all([
      pixelsOf(coverTitlePalette(FIRST_BOOK, SIX)),
      pixelsOf(FIRST_BOOK),
    ]);
    const drawn = countOf(palette, SIX);
    for (const colour of SIX) {
      expect(drawn.get(colour.toUpperCase()), `${colour} drew nothing`).toBeGreaterThan(0);
    }

    // The control. Without the palette the page holds none of these colours at
    // all, so the count above is the title's ink and not the artwork's.
    const absent = countOf(plain, SIX);
    for (const colour of SIX) {
      expect(absent.get(colour.toUpperCase()), `${colour} is in the cover itself`).toBe(0);
    }
  });

  /**
   * **A palette is a colour change and not a layout change**, which is the
   * property every measurement in `lib/book/title-colour.ts` rests on: it reads
   * a letter's footprint off a per-letter render and then judges colours the
   * title will be drawn in as one run. The per-letter `<tspan>`s carry a `fill`
   * and no position precisely so that the shaper lays the line out as a line.
   */
  it("puts the ink in exactly the same place as the title without one", async () => {
    const [withPalette, without] = await Promise.all([
      titleInkFor(atRenderWidth(coverTitlePalette(FIRST_BOOK, SIX), 1200), FIXTURE_BOOK_FILL, NAME),
      titleInkFor(atRenderWidth(FIRST_BOOK, 1200), FIXTURE_BOOK_FILL, NAME),
    ]);
    expect(without, "the title drew nothing").not.toBeNull();
    expect(withPalette).toEqual(without);
  });
});

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

describe("every letter's ink is found, and measured against what is behind it", () => {
  it("finds pixels for every letter of the title, which is what makes the map a map", async () => {
    const ground = await titleGroundOf(FIRST_BOOK, FIXTURE_BOOK_FILL, { renderWidth: WIDTH });
    expect(ground.lines.length).toBeGreaterThan(1);
    expect(ground.letters.length).toBe(ground.lines.reduce((n, line) => n + stepsIn(line), 0));
    expect(
      ground.letters.filter((l) => l.lumas.length === 0).map((l) => `${l.line}:${l.step}${l.char}`),
      "a letter the measurement could not find",
    ).toEqual([]);
    expect(ground.pixels).toBeGreaterThan(ground.letters.length);
  });

  it("passes the ink the book is set in and fails the palest thing on the list", async () => {
    const ground = await titleGroundOf(FIRST_BOOK, FIXTURE_BOOK_FILL, { renderWidth: WIDTH });
    const today = TITLE_INKS.find((i) => i.today)!;
    const verdict = inkVerdict(today.colour, ground);
    expect(verdict.passes).toBe(true);
    expect(verdict.worst).toBeGreaterThan(LARGE_TEXT_BAR);
    expect(verdict.underBar).toBe(0);

    /**
     * The pair. A measurement that passed every colour would be measuring
     * nothing, so the lightest option on the captain's own list must come back
     * refused — and with *all* of its ink under the bar rather than some of it,
     * because the cover's corner is one pale ground.
     */
    const cream = TITLE_INKS.find((i) => i.colour.toUpperCase() === "#FBF6EC")!;
    const failed = inkVerdict(cream.colour, ground);
    expect(failed.passes).toBe(false);
    expect(failed.underBar).toBe(1);
    expect(failed.worst).toBeLessThan(verdict.worst);
  });

  it("is the colour's own contrast where the ground is flat, so the number means what it says", async () => {
    // The drawn cover's corner is the book's declared `coverColour`, so the
    // measured worst must land near the arithmetic between the two colours.
    // This is the check that the pixel path and the colour path agree; a
    // measurement that had found the wrong pixels would not.
    const ground = await titleGroundOf(FIRST_BOOK, FIXTURE_BOOK_FILL, { renderWidth: WIDTH });
    const today = TITLE_INKS.find((i) => i.today)!;
    const flat = contrastOf(today.colour, FIRST_BOOK.coverColour);
    expect(inkVerdict(today.colour, ground).worst).toBeGreaterThan(flat * 0.9);
    expect(inkVerdict(today.colour, ground).worst).toBeLessThan(flat * 1.1);
  });
});

describe("the palettes the captain is being shown, each with its verdict", () => {
  it("refuses the reference pastels on this cover, letter by letter", async () => {
    const ground = await titleGroundOf(FIRST_BOOK, FIXTURE_BOOK_FILL, { renderWidth: WIDTH });
    const pastel = TITLE_PALETTES.find((o) => o.key === "pastel")!;
    const verdict = paletteVerdict(pastel.colours, ground);
    expect(verdict.passes).toBe(false);
    // Every letter, not a few: a pastel is light and the corner is pale, so
    // there is no letter of it that this cover carries.
    expect(verdict.failing.length).toBe(verdict.letters.length);
    for (const letter of verdict.failing) expect(letter.worst).toBeLessThan(LARGE_TEXT_BAR);
  });

  it("accepts the two fixed palettes on every letter, which is the pair for the above", async () => {
    const ground = await titleGroundOf(FIRST_BOOK, FIXTURE_BOOK_FILL, { renderWidth: WIDTH });
    for (const key of ["pastelDeep", "deep"]) {
      const option = TITLE_PALETTES.find((o) => o.key === key)!;
      const verdict = paletteVerdict(option.colours, ground);
      expect(
        verdict.failing.map((l) => `${l.char} ${l.colour} ${l.worst.toFixed(2)}`),
        `${option.label} does not clear ${LARGE_TEXT_BAR}:1 everywhere`,
      ).toEqual([]);
      expect(verdict.worst).toBeGreaterThan(LARGE_TEXT_BAR);
    }
  });

  it("holds every declared palette to the captain's five-to-seven", () => {
    // A product decision rather than a format one — `TextSlotLayer.palette`
    // takes any number — so it is asserted here, where the proposals live.
    for (const option of TITLE_PALETTES) {
      if (option.pulled) continue;
      expect(option.colours.length, option.label).toBeGreaterThanOrEqual(5);
      expect(option.colours.length, option.label).toBeLessThanOrEqual(7);
    }
  });

  /**
   * **The declared `pastelDeep` palette is the captain's own hues**, taken down
   * only in lightness, and the two assertions are the two halves of that claim:
   * each declared colour clears the bar where the pastel it came from does not.
   * Where exactly the lightness stops is `npm run cover-colour`'s to report
   * against every cover the artwork store holds; this is the part that must be
   * true wherever the suite runs.
   */
  it("keeps each reference pastel's hue and takes only its lightness", async () => {
    const ground = await titleGroundOf(FIRST_BOOK, FIXTURE_BOOK_FILL, { renderWidth: WIDTH });
    const pastel = TITLE_PALETTES.find((o) => o.key === "pastel")!;
    const deepened = TITLE_PALETTES.find((o) => o.key === "pastelDeep")!;
    expect(deepened.colours.length).toBe(pastel.colours.length);
    for (const [at, colour] of deepened.colours.entries()) {
      expect(inkVerdict(colour, ground).passes, `${colour} does not pass`).toBe(true);
      expect(inkVerdict(pastel.colours[at], ground).passes, `${pastel.colours[at]} passes`).toBe(
        false,
      );
      expect(lightestThatPasses(pastel.colours[at], [ground]), "no lightness passes").not.toBeNull();
    }
  });

  it("pulls a palette out of a cover that passes on that cover, by construction", async () => {
    const ground = await titleGroundOf(FIRST_BOOK, FIXTURE_BOOK_FILL, { renderWidth: WIDTH });
    const { palettePulledFrom } = await import("../lib/book/title-colour");
    const pulled = palettePulledFrom(ground);
    expect(pulled.length).toBe(6);
    expect(paletteVerdict(pulled, ground).passes).toBe(true);

    // The pair, and the cost the captain is being asked to weigh: the palette
    // is a function of the cover, so a different cover is a different palette.
    // The same book with a cool ground under the same drawing — one field —
    // and six different colours come back.
    const cool: BookTemplate = {
      ...FIRST_BOOK,
      coverColour: "#2B3A55",
      cover: {
        ...FIRST_BOOK.cover,
        art: { kind: "drawn", scene: { ground: "#2B3A55", floor: "#3E5377", prop: "#56709C", seed: 1001 } },
      },
    };
    const other = await titleGroundOf(cool, FIXTURE_BOOK_FILL, { renderWidth: WIDTH });
    expect(palettePulledFrom(other)).not.toEqual(pulled);
  });
});
