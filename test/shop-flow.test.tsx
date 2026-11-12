/**
 * **The seven screens and the basket, rendered and read.**
 *
 * The captain approved a seven-screen flow — `/Users/sasha/firstmate/.lavish/flow.html`
 * — and these assert the parts of it that a reader of the components could not
 * check for themselves:
 *
 * **The sequence is one list.** Back, next, the counter and the route table all
 * read `lib/shop/steps.ts`, so a screen inserted in the middle renumbers
 * everything at once. The test walks the list rather than naming screens, which
 * is why adding one does not make it stale.
 *
 * **Each screen's way on goes to the next step, not to a typed path.** This is
 * the bug a flow of separate routes actually has: a button whose `href` was
 * right when it was written and is wrong the day a screen moves.
 *
 * **Nothing is asked twice and nothing is asked that cannot be honoured.** The
 * look screen offers the babies the interior can draw and no axis that
 * could compose a thirteenth; the first screen states plainly that the
 * photograph route is not built.
 *
 * **The order survives a navigation.** The save is debounced and a page change
 * outruns it, so every way on calls `flush`. A screen whose *Next* does not is
 * a screen that loses what the buyer just typed, and it would never fail a
 * unit test — so it is asserted on the markup's own handler.
 *
 * These render at the state a visitor arrives in, which is what a server render
 * can see: `BookProvider` loads a stored order in an effect and effects do not
 * run in `renderToStaticMarkup`. Everything stateful is tested where it is
 * pure, in `test/book-order.test.ts`.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FIRST_BOOK } from "../templates/first-book";
import BookProvider from "../app/_book/BookProvider";
import Basket from "../app/_book/Basket";
import MakeScreen from "../app/_make/MakeScreen";
import {
  MAKE_STEPS,
  STEPS,
  isMakeStep,
  next,
  position,
  previous,
  stepFor,
} from "../lib/shop/steps";
import { WHEN_THEY_WERE_SMALL, pathOf } from "../lib/shop/shelf";
import { EDITIONS, differenceOf, priceLabel } from "../lib/book/editions";
import { DEFAULT_MARKET, MARKETS } from "../lib/shop/market";
import { ratesFor } from "../lib/shop/shipping";
import { dedicationSlot, fromSlot, outstanding, emptyOrder } from "../lib/book/order";
import { CHANGE_WINDOW_HOURS, DISPATCH_WINDOW } from "../lib/email/order";

const book = FIRST_BOOK;
const closeTo = pathOf(WHEN_THEY_WERE_SMALL);
/** The market the flow is priced in here — the default, as a first visit is. */
const market = DEFAULT_MARKET;

function screen(id: (typeof MAKE_STEPS)[number]["id"]): string {
  return renderToStaticMarkup(
    <BookProvider book={book} market={market}>
      <MakeScreen id={id as never} closeTo={closeTo} />
    </BookProvider>,
  );
}

const basket = renderToStaticMarkup(
  <BookProvider book={book} market={market}>
    <Basket />
  </BookProvider>,
);

function testIds(markup: string): string[] {
  return [...markup.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------------------

describe("the sequence is one list", () => {
  it("is seven screens, ending at the basket", () => {
    expect(STEPS).toHaveLength(7);
    expect(STEPS[STEPS.length - 1].id).toBe("basket");
    // Six of them are the artefact's screens and the seventh is the basket;
    // the last two are routes of their own rather than `/make/…`.
    expect(MAKE_STEPS).toHaveLength(5);
    expect(STEPS.filter((s) => !s.path.startsWith("/make/")).map((s) => s.path)).toEqual([
      "/preview",
      "/basket",
    ]);
  });

  it("has a unique id and a unique path for every screen", () => {
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
    expect(new Set(STEPS.map((s) => s.path)).size).toBe(STEPS.length);
  });

  it("links each screen to its neighbours by position, never by name", () => {
    for (const [index, step] of STEPS.entries()) {
      expect(previous(step.id)?.id ?? null).toBe(index === 0 ? null : STEPS[index - 1].id);
      expect(next(step.id)?.id ?? null).toBe(
        index === STEPS.length - 1 ? null : STEPS[index + 1].id,
      );
      expect(position(step.id)).toBe(`Step ${index + 1} of ${STEPS.length}`);
    }
  });

  it("recognises only the five screens `/make/[step]` serves", () => {
    for (const step of MAKE_STEPS) expect(isMakeStep(step.id), step.id).toBe(true);
    for (const id of ["book", "basket", "", "how/", "nonsense"]) {
      expect(isMakeStep(id), id).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------

describe("every screen wears the same shell", () => {
  for (const step of MAKE_STEPS) {
    it(`${step.id} names itself, says where it is, and offers the way back`, () => {
      const markup = screen(step.id);
      expect(markup).toContain(step.title);
      expect(markup).toContain(position(step.id));
      expect(testIds(markup)).toContain(`screen-${step.id}`);

      const back = previous(step.id);
      if (back) expect(markup, "back").toContain(`href="${back.path}"`);
      else expect(testIds(markup), "no back from the first screen").not.toContain("back");

      // The cross leaves for the book page, which is where they came in.
      expect(markup).toContain(`href="${closeTo}"`);
    });
  }

  it("sends every way on to the next step in the list", () => {
    for (const step of MAKE_STEPS) {
      const onward = next(step.id)!;
      const markup = screen(step.id);
      // The first screen's only live route and the look screen's blocked one
      // are covered separately; everywhere else the link is present.
      if (step.id === "look") continue;
      expect(markup, step.id).toContain(`href="${onward.path}"`);
    }
  });
});

// ---------------------------------------------------------------------------

describe("the order survives a navigation", () => {
  /**
   * **Read out of the source, because a render cannot see it.**
   *
   * `renderToStaticMarkup` emits no handlers, and the failure this guards
   * against is invisible in a unit test and obvious to a buyer: the save is
   * debounced by 400 ms, a page change outruns it, and the dedication they
   * typed is gone on the next screen. Every link that leaves a screen of the
   * flow therefore calls `flush`, and that is asserted on the text of the
   * component — the same trade `test/config.test.ts` makes when it reads the
   * workflow with a regular expression.
   */
  const dir = path.join(process.cwd(), "app", "_make");
  const files = [
    ...readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => path.join(dir, f)),
    path.join(process.cwd(), "app", "_book", "Bar.tsx"),
  ];

  it("flushes the order on every link that leaves a screen", () => {
    let found = 0;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const tag of source.match(/<a\b[^>]*href=\{(?:onward|basket)\.path\}[^>]*>/g) ?? []) {
        found++;
        expect(tag, path.basename(file)).toContain("onClick={flush}");
      }
    }
    // The control: there are links of that shape to check at all.
    expect(found).toBeGreaterThanOrEqual(MAKE_STEPS.length);
  });
});

// ---------------------------------------------------------------------------

describe("screen one — the fork, and the half that is not built", () => {
  const markup = screen("how");

  it("offers the route that works and names it", () => {
    expect(testIds(markup)).toContain("route-look");
    expect(markup).toContain(`href="${next("how")!.path}"`);
  });

  it("says plainly that the photograph route is not here, and offers nothing", () => {
    // A pretend-success path is the thing `lib/checkout.ts` refuses to have,
    // and a button that went somewhere apologetic would be one.
    expect(testIds(markup)).toContain("route-photograph-off");
    expect(markup).toContain("Not yet");
    expect(markup).toContain("still being made");
  });

  it("keeps the privacy line, which is true of this product", () => {
    expect(markup).toContain("Your photograph stays in your browser until you order.");
  });
});

// ---------------------------------------------------------------------------

describe("screen two — the look, and nothing the interior cannot draw", () => {
  it("offers one tile per look, and no axis beside them", () => {
    const answered = renderToStaticMarkup(
      <BookProvider book={{ ...book, genders: [] }} market={market}>
        <MakeScreen id={"look" as never} closeTo={closeTo} />
      </BookProvider>,
    );
    const ids = testIds(answered);
    for (const look of book.looks) expect(ids, look.id).toContain(`look-${look.id}`);
    // The count is the data's, not a number anybody typed here.
    // `look-grid` is the grid itself; every other `look-…` is one look.
    expect(ids.filter((id) => /^look-(?!grid$)/.test(id))).toHaveLength(book.looks.length);
    // One control per look and nothing composable beside it: a skin-tone row
    // would read as an axis of its own, and there is no artwork behind a baby
    // made of one look's skin and another's hair. `test/book-flow.test.tsx`
    // § the panel beside the grid holds the rest of that absence.
    expect(ids.filter((id) => /^skin-/.test(id))).toEqual([]);
    // And every look's own baby is still drawn in its own colours, which is
    // what makes the tiles a choice between babies rather than one picture.
    for (const look of book.looks) expect(answered, look.id).toContain(look.baby!.skin);
  });

  it("will not go on with no name and no baby", () => {
    const markup = screen("look");
    expect(markup).toContain("Name them, and pick a baby");
    expect(markup).not.toContain(`href="${next("look")!.path}"`);
  });
});

// ---------------------------------------------------------------------------

describe("screens three and four — the words, and the limit the renderer also enforces", () => {
  it("asks for the from-line and says it is optional", () => {
    const markup = screen("about");
    expect(testIds(markup)).toContain("from");
    expect(markup).toContain("Optional.");
    // Optional means it never blocks: the way on is a link either way.
    expect(markup).toContain(`href="${next("about")!.path}"`);
    expect(fromSlot(book)).toBeTruthy();
  });

  it("shows the dedication's hard limit as a live count, from the slot itself", () => {
    const slot = dedicationSlot(book)!;
    const markup = screen("message");
    expect(testIds(markup)).toContain("dedication-count");
    expect(markup).toContain(`of ${slot.maxLines} lines`);
    expect(markup).toContain(`of ${slot.maxChars} characters`);
    // The warning the research says to copy, because a printed page cannot be
    // changed. The limit is enforced here, in `validateBookFill`, and in the
    // renderer — and this screen is the first of the three.
    expect(markup).toContain("Read it back there before you order");
  });
});

// ---------------------------------------------------------------------------

describe("screen five — the upgrade, offered once and with no theatre", () => {
  const markup = screen("cover");

  it("offers both editions as real prices", () => {
    for (const edition of EDITIONS) {
      expect(testIds(markup)).toContain(`edition-${edition.id}`);
      expect(markup, edition.id).toContain(priceLabel(edition, market));
      expect(markup, edition.id).toContain(edition.note);
    }
  });

  it("states the upgrade as a difference, never as a discount", () => {
    expect(markup).toContain(differenceOf(EDITIONS[0], EDITIONS[1], market));
    expect(markup).not.toMatch(/<s>|line-through|was (?:AUD|USD|GBP)|RRP|% off|ends in/i);
  });

  it("chooses and goes on in two gestures, so a debounced save cannot be lost", () => {
    // The selectors are buttons and the way on is the only link.
    expect(markup).not.toMatch(/<a[^>]*data-testid="edition-/);
    expect(markup).toMatch(/<a[^>]*data-testid="next"/);
  });
});

// ---------------------------------------------------------------------------

describe("the basket", () => {
  it("shows what is in it, and what was chosen, without being asked", () => {
    expect(testIds(basket)).toContain("screen-basket");
    expect(testIds(basket)).toContain("what-you-chose");
    for (const id of ["chose-name", "chose-look", "chose-message"]) {
      expect(testIds(basket), id).toContain(id);
    }
    // Open by default: a record of what is about to be printed that has to be
    // found is a record nobody reads.
    expect(basket).toMatch(/<details[^>]*open[^>]*data-testid="what-you-chose"/);
  });

  it("totals from the module that owns money and adds nothing to it", () => {
    const edition = EDITIONS[0];
    expect(basket).toContain(priceLabel(edition, market));
    expect(basket).toContain("Order summary");
    // The shipping row follows `lib/shop/shipping.ts` § RATES rather than
    // promising a charge: with no rate table nothing is added at the till, so
    // the row says "included" and will say "at checkout" the day one exists.
    expect(ratesFor(market)).toBeNull();
    expect(basket).toContain("included");
    expect(basket).not.toContain("at checkout");
  });

  /**
   * **A market the shop cannot post to is said on the basket, not at the till.**
   *
   * The server refusal in `app/api/checkout/route.ts` is the one that stops
   * money moving, and it is still there. This is the other half: a buyer who
   * has spent three minutes on a book should not learn it by pressing the
   * button, which is the "finds out at the till" failure the delivery policy
   * names.
   */
  it("says so before the button when the chosen market has no countries", () => {
    const closed = renderToStaticMarkup(
      <BookProvider book={book} market={MARKETS.row}>
        <Basket />
      </BookProvider>,
    );
    expect(closed).toContain(`We cannot post to ${MARKETS.row.label} yet`);
    expect(closed).toContain("Change the market at the top of the page");
    // Not a live control: there is nothing behind it to press.
    expect(closed).toMatch(/aria-disabled="true"[^>]*data-testid="checkout"/);
    // The paired negative — an open market gets the real button.
    expect(basket).not.toContain("We cannot post to");
  });

  it("will not check out an unfinished book, and says what is outstanding", () => {
    // A fresh order has nothing in it, which is the state a server render sees.
    const missing = outstanding(emptyOrder(book), book);
    expect(missing.length).toBeGreaterThan(0);
    expect(testIds(basket)).toContain("checkout");
    expect(basket).toContain("Finish the book first");
    expect(basket).toContain(`Still to do: ${missing.join(", ")}`);
  });

  it("repeats the two promises the buyer is relying on", () => {
    expect(basket).toContain(`${CHANGE_WINDOW_HOURS} hours`);
    expect(basket).toContain(DISPATCH_WINDOW);
    expect(basket).toContain("Check the spelling.");
  });

  it("offers one way to the till and no wallet it does not have", () => {
    // The artefact draws express buttons; this shop charges through a hosted
    // Stripe Checkout Session, which offers the wallets the account has on
    // Stripe's own domain. A PayPal button here would be a lie about what is
    // about to happen — see `app/_book/Basket.tsx`.
    expect(testIds(basket).filter((id) => id === "checkout")).toHaveLength(1);
    expect(basket.toLowerCase()).not.toContain("paypal");
    expect(basket).toContain("Stripe");
  });

  it("names where the second-book offer belongs rather than inventing one", () => {
    expect(basket).toContain("When there is a second title");
  });

  it("links back into the flow by the step list", () => {
    expect(basket).toContain(`href="${stepFor("look")!.path}"`);
  });
});
