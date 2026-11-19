/**
 * **What colour the cover's title may be, measured against the pixel actually
 * behind every letter of it.**
 *
 * The title is set straight onto the captain's cover artwork — there has been
 * no panel under it since 19 November, `templates/first-book.ts`
 * § `TITLE_CORNER` — so a colour is not a colour, it is a colour **and a
 * cover**. A pastel yellow that is lovely on cream vanishes on teal, and the
 * only way to know which is which is to look at the pixels. This module is the
 * measurement; `npm run cover-colour` is the pictures and the table, and
 * `docs/cover-colour.md` is the decision it is waiting on.
 *
 * Node only — it rasterises. `lib/book/title-fit.ts` is its sibling: that one
 * measures whether the title *fits*, this one whether it can be *read*, and
 * both work the way `test/book-verses.test.ts` works — render twice and read
 * the difference.
 *
 * ## One ink map, and then every colour is arithmetic
 *
 * The expensive thing here is rasterising a cover. The cheap thing is comparing
 * two colours. So nothing is rendered per candidate colour: each cover is
 * rendered **twice**, once with the title taken away and once with the title
 * set in a **probe palette**, and out of that pair comes an *ink map* — for
 * every letter, the list of artwork pixels that letter's ink stands on. Every
 * proposed colour, and every palette, is then measured against that map with no
 * further rendering at all. Fourteen covers, a dozen colours and three palettes
 * is 28 renders rather than 600.
 *
 * It also makes the comparison honest in a way per-colour renders could not:
 * every colour is judged against **exactly the same pixels**, so a difference
 * between two colours is a difference between the colours.
 *
 * ## Which pixels are "the ink", and why the rim is not
 *
 * The probe palette gives each letter of a line its own colour
 * (`lib/render/palette.ts` is the cycle both this and the renderer use), and
 * the pixels taken are the ones the rasteriser filled **solid** — exactly equal
 * to that letter's probe colour. Those are the pixels the press lays ink on.
 * The antialiased rim is a blend of the ink and the artwork and belongs to
 * neither, which is why it is left out rather than weighted.
 *
 * Taking the footprint from the probe render rather than from a render of the
 * proposed colour closes a hole that is easy to miss: a difference-based mask
 * would silently *drop* any pixel where the ink happened to match the artwork
 * underneath — which is a pixel of **1.0:1 contrast**, the worst case there is,
 * excluded for being invisible. The footprint here is geometry, measured once,
 * and does not move when the colour does.
 *
 * The geometry of a per-letter render is the geometry of the ordinary one:
 * the per-letter `<tspan>`s carry a `fill` and no position, so the shaper lays
 * the line out identically. Measured, not assumed —
 * `test/title-palette.test.ts` reads both ink boxes and they agree to the
 * pixel.
 *
 * ## The bar
 *
 * WCAG 2.1 asks **3:1** of large text — and 29 pt of an ExtraBold face is
 * large by any reading of it — and 4.5:1 of body text. Both are reported,
 * because the captain is choosing and a colour that clears 3 but not 4.5 is a
 * real state to be told about rather than a pass or a fail. `#3B2A20`, the ink
 * every word in the book is set in, clears both on every cover by a wide
 * margin, which is the thing any alternative is being compared with.
 *
 * **A colour that fails on one cover fails.** There are fourteen looks and a
 * buyer chooses one; a palette that works on twelve is a palette that prints
 * twelve good books and two bad ones.
 */

import { pageFillFor, pageTemplateFor } from "./derive";
import { atRenderWidth, coverTitleSlot } from "./title-fit";
import { nameLimit } from "./name";
import { letteringOf, stepsIn } from "../render/palette";
import { lineHeightOf, maxCharsPerLineOf, textOf } from "../template/defaults";
import { renderPrintPixels } from "../render/raster";
import type { BookFill, BookTemplate } from "./types";
import type { Colour } from "../template/types";

/** WCAG 2.1's large-text ratio, which 29 pt of an ExtraBold face is. */
export const LARGE_TEXT_BAR = 3;
/** WCAG 2.1's body-text ratio, reported beside it because the gap is a fact. */
export const BODY_TEXT_BAR = 4.5;

// ---------------------------------------------------------------------------
// Colour arithmetic
// ---------------------------------------------------------------------------

function channels(colour: Colour): [number, number, number] {
  const h = colour.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG relative luminance, 0–1, from 0–255 channels. */
export function lumaOf(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function lumaOfColour(colour: Colour): number {
  const [r, g, b] = channels(colour);
  return lumaOf(r, g, b);
}

/** WCAG contrast ratio between two relative luminances. 1 is invisible, 21 is black on white. */
export function ratioOf(a: number, b: number): number {
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastOf(a: Colour, b: Colour): number {
  return ratioOf(lumaOfColour(a), lumaOfColour(b));
}

// ---------------------------------------------------------------------------
// The probe palette
// ---------------------------------------------------------------------------

/**
 * A palette whose colours exist to be **told apart**, never to be looked at.
 *
 * One per step the longest line of the title takes, so that within a line no
 * two letters share a colour and a solid pixel names its own letter. Spread
 * around the hue circle at two lightnesses, which keeps neighbours far apart in
 * every channel; nothing here is a design proposal and none of it is ever drawn
 * into a sheet the captain sees.
 */
export function probePalette(steps: number): Colour[] {
  const out: Colour[] = [];
  for (let i = 0; i < steps; i++) {
    const hue = (i * 360) / steps;
    const light = i % 2 === 0 ? 0.42 : 0.62;
    out.push(hslToHex(hue, 0.95, light));
  }
  return out;
}

export function hslToHex(hue: number, s: number, l: number): Colour {
  const h = ((hue % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const byte = (v: number) =>
    Math.max(0, Math.min(255, Math.round((v + m) * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function hslOf(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return { h: ((h * 60) % 360 + 360) % 360, s, l };
}

// ---------------------------------------------------------------------------
// The ink map
// ---------------------------------------------------------------------------

/** One letter of the title, and the artwork it stands on. */
export interface LetterGround {
  /** Which line of the title, from 0. */
  line: number;
  /** Its step in the cycle — its identity, and what a palette indexes by. */
  step: number;
  /** The character, for a report a human reads. */
  char: string;
  /**
   * The relative luminance of every artwork pixel this letter's ink covers
   * solidly. Luminance rather than the colour, because a contrast ratio is a
   * function of nothing else — keeping the triples would be three times the
   * memory for a number that is never asked for.
   */
  lumas: number[];
}

/** A cover, its title's ink, and a coarse sample of the whole panel. */
export interface TitleGround {
  lookId: string;
  /** The lines of the title with the name substituted, as drawn. */
  lines: string[];
  letters: LetterGround[];
  /** Every solid ink pixel counted, across all letters. */
  pixels: number;
  /**
   * A stride sample of the whole cover, as `[r, g, b]` triples. What
   * `palettePulledFrom` reads, and the reason the render is not thrown away.
   */
  sample: [number, number, number][];
}

const DEFAULT_WIDTH = 1200;

/**
 * The cover with its title set in a palette — **one field of one layer**, which
 * is the whole of what a palette is. Nothing about the box, the face, the size
 * or the baselines moves, so a sheet of palettes is a comparison of colour.
 */
export function coverTitlePalette(
  book: BookTemplate,
  palette: readonly Colour[],
): BookTemplate {
  const slot = coverTitleSlot(book);
  return {
    ...book,
    cover: {
      ...book.cover,
      layers: (book.cover.layers ?? []).map((l) => (l.id === slot.id ? { ...l, palette } : l)),
    },
  };
}

/** The same, for one colour — and with any palette taken off, so it is one. */
export function coverTitleColoured(book: BookTemplate, colour: Colour): BookTemplate {
  const slot = coverTitleSlot(book);
  return {
    ...book,
    cover: {
      ...book.cover,
      layers: (book.cover.layers ?? []).map((l) =>
        l.id === slot.id ? { ...l, colour, palette: undefined } : l,
      ),
    },
  };
}

function coverWithoutTitle(book: BookTemplate): BookTemplate {
  const slot = coverTitleSlot(book);
  return {
    ...book,
    cover: {
      ...book.cover,
      layers: (book.cover.layers ?? []).filter((l) => l.id !== slot.id),
    },
  };
}

/** The title as it will be drawn, with the name in it, line by line. */
export function titleLines(book: BookTemplate, name: string): string[] {
  const slot = coverTitleSlot(book);
  const story = book.cover.story ?? "";
  return textOf(slot, story.split("{name}").join(name)).split("\n");
}

/**
 * **One cover, measured: which artwork pixel every letter of the title stands
 * on.**
 *
 * Two renders and no more. The name defaults to the longest the form accepts,
 * because that is the title that covers the most of the corner and the one
 * `validateBook` is written against — a shorter name is a subset of the same
 * band.
 *
 * A letter with no pixels at all is kept in the result with an empty `lumas`,
 * and every verdict below treats that as a failure rather than as a perfect
 * score: a letter the rasteriser did not draw is the one failure mode a
 * measurement of drawn ink cannot otherwise see.
 */
export async function titleGroundOf(
  book: BookTemplate,
  fill: BookFill,
  options: { name?: string; renderWidth?: number } = {},
): Promise<TitleGround> {
  const slot = coverTitleSlot(book);
  const name = options.name ?? "M".repeat(nameLimit(book));
  const width = options.renderWidth ?? DEFAULT_WIDTH;
  const lines = titleLines(book, name);
  const steps = Math.max(1, ...lines.map(stepsIn));
  const probe = probePalette(Math.max(steps, maxCharsPerLineOf(slot)));

  const withName: BookFill = { ...fill, name };
  const chosen = { lookId: fill.lookId };
  const sized = (b: BookTemplate) => atRenderWidth(b, width);
  const [probed, bare] = await Promise.all([
    renderPrintPixels(
      pageTemplateFor(sized(coverTitlePalette(book, probe)), 0, chosen),
      pageFillFor(sized(book), 0, withName),
    ),
    renderPrintPixels(
      pageTemplateFor(sized(coverWithoutTitle(book)), 0, chosen),
      pageFillFor(sized(coverWithoutTitle(book)), 0, withName),
    ),
  ]);

  const scale = probed.width / book.page.canvas.width;
  const lh = lineHeightOf(slot);
  const baseline = slot.frame.y + (slot.baseline ?? slot.size);
  /** The visual centre of each line, which is how a pixel finds its own line. */
  const centres = lines.map((_, i) => baseline + lh * i - slot.size * 0.35);

  /** Probe colour → step, which is the same for every line by construction. */
  const stepOf = new Map<string, number>();
  for (const [at, colour] of probe.entries()) stepOf.set(colour.toUpperCase(), at);

  const key = (line: number, step: number) => `${line}:${step}`;
  const found = new Map<string, number[]>();

  const x0 = Math.max(0, Math.floor(slot.frame.x * scale) - 2);
  const x1 = Math.min(probed.width, Math.ceil((slot.frame.x + slot.frame.width) * scale) + 2);
  const y0 = Math.max(0, Math.floor(slot.frame.y * scale) - 2);
  const y1 = Math.min(probed.height, Math.ceil((slot.frame.y + slot.frame.height) * scale) + 2);

  for (let y = y0; y < y1; y++) {
    const line = nearestLine(y / scale, centres);
    for (let x = x0; x < x1; x++) {
      const i = (y * probed.width + x) << 2;
      const hex = hexAt(probed.rgba, i);
      const step = stepOf.get(hex);
      if (step === undefined) continue;
      const lumas = found.get(key(line, step)) ?? [];
      lumas.push(lumaOf(bare.rgba[i], bare.rgba[i + 1], bare.rgba[i + 2]));
      found.set(key(line, step), lumas);
    }
  }

  const letters: LetterGround[] = [];
  for (const [at, line] of lines.entries()) {
    for (const letter of letteringOf(line, probe)) {
      if (letter.step === null) continue;
      letters.push({
        line: at,
        step: letter.step,
        char: letter.char,
        lumas: found.get(key(at, letter.step)) ?? [],
      });
    }
  }

  return {
    lookId: fill.lookId,
    lines,
    letters,
    pixels: letters.reduce((n, l) => n + l.lumas.length, 0),
    sample: sampleOf(bare.rgba, bare.width, bare.height, 7),
  };
}

function hexAt(rgba: Uint8Array, i: number): string {
  return `#${[0, 1, 2].map((c) => rgba[i + c].toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function nearestLine(y: number, centres: number[]): number {
  let best = 0;
  for (const [at, centre] of centres.entries()) {
    if (Math.abs(y - centre) < Math.abs(y - centres[best])) best = at;
  }
  return best;
}

function sampleOf(
  rgba: Uint8Array,
  width: number,
  height: number,
  stride: number,
): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) << 2;
      out.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The verdicts
// ---------------------------------------------------------------------------

export interface Verdict {
  /** The lowest contrast ratio any pixel of this ink reaches. */
  worst: number;
  /** The share of its pixels under `LARGE_TEXT_BAR`, 0–1. */
  underBar: number;
  /** The share of its pixels under `BODY_TEXT_BAR`, 0–1. */
  underBody: number;
  pixels: number;
  /** Clears the large-text bar everywhere. The only question that is a pass. */
  passes: boolean;
}

function verdictFor(colour: Colour, lumas: readonly number[]): Verdict {
  if (lumas.length === 0) {
    // A letter that drew nothing. Reported as the failure it is, never as a
    // perfect score — the control `test/pixels.ts` asks for, built in.
    return { worst: 0, underBar: 1, underBody: 1, pixels: 0, passes: false };
  }
  const ink = lumaOfColour(colour);
  let worst = Infinity;
  let under = 0;
  let underBody = 0;
  for (const luma of lumas) {
    const ratio = ratioOf(ink, luma);
    if (ratio < worst) worst = ratio;
    if (ratio < LARGE_TEXT_BAR) under++;
    if (ratio < BODY_TEXT_BAR) underBody++;
  }
  return {
    worst,
    underBar: under / lumas.length,
    underBody: underBody / lumas.length,
    pixels: lumas.length,
    passes: worst >= LARGE_TEXT_BAR,
  };
}

/** One colour over the whole title, which is how a single-colour option is judged. */
export function inkVerdict(colour: Colour, ground: TitleGround): Verdict {
  return verdictFor(colour, ground.letters.flatMap((l) => l.lumas));
}

export interface LetterVerdict extends Verdict {
  line: number;
  step: number;
  char: string;
  colour: Colour;
}

export interface PaletteVerdict {
  /** Every letter, in drawing order. */
  letters: LetterVerdict[];
  /** The letters that do not clear the large-text bar. Empty is a pass. */
  failing: LetterVerdict[];
  worst: number;
  passes: boolean;
}

/**
 * **A palette, letter by letter.**
 *
 * The assignment is not restated here: `letteringOf` is asked, exactly as
 * `lib/render/svg.ts` asks it, so a measurement cannot drift from a drawing.
 */
export function paletteVerdict(palette: readonly Colour[], ground: TitleGround): PaletteVerdict {
  const letters: LetterVerdict[] = [];
  for (const [at, line] of ground.lines.entries()) {
    const lettering = letteringOf(line, palette);
    for (const letter of lettering) {
      if (letter.step === null || letter.colour === null) continue;
      const found = ground.letters.find((l) => l.line === at && l.step === letter.step);
      letters.push({
        line: at,
        step: letter.step,
        char: letter.char,
        colour: letter.colour,
        ...verdictFor(letter.colour, found?.lumas ?? []),
      });
    }
  }
  const failing = letters.filter((l) => !l.passes);
  return {
    letters,
    failing,
    worst: letters.reduce((low, l) => Math.min(low, l.worst), Infinity),
    passes: failing.length === 0,
  };
}

// ---------------------------------------------------------------------------
// A palette pulled out of the cover itself
// ---------------------------------------------------------------------------

/**
 * **Six colours taken from this cover's own artwork, dark enough to read on
 * it.**
 *
 * The prettier of the two answers the captain asked for, and the expensive one:
 * it is a different palette on every cover, so it is fourteen things to keep
 * true and a palette nobody has looked at on every cover that lands next.
 *
 * How it is derived, and every step of it is a decision:
 *
 *  1. **Hue comes from the cover.** The panel's own pixels, bucketed into
 *     twelve 30° hues, the six commonest with any colour in them at all
 *     (saturation ≥ 0.15 — below that a pixel is a grey and has no hue to
 *     contribute).
 *  2. **Saturation is lifted.** Artwork is washed; a title is ink. The bucket's
 *     median saturation, raised and then held between 0.45 and 0.9.
 *  3. **Lightness is whatever the cover allows.** Swept from light to dark and
 *     stopped at the **first value that clears the bar against every pixel
 *     under the title** — so the palette is as pale as this cover can bear and
 *     no paler. That is why it passes by construction, and why on a busy cover
 *     it comes back darker than anybody would have chosen by eye.
 *
 * Fewer than five usable hues is possible — a cover that is one colour — and
 * the gap is filled by **rotating** the strongest hue rather than by inventing
 * a colour from somewhere else, because a palette taken from the artwork should
 * fail by being monotonous rather than by being someone else's idea.
 */
export function palettePulledFrom(ground: TitleGround, want = 6): Colour[] {
  const lumas = ground.letters.flatMap((l) => l.lumas);
  const buckets = new Map<number, number[]>();
  for (const [r, g, b] of ground.sample) {
    const { h, s } = hslOf(r, g, b);
    if (s < 0.15) continue;
    const bucket = Math.floor(h / 30);
    const list = buckets.get(bucket) ?? [];
    list.push(s);
    buckets.set(bucket, list);
  }
  const ranked = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
  const hues: { hue: number; sat: number }[] = ranked.slice(0, want).map(([bucket, sats]) => ({
    hue: bucket * 30 + 15,
    sat: Math.min(0.9, Math.max(0.45, median(sats) * 1.35)),
  }));
  while (hues.length > 0 && hues.length < want) {
    const from = hues[hues.length % ranked.length];
    hues.push({ hue: from.hue + 37 * hues.length, sat: from.sat });
  }
  if (hues.length === 0) hues.push({ hue: 20, sat: 0.6 });

  return hues.map(({ hue, sat }) => {
    for (let l = 0.58; l >= 0.1; l -= 0.02) {
      const colour = hslToHex(hue, sat, l);
      if (verdictFor(colour, lumas).passes) return colour;
    }
    return hslToHex(hue, sat, 0.1);
  });
}

/**
 * **The lightest this colour could be and still clear the bar on every cover
 * given.**
 *
 * The captain's reference is a *pastel* headline, and the measurement's answer
 * to a pastel is no — so the useful question is not "does this pastel pass" but
 * "how pale can a letter be at all". This keeps the colour's hue and its
 * saturation and walks its lightness down from where it is until the worst
 * pixel on the worst cover clears `LARGE_TEXT_BAR`, which is the palest
 * version of the captain's own colour the artwork permits.
 *
 * It is how the `pastel-deep` palette in `TITLE_PALETTES` was derived, and the
 * reason that palette is *declared* rather than computed at render time: a
 * palette that silently re-derives is a palette that changes the moment a cover
 * lands, which is the cost `pulled` exists to show. `npm run cover-colour`
 * prints this again on every run, so a declared value that has gone stale is
 * visible rather than assumed.
 *
 * `bar` defaults to `LARGE_TEXT_BAR`, which answers the question literally and
 * returns a colour sitting **exactly on** the bar — no headroom at all, so any
 * cover with a darker corner than the ones measured drops it under. The
 * declared palette is derived at a higher bar for that reason, which is written
 * beside it.
 *
 * `null` when no lightness at this hue passes — the hue itself is impossible.
 */
export function lightestThatPasses(
  colour: Colour,
  grounds: readonly TitleGround[],
  bar: number = LARGE_TEXT_BAR,
): Colour | null {
  const [r, g, b] = channels(colour);
  const { h, s } = hslOf(r, g, b);
  const lumas = grounds.map((ground) => ground.letters.flatMap((l) => l.lumas));
  for (let l = Math.round(hslOf(r, g, b).l * 100) / 100; l >= 0.04; l -= 0.01) {
    const candidate = hslToHex(h, s, l);
    if (lumas.every((set) => verdictFor(candidate, set).worst >= bar)) return candidate;
  }
  return null;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// ---------------------------------------------------------------------------
// What the captain is being shown
// ---------------------------------------------------------------------------

/**
 * **The single colours worth looking at, and why each is in the list.**
 *
 * Not a swatch dump: five, each of which is a different *decision* rather than
 * a different hex. Every one is drawn from the book's own world — the ink the
 * words are already set in, the cover's own declared colour, and the scene
 * washes in `templates/first-book.ts` § `SCENES` — because a title in a colour
 * from nowhere is a title that reads as a sticker.
 *
 * `today` marks the committed one, so a sheet can outline it the way
 * `npm run cover-faces` outlines the committed face.
 */
export interface InkOption {
  key: string;
  colour: Colour;
  label: string;
  why: string;
  today?: boolean;
}

export const TITLE_INKS: readonly InkOption[] = [
  {
    key: "ink",
    colour: "#3B2A20",
    label: "Ink",
    why:
      "The book's own ink, which every verse and the from-line are already set " +
      "in. The one option that is not a second thing to keep true, and the one " +
      "everything below is being compared with.",
    today: true,
  },
  {
    key: "espresso",
    colour: "#241812",
    label: "Espresso",
    why:
      "The deep end: the book's ink taken down until it is almost black. A " +
      "heavier cover face at 29 pt can carry it, and it is the safest thing " +
      "that could be printed on a cover nobody has measured yet.",
  },
  {
    key: "berry",
    colour: "#8E3A4C",
    label: "Berry",
    why:
      "The cover's own declared colour at ink weight — the blush of " +
      "`coverColour` taken down far enough to read. The one option that " +
      "connects the title to the object it is printed on.",
  },
  {
    key: "deepteal",
    colour: "#1E4C58",
    label: "Deep teal",
    why:
      "The cool scene wash at ink weight, and the hue the delivered covers " +
      "actually put in this corner. A title the same family as the sky behind " +
      "it reads as part of the picture rather than as type laid over it.",
  },
  {
    key: "cream",
    colour: "#FBF6EC",
    label: "Cream",
    why:
      "The light end, and the one that is here to be *refused* if the " +
      "measurement refuses it: the cream the old title panel was made of, now " +
      "as the type itself. On a pale sky it is the failure case, and the " +
      "captain asked to see the range rather than three versions of one answer.",
  },
];

/**
 * **The palettes, and the three answers to the same question.**
 *
 * `pulled` has no colours in it: it is derived per cover by
 * `palettePulledFrom`, and the flag is how a caller knows to ask rather than to
 * read. A fixed palette is one thing to keep true on fourteen covers; a pulled
 * one is fourteen things, and the difference is the whole of what the captain
 * is choosing between.
 */
export interface PaletteOption {
  key: string;
  label: string;
  why: string;
  /** Fixed, in order. Empty means `pulled` — derived from each cover. */
  colours: readonly Colour[];
  pulled?: true;
}

export const TITLE_PALETTES: readonly PaletteOption[] = [
  {
    key: "pastel",
    label: "The party pastels",
    why:
      "The captain's reference as literally as it can be taken: six pastels of " +
      "the kind a party invitation sets a headline in. It is first in the list " +
      "because it is the thing that was asked for, and it is measured rather " +
      "than argued with — on every cover there is, every letter of it is under " +
      "the bar, because a pastel is by definition light and every corner these " +
      "covers put behind the title is pale. There is no cover in the set where " +
      "a light letter wins.",
    colours: ["#F2A8C0", "#F6D06A", "#8FD3C7", "#A9B8E8", "#F3A26D", "#C3A9DD"],
  },
  {
    key: "pastelDeep",
    label: "The same pastels, as deep as the artwork allows",
    why:
      "The captain's six hues kept exactly, with only their lightness taken " +
      "down — each to the palest value that clears 4:1 on every cover measured, " +
      "which is a third of margin over the 3:1 bar. Derived by " +
      "`lightestThatPasses` and then declared, so it cannot quietly re-derive " +
      "when a cover lands; `npm run cover-colour` prints the derivation again " +
      "on every run, so a value that has gone stale shows. The honest thing to " +
      "look at here is the yellow: at the lightness the artwork allows it is " +
      "olive, and a pastel yellow is the one colour on the reference that " +
      "cannot survive being printed on a photograph.",
    colours: ["#92163E", "#604806", "#21544B", "#2A459D", "#7B370A", "#61378B"],
  },
  {
    key: "deep",
    label: "The book's colours at ink weight",
    why:
      "Six hues from the book's own world rather than from the reference — the " +
      "cover's declared blush, the cool and warm and green scene washes, a " +
      "plum, and the book's own ink as the sixth so the set is anchored to " +
      "something the rest of the book is already set in. Every one of them " +
      "clears 4:1 on every cover measured. One fixed set, measured everywhere, " +
      "and one thing to keep true.",
    colours: ["#7E3344", "#674010", "#2A5228", "#1A4350", "#413669", "#3B2A20"],
  },
  {
    key: "pulled",
    label: "Pulled from each cover",
    why:
      "Six colours taken out of the cover's own artwork and darkened until they " +
      "clear the bar on it — `palettePulledFrom`. Prettier in principle and the " +
      "expensive answer: it is a different palette on every cover, so it passes " +
      "by construction and nobody has looked at thirteen of them, and the next " +
      "cover that lands brings a fourteenth palette with it.",
    colours: [],
    pulled: true,
  },
];