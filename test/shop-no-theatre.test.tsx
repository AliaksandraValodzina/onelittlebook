/**
 * **The things that must not appear anywhere, asserted everywhere.**
 *
 * The captain gave a list and a reason for each entry, and the reasons are the
 * point: this is a shop whose entire register is *premium and honest, no
 * theatre*, and every one of these mechanics buys a sale today by spending the
 * trust the shop has not yet earned. `docs/pricing.md` carries the legal half —
 * under Australian Consumer Law a was/now comparison where the higher price was
 * never genuinely charged is a misleading representation about price.
 *
 * Several of these are **already unrepresentable**: `lib/book/editions.ts` has
 * fields for a price and no field for a "was", a percentage or an expiry, and
 * `lib/product.ts` has no `value` on its unconfirmed arm. That is the stronger
 * guard and it is not replaced here. This is the other half — the copy, which
 * no type can constrain, and which is where a fabricated review would actually
 * be typed.
 *
 * **It reads every page the shop serves, not a sample.** The landing page, the
 * book page, all five flow screens, the basket and the preview, plus every
 * string in `lib/shop/copy.ts`. A check that named three pages would stop
 * covering the fourth the day somebody added it — the mistake
 * `test/config.test.ts` exists to prevent one level up.
 *
 * ## The one that is a judgement rather than a rule
 *
 * The approved book page draws a **five-star row** above the empty review slot,
 * under a caption admitting the slot is a placeholder. The stars are not built.
 * A star row with nothing behind it is an invented rating however honest the
 * words beside it are, and *star ratings* is on the captain's list by name. The
 * band itself is kept, because the sentence in it — *nothing goes here until
 * somebody has written one* — is the strongest trust signal on the page.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../app/page";
import BookPageRoute from "../app/books/[slug]/page";
import BookProvider from "../app/_book/BookProvider";
import Basket from "../app/_book/Basket";
import Preview from "../app/_book/Preview";
import MakeScreen from "../app/_make/MakeScreen";
import { FIRST_BOOK } from "../templates/first-book";
import { MAKE_STEPS } from "../lib/shop/steps";
import { WHEN_THEY_WERE_SMALL, pathOf } from "../lib/shop/shelf";
import * as COPY from "../lib/shop/copy";

const book = FIRST_BOOK;
const closeTo = pathOf(WHEN_THEY_WERE_SMALL);

function inProvider(node: React.ReactElement): string {
  return renderToStaticMarkup(<BookProvider book={book}>{node}</BookProvider>);
}

/** Every page the shop serves, by name, so a failure says which one. */
const PAGES: Record<string, string> = {
  landing: renderToStaticMarkup(<Home />),
  "book page": renderToStaticMarkup(
    await BookPageRoute({ params: Promise.resolve({ slug: WHEN_THEY_WERE_SMALL.slug }) }),
  ),
  ...Object.fromEntries(
    MAKE_STEPS.map((step) => [
      `flow: ${step.id}`,
      inProvider(<MakeScreen id={step.id as never} closeTo={closeTo} />),
    ]),
  ),
  preview: inProvider(<Preview />),
  basket: inProvider(<Basket />),
};

/**
 * Every string the shop's copy module can put on a page.
 *
 * Walked by reflection rather than by a list, so a constant added to
 * `lib/shop/copy.ts` is covered the moment it exists.
 */
function everyCopyString(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) everyCopyString(item, out);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) everyCopyString(item, out);
  }
  return out;
}

const COPY_STRINGS = everyCopyString(COPY);

/**
 * The mechanics, as patterns with the captain's reason for each.
 *
 * Patterns rather than substrings: "was" is an ordinary English word and what
 * is refused is a was/now *price*; "hand" is ordinary too and what is refused
 * is a claim that one made the artwork.
 */
const FORBIDDEN: Array<{ why: string; pattern: RegExp }> = [
  {
    why: "a struck-out price — the comparison was never genuinely charged",
    pattern: /<s>|<del\b|line-through|\bwas\s+(?:aud\s*)?[$£€]?\d|\brrp\b|\bsave\s+(?:aud\s*)?[$£€]?\d|\b\d+\s*%\s*(?:off|discount)/i,
  },
  {
    why: "a countdown — urgency the shop cannot honestly claim",
    pattern:
      /\bends\s+(?:in|on|today|tonight)\b|\bcountdown\b|\bhurry\b|\blimited time\b|\bonly \d+ left\b|\bwhile stocks last\b|\boffer ends\b/i,
  },
  {
    why: "an invented review count or star rating — there are no reviews yet",
    pattern:
      /★|☆|\b\d[\d,.]*\s*(?:reviews?|ratings?)\b|\b\d(?:\.\d)?\s*(?:out of|\/)\s*5\b|\bstar rating\b|\btrustpilot\b/i,
  },
  {
    why: "a paid queue jump — it only works by implying everybody else waits longer",
    pattern: /\bskip the queue\b|\bpriority (?:processing|dispatch|handling)\b|\bjump the queue\b/i,
  },
  {
    why: "a fee to insure a promise already made for nothing",
    pattern: /\bshipping protection\b|\bdelivery (?:insurance|protection)\b|\bpackage protection\b/i,
  },
  {
    why: "a hand-made claim — the artwork is generated, and the FAQ says so",
    pattern:
      /\bhand[-\s]?(?:made|painted|drawn|illustrated|crafted)\b|\bmade by hand\b|\bpainted by hand\b|\bdrawn by hand\b|\bartisan\b/i,
  },
];

// ---------------------------------------------------------------------------

describe("no theatre, on any page the shop serves", () => {
  it("reads every page, so this is not a sample", () => {
    // The mistake `test/config.test.ts` guards one level up: a check that names
    // three pages stops covering the fourth.
    expect(Object.keys(PAGES).length).toBe(4 + MAKE_STEPS.length);
    for (const [name, markup] of Object.entries(PAGES)) {
      expect(markup.length, name).toBeGreaterThan(500);
    }
  });

  for (const { why, pattern } of FORBIDDEN) {
    it(`shows no ${why}`, () => {
      for (const [name, markup] of Object.entries(PAGES)) {
        expect(markup, `${name}: ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  it("finds nothing forbidden in the copy module either", () => {
    expect(COPY_STRINGS.length).toBeGreaterThan(20);
    for (const { pattern } of FORBIDDEN) {
      for (const line of COPY_STRINGS) {
        expect(line, String(pattern)).not.toMatch(pattern);
      }
    }
  });

  it("would catch every one of them, so the checks above can fail", () => {
    // The paired negative. Each pattern is given the thing it is looking for,
    // written the way a shop actually writes it.
    const examples = [
      "<s>AUD 89</s> now AUD 59 — save AUD 30",
      "Offer ends today — hurry, only 3 left",
      "★★★★★ 4.8 out of 5 from 1,204 reviews on Trustpilot",
      "Skip the queue for $6.99",
      "Add shipping protection for $2.00",
      "Every spread is hand-painted by an artisan",
    ];
    expect(examples).toHaveLength(FORBIDDEN.length);
    for (const [index, example] of examples.entries()) {
      expect(example, FORBIDDEN[index].why).toMatch(FORBIDDEN[index].pattern);
    }
  });
});

// ---------------------------------------------------------------------------

describe("the review slot is empty and says so", () => {
  it("keeps the sentence and draws no stars above it", () => {
    const page = PAGES["book page"];
    expect(page).toContain("nothing goes here until somebody has written one");
    expect(page).not.toContain("★");
  });
});
