/**
 * **The hosted Checkout Session: Stripe's page, not ours.**
 *
 * The brief is unambiguous and it is the only sane reading of the risk: *use
 * Stripe's hosted Checkout Session, do not build a card form, do not handle a
 * PAN, do not store a card.* So nothing in this repository ever sees a card
 * number. What goes out is an amount, a line of copy and two URLs; what comes
 * back is a URL to send the buyer to. The card is typed on `checkout.stripe.com`
 * and `lib/orders/record.ts` has nowhere to put one even if it arrived.
 *
 * ## Why there is no `stripe` dependency
 *
 * Two calls — create a session, read one back — against a form-encoded API
 * whose bodies are written out in `./form.ts` and asserted in a test. The SDK
 * would bring a credential-provider chain, a retry layer and a telemetry
 * client to make them, and would make the one part worth testing (*exactly
 * what is on the wire*) reachable only through a mock of itself. The seam here
 * is `fetch`, which a test can simply hand a function.
 *
 * ## The secret key is read in one place and never leaves it
 *
 * It arrives as an argument, goes into an `authorization` header, and appears
 * in no error message, no response and no log line. `test/stripe-session.test.ts`
 * asserts that — the repository is public and so are its logs.
 */

import { formEncode, type Nested } from "./form";
import { priceIn, priceOf, type Edition } from "../book/editions";
import { MARKET_LIST, type Market } from "../shop/market";
import { ratesFor } from "../shop/shipping";
import type { OrderRecord } from "../orders/record";

const API = "https://api.stripe.com/v1";

/**
 * **Where this shop will post a book to, which the chosen market decides.**
 *
 * It used to be `["AU"]` and a paragraph of evidence for why: the prices were
 * in AUD and the book was printed in Australia. Both halves have changed —
 * the book is printed in the United States and there are four markets — but
 * the *principle* behind that list has not moved an inch, and it is the reason
 * this is still a list and not a wildcard: **taking money from a buyer in a
 * country whose delivery nobody has looked up is the shape of promise this
 * codebase refuses to make.** `lib/product.ts`'s `DELIVERY` fact is still
 * unconfirmed and `lib/shop/shipping.ts` § `RATES` is still null.
 *
 * So each market names its own countries in `lib/shop/market.ts`, and
 * "everywhere else" names none yet — which closes its till rather than
 * guessing. `app/delivery/page.tsx` renders **the same list** rather than
 * restating it, so the policy page and the till cannot come to different
 * conclusions about who can buy.
 */
export function shipsTo(market: Market): readonly string[] {
  return market.ships;
}

/**
 * Every country any market will post to. For a page that lists them all.
 *
 * Derived rather than typed, so a country added to a market appears here with
 * no second edit — the mistake the old single `SHIPS_TO` could not make and a
 * second hand-written list certainly would.
 */
export const EVERY_SHIPPING_COUNTRY: readonly string[] = [
  ...new Set(MARKET_LIST.flatMap((market) => market.ships)),
];

/**
 * Whether this market's checkout can be opened at all.
 *
 * Defined in `lib/shop/market.ts` — a fact about a `Market`, and the basket
 * asks it too — and re-exported here because this is the module that would
 * otherwise create a session Stripe must refuse. `app/api/checkout/route.ts`
 * refuses before writing an order rather than letting Stripe reject a session
 * with an empty country list, because the buyer deserves the real reason and
 * not Stripe's.
 */
export { marketIsOpen } from "../shop/market";

/**
 * **The postage options on the session, which there are none of yet.**
 *
 * While `lib/shop/shipping.ts` § `RATES` is null the listed price includes
 * delivery and the session carries no `shipping_options` — exactly what it
 * carried when the shop was Australian, and the only honest configuration for
 * a shop with no rate table. Filling `RATES` in turns these on with no edit
 * here, which is the whole point of the shape it is left in.
 */
export function shippingOptions(market: Market): Nested {
  const rates = ratesFor(market);
  if (!rates || rates.length === 0) return {};
  const out: Nested = {};
  rates.forEach((rate, index) => {
    const at = `shipping_options[${index}][shipping_rate_data]`;
    out[`${at}[display_name]`] = rate.label;
    out[`${at}[type]`] = "fixed_amount";
    out[`${at}[fixed_amount][currency]`] = rate.currency.toLowerCase();
    out[`${at}[fixed_amount][amount]`] = minorUnits(rate.amount);
    out[`${at}[delivery_estimate][minimum][unit]`] = "business_day";
    out[`${at}[delivery_estimate][minimum][value]`] = rate.transitDays[0];
    out[`${at}[delivery_estimate][maximum][unit]`] = "business_day";
    out[`${at}[delivery_estimate][maximum][value]`] = rate.transitDays[1];
  });
  return out;
}

/** Whole units into the minor units Stripe charges in. `USD 49` → `4900`. */
export function minorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * The body of the create-session request, as a plain object a test can read.
 *
 * Separated from the request so that every claim about what is being asked for
 * — the currency, the amount, the shipping collection, the reference carried
 * in metadata — is checkable without a network.
 */
export function sessionParams(options: {
  record: OrderRecord;
  edition: Edition;
  /**
   * The market the buyer was shown, which decides the currency and the
   * countries.
   *
   * **Required, with no default**, for the reason the old single `price` field
   * on an `Edition` was removed: a caller with no market to hand is a caller
   * about to charge in the wrong currency, and that should not compile. It is
   * also not derived from the record's `asked` currency — USD is two markets
   * whose country lists differ, so the market is the fact and the currency is
   * a consequence of it.
   */
  market: Market;
  successUrl: string;
  cancelUrl: string;
}): Nested {
  const { record, edition, market } = options;
  const price = priceIn(edition, market);
  return {
    mode: "payment",
    // Stripe's hosted page always collects an email in payment mode, which is
    // the email the order confirmation goes to — so there is no field for one
    // on this site, which is the point: no account, nothing to sign up for.
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    client_reference_id: record.ref,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": price.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": minorUnits(price.amount),
    // The child's name is in the line item on purpose: the buyer's card
    // statement and Stripe's own receipt then say which book this was, which
    // is the difference between a recognised charge and a chargeback.
    "line_items[0][price_data][product_data][name]":
      `${record.fill.name ? `${record.fill.name}'s book` : "A personalised book"} — ${edition.label}`,
    "line_items[0][price_data][product_data][description]": edition.blueprint,
    "shipping_address_collection[allowed_countries]": [...shipsTo(market)],
    billing_address_collection: "auto",
    ...shippingOptions(market),
    // Carried on the session **and** on the payment, so the reference is
    // findable from either side of Stripe's dashboard.
    "metadata[ref]": record.ref,
    "metadata[fingerprint]": record.fingerprint,
    "metadata[bookRev]": record.fill.bookRev,
    "metadata[edition]": edition.id,
    // Which market priced this, so the dashboard answers "why was this one in
    // sterling" without anybody having to infer it from the currency.
    "metadata[market]": market.id,
    "payment_intent_data[metadata][ref]": record.ref,
    "payment_intent_data[description]": `${record.ref} — ${edition.label}, ${priceOf(price)}`,
  };
}

export type SessionResult =
  | { ok: true; id: string; url: string }
  /** Stripe said no. `detail` is safe to show a deployer and carries no key. */
  | { ok: false; detail: string };

export interface StripeCall {
  secretKey: string;
  /**
   * **`orderFingerprint`, as the brief asks.**
   *
   * Stripe holds an idempotency key for 24 hours and replays the first
   * response for it, so a double-click — or a buyer reloading the step — gets
   * the session that already exists rather than a second one. The key is the
   * fill's own content hash, which means two presses of the same button are
   * the same request *by construction* and not by a flag somebody remembered
   * to set.
   */
  idempotencyKey: string;
  fetchLike?: typeof fetch;
}

async function call(
  path: string,
  init: { method: string; body?: string; idempotencyKey?: string },
  secretKey: string,
  fetchLike: typeof fetch,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetchLike(`${API}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
      ...(init.idempotencyKey ? { "idempotency-key": init.idempotencyKey } : {}),
    },
    body: init.body,
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: { message: text.slice(0, 300) } };
  }
  return { ok: response.ok, status: response.status, json };
}

/** Stripe's own message for a refusal, or a sentence saying there wasn't one. */
function refusalOf(json: unknown, status: number): string {
  const message = (json as { error?: { message?: string } } | null)?.error?.message;
  return message ? message : `Stripe answered HTTP ${status} with no message.`;
}

export async function createSession(
  params: Nested,
  options: StripeCall,
): Promise<SessionResult> {
  const result = await call(
    "/checkout/sessions",
    { method: "POST", body: formEncode(params), idempotencyKey: options.idempotencyKey },
    options.secretKey,
    options.fetchLike ?? fetch,
  );
  if (!result.ok) return { ok: false, detail: refusalOf(result.json, result.status) };
  const session = result.json as { id?: unknown; url?: unknown };
  if (typeof session.id !== "string" || typeof session.url !== "string") {
    return { ok: false, detail: "Stripe created a session with no id or no URL." };
  }
  return { ok: true, id: session.id, url: session.url };
}
