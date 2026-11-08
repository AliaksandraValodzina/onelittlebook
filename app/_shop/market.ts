/**
 * **Which market the request in front of us is in, read once per render.**
 *
 * All the thinking is in `lib/shop/market.ts`, which is pure and knows nothing
 * about Next. This is the four lines that hand it a cookie — the same shape as
 * every other `app/` module in this repository, which is glue over something
 * tested without a browser.
 *
 * **The cookie is the only input.** Not the country header: `proxy.ts` turns
 * the edge's hint into a cookie on the first request and nothing downstream
 * looks at the hint again. That is what makes the choice *visible and
 * changeable* rather than a price set by an IP address — and, duller but just
 * as important, it is what keeps a server render and the client render that
 * hydrates it reading the same value.
 *
 * A page that calls this is dynamic by definition, because it depends on a
 * request. Every page that renders the shop's chrome says `force-dynamic`
 * already for `assetUrl`'s sake; the policy pages now say it for this.
 */

import { cookies } from "next/headers";
import { DEFAULT_MARKET, marketOf, MARKET_COOKIE, type Market } from "../../lib/shop/market";

/**
 * The market this request chose, or the default where there is no request.
 *
 * **`cookies()` throws outside a request scope**, and there are two places
 * that happens: a component test that calls a route as the function it is —
 * which is how every page in this repository is tested, there being no DOM in
 * the suite — and anything that renders ahead of a request. Neither has a
 * buyer in it to have chosen anything, so the default is not a swallowed error
 * but the right answer, and it is the same answer a buyer's very first request
 * gets. This is `lib/template/defaults.ts`'s rule one layer up: a tolerant
 * reader with a stated meaning for absence.
 *
 * It is not a licence to render a page without a request in production. Every
 * route that calls this says `force-dynamic`, so a real page view always has a
 * cookie to read.
 */
export async function currentMarket(): Promise<Market> {
  try {
    const jar = await cookies();
    return marketOf(jar.get(MARKET_COOKIE)?.value);
  } catch {
    return DEFAULT_MARKET;
  }
}
