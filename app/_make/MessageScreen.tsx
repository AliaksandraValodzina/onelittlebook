"use client";

/**
 * **Step four: "Write your message" — the one thing the flow this was drawn
 * from does not do.**
 *
 * The artefact is specific about why this screen earns its place: the seller it
 * was traced from shows *no limit at all*, so an over-long dedication is
 * discovered when the printed book arrives. This one counts down and warns.
 *
 * **The counter and the limit are one function.** `acceptLines` produces both
 * what will print and the numbers beside the box, so there is no second
 * implementation of "how much fits" to disagree with the first in front of a
 * paying customer. It is enforced three times for the reasons
 * `TextSlotLayer.maxLines` lays out — here, in `validateBookFill` before money
 * changes hands, and in the renderer, which throws. **This screen is the form
 * half of that; neither half may be removed.**
 *
 * It clamps on blur, not on every keystroke: clamping as somebody types fights
 * the cursor whenever they edit the middle of a line.
 *
 * **The photograph is not here.** It is on the opening spread, with this message
 * beside it, at `/preview` — the extras sit on the page they affect, which is
 * the research decision `app/_book/Controls.tsx` argues for and
 * `test/book-flow.test.tsx` asserts. The artefact's own fourth screen asks for
 * the message alone, which is why these agree.
 */

import { useMemo, useState } from "react";
import { acceptLines, explainLines } from "../../lib/editor/lines";
import { dedicationOf, dedicationSlot } from "../../lib/book/order";
import { FACES } from "../../lib/render/fonts";
import { next, stepFor } from "../../lib/shop/steps";
import { useBook } from "../_book/BookProvider";
import Screen from "./Screen";

const step = stepFor("message")!;

export default function MessageScreen({ closeTo }: { closeTo: string }) {
  const { book, order, setDedication, fill, flush } = useBook();
  const slot = dedicationSlot(book);
  const onward = next("message")!;
  const [touched, setTouched] = useState(false);
  /**
   * **What is in the box**, which is the book's own verse until the buyer
   * writes — `dedicationOf` is the one answer, shared with the panel beside the
   * preview and with `toBookFill`, so no screen can show one dedication while
   * another prints a different one.
   */
  const written = dedicationOf(order, book);
  const accepted = useMemo(() => (slot ? acceptLines(slot, written) : null), [slot, written]);

  if (!slot || !accepted) {
    return (
      <Screen step={step} closeTo={closeTo} width={620}>
        <p className="say">This book has no dedication page, so there is nothing to write.</p>
        <a className="btn wide" href={onward.path} onClick={flush} data-testid="next">
          Next
        </a>
      </Screen>
    );
  }

  const face = FACES[slot.font]?.family ?? slot.font;
  const explanation = explainLines(accepted, face);
  const who = fill.name.length > 0 ? fill.name : "them";

  return (
    <Screen step={step} closeTo={closeTo} width={620}>
      <p className="say">
        It goes on the first page, opposite your photograph.
        {/*
          Said only when the box holds the book's own words, because that is the
          only time it is true — and it has to be said: a buyer who does not
          know the text is theirs will leave it alone out of politeness.
        */}
        {order.dedicationWritten ? null : " We have started it off — change it, or clear it and write your own."}
      </p>

      <label className="sr-only" htmlFor="dedication">
        Your message to {who}
      </label>
      <textarea
        id="dedication"
        className={`fld ${written.length > 0 ? "on" : ""} min-h-[140px] leading-[1.7]`}
        value={written}
        onChange={(e) => setDedication(e.target.value)}
        onBlur={() => {
          setTouched(true);
          // What will print, put back in the box.
          if (accepted.text !== written) setDedication(accepted.text);
        }}
        rows={6}
        data-testid="dedication"
        aria-describedby="dedication-count"
        placeholder={`Dear ${who},\n\nYou arrived on a Tuesday and nothing has been quiet since.\n\nLove, Mum and Dad`}
      />
      <p id="dedication-count" role="status" className="count">
        <span data-testid="dedication-count">
          {`${accepted.lines} of ${slot.maxLines ?? 1} lines · ${accepted.chars} of ${slot.maxChars} characters`}
        </span>
        {explanation ? (
          <span data-testid="dedication-notice" className="warn ml-3">
            {explanation}
          </span>
        ) : null}
      </p>
      <p className="warn" data-testid="dedication-warning">
        {touched || written.length > 0
          ? "Read it back on the page before you order — a printed page cannot be changed."
          : "Whatever you write is set on the page itself. Read it back there before you order."}
      </p>

      <a className="btn wide mt-[16px]" href={onward.path} onClick={flush} data-testid="next">
        Next
      </a>
    </Screen>
  );
}
