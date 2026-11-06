/**
 * **The book page, rendered and read.**
 *
 * The page the captain approved is the one that has to sell the book, so the
 * things asserted here are the ones that would cost money if they were wrong:
 *
 * **Every number is derived.** The page count comes from the page list, the
 * trim from the artboard less its declared bleed, the dispatch window from the
 * module the confirmation email reads it out of, and both prices from
 * `EDITIONS`. The trim is an **open question** — `docs/print.md` § The square
 * trim nobody has pinned down — so a hand-typed "8 inches" would be a claim
 * that outlived the answer. These assertions compute the same values the page
 * does, from the template, which is the only way the two can stay married.
 *
 * **What nobody knows is marked, not hidden.** `lib/product.ts` is a union
 * whose only `value` field is on the `confirmed: true` arm, so the two facts
 * nobody has a number for reach the page carrying the placeholder. A shop that
 * silently omitted them would read as a shop that knows.
 *
 * **The route is the shelf.** A title has a page because it is on the shelf,
 * and an address that is not on the shelf is a 404 — which is what makes a
 * second title data.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BookPageRoute, { generateMetadata } from "../app/books/[slug]/page";
import { trimBox } from "../lib/template/defaults";
import { BOOK_UNCONFIRMED } from "../lib/book/product";
import { PLACEHOLDER } from "../lib/product";
import { EDITIONS, priceOf } from "../lib/book/editions";
import { CHANGE_WINDOW_HOURS, DISPATCH_WINDOW } from "../lib/email/order";
import { pageSequence } from "../lib/book/derive";
import { BRAND, FORMER_NAMES } from "../lib/brand";
import { SHELF, WHEN_THEY_WERE_SMALL, titleFor, titles } from "../lib/shop/shelf";
import { STEPS } from "../lib/shop/steps";
import {
  AI_ANSWER,
  PAGE_BOTTOM_QUESTIONS,
  PAGE_CTA,
  PAGE_QUESTIONS,
  REVIEW_SLOT,
  STRIP,
} from "../lib/shop/copy";

const title = WHEN_THEY_WERE_SMALL;
const book = title.book;

async function markupFor(slug: string): Promise<string> {
  return renderToStaticMarkup(await BookPageRoute({ params: Promise.resolve({ slug }) }));
}

const page = await markupFor(title.slug);

function text(markup: string): string {
  return markup
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function testIds(markup: string): string[] {
  return [...markup.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------------------

describe("the route is the shelf", () => {
  it("serves every title on it", async () => {
    for (const entry of titles(SHELF)) {
      const markup = await markupFor(entry.slug);
      expect(markup, entry.slug).toContain(entry.book.name);
    }
  });

  it("knows nothing about an address that is not on the shelf", () => {
    expect(titleFor("a-book-nobody-wrote")).toBeNull();
    // And the one that is, so the check above is not vacuous.
    expect(titleFor(title.slug)).not.toBeNull();
  });

  it("never publishes the template's permanent id as an address", () => {
    // `BookTemplate.id` is still `the-book-of-you` because an order names it.
    // A customer must never be shown a name the shop does not trade under.
    expect(page).not.toContain(book.id);
    expect(page).not.toContain("The Book of You");
    expect(title.slug).not.toBe(book.id);
  });

  it("titles itself from the brand module", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: title.slug }) });
    expect(meta.title).toContain(BRAND.name);
    expect(meta.title).toContain(book.name);
  });
});

// ---------------------------------------------------------------------------

describe("every number on the page is derived from something that knows it", () => {
  it("states the page count the page list actually has", () => {
    expect(page).toContain(`${book.pages.length} pages inside`);
    // The control: the number is not simply "24" wherever it appears — it is
    // this book's count, and a book with fewer pages would say fewer.
    expect(book.pages.length).toBeGreaterThan(0);
  });

  it("states the trim as the artboard less its declared bleed", () => {
    const inches = (trimBox(book.page.canvas).width / 72).toFixed(2).replace(/\.?0+$/, "");
    expect(page).toContain(`${inches} inches square`);
  });

  it("states the dispatch window the confirmation email promises", () => {
    expect(page).toContain(DISPATCH_WINDOW);
    expect(page).toContain(`${CHANGE_WINDOW_HOURS} hours`);
  });

  it("states both prices, from the module that owns money", () => {
    for (const edition of EDITIONS) expect(page, edition.id).toContain(priceOf(edition.price));
    expect(page).toContain(`From ${priceOf(EDITIONS[0].price)}`);
  });

  it("draws five real pages beside the cover rather than five pictures", () => {
    const ids = testIds(page);
    expect(ids).toContain("cover");
    const rail = ids.filter((id) => id.startsWith("rail-"));
    expect(rail.length).toBe(Math.min(5, pageSequence(book).length));
    // Every one of them is the renderer's output, labelled by the renderer.
    expect(page.match(/<svg/g)?.length).toBeGreaterThan(rail.length);
  });
});

// ---------------------------------------------------------------------------

describe("what nobody has a number for is marked, not omitted", () => {
  it("prints the placeholder and the sentence saying whose number it is", () => {
    expect(BOOK_UNCONFIRMED.length).toBeGreaterThan(0);
    const slug = (label: string) =>
      label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    for (const fact of BOOK_UNCONFIRMED) {
      expect(testIds(page)).toContain(`unconfirmed-${slug(fact.label)}`);
      expect(text(page), fact.label).toContain(fact.needs);
    }
    expect(page).toContain(PLACEHOLDER);
  });
});

// ---------------------------------------------------------------------------

describe("the page the captain approved", () => {
  it("leads with its own headline and the one thing to press", () => {
    expect(text(page)).toContain(title.heading);
    expect(text(page)).toContain(title.description);
    expect(page).toContain(PAGE_CTA.action);
    expect(page).toContain(PAGE_CTA.under);
  });

  it("sends that press to the first screen of the flow, from the step list", () => {
    expect(page).toContain(`href="${STEPS[0].path}"`);
  });

  it("carries the reassurance strip and the three screens", () => {
    for (const item of STRIP) expect(page, item.line).toContain(item.line);
    expect(page).toContain("Name them, pick the baby");
    expect(page).toContain("Read all of it");
    expect(page).toContain("Add your bit, then order");
  });

  it("answers both lists of questions, including how the artwork is made", () => {
    for (const question of [...PAGE_QUESTIONS, ...PAGE_BOTTOM_QUESTIONS]) {
      expect(text(page), question.q).toContain(question.q);
      expect(text(page), question.q).toContain(question.a);
    }
    expect(text(page)).toContain(AI_ANSWER);
  });

  it("leaves the review slot visibly empty and says why", () => {
    expect(testIds(page)).toContain("review-slot");
    expect(text(page)).toContain(REVIEW_SLOT.quote);
    expect(text(page)).toContain(REVIEW_SLOT.who);
  });

  it("never names a shop this is not called any more", () => {
    const lower = page.toLowerCase();
    for (const former of FORMER_NAMES) expect(lower, former).not.toContain(former);
  });
});
