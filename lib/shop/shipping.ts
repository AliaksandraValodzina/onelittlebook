/**
 * **What it costs to get the book there, which nobody has measured yet.**
 *
 * This module exists to hold a gap in the shape it will be filled in, which is
 * the arrangement the rest of this repository already uses for a fact it does
 * not have: `lib/product.ts` has a `Fact` union with no `value` on its
 * unconfirmed arm, `lib/book/product.ts` has rows that render as a marked
 * placeholder, and `lib/shop/market.ts` has a market with a price and an empty
 * country list. **`RATES` is `null` and must stay `null` until the captain has
 * the real Printify shipping table**, because the alternative is a number a
 * customer cannot tell from a quote.
 *
 * ## What the shop promises today, and what it does not
 *
 * **Today the listed price includes delivery and nothing is added at the till.**
 * That is not an accident of there being no rate table — it is the standing
 * arrangement from when the shop was Australian and the captain's prices were
 * set against landed cost, and it is the only thing that can honestly be said
 * while `RATES` is null: a shop with no rates cannot quote one, and a shop that
 * quoted zero would be making a different promise by accident.
 *
 * **The consequence worth stating out loud, because it is a commercial risk and
 * not a code one:** the US, UK and Australian prices were set against domestic
 * postage, and "everywhere else" at USD 49 would have the shop absorbing
 * international postage from a US printer. That is the single strongest reason
 * to get the rate table — and it is also why `MARKETS.row.ships` is empty, so
 * nobody can buy into that risk before the numbers exist.
 *
 * **What the pages must never do is imply a delivery date.** The dispatch
 * window is a fact about this shop and is stated; the time in transit belongs
 * to a carrier and a destination, and every page says so in those words. See
 * `lib/shop/copy.ts` and `lib/policy/pages.ts`, both of which read their
 * sentence out of `deliveryCostLine` below rather than writing their own.
 *
 * ## How a rate drops in
 *
 * Fill `RATES` with one entry per market, each naming what it costs and how
 * long the carrier says it takes, and three things follow with no other edit:
 * `deliveryCostLine` stops saying delivery is included, the delivery policy
 * page says what postage costs, and `lib/stripe/session.ts` § `shippingOptions`
 * puts real shipping options on the Checkout Session so Stripe collects the
 * postage instead of the price absorbing it. Nothing in this module guesses at
 * any of that in the meantime.
 */

import type { Currency, Market, MarketId } from "./market";

/** One postage option a market may be offered, priced in that market's currency. */
export interface ShippingRate {
  /** What Stripe's hosted page calls it. `Standard`, `Express`. */
  label: string;
  currency: Currency;
  /** Whole units, like `Money` — not minor units. Zero means genuinely free. */
  amount: number;
  /**
   * What the carrier says, as a range of working days in transit.
   *
   * **Never added to the dispatch window and presented as one number.** A
   * buyer is told when the book leaves and what the carrier says afterwards;
   * one combined figure reads as a delivery date, which is the promise this
   * shop cannot keep for an international order.
   */
  transitDays: readonly [number, number];
}

/** Every option a market offers, cheapest first. */
export type ShippingRates = Readonly<Record<MarketId, readonly ShippingRate[]>>;

/**
 * **Unset, deliberately.**
 *
 * `null` means "nobody has supplied these", not "shipping is free" — see this
 * module's docblock. `test/market.test.ts` asserts it is null *or* complete,
 * so a half-filled table fails the gate rather than quoting postage for one
 * market and nothing for the next.
 */
export const RATES: ShippingRates | null = null;

/** The options a market offers, or null while the table is unset. */
export function ratesFor(market: Market): readonly ShippingRate[] | null {
  return RATES ? RATES[market.id] : null;
}

/**
 * What the shop says about the **cost** of getting it there.
 *
 * One sentence, read by the book page's questions and by the delivery policy,
 * so the two cannot come to different conclusions about whether postage is
 * extra. It is true in both states of `RATES` and says nothing in either state
 * that the shop has not decided.
 */
export function deliveryCostLine(market: Market): string {
  const rates = ratesFor(market);
  if (!rates || rates.length === 0) {
    return "The price you see includes delivery — no postage is added at the till.";
  }
  const cheapest = rates.reduce((low, rate) => (rate.amount < low.amount ? rate : low));
  return cheapest.amount === 0
    ? "Delivery is free, and the options are shown at the checkout."
    : `Delivery is charged at the checkout, from ${cheapest.currency} ${cheapest.amount}.`;
}

/**
 * What the shop says about the **time**, which is two facts and never one.
 *
 * The dispatch window is ours and is stated. The transit time is the carrier's
 * and depends where the book is going, so it is described rather than
 * numbered — and it stays described even once `RATES` exists, because a range
 * of working days in transit is still not a delivery date.
 */
export function deliveryTimeLine(dispatchWindow: string): string {
  return (
    `Dispatched in ${dispatchWindow}. How long it then takes to reach you depends on where ` +
    "you are, and the carrier sets it — so we do not quote a delivery date."
  );
}
