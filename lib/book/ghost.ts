/**
 * **Which pages hold a place for the child, and on which path.**
 *
 * `lib/render/ghost.ts` draws the ghost and carries the argument for what it
 * looks like and why it is a render option rather than a layer. This decides
 * *when* there is one, and it makes exactly one decision:
 *
 * **The chosen-look path never has a ghost.** The buyer picked one of the
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
 * **The question here is narrower than "is the child on this page", and the
 * difference is the whole reason this is a separate answer from
 * `pagesCarryingTheChild`.** A ghost is one figure of a declared size standing
 * in one place, so this asks where such a figure *belongs* — which is where
 * the artwork puts the child, not everywhere a part of them appears. The page's
 * own artwork says, and it says it differently in the two states the project's
 * artwork can be in:
 *
 * **A drawn placeholder page** declares `babyless` (`lib/book/types.ts`
 * § `SceneSpec`) when the placeholder draws no figure on it — the opening
 * spread, which has no child in it in any look, and every verse page, where the
 * words are drawn in the band the figure would have stood in. Nothing to hold a
 * place for, no ghost. Every other drawn page has one.
 *
 * **An uploaded page** is an opaque PNG and declares nothing, so the answer
 * comes from the shape of the artwork: each of the captain's twelve spreads is
 * one 2.000:1 scene cut down the middle with the child standing on the
 * right-hand half, plus the cover. `rightHandPages` counts those out of
 * `spreads()`.
 *
 * **The two states now exist in one book**, which is why `ghostBelongsOn`
 * takes a look: one look has artwork and the rest are still drawn, so
 * the same page answers differently for different babies.
 *
 * ## What the golden halves changed, and what they did not
 *
 * The captain delivered a **golden sparkle silhouette of each spread** on
 * 10 November (`docs/artwork.md` § 3). Where there is one it is bound to the
 * page as `BookPage.ghost` and replaces the page's artwork in the preview —
 * the child is *in* that picture, drawn as light, so nothing is painted over
 * anything. `GhostOptions.figure` carries that to the renderer, which then
 * draws the caption and no silhouette.
 *
 * ## The two things this still cannot do, stated
 *
 * On a **drawn** page the placeholder baby is removed before the ghost is
 * drawn — `babyless` is forced on the derived artwork, so there is no look's
 * baby underneath to show through. On an uploaded page **with no golden half**
 * the child is in the pixels and cannot be taken out, so the ghost is drawn
 * over it and the glow's inner stop is opaque enough to cover a figure of the
 * declared size. That is a real limit rather than a solved problem: it is why
 * `docs/look-upload-contract.md` would need a babyless variant of each spread
 * if the photo path were ever to sell at volume, and it is written here so the
 * next person reads it before believing the preview is perfect. The golden
 * halves close it for the one look that has them.
 *
 * The second is the other half of the same page. **The child's limbs cross the
 * fold onto the left-hand page of eleven of the twelve delivered spreads** —
 * measured, in `lib/book/artwork.ts` § Which pages a character swap has to
 * touch — and that page gets no ghost, so on the photo path a reader sees the
 * stock look's arm beside the held place for their own child. Drawing a second
 * silhouette there would be worse: there is no golden left half to use, the
 * only thing available is a white figure of the declared size, and the one
 * place on that page it would fit is the band the verse is printed in. So this
 * is left as it is and written down. It is the preview only — the **print**
 * file regenerates both halves, which is what `pagesCarryingTheChild` is for.
 */

import type { PageTemplate } from "../template/types";
import { GHOST_CAPTION, type GhostOptions } from "../render/ghost";
import { isCover, pageSequence, pageTemplateFor, rightHandPages, type Chosen } from "./derive";
import type { BookTemplate } from "./types";

/** Where the placeholder figure stands when a page does not say. `SceneSpec`'s own defaults. */
const WHERE = { x: 0.5, y: 0.6 };
const SIZE = 0.34;

/**
 * Does a held place for the child belong on this page?
 *
 * **Not "is the child on this page"** — `pagesCarryingTheChild` is that
 * question and answers it for more pages than this one does, for the reason
 * this file's docblock gives. Exported because the golden-half import asks the
 * same narrower question from the other end (`lib/artwork/prepare.ts`): a
 * spread whose figure is nowhere has no ghost half to store.
 */
export function ghostBelongsOn(book: BookTemplate, index: number, lookId?: string): boolean {
  const page = pageSequence(book)[index];
  if (!page) return false;

  // **A page with no child in it in any look, first**, because it is the one
  // case the artwork's shape gets wrong on its own: `page-002` is a right-hand
  // page *and* has nobody on it, since the opening spread is the one the
  // buyer's photograph and dedication sit on. Read off the page rather than off
  // the scene, which `bookWithReleaseArtwork` drops once every look is
  // delivered.
  if (page.childless === true) return false;
  // Then the placeholder's own answer: a drawn page declaring `babyless` draws
  // no figure, so there is no place to hold — the verse pages, where the words
  // are in the band a figure would have stood in.
  if (page.art.scene?.babyless === true) return false;
  if (page.art.kind === "drawn") return true;

  // **The answer differs by look, now that it can.** For a look the captain has
  // delivered, the page is an opaque PNG that declares nothing, so the answer
  // comes from the shape of their artwork: one 2.000:1 scene a spread with the
  // child standing on the right-hand half, plus the cover. For a look still
  // being drawn the page falls back to its scene. The left-hand half of a
  // delivered spread does carry part of the child and still gets no ghost —
  // this file's docblock § The two things this still cannot do says why that is
  // the lesser of the two wrongs.
  const uploaded = lookId
    ? page.art.byLook[lookId] !== undefined
    : Object.keys(page.art.byLook).length > 0;
  if (uploaded) return isCover(index) || rightHandPages(book).includes(index);
  return page.art.scene !== undefined || isCover(index) || rightHandPages(book).includes(index);
}

/**
 * The ghost for one page of the photo path, or null where the child is not.
 *
 * The position and the size come from the page's own scene when it has one, so
 * the ghost stands where the baby would have stood — the scenes alternate sides
 * to keep the figure out of the gutter (`SceneSpec.babyAt`) and a ghost pinned
 * to the middle of every page would walk straight into it.
 */
export function ghostFor(book: BookTemplate, index: number, lookId?: string): GhostOptions | null {
  if (!ghostBelongsOn(book, index, lookId)) return null;
  const page = pageSequence(book)[index];
  const scene = page.art.scene ?? null;
  return {
    at: scene?.babyAt ?? WHERE,
    size: scene?.babySize ?? SIZE,
    caption: GHOST_CAPTION,
    // **The captain's golden half, where there is one.** The figure is then
    // already in the artwork — a gold sparkle child with the bib, the party hat
    // and the spoon left solid — so the renderer draws the caption and nothing
    // else. `BookPage.ghost` is why that artwork can never be printed and
    // `./preview-art.ts` is how the type system enforces it.
    ...(page.ghost ? { figure: "supplied" as const } : {}),
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
  const ghost = ghostFor(book, index, chosen.lookId);
  const template = pageTemplateFor(book, index, chosen);
  if (!ghost) return { template, ghost: null };

  const supplied = pageSequence(book)[index].ghost;
  if (supplied) {
    /**
     * **The captain's golden half replaces the page's artwork, underneath
     * everything.**
     *
     * Not drawn *over* the page, which is what the silhouette does: the ghost
     * option is painted above every layer, and a full-page picture up there
     * would cover the story line and the child's name — the words the buyer is
     * reading the preview to check. So it goes in as the bottom layer, where
     * the page's own artwork was, and the only thing left for the option to
     * draw is the caption.
     *
     * This is **the one conversion from a `PreviewAsset` to an `AssetRef` in
     * the codebase**, and it is in this module because this module is the one
     * the print path may not import — `test/ghost.test.ts` reads the import
     * graph off disk and `renderPrintSvg` has no argument a ghost could arrive
     * in anyway.
     */
    const art = template.layers[0];
    return {
      template: {
        ...template,
        layers: [
          {
            id: "art",
            kind: "image",
            frame: art.frame,
            asset: {
              sha256: supplied.digest,
              mime: supplied.mime,
              px: supplied.px,
              label: supplied.label ?? `${template.id} ghost`,
            },
          },
          ...template.layers.slice(1),
        ],
      },
      ghost,
    };
  }

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
