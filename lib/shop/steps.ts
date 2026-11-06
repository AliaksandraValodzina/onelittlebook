/**
 * **The seven screens, as data.**
 *
 * `/Users/sasha/firstmate/.lavish/flow.html` is the artefact the captain
 * approved: six screens and the basket, in this order, with the reasoning for
 * each written beside it. The sequence is here rather than in the components so
 * that *back*, *next*, the breadcrumb and the route table are one list — a flow
 * whose screens each knew their own neighbour is a flow where inserting a screen
 * means editing three files and forgetting the fourth.
 *
 * ## Why the last two are not under `/make`
 *
 * Step six is *the whole book*, which already exists at `/preview` and is the
 * one screen in this product with a settled shape and a test asserting its
 * absences — no watermark, no account, no wall. Step seven is the basket. Both
 * are real routes of their own and the step list names them, so "next from the
 * cover question" is a lookup rather than a hard-coded string in a button.
 *
 * ## What `required` means here
 *
 * It does **not** gate the screen. `lib/book/order.ts` § `ASKS` already decides
 * what an order needs and `isComplete` reads it; a second opinion about that
 * would be the drift this repository keeps refusing. It marks whether a screen
 * is part of the spine or a detour, which is what the progress line reads.
 *
 * ## The first screen and the thing it cannot do yet
 *
 * Step one is the artefact's fork: *make the character from a photograph*, or
 * *choose their look*. The photograph route is a character generated from an
 * uploaded picture, which is out of scope for this task — the brief says no AI
 * cover generation — and the artefact's own closing note is that the open
 * question is exactly this: a generated child the twelve interior babies cannot
 * match. So the route is **present and honest**: it says what it will be and
 * that it is not here, and the screen does not pretend to offer it.
 */

export type StepId = "how" | "look" | "about" | "message" | "cover" | "book" | "basket";

export interface Step {
  id: StepId;
  /** The heading in the bar of the screen, as the artefact wrote it. */
  title: string;
  /** The route. Steps one to five are under `/make`; the last two are not. */
  path: string;
  /** Part of the spine, rather than a detour. */
  required: boolean;
}

export const STEPS: readonly Step[] = [
  { id: "how", title: "Make your little one", path: "/make/how", required: true },
  { id: "look", title: "Choose their look", path: "/make/look", required: true },
  { id: "about", title: "About the book", path: "/make/about", required: false },
  { id: "message", title: "Write your message", path: "/make/message", required: false },
  { id: "cover", title: "Softcover or hard?", path: "/make/cover", required: true },
  { id: "book", title: "Read it, then order", path: "/preview", required: true },
  { id: "basket", title: "Your basket", path: "/basket", required: true },
] as const;

/** The five screens `/make/[step]` serves. The other two are their own routes. */
export const MAKE_STEPS: readonly Step[] = STEPS.filter((step) =>
  step.path.startsWith("/make/"),
);

/** The ids of those five, as a type the screen map can be exhaustive over. */
export type MakeStepId = Extract<StepId, "how" | "look" | "about" | "message" | "cover">;

/**
 * Whether a path segment is one of the five.
 *
 * It lives here and not beside the screen map because `/make/[step]/page.tsx`
 * is a **server** component and has to ask before it renders anything: a
 * narrowing function exported from a `"use client"` module cannot be called
 * from the server at all, which is a mistake that costs a 500 rather than a
 * type error.
 */
export function isMakeStep(id: string): id is MakeStepId {
  return MAKE_STEPS.some((step) => step.id === id);
}

export function stepFor(id: string): Step | null {
  return STEPS.find((step) => step.id === id) ?? null;
}

export function indexOf(id: StepId): number {
  return STEPS.findIndex((step) => step.id === id);
}

/** The screen before this one, or null at the front — where *back* leaves. */
export function previous(id: StepId): Step | null {
  const at = indexOf(id);
  return at > 0 ? STEPS[at - 1] : null;
}

export function next(id: StepId): Step | null {
  const at = indexOf(id);
  return at >= 0 && at + 1 < STEPS.length ? STEPS[at + 1] : null;
}

/** `Step 3 of 7`, for the line under the bar. Counted, never typed. */
export function position(id: StepId): string {
  return `Step ${indexOf(id) + 1} of ${STEPS.length}`;
}
