"use client";

/**
 * **The one request that sends an order, and the only place it is made.**
 *
 * It used to live in `./Bar.tsx`, which was the right home while `Continue`
 * went straight to the till. The approved flow puts a basket between them, so
 * the request moved here rather than being copied: *two submit buttons for one
 * order is two places for the order to be sent from*, and `./Confirm.tsx`'s own
 * test asserts that property of the confirm screen. This keeps it true one
 * level up — there is one `fetch` to `/api/checkout` in the whole product.
 *
 * **It never renders anything resembling a confirmation.** The only two
 * destinations are Stripe's own hosted page and `/checkout`, which is the
 * honest refusal; `lib/checkout.ts` exists to make sure there is no third.
 *
 * Two refusals, told apart deliberately:
 *
 * - **about the shop** (no Stripe key, no order store, Stripe would not
 *   answer): the buyer goes to `/checkout`, the page that explains those and
 *   says nothing has been charged.
 * - **about this order** (a photograph the server will not accept, an order
 *   that no longer validates): the message comes back as `problem` and the
 *   buyer keeps their place, because nothing is wrong with the shop and
 *   navigating away would lose them the screen they can fix it on.
 */

import { useCallback, useState } from "react";
import { bytesOf } from "../../lib/book/order";
import { useBook } from "./BookProvider";

export interface Till {
  /** Send the order and go where the answer says. */
  buy: () => Promise<void>;
  busy: boolean;
  /** Wrong with *this order*, shown in place. Never a reason to navigate. */
  problem: string | null;
}

export function useTill(): Till {
  const { order, fill } = useBook();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const buy = useCallback(async () => {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fill, editionId: order.editionId, photos: bytesOf(order) }),
      });
      const answer: unknown = await response.json().catch(() => null);
      const url = (answer as { url?: string } | null)?.url;
      if (response.ok && typeof url === "string") {
        // Stripe's hosted page.
        window.location.assign(url);
        return;
      }

      const ref = (answer as { ref?: string } | null)?.ref;
      if (response.status === 409 && ref) {
        setProblem(`That order has already been paid for — it is ${ref}. Check your email.`);
        return;
      }
      // **A market the shop cannot post to yet.** About this order rather than
      // about the shop, and recoverable without leaving: the market control is
      // in the masthead above this screen, so the buyer can change it and
      // press again. Sending them to `/checkout` would show them a page about
      // missing configuration, which is not their problem and not true.
      const state = (answer as { state?: string } | null)?.state;
      if (response.status === 409 && state === "market closed") {
        const detail = (answer as { detail?: string } | null)?.detail;
        setProblem(detail ?? "We cannot post to the market you have chosen yet.");
        return;
      }
      if (response.status === 422) {
        const problems = (answer as { problems?: Array<{ code?: string }> } | null)?.problems;
        setProblem(
          "The shop would not accept this order: " +
            (problems?.map((p) => p.code).filter(Boolean).join(", ") ?? "it did not validate") +
            ". Nothing has been charged.",
        );
        return;
      }
      // Everything else is about the shop rather than about this order, and
      // `/checkout` is the page that says so plainly.
      window.location.assign("/checkout");
    } catch {
      setProblem("The till could not be reached. Nothing has been charged — try again.");
    } finally {
      setBusy(false);
    }
  }, [fill, order]);

  return { buy, busy, problem };
}
