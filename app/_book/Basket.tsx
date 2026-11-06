"use client";

/**
 * **Step seven: the basket.**
 *
 * The artefact follows the better of the two baskets the captain compared:
 * cream ground, the book as a white card on the left, the order summary on the
 * right, and — the one genuinely useful thing taken from the other — **show
 * what you chose**, because a personalised item must let the buyer re-read what
 * is about to be printed.
 *
 * ## Three things the artefact asks for that are not here, each for a reason
 *
 * **The express wallet buttons.** The artefact draws *Pay* and *PayPal* above
 * an ordinary *Checkout*. This shop charges through a **hosted Stripe Checkout
 * Session** — see `lib/stripe/session.ts` — and that page offers whichever
 * wallets the account has enabled, on Stripe's own domain, with Stripe's own
 * buttons. A PayPal button here that led to a Stripe page would be a lie about
 * what is about to happen, and there is no PayPal integration to make it true.
 * So there is one way on and a line saying where the card is typed.
 *
 * **"Skip the queue" and "shipping protection".** The artefact itself leaves
 * both out and says why, and the captain's list of things that must not appear
 * anywhere names them: one works only by implying everybody else waits longer,
 * contradicting the dispatch window promised on every page; the other charges
 * two dollars to insure a promise already made for nothing.
 *
 * **The free-shipping progress bar.** Out until there is a second title to make
 * it reachable. The line where "add another book" belongs is in its place,
 * which is the artefact's own instruction.
 *
 * ## It renders the whole basket even when the order is not finished
 *
 * A basket that showed "nothing here yet" until every ask was answered would
 * hide the thing the buyer came to check. So the book, what they chose and the
 * price are always shown, and the **way on** is what changes: a dead button
 * naming what is outstanding, in the register `./Bar.tsx` argues for.
 */

import { useState } from "react";
import { editionOf, priceOf } from "../../lib/book/editions";
import { outstanding } from "../../lib/book/order";
import { nameSlotFont } from "../../lib/book/name";
import { trimInches } from "../../lib/shop/copy";
import { CHANGE_WINDOW_HOURS, DISPATCH_WINDOW } from "../../lib/email/order";
import { FACES } from "../../lib/render/fonts";
import { WHEN_THEY_WERE_SMALL, pathOf } from "../../lib/shop/shelf";
import { STEPS, stepFor } from "../../lib/shop/steps";
import Cover from "../_shop/Cover";
import Confirm from "./Confirm";
import { useBook } from "./BookProvider";
import { useTill } from "./till";

const step = stepFor("basket")!;

export default function Basket() {
  const { book, order, fill, ready } = useBook();
  const { buy, busy, problem } = useTill();
  const [confirming, setConfirming] = useState(false);
  const edition = editionOf(order.editionId);
  const missing = outstanding(order, book);
  const look = book.looks.find((l) => l.id === fill.lookId);
  const cover = book.covers.find((c) => c.id === fill.coverId);
  const gender = (book.genders ?? []).find((g) => g.id === order.genderId);
  const named = fill.name.length > 0 ? fill.name : "Your";
  const lookStep = STEPS.find((s) => s.id === "look")!;

  if (confirming) {
    return (
      <div className="stage">
        <div className="modal" data-testid="screen-confirm">
          <div className="bar">
            <span className="back" aria-hidden="true" />
            <h4>Check the spelling</h4>
            <span className="x" aria-hidden="true" />
          </div>
          <div className="body">
            <Confirm
              // `fill.name`, never what was typed: this screen shows what will
              // be printed, and the two differ exactly when the press cannot
              // write what somebody typed.
              name={fill.name}
              face={FACES[nameSlotFont(book)]?.family}
              edition={edition}
              onBack={() => setConfirming(false)}
              onConfirm={() => void buy()}
              busy={busy}
              problem={problem}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="basket" data-testid={`screen-${step.id}`}>
        <div className="head">
          <h1 className="dsp">{step.title} (1)</h1>
          <a href="/#shelf">Continue shopping →</a>
        </div>

        <div className="grid">
          <div className="line">
            <div className="thumb">
              <Cover
                book={book}
                name={fill.name}
                lookId={fill.lookId}
                coverId={fill.coverId}
              />
            </div>
            <div className="of">
              <div className="top">
                <b>{named === "Your" ? `${book.name}` : `${named}’s book`}</b>
              </div>
              <p className="spec">
                {edition.label} · {book.pages.length} pages · {trimInches} in square
              </p>

              {/*
                **Show what you chose**, open by default. It is not a disclosure
                hiding clutter — it is the last written record of what is about
                to be printed, and a buyer who has to find it is a buyer who
                does not read it.
              */}
              <details className="q" open data-testid="what-you-chose">
                <summary>Show what you chose</summary>
                <dl className="chose">
                  <dt>Name</dt>
                  <dd data-testid="chose-name">
                    {fill.name.length > 0 ? fill.name : "not yet"}
                  </dd>
                  <dt>Look</dt>
                  <dd data-testid="chose-look">
                    {[gender?.label, look?.label].filter(Boolean).join(" · ") || "not yet"}
                  </dd>
                  <dt>Cover</dt>
                  <dd>{cover?.label ?? "not yet"}</dd>
                  <dt>Message</dt>
                  <dd data-testid="chose-message">
                    {fill.dedication.length > 0
                      ? `“${fill.dedication.split("\n")[0]}…”`
                      : "none"}
                  </dd>
                  <dt>From</dt>
                  <dd>{fill.from && fill.from.length > 0 ? fill.from : "not given"}</dd>
                  <dt>Photograph</dt>
                  <dd>{fill.photo ? "yours, on the opening spread" : "none"}</dd>
                </dl>
              </details>

              <p className="mt-3">
                <a className="text-[var(--green)] text-[0.92rem] font-semibold" href={lookStep.path}>
                  Edit the book
                </a>
              </p>
              <p className="amount">{priceOf(edition.price)}</p>
            </div>
          </div>

          <div className="sum">
            <h2 className="dsp">Order summary</h2>
            <div className="row">
              <span>Book</span>
              <span>{priceOf(edition.price)}</span>
            </div>
            <div className="row ruled">
              <span>Shipping</span>
              <span className="text-[var(--mut)]">at checkout</span>
            </div>
            <div className="total">
              <span>Total</span>
              <span>{priceOf(edition.price)}</span>
            </div>

            {ready ? (
              <button
                type="button"
                className="btn wide"
                onClick={() => setConfirming(true)}
                data-testid="checkout"
              >
                Checkout
              </button>
            ) : (
              <>
                <span className="btn wide off" aria-disabled="true" data-testid="checkout">
                  Finish the book first
                </span>
                <p className="mt-2 text-center text-[0.8rem] text-[var(--mut)]" role="status">
                  Still to do: {missing.join(", ")}.{" "}
                  <a className="underline" href={lookStep.path}>
                    Go back to the book
                  </a>
                  .
                </p>
              </>
            )}

            <p className="mt-3 text-center text-[0.84rem] text-[var(--mut)]">
              Card details are typed on Stripe’s own page, which is also where Apple Pay and
              Google Pay appear if your device offers them. This shop never sees them.
            </p>

            <div className="note">
              <p className="m-0 mb-[7px]">
                <b>Check the spelling.</b>{" "}
                {fill.name.length > 0
                  ? `${fill.name} is printed on the cover and through the book.`
                  : "The name is printed on the cover and through the book."}
              </p>
              <p className="m-0">
                Nothing goes to the press for {CHANGE_WINDOW_HOURS} hours — tell us and we will
                fix anything, free. Dispatched in {DISPATCH_WINDOW}.
              </p>
            </div>
          </div>
        </div>

        <p className="later">
          When there is a second title, “Add another book” and the second-book offer belong right
          here — see <a className="underline" href={pathOf(WHEN_THEY_WERE_SMALL)}>the shelf</a>.
        </p>
      </div>
    </div>
  );
}
