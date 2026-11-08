/**
 * **The markets: the price table, the choice, and the claim that went false.**
 *
 * Four things are asserted here and each one is a real way this change could
 * have shipped broken:
 *
 * **A price computed from another price.** The captain's twelve numbers are
 * twelve decisions — `lib/book/editions.ts` § The prices are set per market —
 * and the single most likely "improvement" somebody makes to that module is to
 * replace it with a base price and exchange rates. So the table is checked
 * against the captain's own figures *and* checked for the property a conversion
 * would destroy: the markets are not in proportion to one another.
 *
 * **A "was" price, a percentage or an expiry.** Those were unrepresentable
 * before and the move to a market-keyed table is exactly the sort of
 * refactoring that quietly adds somewhere to put one. The structural check is
 * repeated against the new shape.
 *
 * **A market set by an IP address with no way out.** The brief is explicit:
 * default to the United States, let the buyer change it, remember the change.
 * So the cookie is the only input a render reads, the hint is used once, and the
 * masthead's control is in the markup of every page of the shop with every
 * market reachable from it.
 *
 * **"Printed in Australia", still somewhere.** It was true, it was in six
 * places, and it is now false in all of them. `test/shop-no-theatre.test.tsx`
 * walks every page and every copy string for it; this file reads the repository
 * itself, which is the half that catches a string hard-coded into a component
 * where no test would think to look.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_MARKET,
  DEFAULT_MARKET_ID,
  MARKETS,
  MARKET_COOKIE,
  MARKET_COOKIE_MAX_AGE,
  MARKET_LIST,
  hasMarketCookie,
  isMarketId,
  marketFromCookieHeader,
  marketIdForCountry,
  marketOf,
  withMarketCookie,
  type MarketId,
} from "../lib/shop/market";
import {
  EDITIONS,
  cheapestIn,
  differenceOf,
  editionOf,
  priceIn,
  priceLabel,
} from "../lib/book/editions";
import { RATES, deliveryCostLine, deliveryTimeLine, ratesFor } from "../lib/shop/shipping";
import { EVERY_SHIPPING_COUNTRY, marketIsOpen, shippingOptions, shipsTo } from "../lib/stripe/session";
import { backTo } from "../app/api/market/route";
import { MarketControl, Ribbon, ShopNav } from "../app/_shop/Chrome";
import { printedLine, ribbonFor } from "../lib/shop/copy";
import { BRAND, PRINTED_IN } from "../lib/brand";
import { DISPATCH_WINDOW } from "../lib/email/order";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// The price table
// ---------------------------------------------------------------------------

/**
 * **The captain's table, typed out once, here, where it is the expectation.**
 *
 * This is the one place in the repository a price may be hand-written and not
 * derived, because a test that read its expectation out of the module it is
 * testing would assert nothing at all. If the captain changes a price, this
 * list changes with `lib/book/editions.ts` and the change is visible in the
 * diff as two edits rather than none.
 */
const APPROVED: Record<MarketId, { softcover: [string, number]; hardcover: [string, number] }> = {
  us: { softcover: ["USD", 49], hardcover: ["USD", 59] },
  au: { softcover: ["AUD", 59], hardcover: ["AUD", 69] },
  gb: { softcover: ["GBP", 39], hardcover: ["GBP", 45] },
  row: { softcover: ["USD", 49], hardcover: ["USD", 59] },
};

describe("the price table is the captain's table", () => {
  it("prices both editions in every market, and in that market's own currency", () => {
    for (const market of MARKET_LIST) {
      const expected = APPROVED[market.id];
      for (const edition of EDITIONS) {
        const [currency, amount] = expected[edition.id as "softcover" | "hardcover"];
        const price = priceIn(edition, market);
        expect(price.currency, `${market.id} ${edition.id}`).toBe(currency);
        expect(price.amount, `${market.id} ${edition.id}`).toBe(amount);
        // And the currency a market charges in is the currency its prices are
        // in — a table that disagreed with its own market would quote one
        // currency and charge another.
        expect(price.currency, `${market.id} ${edition.id}`).toBe(market.currency);
      }
    }
  });

  it("leaves no market without a price, which is what the closed key buys", () => {
    for (const market of MARKET_LIST) {
      for (const edition of EDITIONS) {
        expect(edition.prices[market.id], `${market.id} ${edition.id}`).toBeDefined();
      }
    }
    expect(Object.keys(MARKETS).sort()).toEqual(Object.keys(APPROVED).sort());
  });

  /**
   * **The property a conversion would destroy.**
   *
   * If the table were a base price times a rate, every market's softcover and
   * hardcover would sit in the same ratio to the US pair. They deliberately do
   * not: AUD is 59/69 against USD 49/59, and GBP is 39/45. So a single
   * multiplier cannot produce this table, and a contributor who replaces it
   * with one fails here rather than shipping prices that move with a feed.
   */
  it("is not one rate applied to one base price", () => {
    const ratio = (marketId: MarketId, editionId: string) =>
      priceIn(editionOf(editionId), MARKETS[marketId]).amount /
      priceIn(editionOf(editionId), MARKETS.us).amount;
    for (const marketId of ["au", "gb"] as const) {
      expect(
        ratio(marketId, "softcover"),
        `${marketId} is in proportion to the US price — is this a conversion?`,
      ).not.toBeCloseTo(ratio(marketId, "hardcover"), 2);
    }
  });

  it("has no mention of an exchange rate or a conversion in the module", () => {
    // The prose says never to compute one. This is the same sentence as a
    // check, so a `rate`, a `convert` or a `fx` in that file fails the gate.
    const source = readFileSync(path.join(ROOT, "lib", "book", "editions.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const smell of [/\bexchangeRate\b/i, /\bfxRate\b/i, /\bconvert\(/i, /\brateFor\b/i]) {
      expect(code, String(smell)).not.toMatch(smell);
    }
  });

  it("still has nowhere to put a was, a percentage or an expiry", () => {
    // Unrepresentable rather than discouraged, in the new shape as in the old.
    // `docs/pricing.md` says why this is a legal position and not a taste.
    const json = JSON.stringify(EDITIONS);
    expect(json).not.toMatch(/was|rrp|discount|percent|expires|until|deadline/i);
    for (const edition of EDITIONS) {
      for (const market of MARKET_LIST) {
        expect(Object.keys(priceIn(edition, market)).sort()).toEqual(["amount", "currency"]);
      }
    }
  });

  it("formats and differences a price in the market being shown", () => {
    expect(priceLabel(EDITIONS[0], MARKETS.gb)).toBe("GBP 39");
    expect(differenceOf(EDITIONS[0], EDITIONS[1], MARKETS.gb)).toBe("GBP 6");
    expect(cheapestIn(MARKETS.au).id).toBe("softcover");
  });
});

// ---------------------------------------------------------------------------
// Choosing a market
// ---------------------------------------------------------------------------

describe("the market defaults to the United States and the buyer can change it", () => {
  it("defaults to the US, which is the captain's main market", () => {
    expect(DEFAULT_MARKET_ID).toBe("us");
    expect(DEFAULT_MARKET.currency).toBe("USD");
    expect(MARKET_LIST[0]).toBe(MARKETS.us);
  });

  it("reads the choice out of a cookie and nothing else", () => {
    expect(marketFromCookieHeader(`${MARKET_COOKIE}=gb`).id).toBe("gb");
    expect(marketFromCookieHeader(`a=1; ${MARKET_COOKIE}=au; b=2`).id).toBe("au");
    expect(marketFromCookieHeader(null).id).toBe(DEFAULT_MARKET_ID);
    // A cookie is typed by whoever owns the browser, so anything unknown is
    // the default rather than a thrown error on a shop page.
    for (const junk of ["", "x=1", `${MARKET_COOKIE}=`, `${MARKET_COOKIE}=nowhere`]) {
      expect(marketFromCookieHeader(junk).id, junk).toBe(DEFAULT_MARKET_ID);
    }
    expect(marketOf(undefined).id).toBe(DEFAULT_MARKET_ID);
    expect(isMarketId("row")).toBe(true);
    expect(isMarketId("nz")).toBe(false);
  });

  it("knows whether a choice has been made at all, which is what the edge asks", () => {
    expect(hasMarketCookie(`${MARKET_COOKIE}=us`)).toBe(true);
    expect(hasMarketCookie("other=1")).toBe(false);
    expect(hasMarketCookie(null)).toBe(false);
  });

  it("uses a country hint once, as a suggestion, and overwrites no choice", () => {
    expect(marketIdForCountry("AU")).toBe("au");
    expect(marketIdForCountry("gb")).toBe("gb");
    expect(marketIdForCountry("US")).toBe("us");
    // Somewhere with no market of its own is the rest-of-world row.
    expect(marketIdForCountry("JP")).toBe("row");
    // No header, a malformed one, or none at all is the default and not a guess.
    for (const absent of [null, undefined, "", "AUS", "1"]) {
      expect(marketIdForCountry(absent), String(absent)).toBe(DEFAULT_MARKET_ID);
    }
  });

  it("writes the hint onto the request the edge is forwarding, not only the response", () => {
    // Without this the render *this* request produces would still see no
    // cookie, and the hint would appear to work only on a refresh.
    expect(withMarketCookie(null, "gb")).toBe(`${MARKET_COOKIE}=gb`);
    expect(withMarketCookie("a=1", "au")).toBe(`a=1; ${MARKET_COOKIE}=au`);
    // And replaces rather than appends, so a header cannot carry two.
    const twice = withMarketCookie(`${MARKET_COOKIE}=us; a=1`, "gb");
    expect(marketFromCookieHeader(twice).id).toBe("gb");
    expect(twice.match(new RegExp(MARKET_COOKIE, "g"))).toHaveLength(1);
  });

  it("remembers the choice for a year", () => {
    expect(MARKET_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });

  /**
   * **The Stripe idempotency key names the market, or a repriced order replays
   * the old price.**
   *
   * The key is held for 24 hours and Stripe replays the first response for it.
   * `orderFingerprint` hashes the fill, and the market is not in a fill — so a
   * key of the fingerprint alone would hand a buyer who moved the market pill
   * the session created at the old price in the old currency. Read out of the
   * route because the alternative is a live Stripe, and the claim is about one
   * expression. `lib/orders/store.ts` § claim is the other half.
   */
  it("keys the till's idempotency on the market as well as the fill", () => {
    const route = readFileSync(
      path.join(ROOT, "app", "api", "checkout", "route.ts"),
      "utf8",
    );
    expect(route).toContain("idempotencyKey: `${record.fingerprint}-${edition.id}-${market.id}`");
  });

  it("is set at the edge by a proxy that leaves an existing choice alone", () => {
    // The file is read rather than invoked: a `NextRequest` is Next's own
    // object and the interesting line — that a request with a cookie is passed
    // straight through — is a guard clause this can see plainly.
    const source = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");
    expect(source).toContain("hasMarketCookie");
    expect(source).toMatch(/if \(hasMarketCookie\([^)]*\)\) return NextResponse\.next\(\);/);
    expect(source).toContain("x-vercel-ip-country");
    expect(source).toContain("withMarketCookie");
    // And does not run over the route whose job is to write the cookie, or a
    // first press of the pill would answer with two values for one name.
    expect(source).toContain("api/market");
  });
});

describe("the control that changes it is in the masthead of every page", () => {
  const nav = renderToStaticMarkup(<ShopNav market={MARKETS.au} />);
  const control = renderToStaticMarkup(<MarketControl market={MARKETS.au} />);

  it("shows which market the buyer is in", () => {
    expect(nav).toContain('data-testid="market-control"');
    expect(control).toContain(MARKETS.au.currency);
    expect(control).toContain(MARKETS.au.label);
  });

  it("offers every market, each one reachable in one press", () => {
    for (const market of MARKET_LIST) {
      expect(control, market.id).toContain(`data-testid="market-${market.id}"`);
      expect(control, market.id).toContain(`value="${market.id}"`);
      expect(control, market.id).toContain(market.label);
    }
  });

  it("marks the current one rather than hiding it", () => {
    expect(control).toMatch(/value="au"[^>]*aria-current="true"|aria-current="true"[^>]*value="au"/);
  });

  it("works with no JavaScript, because it is a form and a redirect", () => {
    expect(control).toContain('method="post"');
    expect(control).toContain('action="/api/market"');
    expect(control).toContain('type="submit"');
    // The paired negative: nothing here is a link that would navigate without
    // setting the cookie.
    expect(control).not.toMatch(/<a\b/);
  });

  it("sends the buyer back where they were, and only to this site", () => {
    const here = "https://onelittlebook.com/api/market";
    expect(backTo("https://onelittlebook.com/basket", here)).toBe("/basket");
    expect(backTo("https://onelittlebook.com/books/x?a=1", here)).toBe("/books/x?a=1");
    // An open redirect is the bug this check exists for. A referer from
    // anywhere else is discarded, including the near-misses.
    for (const elsewhere of [
      "https://evil.example/x",
      "https://onelittlebook.com.evil.example/x",
      "http://onelittlebook.com/x",
      "not a url",
      null,
    ]) {
      expect(backTo(elsewhere, here), String(elsewhere)).toBe("/");
    }
  });
});

// ---------------------------------------------------------------------------
// Where the book goes, and what it costs to get it there
// ---------------------------------------------------------------------------

describe("shipping is a structured gap rather than a guess", () => {
  it("has no rate table, which is not the same as free", () => {
    // `lib/shop/shipping.ts` carries the argument. The captain is gathering
    // real Printify numbers and nothing here invents one in the meantime.
    expect(RATES).toBeNull();
    for (const market of MARKET_LIST) expect(ratesFor(market)).toBeNull();
  });

  it("is null or complete, so a half-filled table fails the gate", () => {
    if (RATES !== null) {
      for (const market of MARKET_LIST) {
        const rates = RATES[market.id];
        expect(rates, market.id).toBeDefined();
        for (const rate of rates) {
          expect(rate.currency, market.id).toBe(market.currency);
          expect(rate.amount, market.id).toBeGreaterThanOrEqual(0);
          expect(rate.transitDays[0], market.id).toBeLessThanOrEqual(rate.transitDays[1]);
        }
      }
    }
  });

  it("puts no shipping option on a session while there is no rate", () => {
    for (const market of MARKET_LIST) {
      expect(shippingOptions(market), market.id).toEqual({});
    }
  });

  it("says the price includes delivery, which is what is true today", () => {
    for (const market of MARKET_LIST) {
      expect(deliveryCostLine(market), market.id).toContain("includes delivery");
    }
  });

  it("states a dispatch window and never a delivery date", () => {
    const line = deliveryTimeLine(DISPATCH_WINDOW);
    expect(line).toContain(DISPATCH_WINDOW);
    expect(line.toLowerCase()).toContain("we do not quote a delivery date");
    // No arithmetic that would read as one: the two windows are never added.
    expect(line).not.toMatch(/\b\d+\s*[-–]\s*\d+\s*(?:days?|weeks?)\s*(?:to|until)\s*(?:you|your door|delivery)/i);
  });

  it("opens a checkout only where a country has been named", () => {
    for (const market of MARKET_LIST) {
      expect(marketIsOpen(market), market.id).toBe(shipsTo(market).length > 0);
    }
    // "Everywhere else" has a price and no countries, on purpose.
    expect(marketIsOpen(MARKETS.row)).toBe(false);
    expect(MARKETS.row.shipsNeeds, "an empty country list must say whose fact is missing").toBeTruthy();
    for (const market of [MARKETS.us, MARKETS.au, MARKETS.gb]) {
      expect(market.shipsNeeds, market.id).toBeNull();
    }
  });

  it("derives the list of every country from the markets themselves", () => {
    expect([...EVERY_SHIPPING_COUNTRY].sort()).toEqual(["AU", "GB", "US"]);
  });
});

// ---------------------------------------------------------------------------
// The claim that went false
// ---------------------------------------------------------------------------

/** Every source file that can reach a customer's screen. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx|css)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("nothing claims the book is printed in Australia", () => {
  const FILES = [
    ...sources(path.join(ROOT, "app")),
    ...sources(path.join(ROOT, "lib")),
    ...sources(path.join(ROOT, "templates")),
  ];

  it("finds the files at all, so the check below is not vacuous", () => {
    expect(FILES.length).toBeGreaterThan(40);
  });

  it("has the claim in no source file, in words or in a flag", () => {
    for (const file of FILES) {
      const source = readFileSync(file, "utf8");
      const relative = path.relative(ROOT, file);
      // The comment in `app/_shop/Chrome.tsx` explaining why the footer's
      // country is *not* the printing country is allowed to say the words; the
      // claim itself is a string a customer reads. So strip the comments and
      // check what is left.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      expect(code.toLowerCase(), relative).not.toContain("printed in australia");
      expect(code.toLowerCase(), relative).not.toContain("made in australia");
      expect(code, `${relative} carries the wrong flag`).not.toContain("🇦🇺");
    }
  });

  it("says the USA instead, from one module, in one sentence", () => {
    expect(PRINTED_IN).toBe(`Printed in ${BRAND.printedIn}`);
    expect(printedLine(MARKETS.us)).toBe("Printed in the USA");
    // And tells a buyer outside it that the book still comes to them. This is
    // a statement about posting abroad, not a delivery estimate.
    expect(printedLine(MARKETS.gb)).toBe("Printed in the USA, shipped worldwide");
    expect(ribbonFor(MARKETS.us)).toContain(DISPATCH_WINDOW);
    for (const market of MARKET_LIST) {
      expect(renderToStaticMarkup(<Ribbon market={market} />), market.id).toContain(
        printedLine(market),
      );
    }
  });

  /**
   * **The one place Australia is still named, and it is a different fact.**
   *
   * `lib/brand.ts` § `registeredIn` is the country the business trades from
   * and § `printedIn` is where the object is made. They were one string once,
   * which is exactly why somebody tidying up after this change would delete
   * the survivor. This is the check that stops them.
   */
  it("still names the business's own country in the footer, which is not a printing claim", () => {
    expect(BRAND.registeredIn).toBe("Australia");
    expect(BRAND.printedIn).toBe("the USA");
    const chrome = readFileSync(path.join(ROOT, "app", "_shop", "Chrome.tsx"), "utf8");
    expect(chrome).toContain("BRAND.registeredIn");
    expect(chrome).not.toContain("· Australia");
  });
});
