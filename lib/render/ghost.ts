/**
 * **The ghost: a place held for a child who has not been drawn yet.**
 *
 * ## What it is for
 *
 * On the photo path the buyer's child does not exist as artwork at the moment
 * they are looking at the book. The captain takes the clean pages into an image
 * tool *after* the order (`lib/book/artwork.ts`), so the pages that carry the
 * child have nothing on them while the buyer is reading. A blank page there
 * reads as a broken preview; a stand-in baby reads as *the* baby, which is
 * worse — it is a promise about what the finished book looks like that nobody
 * made.
 *
 * So: a **soft white pearlescent glowing silhouette**, with the caption in
 * `GHOST_CAPTION` on the page. The captain compared three treatments — a gold
 * sparkle, this white glow, and a yellow felt figure — and the white glow won
 * for one reason: the felt figure reads as a *finished character*, and a buyer
 * who approves a book on the strength of a figure that is not the figure they
 * will get has been misled.
 *
 * **On the chosen-look path there is no ghost.** The artwork exists, it is
 * lovely, and showing it is the strongest selling point this shop has —
 * `lib/book/ghost.ts` is where that decision is made, and it is made by not
 * calling this.
 *
 * ## WHY THIS IS A RENDER OPTION AND NOT A LAYER
 *
 * **A ghost must be structurally incapable of reaching a print file.** A
 * printed book with a glowing void where the child should be is the worst
 * failure this product has: it is paid for, it is in a box, and it cannot be
 * undone.
 *
 * "Structurally" means there is no flag to get wrong. `CLAUDE.md` already
 * states the pattern for this exact situation — *"if the screen needs something
 * the print file must not have, it is an option on the render call that the
 * print path does not pass"* — and `guides` was the only example. The ghost is
 * the second. `renderPrintSvg` in `./raster.ts` takes a template, a fill and
 * the supplied bytes, and **there is no third argument**: the print path cannot
 * express a ghost, so no amount of wrong state anywhere else can produce one.
 *
 * That is why this is not an `Art` kind in `lib/template/types.ts`. A template
 * could declare one of those, and the print path draws whatever a template
 * declares — which would make "no ghost in a print file" a property of the
 * data rather than of the code, checked by a validator somebody has to
 * remember to keep. `test/ghost.test.ts` asserts the structural version: no
 * module on the print path so much as imports this file.
 *
 * **Nothing in here is seeded or random**, for `./random.ts`'s reason turned
 * around: a ghost never reaches a byte-identity test because it never reaches a
 * print file, and a wobbling placeholder would be movement on a page the buyer
 * is trying to read.
 */

import type { Canvas } from "../template/types";
import { r } from "../template/geometry";
import { familyOf } from "./fonts";
import type { Fragment } from "./decoration";

/**
 * The words on the page, exactly as the captain wrote them.
 *
 * One string, exported, so the preview, the caption and the test that proves
 * this cannot print are all talking about the same sentence.
 */
export const GHOST_CAPTION = "Your little one will appear here";

export interface GhostOptions {
  /** Where the child will stand, 0–1 of the canvas. */
  at: { x: number; y: number };
  /** The child's height, 0–1 of the canvas height. */
  size: number;
  /** The words under the figure. `GHOST_CAPTION` unless a caller says otherwise. */
  caption: string;
}

/**
 * The silhouette, the glow around it and the caption under it.
 *
 * The figure is drawn **fresh rather than taken from the placeholder baby** in
 * `./decoration.ts`, and that is the point: the placeholder baby is a stand-in
 * for *a look*, with a skin tone, hair and a babygro, and a white copy of it
 * would read as "your child will look like this one, in white". This is a
 * swaddled shape and a head with no features at all — the least that reads as
 * an infant and the most that refuses to read as a particular one.
 *
 * Pearlescent is three stops rather than flat white: a cool stop at the top
 * and a warm one at the foot, which is what gives a white shape the
 * mother-of-pearl shift. Flat white on a cream ground reads as a hole in the
 * page.
 *
 * **No filters**, which is `./decoration.ts`'s constraint and applies here for
 * a sharper reason: the preview draws twenty-five pages in a browser on every
 * keystroke of a dedication. The glow is three nested radial-gradient
 * ellipses, which is a sampled fill rather than a convolution.
 */
export function ghostOverlay(id: string, canvas: Canvas, ghost: GhostOptions): Fragment {
  const cx = canvas.width * clamp(ghost.at.x, 0, 1);
  const cy = canvas.height * clamp(ghost.at.y, 0, 1);
  const h = canvas.height * clamp(ghost.size, 0.05, 0.9);

  const defs =
    // The halo. It stops well short of 1 so the page's own artwork is still
    // visible around the figure: the buyer is being shown the scene their
    // child will be in, not a white disc where it was.
    `<radialGradient id="${id}-halo" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.72"/>` +
    `<stop offset="0.45" stop-color="#ffffff" stop-opacity="0.34"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
    `</radialGradient>` +
    // The pearl. Cool at the crown, warm at the foot.
    `<linearGradient id="${id}-pearl" x1="0" y1="0" x2="0.25" y2="1">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.98"/>` +
    `<stop offset="0.42" stop-color="#eef4ff" stop-opacity="0.94"/>` +
    `<stop offset="0.72" stop-color="#ffffff" stop-opacity="0.96"/>` +
    `<stop offset="1" stop-color="#fff2e8" stop-opacity="0.92"/>` +
    `</linearGradient>`;

  const halo = (scale: number, opacity: number) =>
    `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(h * 0.78 * scale)}" ry="${r(h * 0.92 * scale)}" ` +
    `fill="url(#${id}-halo)" opacity="${r(opacity)}"/>`;

  /**
   * The swaddled bundle: a cocoon that is **narrower at the top than the head
   * is wide**, widening to its waist and rounding off at the foot.
   *
   * The first two attempts at this read as a snowman, and the reason is worth
   * writing down: a head and a body of the same width, stacked, are two
   * circles. What makes a wrapped infant read as one is that the wrapping tucks
   * *in* under the chin before it flares, so the head sits on a narrower
   * shoulder rather than on an equal.
   */
  const bundle =
    `M ${r(cx - h * 0.13)} ${r(cy - h * 0.16)} ` +
    `C ${r(cx - h * 0.3)} ${r(cy + h * 0.02)} ${r(cx - h * 0.32)} ${r(cy + h * 0.34)} ` +
    `${r(cx)} ${r(cy + h * 0.5)} ` +
    `C ${r(cx + h * 0.32)} ${r(cy + h * 0.34)} ${r(cx + h * 0.3)} ${r(cy + h * 0.02)} ` +
    `${r(cx + h * 0.13)} ${r(cy - h * 0.16)} ` +
    `C ${r(cx + h * 0.06)} ${r(cy - h * 0.22)} ${r(cx - h * 0.06)} ${r(cy - h * 0.22)} ` +
    `${r(cx - h * 0.13)} ${r(cy - h * 0.16)} Z`;
  // A fifth of the figure's height, set high enough that the cocoon's tuck is
  // visible under it. The two together span `h` exactly, which is what the
  // page's declared `babySize` means.
  const headR = h * 0.2;
  const headY = cy - h * 0.3;

  /**
   * Drawn head **first**, then the bundle over it.
   *
   * Not a detail: the rim stroke is what gives the silhouette an edge against a
   * pale wash, and a rim drawn round the whole head after the bundle puts the
   * head's lower arc *across* the body — which is precisely the line that makes
   * two shapes read as two circles. Painting the bundle over the head leaves
   * only the chin and the cheeks showing, which is what a swaddled child looks
   * like.
   */
  const rim = `fill="url(#${id}-pearl)" stroke="#ffffff" stroke-opacity="0.9" stroke-width="${r(h * 0.016)}"`;

  const body =
    `<g>` +
    halo(1.45, 0.55) +
    halo(1.1, 0.85) +
    halo(0.8, 1) +
    `<circle cx="${r(cx)}" cy="${r(headY)}" r="${r(headR)}" ${rim}/>` +
    `<path d="${bundle}" ${rim}/>` +
    // Two hands at the widest part of the bundle. They are what stop the shape
    // reading as a bowling pin.
    `<g fill="url(#${id}-pearl)">` +
    `<circle cx="${r(cx - h * 0.28)}" cy="${r(cy + h * 0.1)}" r="${r(h * 0.06)}"/>` +
    `<circle cx="${r(cx + h * 0.28)}" cy="${r(cy + h * 0.1)}" r="${r(h * 0.06)}"/>` +
    `</g>` +
    caption(id, canvas, ghost, cx, cy + h * 0.5) +
    `</g>`;

  return { defs, body };
}

/**
 * The words, under the figure.
 *
 * On a quiet plate rather than straight onto the artwork: the pages this lands
 * on are full-bleed scenes, and a line of small type over one of them is
 * unreadable at preview size on half of them. The plate is the same cream the
 * book's own ground is, at low opacity, so it reads as part of the placeholder
 * rather than as a label stuck on the page.
 *
 * Nothing here measures the string and nothing needs to: this never prints, so
 * the one seam `./svg.ts` names — two shapers disagreeing about an advance
 * width — has no consequence. `maxChars` exists for the *printed* word, and a
 * caption that is a fraction wider in one browser than another is a caption.
 */
function caption(
  id: string,
  canvas: Canvas,
  ghost: GhostOptions,
  cx: number,
  y: number,
): string {
  const text = ghost.caption;
  if (!text) return "";
  const size = canvas.height * 0.028;
  const plateWidth = Math.min(canvas.width * 0.72, size * 0.62 * text.length + size * 2);
  const plateHeight = size * 2.2;
  const top = Math.min(y + size * 0.6, canvas.height - plateHeight - canvas.bleed);

  return (
    `<g data-ghost-caption="${id}">` +
    `<rect x="${r(cx - plateWidth / 2)}" y="${r(top)}" width="${r(plateWidth)}" ` +
    `height="${r(plateHeight)}" rx="${r(plateHeight / 2)}" fill="#FBF6EC" opacity="0.82"/>` +
    `<text x="${r(cx)}" y="${r(top + plateHeight * 0.64)}" ` +
    `font-family="${esc(familyOf("typewriter"))}" font-size="${r(size)}" ` +
    `fill="#6B5547" text-anchor="middle">${esc(text)}</text>` +
    `</g>`
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(Number.isFinite(v) ? v : lo, lo), hi);
}

/** The renderer's own escaping, kept here so this module stands alone. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
