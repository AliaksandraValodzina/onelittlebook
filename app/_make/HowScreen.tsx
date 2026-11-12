"use client";

/**
 * **Step one: "Make your little one" — the fork, and the half of it that does
 * not exist yet.**
 *
 * The artefact's opening screen offers two routes to the same place: make the
 * character from a photograph, or set their look by hand. The reasoning beside
 * it is sound and is kept — a parent is about to upload a picture of their
 * child, and the privacy line is doing real work.
 *
 * **One route is live and the other says so.** Building a character from a
 * photograph means generating artwork, which this brief puts out of scope, and
 * the artefact's own closing note is that the open question is exactly this
 * one: a generated child the interior's own babies cannot match, with the
 * complaint arriving after the money. So the photograph route is a card that
 * states what it will be and that it is not here. The alternative — a button
 * that goes somewhere apologetic — is the thing this repository calls a
 * pretend-success path, and `lib/checkout.ts` is the precedent for refusing to
 * have one.
 *
 * **The privacy line is true as written.** The buyer's photograph for the
 * opening spread is held in the browser and sent only with the order — see
 * `lib/book/product.ts` § `BOOK_GUARANTEES`, which states it as a promise, and
 * `app/_book/BookProvider.tsx`, which is where it is kept.
 */

import { next, stepFor } from "../../lib/shop/steps";
import { useBook } from "../_book/BookProvider";
import Screen from "./Screen";

const step = stepFor("how")!;

export default function HowScreen({ closeTo }: { closeTo: string }) {
  const onward = next("how")!;
  /**
   * This screen changes nothing, and still flushes on the way out.
   *
   * The rule is better absolute than correct-by-inspection: a screen that is
   * exempt today is a screen somebody adds a field to tomorrow, and the
   * failure — a dedication lost to a debounce the navigation outran — is
   * invisible in a unit test. Writing an unchanged order costs one
   * serialisation.
   */
  const { flush } = useBook();

  return (
    <Screen step={step} closeTo={closeTo}>
      <p className="say">Two ways to get a book that looks like them.</p>

      <div className="two">
        <div className="pick" data-testid="route-photograph">
          <div className="art" aria-hidden="true">
            📷
          </div>
          <b>Use a photograph</b>
          <p>We make the character from one clear, front-facing photo.</p>
          {/*
            Not a link and not a disabled button. There is nothing behind it,
            and a control that looks pressable invites a second press.
          */}
          <span className="btn wide off" aria-disabled="true" data-testid="route-photograph-off">
            Not yet
          </span>
          <p className="foot mt-3">
            This one is still being made. Until it is, the babies below are the ones the book can
            actually draw.
          </p>
        </div>

        <div className="pick" data-testid="route-look">
          <div className="art" aria-hidden="true">
            🎨
          </div>
          <b>Choose their look</b>
          <p>Pick the baby, then the name that runs through the story.</p>
          <a className="btn wide" href={onward.path} onClick={flush} data-testid="choose-look">
            Choose their look
          </a>
        </div>
      </div>

      <p className="foot">
        <b className="text-[var(--green)]">
          Your photograph stays in your browser until you order.
        </b>
      </p>
    </Screen>
  );
}
