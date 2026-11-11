/**
 * **The basket — step seven, and the last screen before Stripe's own page.**
 *
 * A server route holding a client basket, which is the arrangement every
 * stateful screen in this shop uses: the order lives in `localStorage` and only
 * the browser can read it, so a server render could show nothing but an empty
 * book and then replace it.
 *
 * `BookProvider` is mounted here rather than in a layout because this is the
 * only page under `/basket` — a layout for one page is a file that exists to be
 * forgotten.
 */

import type { Metadata } from "next";
import { FIRST_BOOK } from "../../templates/first-book";
import { deliveredBook } from "../../lib/artwork/release";
import { pageTitle } from "../../lib/brand";
import { stepFor } from "../../lib/shop/steps";
import BookProvider from "../_book/BookProvider";
import Basket from "../_book/Basket";
import { Ribbon, ShopFooter, ShopNav } from "../_shop/Chrome";
import { currentMarket } from "../_shop/market";

export const metadata: Metadata = {
  title: pageTitle(stepFor("basket")!.title),
  description: "What is in your basket, what you chose, and what it costs.",
};

export default async function BasketPage() {
  const market = await currentMarket();
  const { book, assets } = await deliveredBook(FIRST_BOOK);

  return (
    <>
      <Ribbon market={market} />
      <ShopNav market={market} basketCount={1} />
      <BookProvider book={book} market={market} assets={assets}>
        <Basket />
      </BookProvider>
      <ShopFooter />
    </>
  );
}
