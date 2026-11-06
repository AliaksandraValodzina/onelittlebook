"use client";

/**
 * **The shell every screen of the flow wears.**
 *
 * The approved artefact draws each step as a card on a warm grey ground with a
 * bar across the top: a back arrow, the step's own title, and a close. That is
 * what this is, and it is one component because seven screens that each drew
 * their own bar would be seven bars that could disagree about where *back*
 * goes.
 *
 * **Back and close are links, not history.** `router.back()` would send a buyer
 * who arrived on step four from a bookmark out of the shop entirely, and a
 * forward-then-back sequence through a flow with optional steps does not match
 * the step list. The step list in `lib/shop/steps.ts` is the authority on what
 * comes before; close leaves for the book page, which is where they came in.
 *
 * It is a real `<a>` in both cases, so it works with no JavaScript, opens in a
 * new tab, and is announced as navigation.
 */

import { position, previous, type Step } from "../../lib/shop/steps";

export default function Screen({
  step,
  closeTo,
  children,
  width,
}: {
  step: Step;
  /** Where the cross goes. The book page, unless a screen says otherwise. */
  closeTo: string;
  children: React.ReactNode;
  /** The artefact narrows some screens; `max-width` in CSS pixels. */
  width?: number;
}) {
  const back = previous(step.id);

  return (
    <div className="stage">
      <div
        className="modal"
        data-testid={`screen-${step.id}`}
        style={width ? { maxWidth: `${width}px` } : undefined}
      >
        <div className="bar">
          {back ? (
            <a className="back" href={back.path} data-testid="back" aria-label={`Back to ${back.title}`}>
              ←
            </a>
          ) : (
            <span className="back" aria-hidden="true" />
          )}
          <h4>{step.title}</h4>
          <a className="x" href={closeTo} data-testid="close" aria-label="Leave this and go back to the book">
            ✕
          </a>
        </div>
        <div className="body">{children}</div>
      </div>
      {/*
        The counter is here and not in any screen. It is derived from the list's
        own length, so a step added to `STEPS` renumbers every screen at once —
        a flow that said "step 3 of 6" on one screen and "of 7" on the next is
        the commonest way a buyer stops trusting a form.
      */}
      <p className="mt-3 text-[0.8rem] text-[var(--mut)]" data-testid="position">
        {position(step.id)}
      </p>
    </div>
  );
}
