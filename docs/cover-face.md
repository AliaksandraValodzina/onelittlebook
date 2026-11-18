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
title string on it, at the declared 44 pt, drawn by the one renderer. Not
specimens. The sheets are labelled and carry today's face outlined.

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
is 402 pt and the cream **panel** it is printed on is 442 pt. Past the frame is
a design decision to take knowingly. Past the panel is a child's name set on
photography, which is a defect.

### The result, measured 18 November

| Face | Licence | *Charlotte-Rose* at 44 pt | Fourteen `M`s at 44 pt | Narrows the names the shop accepts |
|---|---|---|---|---|
| **Indie Flower — today** | OFL-1.1 | fits, 2 spare | **fits**, 1 spare | — |
| Special Elite — the verses' face | Apache-2.0 | fits, 1 spare | 24 pt past the frame, on the panel | — |
| Baloo 2 | OFL-1.1 | fits, 2 spare | 45 pt off the panel · 36 pt to fit | — |
| Grandstander | OFL-1.1 | fits, 2 spare | 5 pt off the panel · 39 pt to fit | — |
| Bree Serif | OFL-1.1 | fits, 2 spare | 70 pt off the panel · 34 pt to fit | — |
| Comfortaa | OFL-1.1 | fits, 1 spare | 155 pt off the panel · 29 pt to fit | — |
| Bubblegum Sans | OFL-1.1 | fits, 2 spare | 33 pt past the frame, on the panel | Polish, Czech, Turkish |
| Chewy | Apache-2.0 | fits, 2 spare | 14 pt off the panel · 38 pt to fit | Polish, Czech, Turkish |
| Gochi Hand | OFL-1.1 | fits, 2 spare | 25 pt past the frame, on the panel | Polish, Turkish |
| Fredoka | OFL-1.1 | fits, 2 spare | 56 pt off the panel · 35 pt to fit | Polish, Czech, Turkish |
| Sniglet | OFL-1.1 | fits, no spare | 163 pt off the panel · 29 pt to fit | Polish, Czech, Turkish |

Re-measure with `npm run cover-faces -- --table`, which writes the same table
into the output directory and costs no pictures.

### What the two columns mean together

**Every face holds every realistic fourteen-character name at 44 pt.** The
widest real name measured — *Wilhelmina-May* in Grandstander — is 335 pt in a
402 pt frame. The size is not in practical danger.

**No face but Indie Flower holds the guarantee at 44 pt, and that includes
Special Elite.** The box was drawn around Indie Flower, whose capitals are
narrow for a handwritten face, and the fit has been a coincidence of that
choice rather than a property of the box since the cover was drawn. So
switching the face means deciding, explicitly, one of three things:

1. **Set the title smaller** — the size each face needs is in the table. 36 pt
   on a 44 pt cover is a visible change, not a rounding.
2. **Widen the frame and the panel.** This moves drawn content, which
   `templates/first-book.ts` § `cover` is clear is one statement with the
   artboard, and it restamps `rev`.
3. **Accept that the guarantee is a realistic one rather than an absolute one**
   — which is what the cover has in fact been doing, and is a defensible
   position now that it is written down rather than assumed.

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

**The look under the cover does not change the ground under the type.** The
title is set on an opaque cream panel — `#FBF6EC`, `cover-panel` — in every one
of the fourteen looks, so a face that is legible on one cover is legible on all
of them and the "pale teal versus dark" question does not reach the letters.
What does change is how the panel *reads* against its surround, which is why
the sheets are rendered over three looks rather than one: `girl-01` is the
palest, `girl-07` the most saturated, `boy-04` in between.

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

Grandstander is the one to look at second. It is the closest to the guarantee —
5 pt off the panel at fourteen `M`s, against Baloo 2's 45 — and reads lighter
and rounder, which is either warmer or thinner depending on the eye. The eye is
the captain's.

Comfortaa is in the lineup to mark where the register ends, not to win. It is
rounded by construction and cold with it, and a comparison with no wrong answer
in it does not show anybody where the boundary is.

## Switching

One word in `templates/first-book.ts` § `cover` — the title layer's `font` —
plus a `size` if the captain takes option 1, plus `npm run print` to restamp
`rev` and refresh `data/`. Then the losing candidates come out of `FACES` and
`FACE_COVERAGE` and their files out of `public/fonts/`, which is what
`Face.candidate` is for: nine faces in the rasteriser's font list is nine TTFs
parsed per page render, and the lineup is not meant to outlive the decision.
