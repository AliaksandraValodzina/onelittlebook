/**
 * Getting it right, served from `lib/policy/pages.ts`.
 *
 * The route is four lines because the policy is data and
 * `app/_components/PolicyPage.tsx` is the one renderer — see those two files
 * for everything worth knowing. The footer links here, which was the whole
 * problem: it has linked to this path since the landing page was built and
 * nothing answered it.
 */

import type { Metadata } from "next";
import { pageTitle } from "../../lib/brand";
import PolicyPage from "../_components/PolicyPage";
import { returnsPolicy } from "../../lib/policy/pages";
import { DEFAULT_MARKET } from "../../lib/shop/market";
import { currentMarket } from "../_shop/market";

/**
 * **Per request, because the policy depends on the market.**
 *
 * The price, the currency, the countries and the one sentence about consumer
 * law all come out of `policiesFor(market)` — `lib/policy/pages.ts` § Four
 * policies per market. The metadata uses the default market's wording, which is
 * the title and the lede, and neither of those varies.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: pageTitle(returnsPolicy(DEFAULT_MARKET).title),
  description: returnsPolicy(DEFAULT_MARKET).lede,
};

export default async function Page() {
  return <PolicyPage policy={returnsPolicy(await currentMarket())} />;
}
