/**
 * **The one thing the edge decides: which market a first-time visitor sees.**
 *
 * `lib/shop/market.ts` carries the argument and it is worth repeating the part
 * that this file exists to honour: **the buyer must be able to see and change
 * the market they are being priced in.** Pricing somebody by their IP address
 * with no way out reads as discriminatory pricing, and it is the complaint that
 * gets screenshotted.
 *
 * So the hint is used **once**, to pick the initial default, and then it is
 * written into a cookie and never consulted again. From that moment the cookie
 * is the only input: the masthead's control shows what it says, one press
 * changes it, and `app/api/market/route.ts` writes the new value over this one.
 * A visitor whose hint says Australia sees Australian prices *and* sees that
 * they are Australian prices.
 *
 * Writing it at the edge rather than resolving the hint inside every render
 * buys a second, duller thing that matters: there is one input instead of two,
 * so a server render and the client render that hydrates it cannot disagree
 * about what the price is.
 *
 * **It is set on the request as well as the response.** Without the first half
 * the render this very request produces would still see no cookie and show the
 * default, and the hint would only take effect on the second page view — which
 * is the kind of bug that looks like "it works on refresh".
 *
 * The header is Vercel's `x-vercel-ip-country`. Absent — locally, or behind
 * anything else — the default is the United States, which is the captain's
 * default and not a guess about where anybody is.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  MARKET_COOKIE,
  MARKET_COOKIE_MAX_AGE,
  hasMarketCookie,
  marketIdForCountry,
  withMarketCookie,
} from "./lib/shop/market";

export function proxy(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  // A choice already made — the buyer's or an earlier request's. Never
  // overwritten, which is the whole of "remembered".
  if (hasMarketCookie(cookie)) return NextResponse.next();

  const id = marketIdForCountry(request.headers.get("x-vercel-ip-country"));
  const headers = new Headers(request.headers);
  headers.set("cookie", withMarketCookie(cookie, id));

  const response = NextResponse.next({ request: { headers } });
  response.cookies.set({
    name: MARKET_COOKIE,
    value: id,
    path: "/",
    maxAge: MARKET_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Readable by the page on purpose: it is a display preference, not a
    // credential, and `httpOnly` would stop the one place that needs to read
    // it without a round trip.
    httpOnly: false,
  });
  return response;
}

/**
 * Pages and the API, but not assets — and not the route that sets this cookie.
 *
 * `app/api/checkout/route.ts` reads the cookie to decide what currency to
 * charge in, so the API is in: a till that saw no cookie would quote the
 * default while the page the buyer is looking at quotes something else.
 *
 * **`/api/market` is out**, because it is the one request whose whole purpose
 * is to write this cookie. Running the edge over it means a first-time visitor
 * pressing the pill gets two `Set-Cookie` headers for the same name — the
 * hint's and their choice. The browser applies the last and the right value
 * wins, so this is tidiness rather than a bug, but a response that states a
 * preference twice is a response somebody will eventually read the wrong half
 * of.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/market).*)"],
};
