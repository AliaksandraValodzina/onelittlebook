"use client";

/**
 * **The whole book, every page, with no wall in front of it.**
 *
 * `kn-whole-book-preview` measured thirteen sellers and this is the strongest
 * single finding in the research: Wonderbly shows **36 of 36 pages**
 * personalised, unwatermarked, with no account; Hooray Heroes shows 29 of 29.
 * The photo-book sellers who *do* wall their editor behind an email address
 * wall it because the editor *is* the funnel there. This is a narrative book,
 * so it is in the first group, and **there is no watermark, no account and no
 * wall anywhere in this component.**
 *
 * **One page or two, and two is the default on a wide screen.** A bound book
 * shows two pages at a time and the artwork is drawn as spreads; one page at a
 * time is what a phone can actually show. `spreads()` in `lib/book/derive.ts`
 * does the pairing, so the preview, the gutter rule in the upload contract and
 * the print file all agree about which page faces which.
 *
 * **Two pages are drawn as one open book.** No gap, one container, the page
 * shadow on its outside edges, and a soft gutter over the join — the captain's
 * generation brief composes every spread around that fold (*"no face, hand or
 * key object within 8% of it"*), so drawing it is what makes the quiet middle
 * read as deliberate rather than as an empty gap between two pictures.
 * `lib/book/fold.ts` is the fold, and carries the argument for why it is a
 * stylesheet rule the renderer has never heard of rather than a render option
 * the print path declines to pass: a gutter shadow in a print file is a grey
 * smear down the middle of a real book. **One page has no fold**, and that
 * branch is the panel it always was.
 *
 * **The controls are on the pages they affect** — see `./Controls.tsx`, which
 * asks the template which page carries which slot rather than being told.
 *
 * **`photoPath` draws the other route's preview.** On the photo path the child
 * is drawn by hand after the order, so their place is held by a glowing
 * silhouette — `lib/book/ghost.ts`. It is a prop rather than a thing read off
 * the order because the funnel does not sell that route yet; the affordance
 * that turns it on is `/preview?character=photograph`, exactly as
 * `/my-forever?guides=1` turns on the trim guides, and like the guides it is a
 * screen affordance that the print path cannot express.
 */

import { useState } from "react";
import {
  pageSequence,
  pageWithSlot,
  spreads as spreadsOf,
} from "../../lib/book/derive";
import { SLOT } from "../../lib/book/slots";
import { SPREAD_FOLD, foldBand } from "../../lib/book/fold";
import BookPage from "./BookPage";
import Bar from "./Bar";
import { DedicationControl, UpgradeControl } from "./Controls";
import { useBook } from "./BookProvider";

/** How a page is referred to out loud. The cover is not page zero to a buyer. */
function nameOf(id: string): string {
  return id === "cover" ? "Cover" : `Page ${Number(id.replace("page-", ""))}`;
}

export default function Preview({ photoPath = false }: { photoPath?: boolean }) {
  const { book } = useBook();
  const [two, setTwo] = useState(true);
  const sequence = pageSequence(book);
  const groups = two ? spreadsOf(book) : sequence.map((_, i) => [i]);

  const photoPage = pageWithSlot(book, SLOT.photo);
  const dedicationPage = pageWithSlot(book, SLOT.dedication);
  /**
   * Where the upgrade is offered: the group **after** the one the dedication is
   * on.
   *
   * "Offered exactly once" is therefore a property of mounting rather than a
   * flag the card checks — there is one group whose index is this, so there is
   * one card. The position is MyStoryTale's and it is the one thing worth
   * taking from them: after the dedication, before the cart.
   */
  const dedicationGroup = groups.findIndex((g) => g.includes(dedicationPage));
  const upgradeGroup = dedicationGroup >= 0 ? dedicationGroup + 1 : -1;

  /**
   * The controls this group of pages carries, if any.
   *
   * The photograph and the dedication are one panel on one page — see
   * `./Controls.tsx` — so the photo page is asked about only to assert that the
   * template still agrees with that. If somebody moves the photo slot to
   * another spread the panel stays with the dedication and the note below says
   * so, rather than the photograph silently losing its control.
   */
  const controlsFor = (group: number[], index: number) => (
    <>
      {group.includes(dedicationPage) ? <DedicationControl pageIndex={photoPage} /> : null}
      {group.includes(photoPage) && !group.includes(dedicationPage) ? (
        <p className="mt-3 text-sm opacity-70">
          The photograph for this page is set with the dedication, earlier in the book.
        </p>
      ) : null}
      {index === upgradeGroup ? <UpgradeControl /> : null}
    </>
  );

  /** The pages of one group, drawn by the one renderer. */
  const leaves = (group: number[]) =>
    group.map((index) => (
      <BookPage
        key={index}
        index={index}
        label={nameOf(sequence[index].id)}
        photoPath={photoPath}
      />
    ));

  return (
    <section aria-label="Your whole book">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="dsp text-2xl">Your whole book</h2>
        {/* The artefact's own toggle, in the approved theme. */}
        <div className="toggle" role="group" aria-label="How many pages at a time">
          <button type="button" onClick={() => setTwo(false)} aria-pressed={!two} data-testid="one-page">
            One page
          </button>
          <button type="button" onClick={() => setTwo(true)} aria-pressed={two} data-testid="two-page">
            Two pages
          </button>
        </div>
      </div>

      <p className="mt-1 text-sm opacity-65">
        {photoPath ? (
          <>
            All {sequence.length} pages. Your little one is drawn by hand after you order, so their
            place is held on every page they are on. No watermark, no account.
          </>
        ) : (
          <>All {sequence.length} pages, exactly as they will print. No watermark, no account.</>
        )}
      </p>

      <ol className="mt-5 space-y-8" data-testid="pages">
        {groups.map((group, index) => (
          <li key={group.join("-")}>
            {group.length === 2 ? (
              /*
                **Two pages are one open book.** One container, the page shadow
                on its outside edges, the two leaves meeting with no gap, and
                the gutter laid over the join — `lib/book/fold.ts` for why that
                last one is a stylesheet rule and not anything the renderer has
                heard of, and `app/shop.css` § the open book for the gradient.
              */
              <div className={SPREAD_FOLD.open}>
                <div className={SPREAD_FOLD.leaves}>{leaves(group)}</div>
                <div
                  className={SPREAD_FOLD.crease}
                  style={{ width: foldBand() }}
                  aria-hidden="true"
                />
              </div>
            ) : (
              /* A single page has no fold. This is the panel it always was. */
              <div className="grid grid-cols-1 gap-1 overflow-hidden rounded-xl shadow-xl shadow-black/15">
                {leaves(group)}
              </div>
            )}
            <p className="mt-1.5 text-[0.72rem] uppercase tracking-wide opacity-50">
              {group.map((i) => nameOf(sequence[i].id)).join(" · ")}
            </p>
            {controlsFor(group, index)}
          </li>
        ))}
      </ol>

      <Bar />
    </section>
  );
}
