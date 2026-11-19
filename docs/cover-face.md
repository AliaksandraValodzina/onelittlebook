# The cover title's face

**Status: open. The captain chooses.** The cover is still set in Indie Flower
and nothing in this document changes a pixel of it — `lib/render/fonts.ts`
vendors nine candidates and `templates/first-book.ts` § `cover` still names
`hand`. Switching is a one-word edit once the choice is made; the rest of this
file is what that edit costs.

## What is being decided, and what it is not

The captain dislikes the title's face and wants to choose a new one **by
looking at it**. The reference is **More Sugar** — chunky, soft, rounded,
slightly handmade.

Two things are commonly got wrong about today's cover and are worth stating
once:

- **The title is set in `hand` — Indie Flower — and not in `typewriter`.** The
  verses on the eleven interior pages are the typewriter face; the cover is
  not, and never has been. Read it off `cover.layers` rather than from memory.
- **The *cover* is one thing and the *book* is another.** Changing the cover's
  face leaves eleven verses in Special Elite. That is a choice about a book,
  not about a title, and it is not what this is asking.

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

### The result, re-measured 19 November in the corner's own box

The table was first measured on 18 November at 44 pt in the 402 pt panel
frame. The panel is gone and the frame is 324 pt at 38 pt — § The corner
carries the title, below — so every number here was taken again. Nothing in it
compares the faces differently; the box they are compared in got smaller.

| Face | Licence | *Charlotte-Rose* at 38 pt | Fourteen `M`s at 38 pt | Narrows the names the shop accepts |
|---|---|---|---|---|
| **Indie Flower — today** | OFL-1.1 | fits, 2 spare | **fits**, no spare | — |
| Special Elite — the verses' face | Apache-2.0 | fits, 1 spare | 21 pt outside the safe area · 33 pt to fit | — |
| Baloo 2 | OFL-1.1 | fits, 2 spare | ≥ 36 pt outside the safe area · 29 pt to fit | — |
| Grandstander | OFL-1.1 | fits, 1 spare | 30 pt outside the safe area · 31 pt to fit | — |
| Bree Serif | OFL-1.1 | fits, 2 spare | ≥ 36 pt outside the safe area · 27 pt to fit | — |
| Comfortaa | OFL-1.1 | fits, no spare | ≥ 36 pt outside the safe area · 23 pt to fit | — |
| Bubblegum Sans | OFL-1.1 | fits, 2 spare | 25 pt outside the safe area · 32 pt to fit | Polish, Czech, Turkish |
| Chewy | Apache-2.0 | fits, 2 spare | 34 pt outside the safe area · 31 pt to fit | Polish, Czech, Turkish |
| Gochi Hand | OFL-1.1 | fits, 2 spare | 22 pt outside the safe area · 33 pt to fit | Polish, Turkish |
| Fredoka | OFL-1.1 | fits, 2 spare | ≥ 36 pt outside the safe area · 28 pt to fit | Polish, Czech, Turkish |
| Sniglet | OFL-1.1 | fits, no spare | ≥ 36 pt outside the safe area · 23 pt to fit | Polish, Czech, Turkish |

Re-measure with `npm run cover-faces -- --table`, which writes the same table
into the output directory and costs no pictures.

### What the two columns mean together

**Every face still holds every realistic fourteen-character name**, and that is
the column the captain is actually looking at. The size is not in practical
danger in any row.

**No face but Indie Flower holds the guarantee, and that includes Special
Elite.** It was true at 44 pt in the panel and it is true at 38 pt in the
corner, for the same reason: the box has twice been sized to Indie Flower,
whose capitals are narrow for a handwritten face, so the fit is a property of
that choice and not of the box. Switching the face means deciding, explicitly,
one of three things:

1. **Set the title smaller still** — the size each face needs is in the table,
   and every one of them is in the twenties. On a cover already down from 44 to
   38, that is a second visible step and not a rounding.
2. **Widen the frame.** There is very little left to widen into: the corner's
   corridor is measured below and 38 pt already spends most of it. Widening
   past it moves the title back out of the corner the captain drew.
3. **Accept that the guarantee is a realistic one rather than an absolute one**
   — which is what the cover has in fact been doing, and is a defensible
   position now that it is written down rather than assumed.

**The corner has made this choice more expensive, not less.** That is the
honest summary of the re-measurement: the narrower box costs every candidate
except today's face several more points of type.

`test/cover-face.test.ts` holds the committed face to the guarantee. The day
the cover moves, that test goes red and names the overflow in points — which is
the point of it: the cost of the switch arrives at the moment the switch is
made, and not in a printed book.

## The half a picture cannot show

**The face the title is set in decides which names the shop will accept.**
`lib/book/name.ts` § `facesTheNameIsSetIn` asks every face the name lands in —
which, since the two lone `babyName` slots went on 12 November, is the cover's
title and the verses — and `checkName` refuses a character *any* of them cannot
write. So a candidate with a narrower `cmap` than Indie Flower's is a candidate
that **turns buyers away**, and that is not visible in a picture of the word
"Matilda".

Five of the nine narrow it. *Żaneta*, *Řehoř* and *Gülşen* are names this shop
accepts today and would refuse with Chewy, Fredoka, Sniglet, Bubblegum Sans or
Gochi Hand on the cover. Vietnamese is already refused in every row, today's
included, because Special Elite has never carried it and the verses are set in
Special Elite.

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

## The recommendation

**Baloo 2, at the declared 44 pt, accepting option 3 above.**

It is the closest open-licensed face to More Sugar's register that this shop can
actually use: the same generous weight, the same round terminals, the same
high x-height. Chewy is closer still in *character* — the soft tapered strokes
and the slight bounce are More Sugar's own — and if the captain chooses it by
eye that is a good reason. But Chewy costs *Żaneta*, *Řehoř* and *Gülşen*, and
a face that refuses buyers is a product decision wearing a typographic hat.
Baloo 2 costs nothing: 856 codepoints, every name the shop takes today still
printable.

Grandstander is the one to look at second. It is among the closest to the
guarantee — 31 pt to fit, against Baloo 2's 29 — and reads lighter and rounder,
which is either warmer or thinner depending on the eye. The eye is the
captain's.

**One caveat the corner adds to all of this.** The recommendation above was
written when the title sat on cream. Now that it is set on the artwork, a
heavier face is also a more *opaque* face over a child's cover — and the
sheets, not this paragraph, are where that gets judged.

Comfortaa is in the lineup to mark where the register ends, not to win. It is
rounded by construction and cold with it, and a comparison with no wrong answer
in it does not show anybody where the boundary is.

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
cover, `#3B2A20` against what is actually behind it is **7.09:1 at its very
worst** (boy-04, fourteen `M`s) and 0.00% of ink falls below 4.5:1. WCAG asks
3:1 of type this size. A second colour would have been a second thing to keep
true for no gain.

### What the panel was doing, and what does not replace it

The panel guaranteed a known ground under the words. **Nothing replaces that
guarantee.** The title is set on illustration and the only thing standing
behind it is that the captain's cover compositions put open sky in this corner.

| Look | Cover artwork | The marked corner | Worst contrast under the type |
|---|---|---|---|
| girl-01 | delivered | open teal sky, bokeh and confetti only | 7.74:1 |
| girl-07 | delivered | open teal sky | 7.43:1 |
| boy-04 | delivered | open teal sky | 7.09:1 |
| girl-02 … girl-06, boy-01 … boy-03, boy-05 … boy-07 (11) | **none** | **unmeasured** | **unmeasured** |

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

## Switching

One word in `templates/first-book.ts` § `cover` — the title layer's `font` —
plus a `size` if the captain takes option 1, plus `npm run print` to restamp
`rev` and refresh `data/`. Then the losing candidates come out of `FACES` and
`FACE_COVERAGE` and their files out of `public/fonts/`, which is what
`Face.candidate` is for: nine faces in the rasteriser's font list is nine TTFs
parsed per page render, and the lineup is not meant to outlive the decision.
