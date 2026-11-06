/**
 * **Step six: the whole book, every page, with no wall in front of it.**
 *
 * `./_book/Preview.tsx` carries the argument for what is on it; this is the
 * route, now wearing the shop's chrome so that a buyer who arrives here from
 * the flow is still in the same shop.
 *
 * It is a **client page**, which is unusual in this repository and is the right
 * answer here for one reason: the book that is drawn depends entirely on an
 * order that lives in `localStorage`. A server render could only ever show an
 * empty book and then replace it, which is a flash of the wrong book on the one
 * screen the buyer is being asked to approve.
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

"use client";

import { FIRST_BOOK } from "../../templates/first-book";
import { WHEN_THEY_WERE_SMALL, pathOf } from "../../lib/shop/shelf";
import { previous, stepFor } from "../../lib/shop/steps";
import BookProvider from "../_book/BookProvider";
import Preview from "../_book/Preview";
import Downloads from "../_book/Downloads";
import { Ribbon, ShopFooter, ShopNav } from "../_shop/Chrome";

export default function PreviewPage() {
  const back = previous(stepFor("book")!.id);

  return (
    <>
      <Ribbon />
      <ShopNav basketCount={1} />
      <main className="mx-auto w-full max-w-[46rem] px-4 py-6 sm:px-6 sm:py-10">
        <p className="crumb">
          <a href={back ? back.path : pathOf(WHEN_THEY_WERE_SMALL)}>
            ← {back ? back.title : WHEN_THEY_WERE_SMALL.book.name}
          </a>
        </p>

        <BookProvider book={FIRST_BOOK}>
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
