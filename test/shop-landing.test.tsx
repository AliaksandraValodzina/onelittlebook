/**
 * **The landing page, rendered and read — and the shelf proved to grow.**
 *
 * Three claims are made about this page that only a render can check:
 *
 * **The shelf grows by data.** The captain's instruction was that adding a
 * second title must be data and not a layout change. A promise like that is
 * worth nothing written down, so it is executed: the shelf is rendered with a
 * two-title list and both titles have to appear, with no component edited. The
 * paired negative is the one-title list, which must show exactly one.
 *
 * **Every cover is the real book.** A shelf tile that was its own image file is
 * a tile that can advertise a book the renderer does not draw. These assert the
 * renderer's own output reached the markup — and the control is a render of the
 * same tile with the baby's colours changed, so a test that would pass against
 * an empty block fails.
 *
 * **Nothing says Keepnook.** `lib/brand.ts` § `FORMER_NAMES` is the list and
 * `test/policy.test.tsx` already walks the policy pages with it; this is the
 * same assertion against the shop's own front door.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../app/page";
import Shelf from "../app/_shop/Shelf";
import { ShopFooter, ShopNav, Ribbon } from "../app/_shop/Chrome";
import { BRAND, FORMER_NAMES } from "../lib/brand";
import { POLICIES } from "../lib/policy/pages";
import { EDITIONS, priceOf } from "../lib/book/editions";
import {
  AI_ANSWER,
  HERO,
  HOW,
  LANDING_QUESTIONS,
  MADE,
  RENDER_CAPTION,
  RIBBON,
  TRUST,
} from "../lib/shop/copy";
import { SHELF, WHEN_THEY_WERE_SMALL, pathOf, titles, type ShelfEntry } from "../lib/shop/shelf";

const landing = renderToStaticMarkup(<Home />);

/** Every `data-testid` in a string of markup, in order. */
function testIds(markup: string): string[] {
  return [...markup.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]);
}

/**
 * The markup with React's entities turned back into the characters they were.
 *
 * `renderToStaticMarkup` writes an apostrophe as `&#x27;`, so a copy string
 * compared against raw markup fails on every sentence with a possessive in it —
 * which is most of them. Decoding is the honest comparison: the browser shows
 * the character, not the entity.
 */
function text(markup: string): string {
  return markup
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------

describe("the shelf is the bit that grows", () => {
  it("shows the one title there is, and the tile saying the next is being made", () => {
    const ids = testIds(landing);
    for (const title of titles(SHELF)) expect(ids).toContain(`shelf-${title.slug}`);
    expect(ids).toContain("shelf-being-made");
    expect(landing).toContain(WHEN_THEY_WERE_SMALL.book.name);
    expect(landing).toContain(`href="${pathOf(WHEN_THEY_WERE_SMALL)}"`);
  });

  it("takes a second title without a component being touched", () => {
    /**
     * The whole instruction, executed.
     *
     * The second title is a **real** `BookTemplate` — the one there is, under
     * another name and another address — rather than an invented object, so
     * what this proves is that the shelf renders a second *book* and not that
     * it maps over a list.
     */
    const second: ShelfEntry = {
      ...WHEN_THEY_WERE_SMALL,
      slug: "the-second-one",
      book: { ...WHEN_THEY_WERE_SMALL.book, name: "The Second One" },
      line: "Whatever the next one turns out to be.",
      badge: undefined,
    };
    const grown = renderToStaticMarkup(<Shelf shelf={[...SHELF, second]} />);
    const ids = testIds(grown);
    expect(ids).toContain(`shelf-${WHEN_THEY_WERE_SMALL.slug}`);
    expect(ids).toContain("shelf-the-second-one");
    expect(ids).toContain("shelf-being-made");
    expect(grown).toContain("/books/the-second-one");
    // And it is drawn, not merely listed: the renderer labelled the new cover.
    expect(grown).toContain('aria-label="The Second One — cover"');

    // The paired negative: with the real list there is no second title, so the
    // assertion above is about the data and not about the markup.
    const asShipped = testIds(renderToStaticMarkup(<Shelf />));
    expect(asShipped).not.toContain("shelf-the-second-one");
  });

  it("draws every cover with the renderer rather than from a picture file", () => {
    const book = WHEN_THEY_WERE_SMALL.book;
    // The renderer labels what it drew, and the cover carries the buyer's name
    // set in the cover's own face — neither of which a picture file would have.
    expect(testIds(landing)).toContain("cover");
    expect(landing).toContain(`aria-label="${book.name} — cover"`);
    expect(landing).toContain(book.covers[0].colour);
    expect(landing).toContain("Rosalind");

    // The control, so none of the above could pass against an empty block: the
    // same component given a book under another name draws that name, and the
    // first name is nowhere in it.
    const renamed = { ...book, name: "A Different Book" };
    const other = renderToStaticMarkup(
      <Shelf shelf={[{ ...WHEN_THEY_WERE_SMALL, book: renamed }]} />,
    );
    expect(other).toContain('aria-label="A Different Book — cover"');
    expect(other).not.toContain(`aria-label="${book.name} — cover"`);
  });

  it("states one price, from the module that owns money", () => {
    const cheapest = EDITIONS.reduce((low, e) => (e.price.amount < low.price.amount ? e : low));
    expect(landing).toContain(`From ${priceOf(cheapest.price)}`);
  });
});

// ---------------------------------------------------------------------------

describe("the bands the captain approved, in the order he approved them", () => {
  it("leads with the object, captioned as a render because nothing is printed", () => {
    expect(landing).toContain(RENDER_CAPTION);
  });

  it("says what it is and that the whole book can be read first", () => {
    expect(text(landing)).toContain(HERO.heading);
    expect(text(landing)).toContain(HERO.sub);
    expect(text(landing)).toContain(HERO.fine);
  });

  it("carries the ribbon, the three reassurances and the four steps", () => {
    expect(landing).toContain(RIBBON);
    for (const item of TRUST) expect(landing, item.title).toContain(item.title);
    for (const step of HOW) expect(landing, step.heading).toContain(step.heading);
  });

  it("says how the artwork is made, plainly, in the captain's own words", () => {
    // The brief is specific that this text stays. It is the question a buyer
    // will ask either way, and answering it is the whole register of the shop.
    expect(landing).toContain("generated with AI tools");
    expect(text(landing)).toContain(AI_ANSWER);
  });

  it("asks every question on the list and answers all of them", () => {
    for (const question of LANDING_QUESTIONS) {
      expect(text(landing), question.q).toContain(question.q);
      expect(text(landing), question.q).toContain(question.a);
    }
    expect(testIds(landing).filter((id) => id === "question")).toHaveLength(
      LANDING_QUESTIONS.length,
    );
  });

  it("reaches for the register without claiming a hand touched the artwork", () => {
    expect(landing).toContain(MADE.heading);
    expect(text(landing)).toContain(MADE.body);
  });
});

// ---------------------------------------------------------------------------

describe("the chrome", () => {
  const footer = renderToStaticMarkup(<ShopFooter />);
  const nav = renderToStaticMarkup(<ShopNav />);
  const ribbon = renderToStaticMarkup(<Ribbon />);

  it("names the shop from one module, everywhere", () => {
    for (const markup of [footer, nav, landing]) expect(markup).toContain(BRAND.name);
    expect(footer).toContain(BRAND.domain);
    expect(footer).toContain(BRAND.support);
  });

  it("links every policy, which is the bug a footer of this shape once had", () => {
    for (const policy of POLICIES) {
      expect(footer, policy.slug).toContain(`href="${policy.slug}"`);
      expect(footer).toContain(policy.nav);
    }
    expect(testIds(footer)).toEqual(
      expect.arrayContaining(POLICIES.map((p) => `policy-${p.slug}`)),
    );
  });

  it("lists the shelf in the footer too, from the same list", () => {
    for (const title of titles(SHELF)) expect(footer).toContain(title.book.name);
  });

  it("never names a shop this is not called any more", () => {
    for (const markup of [landing, footer, nav, ribbon]) {
      const lower = markup.toLowerCase();
      for (const former of FORMER_NAMES) expect(lower, former).not.toContain(former);
    }
  });

  it("would catch an old name, so that check can fail", () => {
    expect("Keepnook Books".toLowerCase()).toContain(FORMER_NAMES[0]);
  });

  it("no longer sells a book under its old title", () => {
    expect(landing).not.toContain("The Book of You");
  });
});
