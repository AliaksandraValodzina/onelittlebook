/**
 * **The whole book is here; the pictures arrive as the reader does.**
 *
 * Twenty-four pages went to the browser at once — 2.6 MB each, about 62 MB —
 * so a visitor paid for the whole book before the first spread had finished
 * arriving, and the captain's screenshot showed a spread half-painted with
 * flat cream below it. That reads as broken rather than as loading.
 *
 * Three things have to be true at once and this file is those three:
 *
 * **The book is still whole, with no wall.** Every page is in the list, in
 * order, labelled, and nothing anywhere asks for an email address. That is the
 * strongest finding in the research and the thing most easily lost by a change
 * like this one — a preview that showed three spreads and a *"see the rest"*
 * would be a wall built out of a performance fix.
 *
 * **The first spread is painted in the server's own markup** and the rest
 * reserve their square and say which page they are. `lib/book/reveal.ts` holds
 * the three numbers and the argument for them; this asserts the state a
 * visitor **arrives** in, which is all a suite with no DOM can see — and which
 * is exactly the state that was slow.
 *
 * **The resting state is a stated fact and not a whirl.** This shop says *the
 * price includes delivery* rather than animating a guess, and it says *the
 * cover is still the placeholder* rather than hiding it. A square that names
 * itself is the same convention; a spinner is the one that lies about what is
 * happening.
 *
 * `test/screen-derivatives.test.ts` is the other half of the weight — how big
 * each picture is when it does arrive.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FIRST_BOOK } from "../templates/first-book";
import BookProvider from "../app/_book/BookProvider";
import Preview from "../app/_book/Preview";
import BookPage from "../app/_book/BookPage";
import { DEFAULT_MARKET } from "../lib/shop/market";
import { pageSequence, spreads } from "../lib/book/derive";
import {
  EAGER_GROUPS,
  PRELOAD_GROUPS,
  isShown,
  pagesAfterMount,
  pagesIn,
  pagesOnArrival,
  reached,
  restingNote,
} from "../lib/book/reveal";

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");

/** The preview as a visitor arrives at it: two pages at a time, the default. */
const preview = renderToStaticMarkup(
  <BookProvider book={FIRST_BOOK} market={DEFAULT_MARKET}>
    <Preview />
  </BookProvider>,
);

/** Which page containers are painted, and which are resting, off the markup. */
function drawnPages(markup: string): { drawn: number[]; resting: number[] } {
  const drawn: number[] = [];
  const resting: number[] = [];
  for (const match of markup.matchAll(/data-page="(\d+)" data-page-label="[^"]*" data-drawn="(\w+)"/g)) {
    (match[2] === "true" ? drawn : resting).push(Number(match[1]));
  }
  return { drawn, resting };
}

// ---------------------------------------------------------------------------

describe("the arithmetic of what has been drawn", () => {
  it("starts with the first group and runs ahead of the reader", () => {
    /**
     * **The policy, and not merely the arithmetic over it.** Every other
     * assertion in this file derives what it expects from these two constants,
     * which is this repository's rule — so the constants themselves are the
     * one place the decision has to be stated: **one** group painted in the
     * markup, because that is the spread the visitor is looking at, and a
     * window of one or two ahead, because more is the whole book again.
     * `lib/book/reveal.ts` carries the reasoning.
     */
    expect(EAGER_GROUPS).toBe(1);
    expect(PRELOAD_GROUPS).toBeGreaterThanOrEqual(1);
    expect(PRELOAD_GROUPS).toBeLessThanOrEqual(2);

    const groups = spreads(FIRST_BOOK);
    expect(pagesOnArrival(groups)).toBe(pagesIn(groups, EAGER_GROUPS));
    expect(pagesAfterMount(groups)).toBe(pagesIn(groups, EAGER_GROUPS + PRELOAD_GROUPS));

    // Reaching a group draws it and the two after it, and nothing beyond.
    const after = reached(5, groups, pagesAfterMount(groups));
    expect(after).toBe(pagesIn(groups, 5 + 1 + PRELOAD_GROUPS));
    expect(isShown(groups[5], after)).toBe(true);
    expect(isShown(groups[5 + PRELOAD_GROUPS], after)).toBe(true);
    expect(isShown(groups[5 + PRELOAD_GROUPS + 1], after)).toBe(false);
  });

  it("is counted in pages, so the one-page toggle never un-paints a spread", () => {
    // The frontier a reader has pushed to on a wide screen is the same number
    // of pages after they switch to one page at a time. In groups it would
    // have been half of them, and five spreads somebody had been shown would
    // go back to resting cream.
    const asSpreads = spreads(FIRST_BOOK);
    const asPages = pageSequence(FIRST_BOOK).map((_, index) => [index]);
    const shown = reached(4, asSpreads, pagesOnArrival(asSpreads));
    const drawnPagesBefore = asSpreads.filter((g) => isShown(g, shown)).flat();
    const drawnPagesAfter = asPages.filter((g) => isShown(g, shown)).flat();
    expect(drawnPagesAfter).toEqual(expect.arrayContaining(drawnPagesBefore));
  });

  it("only ever goes forwards, so scrolling back never fetches twice", () => {
    // The property, stated as one: a frontier and not a window. A page that has
    // been painted stays painted, whatever order the groups are reached in.
    const groups = spreads(FIRST_BOOK);
    let shown = pagesOnArrival(groups);
    for (const index of [0, 4, 9, 2, 7, 1]) shown = reached(index, groups, shown);
    expect(shown).toBe(reached(9, groups, 0));
    for (let i = 0; i < 9; i++) expect(isShown(groups[i], shown), `group ${i}`).toBe(true);
  });

  it("says which page is resting, in words, with no verb that implies a spinner", () => {
    const note = restingNote("Page 6");
    expect(note).toContain("Page 6");
    // The shop's convention, asserted rather than remembered.
    for (const word of ["loading", "please wait", "spinner", "%"]) {
      expect(note.toLowerCase(), word).not.toContain(word);
    }
  });
});

describe("the preview a visitor arrives at", () => {
  const groups = spreads(FIRST_BOOK);

  it("has every page of the book in it, in order, labelled", () => {
    const { drawn, resting } = drawnPages(preview);
    const all = [...drawn, ...resting].sort((a, b) => a - b);
    expect(all).toEqual(pageSequence(FIRST_BOOK).map((_, index) => index));
    expect(preview).toContain(`All ${pageSequence(FIRST_BOOK).length} pages`);
    // The captions, which are what says the book is whole whether or not a
    // page is painted yet. Counted off `spreads()`, never typed.
    expect(groups.length).toBeGreaterThan(1);
  });

  it("paints the first spread and no more", () => {
    const { drawn, resting } = drawnPages(preview);
    // Derived from the book's own pairing: the first group's pages, whatever
    // the book's length and however `spreads()` pairs them.
    expect(drawn.sort((a, b) => a - b)).toEqual(groups.slice(0, EAGER_GROUPS).flat());
    expect(resting.length).toBe(pageSequence(FIRST_BOOK).length - drawn.length);
    expect(resting.length).toBeGreaterThan(0);
  });

  it("draws one `<svg>` per painted page and none for a resting one", () => {
    // The thing that actually costs the bytes: an `<image href>` inside an
    // inlined SVG. No SVG, no request — which is what makes this a fix rather
    // than a hidden overlay.
    const svgs = preview.split("<svg").length - 1;
    expect(svgs).toBe(groups.slice(0, EAGER_GROUPS).flat().length);

    // And the two states are the two kinds of markup, page by page: a painted
    // page's container holds an `<svg>`, a resting one holds its own name.
    // (With no artwork imported the pages are drawn from numbers rather than
    // from an `<image href>`, so the SVG is what both states can be told apart
    // by.) Every container is matched, so neither arm can be the empty set.
    const containers = [
      ...preview.matchAll(/data-page="(\d+)" data-page-label="([^"]*)" data-drawn="(\w+)">(.*?)<\/div>/g),
    ];
    expect(containers.length).toBe(pageSequence(FIRST_BOOK).length);
    for (const [, index, label, isDrawn, inside] of containers) {
      if (isDrawn === "true") {
        expect(inside, `page ${index} is painted`).toContain("<svg");
        expect(inside, `page ${index} is painted`).not.toContain(restingNote(label));
      } else {
        expect(inside, `page ${index} is resting`).not.toContain("<svg");
        expect(inside, `page ${index} is resting`).toContain(restingNote(label));
      }
    }
  });

  it("reserves every page's square, so nothing moves when a picture arrives", () => {
    // One container for both states (`app/_book/BookPage.tsx`), so the aspect
    // ratio is declared by the same class list either way. Counted: one per
    // page, painted or not.
    expect(preview.split("aspect-square").length - 1).toBe(pageSequence(FIRST_BOOK).length);
  });

  it("names each resting page and promises nothing it cannot keep", () => {
    const resting = pageSequence(FIRST_BOOK)[pageSequence(FIRST_BOOK).length - 1];
    const name = `Page ${Number(resting.id.replace("page-", ""))}`;
    expect(preview).toContain(restingNote(name));
    // No spinner, no bar, no percentage, anywhere in the preview.
    for (const word of ["animate-spin", "role=\"progressbar\"", "spinner", "loading…"]) {
      expect(preview, word).not.toContain(word);
    }
  });

  it("has no watermark, no account and no email wall — including the new words", () => {
    // `test/book-flow.test.tsx` owns this promise; it is repeated here against
    // the words a lazy preview is the temptation to add.
    const lower = preview.toLowerCase();
    for (const word of [
      "see the rest",
      "show more",
      "load more",
      "sign in",
      "enter your email",
      "unlock",
      "preview only",
    ]) {
      expect(lower, word).not.toContain(word);
    }
    expect(preview).toContain("No watermark, no account");
  });
});

describe("every other screen that shows a page", () => {
  it("paints it immediately, because `drawn` defaults to true", () => {
    // The chooser's panel, the confirmation and the tile all mount a
    // `BookPage` and all want the picture now. Only the whole-book preview has
    // a reason to wait, which is why this is a prop and not context.
    const one = renderToStaticMarkup(
      <BookProvider book={FIRST_BOOK} market={DEFAULT_MARKET}>
        <BookPage index={1} label="Page 1" />
      </BookProvider>,
    );
    expect(one).toContain('data-drawn="true"');
    expect(one).toContain("<svg");
  });

  it("is the only component that passes `drawn`, read off disk", () => {
    // So the resting state cannot quietly spread to a screen showing one page,
    // where a square that says "paints as you reach it" would be a bug.
    expect(read("app", "_book", "Preview.tsx")).toContain("drawn={isShown(group, shown)}");
    for (const file of ["app/_make/LookScreen.tsx", "app/_book/Confirm.tsx"]) {
      expect(readFileSync(path.join(ROOT, file), "utf8"), file).not.toContain("drawn=");
    }
  });
});
