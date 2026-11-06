/**
 * `/make` is not a screen; it is the front of a sequence.
 *
 * It redirects to the first step rather than rendering one, so that the step
 * list in `lib/shop/steps.ts` decides what "the beginning" is. A page that drew
 * the first screen itself would be a second copy of that fact, and the day a
 * screen is inserted in front of it the two would disagree.
 */

import { redirect } from "next/navigation";
import { STEPS } from "../../lib/shop/steps";

export default function MakeIndex() {
  redirect(STEPS[0].path);
}
