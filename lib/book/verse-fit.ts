/**
 * **How wide and how tall the verses actually set, measured out of the
 * pixels.**
 *
 * Eleven of them, which is the eleven `templates/first-book.ts` § `STORY`
 * prints. The captain wrote twelve and the twelfth is spread one's, which
 * arrives as `BookTemplate.dedicationDefault` in the *buyer's* box rather than
 * printed over it — a different slot with a different size and its own
 * measurement in `test/book-verses.test.ts`. A change of verse face does not
 * touch it.
 *
 * The captain asked on 19 November whether the book's font can change too,
 * having just chosen a face for the cover. The verses are set in `typewriter`
 * — Special Elite — and `templates/first-book.ts` § `storySlot` records the
 * arithmetic that put them there: 15 pt chosen against a measured 480 pt line,
 * a 500 pt box, 20 pt of headroom on the worst line. **Every one of those
 * numbers is Special Elite's.** A character count is face-independent and so
 * `validateBook` would pass any face at all; the thing that would go wrong is
 * a printed page, which is why this file exists before any switch does.
 *
 * It is `lib/book/title-fit.ts`'s method on the other half of the book, and
 * for the same reason: **render each page twice, once with its verse and once
 * with the slot taken out, and read the ink's own bounding box out of the
 * difference.** Every differing pixel is the verse's, exactly — which is what
 * makes "it fits" a measurement rather than a tolerance argument with a
 * photographic spread underneath. `test/book-verses.test.ts` already does this
 * for the committed face, one page at a time; what is new here is doing it
 * **per face**, over every page at once, and reporting the worst.
 *
 * ## The three answers a change of face needs, and why they are three
 *
 * **Across** is the one a count cannot give. The box is 500 pt and the widest
 * line of the copy is the binding one — but *which* line is widest is itself a
 * property of the face, so `verseFitFor` measures all eleven pages and takes
 * the maximum rather than trusting spread five's line to stay the widest.
 *
 * **Down** is the one that is easy to get wrong in the other direction.
 * `lib/render/svg.ts` § `drawTextSlot` sets every line at an **absolute**
 * baseline — `frame.y + baseline + lineHeight * i` — so a face cannot move
 * where the block sits. The captain's hand-marked `VERSE_TOP_ON` is therefore
 * safe from a change of face *by construction*. What a face does change is how
 * far the ink reaches **above the first baseline and below the last**, which is
 * its ascent and descent; a tall face overflows the 160 pt box without a
 * single number in the template having moved. `above` and `below` below are
 * that, per page, in points.
 *
 * **Apparent size** is the one the fit numbers actively mislead about. A face
 * that only fits at 13 pt is not thereby smaller to read: x-heights differ by
 * more than two points' worth between these faces, and this is body text a
 * parent reads aloud. `xHeightOf` measures it the same way — a page rendered
 * with its verse replaced by a single `x` — so "smaller size" and "smaller
 * type" stay separate facts.
 *
 * ## What this file is not
 *
 * It is not a switch and it does not know which face is right. `versesIn`
 * returns a **copy** of the book, the cover's own title slot is deliberately
 * out of reach (`versePages` excludes it), and nothing here writes a template.
 * `docs/verse-face.md` is the decision; `npm run verse-faces` is the pictures
 * and the table; `test/verse-face.test.ts` holds the committed face to it.
 *
 * Node only — it rasterises.
 */

import { pageFillFor, pageSequence, pageTemplateFor, pagesWithSlot, storyTextFor } from "./derive";
import { SLOT } from "./slots";
import { nameLimit } from "./name";
import { lineHeightOf, maxLinesOf } from "../template/defaults";
import { renderPrintPixels, renderPrintSvg } from "../render/raster";
import { FACES, familyOf } from "../render/fonts";
import { atRenderWidth } from "./title-fit";
import type { BookFill, BookPage, BookTemplate } from "./types";
import type { Box, TextSlotLayer } from "../template/types";

export class NoVerseSlot extends Error {}

/**
 * The render width a caller can afford a pair of per page per face.
 *
 * Eleven pages by eleven faces is a hundred and twenty-one measurements and the
 * question is only where ink lands, which the page answers at any size — the
 * answer comes back in the template's own units either way. 1200 across a
 * 612 pt canvas is 1.96 pixels to the point, so a point of overflow is two
 * pixels; `RENDER_SLACK` is the one point of antialiasing that buys.
 *
 * The same number `test/book-verses.test.ts` renders at, deliberately: two
 * files measuring the same book at two resolutions would be two answers.
 */
export const VERSE_RENDER_WIDTH = 1200;

/** One point, which is two pixels at `VERSE_RENDER_WIDTH` and the outermost stem's edge. */
export const RENDER_SLACK = 1;

/**
 * **Every page that carries one of the captain's verses, and not the cover.**
 *
 * The cover's title is a `storyText` slot too — `templates/first-book.ts`
 * § `cover` — so `pagesWithSlot(book, SLOT.story)` returns it first and a
 * caller that forgot would re-face the cover while measuring the interior. The
 * cover is its own question with its own module, its own command and its own
 * decision (`docs/cover-face.md`), and the two must not move together by
 * accident. `pageSequence` puts the cover at index 0 — `./derive.ts`
 * § `pageSequence` — which is the fact this filters on.
 */
export function versePages(book: BookTemplate): number[] {
  return pagesWithSlot(book, SLOT.story).filter((index) => index !== 0);
}

/** The verse slot on one page. */
export function verseSlotOn(page: BookPage): TextSlotLayer {
  const layer = (page.layers ?? []).find(
    (l): l is TextSlotLayer => l.kind === "textSlot" && l.slot === SLOT.story,
  );
  if (!layer) throw new NoVerseSlot(`${page.id} carries no ${SLOT.story} slot`);
  return layer;
}

/**
 * **The verses in another face, and nothing else changed — cover included.**
 *
 * One field of one layer per page. The frames, the type size, the baselines,
 * the line height and the character limits are the captain's and stay exactly
 * as declared, which is what makes the comparison a comparison: every candidate
 * is measured in the box the book already has, not in a box drawn to flatter
 * it. And **the cover is not touched**, so a sheet of interior spreads cannot
 * quietly become a statement about the title.
 */
export function versesIn(book: BookTemplate, font: string, size?: number): BookTemplate {
  const ids = new Set(versePages(book).map((index) => pageSequence(book)[index].id));
  const reface = <T extends BookPage>(page: T): T =>
    ids.has(page.id)
      ? {
          ...page,
          layers: (page.layers ?? []).map((l) =>
            "slot" in l && l.slot === SLOT.story
              ? { ...l, font, ...(size === undefined ? {} : { size }) }
              : l,
          ),
        }
      : page;
  return { ...book, pages: book.pages.map(reface) };
}

/** The same book with one page's verse taken away — the other half of the difference. */
function withoutVerse(book: BookTemplate, index: number): BookTemplate {
  const id = pageSequence(book)[index].id;
  const strip = <T extends BookPage>(page: T): T =>
    page.id === id
      ? { ...page, layers: (page.layers ?? []).filter((l) => !("slot" in l) || l.slot !== SLOT.story) }
      : page;
  return { ...book, pages: book.pages.map(strip) };
}

/** One render, as the two numbers a measurement needs of it. */
export interface Pixels {
  rgba: Uint8Array;
  width: number;
}

async function pixelsOf(book: BookTemplate, fill: BookFill, index: number): Promise<Pixels> {
  const chosen = { lookId: fill.lookId };
  const { rgba, width } = await renderPrintPixels(
    pageTemplateFor(book, index, chosen),
    pageFillFor(book, index, fill),
  );
  return { rgba, width };
}

/**
 * **What the difference between two renders says: where the ink is, and how
 * much of it there is.**
 *
 * The box is the fit. The `area` is the other question a change of face raises
 * and the only one a picture answers faster than a number: the *colour* of a
 * block of type — how much of the page the letters actually cover. A display
 * face chosen for three words on a cover puts far more ink on a page than a
 * text face does at the same size, and "too heavy for body text" is otherwise
 * a matter of taste rather than a measurement.
 *
 * **The coverage is exact rather than a pixel count, and that matters here.**
 * A rasteriser antialiases, so a glyph's edge pixels differ from the blank by a
 * fraction; counting every differing pixel equally would report a thin face
 * with a lot of edge as heavier than a solid one, which is the opposite of the
 * truth. What it computes instead is the alpha the compositor used: a rendered
 * pixel is `blank * (1 - a) + ink * a`, so summing the channel differences and
 * dividing by the channel differences between the **declared ink colour** and
 * the blank pixel recovers `a` per pixel. The sum of those is real coverage, in
 * square points, comparable between two faces and between two pages.
 *
 * Pixels where the artwork underneath is already the ink's own colour are
 * skipped: there the denominator is near zero and the alpha is unrecoverable.
 * They are a vanishing share of a page of dark type on a soft band — the band
 * `docs/look-upload-contract.md` § 3 reserves is light by contract — and
 * counting them with a guessed alpha would be inventing ink.
 */
interface Difference {
  box: Box;
  /** Ink coverage in square points — a face's colour, comparable between faces. */
  area: number;
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * The ink one layer put on a page, out of the two renders — public because the
 * command measures a face it cannot register as well.
 *
 * `npm run verse-faces` draws a reference tile in a face that is **not** in
 * `lib/render/fonts.ts`, with its own rasteriser, for the reason
 * `scripts/cover-faces.ts` § `referencePng` gives: a face the print path must
 * not be able to reach cannot be registered to measure it. That tile is worth
 * nothing unless its numbers are the same numbers as every other row's, so the
 * arithmetic lives here and both callers use it rather than each having a
 * version. `./title-fit.ts` keeps its own copy of the box half deliberately —
 * it answers a different question about a different page and shares no caller.
 */
export function inkBetween(
  printed: Pixels,
  blank: Pixels,
  scale: number,
  colour: string,
): Difference | null {
  const [ir, ig, ib] = channels(colour);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let covered = 0;
  const pixels = Math.min(printed.rgba.length, blank.rgba.length) >> 2;
  for (let p = 0; p < pixels; p++) {
    const i = p << 2;
    const dr = printed.rgba[i] - blank.rgba[i];
    const dg = printed.rgba[i + 1] - blank.rgba[i + 1];
    const db = printed.rgba[i + 2] - blank.rgba[i + 2];
    if (dr === 0 && dg === 0 && db === 0) continue;

    const x = p % printed.width;
    const y = (p - x) / printed.width;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;

    const reach =
      Math.abs(ir - blank.rgba[i]) + Math.abs(ig - blank.rgba[i + 1]) + Math.abs(ib - blank.rgba[i + 2]);
    // 24 of 765 — under one channel step a side, where the alpha is noise.
    if (reach < 24) continue;
    covered += Math.min(1, (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / reach);
  }
  if (x1 < x0) return null;
  return {
    box: { x: x0 / scale, y: y0 / scale, width: (x1 + 1 - x0) / scale, height: (y1 + 1 - y0) / scale },
    area: covered / (scale * scale),
  };
}

/**
 * **The eleven pages with no words on them, which every face shares.**
 *
 * The blank half of the difference does not depend on the face — the slot is
 * gone from it — so measuring eleven faces the naive way would rasterise the
 * same eleven photographic spreads eleven times over for nothing. Held by a
 * caller and passed in rather than memoised in this module, because a memo
 * keyed on a book is a memo that is wrong the moment a caller brings a book
 * with different artwork bound over it, which is exactly what
 * `lib/artwork/release.ts` § `bookAsDelivered` hands out.
 */
export interface VerseBlanks {
  /** The render width these were made at. A fit measured against another is not a fit. */
  width: number;
  pages: Map<number, Pixels>;
}

export async function verseBlanksFor(
  book: BookTemplate,
  fill: BookFill,
  options: { renderWidth?: number } = {},
): Promise<VerseBlanks> {
  const width = options.renderWidth ?? VERSE_RENDER_WIDTH;
  const sized = atRenderWidth(book, width);
  const pages = new Map<number, Pixels>();
  for (const index of versePages(book)) {
    pages.set(index, await pixelsOf(withoutVerse(sized, index), fill, index));
  }
  return { width, pages };
}

/**
 * Where one page's verse put ink, in page units.
 *
 * `null` means the verse drew nothing at all, and every caller treats that as a
 * failure rather than as the roomiest possible fit — the pairing
 * `test/pixels.ts` asks for, built into the measurement instead of written
 * beside it. It is also the shape the one deployment bug this takes seriously
 * would have: `lib/render/raster.ts` runs with `loadSystemFonts: false` and
 * matches on the family **inside** the file, so a face the rasteriser cannot
 * find draws no type and throws nothing.
 */
export async function verseInkOn(
  book: BookTemplate,
  fill: BookFill,
  index: number,
  options: { renderWidth?: number; blanks?: VerseBlanks } = {},
): Promise<Box | null> {
  return (await verseDifferenceOn(book, fill, index, options))?.box ?? null;
}

/** The same measurement with the ink's coverage beside its box. */
export async function verseDifferenceOn(
  book: BookTemplate,
  fill: BookFill,
  index: number,
  options: { renderWidth?: number; blanks?: VerseBlanks } = {},
): Promise<Difference | null> {
  const width = options.blanks?.width ?? options.renderWidth ?? VERSE_RENDER_WIDTH;
  const sized = atRenderWidth(book, width);
  const printed = await pixelsOf(sized, fill, index);
  const blank = options.blanks?.pages.get(index) ?? (await pixelsOf(withoutVerse(sized, index), fill, index));
  const slot = verseSlotOn(pageSequence(book)[index]);
  return inkBetween(printed, blank, printed.width / book.page.canvas.width, slot.colour);
}

/**
 * **The two SVGs a measurement is a difference of, for a caller holding its own
 * rasteriser.**
 *
 * `npm run verse-faces` has to show the captain one face that is not in
 * `lib/render/fonts.ts` and must not be — a lighter weight of Baloo 2, which
 * exists only as a variable file nothing in this repository vendors. It draws
 * that tile by re-pointing the family in the SVG the renderer produced and
 * handing it to a local `Resvg`, exactly as `scripts/cover-faces.ts`
 * § `referencePng` draws More Sugar, and the property that matters is the same
 * one: there is no route from a template or from `lib/book/print.ts` to that
 * file.
 *
 * What it gets from here is the **same two renders** every other row is
 * measured from, so the reference row's numbers are comparable rather than
 * merely adjacent. The renderer is still single — `renderPrintSvg` is what
 * both callers get — and what differs is only which font files the caller then
 * feeds the rasteriser, which is a fact about the rasteriser and not an option
 * on the render.
 */
export async function versePairSvg(
  book: BookTemplate,
  fill: BookFill,
  index: number,
  options: { renderWidth?: number } = {},
): Promise<{ printed: string; blank: string; scale: number; colour: string; family: string }> {
  const width = options.renderWidth ?? VERSE_RENDER_WIDTH;
  const sized = atRenderWidth(book, width);
  const bare = withoutVerse(sized, index);
  const chosen = { lookId: fill.lookId };
  const slot = verseSlotOn(pageSequence(book)[index]);
  const [printed, blank] = await Promise.all([
    renderPrintSvg(pageTemplateFor(sized, index, chosen), pageFillFor(sized, index, fill)),
    renderPrintSvg(pageTemplateFor(bare, index, chosen), pageFillFor(bare, index, fill)),
  ]);
  return {
    printed,
    blank,
    scale: width / book.page.canvas.width,
    colour: slot.colour,
    family: familyOf(slot.font),
  };
}

/**
 * Did the ink reach the rendered page's own edge?
 *
 * Half a pixel of tolerance at the render width, because the question is
 * whether the rasteriser had anywhere left to put the stem and antialiasing
 * puts the outermost one exactly there.
 */
function isClipped(ink: Box, book: BookTemplate): boolean {
  const edge = 0.5;
  return (
    ink.x <= edge ||
    ink.y <= edge ||
    ink.x + ink.width >= book.page.canvas.width - edge ||
    ink.y + ink.height >= book.page.canvas.height - edge
  );
}

/** One page's verse, measured against that page's own box. */
export interface PageInk {
  index: number;
  id: string;
  /** The slot's own frame, which is the captain's hand-marked position for this page. */
  frame: Box;
  /** The ink's box. `null` means the page drew no words. */
  ink: Box | null;
  /**
   * The verse's ink coverage on this page, in square points — the *colour* of
   * the block, which is what "too heavy for body text" means when it is a
   * measurement rather than an opinion. `0` where nothing drew.
   */
  area: number;
  /** Points of the box's width still unused. Negative is an overflow. */
  spare: number;
  /** Points the ink reaches **above** this page's own box. Negative is clearance. */
  above: number;
  /** Points the ink reaches **below** this page's own box. Negative is clearance. */
  below: number;
  /**
   * **True when the ink ran off the rendered page**, so `spare` is a floor
   * rather than a figure.
   *
   * The measurement is a difference between two renders of a page, so a line
   * set wider than the page cannot be measured past its edge —
   * `lib/book/title-fit.ts` § `TitleFit.clipped` is the same fact about the
   * cover. At the declared 15 pt no vendored face comes near it: the widest
   * overflow in the lineup is 41 pt past a 500 pt box centred on a 612 pt
   * page. It arrives the moment a caller measures at a size the slot was not
   * drawn for, which is what the controls in `test/verse-face.test.ts` do.
   *
   * Reported rather than corrected: the only honest fix would be to measure a
   * page this book does not have. `needsSize` is unaffected, because it
   * re-measures at smaller sizes where there is nothing to clip.
   */
  clipped: boolean;
}

export interface VerseFit {
  /** The face key the verses were set in. */
  font: string;
  /** The family the rasteriser was asked for, which is the registry's. */
  family: string;
  /** The type size measured at, which is the slot's unless overridden. */
  size: number;
  /** The line height, which is the slot's and does not move with the face. */
  lineHeight: number;
  /**
   * The box every verse shares — one width, one height, one left edge.
   * `test/book-verses.test.ts` § *"moved the box and did not resize it"* is why
   * this is one box and not eleven: the captain moved the frame per page and
   * resized nothing, so `y` is the only field that varies and it is reported
   * per page in `pages`.
   */
  box: { x: number; width: number; height: number };
  /** The name every number is for — the longest the form accepts. */
  name: string;
  pages: PageInk[];
  /** The page whose verse set widest, which is the one the fit is decided on. */
  widest: PageInk;
  /** Points of the box's width unused on that page. Negative is an overflow. */
  spare: number;
  /**
   * The vertical allowance `test/book-verses.test.ts` grants the box, in points
   * — `size * 0.3 + 1`, an ascent above the first baseline and a descent below
   * the last in these faces, plus one pixel of antialiasing. Read from the same
   * expression rather than restated, so the two files cannot drift.
   */
  tolerance: number;
  /**
   * **The ink the verses put on a page, in square points, averaged over the
   * eleven — the face's colour at this size.**
   *
   * The number to compare between faces rather than to read alone. It is the
   * answer to the question the fit table cannot reach: Baloo 2 ExtraBold fits
   * the box at 15 pt with room to spare, and whether it should is a question
   * about how much of a parent's reading page is covered in letters.
   */
  area: number;
  /** The worst reach above any page's box, in points. */
  above: number;
  /** The worst reach below any page's box, in points. */
  below: number;
  /** The page ids whose ink leaves the box vertically by more than `tolerance`. */
  tallOn: string[];
  /**
   * True when any page's ink ran off the rendered page, so `spare` is a floor.
   *
   * It also means `widest` is **not** reliably the widest-setting page: every
   * clipped page measures exactly the page's width, so which of them compares
   * worst is arbitrary. That is why `needsSize` below asks about all of them
   * rather than about this one.
   */
  clipped: boolean;
  /** The page ids that drew no words at all — a face the rasteriser cannot find. */
  drewNothing: string[];
  /**
   * **True while every one of the captain's hand-marked positions still holds.**
   *
   * The marks are `frame.y` and a face cannot move one: `lib/render/svg.ts`
   * § `drawTextSlot` sets absolute baselines. So this is false only when a
   * face's ascent or descent pushes the ink out of the 160 pt box the marks
   * were drawn around — which would mean re-marking, not re-deriving.
   */
  marksHold: boolean;
  /**
   * The size this face would need for the widest line to fit the box, when it
   * does not. `null` when it fits as declared.
   *
   * Derived from the measurement and then **re-measured** at that size, so it
   * is an answer and not a proportion.
   */
  needsSize: number | null;
}

/**
 * **What the verse is actually set on, measured — because the one assumption
 * every "is this too heavy?" argument rests on turns out not to hold.**
 *
 * The captain's generation brief reserves the middle of the left page and asks
 * for it *"soft, out of focus, light in value and low in detail so dark verse
 * text can be added later"* — `docs/look-upload-contract.md` § 3. Read that and
 * the ink column above reads as a pure cost: a light ground takes thin type
 * fine, so more ink is just more weight on a page a parent reads aloud.
 *
 * **The delivered band is not light.** On girl-02's night spread it is
 * mid-value lavender, and the committed face reads thin on it. So ink is
 * contrast as well as weight, and which of the two it is depends on a number
 * that belongs to the *artwork* rather than to the face — one number per page
 * per look, the same for every candidate.
 *
 * This is that number: the WCAG contrast ratio between the slot's declared ink
 * colour and the mean of the pixels the verse is set over. It costs nothing to
 * compute, because the pixels are the **blank** half of the difference every
 * fit is already measured from — the page with the words taken off is exactly
 * a picture of what they will be set on.
 *
 * A mean and not a worst pixel: the question is what the block of type sits on,
 * and a single dark detail in the corner of the band is a different question
 * (`docs/cover-face.md` § The corner carries the title records that one being
 * judged by eye, for the reason this cannot be a gate either). **Nothing
 * refuses a book on this.** It is reported so a face is chosen against the
 * ground it will actually be printed on.
 */
export interface BandContrast {
  id: string;
  /** The mean luminance of the band, 0–1, as WCAG relative luminance. */
  luminance: number;
  /** The ratio against the slot's ink. 1 is invisible; 4.5 is the usual floor. */
  ratio: number;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function bandContrastIn(book: BookTemplate, blanks: VerseBlanks): BandContrast[] {
  const scale = blanks.width / book.page.canvas.width;
  const out: BandContrast[] = [];
  for (const [index, pixels] of blanks.pages) {
    const page = pageSequence(book)[index];
    const slot = verseSlotOn(page);
    const x0 = Math.round(slot.frame.x * scale);
    const x1 = Math.round((slot.frame.x + slot.frame.width) * scale);
    const y0 = Math.round(slot.frame.y * scale);
    const y1 = Math.round((slot.frame.y + slot.frame.height) * scale);
    let sum = 0;
    let total = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * pixels.width + x) << 2;
        sum += relativeLuminance(pixels.rgba[i], pixels.rgba[i + 1], pixels.rgba[i + 2]);
        total++;
      }
    }
    const luminance = total === 0 ? 0 : sum / total;
    const [r, g, b] = channels(slot.colour);
    const ink = relativeLuminance(r, g, b);
    const lighter = Math.max(luminance, ink);
    const darker = Math.min(luminance, ink);
    out.push({ id: page.id, luminance, ratio: (lighter + 0.05) / (darker + 0.05) });
  }
  return out;
}

/**
 * The longest verse in the book, in characters, with this name in it.
 *
 * Reported rather than used: it is the number `templates/first-book.ts`
 * § `storySlot` sizes `maxChars` against, and a reader comparing this file's
 * table with that docblock should not have to count. Counted off the book.
 */
export function longestVerse(book: BookTemplate, name: string): { id: string; chars: number } {
  let worst = { id: "", chars: -1 };
  for (const index of versePages(book)) {
    const page = pageSequence(book)[index];
    const chars = storyTextFor(page, name).length;
    if (chars > worst.chars) worst = { id: page.id, chars };
  }
  return worst;
}

/**
 * **The x-height of one face at one size, in points, measured as ink.**
 *
 * The fit table's sizes are not comparable on their own: a face that needs
 * 13 pt where Special Elite has 15 may still set *larger* type, because an
 * x-height is anywhere between 0.4 and 0.56 of the size across these faces.
 * This is body text a parent reads aloud at arm's length from a child, so the
 * letter a reader actually resolves is the lowercase one — which is why the
 * measurement is an `x` and not an `M`.
 *
 * Measured by the same difference as everything else here: one verse page with
 * its story replaced by a single `x`, against the same page with the slot gone.
 * No font table is parsed, which keeps `lib/render/family.ts`'s rule — a name
 * table reader and nothing else — intact.
 *
 * **It is an ink height and not the `OS/2` figure, and the difference shows up
 * between two weights of one family.** A bounding box includes the stroke's own
 * overshoot and its antialiased edge, so a heavier weight of the same drawing
 * measures a little taller: Baloo 2 reads 0.521 em at ExtraBold and 0.476 em at
 * its text weight, which is the ink and not a redesigned lowercase. That is the
 * right number anyway — what a reader resolves at arm's length is the mark on
 * the paper — but it means the column compares *faces as printed* and should
 * not be read as a font's declared metric. Half a point of it is weight.
 */
export async function xHeightOf(
  book: BookTemplate,
  fill: BookFill,
  font: string,
  size: number,
  options: { renderWidth?: number } = {},
): Promise<number | null> {
  const index = versePages(book)[0];
  const id = pageSequence(book)[index].id;
  const refaced = versesIn(book, font, size);
  const one = <T extends BookPage>(page: T): T => (page.id === id ? { ...page, story: "x" } : page);
  const single: BookTemplate = { ...refaced, pages: refaced.pages.map(one) };
  const ink = await verseInkOn(single, fill, index, { renderWidth: options.renderWidth });
  return ink === null ? null : ink.height;
}

/**
 * **Measure one face across every verse in the book, at the longest name the
 * form takes.**
 *
 * The name is `nameLimit`'s worth of `M` by default — `validateBook`'s own
 * worst case and `test/book-verses.test.ts`'s, deliberately the same one,
 * because a file that measured a *different* worst case would be answering a
 * question the build never asks. The caller passes a real name instead when it
 * wants the picture the captain would actually see.
 */
export async function verseFitFor(
  book: BookTemplate,
  fill: BookFill,
  font: string,
  options: { size?: number; renderWidth?: number; name?: string; blanks?: VerseBlanks } = {},
): Promise<VerseFit> {
  const indices = versePages(book);
  const first = verseSlotOn(pageSequence(book)[indices[0]]);
  const size = options.size ?? first.size;
  // An absent name is not an empty one: `pageFillFor` leaves `{name}` standing
  // when there is nothing to put there, so a measurement taken with no name
  // would be a measurement of the token. The default is the worst case the
  // build itself uses.
  const name = options.name ?? "M".repeat(nameLimit(book));
  const width = options.blanks?.width ?? options.renderWidth ?? VERSE_RENDER_WIDTH;
  const refaced = versesIn(book, font, size);
  const filled: BookFill = { ...fill, name };

  const pages: PageInk[] = [];
  for (const index of indices) {
    const page = pageSequence(refaced)[index];
    const slot = verseSlotOn(page);
    const got = await verseDifferenceOn(refaced, filled, index, {
      renderWidth: width,
      blanks: options.blanks,
    });
    const ink = got?.box ?? null;
    pages.push({
      index,
      id: page.id,
      frame: slot.frame,
      ink,
      area: got?.area ?? 0,
      spare: ink === null ? -Infinity : slot.frame.width - ink.width,
      above: ink === null ? -Infinity : slot.frame.y - ink.y,
      below: ink === null ? -Infinity : ink.y + ink.height - (slot.frame.y + slot.frame.height),
      clipped: ink !== null && isClipped(ink, book),
    });
  }

  const widest = pages.reduce((worst, p) => (p.spare < worst.spare ? p : worst));
  const clipped = pages.some((p) => p.clipped);
  const area = pages.reduce((sum, p) => sum + p.area, 0) / pages.length;
  const tolerance = size * 0.3 + 1;
  const above = Math.max(...pages.map((p) => p.above));
  const below = Math.max(...pages.map((p) => p.below));
  const drewNothing = pages.filter((p) => p.ink === null).map((p) => p.id);
  const tallOn = pages
    .filter((p) => p.ink !== null && (p.above > tolerance || p.below > tolerance))
    .map((p) => p.id);

  /**
   * **What size it would take, when the declared one overflows — searched, and
   * asked of every page rather than of one.**
   *
   * Two mistakes are easy here and both were made before this comment existed.
   *
   * The first is to divide: advances scale with the size, so a line 541 pt wide
   * at 15 pt is 500 pt wide at 13.86. What breaks it is clipping — a line set
   * wider than the page cannot be measured past the page's edge, so the width
   * the proportion is computed from is a floor and the size it returns is too
   * large. A bisection over the integer sizes is exact in about four renders
   * and is unaffected by clipping at either end, because ink width is monotonic
   * in the type size.
   *
   * The second is to bisect **the widest page**, which is what this did until
   * it was measured against a known answer. Once pages clip they all measure
   * exactly the page's width, so `widest` among them is whichever the reduce
   * happened to see first — and bisecting that page returned 17 pt for a book
   * whose true answer is 15, because a shorter verse fits 500 pt at a size the
   * longest one does not. The predicate is therefore *"no page overflows"*,
   * which is the question a type size actually has to answer, and it
   * short-circuits on the first page that fails — so a size that is far too
   * large costs one render and only a size that nearly fits costs eleven.
   *
   * The answer is the largest size at which the whole book fits, re-measured
   * at that size rather than inferred.
   */
  let needsSize: number | null = null;
  if (widest.ink !== null && widest.spare < 0) {
    const fitsAt = async (candidate: number) => {
      const sized = versesIn(book, font, candidate);
      for (const index of indices) {
        const ink = await verseInkOn(sized, filled, index, {
          renderWidth: width,
          blanks: options.blanks,
        });
        if (ink === null || ink.width > first.frame.width) return false;
      }
      return true;
    };
    let low = 1;
    let high = Math.floor(size);
    // `low` is held at a size known to fit and `high` at one known not to, so
    // the answer is `low` when they meet. One point is assumed to fit rather
    // than measured: a size no face fits at is a book with no type on it, and
    // `drewNothing` is where that is reported.
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (await fitsAt(mid)) low = mid;
      else high = mid;
    }
    needsSize = low;
  }

  return {
    font,
    family: FACES[font]?.family ?? familyOf(font),
    size,
    lineHeight: lineHeightOf({ ...first, size }),
    box: { x: first.frame.x, width: first.frame.width, height: first.frame.height },
    name,
    pages,
    widest,
    spare: widest.spare,
    area,
    clipped,
    tolerance,
    above,
    below,
    tallOn,
    drewNothing,
    marksHold: drewNothing.length === 0 && tallOn.length === 0,
    needsSize,
  };
}

/**
 * How many lines a verse is, counted off the copy rather than stated.
 *
 * Six — a heading, a blank line and four rhyming lines — and the blank one is a
 * line, which is the fact the box's height is derived from. Exported so the
 * command's table can say *"six lines at 26 pt is 156 pt in a 160 pt box"*
 * without a second place in the repository saying six.
 */
export function verseLines(book: BookTemplate): { lines: number; allowed: number } {
  const index = versePages(book)[0];
  const page = pageSequence(book)[index];
  return { lines: (page.story ?? "").split("\n").length, allowed: maxLinesOf(verseSlotOn(page)) };
}
