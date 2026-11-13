"use client";

/**
 * **Step five: "Softcover or hard?" — the upgrade, offered once, in this
 * shop's register.**
 *
 * The placement is the artefact's and it is the one thing worth taking from the
 * seller it was traced from: after the message, before the basket. A buyer who
 * has just written a dedication to a child is the buyer most willing to have it
 * bound hard, and asking earlier is asking before they care.
 *
 * **What the artefact deliberately changed, and this keeps.** No pink, no
 * *"JUST $9.99 MORE"* starburst, and **both options stated as real prices
 * rather than one framed as a discount on the other**. `lib/book/editions.ts`
 * has no field for a "was", a percentage or an expiry, so the misleading
 * comparison is unrepresentable here rather than merely avoided —
 * `docs/pricing.md` is why that is a legal position and not a taste one.
 *
 * **The four reassurances the artefact drew are not here**, and that is
 * deliberate: *"board-stiff cover"*, *"lies flat when read"* and *"the one
 * people keep"* are claims about stock, binding and other buyers, and
 * `lib/book/product.ts` marks *Paper and binding* as unconfirmed because
 * **nobody has held one**. What is shown instead is each edition's own `note`,
 * which is copy that already passed that bar.
 *
 * **Neither edition button is filled.** The one solid control on this screen is
 * the way forward, because it is the only thing that moves the buyer: two
 * full-width black buttons stacked read as three options rather than "pick one
 * of these two, then go on". The chosen edition says so with a border, a ring
 * and a tick (`app/shop.css` § `.btn.choice`) — never a fill and never colour
 * alone — and `aria-pressed` still carries the state.
 */

import { EDITIONS, differenceOf, editionOf, priceLabel, upgradeFrom } from "../../lib/book/editions";
import { next, stepFor } from "../../lib/shop/steps";
import Cover from "../_shop/Cover";
import { useBook } from "../_book/BookProvider";
import Screen from "./Screen";

const step = stepFor("cover")!;

export default function CoverScreen({ closeTo }: { closeTo: string }) {
  const { book, market, order, fill, setEdition, flush } = useBook();
  const onward = next("cover")!;
  const base = editionOf(EDITIONS[0].id);
  const upgrade = upgradeFrom(base.id);

  return (
    <Screen step={step} closeTo={closeTo} width={600}>
      <div className="coverbox">
        <Cover book={book} name={fill.name} lookId={fill.lookId} coverId={fill.coverId} />
        {upgrade ? (
          <div className="pricetag" data-testid="upgrade-difference">
            <span>
              <b>+{differenceOf(base, upgrade, market)}</b>
              {upgrade.label.toLowerCase()}
            </span>
          </div>
        ) : null}
      </div>

      <ul className="ticks">
        {EDITIONS.map((edition) => (
          <li key={edition.id}>{edition.note}</li>
        ))}
      </ul>

      {/*
        **Choosing and going on are two gestures, on purpose.**

        The order is written to `localStorage` on a 400 ms debounce, and a
        navigation fired by the same click that changed the edition outruns the
        write — the buyer would arrive at the basket with the edition they did
        not choose. Selecting here and pressing on below is one extra tap and no
        lost choice, and the way on calls `flush` so nothing is waiting on a
        timer when the page changes.
      */}
      <div className="two">
        {EDITIONS.map((edition, index) => (
          <button
            key={edition.id}
            type="button"
            className="btn wide choice"
            onClick={() => setEdition(edition.id)}
            aria-pressed={order.editionId === edition.id}
            data-testid={`edition-${edition.id}`}
          >
            {order.editionId === edition.id ? (
              <span className="tick" aria-hidden="true" data-testid={`edition-${edition.id}-tick`}>
                ✓
              </span>
            ) : null}
            {index === 0 ? `Keep ${edition.label.toLowerCase()}` : edition.label} ·{" "}
            {priceLabel(edition, market)}
          </button>
        ))}
      </div>

      <a className="btn wide mt-[18px]" href={onward.path} onClick={flush} data-testid="next">
        Read the whole book
      </a>
    </Screen>
  );
}
