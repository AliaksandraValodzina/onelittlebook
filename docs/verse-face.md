# The interior verses' face

**Status: open. The captain chooses, and nothing here has changed a pixel.**
The eleven interior verses are still set in `typewriter` — Special Elite — and
`templates/first-book.ts` § `storySlot` still names it. This document is the
measurement the captain asked for on 19 November, when they wondered whether
the book's font could change too, having just picked a face for the cover.

## What was asked, and the short answer

*Can the book's font change too?*

**Yes, and it is free.** Every vendored face but one fits the verses in the box
the book already has, at the type size it already declares, and **not one of
the captain's hand-marked verse positions would have to move in any of them** —
the ten in `templates/first-book.ts` § `VERSE_TOP_ON` or the eleventh page that
takes the median they derive. The three things that were worth being afraid of
— a line that overflows, a type size forced down, a hand-marked position
quietly redone — are measured below and none of them happens.

What a change *does* cost is in two columns nobody was looking at: how much
**ink** a face puts on the page, and which **names** the shop will still accept.
A third thing that looked like it would decide the answer turns out not to:
the band the verses are set on measures 6.11:1 against the ink at its worst, so
nothing in the lineup is hard to read and the ink column is about the texture of
the block rather than about legibility.

## What is being decided, and what it is not

This is **the eleven interior verses** and nothing else. The cover's title was a
separate decision with its own sheet, its own measurement and its own document
— `docs/cover-face.md`, and it has since been taken: Baloo 2 at 29 pt. The two could easily have become one by accident,
because the cover's title is a `storyText` slot too, so "every story slot" also
means the cover: `lib/book/verse-fit.ts` § `versePages` excludes it explicitly
and `test/verse-face.test.ts` § *"re-facing the verses leaves the cover exactly
as it is"* is the guard.

Two facts about today's book that are commonly got wrong:

- **The verses are `typewriter` and the cover is not.** The cover was Indie
  Flower from the day it was drawn until 19 November, when the captain chose
  **Baloo 2 at 29 pt** for the title. Read both off the slots rather than from
  memory — that is the line that moved, and the day it moved it cost a test.
- **A character count cannot see any of this.** `validateBook` counts
  characters and a character count is face-independent — so the same book, set
  in a face half again as wide, passes every check this repository has and
  prints with four lines of every verse running off the paper. That gap is why
  this was a measure-first task rather than a one-word edit.

## The pictures

    npm run verse-faces

writes to `.artwork/verse-faces/` — **gitignored, and deliberately**: these are
pictures of a family's artwork and this repository is public.

- `sheet-<page>-<look>.png` — one real spread, every face, labelled, with
  today's face outlined. Three sheets, and the command picks which spreads by
  asking the book rather than from a list: the widest-setting verse, the
  highest mark and the lowest. A re-marked spread moves the choice with it.
- `full/page-009-<face>.png` — the page every fit is decided on, at the print
  file's own 3600 px, with fourteen `M`s in the heading.

Every picture is **the real spread**: the captain's own delivered pages, the
verse where they marked it, at the size the template declares, drawn by the one
renderer. Not specimens on white — the verse sits on illustration and whether a
face works is a question about the page.

**The spread and not the page.** A verse sits on the left half and the child is
drawn on the right half, so a picture of the left page alone shows the words
against half of what they are set on. Each tile is both halves, in the order
the book is bound.

**It needs a look with interior pages and says so when there is none.** A fresh
clone has no artwork, and judging a face against the drawn placeholder judges
nothing — the verse band is the artwork's (`docs/look-upload-contract.md` § 3).
The command refuses with the import line rather than writing sheets of flat
colour.

## How the numbers are made

`lib/book/verse-fit.ts` renders each page twice — once with its verse, once
with the slot taken out — and reads the ink's own bounding box out of the
difference. Every differing pixel is the verse's, exactly, which is what makes
"it fits" a measurement rather than a tolerance argument with a photographic
page underneath. It is `test/book-verses.test.ts`'s method and
`lib/book/title-fit.ts`'s, applied per face.

Three things come out of it and they answer three separate questions.

**Across.** The box is 500 pt and the widest-setting line is the binding one.
*Which* line is widest is itself a property of the face, so **all eleven verses
are measured** and the worst is reported rather than trusting spread five's line
to stay widest.

**Ink.** Coverage in square points, averaged over the eleven pages — the
*colour* of the block. This is the column the fit cannot reach: a face can fit
the box at 15 pt and still put half again as much ink on the page. The coverage
is exact rather than a pixel count: a rendered pixel is
`blank × (1 − a) + ink × a`, so the alpha the compositor used is recoverable per
pixel, and antialiasing does not let a thin face with a lot of edge masquerade
as a solid one.

**x-height**, in ems, measured as ink. A face that needs a smaller size is not
thereby smaller to read: these faces differ by 43% between the smallest
lowercase and the largest. "Size" and "apparent size" are separate facts, and
for body text a parent reads aloud at arm's length the second is the one that
matters.

## The result, measured 19 November on the girl-02 spreads

Every width is at the declared **15 pt**, with the longest name the form accepts
(fourteen `M`s) substituted in. **The page that sets widest is `page-009` —
spread five — in every single face**, which is the page carrying the line
`templates/first-book.ts` § `storySlot` already names as the longest:
*"With your bear tucked in close and your blanket pulled tight,"*. That line
carries **no name at all**, so unlike the cover the verses' fit is a property of
the captain's copy rather than of a buyer's name — and the command's realistic
column, measured with *Charlotte-Rose* instead of fourteen `M`s, comes back
identical to the worst case in every row. A row where those two differed would
mean a face so wide that a *heading* had become the binding line, which is the
one way a buyer's name could start deciding the type size.

| Face | Widest line | Fit in the 500 pt box | Ink | vs today | x-height | Marks | Refuses |
|---|---|---|---|---|---|---|---|
| **Special Elite (today)** | 480 pt | fits, 20 pt spare | 5145 | — | 0.521 em | hold | Vietnamese |
| Indie Flower | 367 pt | fits, 133 pt spare | 2617 | **−49%** | 0.419 em | hold | nothing |
| Baloo 2 (ExtraBold, vendored) | 411 pt | fits, 89 pt spare | 7347 | **+43%** | 0.521 em | hold | nothing |
| Baloo 2 (text weight, *not vendored*) | 384 pt | fits, 116 pt spare | 3756 | **−27%** | 0.476 em | hold | — |
| Sniglet | 541 pt | **41 pt over — needs 13 pt** | 11801 | +129% | 0.567 em | hold | Polish, Czech, Turkish, Vietnamese |
| Grandstander | 446 pt | fits, 54 pt spare | 7629 | +48% | 0.601 em | hold | nothing |
| Fredoka | 409 pt | fits, 91 pt spare | 7190 | +40% | 0.521 em | hold | Polish, Czech, Turkish, Vietnamese |
| Bubblegum Sans | 328 pt | fits, 172 pt spare | 5238 | +2% | 0.544 em | hold | Polish, Czech, Turkish, Vietnamese |
| Chewy | 361 pt | fits, 139 pt spare | 7469 | +45% | 0.555 em | hold | Polish, Czech, Turkish, Vietnamese |
| Comfortaa | 478 pt | fits, 22 pt spare | 5716 | +11% | 0.555 em | hold | nothing |
| Bree Serif | 405 pt | fits, 95 pt spare | 6190 | +20% | 0.510 em | hold | Vietnamese |
| Gochi Hand | 376 pt | fits, 124 pt spare | 4550 | −12% | 0.487 em | hold | Polish, Turkish, Vietnamese |

Ink is coverage in square points, averaged over the eleven pages. x-height is an
**ink** height and not a font's declared figure, so roughly half a point of it is
stroke weight — which is why Baloo 2 reads 0.521 em at ExtraBold and 0.476 em at
its text weight for one unchanged lowercase.

Re-run the command for the live numbers; `.artwork/verse-faces/README.md` is
written beside the pictures and is this table as the machine last made it.

**The first row validates the method.** Special Elite measures 480 pt, which is
the number `templates/first-book.ts` § `storySlot` recorded from a hand
measurement — and 500 − 480 is the 20 pt of headroom that docblock claims. That
sentence has been trusted since 12 November and is now checked on every run of
the suite: `test/verse-face.test.ts` § *"holds the widest verse in the book,
with the headroom the template claims"*.

### Only one face does not fit, and it is also the one that fits worst elsewhere

**Sniglet** sets the widest verse 41 pt past the box and would need the type at
**13 pt**. Thirteen-point body text in an 8 × 8 in picture book read aloud to a
one-year-old is the wrong direction, and Sniglet is also the heaviest face in
the lineup by a long way (+129% ink) and one of the five that narrows what the
shop accepts. It is out on three counts, and no judgement of taste was needed
for any of them.

## What the verses are set on, which is where the obvious reading fails

The captain's generation brief reserves the middle of the left page and asks for
it *"soft, out of focus, light in value and low in detail so dark verse text can
be added later"* — `docs/look-upload-contract.md` § 3. Read that and the ink
column is a pure cost: a light ground takes thin type fine, so more ink is just
more weight on a page a parent reads aloud, and **Baloo 2 ExtraBold's +43% is an
argument against it.** That is the reading this measurement started from, and
the sheet does not support it.

**The delivered band is not light.** On girl-02's night spread (`page-009`) it
is mid-value lavender; on the lowest-contrast page in the look (`page-017`,
crawling) it is muted sage. Both were looked at at full size, because one spread
is an impression and two are a pattern, and on both the committed face reads
visibly thin while the heavier faces read as present rather than as heavy. So
the band is a number worth
having, and it is free — the blank half of the difference every fit is measured
from *is* a picture of what the words land on. `lib/book/verse-fit.ts`
§ `bandContrastIn` reads it: the WCAG ratio between the slot's declared `#3B2A20`
and the mean of the pixels under the verse, per page, identical for every face.

| Page | Band luminance | Contrast with the ink |
|---|---|---|
| page-003 | 0.518 | 7.39:1 |
| page-005 | 0.485 | 6.95:1 |
| page-007 | 0.730 | 10.14:1 |
| page-009 | 0.427 | 6.20:1 |
| page-011 | 0.658 | 9.21:1 |
| page-013 | 0.618 | 8.68:1 |
| page-015 | 0.856 | 11.78:1 |
| page-017 | 0.420 | **6.11:1** |
| page-019 | 0.563 | 7.97:1 |
| page-021 | 0.695 | 9.69:1 |
| page-023 | 0.618 | 8.69:1 |

**6.11:1 at its worst, 8.44:1 on average** — and the spread of it is the other
half of the point: the band runs from 0.420 to 0.856 in luminance across eleven
pages, so "the ground the verse sits on" is not one thing even inside one look.

That settles it in the unglamorous direction, and both halves matter:

- **Every page clears 4.5:1 comfortably**, so no face in the table is hard to
  read for want of contrast and the ink column is **not** a legibility argument
  in either direction. Baloo 2 ExtraBold's extra ink does not buy readability;
  Special Elite's thinness does not cost it.
- **What the ink column is about is the texture of the block** — how much of a
  quiet page is covered in letters. That is a taste question with a number
  attached, which is exactly the kind of question the sheets exist for and this
  document should not pretend to settle.

The other thirteen looks have no interior pages in this store, so their bands
are unmeasured — the same gap `docs/cover-face.md` § The corner carries the
title records for the cover, with the same answer: a human, looking at the
sheets, per look as it lands.

## The captain's marks survive every face, and that is structural

On 13 November the captain screenshotted the interior spreads and drew a
rectangle on each showing where that spread's verse belongs, across two rounds;
`templates/first-book.ts` § `VERSE_TOP_ON` is those marks — ten of them, with
`page-003` the one spread nobody has marked, taking the median the others
derive. **No face moves one, and no face could.**

`lib/render/svg.ts` § `drawTextSlot` sets line *i* at
`frame.y + baseline + lineHeight × i`, absolutely. Not one of those three
numbers is a font metric, so where the block sits is declared data. The absolute
baseline is there for a different reason — a blank line must not close up
between the browser and `resvg`, which is the gap under every verse's heading —
and the fact that it also makes the captain's marks immune to a change of face
is a consequence worth knowing about rather than a coincidence to rely on
quietly.

What a face *does* change is how far the ink reaches above the first baseline
and below the last: its ascent and its descent. The budget there is generous and
measured. Six lines at the declared 26 pt is 156 pt in a 160 pt box, and the
first baseline sits 20 pt down — so there are about 9 pt of clearance above and
6 pt below in practice. The **worst** reach of any face in the table is 7.9 pt
*inside* its box at the top and 2.3 pt inside at the bottom: every face clears
the box on every page, on the extreme marks (`page-021` at y 60 and `page-011`
at y 320) as much as in the middle. A face would need an ascent of about two ems
at this size to break out, which is not a thing a text face is.

Asserted rather than argued: `test/verse-face.test.ts` § *"a change of face
moves none of the captain's marks"* measures every vendored face on every
verse page, and its paired control measures the same book at four times the type
size, where the marks must — and do — stop holding.

## “Refuses” is the half a picture cannot show, and it is the surprise

`lib/book/name.ts` § `facesTheNameIsSetIn` adds the face of any slot whose
authored copy carries `{name}`, and ten of the eleven verses do. So **the verse
face is one of the two faces every buyer's name is checked against**, and
changing it changes which names the shop will take. The two rows that matter:

- **Five candidates would narrow it.** Sniglet, Fredoka, Bubblegum Sans, Chewy
  and Gochi Hand cannot write *Żaneta*, *Gülşen* or *Řehoř*, and `checkName`
  refuses a character any face the name lands in cannot set. Choosing one of
  those is choosing to turn buyers away, which is a product decision wearing a
  typographic hat.
- **Moving off Special Elite would widen it.** Today's book refuses *Nguyễn*,
  and it refuses it **because of the verses** — Special Elite has never carried
  Vietnamese, and Baloo 2, the cover's face since 19 November, does. With the
  verses in Baloo 2,
  Grandstander, Comfortaa or Indie Flower, the shop's refusal list is **empty**.
  That is a real gain nobody asked for and it is sitting in the table.

## The lighter Baloo

Baloo 2 is vendored at **ExtraBold** and that is the right weight for the job it
was chosen for: three words on a cover. The measurement says what it costs on
eleven pages of body copy — **+43% ink** over today, at an identical x-height, so
the page gets heavier without a single letter getting easier to read. That is
the "likely too heavy for body text" worry as a number rather than an opinion.

So the comparison needs the same family at a text weight, and that file is not
here. Baloo 2's lighter weights exist only in its variable file, and
`lib/render/fonts.ts` must not learn about a font for the sake of a
measurement — so the row is drawn the way `scripts/cover-faces.ts` draws its
More Sugar reference: by this script's own rasteriser, from a file an
environment variable names, with no route to it from `FACES`, from a template or
from `lib/book/print.ts`. It is measured by the **same** `inkBetween` as every
other row, so its numbers are comparable and not merely adjacent.

    curl -L -o /tmp/Baloo2.ttf \
      'https://raw.githubusercontent.com/google/fonts/main/ofl/baloo2/Baloo2%5Bwght%5D.ttf'
    BALOO2_VARIABLE_TTF=/tmp/Baloo2.ttf npm run verse-faces

The file's `wght` axis runs 400–800 and its **default is 400**, which is the
instance `resvg` draws — confirmed by measurement rather than assumed: the same
page in the same family comes out 384 pt wide and 3415 sq pt of ink against the
ExtraBold static's 411 pt and 6719. It is OFL-1.1, so vendoring it is a
licensing non-issue; what it is not is a decision anybody has made.

## The recommendation

**It can change, nothing has to move to let it, and the choice is the captain's
eye on the sheets.** No measurement defends Special Elite — it is the
second-widest face in the lineup, it is the only reason the shop refuses
Vietnamese names, and it is a distressed 1940s typewriter on a baby's
first-birthday book. No measurement forbids it either. What the numbers do is
take four candidates off the table before anyone looks, and price the rest.

**Out on product grounds, whatever the eye says.** Sniglet, Fredoka, Bubblegum
Sans, Chewy and Gochi Hand cannot write *Żaneta*, *Gülşen* or *Řehoř*, and
`checkName` refuses a character any face the name lands in cannot set. Choosing
one of those is choosing to turn buyers away. Sniglet is out twice over: it is
also the only face that does not fit, and 13 pt body text read aloud to a
one-year-old is the wrong direction.

**First choice: Baloo 2 at a text weight.** It is the best row in the table on
every column at once — fits with 116 pt spare, **27% less ink** than today, and
it refuses no name. It is also the cover's own family, so the book reads as one
object rather than as a title and an interior that met by accident. The cost is
a file: somebody has to vendor a static instance and add one `FACES` entry,
which is the one thing on this page that is not already in the repository. It
was written conditional on the cover actually going to Baloo 2; **that condition
is met** — `docs/cover-face.md` records the cover landing on Baloo 2 at 29 pt on
19 November, so "the cover's own family" is a fact about the committed book and
not a bet on a decision in flight.

**Second choice, needing no new file: Bree Serif.** Vendored today, fits with
95 pt spare, +20% ink, an x-height a shade under today's, and it refuses exactly
what today refuses — so it narrows nothing. It is the only face in the lineup
that is a *text* face by design: a rounded-terminal slab serif reads as a book
rather than as a toy, which is the keepsake answer to the brief, and on the
full-size renders it is the cleanest of the lot at this size.

**Baloo 2 ExtraBold is more defensible for the verses than it was expected to
be, and that is reported here rather than quietly dropped.** The expectation was
that it would be too heavy for body text. At 15 pt on the delivered band it
reads as present, not heavy — the band is not the light ground the brief
promised, and today's face is the one that looks thin there. The honest
statement is the number: +43% ink over today at an identical x-height, so it
buys texture and not readability. For six lines on eleven spreads the text weight is
still the better of the two: it gets the family match without the texture. But
"obviously too heavy" is not what the pictures show, and the captain should
decide that from the sheet rather than from this paragraph.

**Grandstander is the one to look at third.** It refuses nothing, has the
largest x-height in the lineup by a clear margin — 0.601 em, 15% larger than
today's, which is a real gain for a parent reading at arm's length — and fits
with 54 pt spare. Against it: +48% ink, the heaviest of the faces that fit.

**Indie Flower is in the lineup because the captain asked for it, and it is the
weakest row on the page.** A book whose cover and verses shared one
hand would have been a deliberate choice — but it stopped being the cover's
face on 19 November, and on the two columns that matter for six lines of body copy it is the
weakest row here: **49% less ink** than today and a **0.419 em x-height**, 20%
smaller than today's at the same point size. On the full-size renders it is
plainly the faintest of the twelve. Matching the others would mean raising the
type, which means re-opening the box, and the box is where the captain's marks
are.

Comfortaa is in the lineup to mark where the register ends rather than to win:
it refuses nothing, but it is rounded by construction and cold with it, and it
leaves only 22 pt of headroom — as tight as today.

**"Leave it" is an honest answer and it is not the one the numbers point at.**
Nothing breaks if the verses stay in Special Elite; the book prints today and
has since 12 November. But the only thing the committed face has going for it
over Bree Serif or a text-weight Baloo 2 is that it is already there, and it
costs the shop every Vietnamese name it is offered.

## Switching, when the captain picks

One word in `templates/first-book.ts` § `storySlot` — the slot's `font` — and
then `npm run print` to restamp `rev` and refresh `data/`. Nothing else moves:
not `VERSE_TOP_ON`, not `VERSE_HEIGHT`, not the box, not the size, not a
character limit. That is the whole of what this measurement was for.

Two consequences to carry out in the same change rather than later:

- **`test/verse-face.test.ts`'s headroom assertion re-measures itself** against
  whatever the new face holds. Its bound is the 20 pt the old docblock claimed,
  so a switch means updating that claim in `templates/first-book.ts`
  § `storySlot` to the new face's measured width and the test's `claimed` to
  match. The table above has the number for every candidate.
- **The shop's refusal list changes with it**, through
  `lib/book/name.ts` § `facesTheNameIsSetIn` rather than through `nameSlotFont`
  — that one reads the *first* slot the name lands in, which is the cover's
  title and is not this decision. If the new face writes Vietnamese, the shop
  starts accepting Vietnamese names the day it lands. That is a widening and
  wants no other edit, but it should be a thing somebody decided rather than a
  thing that happened.

And if the verses move to a face the cover is also on, the vendored lineup
should lose its losers in the same pass, which is what `Face.candidate` is for.
