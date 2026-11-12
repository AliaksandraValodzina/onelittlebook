"use client";

/**
 * **One page of the book, drawn by the one renderer.**
 *
 * It calls `renderPageSvg` with a page template derived from the book and
 * inlines the string — the same call, on the same template, with the same fill
 * that `lib/book/print.ts` hands to the rasteriser. The only thing that differs
 * is how a picture is addressed: a `data:` URI the tab already holds for the
 * buyer's photograph, and for the captain's artwork **the screen-sized copy of
 * the page rather than the 3600 px master**. Both of those are an *address*,
 * not a drawing, which is the seam `renderPageSvg`'s own docblock names —
 * `lib/assets/screen.ts` carries the argument for why resolving a different
 * resolution here leaves "one renderer" exactly as true as it was, and the four
 * things that stop a derivative reaching a print file.
 *
 * So **the preview the buyer approves and the file that goes to the press
 * cannot disagree**, and that is not a claim about care — there is no second
 * drawing path for them to disagree across.
 *
 * It is memoised on the values that change what is drawn. Twenty-five pages
 * re-rendered on every keystroke of a dedication would be twenty-five string
 * builds per character; memoised, only the one page the dedication is on
 * rebuilds.
 *
 * ## The resting state, and why it is not a spinner
 *
 * `drawn={false}` is a page whose turn has not come: the preview draws the
 * first spread and runs ahead of the reader (`lib/book/reveal.ts`), because
 * twenty-four pages fetched at once is what made the preview slow. An undrawn
 * page still **occupies its own square** — the aspect ratio is reserved by the
 * same container either way, so nothing on the screen moves when the picture
 * arrives — and it says which page it is. A stated fact over an indeterminate
 * whirl is this shop's convention everywhere else and it is the right one here
 * too: the half-painted spread in the captain's screenshot read as *broken*,
 * and a square that names itself reads as *not yet*.
 *
 * It is a **prop** and not state read from a context, so every other caller —
 * the chooser's tile, the chooser's panel, the confirmation — is unaffected and
 * draws immediately, which is what they should do.
 */

import { useMemo } from "react";
import { pageFillFor, pageTemplateFor } from "../../lib/book/derive";
import { ghostPreviewOf } from "../../lib/book/ghost";
import { restingNote } from "../../lib/book/reveal";
import { renderPageSvg } from "../../lib/render/svg";
import { screenHrefIn } from "../../lib/assets/screen";
import type { AssetRef } from "../../lib/template/types";
import { useBook } from "./BookProvider";

/**
 * The cream the page sits on before it is painted, and the colour of the words
 * on it.
 *
 * `app/shop.css` is the approved artefacts' stylesheet and `lib/theme.ts` holds
 * the palette; this is the page's own background, which the renderer draws as
 * `canvas.background` the moment it draws anything.
 */
const RESTING = "bg-[#F3E7DA]";

export default function BookPage({
  index,
  label,
  className = "",
  photoPath = false,
  drawn = true,
}: {
  index: number;
  /** For a test and for a tooltip. The SVG carries its own `aria-label`. */
  label?: string;
  className?: string;
  /**
   * Draw this page as the **photo path** shows it: the child's place held by a
   * glowing silhouette rather than a baby.
   *
   * A prop and not something read from the order, because the photo path is not
   * something the funnel sells yet — `/preview?character=photograph` is the
   * screen affordance that turns it on, the same arrangement
   * `/my-forever?guides=1` has. `lib/book/ghost.ts` decides which pages get one
   * and `lib/render/ghost.ts` says why a ghost cannot reach a print file.
   */
  photoPath?: boolean;
  /**
   * Draw the page's picture now, or reserve its square and wait.
   *
   * `true` by default: everything that shows a single page wants it drawn, and
   * the only caller with a reason to wait is the whole-book preview. See this
   * file's docblock § The resting state.
   */
  drawn?: boolean;
}) {
  const { book, assets, screen, order, fill } = useBook();
  const dataUrl = order.photo?.dataUrl;
  const digest = order.photo?.asset.sha256;

  const svg = useMemo(() => {
    if (!drawn) return null;
    const chosen = { lookId: fill.lookId, coverId: fill.coverId };
    // One call for both paths. On the look path `ghost` is null and the
    // template is `pageTemplateFor`'s own, character for character.
    const page = photoPath
      ? ghostPreviewOf(book, index, chosen)
      : { template: pageTemplateFor(book, index, chosen), ghost: null };
    // The buyer's own photograph is bytes this tab is holding and has no URL
    // anywhere; everything else is the delivered artwork, which answers from
    // the CDN — the screen-sized copy where the store has one, the master where
    // it has not — and from the asset route where the store published no
    // address at all.
    const fromStore = screenHrefIn(screen, assets);
    const href = (ref: AssetRef) =>
      ref.sha256 === digest && dataUrl ? dataUrl : fromStore(ref);
    return renderPageSvg(page.template, pageFillFor(book, index, fill), {
      href,
      ...(page.ghost ? { ghost: page.ghost } : {}),
    });
  }, [book, assets, screen, index, fill, dataUrl, digest, photoPath, drawn]);

  // One container for both states, so the square is reserved either way and
  // the arrival of a picture moves nothing on the page.
  const box = `relative aspect-square w-full overflow-hidden ${RESTING} ${className}`;

  if (svg === null) {
    return (
      <div
        className={`${box} grid place-items-center`}
        data-page={index}
        data-page-label={label}
        data-drawn="false"
      >
        <p className="px-4 text-center text-[0.7rem] uppercase tracking-[0.18em] text-[#6B5B4D] opacity-55">
          {restingNote(label ?? `Page ${index}`)}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${box} [&>svg]:block [&>svg]:h-auto [&>svg]:w-full`}
      // The SVG is built here from a template and a fill; nothing in it comes
      // from a network response, and the only buyer-supplied string in it —
      // their name and dedication — goes through `esc` in the renderer.
      dangerouslySetInnerHTML={{ __html: svg }}
      data-page={index}
      data-page-label={label}
      data-drawn="true"
    />
  );
}
