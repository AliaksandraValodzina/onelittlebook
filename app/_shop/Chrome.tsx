/**
 * **The ribbon, the masthead and the footer — one of each.**
 *
 * Every shop page wears these three, so they are three components and not three
 * copies. The brand name, the domain and the support address come from
 * `lib/brand.ts` and are written nowhere else; the ribbon's dispatch window
 * comes from the module the confirmation email reads it out of.
 *
 * ## The footer links only to pages that exist
 *
 * This is the one place the approved artefacts are departed from on purpose,
 * and the reason is already in this repository: the state before
 * `lib/policy/pages.ts` existed was *a footer promising policies that nothing
 * served*, which is worse than no footer — a shop that looks like it has terms
 * and has none. `test/policy.test.tsx` walks `POLICY_LINKS` and asserts a route
 * on disk for every link.
 *
 * The artefact's footer has four columns, two of which link to pages nobody has
 * written: an *About* column (*"How it is made"*, *"Printing and paper"*) and a
 * *Keepnook* column pointing at the notebook app, which this brief puts out of
 * scope and which is no longer the name of anything a customer buys from. So
 * the columns here are **Books**, read off the shelf, and **Help**, read off
 * the policy list — both of them data, so the day somebody writes the
 * printing-and-paper page the column appears by adding it to a list.
 */

import { BRAND } from "../../lib/brand";
import { POLICY_LINKS } from "../../lib/policy/pages";
import { SHELF, pathOf } from "../../lib/shop/shelf";
import { ribbonFor } from "../../lib/shop/copy";
import { MARKET_LIST, type Market } from "../../lib/shop/market";

/** Where the book is made and how fast it leaves, above everything else. */
export function Ribbon({ market }: { market: Market }) {
  return (
    <div className="ribbon" data-testid="ribbon">
      {ribbonFor(market)}
    </div>
  );
}

/**
 * **The market control: the one place a buyer can see and change what they are
 * being priced in.**
 *
 * It is the country pill every shop that sells across borders has, and it is
 * here rather than buried in a footer for a reason that is not cosmetic:
 * `lib/shop/market.ts` lets the edge *suggest* a market from a country hint,
 * and a suggestion the buyer cannot see is indistinguishable from being priced
 * by their IP address with no way out. A visible control is what makes the
 * difference between a default and a decision made about somebody.
 *
 * **A `<details>` and a form, with no JavaScript anywhere.** The summary is the
 * pill, the panel is four submit buttons, and `app/api/market/route.ts` sets
 * the cookie and sends the buyer back to the page they pressed from. It works
 * with scripting off, it is announced as the disclosure and the form it is,
 * and it renders completely in `renderToStaticMarkup` — which is the only way
 * this repository's component tests can see it at all, since there is no DOM in
 * the suite and no effects run.
 *
 * The current market is `aria-current` and is drawn as pressed rather than
 * omitted from the list: a buyer wants to know what they are on, not only what
 * they could switch to.
 */
export function MarketControl({ market }: { market: Market }) {
  return (
    <details className="mkt" data-testid="market-control">
      <summary aria-label={`Market: ${market.label}. Change it.`}>
        <span data-testid="market-now">{market.currency}</span>
        <span aria-hidden="true"> ▾</span>
      </summary>
      <form className="mkt-menu" method="post" action="/api/market">
        <p className="mkt-head">Prices shown in</p>
        {MARKET_LIST.map((entry) => (
          <button
            key={entry.id}
            type="submit"
            name="market"
            value={entry.id}
            aria-current={entry.id === market.id ? "true" : undefined}
            data-testid={`market-${entry.id}`}
          >
            <span>{entry.label}</span>
            <span className="cur">{entry.currency}</span>
          </button>
        ))}
      </form>
    </details>
  );
}

/**
 * The masthead.
 *
 * `❧` is the artefact's mark and is a single character in both vendored UI
 * faces' Latin coverage — the book's own faces are a separate, measured list in
 * `lib/render/coverage.ts` and nothing in the chrome goes near them.
 */
export function ShopNav({
  market,
  basketCount = 0,
}: {
  market: Market;
  basketCount?: number;
}) {
  return (
    <nav className="shop" aria-label="One Little Book">
      <div className="wrap in">
        <a className="mark" href="/" data-testid="mark">
          <span className="glyph" aria-hidden="true">
            ❧
          </span>{" "}
          {BRAND.name}
        </a>
        <a className="lnk" href="/#shelf">
          Our books
        </a>
        <a className="lnk" href="/#how">
          How it works
        </a>
        <span className="sp">
          {/*
            The currency used to be the literal string `AUD` here, which was
            both a hardcoded price claim and, worse, a label that told the
            buyer what they were being charged in while offering them no say
            in it. It is the control now.
          */}
          <MarketControl market={market} />
          <a className="lnk" href="/basket" data-testid="nav-basket">
            Basket{basketCount > 0 ? ` (${basketCount})` : ""}
          </a>
        </span>
      </div>
    </nav>
  );
}

/**
 * The footer.
 *
 * The policy links carry the same `data-testid` the old `SiteFooter` used, so
 * the assertion that the footer and the pages are one list keeps holding
 * wherever a visitor is standing.
 */
export function ShopFooter() {
  return (
    <footer className="shop" data-testid="shop-footer">
      <div className="wrap">
        <div className="cols">
          <div>
            <h5>Books</h5>
            {SHELF.map((entry) =>
              entry.kind === "title" ? (
                <a key={entry.slug} href={pathOf(entry)}>
                  {entry.book.name}
                </a>
              ) : (
                <span key={entry.heading} className="block my-[0.42em] opacity-70">
                  {entry.heading}
                </span>
              ),
            )}
          </div>
          <div>
            <h5>Help</h5>
            <nav aria-label="Policies">
              {POLICY_LINKS.map((policy) => (
                <a key={policy.slug} href={policy.slug} data-testid={`policy-${policy.slug}`}>
                  {policy.nav}
                </a>
              ))}
            </nav>
            <a href={`mailto:${BRAND.support}`}>{BRAND.support}</a>
          </div>
          <div>
            <h5>{BRAND.name}</h5>
            <a href="/my-forever">My Forever</a>
            <span className="block my-[0.42em] opacity-70">{BRAND.domain}</span>
          </div>
        </div>
        <div className="btm">
          {/*
            **This is the country the business trades from, not the country the
            book is printed in**, and the two are deliberately different facts
            with deliberately different fields — `lib/brand.ts` §
            `registeredIn` and § `printedIn`.

            They were the same string once, so somebody tidying up after the
            move to US printing would reasonably "fix" this line too. Do not:
            a copyright line names the seller, and a seller in the wrong
            country is a worse claim than any of the printing ones this change
            went round correcting.
          */}
          <span>© {BRAND.name} · {BRAND.registeredIn}</span>
          <span>Printed on request. Nothing is kept that you do not send.</span>
        </div>
      </div>
    </footer>
  );
}
