/**
 * **Step six: the whole book, every page, with no wall in front of it.**
 *
 * `./_book/Preview.tsx` carries the argument for what is on it; this is the
 * route, now wearing the shop's chrome so that a buyer who arrives here from
 * the flow is still in the same shop.
 *
 * **The book it draws comes entirely from an order in `localStorage`**, so the
 * parts that draw it — `BookProvider`, `./_book/Preview.tsx`,
 * `./_book/Downloads.tsx` — are client components, exactly as on `/basket`.
 * The route itself is a **server** component, which it had to become when the
 * shop gained markets: the chosen market is a cookie, only the server has it
 * during the first render, and a client page would have shown the default
 * currency in the masthead and in the upgrade card and then corrected itself —
 * which is a flash of the wrong *price* on the screen before the basket.
 * Nothing about the book's own rendering changed: that still happens on the
 * client, after mount, from storage.
 *
 * There is no gate. A visitor who arrives here with no order sees the book with
 * no name in it and a bar saying what is still to do, which is the honest state
 * and is recoverable in one tap — a redirect would be a wall, and the whole
 * point of this screen is that there is not one.
 *
 * **It is the artefact's sixth screen, drawn long rather than in a card.** The
 * artefact shows the spreads inside a scrolling panel because it had to fit the
 * screen on a review page beside five others. A page of a book is the largest
 * thing in this product and the one the buyer is being asked to approve; giving
 * it the window instead of a 330-pixel box inside one is the same screen with
 * the constraint of the artefact removed.
 */

import { FIRST_BOOK } from "../../templates/first-book";
import { WHEN_THEY_WERE_SMALL, pathOf } from "../../lib/shop/shelf";
import { previous, stepFor } from "../../lib/shop/steps";
import BookProvider from "../_book/BookProvider";
import Preview from "../_book/Preview";
import Downloads from "../_book/Downloads";
import { Ribbon, ShopFooter, ShopNav } from "../_shop/Chrome";
import { currentMarket } from "../_shop/market";

/** A cookie read makes this per-request, like every other page of the shop. */
export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  const back = previous(stepFor("book")!.id);
  const market = await currentMarket();

  return (
    <>
      <Ribbon market={market} />
      <ShopNav market={market} basketCount={1} />
      <main className="mx-auto w-full max-w-[46rem] px-4 py-6 sm:px-6 sm:py-10">
        <p className="crumb">
          <a href={back ? back.path : pathOf(WHEN_THEY_WERE_SMALL)}>
            ← {back ? back.title : WHEN_THEY_WERE_SMALL.book.name}
          </a>
        </p>

        <BookProvider book={FIRST_BOOK} market={market}>
          <div className="mt-4">
            <Preview />
          </div>
          <Downloads />
        </BookProvider>
      </main>
      <ShopFooter />
    </>
  );
}
