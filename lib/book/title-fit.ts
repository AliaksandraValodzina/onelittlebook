/**
 * **How wide the cover's title actually sets, measured out of the pixels.**
 *
 * `templates/first-book.ts` § `cover` sizes the title from two numbers: the
 * slot's `maxCharsPerLine` of sixteen, which is what the build enforces, and a
 * **width in points** written into the docblock beside it. The first is checked
 * on every build. The second was, until this file existed, measured once by
 * hand in one face — and since 19 November it is the number that decides the
 * type size, because `templates/first-book.ts` § `TITLE_CORNER` sized the
 * title to a corner the captain drew rather than the other way round.
 *
 * That was fine while there was one face. It stops being fine the moment the
 * face is a question: a character count says nothing about a width, and a heavy
 * rounded display face is far wider than a typewriter face at the same size.
 * A count of sixteen that holds fourteen characters of Special Elite holds
 * eleven of something else, and the way that failure arrives is a printed cover
 * with the child's name running off both sides of the page.
 *
 * So this module answers the width question the way `test/book-verses.test.ts`
 * answers it for the verses, and for the same reason: **render the page twice,
 * once with the title and once with the slot taken out, and read the ink's own
 * bounding box out of the difference.** Every differing pixel is the title's,
 * exactly, which is what makes "it fits" a measurement rather than a tolerance
 * argument with a patterned cover underneath.
 *
 * It is in `lib/` rather than in a test because two callers need the same
 * answer: `test/cover-face.test.ts`, which holds the committed cover to it, and
 * `npm run cover-faces`, which prints it for every candidate face beside the
 * pictures the captain chooses from. Two measurements would be two answers.
 *
 * Node only — it rasterises.
 */

import { pageFillFor, pageTemplateFor } from "./derive";
import { SLOT } from "./slots";
import { nameLimit } from "./name";
import { maxCharsPerLineOf, safeBox } from "../template/defaults";
import { renderPrintPixels, renderPrintPng } from "../render/raster";
import { BookNotPrintable, printProblems } from "./print";
import { FACES, familyOf } from "../render/fonts";
import type { BookFill, BookTemplate } from "./types";
import type { Box, TextSlotLayer } from "../template/types";

export class NoCoverTitle extends Error {}

/** The cover's title slot, which is a `storyText` and not a name slot. */
export function coverTitleSlot(book: BookTemplate): TextSlotLayer {
  const layer = (book.cover.layers ?? []).find(
    (l): l is TextSlotLayer => l.kind === "textSlot" && l.slot === SLOT.story,
  );
  if (!layer) throw new NoCoverTitle(`${book.id} has no ${SLOT.story} slot on its cover`);
  return layer;
}

/**
 * The cover with its title set in another face, and **nothing else changed**.
 *
 * One field of one layer. The frame, the size, the baselines, the line height
 * and the character limits are the captain's and stay exactly as declared —
 * which is what makes the comparison a comparison: every candidate is measured
 * in the box the cover already has, not in a box drawn to flatter it.
 */
export function coverTitleIn(book: BookTemplate, font: string, size?: number): BookTemplate {
  const slot = coverTitleSlot(book);
  return {
    ...book,
    cover: {
      ...book.cover,
      layers: (book.cover.layers ?? []).map((l) =>
        l.id === slot.id ? { ...l, font, ...(size === undefined ? {} : { size }) } : l,
      ),
    },
  };
}

/**
 * **The outer bound on the title, which is wider than its own box.**
 *
 * There are two questions here and a comparison needs both. A name that leaves
 * the slot's **frame** has left the box the captain drew for it — a design
 * decision to take knowingly, not a defect. A name that leaves the **page's
 * safe area** is running at the cut line, and that is the defect: nobody sees
 * it until a book is in a box.
 *
 * This used to be the cream panel the title was set in, found by containment,
 * because a name that left *that* was set on photography. The panel went on
 * 19 November — `templates/first-book.ts` § `TITLE_CORNER` — and the title is
 * now set on the artwork by design, so the panel is no longer the bound. The
 * safe area is, and it is the book's own declaration rather than anything this
 * file knows: `lib/template/defaults.ts` § `safeBox` off `page.canvas`.
 */
export function titleBoundOf(book: BookTemplate): Box {
  return safeBox(book.page.canvas);
}

/** The same cover with the title taken away — the other half of the difference. */
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

/**
 * The cover at a size a caller can afford many renders of.
 *
 * Measuring a face costs one pair of renders per name length and there are ten
 * faces, so the declared 3600 would be minutes of CPU to answer a question
 * about where ink lands. The page answers it just as well smaller, and the
 * answer comes back in the template's own units either way — `changedBoxOf`
 * divides by the scale. A point is `width / canvas.width` pixels, so the
 * default below is three pixels to the point and the caller's tolerance is
 * stated in points.
 */
export function atRenderWidth(book: BookTemplate, width: number): BookTemplate {
  return {
    ...book,
    page: { ...book.page, print: { ...book.page.print, pixels: { width, height: width } } },
  };
}

/**
 * **The cover as a picture, at a width the caller can afford — which is not a
 * print file, and is why the print gate is run against the book and not
 * against the width.**
 *
 * `npm run cover-faces` draws every candidate face on every delivered cover,
 * so it wants about a hundred and fifty pictures and cannot want them at
 * 3600 px. It asked `renderBookPagePng` for them on an `atRenderWidth` book,
 * and that is the bug this function exists to make unrepeatable:
 * `renderBookPagePng` gates on `printProblems`, `atRenderWidth` rewrites
 * `page.print.pixels` — *the book's declared print size*, which is what
 * `docs/look-upload-contract.md` § 2 holds the captain's artwork to — and so
 * every delivered interior page became `art.wrongSize` against a 560 px
 * declaration that existed only inside the script. On 19 November that was
 * **336 refusals, fourteen looks by twenty-four interior pages**, and not one
 * sheet written. The cover itself was exempt (`./validate.ts` measures it
 * against the printed panel as a *floor*), which is exactly why a store
 * holding covers and no interior pages passed and the captain's did not.
 *
 * So the two numbers are separated here and stay separated:
 *
 *  - **What the book declares** is 3600 px and the gate is run against *that*,
 *    on the book as handed in. Nothing about the artwork contract is relaxed —
 *    a page that really is the wrong size is still refused, and the delivered
 *    sizes were never in disagreement: the book declares 3600 × 3600
 *    (`templates/first-book.ts` § `print`), `npm run artwork:upload` checks the
 *    same number, and the captain's pages are 3600 × 3600.
 *  - **What this render is produced at** is the caller's `width`, applied after
 *    the gate. A contact sheet is not a print file and must not be held to one;
 *    `renderPrintPng` is still the one renderer, exactly as `titleInkFor`
 *    above uses `renderPrintPixels` to measure at 1800.
 *
 * Index 0 is the cover — `./derive.ts` § `pageSequence` puts it first, which is
 * the assumption `titleInkFor` already makes.
 */
export async function coverPngAt(
  book: BookTemplate,
  fill: BookFill,
  width: number,
): Promise<Uint8Array> {
  const problems = printProblems(book, fill);
  if (problems.length) throw new BookNotPrintable(problems);

  const sized = width === book.page.print.pixels.width ? book : atRenderWidth(book, width);
  const chosen = { lookId: fill.lookId };
  const { png } = await renderPrintPng(
    pageTemplateFor(sized, 0, chosen),
    pageFillFor(sized, 0, fill),
  );
  return png;
}

/** The ink's bounding box, in page units, or `null` if the two renders agree. */
function changedBoxOf(
  a: { rgba: Uint8Array; width: number },
  b: { rgba: Uint8Array; width: number },
  scale: number,
): Box | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const pixels = Math.min(a.rgba.length, b.rgba.length) >> 2;
  for (let p = 0; p < pixels; p++) {
    const i = p << 2;
    if (a.rgba[i] === b.rgba[i] && a.rgba[i + 1] === b.rgba[i + 1] && a.rgba[i + 2] === b.rgba[i + 2]) {
      continue;
    }
    const x = p % a.width;
    const y = (p - x) / a.width;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < x0) return null;
  return {
    x: x0 / scale,
    y: y0 / scale,
    width: (x1 + 1 - x0) / scale,
    height: (y1 + 1 - y0) / scale,
  };
}

/**
 * Where the title's ink lands with this name in it, in page units.
 *
 * `null` means the title drew nothing at all, and every caller treats that as a
 * failure rather than as the roomiest possible fit — the pairing
 * `test/pixels.ts` asks for, built into the measurement instead of written
 * beside it. It is also the shape the one deployment bug this takes seriously
 * would have: a family the rasteriser cannot find draws no type and throws
 * nothing.
 */
export async function titleInkFor(
  book: BookTemplate,
  fill: BookFill,
  name: string,
): Promise<Box | null> {
  const withName: BookFill = { ...fill, name };
  const chosen = { lookId: fill.lookId };
  const [printed, blank] = await Promise.all([
    renderPrintPixels(pageTemplateFor(book, 0, chosen), pageFillFor(book, 0, withName)),
    renderPrintPixels(
      pageTemplateFor(coverWithoutTitle(book), 0, chosen),
      pageFillFor(coverWithoutTitle(book), 0, withName),
    ),
  ]);
  return changedBoxOf(printed, blank, printed.width / book.page.canvas.width);
}

export interface TitleFit {
  /** The face key the title was set in. */
  font: string;
  /** The family the rasteriser was asked for, which is the registry's. */
  family: string;
  /** The type size it was measured at, which is the slot's unless overridden. */
  size: number;
  /** The slot's own frame — what the title has to fit across. */
  frame: Box;
  /** The page's safe area, which is the wider bound the ink must stay inside. */
  bound: Box;
  /** The name every number below is for. */
  name: string;
  /** The ink's box at that name. `null` means no type was drawn. */
  ink: Box | null;
  /** Points of the frame's width still unused. Negative is an overflow. */
  spare: number;
  /**
   * The ink's narrowest margin to the **safe area**, in points — a distance
   * and not a width, because where the ink sits is the whole question here.
   * Negative is a name set at the cut line, which is the failure rather than
   * the decision.
   */
  boundSpare: number;
  /**
   * How many characters longer the name could be before the ink leaves the
   * frame — measured by lengthening it, not divided out of an average.
   *
   * Capped at the slot's `maxCharsPerLine`, because the renderer refuses a
   * longer line outright: when this equals the cap's own headroom the answer is
   * *"the character limit binds before the width does"*, which is the state the
   * cover has been in since it was drawn.
   */
  charactersSpare: number;
  /** True while the character limit, rather than the width, is the binding one. */
  countBindsFirst: boolean;
  /**
   * **True when the ink ran off the rendered page**, so `spare` and
   * `boundSpare` are floors rather than figures.
   *
   * The measurement is a difference between two renders of a page, so a line
   * set wider than the page cannot be measured past its edge — the widest
   * candidates here overflow by more than the numbers say. It did not arise
   * while the title was centred on a 612 pt page and nothing set wider than
   * that; `templates/first-book.ts` § `TITLE_CORNER` moved the slot's centre
   * to x 413, which halves the room a wide face has before it is cut off.
   * Reported rather than corrected: the only honest fix would be to measure a
   * page this book does not have. `needsSize` is unaffected — it re-renders at
   * the smaller size, where there is nothing to clip.
   */
  clipped: boolean;
  /**
   * The size this face would need for the title to fit, when it does not.
   *
   * `null` when it fits as declared. A face that only fits by shrinking the
   * type is a different design decision, and this is the number that decision
   * would be made with — derived from the measurement and then **re-measured**
   * at that size, so it is an answer and not a proportion.
   */
  needsSize: number | null;
}

/**
 * Measure one face in the cover's own box, at the longest name the form takes.
 *
 * The name is `nameLimit`'s worth of `M` — `validateBook`'s own worst case and
 * `test/book-verses.test.ts`'s, deliberately the same one, because a file that
 * measured a *different* worst case would be answering a question the build
 * never asks.
 */
export async function titleFitFor(
  book: BookTemplate,
  fill: BookFill,
  font: string,
  options: { size?: number; renderWidth?: number; name?: string } = {},
): Promise<TitleFit> {
  const slot = coverTitleSlot(book);
  const bound = titleBoundOf(book);
  const size = options.size ?? slot.size;
  const across = maxCharsPerLineOf(slot);
  const limit = nameLimit(book);
  const name = options.name ?? "M".repeat(limit);
  const affordable = atRenderWidth(coverTitleIn(book, font, size), options.renderWidth ?? 1800);

  const inkAt = (text: string) => titleInkFor(affordable, fill, text);
  const ink = await inkAt(name);
  const spare = ink === null ? -Infinity : slot.frame.width - ink.width;
  const boundSpare =
    ink === null
      ? -Infinity
      : Math.min(
          ink.x - bound.x,
          ink.y - bound.y,
          bound.x + bound.width - (ink.x + ink.width),
          bound.y + bound.height - (ink.y + ink.height),
        );

  /**
   * Lengthen the name a character at a time until the ink leaves the frame, or
   * until the renderer would refuse the line.
   *
   * Measured rather than divided out of a per-character average, because the
   * widest line is not always the name: in a narrow face *"Turned One"* is, and
   * a division would then report the room as zero.
   */
  let charactersSpare = 0;
  if (ink !== null && spare >= 0) {
    for (let length = name.length + 1; length <= across; length++) {
      const longer = await inkAt(name + "M".repeat(length - name.length));
      if (longer === null || longer.width > slot.frame.width) break;
      charactersSpare = length - name.length;
    }
  }

  /**
   * What size it would take, when the declared one overflows.
   *
   * Advances scale with the size, so the first guess is a proportion — and
   * then it is rendered again at that size, because a proportion is an
   * estimate and this file's whole argument is that estimates about type width
   * are how a cover ends up printed wrong. Rounded down to the point, and the
   * loop steps down while the re-measurement still disagrees.
   */
  let needsSize: number | null = null;
  if (ink !== null && spare < 0) {
    let guess = Math.floor((size * slot.frame.width) / ink.width);
    for (let tries = 0; tries < 6 && guess > 1; tries++) {
      const smaller = await titleInkFor(
        atRenderWidth(coverTitleIn(book, font, guess), options.renderWidth ?? 1800),
        fill,
        name,
      );
      if (smaller !== null && smaller.width <= slot.frame.width) break;
      guess -= 1;
    }
    needsSize = guess;
  }

  const edge = 0.5;
  const clipped =
    ink !== null &&
    (ink.x <= edge ||
      ink.y <= edge ||
      ink.x + ink.width >= book.page.canvas.width - edge ||
      ink.y + ink.height >= book.page.canvas.height - edge);

  return {
    font,
    family: FACES[font]?.family ?? familyOf(font),
    size,
    frame: slot.frame,
    bound,
    name,
    ink,
    spare,
    boundSpare,
    clipped,
    charactersSpare,
    countBindsFirst: ink !== null && spare >= 0 && charactersSpare >= across - name.length,
    needsSize,
  };
}
