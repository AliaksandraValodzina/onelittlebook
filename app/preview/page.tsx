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
import { deliveredBook } from "../../lib/artwork/release";
import { WHEN_THEY_WERE_SMALL, pathOf } from "../../lib/shop/shelf";
import { previous, stepFor } from "../../lib/shop/steps";
import BookProvider from "../_book/BookProvider";
import Preview from "../_book/Preview";
import Downloads from "../_book/Downloads";
import { Ribbon, ShopFooter, ShopNav } from "../_shop/Chrome";
import { currentMarket } from "../_shop/market";

/** A cookie read makes this per-request, like every other page of the shop. */
export const dynamic = "force-dynamic";

export default async function PreviewPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const back = previous(stepFor("book")!.id);
  const market = await currentMarket();
  /**
   * `?character=photograph` draws the **photo path's** preview: the child is
   * made by hand from the buyer's photograph after the order, so there is no
   * artwork of them yet and their place is held on every page they are on.
   *
   * A query parameter and not a step of the flow, exactly as
   * `/my-forever?guides=1` is: it is a screen affordance for a route the funnel
   * does not sell yet. `app/_make/HowScreen.tsx` still says plainly that the
   * photograph route is not here, because it is not — what is built is the
   * rendering, the clean-artwork download and the per-order artwork upload
   * behind it. `lib/render/ghost.ts` says why nothing this turns on can reach a
   * print file.
   */
  const photoPath = (await props.searchParams).character === "photograph";
  /**
   * The published book with this machine's artwork bound over it, which on the
   * photo path is also where the golden ghost halves come from: they ride on
   * the pages, as `BookPage.ghost`, which is a type the print path cannot
   * accept.
   */
  const { book, assets } = await deliveredBook(FIRST_BOOK);

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

        <BookProvider book={book} market={market} assets={assets}>
          <div className="mt-4">
            <Preview photoPath={photoPath} />
          </div>
          <Downloads />
        </BookProvider>
      </main>
      <ShopFooter />
    </>
  );
}
