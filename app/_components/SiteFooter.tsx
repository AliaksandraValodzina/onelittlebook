/**
 * **The footer, and the four links it is here for.**
 *
 * The links come out of `lib/policy/pages.ts` rather than being typed here, so
 * the footer and the pages are the same list. That is not tidiness: the
 * situation this replaces was a footer promising policies that nothing served,
 * which is worse than no footer — a shop that looks like it has terms and has
 * none. `test/policy.test.tsx` walks this list and asserts a page exists for
 * every entry, so the two cannot come apart again.
 *
 * It is `POLICY_LINKS` rather than the policies themselves because a policy's
 * *words* depend on the market and its address does not — a footer should not
 * have to know which market it is in to draw a link.
 */

import { POLICY_LINKS } from "../../lib/policy/pages";

export default function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="mt-14 border-t border-current/10 pt-5 text-xs opacity-55">
      {children}
      <nav aria-label="Policies" className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {POLICY_LINKS.map((policy) => (
          <a key={policy.slug} className="underline" href={policy.slug} data-testid={`policy-${policy.slug}`}>
            {policy.nav}
          </a>
        ))}
      </nav>
    </footer>
  );
}
