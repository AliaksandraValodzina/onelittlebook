/**
 * **Which pages hold a place for the child, and on which path.**
 *
 * `lib/render/ghost.ts` draws the ghost and carries the argument for what it
 * looks like and why it is a render option rather than a layer. This decides
 * *when* there is one, and it makes exactly one decision:
 *
 * **The chosen-look path never has a ghost.** The buyer picked one of twelve
 * babies, the artwork for that baby exists, it is lovely, and showing it is
 * the strongest selling point this shop has. A placeholder over a finished
 * picture would be a worse preview of a better product.
 *
 * **The photo path always has one, on the pages the child is on.** There the
 * child does not exist yet: the captain takes the clean pages into an image
 * tool after the order (`./artwork.ts`), so at the moment the buyer is reading
 * the book nobody has drawn their little one.
 *
 * ## Which pages those are, derived rather than listed
 *
 * The page's own artwork says, and it says it differently in the two states
 * the project's artwork can be in — which is not a special case, it is the two
 * states having different facts available:
 *
 * **A drawn placeholder page** declares `babyless` (`lib/book/types.ts`
 * § `SceneSpec`). A babyless page carries no child in any look — it is the
 * opening spread, which is the one spread identical across all twelve looks and
 * therefore the one that carries the buyer's photograph and dedication. No
 * child, no ghost. Every other drawn page has one.
 *
 * **An uploaded page** is an opaque PNG and declares nothing, so the answer
 * comes from the shape of the artwork: each of the captain's twelve spreads is
 * one 2.000:1 scene cut down the middle with the baby on the right-hand half,
 * plus the cover. `rightHandPages` counts those out of `spreads()`.
 *
 * ## The one thing this cannot do, stated
 *
 * On a **drawn** page the placeholder baby is removed before the ghost is
 * drawn — `babyless` is forced on the derived artwork, so there is no look's
 * baby underneath to show through. On an **uploaded** page the child is in the
 * pixels and cannot be taken out, so the ghost is drawn over it and the glow's
 * inner stop is opaque enough to cover a figure of the declared size. That is
 * a real limit rather than a solved problem: it is why
 * `docs/look-upload-contract.md` would need a babyless variant of each spread
 * if the photo path were ever to sell at volume, and it is written here so the
 * next person reads it before believing the preview is perfect.
 */

import type { PageTemplate } from "../template/types";
import { GHOST_CAPTION, type GhostOptions } from "../render/ghost";
import { isCover, pageSequence, pageTemplateFor, rightHandPages, type Chosen } from "./derive";
import type { BookTemplate } from "./types";

/** Where the placeholder figure stands when a page does not say. `SceneSpec`'s own defaults. */
const WHERE = { x: 0.5, y: 0.6 };
const SIZE = 0.34;

/**
 * Does the child appear on this page?
 *
 * Exported because the clean-artwork download and this answer the same question
 * from opposite ends, and a test asserts they agree about the cover.
 */
export function pageCarriesTheChild(book: BookTemplate, index: number): boolean {
  const page = pageSequence(book)[index];
  if (!page) return false;
  if (page.art.kind === "drawn") return page.art.scene.babyless !== true;
  return isCover(index) || rightHandPages(book).includes(index);
}

/**
 * The ghost for one page of the photo path, or null where the child is not.
 *
 * The position and the size come from the page's own scene when it has one, so
 * the ghost stands where the baby would have stood — the scenes alternate sides
 * to keep the figure out of the gutter (`SceneSpec.babyAt`) and a ghost pinned
 * to the middle of every page would walk straight into it.
 */
export function ghostFor(book: BookTemplate, index: number): GhostOptions | null {
  if (!pageCarriesTheChild(book, index)) return null;
  const page = pageSequence(book)[index];
  const scene = page.art.kind === "drawn" ? page.art.scene : null;
  return {
    at: scene?.babyAt ?? WHERE,
    size: scene?.babySize ?? SIZE,
    caption: GHOST_CAPTION,
  };
}

/**
 * One page of the photo path's preview: the template to draw, and the ghost to
 * draw over it.
 *
 * **The only producer of a ghost in this codebase, and the preview is its only
 * caller.** Nothing on the print path imports this module — `test/ghost.test.ts`
 * asserts that by reading the files — and even if something did, `renderPrintSvg`
 * takes no options object to pass the second half of this result to.
 */
export function ghostPreviewOf(
  book: BookTemplate,
  index: number,
  chosen: Chosen,
): { template: PageTemplate; ghost: GhostOptions | null } {
  const ghost = ghostFor(book, index);
  const template = pageTemplateFor(book, index, chosen);
  if (!ghost) return { template, ghost: null };

  // The look's own baby is taken **out** of a drawn page before the ghost goes
  // on, so there is no second child showing through a placeholder that exists
  // precisely because there is not one yet. A babyless page is an ordinary page
  // of this format, so nothing downstream has to know why this one is.
  return {
    template: {
      ...template,
      layers: template.layers.map((layer) =>
        layer.kind === "art" && layer.art.kind === "scene"
          ? { ...layer, art: { ...layer.art, babyless: true } }
          : layer,
      ),
    },
    ghost,
  };
}
