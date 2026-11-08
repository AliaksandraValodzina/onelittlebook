/**
 * **The till.**
 *
 * One `POST`, and it does four things in an order that matters:
 *
 * 1. **Refuse if the shop is not open.** `lib/checkout.ts` decides, over the
 *    whole money path and not just the Stripe key, and with anything missing
 *    this answers 503 and says nothing has been charged. There is no local
 *    pretend-success path: a developer with no keys sees exactly what a
 *    customer would see on a half-configured deploy, which is the only way
 *    that state ever gets noticed.
 * 2. **Refuse an order that cannot be printed**, before anything is written
 *    anywhere and before a byte of photograph is hashed. `printProblems` is
 *    the same judgement the print route makes, so an order that takes money
 *    is an order that renders.
 * 3. **Write the order down, and the photograph with it.** This is the moment
 *    the buyer's work stops living only in their tab. It happens *before* the
 *    session is created, because an order that exists without a payment is a
 *    row the captain can see and ignore, and a payment that arrives for an
 *    order nobody wrote down is money with no book attached to it.
 * 4. **Create the hosted Checkout Session** and hand back its URL.
 *
 * **Idempotency, twice over.** `orderFingerprint` is the Stripe idempotency
 * key, as the brief asks, so a double-click gets the same session back rather
 * than a second charge. `claim` derives the order's reference from that same
 * fingerprint, so the double-click also writes one record rather than two.
 * Neither needs a lock, and both are properties of the data.
 *
 * **Nothing here marks anything paid.** The buyer leaves for Stripe's page and
 * the only thing allowed to believe they paid is the signature-verified
 * webhook. `app/api/stripe/webhook/route.ts` carries that argument.
 *
 * ## The market comes off the request, not out of the body
 *
 * The currency and the allowed countries follow the market, and the market is
 * read from **the same cookie the page the buyer is looking at was rendered
 * from** rather than posted up with the order. Two reasons, and the first is
 * the one that matters: the page and the till then cannot disagree, because
 * there is one input and not two. The second is that a field in the body would
 * be one more thing to validate for no gain — a crafted request can set a
 * cookie just as easily as a field, and what actually bounds the arbitrage is
 * that each market's checkout accepts an address in that market's countries
 * only. Choosing the sterling price means delivering to the United Kingdom.
 *
 * A market whose countries nobody has named cannot be checked out, and it is
 * refused **here**, before an order is written — not left to Stripe to reject a
 * session with an empty country list. The buyer gets the real reason.
 */

import { NextResponse } from "next/server";
import { FIRST_BOOK } from "../../../templates/first-book";
import { baseUrl, checkoutState, copyFor, statusFor } from "../../../lib/checkout";
import { printProblems } from "../../../lib/book/print";
import { isEdition, editionOf } from "../../../lib/book/editions";
import { SuppliedAssetRejected, verifySupplied } from "../../../lib/assets/supplied";
import { attachSession, claim, storeFromEnv } from "../../../lib/orders/store";
import { createSession, marketIsOpen, sessionParams } from "../../../lib/stripe/session";
import { marketFromCookieHeader } from "../../../lib/shop/market";
import type { BookFill } from "../../../lib/book/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One resized photograph as base64, with room. The same ceiling the print route uses. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

function refusal(state: ReturnType<typeof checkoutState>) {
  const copy = copyFor(state);
  return NextResponse.json(
    {
      ok: false,
      state: state.kind,
      heading: copy.heading,
      detail: copy.body,
      // Named so a deployer can see exactly which rows are empty, without the
      // response ever carrying a value.
      missing: state.kind === "unconfigured" ? state.missing : [],
    },
    { status: statusFor(state) },
  );
}

export async function POST(request: Request) {
  const state = checkoutState(process.env);

  // A browser form with no JavaScript wants a page it can read; `fetch` wants
  // JSON it can act on. A 303 is the right redirect after a POST: it turns the
  // next request into a GET, so a reload does not resubmit.
  const wantsHtml = (request.headers.get("accept") ?? "").includes("text/html");
  if (state.kind === "unconfigured" && wantsHtml) {
    return NextResponse.redirect(new URL(`/checkout?state=${state.kind}`, request.url), 303);
  }
  if (state.kind === "unconfigured") return refusal(state);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    if (wantsHtml) return NextResponse.redirect(new URL("/checkout", request.url), 303);
    return NextResponse.json({ ok: false, error: "not JSON" }, { status: 400 });
  }
  const { fill, photos, editionId } = (body ?? {}) as {
    fill?: unknown;
    photos?: unknown;
    editionId?: unknown;
  };
  if (!fill || typeof fill !== "object") {
    return NextResponse.json({ ok: false, error: "no fill" }, { status: 400 });
  }
  if (!isEdition(editionId)) {
    // Never guessed. `lib/book/editions.ts` is explicit that an unknown id
    // would price the order at whatever `editionOf` falls back to, and
    // guessing a price is the one thing this codebase refuses to do.
    return NextResponse.json({ ok: false, error: "no such edition" }, { status: 400 });
  }
  const asFill = fill as BookFill;

  const problems = printProblems(FIRST_BOOK, asFill);
  if (problems.length) {
    return NextResponse.json({ ok: false, error: "not printable", problems }, { status: 422 });
  }

  // Verified against the digest, the type and the pixel size the fill declares
  // — the same gate the print route puts in front of the renderer, here in
  // front of the bucket. Bytes that do not match what was approved must never
  // become the thing that is printed.
  let supplied: Map<string, Uint8Array>;
  try {
    supplied = verifySupplied(
      asFill.photo?.asset ? [asFill.photo.asset] : [],
      (photos ?? {}) as Record<string, unknown>,
    );
  } catch (error) {
    if (error instanceof SuppliedAssetRejected) {
      return NextResponse.json(
        { ok: false, error: "photograph refused", problems: [{ code: error.code, detail: error.message }] },
        { status: 422 },
      );
    }
    throw error;
  }

  const storeState = storeFromEnv(process.env);
  if (storeState.kind !== "ready") {
    // Unreachable while `REQUIRED` includes the store's variables, and checked
    // anyway: the two lists agreeing is a fact about `lib/checkout.ts` that
    // this route should not have to assume.
    return refusal({ kind: "unconfigured", missing: storeState.missing });
  }
  const store = storeState.store;
  const edition = editionOf(editionId as string);
  const market = marketFromCookieHeader(request.headers.get("cookie"));
  const now = new Date();

  if (!marketIsOpen(market)) {
    // Priced but not postable. `lib/shop/market.ts` § shipsNeeds is the
    // sentence saying whose fact is missing, and it goes back verbatim: the
    // buyer is owed the reason, and the reason is that nobody has checked what
    // it costs to get a book to them.
    return NextResponse.json(
      {
        ok: false,
        state: "market closed",
        heading: `We cannot post to ${market.label} yet`,
        detail:
          `Nothing has been charged. We need ${market.shipsNeeds ?? "the shipping table"}`,
        missing: [],
      },
      { status: 409 },
    );
  }

  try {
    const { record } = await claim(store, asFill, editionId as string, market.id, now);

    // Already paid for. A second press of the button does not start a second
    // order and does not open a second till; it goes to the order that exists.
    if (record.payment === "paid") {
      return NextResponse.json(
        { ok: false, state: "already paid", ref: record.ref, detail: "That order has already been paid for." },
        { status: 409 },
      );
    }

    const photo = asFill.photo?.asset;
    const bytes = photo ? supplied.get(photo.sha256) : undefined;
    if (photo && bytes) await store.putPhoto(photo, bytes);

    const base = baseUrl(process.env, request);
    const session = await createSession(
      sessionParams({
        record,
        edition,
        market,
        // The session id is **required** to read the order page back, so the
        // link Stripe returns to is the one thing that opens it. A reference
        // alone is short enough to be guessed at; `app/order/[ref]/page.tsx`
        // says why that matters.
        successUrl: `${base}/order/${record.ref}?session={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/preview`,
      }),
      {
        secretKey: process.env.STRIPE_SECRET_KEY!.trim(),
        // **The fingerprint, the edition and the market.** The fingerprint
        // alone is what the brief named and it is still what makes a
        // double-click one charge: identical inputs produce an identical key
        // and Stripe replays its first answer. But a fingerprint hashes the
        // *fill*, and neither the edition nor the market is in a fill — so a
        // buyer who switched the hardcover on, or moved the market pill, and
        // pressed again would have been handed back the session created at the
        // old price, in the old currency. Naming all three keeps the
        // double-click idempotent and lets a genuinely repriced order open its
        // own session. `lib/orders/store.ts` § claim has the other half.
        idempotencyKey: `${record.fingerprint}-${edition.id}-${market.id}`,
      },
    );
    if (!session.ok) {
      return NextResponse.json(
        { ok: false, state: state.kind, heading: copyFor(state).heading, detail: session.detail },
        { status: statusFor(state) },
      );
    }

    await attachSession(store, record, session.id, now);
    return NextResponse.json({ ok: true, ref: record.ref, url: session.url }, { status: 200 });
  } catch (error) {
    // A bucket that will not answer is a failure *before* any money moved, and
    // saying so is the whole job of this branch. The message is the provider's
    // own and carries no credential — see `lib/orders/r2.ts` § refuse.
    return NextResponse.json(
      {
        ok: false,
        state: state.kind,
        heading: copyFor(state).heading,
        detail: (error as Error).message,
      },
      { status: statusFor(state) },
    );
  }
}

/** A hand-typed URL is not a blank page. Ordering is a POST. */
export async function GET() {
  const state = checkoutState(process.env);
  return NextResponse.json(
    { ok: false, state: state.kind, detail: "Ordering is a POST. Nothing has been charged." },
    { status: 405, headers: { allow: "POST" } },
  );
}
