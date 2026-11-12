/**
 * **Which groups of the preview have been drawn yet — the arithmetic, so the
 * component is glue.**
 *
 * The whole book is previewable with no wall, which is the strongest finding in
 * the research and is not what this touches. What it touches is *when* each
 * page's picture is fetched. Twenty-four pages went to the browser at once, so
 * a visitor paid for the whole book before they had seen the first spread of
 * it, and the captain's screenshot of a half-painted preview is what that looks
 * like.
 *
 * ## The three numbers, and why they are these
 *
 * **The first spread is drawn in the server's own markup.** It is the one a
 * visitor is looking at, it needs no JavaScript to arrive, and it is the only
 * thing competing for the connection while it does.
 *
 * **Two more groups are drawn as soon as the component mounts.** Not in the
 * markup, deliberately: the first paint should not be racing six pictures when
 * two of them are the ones on screen. After mount the next spreads are already
 * in hand, so scrolling on finds them drawn rather than loading.
 *
 * **Reaching a group draws two beyond it.** A page turn is then a picture that
 * is already there, which is the difference between *a book* and *a page that
 * is still coming*.
 *
 * ## Why it is a frontier and never a window
 *
 * `shown` only ever grows, and it is counted in **pages** so that it survives
 * the one-page/two-page toggle: a page that has been drawn stays drawn. A sliding
 * window would un-draw the spread behind you, which means scrolling back up a
 * preview you have already loaded makes it load again — and on a phone, with
 * the connection that made this task necessary, that is the worst version of
 * the problem. The cost of keeping them is the pictures stay in the tab, which
 * is what a tab is for.
 *
 * It is pure arithmetic in `lib/` for `CLAUDE.md`'s reason: the suite has no
 * DOM, so a component is tested in the state a visitor arrives in and
 * everything that moves is tested here.
 */

/**
 * Groups drawn in the server's markup: **the first one**.
 *
 * A group is what the reader sees at once — a spread on a wide screen, a
 * single page on a phone — and `spreads()` is what decides which that is. The
 * *frontier* below is counted in pages, for the reason `pagesIn` gives.
 */
export const EAGER_GROUPS = 1;

/**
 * How far ahead of the furthest group reached the drawing runs.
 *
 * Two, which is one more than "the next one" and far short of "all of them":
 * enough that a page turn never reveals a load, cheap enough that arriving and
 * reading nothing costs three spreads instead of twelve.
 */
export const PRELOAD_GROUPS = 2;

/**
 * The pages in the first `groups` groups of the book.
 *
 * **The frontier is counted in pages and not in groups**, and that is the one
 * thing in here worth a sentence. A group is a spread on a wide screen and a
 * single page on a phone, and the preview's toggle switches between the two —
 * so a frontier of "five groups" means ten pages before the toggle and five
 * after it, which would **un-paint** five pages somebody had already been
 * shown. Pages are the unit both groupings agree about.
 */
export function pagesIn(groups: readonly number[][], upTo: number): number {
  return groups.slice(0, Math.max(0, upTo)).reduce((count, group) => count + group.length, 0);
}

/** What the server draws. Everything else is reserved and quiet. */
export function pagesOnArrival(groups: readonly number[][]): number {
  return pagesIn(groups, EAGER_GROUPS);
}

/** What is drawn once the component is mounted and nothing has been reached. */
export function pagesAfterMount(groups: readonly number[][]): number {
  return pagesIn(groups, EAGER_GROUPS + PRELOAD_GROUPS);
}

/**
 * The frontier after a group comes into view.
 *
 * Monotonic by construction — it is a `Math.max` — so a caller cannot make the
 * preview forget a page it has drawn, however it is wired up.
 */
export function reached(index: number, groups: readonly number[][], shown: number): number {
  return Math.max(shown, pagesIn(groups, index + 1 + PRELOAD_GROUPS));
}

/**
 * Is this group's artwork drawn yet?
 *
 * The group, and not a page: a spread is painted when the frontier has passed
 * **both** its pages, so a spread is never half-painted — which is precisely
 * what the captain's screenshot showed.
 */
export function isShown(group: readonly number[], shown: number): boolean {
  return group.length > 0 && group[group.length - 1] < shown;
}

/**
 * **What an undrawn page says.**
 *
 * A stated fact and never a spinner, which is this shop's convention
 * everywhere: `lib/shop/shipping.ts` says the price includes delivery rather
 * than animating a guess, and `lib/product.ts` cannot hold a price nobody
 * supplied. An indeterminate whirl says *something is happening and I do not
 * know what*; the page's own name says *this is page six of your book, and it
 * is not painted yet* — which is true, is the thing the reader wanted to know,
 * and does not move.
 *
 * The page's name is passed in because the preview already has it (`Cover`,
 * `Page 6`), and two spellings of a page's name is two ways to name the same
 * page.
 */
export function restingNote(pageName: string): string {
  return `${pageName} — paints as you reach it`;
}
