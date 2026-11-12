/**
 * **The flow's own ground, and the order it all writes into.**
 *
 * `BookProvider` is here rather than on each screen because the whole point of
 * it is that there is one order: the look screen's name, the message screen's
 * dedication and the cover screen's edition are the same object, and a provider
 * per screen would be a different object per screen.
 *
 * It is a client component wrapping server-rendered children, which is the
 * arrangement the shop has used since `/` had the form on it — the static parts
 * cost no JavaScript and the form above them knows the state of the order.
 */

import type { Metadata } from "next";
import { FIRST_BOOK } from "../../templates/first-book";
import { deliveredBook } from "../../lib/artwork/release";
import { pageTitle } from "../../lib/brand";
import BookProvider from "../_book/BookProvider";
import { Ribbon, ShopFooter, ShopNav } from "../_shop/Chrome";
import { currentMarket } from "../_shop/market";

export const metadata: Metadata = {
  title: pageTitle(`Make ${FIRST_BOOK.name}`),
  description:
    "Pick the baby, type the name, write your message — then read every page before you pay.",
};

export default async function MakeLayout({ children }: { children: React.ReactNode }) {
  // Read here and handed to the provider, so every screen of the flow and the
  // basket beyond it price against the same market the masthead is showing.
  const market = await currentMarket();
  // The published book with whatever artwork the store holds bound over it —
  // one line, `lib/artwork/release.ts` § deliveredBook, and the book is
  // unchanged when nothing has been delivered. `assets` comes out of the same
  // read: it is where those pictures are publicly readable, which only the
  // server can know and the chooser's tiles need in the browser.
  const { book, assets, screen } = await deliveredBook(FIRST_BOOK);

  return (
    <>
      {/*
        The flow wears the shop's chrome. The artefact drew each screen as a
        card on a bare ground because it was a review page showing six of them
        at once; a buyer on one of them is still in a shop and needs the way
        back to it.
      */}
      <Ribbon market={market} />
      <ShopNav market={market} />
      <BookProvider book={book} market={market} assets={assets} screen={screen}>
        {children}
      </BookProvider>
      <ShopFooter />
    </>
  );
}
