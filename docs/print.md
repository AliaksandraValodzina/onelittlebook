# The print file

**What goes to Printify, what was measured out of their own templates, and the
one thing this repository still declares wrongly.**

The captain's sentence was *"once saved, I want to download it in 3150x3150 px
size"*, confirmed against Printify. That number is load-bearing all the way to a
physical object, so this document says what rests on evidence, what rests on a
reading of Printify's own guidance, and what is still an assumption.

**The book's size was settled on 15 November by opening Printify's own
templates and reading their headers**, which is the first time any number on
this page came from the files rather than from reasoning about them. Two
sections carry the consequences and both are worth reading before touching a
canvas: [§ What Printify's templates actually
say](#what-printifys-templates-actually-say), and [§ The page the book declares
is not the page Printify prints](#the-page-the-book-declares-is-not-the-page-printify-prints),
which is the discrepancy that remains, the reason it has not been corrected
in place, and — since 16 November — the captain's decision to leave it that
way.

---

## What the files are

### The baby book — `templates/first-book.ts`

| | |
|---|---|
| Size | **3600 × 3600 px** a page, 25 pages, measured out of the PNG header by `test/book-print.test.ts` |
| Artboard | 612 × 612 pt, **declared** as 8.5 in square, bleed included |
| Declared trim | 576 × 576 pt = 8.00 in square, derived from the declared bleed |
| **What Printify's interior print area actually is** | **2400 × 2400 px = 8.00 in square** at 300 dpi, read out of the template — so the artboard is 8.00 in and the declaration above overstates it by 6.25%. § The page the book declares is not the page Printify prints |
| Resolution | **450 DPI** across Printify's real 8.00 in area; the 423.5 the declaration implies is the same pixels described wrongly. Derived, never declared |
| Colour | **sRGB**, as below |
| Encoding | PNG a page, or one PDF of the whole book (`/DeviceRGB`) |

**The cover is a different print area from the interior and is not square** —
one wide piece carrying the back cover, the spine and the front.
`lib/book/cover-wrap.ts` composes it from this square and
[§ The cover wrap](#the-cover-wrap) is the whole of it.

The committed example is `data/bk-first-book-buyer-flow/`.

### My Forever — `templates/my-forever.ts`

| | |
|---|---|
| Size | **3150 × 3150 px**, measured out of the PNG header by `test/print-size.test.ts` |
| Artboard | 756 × 756 pt = **10.5 in square** |
| Resolution | **300 DPI**, derived — `print.pixels ÷ canvas.width × 72`, never declared |
| Colour | **sRGB**, written into the file as a PNG `sRGB` chunk (intent 0, perceptual) with a matching `gAMA` |
| Encoding | PNG, RGBA, ~1.5 MB |

The committed example is `data/bk-spine-template-and-print/`.

### Which of them is the one that gets uploaded

**Printify takes one raster per print area**, so the artefact the captain
actually ships is **the twenty-five pages as PNGs in one ZIP** — twenty-four
interiors and the cover, numbered so they sort into reading order and named with
the order's reference. That is the prominent download on `/admin/[ref]`;
`lib/book/print.ts` § `renderBookPagesZip` builds it and `lib/zip.ts` is the
container, written by hand and stored rather than deflated because a PNG is a
deflate stream already.

**The PDF is secondary and is for reading a book**, not for feeding a
print-area form: a single PDF has to be taken apart again, twenty-five times, in
order, by hand, before any of it can be uploaded.

**There is a third file and it is not a print file at all.** On the photo path
the captain downloads the artwork **with no text drawn on it** and puts it into
an image tool to replace the child — `lib/book/artwork.ts`. It is a separate
download from the two above and has to be, because *text never makes a round
trip through an image model*: a model asked to redraw a page redraws the
lettering as a garbled near-word, and a printed book with a mangled name on the
cover is unsellable. Clean pages out, regenerated art back, the renderer draws
the words afterwards.

---

## Does Printify want bleed?

**Short answer: no — not as extra pixels.** The 3150 is the whole canvas, not a
trim size, and the artboard is not enlarged.

### The evidence

Printify's own file-prep guidance ([POD File Prep Checklist: Bleed, DPI & Safe
Zones](https://printify.com/knowledge-hub/file-prep-blueprint-for-bleeds/)) tells
a seller to work from the template the Product Creator hands them:

> Download the design template directly from the Product Creator. Each product
> has its own template

…with guide layers for *"the bleed area (red line), the trim line (dashed), and
the Safe Zone (green box)"*, and:

> Stretch your background graphics all the way to the outer bleed edge (the red
> line), every time.
>
> Keep every key visual safely inside the inner Safe Zone (the green box).

So the template's **outer** edge is the bleed edge, the trim line sits *inside*
it, and the size Printify states is the size you supply. Printify's help centre
says the same thing from the other direction: *"the file requirements for each
print area"* are shown per product in the Product Creator, and the recommended
resolution is 300 DPI ([What type of print files does Printify
require?](https://help.printify.com/hc/en-us/articles/4483617936657-What-type-of-print-files-does-Printify-require)).
sRGB is the stated colour space.

That is the whole of the "do I make the canvas bigger" question, and the answer
is no. **3150 × 3150 is right as the artboard**, and a renderer that enlarged it
to "add bleed" would be supplying a file the Creator then scaled down.

### What is still open, and it is My Forever's half only

**The book's half of this was answered on 15 November** by opening the real
templates — § What Printify's templates actually say. What is below is now
about `templates/my-forever.ts`, whose product is a different one and whose
template nobody has downloaded.

**Where the trim line falls inside those 3150 pixels.** Printify does not
publish that number outside the Product Creator, and reading it needs somebody
signed in to the account with the product open. Both 0.125 in and 0.25 in are
standard; photo books tend to the larger — and the book's measured answer,
0.125 in, is evidence for the smaller rather than proof of it, since it is a
different product.

**This is handled rather than guessed.** `canvas.bleed` is a declared field, and
the template declares the *larger* of the two — 18 pt (0.25 in) — because
over-declaring moves the trim guide **inwards** and keeps content further from
any real cut line, where under-declaring would move it towards one. A further
18 pt of `safe` sits inside that, and
`lib/template/validate.ts` refuses any template whose photo windows or words
cross it (`slot.outsideSafeArea`). Every customer-visible thing on this page is
therefore **at least 0.5 in from the edge of the file**, which survives any real
bleed between 0 and 0.25 in.

When somebody opens the Product Creator's template for this product, this
becomes one number in `templates/my-forever.ts`, a restamped `rev`, and a
re-run of `npm run print`. Nothing else moves — which, as § The page the book
declares is not the page Printify prints records, turns out to be true of the
*bleed* and not of the artboard it is measured from.

<a id="what-printifys-templates-actually-say"></a>

## What Printify's templates actually say

**The question this page had been carrying since 31 October — what 3600 px is
3600 *of* — was answered on 15 November by downloading Printify's own templates
for this product and reading their headers.** Not by reasoning about round
numbers, which is what every earlier attempt did and which is why the answer it
reached was wrong twice over.

The two products are Printify's [Softcover Photo
Book](https://printify.com/app/products/2733/generic-brand/softcover-photo-book)
(blueprint 2733, 8 × 8 in, its only size) and its [Hardcover Photo
Book](https://printify.com/app/products/2737/generic-brand/hardcover-photo-book)
(blueprint 2737, 8 × 8 in being one of four) — the captain's specification of
6 November names both, and one artwork set serves them, which is what makes the
hardcover an *upgrade* rather than a second product. Only the softcover's
templates have been downloaded.

### The cover template

`Template_Custom_SoftcoverBook_8x8_Cover.psd`, from the Product Creator for the
product its own template names **"8.00 x 8.00 CUSTOM SOFTCOVER BOOK"**, SKU
range 11687–11853:

| | |
|---|---|
| Supplied area (the whole file) | **4790 × 2400 px** = 15.967 × 8.000 in, RGB 8-bit |
| Finished, after the cut | **4715 × 2325 px** = 15.717 × 7.750 in |
| Safety zone, per panel | **2220 × 2250 px** = 7.40 × 7.50 in |
| Resolution | **300 dpi** |

### The interior template

From the same download: **2400 × 2400 px at 300 dpi = 8.00 in square.**

### What follows by arithmetic, and is therefore derived rather than typed

**The bleed is 0.125 in per edge, not the 0.25 in this repository declares.**
(2400 − 2325) ÷ 2 = 37.5 px vertically and (4790 − 4715) ÷ 2 = 37.5 px
horizontally — the two axes agree, which is what makes one number honest.

**The finished panel is 7.75 in square, not 8.00.** "8 × 8" is the product's
name and the SKU's wording; it is not its trim. This is the single most
expensive sentence on this page, because every earlier version of it took the
name for a measurement.

**The spine is 65 px, 0.217 in** — 4715 − 2 × 2325 — and nobody publishes
it, because it is a consequence of the paper and the binding. That is exactly
why a hardcover wrap cannot be derived from a softcover one.

All four live in `lib/print/printify.ts` as one `MeasuredTemplate` with the
filename beside them, and every length anything else uses is arithmetic on
them. `test/cover-wrap.test.ts` asserts the arithmetic and the agreement
between the axes.

**The PSDs themselves are the captain's downloads and are deliberately not in
this repository.** They are tens of megabytes of somebody else's template, and
the four numbers above are the whole of what this codebase needs from them.

<a id="the-cover-wrap"></a>

## The cover wrap

**Printify's cover print area is not the square the website shows.** It is one
wide image carrying the **back cover, the spine and the front**, because a
softcover is printed flat and wrapped round the block. The shop composes it.

Asked on 15 November whether to generate three files per look — a softcover
wrap, a hardcover wrap and a square — the captain chose **one square front per
look**, with:

- **the back cover a plain wash**, drawn from that look's own palette;
- **the spine bare** — no title, no name, no text at all;
- **the shop composing the wrap**, so one square serves the website, the
  softcover and the hardcover.

**The constraint that makes this the only workable shape is that a hardcover
spine is wider than a softcover one.** A hardcover wrap can therefore never be
produced by stretching a softcover one: the panels would land off the hinge and
the back cover would be cut into. Composing from panels makes both products
correct, and makes a future spine-width change a number in
`lib/print/printify.ts` rather than thirteen regenerated images.

### How it is made

`lib/book/cover-wrap.ts` lays the wrap out as **bleed, back panel, spine, front
panel, bleed**, which tiles the supplied area exactly — 37.5 + 2325 + 65 + 2325
+ 37.5 = 4790. The front panel is the square cover's **own render**, hashed and
handed to the renderer through the `supplied` seam `lib/render/raster.ts`
already has, so the wrap is a `PageTemplate` of three layers drawn by the one
renderer. There is no compositor in this repository and composing a cover did
not add one.

The square is cover-fitted to the panel region, which means its own trim lands
a little *inside* the panel's trim and what shows in the margin is the square's
full-bleed artwork. That is the safe direction: nothing the buyer approved can
fall off the cut. `test/cover-wrap.test.ts` measures where the title's ink
actually lands — as a difference between two renders, so the box is the ink's
and not a frame's — and asserts it is inside Printify's safety zone for that
panel.

The wash is the cover's own ground, which for this book is the colourway the
buyer chose, so the back of the book is the colour of the front of it by
construction. `Look.wash` is where a per-look wash goes when the captain
delivers cover squares with their own palettes; absent means the cover's ground,
which is what every look has today.

### The hardcover is declared and unconfigured, deliberately

`COVER_PRODUCTS.hardcover` carries **no template**, in the same shape
`lib/shop/shipping.ts` leaves `RATES` null and `lib/product.ts` keeps `value`
off the unconfirmed arm: the template is on one arm of a union, so there is
nowhere to put an estimate. Asking for one raises `CoverWrapUnavailable`, and
the refusal names the file to fetch and the four numbers to read out of it.

**What has to happen to turn it on:** somebody signed in to the Printify
account opens the Product Creator for blueprint **2737** (Hardcover Photo
Book), 8 × 8 in, downloads its **cover** template, and reads the supplied area,
the finished size, the per-panel safety zone and the resolution out of the file
header. Those four numbers become a `MeasuredTemplate` in
`lib/print/printify.ts` and the entry flips to the measured arm. Nothing else
changes — not the composition, not the renderer, not a single image.

<a id="the-page-the-book-declares-is-not-the-page-printify-prints"></a>

## The page the book declares is not the page Printify prints

**This is the one thing on this page that is known to be wrong and has
deliberately not been corrected — the captain decided on 16 November to leave
it — and this section exists so that nobody corrects it by accident.**

`templates/first-book.ts` declares a **612 pt (8.5 in) artboard with 18 pt
(0.25 in) of bleed**, which makes its declared trim 576 pt, 8.00 in. Printify's
interior print area is **8.00 in**, and its finished page is **7.75 in**. So
every inch figure the book derives is **6.25% larger than the object**, and the
declared bleed is twice the real one.

### What it costs today, which is less than it sounds

**Nothing drawn is at risk.** The repository's declaration is *proportionally
conservative*: it puts the trim guide 2.94% in from the edge of the file where
the guillotine really falls 1.56% in, and `canvas.safe` adds another 2.94% on
top — so every slot in the book is further from the real cut than the
declaration claims, not nearer. The verse box begins 56 pt (0.78 in) from the
page edge against a real bleed of 0.125 in.

**Two claims are wrong and both are stated to a customer.**
`lib/book/product.ts` derives the finished page from the declared bleed, so the
book page says *"8 in square, trimmed"* where the object is 7.75 in, and
*"8.5 in square, bleed included"* where the file covers 8.00 in. Neither is
dangerous and both are untrue.

### Why it was not simply corrected

**Because correcting it moves drawn content, and the brief that found it said
to stop and report rather than silently reflow twelve spreads.**

The artboard and the trim are one statement, not two: declaring the real
page — 576 pt artboard, 9 pt bleed, 558 pt trim — shrinks the artboard by
36 pt while every layer in the template keeps its coordinates, which slides the
whole book 18 pt off centre on a cover whose panel was placed by eye. Keeping
the picture identical means re-authoring **every** coordinate, type size,
baseline and line height in `templates/first-book.ts` by a factor of 16/17 —
and that file's numbers are measurements: the captain's twelve verse marks, a
15 pt type size chosen against a measured 480 pt line, a 500 pt box with 20 pt
of headroom, a cover title at 44 pt with two characters of room in sixteen.
Rescaling them is a rewrite of every paragraph of reasoning in that file, and
every re-derived number is a chance to get one wrong.

The other half is a product decision and not an engineering one: the finished
size the shop *states* would change from "8 inches square" to "7.75 inches
square", on a product Printify itself calls 8 × 8.

### What was decided: leave it

**The captain decided on 16 November: option 1, leave it.** The declaration
stays conservative, the shop goes on saying 8 in, and this section is now the
record of why rather than an open question. The three options were:

1. **Leave it.** The declaration stays conservative, the shop goes on saying
   8 in, and this section stays as the record of why. — **chosen.**
2. **Correct the declaration and re-author the grid**, 16/17 across the whole
   template, with a restamped `rev` and a re-run of `npm run book`. The
   rendered pixels are unchanged in principle and every measured number in the
   file has to be re-derived in practice.
3. **Correct the declaration and accept the shift**, which is a reflow of
   twelve spreads and needs the captain's eye on every one.

**The reasoning, in the captain's own terms:**

- **The error runs in the safe direction.** The book believes the cut line is
  further in than it really is, so artwork sits further from the blade than it
  needs to, never closer. Nothing printed is at risk. The arithmetic above is
  the evidence for that and is what makes this decision re-checkable.
- **"8 × 8" is Printify's own product name**, so the shop saying 8 inches
  matches what a customer would recognise on the product they bought.
- **Nothing has sold yet**, and the first physical proof will inform this
  better than arithmetic can.

**The revisit trigger**, which is the part a future reader needs: revisit when
the captain holds a printed proof. If 7.75 in reads as meaningfully smaller
than expected, decide again then, with the object rather than a spreadsheet.

**Nothing about the cover wrap depends on this.** Its geometry comes from the
measured template and the square is fitted to the panel, which is
scale-invariant: the wrap is correct today whatever the book declares about
inches.

---

<a id="the-12-12-is-the-hardcover-confirmed-and-not-built"></a>

## The 12 × 12 is the hardcover, confirmed and not built

**The 11 November reading of "12 × 12 in" was not an error.** It was withdrawn
on 15 November as a reading rather than a measurement, and that withdrawal was
itself wrong — it was relayed onward as fact before anybody checked. On
16 November the captain confirmed the reading described a **real product from
the same supplier**: a **12 × 12 in hardcover**. It was simply a *different*
product from the one the measured templates describe.

So, plainly:

- the **softcover is 8 × 8**, and the templates measured on 15 November
  (§ What Printify's templates actually say) are its;
- a **12 × 12 hardcover** is available from the same supplier and the captain
  has confirmed it;
- the 11 November reading described that product, and was mistakenly read as
  describing this one.

**The strongest argument for the 12 × 12 ever being built is that the artwork
already fits it exactly.** 3600 × 3600 px is **precisely 300 dpi across a 12 in
page**. The library of artwork already generated is natively the right
resolution for the larger book, and is **450 dpi — 2.25× more pixels than
asked** — across the 8 in one. Nothing would need regenerating either way.

**It is deferred, not planned.** The captain's decision of 16 November is to
finish and sell the 8 × 8 first, so there is deliberately **no product, no
price, no template entry and no configuration** for the 12 × 12 anywhere in
this repository — in the same register `COVER_PRODUCTS.hardcover` already uses
for a wrap nobody has measured: a confirmed option represented as not built
rather than guessed at.

---

## Why sRGB is in the file and not only in this document

An untagged PNG is treated as sRGB by every RIP, which is why most pipelines get
away with saying nothing. "Is treated as" is a convention somebody else
maintains. `lib/render/png.ts` writes an `sRGB` chunk (13 bytes) and a matching
`gAMA` immediately after the header, where the specification requires both to
sit — before `PLTE` and before the first `IDAT`. `test/print-size.test.ts`
asserts the position as well as the presence, on a fresh render and not only on
the committed file.

CMYK is deliberately not offered. Printify asks for sRGB, the provider's RIP
does the separation with a profile matched to its own press, and a separation
done here would be a guess at somebody else's ink.

---

## Why the renderer, and not a screenshot

`lib/render/svg.ts` produces the page as SVG with a `viewBox` in page units and
**no width or height on the root element**. The page is therefore a shape rather
than a size, and the raster resolution is a pure multiplier applied at the very
end — which is what lets "show me this at 900 px" and "print this at 3150 px" be
the same call with one number changed.

The alternative — capturing the view that is already on screen — cannot produce
this file at all. No screen lays out 3150 pixels to be photographed. Keepnook's
`lib/spreadRender.ts` opens with the same argument and is worth reading.

---

## Evidence tiers

| Claim | Tier |
|---|---|
| My Forever's file is 3150 × 3150 | **Verified** — read out of the PNG header by a passing test |
| The book's pages are 3600 × 3600 | **Verified** — read out of the PNG header by a passing test |
| The whole book opens as a PDF with a page per page | **Verified** — the container is parsed back out of its own bytes |
| The committed sample PDF is byte-for-byte reproducible | **No, and deliberately not claimed** — its image streams are deflated by Node's zlib, and zlib builds emit different equally-valid streams for the same pixels. CI excludes `*.pdf` from its byte comparison for this reason only; the PNGs are not excluded |
| Either file carries an sRGB chunk before IDAT | **Verified** — asserted on a fresh render |
| The committed files are what the renderer produces today | **Verified** — byte-for-byte equality in a passing test |
| Every slot sits ≥ 0.5 in inside the file edge | **Verified** — `slot.outsideSafeArea` would fire, and does when a slot is moved |
| The book's **declared** trim is 8.00 in | **Declared, and wrong about the object** — derived here from the declared bleed. The finished page is 7.75 in; § The page the book declares is not the page Printify prints says why the declaration has not been changed |
| Printify's interior print area is 2400 × 2400 px = 8.00 in at 300 dpi | **Measured** — read out of the header of the interior template downloaded from the Product Creator, 15 November |
| The softcover cover wrap is 4790 × 2400 px, finished 4715 × 2325, safety 2220 × 2250 per panel, 300 dpi | **Measured** — read out of the header of `Template_Custom_SoftcoverBook_8x8_Cover.psd`, 15 November |
| The book's finished page is 7.75 in square | **Derived from a measurement** — the cover template's own bleed of 0.125 in, off an 8.00 in interior area. The interior template's own guide layers were not read |
| The hardcover's wrap dimensions | **Unknown, and represented as unknown** — `COVER_PRODUCTS.hardcover` carries no template and a wrap for it refuses |
| A 12 × 12 in hardcover exists at the same supplier | **Captain-confirmed, 16 November** — and deliberately not built; § The 12 × 12 is the hardcover, confirmed and not built |
| 3600 × 3600 px is exactly 300 dpi across a 12 in page | **Arithmetic** — 12 × 300 = 3600, which is why no artwork would need regenerating for the larger book |
| Printify's stated print area already includes bleed | **Documented** — Printify's own knowledge-hub wording, quoted above; not confirmed in the Product Creator |
| Printify wants sRGB | **Documented** — Printify help centre |
| The trim line sits 0.25 in inside My Forever's artboard | **Assumed, conservatively** — not measured; see above |
| The trim line sits 0.25 in inside the book's artboard | **No — measured at 0.125 in**, and the template still declares 0.25. Conservative in the safe direction; § The page the book declares is not the page Printify prints |
| 3150 px is the right number for My Forever | **Captain-confirmed** — stated in the brief as checked against Printify |
| 3600 px is the right number for the book | **Yes, and now for a measured reason**: Printify's interior print area is 2400 px, so 3600 is half again as many pixels as they ask for across the same 8.00 in. It downscales, which is free, where upscaling is the expensive mistake. The 11 November note of 12 × 12 in was **about the hardcover, not this product** — see § The 12 × 12 is the hardcover, confirmed and not built |
| The cover wrap this repository produces is 4790 × 2400 | **Verified** — read out of the PNG header of a fresh render by `test/cover-wrap.test.ts`, against the configured measurement rather than a typed number |
| The front panel's content lands inside Printify's safety zone | **Verified** — measured as a difference between two renders, so the box is where the ink went |
