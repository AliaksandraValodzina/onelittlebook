/**
 * The questions, as a list of `<details>`.
 *
 * A native disclosure rather than a scripted accordion: it opens with no
 * JavaScript, it is announced correctly, and the browser's own find-in-page
 * reaches the answers inside it. The first one is open because an accordion
 * where everything is shut reads as an empty section.
 *
 * The questions come from `lib/shop/copy.ts`, which is the list
 * `test/shop-no-theatre.test.tsx` reads to check that nothing the shop can say
 * is on the captain's forbidden list.
 */

import type { Question } from "../../lib/shop/copy";

export default function Questions({
  questions,
  heading = "Questions",
  id = "questions",
}: {
  questions: readonly Question[];
  heading?: string;
  id?: string;
}) {
  return (
    <div id={id}>
      <div className="hd">
        <h2 className="dsp">{heading}</h2>
      </div>
      {questions.map((question, index) => (
        <details className="q" key={question.q} open={index === 0} data-testid="question">
          <summary>{question.q}</summary>
          <p>{question.a}</p>
        </details>
      ))}
    </div>
  );
}
