"use client";

/**
 * **One page of the book, drawn by the one renderer.**
 *
 * It calls `renderPageSvg` with a page template derived from the book and
 * inlines the string — the same call, on the same template, with the same fill
 * that `lib/book/print.ts` hands to the rasteriser. The only thing that differs
 * is how a photograph is addressed: a `data:` URI the tab already holds, rather
 * than one the rasteriser builds. That is an *address*, not a drawing, which is
 * the seam `renderPageSvg`'s own docblock names.
 *
 * So **the preview the buyer approves and the file that goes to the press
 * cannot disagree**, and that is not a claim about care — there is no second
 * drawing path for them to disagree across.
 *
 * It is memoised on the values that change what is drawn. Twenty-five pages
 * re-rendered on every keystroke of a dedication would be twenty-five string
 * builds per character; memoised, only the one page the dedication is on
 * rebuilds.
 */

import { useMemo } from "react";
import { pageFillFor, pageTemplateFor } from "../../lib/book/derive";
import { ghostPreviewOf } from "../../lib/book/ghost";
import { renderPageSvg } from "../../lib/render/svg";
import { hrefIn } from "../../lib/assets/address";
import type { AssetRef } from "../../lib/template/types";
import { useBook } from "./BookProvider";

export default function BookPage({
  index,
  label,
  className = "",
  photoPath = false,
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
}) {
  const { book, assets, order, fill } = useBook();
  const dataUrl = order.photo?.dataUrl;
  const digest = order.photo?.asset.sha256;

  const svg = useMemo(() => {
    const chosen = { lookId: fill.lookId, coverId: fill.coverId };
    // One call for both paths. On the look path `ghost` is null and the
    // template is `pageTemplateFor`'s own, character for character.
    const page = photoPath
      ? ghostPreviewOf(book, index, chosen)
      : { template: pageTemplateFor(book, index, chosen), ghost: null };
    // The buyer's own photograph is bytes this tab is holding and has no URL
    // anywhere; everything else is the delivered artwork, which answers from
    // the CDN when the store published an address for it and from the asset
    // route when it did not.
    const fromStore = hrefIn(assets);
    const href = (ref: AssetRef) =>
      ref.sha256 === digest && dataUrl ? dataUrl : fromStore(ref);
    return renderPageSvg(page.template, pageFillFor(book, index, fill), {
      href,
      ...(page.ghost ? { ghost: page.ghost } : {}),
    });
  }, [book, assets, index, fill, dataUrl, digest, photoPath]);

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden bg-[#F3E7DA] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`}
      // The SVG is built here from a template and a fill; nothing in it comes
      // from a network response, and the only buyer-supplied string in it —
      // their name and dedication — goes through `esc` in the renderer.
      dangerouslySetInnerHTML={{ __html: svg }}
      data-page={index}
      data-page-label={label}
    />
  );
}
