"use client";

/**
 * **Step three: "About the book" — one optional field, and it says so.**
 *
 * The artefact's third screen is two fields and it drops one of them: there is
 * no language choice, because the shop ships one language, and a question with
 * one answer is a question that should not be asked. What is left is *who is
 * giving this book*, which the captain kept because it is the field that turns
 * the book into a gift — and because the opening spread already has a slot for
 * it.
 *
 * **It is optional and nothing stops here.** `ASKS` in `lib/book/slots.ts`
 * decides what an order requires and the from-line is not on that list; a
 * nice-to-have that blocks the way on is a reason to leave. *Next* always goes.
 *
 * The limit is the slot's own and it is clamped on blur rather than on every
 * keystroke — `app/_book/Controls.tsx` § DedicationControl carries the argument
 * for why clamping as somebody types fights their cursor.
 */

import { useMemo, useState } from "react";
import { acceptLines, explainLines } from "../../lib/editor/lines";
import { fromSlot } from "../../lib/book/order";
import { FACES } from "../../lib/render/fonts";
import { next, stepFor } from "../../lib/shop/steps";
import { useBook } from "../_book/BookProvider";
import Screen from "./Screen";

const step = stepFor("about")!;

export default function AboutScreen({ closeTo }: { closeTo: string }) {
  const { book, order, setFrom, fill, flush } = useBook();
  const slot = fromSlot(book);
  const onward = next("about")!;
  const [, setTouched] = useState(false);
  const accepted = useMemo(
    () => (slot ? acceptLines(slot, order.from) : null),
    [slot, order.from],
  );

  const who = fill.name.length > 0 ? fill.name : "them";
  const face = slot ? (FACES[slot.font]?.family ?? slot.font) : "";
  const explanation = accepted && slot ? explainLines(accepted, face) : null;

  return (
    <Screen step={step} closeTo={closeTo} width={560}>
      {slot && accepted ? (
        <>
          <label className="f" htmlFor="from-line">
            Who is giving {who} this book?
          </label>
          <input
            id="from-line"
            type="text"
            className={`fld ${order.from.length > 0 ? "on" : ""}`}
            value={order.from}
            onChange={(e) => setFrom(e.target.value)}
            onBlur={() => {
              setTouched(true);
              if (accepted.text !== order.from) setFrom(accepted.text);
            }}
            data-testid="from"
            aria-describedby="from-count"
            placeholder="e.g. Grandma, Mum and Dad"
          />
          <p id="from-count" role="status" className="foot text-left mt-[7px]">
            Optional. It is printed under your message on the first page —{" "}
            <span data-testid="from-count">
              {accepted.chars} of {slot.maxChars} characters, in {face}
            </span>
            .
            {explanation ? (
              <span data-testid="from-notice" className="warn ml-2">
                {explanation}
              </span>
            ) : null}
          </p>
        </>
      ) : (
        <p className="say">
          This book has no from-line, so there is nothing to ask here.
        </p>
      )}

      <a className="btn wide mt-[20px]" href={onward.path} onClick={flush} data-testid="next">
        Next
      </a>
    </Screen>
  );
}
