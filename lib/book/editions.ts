/**
 * **The two editions of the same book, the one upgrade between them, and one
 * set price per market.**
 *
 * One artwork set serves both: Printify's **Softcover Photo Book** (8 × 8 in,
 * its only size) and its **Hardcover Photo Book** (8 × 8 in, one of four) take
 * the same twenty-four rasters and the same cover. So an edition is not a
 * different book, a different template or a different print file — it is a
 * line on an order that decides which product the captain uploads the file to.
 * There is exactly one of these lists and the flow offers the upgrade **once**,
 * which is the placement the captain took from MyStoryTale: after the
 * dedication and before the cart.
 *
 * ## The prices are set per market and are never computed from each other
 *
 * This is the one thing in this module a later contributor is most likely to
 * "fix", so it is stated first and plainly. The captain's table is:
 *
 * | Market                    | Softcover | Hardcover |
 * | ------------------------- | --------- | --------- |
 * | United States (default)   | USD 49    | USD 59    |
 * | Australia                 | AUD 59    | AUD 69    |
 * | United Kingdom            | GBP 39    | GBP 45    |
 * | Everywhere else           | USD 49    | USD 59    |
 *
 * **There is no exchange rate anywhere in this file and there must never be
 * one.** Those twelve numbers are twelve decisions. They are deliberately
 * round, deliberately not in proportion to one another, and each one is priced
 * on what that market will pay against what it costs to land a book there —
 * AUD 59 is not USD 49 converted and GBP 39 is not either. A contributor who
 * replaces the table with a base price and a multiplier produces prices that
 * are *arithmetically consistent* and commercially wrong, and they move every
 * time somebody updates a rate: the shop would quote GBP 38.74 one week and
 * GBP 39.12 the next, which is the opposite of a set price. If a market's
 * price should change, change that market's number.
 *
 * `lib/shop/market.ts` owns which market a visitor is in and why the default is
 * the United States. Nothing here decides that.
 *
 * ## Why this is not in the book template
 *
 * `BookTemplate.rev` is eight hex of the template's own content, and a
 * `BookFill` names `(bookId, bookRev)` so that a reprint of a year-old order
 * cannot pick up an edited book. A price belongs to the **shop** and changes
 * for commercial reasons; putting it in the hashed artefact would mean that
 * putting the launch offer on — or taking it off — restamped the book and
 * marked every order placed before it as stale. The covers and the looks are
 * in the template because they change what is *drawn*. A price does not.
 *
 * ## Why the numbers may be written at all
 *
 * `lib/product.ts` makes it impossible to write a number nobody supplied, and
 * that guard is still in force: these reach the page as `Fact`s and the
 * `confirmed: true` arm requires a `source`. The source is the captain's
 * settled specification — AUD 59 and AUD 69 on 6 November against measured
 * Printify landed costs (softcover AUD 11.67, hardcover AUD 16.50, read off
 * their own catalogue), and the US, UK and rest-of-world rows approved with
 * the move to US printing. That is a decision, not a guess, which is the only
 * thing `confirmed` has ever meant here.
 *
 * ## What is deliberately absent
 *
 * **There is no `was` price, no discount percentage and no deadline — in any
 * market.** The captain's register is "premium, honest, no theatre", and the
 * legal reasoning is in `docs/pricing.md`: under Australian Consumer Law a
 * was/now comparison where the higher price was never genuinely charged for a
 * reasonable period is a misleading representation about price, and the US
 * market the shop now leads with has its own rules on exactly that — the FTC
 * and a patchwork of state statutes treat a fictitious former price as
 * deceptive too. Selling into both at once makes the absence of a "was" field
 * *more* load-bearing than it was when the shop was Australian, not less.
 *
 * A genuine launch offer with a stated end date is the honest way to the same
 * urgency — and **the end date has not been named**, so there is no offer here
 * to carry one. The type has nowhere to put a discount, which is the same trick
 * `Fact` plays one level up, and making the price market-keyed did not add
 * anywhere either: a `Money` is a currency and an amount and that is all.
 */

import type { Currency, Market, MarketId } from "../shop/market";

/** Minor units are not used: these are whole units of the currency. */
export interface Money {
  currency: Currency;
  amount: number;
}

/**
 * One price per market, and **every market present**.
 *
 * `Record<MarketId, Money>` rather than a partial map with a fallback: a
 * market added to `lib/shop/market.ts` with no price in this table does not
 * compile, which is the whole reason the key is a closed union. A missing
 * price silently falling back to the US number is how a shop ends up charging
 * American prices in sterling.
 */
export type Prices = Readonly<Record<MarketId, Money>>;

export interface Edition {
  /** Published and permanent — an order names it. */
  id: string;
  /** What the buyer is offered. */
  label: string;
  /** What it costs, per market. Set prices. See this module's docblock. */
  prices: Prices;
  /**
   * The Printify blueprint this edition is fulfilled against.
   *
   * Recorded so that "which product do I upload this to" is answered by the
   * order rather than by memory, and **not** used to call anything: there is no
   * printer integration in this product and the brief forbids building one.
   */
  blueprint: string;
  /** One line on the upgrade card. Copy, not a claim. */
  note: string;
}

/**
 * Softcover first, because it is the listed price.
 *
 * The order of this list is the order the upgrade card shows, and the first
 * entry is what a fresh order starts as — an upgrade nobody has been offered
 * yet must not already be selected.
 */
export const EDITIONS: readonly Edition[] = [
  {
    id: "softcover",
    label: "Softcover",
    prices: {
      us: { currency: "USD", amount: 49 },
      au: { currency: "AUD", amount: 59 },
      gb: { currency: "GBP", amount: 39 },
      row: { currency: "USD", amount: 49 },
    },
    blueprint: "Printify Softcover Photo Book, 8 × 8 in",
    note: "Twenty-four pages and a printed cover. The listed price.",
  },
  {
    id: "hardcover",
    label: "Hardcover",
    prices: {
      us: { currency: "USD", amount: 59 },
      au: { currency: "AUD", amount: 69 },
      gb: { currency: "GBP", amount: 45 },
      row: { currency: "USD", amount: 59 },
    },
    blueprint: "Printify Hardcover Photo Book, 8 × 8 in",
    note: "The same book, bound hard. It survives being read at bedtime for years.",
  },
] as const;

export const DEFAULT_EDITION = EDITIONS[0].id;

export function isEdition(id: unknown): boolean {
  return typeof id === "string" && EDITIONS.some((e) => e.id === id);
}

export function editionOf(id: string): Edition {
  return EDITIONS.find((e) => e.id === id) ?? EDITIONS[0];
}

/** The upgrade on offer, or null when there is nothing above what they have. */
export function upgradeFrom(id: string): Edition | null {
  const index = EDITIONS.findIndex((e) => e.id === id);
  return index >= 0 && index + 1 < EDITIONS.length ? EDITIONS[index + 1] : null;
}

/**
 * What this edition costs in this market.
 *
 * The only way to get a price out of an edition, so no screen can read one
 * without saying which market it is pricing for. That is the point of removing
 * the old single `price` field: every call site had to be visited, and a call
 * site that had no market to hand was a call site that was about to show the
 * wrong currency.
 */
export function priceIn(edition: Edition, market: Market): Money {
  return edition.prices[market.id];
}

/** `USD 49`. One formatting of a price, so two screens cannot show two. */
export function priceOf(money: Money): string {
  return `${money.currency} ${money.amount}`;
}

/** `USD 49`, for an edition in a market. The pairing used nearly everywhere. */
export function priceLabel(edition: Edition, market: Market): string {
  return priceOf(priceIn(edition, market));
}

/**
 * What the upgrade adds, as a price difference in the market being shown.
 *
 * Never a struck-out total, and never a percentage. `USD 10`, which is a fact
 * about two prices and not a discount off either.
 */
export function differenceOf(from: Edition, to: Edition, market: Market): string {
  const a = priceIn(from, market);
  const b = priceIn(to, market);
  return `${a.currency} ${b.amount - a.amount}`;
}

/** The cheapest edition in a market. What `From …` is from. */
export function cheapestIn(market: Market): Edition {
  return EDITIONS.reduce((low, e) =>
    priceIn(e, market).amount < priceIn(low, market).amount ? e : low,
  );
}
