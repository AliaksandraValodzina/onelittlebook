/**
 * **The four policy pages: that they exist, that they are true, and the one
 * sentence that must never be on them.**
 *
 * Three claims, and each one is a real failure this repository could have
 * shipped:
 *
 * **The footer linked to pages nothing served.** That was the state before
 * this: a shop that looks like it has terms and has none. So the footer's
 * links and the pages are read off the **same list**, and a link with nothing
 * behind it fails here.
 *
 * **A policy page states facts the code acts on.** A delivery page promising
 * to post somewhere the checkout refuses is worse than no delivery page, and
 * a price on a legal page that the till does not charge is a
 * misrepresentation. So the facts are checked against `shipsTo`, `EDITIONS`
 * and the dispatch window the email uses — **in every market**, because each
 * one has its own currency, its own country list and its own price.
 *
 * **The returns page must state a policy and never an entitlement.** That is
 * the claim the move to US printing and US selling made load-bearing:
 * `lib/policy/pages.ts` § The returns page states a policy has the argument,
 * and the assertions here are the other half — the page says what the shop
 * does, the one sentence it says about law only ever gives rights away, and
 * the phrasings that read as "you have no right to cancel" are refused by
 * pattern across every market's draft.
 *
 * **One policy is deliberately absent.** `docs/pricing.md` is explicit that the
 * captain's standing rule — a customer's *own* typo reprinted once, free — is
 * applied quietly when somebody asks and **never advertised**, so that it
 * stays goodwill rather than an invitation. *"Nothing that reaches the markup
 * may mention it."* That is asserted here against every word of every page.
 */

import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  POLICY_LINKS,
  deliveryPolicy,
  everyPolicy,
  policiesFor,
  policyFor,
  privacyPolicy,
  returnsPolicy,
  termsPolicy,
  wordsOf,
  type Policy,
} from "../lib/policy/pages";
import { shipsTo } from "../lib/stripe/session";
import { EDITIONS, priceLabel } from "../lib/book/editions";
import { CHANGE_WINDOW_HOURS, DISPATCH_WINDOW } from "../lib/email/order";
import { BRAND, FORMER_NAMES } from "../lib/brand";
import { DEFAULT_MARKET, MARKET_LIST, MARKETS, type Market } from "../lib/shop/market";
import SiteFooter from "../app/_components/SiteFooter";
import PolicyPage from "../app/_components/PolicyPage";

const footer = renderToStaticMarkup(<SiteFooter />);

/** The default market's four, which is what a check about structure reads. */
const POLICIES: readonly Policy[] = policiesFor(DEFAULT_MARKET);
const DELIVERY = deliveryPolicy(DEFAULT_MARKET);

/**
 * **Every word of every policy in every market**, which is what the
 * never-say-this checks walk.
 *
 * Four pages times four markets. A check that read only the US drafts would
 * stop covering the Australian ones the day somebody edited them — the same
 * mistake `test/config.test.ts` exists to prevent one level up.
 */
const everyWord = everyPolicy().map(wordsOf).join(" ");
const everyMarkup = everyPolicy()
  .map((p) => renderToStaticMarkup(<PolicyPage policy={p} />))
  .join(" ");

describe("the footer and the pages are the same list", () => {
  it("links to all four", () => {
    expect(POLICIES).toHaveLength(4);
    expect(POLICY_LINKS).toHaveLength(4);
    for (const policy of POLICIES) {
      expect(footer, policy.slug).toContain(`href="${policy.slug}"`);
      expect(footer).toContain(policy.nav);
    }
  });

  it("keeps the same four addresses in every market, so a link cannot move", () => {
    // The words on a policy page depend on the market and its address does
    // not — which is the whole reason the footers read `POLICY_LINKS` and not
    // a market's drafts.
    for (const market of MARKET_LIST) {
      expect(
        policiesFor(market).map((p) => p.slug),
        market.id,
      ).toEqual(POLICY_LINKS.map((p) => p.slug));
    }
  });

  it("has a route on disk for every link, which is the whole bug this fixes", () => {
    for (const policy of POLICIES) {
      const route = path.join(process.cwd(), "app", policy.slug.replace(/^\//, ""), "page.tsx");
      expect(existsSync(route), `${policy.slug} is linked and ${route} does not exist`).toBe(true);
    }
  });

  it("links to every policy that exists, so a fifth cannot be unreachable", () => {
    expect(POLICIES.map((p) => p.slug).sort()).toEqual(
      POLICY_LINKS.map((p) => p.slug).sort(),
    );
    for (const policy of POLICIES) {
      expect(policyFor(policy.slug, DEFAULT_MARKET)).toEqual(policy);
    }
    expect(policyFor("/nope")).toBeNull();
  });

  it("would notice a dead link, so the check above is not vacuous", () => {
    const pretend = { ...DELIVERY, slug: "/not-served" };
    const route = path.join(process.cwd(), "app", pretend.slug.replace(/^\//, ""), "page.tsx");
    expect(existsSync(route)).toBe(false);
  });
});

describe("the pages render something", () => {
  it("draws every heading and every paragraph", () => {
    for (const policy of everyPolicy()) {
      const markup = renderToStaticMarkup(<PolicyPage policy={policy} />);
      expect(markup).toContain(policy.title);
      for (const section of policy.sections) {
        expect(markup, `${policy.slug} ${section.heading}`).toContain(section.heading);
        for (const paragraph of section.body) {
          // The first words are enough and are not mangled by entity escaping.
          expect(markup, `${policy.slug} "${paragraph.slice(0, 24)}"`).toContain(
            paragraph.slice(0, 24).replace(/&/g, "&amp;"),
          );
        }
      }
    }
  });

  it("would fail if a page rendered nothing, which is the paired negative", () => {
    const empty = renderToStaticMarkup(<PolicyPage policy={{ ...DELIVERY, sections: [] }} />);
    expect(empty).not.toContain(DELIVERY.sections[0].heading);
  });
});

describe("delivery says what the till actually does", () => {
  const words = wordsOf(DELIVERY);

  it("gives the dispatch window the email gives", () => {
    expect(words).toContain(DISPATCH_WINDOW);
  });

  it("says the time afterwards is the carrier's and quotes no delivery date", () => {
    expect(words.toLowerCase()).toContain("depends on where you are");
    expect(words.toLowerCase()).toContain("we do not quote a delivery date");
  });

  it("says it is printed in the USA, which is where it is printed", () => {
    expect(words).toContain(`printed in ${BRAND.printedIn}`);
  });

  for (const market of MARKET_LIST) {
    it(`promises to post only where ${market.id}'s checkout accepts an address`, () => {
      // A delivery page that promised somewhere the till refuses would be a
      // page promising something a buyer cannot do.
      const page = wordsOf(deliveryPolicy(market));
      const names: Record<string, string> = {
        US: "the United States",
        AU: "Australia",
        GB: "the United Kingdom",
      };
      const mine = shipsTo(market).map((code) => names[code] ?? code);
      for (const name of mine) expect(page, name).toContain(name);

      // And names nowhere else. The other markets' countries are the sharpest
      // version of "somewhere this checkout refuses".
      const theirs = MARKET_LIST.filter((m) => m.id !== market.id)
        .flatMap((m) => shipsTo(m))
        .filter((code) => !shipsTo(market).includes(code))
        .map((code) => names[code] ?? code);
      for (const name of new Set(theirs)) {
        expect(page, `${market.id} names ${name}`).not.toContain(name);
      }
    });
  }

  it("says plainly that the market with no countries cannot be posted to yet", () => {
    // `lib/shop/market.ts` § Why "everywhere else" cannot check out yet. The
    // price is set and the country list is not, and the page says which.
    expect(shipsTo(MARKETS.row)).toEqual([]);
    const page = wordsOf(deliveryPolicy(MARKETS.row)).toLowerCase();
    expect(page).toContain("not yet");
    expect(page).toContain(BRAND.support.toLowerCase());
    // And does not imply a checkout that works.
    expect(page).not.toContain("will only accept an address there");
  });

  it("quotes the real prices for each market and adds no postage of its own", () => {
    for (const market of MARKET_LIST) {
      const page = wordsOf(deliveryPolicy(market));
      for (const edition of EDITIONS) {
        expect(page, `${market.id} ${edition.id}`).toContain(priceLabel(edition, market));
      }
    }
    // No invented shipping fee. `lib/shop/shipping.ts` § RATES is null and
    // nothing in this repository has a postage number in it.
    expect(everyWord).not.toMatch(/\b(?:USD|AUD|GBP)\s*(?:[0-9]|1[0-9])\b.{0,24}post/i);
  });
});

describe("getting it right states a policy and never an entitlement", () => {
  const words = wordsOf(returnsPolicy(DEFAULT_MARKET));

  it("states the 24-hour window and how to use it", () => {
    expect(words).toContain(String(CHANGE_WINDOW_HOURS));
    expect(words).toContain(BRAND.support);
    expect(words.toLowerCase()).toContain("order reference");
  });

  it("says what the shop does about a change of mind, and why", () => {
    // A promise the business is choosing to make — "we do not take
    // change-of-mind returns", with the commercial reason, which is true in
    // every market.
    expect(words.toLowerCase()).toContain("we do not take change-of-mind returns");
    expect(words.toLowerCase()).toContain("nobody else it can be sold to");
  });

  it("promises a free reprint for anything wrong with the object, unconditionally", () => {
    expect(words.toLowerCase()).toContain("reprint");
    expect(words.toLowerCase()).toContain("free");
    expect(words.toLowerCase()).toContain("unconditional");
  });

  /**
   * **The claim this whole change turns on.**
   *
   * The old page said personalised goods carry no cooling-off right, which is
   * an Australian and European reading. The shop now leads with the United
   * States, where consumer law is state by state and no such blanket
   * exclusion exists — so no page in any market may tell a buyer what they are
   * not entitled to. Checked across every market's draft, and against the
   * rendered markup too, because a component could add a sentence.
   */
  const LEGAL_CLAIMS: Array<{ why: string; pattern: RegExp }> = [
    {
      why: "a claim that the buyer has no right to cancel or return",
      pattern:
        /\b(?:you|buyers?|customers?)\s+(?:have|has)\s+no\s+(?:right|legal right)|\bno right to (?:cancel|return|refund)\b|\bnot entitled to\b|\bwaive[sd]?\s+(?:your|any)\s+right/i,
    },
    {
      why: "a cooling-off or withdrawal right asserted not to exist",
      pattern: /\bno cooling[-\s]?off\b|\bcarry no cooling\b|\bno (?:statutory )?right of withdrawal\b/i,
    },
    {
      why: "a flat non-returnable assertion dressed as law",
      pattern: /\bby law\b|\bunder (?:the )?law you\b|\blaw does not (?:allow|give|require)\b/i,
    },
  ];

  for (const { why, pattern } of LEGAL_CLAIMS) {
    it(`makes no ${why}, in any market`, () => {
      for (const text of [everyWord, everyMarkup]) {
        expect(text, String(pattern)).not.toMatch(pattern);
      }
    });
  }

  it("would catch every one of them, so the checks above can fail", () => {
    const examples = [
      "You have no right to cancel a personalised order.",
      "Goods made to a specification carry no cooling-off right.",
      "By law we cannot accept a return of a personalised item.",
    ];
    expect(examples).toHaveLength(LEGAL_CLAIMS.length);
    for (const [index, example] of examples.entries()) {
      expect(example, LEGAL_CLAIMS[index].why).toMatch(LEGAL_CLAIMS[index].pattern);
    }
  });

  it("says one sentence about law per market, and it only gives rights away", () => {
    for (const market of MARKET_LIST) {
      const page = wordsOf(returnsPolicy(market));
      expect(page, market.id).toContain(market.statutory);
      // Every variant is of the form "nothing here limits …", which claims
      // nothing about what those rights are — the only safe thing to say when
      // nobody has had a lawyer read the page.
      expect(market.statutory.toLowerCase(), market.id).toMatch(
        /^nothing on this page limits/,
      );
    }
    // The Australian Consumer Law reasoning is kept where it still applies and
    // is not pasted over markets it does not — `docs/pricing.md` keeps the
    // no-fake-discount half of it, which now carries twice the weight.
    expect(wordsOf(returnsPolicy(MARKETS.au))).toContain("Australian Consumer Law");
    expect(wordsOf(returnsPolicy(MARKETS.us))).not.toContain("Australian Consumer Law");
  });
});

describe("privacy is exact about the photograph", () => {
  const words = wordsOf(privacyPolicy(DEFAULT_MARKET));

  it("says it stays in the browser until the order is placed", () => {
    expect(words.toLowerCase()).toContain("stays in your");
    expect(words.toLowerCase()).toContain("not uploaded");
  });

  it("says where it goes afterwards, and that it is private there", () => {
    expect(words.toLowerCase()).toContain("private storage");
    expect(words.toLowerCase()).toContain("never published at a public address");
  });

  it("says Stripe holds the payment and that this site never sees a card", () => {
    expect(words).toContain("Stripe");
    expect(words.toLowerCase()).toContain("never touches this site");
  });

  it("says why there is an email address at all", () => {
    expect(words.toLowerCase()).toContain("email address");
    expect(words.toLowerCase()).toContain("do not send marketing");
  });

  it("names every processor the code actually uses", () => {
    for (const processor of ["Stripe", "Cloudflare R2", "Resend", "Vercel"]) {
      expect(words, processor).toContain(processor);
    }
  });

  it("is exact about how long, including that nothing is deleted automatically", () => {
    expect(words.toLowerCase()).toContain("nothing is deleted automatically");
  });
});

describe("terms of sale", () => {
  const words = wordsOf(termsPolicy(DEFAULT_MARKET));

  it("says what is bought", () => {
    expect(words.toLowerCase()).toContain("one printed, personalised book");
  });

  it("says the contract is made when the payment succeeds, not when the button is pressed", () => {
    // Which is the truth about this code: the button creates a session, and
    // only a verified webhook makes an order real.
    expect(words.toLowerCase()).toContain("pressing the button is not");
    expect(words.toLowerCase()).toContain("when the payment succeeds");
  });

  it("names the currency the card will actually be charged in, per market", () => {
    // "$49" is three currencies. A buyer should not have to guess which one.
    for (const market of MARKET_LIST) {
      const page = wordsOf(termsPolicy(market));
      expect(page, market.id).toContain(`charged in ${market.currency}`);
      for (const edition of EDITIONS) {
        expect(page, `${market.id} ${edition.id}`).toContain(priceLabel(edition, market));
      }
    }
  });

  it("says what the price covers while there is no rate table", () => {
    expect(words.toLowerCase()).toContain("includes delivery");
  });
});

describe("no page claims the book is printed where it is not", () => {
  it("says the USA and never Australia, in any market, in words or markup", () => {
    for (const text of [everyWord, everyMarkup, footer]) {
      expect(text.toLowerCase()).not.toContain("printed in australia");
      expect(text.toLowerCase()).not.toContain("made in australia");
    }
  });

  it("still names Australia as the business's own country in the footer", () => {
    // The distinction `lib/brand.ts` makes on purpose: `printedIn` is a fact
    // about the object and `registeredIn` is a fact about the seller. This
    // check exists so that nobody "finishes the job" by deleting the second.
    expect(BRAND.registeredIn).toBe("Australia");
    expect(BRAND.printedIn).not.toBe(BRAND.registeredIn);
  });
});

describe("what is not on any page", () => {
  it("never mentions reprinting a customer's own typo", () => {
    // `docs/pricing.md`: applied quietly when somebody asks, never advertised,
    // so that it stays goodwill rather than an invitation. Checked against the
    // rendered markup as well as the strings, because a component could add it.
    for (const text of [everyWord.toLowerCase(), everyMarkup.toLowerCase()]) {
      for (const phrase of ["your own typo", "own mistake", "misspell", "typo"]) {
        expect(text, phrase).not.toContain(phrase);
      }
    }
  });

  it("would catch it if somebody wrote it, so that check can fail", () => {
    const pretend = "If you make a typo we will reprint it once, free.".toLowerCase();
    expect(pretend).toContain("typo");
  });

  it("would catch a price mechanic, so that check can fail too", () => {
    const pretend = "Was AUD 79, save 20, 25% off — hurry, ends Friday. RRP AUD 89.";
    expect(pretend).toMatch(/\bwas\s+(?:aud|usd|gbp)?\s*[$£€]?\d/i);
    expect(pretend).toMatch(/\b\d+\s*%\s*(?:off|discount)/i);
    expect(pretend).toMatch(/\brrp\b/i);
    expect(pretend).toMatch(/\bsave\s+(?:aud|usd|gbp)?\s*[$£€]?\d/i);
    expect(pretend).toMatch(/\bends\s+(?:on\s+)?\w+day\b/i);
    expect(pretend).toMatch(/\b(?:hurry|limited time|only \d+ left)\b/i);
  });

  it("carries no struck-out price, no percentage and no countdown", () => {
    // `docs/pricing.md` § Why there is no "was" price. The data cannot express
    // one; this is the same assertion against the copy.
    // Patterns rather than substrings: "was" is an ordinary English word and
    // the mechanic being refused is a was/now *price*, a percentage off, or a
    // deadline on an offer.
    for (const mechanic of [
      /\bwas\s+(?:aud|usd|gbp)?\s*[$£€]?\d/i,
      /\b\d+\s*%\s*(?:off|discount)/i,
      /\brrp\b/i,
      /\bsave\s+(?:aud|usd|gbp)?\s*[$£€]?\d/i,
      /\bends\s+(?:on\s+)?\w+day\b/i,
      /\b(?:hurry|limited time|only \d+ left)\b/i,
    ]) {
      expect(everyWord, String(mechanic)).not.toMatch(mechanic);
    }
  });

  it("never names a shop this is not called any more", () => {
    // The shop was Keepnook. A policy page that still says so is a page that
    // confuses a customer about who charged their card — `lib/brand.ts`.
    for (const text of [everyWord.toLowerCase(), everyMarkup.toLowerCase(), footer.toLowerCase()]) {
      for (const former of FORMER_NAMES) {
        expect(text, former).not.toContain(former);
      }
    }
  });

  it("would catch an old name, so that check can fail", () => {
    expect("Sold by Keepnook".toLowerCase()).toContain(FORMER_NAMES[0]);
  });
});

describe("every policy route on disk is one the footer links", () => {
  it("has no orphan page pretending to be a policy", () => {
    // The other direction of the same bug: a privacy page nobody can find.
    const linked = new Set(POLICY_LINKS.map((p) => p.slug.replace(/^\//, "")));
    const suspects = readdirSync(path.join(process.cwd(), "app"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => /privacy|terms|delivery|returns|refund|getting/.test(name));
    for (const name of suspects) {
      expect(linked.has(name), `app/${name} looks like a policy and the footer does not link it`).toBe(true);
    }
    expect(suspects.length).toBe(4);
  });
});
