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
 * and has none. `test/policy.test.tsx` walks `POLICIES` and asserts a route on
 * disk for every link.
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
import { POLICIES } from "../../lib/policy/pages";
import { SHELF, pathOf } from "../../lib/shop/shelf";
import { RIBBON } from "../../lib/shop/copy";

/** Where the book is made and how fast it leaves, above everything else. */
export function Ribbon() {
  return (
    <div className="ribbon" data-testid="ribbon">
      {RIBBON}
    </div>
  );
}

/**
 * The masthead.
 *
 * `❧` is the artefact's mark and is a single character in both vendored UI
 * faces' Latin coverage — the book's own faces are a separate, measured list in
 * `lib/render/coverage.ts` and nothing in the chrome goes near them.
 */
export function ShopNav({ basketCount = 0 }: { basketCount?: number }) {
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
          AUD ·{" "}
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
              {POLICIES.map((policy) => (
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
          <span>© {BRAND.name} · Australia</span>
          <span>Printed on request. Nothing is kept that you do not send.</span>
        </div>
      </div>
    </footer>
  );
}
