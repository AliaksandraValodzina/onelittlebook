/**
 * **How wide the cover's title actually sets, measured out of the pixels.**
 *
 * `templates/first-book.ts` § `cover` sizes the title from two numbers: the
 * slot's `maxCharsPerLine` of sixteen, which is what the build enforces, and a
 * **width in points** written into the docblock beside it — *"fourteen
 * characters of 44 pt Indie Flower is 374 pt measured against the vendored
 * TTF"*. The first is checked on every build. The second was measured once, by
 * hand, in one face, and nothing has re-measured it since.
 *
 * That was fine while there was one face. It stops being fine the moment the
 * face is a question: a character count says nothing about a width, and a heavy
 * rounded display face is far wider than a typewriter face at the same size.
 * A count of sixteen that holds fourteen characters of Special Elite holds
 * eleven of something else, and the way that failure arrives is a printed cover
 * with the child's name running off both sides of the panel.
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
import { maxCharsPerLineOf } from "../template/defaults";
import { renderPrintPixels } from "../render/raster";
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
 * **The ground the title is printed on, which is a wider bound than its box.**
 *
 * The cover sets the title in a cream panel — a `shape` layer — and the slot's
 * frame sits inside it with room to spare. The two are different questions and
 * a comparison needs both: a name that leaves the *frame* has left the box the
 * captain drew for it, which is a design decision to take knowingly; a name
 * that leaves the *panel* is set on photography and is a defect. Found by
 * containment rather than by id, so re-drawing or renaming the panel moves this
 * with it, and `null` when a cover has no such ground at all.
 */
export function titlePanelOf(book: BookTemplate): Box | null {
  const frame = coverTitleSlot(book).frame;
  const holds = (box: Box) =>
    box.x <= frame.x &&
    box.y <= frame.y &&
    box.x + box.width >= frame.x + frame.width &&
    box.y + box.height >= frame.y + frame.height;
  const panel = (book.cover.layers ?? []).find((l) => l.kind === "shape" && holds(l.frame));
  return panel ? panel.frame : null;
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
  /** The cream panel the title is printed on, which is the wider bound. */
  panel: Box | null;
  /** The name every number below is for. */
  name: string;
  /** The ink's box at that name. `null` means no type was drawn. */
  ink: Box | null;
  /** Points of the frame's width still unused. Negative is an overflow. */
  spare: number;
  /**
   * Points of the **panel's** width still unused. Negative is a name set on
   * photography, which is the failure rather than the decision.
   */
  panelSpare: number;
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
  const panel = titlePanelOf(book);
  const size = options.size ?? slot.size;
  const across = maxCharsPerLineOf(slot);
  const limit = nameLimit(book);
  const name = options.name ?? "M".repeat(limit);
  const affordable = atRenderWidth(coverTitleIn(book, font, size), options.renderWidth ?? 1800);

  const inkAt = (text: string) => titleInkFor(affordable, fill, text);
  const ink = await inkAt(name);
  const spare = ink === null ? -Infinity : slot.frame.width - ink.width;
  const panelSpare = ink === null || panel === null ? -Infinity : panel.width - ink.width;

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

  return {
    font,
    family: FACES[font]?.family ?? familyOf(font),
    size,
    frame: slot.frame,
    panel,
    name,
    ink,
    spare,
    panelSpare,
    charactersSpare,
    countBindsFirst: ink !== null && spare >= 0 && charactersSpare >= across - name.length,
    needsSize,
  };
}
