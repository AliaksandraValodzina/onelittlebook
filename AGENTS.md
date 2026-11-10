<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Books

Personalised printed books. `README.md` is the orientation; the documents that
decide everything else are `docs/template-format.md`, `docs/print.md`,
`docs/look-upload-contract.md` and `docs/pricing.md`.

**The shop is "One Little Book" at `onelittlebook.com`.** It was Keepnook; every
brand string — name, domain, support address — is in `lib/brand.ts` and nowhere
else, so the next rename is one edit. The many references to *Keepnook* in
`lib/`, `docs/` and `test/` are citations of a different codebase's prior art,
not branding: do not replace them.

**The book is printed in the United States and Australia is only where the
business is.** `lib/brand.ts` holds those as two fields — `printedIn` and
`registeredIn` — because they were one string until the day they diverged, and
"printed in Australia" was then false in six places at once. A claim about the
object reads `printedIn`; the footer's `© … · Australia` names the seller and
must not be "corrected". `test/market.test.tsx` holds both halves.

**Two titles, one machinery.** "When They Were Small" (`templates/first-book.ts`)
is the product, at `/books/when-they-were-small`; "My Forever"
(`templates/my-forever.ts`) is the single keepsake page it was built on, at
`/my-forever`. The book's template `id` is still `the-book-of-you` and must
stay — an order names it — so the **published address is the shelf's own
`slug`**, never the id. A book is a list of pages plus
a looks axis (`lib/book/types.ts`), and `lib/book/derive.ts` turns one of its
pages into the `PageTemplate` the renderer has always drawn — **nothing
downstream of `derive.ts` knows books exist.** Add a book capability there or
in the format, never in a component.

## The three rules this codebase is built on

**A page template is data, not code.** `lib/template/types.ts` is the format and
carries its own reasoning. Add a capability by adding a *field* with a stated
meaning for its absence, never by adding a branch in a component.

**One renderer.** `lib/render/svg.ts` draws the page; the screen inlines its
output and `lib/render/raster.ts` rasterises the same string.
`test/one-renderer.test.ts` fails on any `if (forPrint)`. If the screen needs
something the print file must not have, it is an *option on the render call*
that the print path does not pass — there are exactly two, `guides` and
`ghost`, and `renderPrintSvg` takes no options object at all, which is what
makes "it cannot print" structural rather than checked.

**Nothing reads an optional field directly.** `lib/template/defaults.ts` holds
the tolerant readers. A stored template or fill can come from a newer publisher
or a hand-edited file, and the renderer's duty is to draw the sane thing.

## The editor edits the fill, never the template

`lib/editor/` is pure arithmetic and the React in `app/_components/` is glue
over it, which is why the editor is tested without a browser. A gesture becomes
a `Crop` (`lib/editor/view.ts`) and `placePhoto` does the placing — there is no
editor-side layout, so there is nothing to drift from the renderer.

Two rules that are not obvious:

**A written view is clamped to the range that does something**
(`clampCentre`), not merely to 0–1. Storing travel that only `cropFor` clamps
away makes the next drag stick for exactly that distance — invisible in a unit
test, obvious to a thumb.

**Crops are produced at the window's own aspect ratio.** `placePhoto` covers a
mismatched crop by scaling on the larger axis, so a crop of the wrong shape
puts part of what the customer framed outside the window.

## Text can only be what the font can write

`resvg` runs with `loadSystemFonts: false`, so a codepoint the two vendored
TTFs lack prints as nothing while the browser substitutes a face and shows it
correctly. Neither covers Cyrillic or emoji — measured, not assumed.
`lib/render/coverage.ts` declares each face's codepoints and
`test/coverage.test.ts` regenerates them from the files, printing the
replacement string when they disagree. Everything a customer types goes through
`lib/editor/text.ts`, whose one contract is that no input produces a fill
`validateFill` would refuse.

## Facts the repository does not have

`lib/product.ts` is a union whose only `value` field is on the
`confirmed: true` arm, so a price nobody has supplied cannot be written — add
the number *and* flip the arm, never one or the other. `lib/book/editions.ts`
plays the same trick with money: it has fields for a price and no field for a
"was", a percentage or an expiry, so a misleading price comparison is
unrepresentable rather than discouraged. `docs/pricing.md` says why that is a
legal position and not a taste one.

**The open question nobody may close by accident is the trim.** The book
declares an 8.00 in trim at 3600 px a page; what Printify actually asks for is
unread, and 3150 (My Forever's number) matches no square trim at 300 DPI. The
page size is declared data on the book, so the answer is an edit to
`page.canvas`/`page.print` and a restamp — and no test or component reads a page
size from anywhere else. `docs/print.md` § The square trim nobody has pinned
down.

## The shop around the book

**The design is three approved artefacts, built rather than interpreted** —
`landing.html`, `book-page.html` and `flow.html` under `~/firstmate/.lavish/`.
`app/shop.css` is their CSS taken across, and it writes no colour and no font
family: `lib/theme.ts` holds the palette and the **one token** that decides the
display face, because the captain has not finally chosen between Fraunces and
Instrument Serif. `test/theme.test.ts` fails if a second file names either.

**The shelf is data** (`lib/shop/shelf.ts`) and **the flow is data**
(`lib/shop/steps.ts`): a second title is an entry plus a template, and back,
next, the counter and the route table all read the step list. The copy is data
too (`lib/shop/copy.ts`) so that `test/shop-no-theatre.test.tsx` can walk every
string the shop can say.

**Half of that copy is a function of a market, and the rule is mechanical:
every exported function in `lib/shop/copy.ts` takes exactly one argument and
that argument is a `Market`.** The no-theatre test walks the module by
reflection and calls every one-argument export once per market; a different
signature there is a page the forbidden-mechanics check silently stops reading.

**The captain's list of things that must not appear anywhere** — a struck-out
price, a countdown, an invented review count or star rating, a Trustpilot
badge, a paid queue jump, a shipping-protection fee, any hand-made claim — is
that test, across every page and every copy string, each with its reason.
Several are already unrepresentable in the types; the test is the other half.

## The buyer flow is a form, not an editor

The shape is settled by research: **no watermark, no account and no wall**, the
extras offered on the spread they affect, and one way on.
`test/book-flow.test.tsx` asserts the absence of the wall rather than trusting
anybody to remember it. The seven screens the captain approved are `/make/how`
→ `/make/look` → `/make/about` → `/make/message` → `/make/cover` → `/preview` →
`/basket`, and the **one** request that sends an order is `app/_book/till.ts`.

**A navigation outruns the debounced save.** `BookProvider` writes the order
400 ms after it changes and the flow's screens are separate routes, so every
way on calls `flush` first — `test/shop-flow.test.tsx` reads the components and
fails if one does not.

**The opening spread is babyless on purpose.** It is the one spread identical
across every look, which is exactly why it carries the buyer's photograph,
dedication and from-line — switching look cannot reflow anything they typed.
The consequence to remember: the chooser's tiles must come from a page with a
baby on it, which is why `BookTemplate.tilePage` is declared and `validateBook`
refuses a babyless one.

**Crop is the one thing the buyer may move**, and it moves nothing on the page:
a gesture becomes a `PhotoView`, `cropFor` turns it into the `Crop` the format
already defines, and an untouched photograph writes **no crop field at all** —
which is what keeps `orderFingerprint` stable and a reprint of an old order the
same document.

## Four markets, one of which cannot check out

**`lib/shop/market.ts` decides the currency, the shipping countries and the one
sentence a policy says about consumer law.** The United States is the default
and the main market; Australia and the United Kingdom have their own prices;
"everywhere else" has a price and **no countries**, which closes its till on
purpose — the Printify shipping table does not exist yet and this repository
represents an unknown fact as missing rather than guessed.

**Prices are a market-keyed table of set prices** (`lib/book/editions.ts`) and
**never a conversion.** Twelve numbers, twelve decisions, deliberately not in
proportion — `test/market.test.tsx` asserts the absence of proportion, so
replacing the table with a rate fails the gate. The type still has nowhere for
a "was", a percentage or an expiry; `docs/pricing.md` says why the US market
makes that doubly load-bearing.

**The chosen market is a cookie and the cookie is the only input a render
reads.** `proxy.ts` turns the edge's country hint into that cookie on the first
request and nothing downstream consults the hint again — which is what makes
the choice visible and changeable (the pill in `app/_shop/Chrome.tsx` §
`MarketControl`) rather than a price set by an IP address. It is also what keeps
a server render and its hydration from disagreeing. Server components read it
through `app/_shop/market.ts` § `currentMarket`, which answers the default
outside a request so a route stays testable by calling it as a function.

**Shipping is a structured gap.** `lib/shop/shipping.ts` § `RATES` is `null`,
which means *nobody has supplied these* and not *free*: while it is null the
listed price includes delivery and the Checkout Session carries no shipping
option. Filling it in turns the copy, the policy page and the session options
on with no other edit. No page anywhere quotes a delivery date.

## The money path

**Nothing marks an order paid except the signature-verified webhook.**
`lib/orders/receive.ts` is the only caller of `markPaid`, and the redirect back
to `/order/[ref]` is treated as a URL anybody could type — which is what it is.
The store, the clock and the sending of the email all arrive as arguments there
so the flow is testable without a bucket; the route is HTTP glue.

**An order lives in the R2 bucket, and it embeds a `BookFill` rather than
restating one.** `lib/orders/store.ts` opens with the options considered and
why. Its one promise is that a print file can be re-made from the record months
later with no browser — `test/order-reprint.test.ts` is that sentence as an
assertion, and it mints a photograph that is *not* in `fixtures/assets/` so the
paired negative is real.

**`lib/checkout.ts` § `REQUIRED` gates the whole path, not just the Stripe
key.** A shop with a key and no webhook secret charges cards it can never
confirm; with no bucket it takes money for a book nobody can print. Both refuse
with 503 and name the empty rows. There is no pretend-success path for local
work, deliberately.

**One request sends an order.** `app/_book/till.ts` is the only `fetch` to
`/api/checkout`; the basket is the only screen that calls it.

**No `stripe` dependency and no AWS SDK.** Two form-encoded calls
(`lib/stripe/`) and SigV4 over `fetch` (`lib/orders/r2.ts`), each behind a
`fetch` seam so the bytes on the wire are asserted rather than mocked. No test
reaches a live bucket or a live Stripe.

**`/admin` fails closed.** With `ADMIN_SECRET` unset nobody reaches the list, an
order, a print file or a customer's photograph — the opposite of this
repository's usual "inert rather than broken". `test/admin-guard.test.ts` reads
every file under `app/admin/` and `app/api/admin/` and fails if one does not
call `lib/admin/guard.ts` before doing any work.

**Policies are data** (`lib/policy/pages.ts`), one set per market, and the
footers' links come out of `POLICY_LINKS` — a slug and a label, which do not
vary — because the footer used to link to pages nothing served. Every fact in
them is derived: the dispatch window from the email, the countries from the list
the Checkout Session is created with, the prices and the currency from
`EDITIONS` in the market being read.

**The returns page states a policy and never an entitlement.** *"We cannot
resell it, so we do not take change-of-mind returns"* is a promise the business
makes; *"you have no right to cancel"* is a legal claim about law this
repository has not had read. The old Australian-and-European cooling-off
reasoning does not transfer to the United States, and `test/policy.test.tsx`
refuses the phrasings that read as it across every market. The only sentence
about law is `Market.statutory`, and every variant only gives rights away.
**All four policies still want a lawyer against US law before real money
flows.**

## The photo path

**The captain sells two ways and the second one is hand-made.** *Choose a look*
picks one of twelve finished folders. *Upload a photograph* means the captain
takes this book's artwork into an image tool, replaces the child with one
resembling the buyer's, and uploads the result back against one order. Four
pieces serve it and each has its own file-level reasoning.

**TEXT NEVER MAKES A ROUND TRIP THROUGH AN IMAGE MODEL.** `lib/book/artwork.ts`
is the clean-artwork download — the pages with **no text slot and no photo slot
in the derived template at all**, plus a fill with nothing in it. The ordinary
download has the child's name on it, and a model asked to swap a character
redraws the lettering as a garbled near-word; the captain's own artwork survey
found roughly twenty-five pieces in that state. Clean pages out, regenerated art
back, the renderer draws the words afterwards. `test/clean-artwork.test.ts`
reads the pixels of the name's own box, paired against the render that does
carry it. The default is **the right-hand page of each spread** — one per spread,
counted out of `spreads()` and never written down — because that is the half the
captain's artwork puts the child on.

**The file the captain actually ships is the pages, not the PDF.** Printify
takes one raster per print area, so `lib/book/print.ts` § `renderBookPagesZip`
is the primary download on `/admin/[ref]` and the PDF is secondary and for
reading. `lib/zip.ts` writes the container by hand — stored, never deflated,
and with a fixed 1980 timestamp so a download is reproducible.

**Per-order artwork is never committed and the storage choice is still open.**
`lib/artwork/store.ts` is one interface, five operations, with a
local-filesystem implementation; it names the two candidates (private Vercel
Blob, or the R2 content origin under a private prefix) and chooses neither,
because that is the captain's call and being wrong is a migration. A re-upload
**adds a version and keeps the last**, so a bad swap found at 3600 px is
recoverable. `.gitignore` excludes `.artwork/` and `test/order-artwork.test.ts`
asserts the rule — it is one family's child and git history is permanent.
`lib/book/order-upload.ts` holds an upload to the same contract the twelve looks
are held to, by calling `lib/book/upload.ts` § `pageAgainstContract`, and
accepts the captain's `spread-NN-left|right` spelling by **deriving** it from
`spreadSideOf`.

**The custom look is the order's own look, repainted.** `lib/book/order-art.ts`
keeps `lookId`, `id` and `rev` and changes which pixels the look points at —
a new look id would change `orderFingerprint`, which is the order's reference
and Stripe's idempotency key. The derived book declares one look and one cover
because `validateBook` rightly refuses uploaded artwork missing for a look the
book offers, and a cover choice that changes nothing.

**The ghost is preview-only and structurally so.** On the photo path the child
does not exist yet, so the pages they are on carry a soft white pearlescent
glowing silhouette and *"Your little one will appear here"* —
`lib/render/ghost.ts` for the treatment and why the felt figure lost,
`lib/book/ghost.ts` for which pages. It is a **render option**, so the print
path cannot express one; `test/ghost.test.ts` also reads the import graph off
disk. The funnel does not sell the route — `/make/how` still says plainly that
it is not here — and the affordance is `/preview?character=photograph`, exactly
as `/my-forever?guides=1` is.

## Two things that will bite

**Restamp the template.** `templates/*.ts` carry `rev`, eight hex of their own
content hash. Edit a template and `npm run print` (or `npm run book`) refuses
until `rev` is updated — it prints the value to use. `test/template.test.ts`
and `test/book-format.test.ts` assert it too.

**Keep the render deterministic.** Every wobble comes from a seeded
`mulberry32` in `lib/render/random.ts`. `Math.random` anywhere in a render path
breaks the byte-identity test and makes the committed print file meaningless.
Re-run `npm run print` and commit `data/` whenever a render legitimately
changes.

## Writing a test here

`.github/workflows/ci.yml` runs lint, the whole suite, the build, and a check
that `npm run print` leaves `data/` unchanged. **Never narrow what the gate
looks at** — not a file list, not a `-t` filter, not a tighter `include` in
`vitest.config.mts`. `test/config.test.ts` fails if anybody does, including by
adding a test file with an extension the runner does not collect.

Pixel assertions live in `test/pixels.ts`. The standard is that a test which
would pass if the renderer drew nothing is not a test: every content assertion
is paired with the same assertion against a render with that layer removed. A
quick way to check a new test earns its place is to mutate the code it covers
and confirm it goes red.

**Derive the numbers a test asserts, never type them.** Boxes come from the
template's own slots, floors from the slot that implies them, counts from the
list. The trim is an open question, so a suite full of hand-typed coordinates
is a suite that has to be rewritten the day it is answered — and in the
meantime every one of those assertions points at empty cream without saying so.

**React here is glue and is tested without a browser.** There is no DOM in the
suite: component tests render with `renderToStaticMarkup`, so effects do not
run and only the state a visitor arrives in is visible. Everything stateful
lives in `lib/` as a pure function and is tested there. A component that needs
a value tested should take it as a prop — that is why `app/_book/Confirm.tsx`
does.

## Secrets

The repository is public. `.env.example` names every variable and carries no
value for any of them, and `test/checkout.test.ts` asserts both halves of that.
`lib/env.ts` § `isSet` decides what counts as set — a blank row, a placeholder
and a pasted variable name are all "unset", because those are what a dashboard
holds after a hurried deploy.

No secret is ever logged, returned or rendered. The money path's refusals name
the *variables* and never a value; `lib/orders/r2.ts` § refuse and the Stripe
and email modules each have a test asserting their key does not appear in what
they return.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
