# What the book costs, and what the page may say about it

**Two editions, one set price per market, and no theatre.**
`lib/book/editions.ts` holds the numbers; this document holds the reasoning,
because the reasoning is the part that stops somebody adding a struck-out price
in six months — or "correcting" four markets into one base price and an
exchange rate.

---

## The numbers

**The book is printed in the United States and the United States is the main
market.** The shop also sells to Australia, the United Kingdom and — once
somebody has the shipping table — everywhere else.

| Market | Softcover | Hardcover |
|---|---|---|
| **United States** (the default) | **USD 49** | **USD 59** |
| Australia | AUD 59 | AUD 69 |
| United Kingdom | GBP 39 | GBP 45 |
| Everywhere else | USD 49 | USD 59 |

### These are set prices and not conversions

**Twelve numbers, twelve decisions.** They are deliberately round and
deliberately *not* in proportion to one another: AUD 59 is not USD 49
converted, and GBP 39 is not either. Each market is priced on what it will bear
against what it costs to land a book there.

That is a position and not an oversight, so it is worth stating what a
conversion would cost. A base price times a rate gives prices that are
arithmetically consistent and commercially wrong, and that **move**: the shop
would show GBP 38.74 one week and GBP 39.12 the next, which is not a price at
all. It would also quietly undo the margin work below, because the cost of
getting a book to Sydney from a US printer is not the FX rate.

`test/market.test.tsx` asserts both halves — the captain's table, typed out
there once so the expectation is not read out of the thing it is testing, and
the *absence of proportion* between markets, which is the property a single
multiplier would destroy. A contributor who replaces the table with a rate
fails that test rather than shipping a feed.

### The margin work, which was done in AUD

Settled by the captain on 6 November against costs read off their own Printify
catalogue: **softcover AUD 11.67 (8.60 with Printify Premium), hardcover
AUD 16.50 (12.16 with Premium)** — giving ~66% and ~64% gross margin on AUD 59
and AUD 69. Shipping and the exchange rate are not pinned, so the landed costs
carry a few dollars of slack and the margins are ±3 points. They land on the
~68% gross margin Wonderbly's audited accounts actually run at, which is the
only external check available.

**The equivalent arithmetic for a US-printed book has not been done**, because
the US landed cost — a US print provider's price plus US domestic postage — is
part of the same Printify table nobody has read yet. The USD, GBP and
rest-of-world prices are the captain's commercial decision and are not derived
from a measured cost here. See § What is still unknown.

**Printify Premium** saves AUD 3.07 a softcover and AUD 4.34 a hardcover. Its
subscription cost is not known and is not guessed; it is worth taking the moment
volume passes a handful a month.

---

## Why there is no "was" price, and why the type cannot hold one

The temptation in a launch is a strike-through: *~~AUD 79~~ AUD 59*. It is
rejected on three grounds, in increasing order of how expensive it is to learn.

**It is a misleading representation about price, in both of the shop's main
markets.** Under Australian Consumer Law, a was/now comparison where the higher
price was never genuinely charged for a reasonable period is a misleading
representation, and the ACCC enforces it. The shop now leads with the **United
States**, where a fictitious former price is treated as deceptive too — by the
FTC and by a patchwork of state statutes, and in practice by a class-action bar
that has sued large retailers over exactly this.

**So selling into several markets makes this rule more load-bearing, not
less.** It is the mistake that is easiest to make while adding markets — a
"US launch price" with the AUD figure struck out beside it is three
misrepresentations in one line — and the one that is most expensive to make in
the country the shop has just made its main one. The type still has nowhere to
put it.

**It cannot be unwound.** By the time the "introductory" period is over, the
discounted price *is* the price, and raising it reads to every returning
customer as a price rise rather than as a return to normal.

**It is the wrong register.** The object is a hardbound book with a child's name
in it, bought as a gift. A countdown timer beside it does the same thing to the
purchase that a plastic sleeve does to a present.

So `Edition` has fields for a label, a **market-keyed** price, a blueprint and
a note, and **no field for a comparison, a percentage or an expiry** — the same
trick `Fact` plays one level up in `lib/product.ts`, where the only arm with a
`value` is the confirmed one. A `Money` is a currency and an amount and that is
all; making the price per market added four prices and nowhere to put a "was".
A struck-out price is not a discouraged pattern here; it is unrepresentable.
`test/book-order.test.ts`, `test/market.test.tsx` and `test/book-flow.test.tsx`
assert its absence — in the data, in every market's data, and in the rendered
page.

### What is allowed instead

**A genuine launch offer with a stated end date.** The captain intends AUD 10
off either edition — and its per-market equivalents, which would be four more
decisions and not one converted — until a date they name. That gives the same urgency lawfully,
and it gives a planned road back to full price once there are reviews to sell on
instead.

**It is not built, because the date does not exist yet.** An offer with no
stated end is the mechanic this page is avoiding, so there is nothing in the
code for one. When the captain names a date it is an `Offer` beside `Edition`
with an `endsOn`, and a page that renders it only while it is running.

**Second book half price** is the captain's other intended mechanic — Wonderbly's
bundle, which works unusually well here because the buyer is often shopping a
shower, siblings or grandparents. It needs a cart, and there is no cart: the
brief rules out order management entirely, so this waits for one.

---

## What the page says about delivery and about going wrong

In `BOOK_PROMISES`, and every line is the captain's own commitment rather than
anything this repository can measure:

- **Dispatch in 2–4 working days**, with the time afterwards described rather
  than numbered: it belongs to a carrier and a destination. This matters more
  now than it did when the shop sold to one country — *2–4 working days* plus
  an unstated international transit reads as a delivery date to a buyer in
  Auckland, and it is not one. `lib/shop/shipping.ts` § `deliveryTimeLine` is
  the one sentence every page says it with.
- **A 24-hour free-change window** — *"we haven't printed it yet; tell us within
  24 hours and we'll fix anything, free."* This is honest **precisely because
  fulfilment is by hand**: there really is a gap between an order arriving and a
  file going to a printer, and saying so turns the slowest part of the process
  into the thing that makes a typo survivable.
- **Anything wrong with the object is reprinted free**, unconditionally.
- **The shop does not take change-of-mind returns**, stated plainly as a policy
  the business chooses — *a book with one child's name through it cannot be
  resold* — and **not** as a legal claim about what a buyer is entitled to. The
  old wording rested on there being no cooling-off right for goods clearly
  personalised, which is an Australian and European reading that **does not
  transfer to the United States**: consumer law there is state by state with no
  equivalent blanket exclusion. The quality remedies above survive in full
  regardless, which is why they are stated first.
  `lib/policy/pages.ts` § The returns page states a policy has the argument,
  and `test/policy.test.tsx` refuses the phrasings that read as "you have no
  right to cancel" across every market.

**One standing policy is deliberately not on the page.** A customer's *own* typo
is reprinted once, free, without argument, and charged at cost the second time.
It is applied quietly when somebody asks, and never advertised, so that it stays
goodwill rather than an invitation. A book costs about AUD 20; a sour review
costs far more to a brand with none to dilute it. **Nothing that reaches the
markup may mention it.**

The order notification has to reach the captain immediately rather than sitting
in an inbox. With hand fulfilment the risk was never the printer — it was an
order arriving overnight and the 2–4 days starting a day late. That is a
checkout concern and the checkout is stubbed; see `lib/checkout.ts`.

---

## What is still unknown, and is therefore absent

**What it costs to post a book anywhere.** `lib/shop/shipping.ts` § `RATES` is
`null` and has the shape a real table drops into. Until it exists the listed
price includes delivery and the Checkout Session carries no shipping option —
which is the standing arrangement from when the shop was Australian, and the
only honest configuration for a shop that cannot quote a rate.

**The consequence is a commercial risk and should be read as one.** The three
named markets were priced against domestic postage. "Everywhere else" at
USD 49 would have the shop absorbing international postage from a US printer,
which is why `MARKETS.row.ships` is **empty** and that market's checkout
refuses: the price is set, the country list is not, and nobody can buy into the
risk before the numbers exist. Opening it is one edit to that field plus a rate
table.

**The US landed cost**, as above. The margins in § The numbers are the
Australian ones.
