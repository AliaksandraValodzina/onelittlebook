/**
 * **Which market a visitor is buying in, and what that decides.**
 *
 * The shop is printed in the United States and sells mainly there; it also
 * sells to Australia, the United Kingdom and anywhere else the captain has
 * posted to. A *market* is the one word for the bundle of things that follow
 * from that: the currency the till charges in, the countries its checkout will
 * accept an address in, and the one non-limiting sentence a policy page says
 * about consumer law.
 *
 * It is one module rather than four scattered decisions for the reason
 * everything else here is data: a second currency added to `lib/book/editions.ts`
 * with no country list behind it is a shop that quotes GBP and refuses a
 * British address, and that mistake is invisible until a buyer hits it.
 *
 * ## Why the default is the United States and not the request's country
 *
 * The brief is explicit and it is also the only arrangement that does not read
 * as discriminatory pricing: **the market defaults to the United States, the
 * choice is visible in the masthead, and changing it is one press.** A country
 * hint from the edge (`x-vercel-ip-country`) is allowed to pick the *initial*
 * default and nothing more — `proxy.ts` writes it into the cookie on the first
 * request, which is what makes it a suggestion the buyer can see and overrule
 * rather than a price quietly set by their IP address with no way out.
 *
 * Writing it into a cookie at the edge rather than resolving the hint inside
 * every render has a second, duller benefit that matters: the cookie is the
 * only input, so a server render and the client render that hydrates it read
 * the same value and cannot disagree.
 *
 * ## Why "everywhere else" cannot check out yet, on purpose
 *
 * `MARKETS.row` has a **confirmed price and an empty `ships`**, and that is the
 * honest state rather than an oversight. Stripe needs an enumerated list of
 * countries; nobody has written one; and this repository's standing rule — see
 * `lib/product.ts` and the `Fact` union it is built on — is that an unsupplied
 * fact is represented as missing rather than guessed. So a visitor anywhere
 * else is shown the price they would pay in USD, and the till says plainly that
 * the country list has not been settled and to write to us. Opening it is one
 * edit to `ships` once the captain has the Printify shipping table.
 *
 * `shipsNeeds` is the sentence saying whose fact it is, exactly as an
 * unconfirmed `Fact` carries `needs`.
 */

/**
 * The four markets. `row` is "everywhere else" and is a market rather than a
 * fallback, because it has its own price and its own country list.
 */
export type MarketId = "us" | "au" | "gb" | "row";

/**
 * The three currencies the captain has set prices in.
 *
 * A closed union on purpose: `lib/book/editions.ts` keys a price by market, so
 * a fourth currency without a price in it would not compile.
 */
export type Currency = "USD" | "AUD" | "GBP";

export interface Market {
  /** Published and permanent — it is written into a cookie and onto an order. */
  id: MarketId;
  /** What the masthead's control and the policy pages call this market. */
  label: string;
  /** The currency the till charges in. Set by the captain, never converted. */
  currency: Currency;
  /**
   * The countries this market's checkout will accept a delivery address in.
   *
   * **Empty means nobody has named them**, which closes the till for that
   * market — see this module's docblock. It is never a wildcard: Stripe wants
   * an enumerated list and so does an honest delivery page.
   */
  ships: readonly string[];
  /** Why `ships` is empty, in the voice of an unconfirmed `Fact`. Null when it is not. */
  shipsNeeds: string | null;
  /**
   * **The one sentence a policy page says about consumer law, and it only ever
   * gives rights away.**
   *
   * Every variant is of the form *nothing here limits what you are already
   * entitled to*, which is safe to say in any jurisdiction because it claims
   * nothing about what those entitlements are. The United States has no
   * federal equivalent of the Australian Consumer Law and its consumer
   * protection is state by state, so the US and rest-of-world sentence names
   * no statute at all. Writing US consumer law is explicitly not this
   * repository's job, and a page that guessed at it would be worse than a page
   * that declines to.
   */
  statutory: string;
}

/** The sentence used wherever no single statute can be named. */
const NO_STATUTE_NAMED =
  "Nothing on this page limits any right you have under the consumer law where you live.";

export const MARKETS: Readonly<Record<MarketId, Market>> = {
  us: {
    id: "us",
    label: "United States",
    currency: "USD",
    ships: ["US"],
    shipsNeeds: null,
    statutory: NO_STATUTE_NAMED,
  },
  au: {
    id: "au",
    label: "Australia",
    currency: "AUD",
    ships: ["AU"],
    shipsNeeds: null,
    // The shop's first market and the one whose law `docs/pricing.md` works
    // through. Named because it can be: the Australian Consumer Law is one
    // statute covering the whole country.
    statutory: "Nothing on this page limits your rights under the Australian Consumer Law.",
  },
  gb: {
    id: "gb",
    label: "United Kingdom",
    currency: "GBP",
    ships: ["GB"],
    shipsNeeds: null,
    statutory:
      "Nothing on this page limits your rights under the consumer law of the United Kingdom.",
  },
  row: {
    id: "row",
    label: "Everywhere else",
    currency: "USD",
    // Deliberately empty. See this module's docblock — a price is settled and a
    // country list is not, and the second is what a checkout needs.
    ships: [],
    shipsNeeds:
      "the countries to post to and what it costs to reach them. Stripe wants an enumerated " +
      "list and the captain is gathering the real Printify shipping table; until it exists " +
      "this checkout refuses rather than quoting a delivery nobody has checked. Write to us " +
      "and we will find out properly before saying yes.",
    statutory: NO_STATUTE_NAMED,
  },
} as const;

/**
 * The markets in the order the masthead's control lists them.
 *
 * The United States first because it is the default and the main market, then
 * the two the captain named, then everywhere else — which has to be last
 * because it is defined as what the others are not.
 */
export const MARKET_LIST: readonly Market[] = [
  MARKETS.us,
  MARKETS.au,
  MARKETS.gb,
  MARKETS.row,
] as const;

/** The United States, and every page that is handed no market renders this one. */
export const DEFAULT_MARKET_ID: MarketId = "us";
export const DEFAULT_MARKET: Market = MARKETS[DEFAULT_MARKET_ID];

/**
 * Whether this market's checkout can be opened at all.
 *
 * False only while a market has no countries — see § Why "everywhere else"
 * cannot check out yet. It lives here rather than beside the Checkout Session
 * because it is a fact about a `Market` and because the **basket** needs it:
 * telling a buyer at the till is telling them after three minutes of work, and
 * a client component should not have to import the Stripe module to ask.
 */
export function marketIsOpen(market: Market): boolean {
  return market.ships.length > 0;
}

export function isMarketId(value: unknown): value is MarketId {
  return typeof value === "string" && value in MARKETS;
}

/** The market for an id, or the default. Never throws — a cookie is user input. */
export function marketOf(id: unknown): Market {
  return isMarketId(id) ? MARKETS[id] : DEFAULT_MARKET;
}

/**
 * The market a two-letter country code suggests.
 *
 * **A suggestion and not a decision** — it picks the initial default and the
 * buyer sees it and can change it. An unknown or absent code is the United
 * States, which is the brief's default and not a guess about where anybody is.
 */
export function marketIdForCountry(code: string | null | undefined): MarketId {
  const upper = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return DEFAULT_MARKET_ID;
  for (const market of MARKET_LIST) {
    if (market.ships.includes(upper)) return market.id;
  }
  // Somewhere with no market of its own. `row` priced in USD, which is the
  // captain's "everywhere else" row.
  return "row";
}

// ---------------------------------------------------------------------------
// The cookie, which is the only input a render reads
// ---------------------------------------------------------------------------

/** Named with the shop's prefix so it cannot collide with anything else on the domain. */
export const MARKET_COOKIE = "olb_market";

/** A year. Long enough that a returning buyer is not re-guessed at. */
export const MARKET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The market named by a `Cookie:` header, or the default.
 *
 * A string in and a market out, with no framework in it, so the edge, a server
 * component, a route handler and a test all read a cookie the same way. The
 * parse is deliberately dull: anything that is not one of four known ids is the
 * default, because the value is typed by whoever owns the browser.
 */
export function marketFromCookieHeader(header: string | null | undefined): Market {
  if (!header) return DEFAULT_MARKET;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index < 0) continue;
    if (pair.slice(0, index).trim() !== MARKET_COOKIE) continue;
    return marketOf(decodeURIComponent(pair.slice(index + 1).trim()));
  }
  return DEFAULT_MARKET;
}

/** Whether a `Cookie:` header carries a choice at all, which is what the edge asks. */
export function hasMarketCookie(header: string | null | undefined): boolean {
  if (!header) return false;
  return header.split(";").some((pair) => pair.split("=")[0].trim() === MARKET_COOKIE);
}

/**
 * The same header with this market's cookie on it, for `proxy.ts`.
 *
 * The edge sets the cookie on the *response* so the choice is remembered, and
 * has to put it on the *request* too or the render that this very request
 * produces would still see no cookie and show the default. Pure, so the one
 * interesting line in the proxy is testable without a server.
 */
export function withMarketCookie(header: string | null | undefined, id: MarketId): string {
  const kept = (header ?? "")
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0 && pair.split("=")[0].trim() !== MARKET_COOKIE);
  return [...kept, `${MARKET_COOKIE}=${id}`].join("; ");
}
