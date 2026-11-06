/**
 * **One route for the five screens of the flow.**
 *
 * The step comes out of the URL and is looked up in `lib/shop/steps.ts`;
 * anything that is not a step is a 404 rather than a blank card, because a
 * mistyped step is a wrong address and not a broken shop.
 *
 * `generateStaticParams` is deliberately absent: the screens read an order out
 * of `localStorage` after mount, so there is nothing to prerender that would
 * not immediately be replaced.
 */

import { notFound } from "next/navigation";
import { WHEN_THEY_WERE_SMALL, pathOf } from "../../../lib/shop/shelf";
import { isMakeStep } from "../../../lib/shop/steps";
import MakeScreen from "../../_make/MakeScreen";

export default async function MakeStepPage(props: { params: Promise<{ step: string }> }) {
  const { step } = await props.params;
  if (!isMakeStep(step)) notFound();
  // The cross leaves for the book page, which is where a buyer came in from.
  return <MakeScreen id={step} closeTo={pathOf(WHEN_THEY_WERE_SMALL)} />;
}
