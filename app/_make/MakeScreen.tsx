"use client";

/**
 * **Which screen a step is.**
 *
 * One map from a `MakeStepId` to the component that draws it, so `/make/[step]`
 * stays a route and not a switch statement in a page. The map is exhaustive by
 * type: adding an id to `MakeStepId` in `lib/shop/steps.ts` and not adding it
 * here is a compile error rather than a blank screen.
 *
 * The narrowing itself — `isMakeStep` — is in `lib/shop/steps.ts` and not here,
 * because the route that calls it is a server component and cannot call into a
 * `"use client"` module at all.
 *
 * Only the five screens under `/make` are here. Step six is the whole book at
 * `/preview` and step seven is `/basket`; both are real routes with their own
 * pages, which is what `Step.path` records.
 */

import type { MakeStepId } from "../../lib/shop/steps";
import AboutScreen from "./AboutScreen";
import CoverScreen from "./CoverScreen";
import HowScreen from "./HowScreen";
import LookScreen from "./LookScreen";
import MessageScreen from "./MessageScreen";

const SCREENS: Record<MakeStepId, (props: { closeTo: string }) => React.ReactNode> = {
  how: HowScreen,
  look: LookScreen,
  about: AboutScreen,
  message: MessageScreen,
  cover: CoverScreen,
};

export default function MakeScreen({ id, closeTo }: { id: MakeStepId; closeTo: string }) {
  const Screen = SCREENS[id];
  return <Screen closeTo={closeTo} />;
}
