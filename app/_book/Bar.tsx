"use client";

/**
 * **The persistent bar: what is done, what it costs, and the one way on.**
 *
 * It tracks *what has been supplied* rather than *where you are*, because there
 * is no step two to be on — the whole book is already in front of them. A tick
 * per ask and a single `Continue` is the shape all three sellers studied
 * arrived at, and the research is explicit that the bar is how a buyer knows
 * the book is finished without being told it is not.
 *
 * **The optional asks are ticked, not gated.** `ASKS` marks which are required
 * and `isComplete` reads the same table, so the photograph and the from-line
 * show as done when they are done and never stop `Continue`. A nice-to-have
 * that blocks the button is a reason to leave.
 *
 * **The cover colourway used to live here** and was removed on 17 November.
 * Blush, Sage and Oat were a real choice while the cover was a drawn ground;
 * once every look had a delivered cover wrap — one per look, not three — the
 * buttons could not change a pixel. A control that cannot visibly change
 * anything is worse than no control: the buyer presses it, nothing happens, and
 * they start wondering what else on the page is pretend. So the bar is the
 * checklist and the way on, and nothing else. `BookTemplate.coverColour` is
 * where the colour went.
 *
 * **It says what is missing rather than failing silently.** `BuyButton` on the
 * single page already records why: a disabled button with no explanation is the
 * commonest way a checkout loses a sale that was already made — the buyer
 * presses it, nothing happens, and they leave believing the site is broken.
 *
 * `Continue` goes to **the basket**, which is step seven of the approved flow —
 * see `lib/shop/steps.ts`. The spelling check and the till are after it:
 * `app/_book/Basket.tsx` renders `./Confirm.tsx` and `./till.ts` makes the one
 * request there is. The bar used to own both, and it stopped owning them the
 * moment there was a screen between the book and the money.
 */

import { ASKS } from "../../lib/book/slots";
import { editionOf, priceLabel } from "../../lib/book/editions";
import { outstanding } from "../../lib/book/order";
import { stepFor } from "../../lib/shop/steps";
import { useBook } from "./BookProvider";

export default function Bar() {
  const { book, market, order, done, ready, persistence, flush } = useBook();
  const missing = outstanding(order, book);
  const edition = editionOf(order.editionId);
  const basket = stepFor("basket")!;

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-10 border-t border-current/15 bg-[var(--ground)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" data-testid="progress">
        {ASKS.map((ask) => (
          <li
            key={ask.id}
            data-testid={`ask-${ask.id}`}
            data-done={done[ask.id] ? "yes" : "no"}
            data-required={ask.required ? "yes" : "no"}
            className={`flex items-center gap-1.5 text-sm ${done[ask.id] ? "" : "opacity-55"}`}
          >
            <span
              aria-hidden="true"
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] ${
                done[ask.id] ? "bg-[var(--green)] text-white" : "border-2 border-current/40"
              }`}
            >
              {done[ask.id] ? "\u2713" : ""}
            </span>
            <span className="sr-only">{done[ask.id] ? "done:" : "still to do:"}</span>
            {ask.label}
            {ask.required ? null : <span className="opacity-60"> (optional)</span>}
          </li>
        ))}
      </ul>

      {/*
        **The way on is a link when it goes somewhere and a dead button when it
        does not.** A link works with no JavaScript, is announced as navigation
        and can be opened in a new tab; a disabled button that says why is
        better than a link that goes nowhere — `BuyButton` on the single page
        records why a silent disabled control loses a sale that was already
        made. `flush` writes the order before the page changes, because the save
        is debounced and a navigation outruns it.
      */}
      {ready ? (
        <a
          href={basket.path}
          onClick={flush}
          data-testid="continue"
          className="btn wide mt-3"
        >
          {`Continue \u2014 ${edition.label.toLowerCase()}, ${priceLabel(edition, market)}`}
        </a>
      ) : (
        <span
          aria-disabled="true"
          data-testid="continue"
          className="btn wide off mt-3"
        >
          Finish the book first
        </span>
      )}

      <p className="mt-1.5 text-center text-[0.78rem] opacity-70" role="status">
        {ready
          ? "Your basket next, then one screen to check the spelling. Nothing is charged yet."
          : `Still to do: ${missing.join(", ")}.`}
      </p>

      {persistence && !persistence.saved ? (
        <p className="mt-1 text-center text-[0.72rem] text-[#8e1c33]">
          {persistence.reason === "quota" && persistence.wordsKept
            ? "This browser would not keep the photograph — the words are saved, the photograph is only in this tab."
            : "This browser will not remember the book. It is still here until you close the tab."}
        </p>
      ) : null}
    </div>
  );
}
