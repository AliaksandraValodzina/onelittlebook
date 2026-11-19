# The cover title's face

**Status: decided 19 November. The cover is set in Baloo 2 at 29 pt.** The
captain chose it off the comparison sheets; `templates/first-book.ts` § `cover`
names `baloo` and § `TITLE_CORNER` carries the size. `lib/render/fonts.ts` no
longer marks it a candidate, which is how a decision arrives in the registry.
The eight losing candidates are still vendored so that `npm run cover-faces`
still draws the sheet the decision was made from; taking them out is § Switching
below and is the one piece of this that is still owed.

**What the choice cost, in one line: nine points of type and nothing else.**
Baloo 2 at 38 pt sets the guaranteed worst case 85 pt past the captain's corner,
so the size came down to 29 — and at 29 pt it sets that same worst case *wider*
than Indie Flower did at 38. The title fills the corner exactly as before.
§ The size the face measured to has the numbers.

## What was being decided, and what it was not

The captain disliked the title's face and chose a new one **by looking at it**.
The reference is **More Sugar** — chunky, soft, rounded, slightly handmade.

Two things are commonly got wrong about today's cover and are worth stating
once:

- **The title has never been set in `typewriter`.** The verses on the eleven
  interior pages are the typewriter face; the cover was Indie Flower until
  19 November and is Baloo 2 now. Read it off `cover.layers` rather than from
  memory — and read it off `cover.layers` in code too: `test/book-text.test.ts`
  asks the cover which face it is rather than naming one, which is why the
  switch cost that file one line.
- **The *cover* is one thing and the *book* is another.** Changing the cover's
  face leaves eleven verses in Special Elite. That is a choice about a book,
  not about a title, and it is not what this is asking. It is asked and
  measured separately in `docs/verse-face.md`, which is open.

## More Sugar may not be used, and the clause that says so is not the obvious one

Creative Fabrica's subscription licence (v1.6) rules it out three times over,
and each clause lands exactly on a thing this repository already does:

| Clause | What it prohibits | Where this shop does it |
|---|---|---|
| Prohibited (a) | embedding fonts into websites, webfont usage | `public/fonts/` is served to the browser by `@font-face` — `lib/render/fonts.ts` § `fontFaceCss` |
| Prohibited (d) | installing assets on a server for automated processes | `lib/render/raster.ts` opens the TTFs on a server and sets a title per order, unattended |
| Grant | one user, three devices | a production function is neither |

Creative Fabrica points all three at their Enterprise licence and prices a
breach at $250 per product. So **every candidate is OFL-1.1 or Apache-2.0**,
each of which permits webfont, server and commercial use with no qualification,
and each one's licence text ships beside its file as the OFL requires.

More Sugar is still *shown*: with `MORE_SUGAR_OTF` pointing at the licence
holder's own copy, `npm run cover-faces` draws one reference tile per sheet. It
is not vendored, not in `FACES`, and the print path has no route to it — the
tile is drawn by the contact sheet's own rasteriser, which is a different
rasteriser from the one that makes a print file.

**And the licence is not even the only thing wrong with it.** More Sugar has
158 codepoints and **no curly apostrophe** — no U+2019, no U+2018, no en dash —
measured off the captain's own file with `lib/render/cmap.ts`. A phone keyboard
substitutes a curly apostrophe for a straight one as you type, so a buyer
typing *O'Brien* on an iPhone sends U+2019, and the reference tile in
`sheet-<look>-apostrophe.png` is a picture of what that prints: **O  Brien**,
with a hole where the apostrophe should be, on the front of the book. Every
one of the nine candidates carries it. This is not an argument for a
replacement being a compromise — on the one thing the brief asked to check,
every replacement is better than the reference.

## The pictures

    npm run cover-faces

writes to `.artwork/cover-faces/` — **gitignored, and deliberately**: these are
pictures of a family's artwork and this repository is public. Every picture is
the real cover page, with the captain's own delivered wrap under it, the real
title string on it, at the captain's own declared size, drawn by the one
renderer. Not specimens. The sheets are labelled and carry today's face
outlined.

### It wrote nothing until 19 November, and the number said why

Against a store where every look had a delivered cover the command produced an
empty `full/`, an empty `look/` and no sheets at all, reporting
`336 problem(s): art.wrongSize` — the code three hundred and thirty-six times
and not one look, page or size named. **336 is fourteen looks by twenty-four
interior pages.**

The sheets are drawn small, and `lib/book/title-fit.ts` § `atRenderWidth` makes
that affordable by rewriting `page.print.pixels` — which is *the book's declared
print size*, the number `docs/look-upload-contract.md` § 2 holds the captain's
artwork to. Asking `renderBookPagePng` for a 560 px picture therefore asked the
print gate to hold 3600 px artwork to a 560 px declaration, and a book that
validates perfectly at its own size became three hundred and thirty-six
refusals.

**Nothing declared was wrong and nothing declared moved.** The book declares
3600 × 3600, `npm run artwork:upload` checks the same number, and the captain's
pages are 3600 × 3600. The 560 was a measuring device leaking into a product
declaration, and `lib/book/title-fit.ts` § `coverPngAt` now separates the two:
the gate is run against the book as handed in, the width is applied after it.

Two things about the shape of this, because both will recur. The **cover** page
is measured against the printed front panel as a *floor* rather than an
equality, so it was immune — which is exactly why a store holding covers and no
interior pages passed, and why a worker who cannot reach the artwork store will
never see this. And the refusal now names the look, the page and both sizes, and
says plainly that nothing was written: `test/cover-faces.test.ts` is a
fourteen-look fixture for both halves.

## Two measurements, because there are two questions

`lib/book/title-fit.ts` renders the cover twice — once with the title, once
with the slot taken out — and reads the ink's bounding box out of the
difference, which is `test/book-verses.test.ts`'s method and for the same
reason: **the renderer is not allowed to measure, so counts are the proxy
everywhere, and a proxy has to be checked against the thing it stands for.**

Two columns, because "does it fit" has two honest answers:

- **A real name of fourteen characters** — *Charlotte-Rose* — which is what the
  captain will actually see.
- **The guarantee** — fourteen `M`s, the widest fourteen characters the form
  will accept, which is `validateBook`'s own worst case.

And two bounds, because overflowing is not one failure: the title's **frame**
is 324 pt and the page's **safe area** — the outer bound now that there is no
panel — runs x 36 → 576. Past the frame is a design decision to take
knowingly. Past the safe area is a child's name running at the cut line, which
is a defect.

A line set wider than the page cannot be measured past the page's own edge, so
a `≥` in the table below is a floor and not a figure — `TitleFit.clipped`. The
size a face would need is unaffected: it is re-measured at that size, where
there is nothing to clip.

### The size the face measured to

The lineup was first measured on 18 November at 44 pt in the 402 pt panel
frame, and again on 19 November at 38 pt in the 324 pt corner. **The choice of
Baloo 2 moved the size a third time**, and the table below is the lineup as it
stands now: every face compared in the box the cover actually has, at the
**29 pt the committed face measured to**.

Read that order of operations carefully, because it is the whole of why the
numbers look different from yesterday's: the box is the captain's and does not
move, the *size* is a property of the face in it, and the size is now Baloo 2's.
Most of the lineup fits at 29 pt — they would, it is sized for the widest of
them.

| Face | Licence | *Charlotte-Rose* (pt) | Fourteen `M`s (pt) | At 29 pt | Narrows the names the shop accepts |
|---|---|---|---|---|---|
| **Baloo 2 — today** | OFL-1.1 | 198 | **321** | **fits**, no character spare | — |
| Indie Flower — until 19 Nov | OFL-1.1 | 175 | 243 | fits, 2 characters spare | — |
| Special Elite — the verses' face | Apache-2.0 | 226 | 281 | fits, 2 characters spare | — |
| Grandstander | OFL-1.1 | 207 | 295 | fits, 1 character spare | — |
| Gochi Hand | OFL-1.1 | 183 | 282 | fits, 2 characters spare | Polish, Turkish |
| Bubblegum Sans | OFL-1.1 | 168 | 287 | fits, 1 character spare | Polish, Czech, Turkish |
| Chewy | Apache-2.0 | 173 | 300 | fits, 1 character spare | Polish, Czech, Turkish |
| Fredoka | OFL-1.1 | 197 | 328 | 1 pt outside the safe area · 28 pt to fit | Polish, Czech, Turkish |
| Bree Serif | OFL-1.1 | 192 | 338 | 6 pt outside the safe area · 27 pt to fit | — |
| Comfortaa | OFL-1.1 | 225 | 393 | 33 pt outside the safe area · 23 pt to fit | — |
| Sniglet | OFL-1.1 | 247 | ≥ 399 | at least 36 pt outside the safe area · 23 pt to fit | Polish, Czech, Turkish |

Every width is the ink's own bounding box in points, read out of a difference
between two renders. *Vietnamese* is refused in every row including the
committed one, because the eleven verses are Special Elite and always have
been. Re-measure with `npm run cover-faces -- --table`, which writes the same
table into the output directory and costs no pictures.

### 29 pt, and why it is not a smaller title

Baloo 2 at the 38 pt the corner was set at puts the guarantee — fourteen `M`s —
at **409 pt**, which is 85 pt past the 324 pt box, 36 pt past the safe area and
far enough past the page that the measurement itself is clipped. Three ways out
were weighed and they are the same three the corner weighed:

| Option | Verdict |
|---|---|
| **More lines** | Still worth nothing. The widest line is always the name, a name cannot be broken, and splitting *"Turned One"* moves no constraint. |
| **A wider box** | **Buys one point.** The corridor the corner has is 343 pt (x 233 → 576, § The corner carries the title), and 343 pt holds 30 pt of Baloo 2 and not 31 — its guarantee is 343.2 pt. One point of type would spend the whole 20 pt of clearance the ink keeps from the child's head. |
| **A smaller size** | 29 pt, where the guarantee sets at **321.0 pt** inside 324, stops 2.4 pt inside the safe area and 19.6 pt clear of the sky boundary. |

**And 29 pt is not a smaller title.** At 29 pt Baloo 2 sets the worst case
2.4 pt *wider* than Indie Flower did at 38 — 321.0 against 318.6 — so the
title fills the same corner to within two and a half points. A point of this
face simply buys more width than a point of a handwritten one; the number went
down and the words did not get smaller. The block of three lines is a quarter
shorter (88 pt of ink against 118) because the leading follows the size, and
that is the only visible change in the title's footprint.

`nameMaxChars` was not touched. Fourteen is a product fact — the length a buyer
may type is not a consequence of a layout edit — and `lib/book/name.ts`
§ `nameLimit` still answers fourteen. What absorbed the face change is the type
size, which is what it is for.

**The vertical was re-derived rather than kept.** `lineHeight` is 34, the point
nearest the 52 : 44 the panel was set with; `baseline` is 73, which is the value
whose three lines put the ink at y 114.6 → 202.6 — centre 158.6 against the
band's own 159. Both were chosen by re-rendering, not by proportion.

### What it still costs, and what it does not

**The width's headroom is zero and that is unchanged.** At 29 pt the guarantee
fits with **no character spare**: a fifteenth `M` would leave the box, exactly
as it would have at 38 pt in Indie Flower. So `maxCharsPerLine: 16` is still the
only margin there is, and raising `NAME_CHARS` past it still fails the build
with `text.storyOverflows` rather than in a printed book.
`test/cover-face.test.ts` reads that spare back out of the pixels.

**It narrows nothing about the shop.** Baloo 2 carries 856 codepoints — every
name the shop accepted on 18 November still prints, including *Żaneta*, *Řehoř*
and *Gülşen*, which five of the nine candidates would have refused. It is also
the only candidate that writes Vietnamese, though the shop still refuses it
because Special Elite does not.

**It is the name's face now**, which is a bigger change than a cover's look.
`lib/book/name.ts` § `facesTheNameIsSetIn` returns Baloo 2 and Special Elite
where it returned Indie Flower and Special Elite, and `nameSlotFont` — which is
what the confirm-the-spelling screen sets a name in — follows it, so a buyer
approves the letterforms that print.

**The type is heavier over a child's cover**, which is the one thing the
measurement cannot settle. It was raised when the panel went and it is still
the captain's eye: `npm run cover-faces` and now `npm run cover-colour` are
where that is looked at.

## The half a picture cannot show

**The face the title is set in decides which names the shop will accept.**
`lib/book/name.ts` § `facesTheNameIsSetIn` asks every face the name lands in —
which, since the two lone `babyName` slots went on 12 November, is the cover's
title and the verses — and `checkName` refuses a character *any* of them cannot
write. So a candidate with a narrower `cmap` than Indie Flower's is a candidate
that **turns buyers away**, and that is not visible in a picture of the word
"Matilda".

Five of the nine narrowed it, and **the chosen one is not among them**.
*Żaneta*, *Řehoř* and *Gülşen* are names this shop accepts and would have
refused with Chewy, Fredoka, Sniglet, Bubblegum Sans or Gochi Hand on the
cover; Baloo 2 writes all three. Vietnamese is refused in every row, the
committed one included, because Special Elite has never carried it and the
verses are set in Special Elite.

The **curly apostrophe** — which More Sugar itself has not got — is carried by
every face in the lineup, measured rather than assumed. *O’Brien* sets
correctly in all eleven, and `sheet-<look>-apostrophe.png` is the picture of it,
with the reference tile beside them showing the gap.

**The look under the cover is now the ground under the type, and that is new.**
Until 19 November the title sat on an opaque cream panel, so a face legible on
one cover was legible on all fourteen and the "pale teal versus dark" question
never reached the letters. The panel is gone — § The corner carries the title —
and the type is set on the illustration itself, which means **a face is only as
legible as the corner it lands in**. The three sheets are rendered over
`girl-01` (palest), `girl-07` (most saturated) and `boy-04` (between) for that
reason rather than for the panel's surround, and eleven looks have no cover to
render at all.

## What was recommended, and what was chosen

**Baloo 2 was the recommendation and Baloo 2 is what the captain chose.** The
argument for it was never only that it is closest to More Sugar's register —
the same generous weight, the same round terminals, the same high x-height —
but that it is the one candidate that **costs nothing elsewhere**. Chewy is
closer still in character and would have refused *Żaneta*, *Řehoř* and
*Gülşen*; a face that turns buyers away is a product decision wearing a
typographic hat.

Grandstander was the one to look at second, and remains the thing to try if
29 pt ever reads too heavy on a cover: it is the lightest of the rounded
candidates that still holds the guarantee, at 295 pt against Baloo 2's 321, so
it would fit the same box at a larger size.

Comfortaa was in the lineup to mark where the register ends, not to win.

**The caveat the corner added is still live.** The recommendation was first
written when the title sat on cream; it is now set on illustration, and a
heavier face is a more *opaque* face over a child's cover. That is for the eye
and not for a table — `npm run cover-faces` is where it gets judged, and
`docs/cover-colour.md` is the measurement of the other half of it.

## The corner carries the title

**Decided 19 November, on the captain's mark.** They drew a red rectangle in
the upper right of the girl-01 cover and asked for three things: the cream
panel gone, the title in that corner, and the ink changed if it needed
changing. `templates/first-book.ts` § `TITLE_CORNER` is the implementation and
carries every number; this is what was weighed.

**The mark, measured off their file.** Outer edge **x 278 → 549, y 61 → 257**
on the 612 pt page; centre **x 413**; **271 pt** across where the frame it left
was 402.

**It could not simply move.** Fourteen `M`s — the widest name `nameMaxChars`
admits — set at **369 pt** at 44 pt. Three ways out, and the measurement left
one standing:

| Option | Verdict |
|---|---|
| **More lines** | Worth nothing. The widest line is always the name, a name cannot be broken, and *"Turned One"* sets at 208 pt. A fourth line moves no constraint. |
| **A wider box** | Not far enough. Column by column across the marked band, every delivered cover clears 4.5:1 against `INK` only from **x 233** rightwards — left of that is the child's head — and `canvas.safe` closes the other side at 576. The widest corridor the corner has is **343 pt**, and 44 pt needs 369. |
| **A smaller size** | The only one left. **38 pt**, where the guarantee sets at 318.6 pt. |

**The box is the band's centre rather than the drawn width.** 324 pt centred on
the captain's own x 413 runs 251 → 575, a point inside the safe area, and its
ink stops 20 pt clear of the sky boundary at 233. Every realistic
fourteen-character name is far narrower than the guarantee — *Wilhelmina-May*
237 pt, *Mohammed-Amir* 261 pt — and so sets **inside the rectangle the captain
drew**. Only a name of fourteen `M`s reaches past it, onto sky that has been
measured. 40 pt was tried and refused by the build, not by taste: it needs
335 pt, which ends at 581 and returns `slot.outsideSafeArea`.

**The ink did not need changing.** Over every pixel of type on every delivered
cover, `#3B2A20` against what is actually behind it was **7.09:1 at its very
worst** (boy-04, fourteen `M`s) in Indie Flower at 38 pt, and 0.00% of ink fell
below 4.5:1. In Baloo 2 at 29 pt the same measurement is **7.09:1** on boy-04
and **6.46:1** on the drawn placeholder cover — the figure moves because the
glyphs are in different places, not because anything got worse. WCAG asks 3:1
of type this size. `docs/cover-colour.md` is where the alternatives the captain
asked to see are measured, and `npm run cover-colour` is the command.

### What the panel was doing, and what does not replace it

The panel guaranteed a known ground under the words. **Nothing replaces that
guarantee.** The title is set on illustration and the only thing standing
behind it is that the captain's cover compositions put open sky in this corner.

Re-measured in Baloo 2 at 29 pt by `npm run cover-colour`, with fourteen `M`s
in the title:

| Look | Cover artwork | The marked corner | Worst contrast under the type |
|---|---|---|---|
| girl-01 | delivered | open teal sky, bokeh and confetti only | 7.60:1 |
| girl-07 | delivered | open teal sky | 7.37:1 |
| boy-04 | delivered | open teal sky | 7.09:1 |
| girl-02 … girl-06, boy-01 … boy-03, boy-05 … boy-07 (11) | **none** | the drawn placeholder's flat ground | 6.46:1 — **and this is a measurement of the placeholder, not of a cover the captain has drawn** |

The last row is the one to read carefully. Those eleven looks *do* render a
cover — `templates/first-book.ts` draws one on the book's declared
`coverColour` — and it is measured, so the table has no blank in it. But a flat
pale ground is the easiest thing type ever sits on, so **a pass there says
nothing about the wrap that will replace it**. The corner of eleven covers is
still unmeasured in the only sense that matters.

All three delivered covers are the same composition — child left, cake lower
right, sky upper right — which is the reason the corner is clear and the reason
to expect the remaining eleven to follow it. It is a reason and not a check.
**The check is a human looking at `npm run cover-faces` as each cover lands**,
and the thing to look for is anything in the upper right: bunting, a window, a
cake, a second child. A cover that breaks the pattern needs its own answer —
per-look ink, or a soft halo — and both are design changes the captain should
get to refuse rather than inherit.

`lib/book/name.ts` and `validateBook` are no help here and were never going to
be: this is a fact about pixels a human supplied, and the repository's own
position on measuring artwork it cannot judge is in `lib/book/cover-upload.ts`.

## Switching — what it took, and what is still owed

**Done on 19 November.** One word in `templates/first-book.ts` § `cover` (the
title layer's `font`), the three numbers in § `TITLE_CORNER` that are a function
of the face, `baloo`'s `candidate` note off in `lib/render/fonts.ts`, and
`rev` restamped. One test changed: `test/book-text.test.ts` named `hand` where
it should have asked the cover, and now asks.

**Still owed: the eight losers come out.** `FACES`, `FACE_COVERAGE` and
`public/fonts/` each hold them, and nine faces in the rasteriser's font list is
nine TTFs parsed per page render. They are deliberately still here for now so
that `npm run cover-faces` draws the sheet the decision was made from with the
winner in its place — but the lineup is not meant to outlive the decision, and
`Face.candidate` is what makes the removal one edit per entry with nothing to
work out.
