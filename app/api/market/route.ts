/**
 * **Changing the market, as a form post and nothing cleverer.**
 *
 * The masthead's control is a `<form method="post">` with one submit button per
 * market, so it works with no JavaScript, is announced as the navigation it is,
 * and renders identically in `renderToStaticMarkup` — which is how this
 * repository tests its React. A client component with an `onChange` would have
 * needed a browser to prove it does anything.
 *
 * The answer is a **303**, which is the right redirect after a POST: it turns
 * the next request into a `GET`, so a reload does not resubmit. The buyer lands
 * back on the page they pressed from with the new cookie already set.
 *
 * **Where it sends them back to is taken from the `Referer`, and checked.** The
 * form carries no destination field: the page the buyer pressed from is a fact
 * the browser already states, and a hidden field would mean every page that
 * draws the masthead having to know and pass its own path. Either way the value
 * comes from whoever owns the browser, so it is checked — an unchecked
 * redirect target is an open redirect, which here would mean pressing a market
 * pill and landing on somebody else's site. Only a path on this origin is
 * accepted; anything else is the front door.
 */

import { NextResponse } from "next/server";
import {
  MARKET_COOKIE,
  MARKET_COOKIE_MAX_AGE,
  isMarketId,
  DEFAULT_MARKET_ID,
} from "../../../lib/shop/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The path to send the buyer back to, out of a `Referer` and an origin.
 *
 * Pure and exported so the interesting line is testable without a server. A
 * referer from anywhere but this origin is discarded rather than followed —
 * that is the open-redirect check, and it is a comparison of origins rather
 * than a pattern over a string because a pattern over a URL is how these go
 * wrong (`https://onelittlebook.com.evil.example` matches a careless prefix).
 */
export function backTo(referer: string | null, here: string): string {
  if (!referer) return "/";
  let from: URL;
  let origin: URL;
  try {
    from = new URL(referer);
    origin = new URL(here);
  } catch {
    return "/";
  }
  if (from.origin !== origin.origin) return "/";
  return `${from.pathname}${from.search}${from.hash}`;
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const asked = form?.get("market");
  const id = isMarketId(asked) ? asked : DEFAULT_MARKET_ID;
  const back = backTo(request.headers.get("referer"), request.url);

  const response = NextResponse.redirect(new URL(back, request.url), 303);
  response.cookies.set({
    name: MARKET_COOKIE,
    value: id,
    path: "/",
    maxAge: MARKET_COOKIE_MAX_AGE,
    sameSite: "lax",
    // A display preference rather than a credential — `proxy.ts` says why it
    // is deliberately readable by the page.
    httpOnly: false,
  });
  return response;
}

/** A hand-typed URL is not a blank page. Choosing a market is a POST. */
export async function GET() {
  return NextResponse.json(
    { ok: false, detail: "Choosing a market is a POST from the control in the header." },
    { status: 405, headers: { allow: "POST" } },
  );
}
