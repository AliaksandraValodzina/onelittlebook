# The cover title's colour

**Status: open. The captain chooses.** The title is still one colour —
`templates/first-book.ts` § `INK`, `#3B2A20`, the same ink every verse in the
book is set in — and nothing in this document changes a pixel of it. What
landed on 19 November is the *ability* to choose: `TextSlotLayer.palette` can
set a title a letter at a time, `lib/book/title-colour.ts` can measure any
colour against the artwork actually under it, and `npm run cover-colour` draws
the options on the real covers.

Declaring any of it is one line. The rest of this file is what that line would
cost.

    npm run cover-colour              # sheets, the table, full-size renders
    npm run cover-colour -- --table   # the table only, no pictures

writes to `.artwork/cover-colour/` — **gitignored, and deliberately**: these are
pictures of a family's artwork and this repository is public.

## Why a colour is not a colour

Until 19 November the title sat on an opaque cream panel. The panel went with
the move to the captain's corner — `docs/cover-face.md` § The corner carries
the title — so the type is now set **straight onto the illustration**, and a
colour is only ever a colour *and a cover*. A pastel yellow that is lovely on
cream is invisible on teal. There are fourteen looks and a buyer picks one, so
the only question worth asking is "on every cover", and **a colour that fails on
one cover fails**: a palette that works on twelve prints twelve good books and
two bad ones.

## How it is measured

`lib/book/title-colour.ts`, and it is `test/book-verses.test.ts`'s method
again: **render twice and read the difference.**

Each cover is rendered once with the title taken away, and once with every
letter set in its own *probe* colour — colours chosen to be told apart, never to
be looked at. Out of the pair comes an **ink map**: for every letter of the
title, the list of artwork pixels that letter's ink stands on. Every candidate
colour and every palette is then measured against that same map with no further
rendering, which is both what makes fourteen covers affordable and what makes
the comparison honest — every colour is judged against *exactly the same
pixels*, so a difference between two colours is a difference between the
colours.

Three details that are decisions rather than mechanics:

- **The ink is the solid pixels**, the ones the rasteriser filled with the
  letter's own colour. The antialiased rim is a blend of the ink and the artwork
  and belongs to neither.
- **The footprint comes from the probe render, not from a difference against
  the proposed colour.** A difference-based mask would silently drop any pixel
  where the ink happened to match the artwork underneath — which is a pixel at
  **1.0:1**, the worst case there is, excluded for being invisible.
- **The measurement is taken with fourteen `M`s** — the longest name the form
  accepts, and the title that covers the most of the corner. The pictures are
  drawn with a real name, because that is what a person looks at.

The bar is WCAG 2.1's **3:1 for large text**, which 29 pt of an ExtraBold face
is by any reading; **4.5:1** is body text and is reported beside it.

## The three delivered covers and the eleven drawn ones

Three looks have a delivered cover wrap. The other eleven still render — the
placeholder cover on the book's declared `coverColour` — and they are measured
and labelled `drawn`, so the table has fourteen rows and no blanks. **They are
not a stand-in for the captain's missing wraps.** A flat pale ground is the
easiest thing type ever sits on; a colour that passes there has been told
nothing about a cover with a cake in the corner. Run the command wherever the
looks bucket is configured to get all fourteen for real.

One finding that holds across every cover measured so far, and is worth stating
because it will stop being true: **the corner is pale on all of them**, so
contrast is a monotone function of how dark the ink is. There is no cover here
where a light title wins. The day a cover arrives with bunting or a window in
the upper right, that stops holding — and a *mid*-tone colour is the one that
suffers most, because it has no headroom in either direction.

## One colour

Measured 19 November in Baloo 2 at 29 pt, with fourteen `M`s in the title.

| Colour | Hex | Worst on any cover | Worst on a delivered cover | Verdict |
|---|---|---|---|---|
| **Ink — today** | `#3B2A20` | 6.46 | 7.09 | passes on all 14 |
| Espresso | `#241812` | 8.18 | 8.98 | passes on all 14 |
| Deep teal | `#1E4C58` | 4.45 | 4.89 | passes on all 14 |
| Berry | `#8E3A4C` | 3.47 | 3.81 | passes on all 14, under 4.5:1 on every one |
| Cream | `#FBF6EC` | 1.25 | 1.25 | **fails on all 14** |

- **Ink** is the book's own, and the only option that is not a second thing to
  keep true. Everything else here is being compared with it.
- **Espresso** is the deep end — the same ink taken almost to black. It is the
  safest thing that could be printed on a cover nobody has measured yet, and at
  29 pt of a heavy face it does not read as harsh.
- **Deep teal** is the cool scene wash at ink weight, and it is the hue the
  delivered covers actually put in this corner. A title in the same family as
  the sky behind it reads as part of the picture rather than as type laid over
  it. It is the one alternative worth looking at seriously.
- **Berry** is the cover's own declared colour — the blush of `coverColour` —
  taken down far enough to read. It clears the large-text bar everywhere and
  clears the body-text bar nowhere, which is a real state and not a pass.
- **Cream** is the light end, and it is on the list to be **refused in public**
  rather than quietly left off. The captain asked to see the range; this is
  where it ends. Every pixel of it is under the bar on every cover.

## A colour per letter

The captain's reference is a party invitation whose headline sets each letter in
a different pastel. `TextSlotLayer.palette` is that as data and
`lib/render/palette.ts` is the rule — **one module, imported by both the
renderer and the measurement**, so a measurement of a different assignment from
the one that prints cannot exist.

### The rule, and the three things that had to be decided

**It is positional.** The title is *"When {name} Turned One"*. Nothing a
template can write knows how long the name will be or what is in it, so there
is no per-word scheme and no hand-assigned one. The only thing knowable about a
letter at publish time is where it stands.

**The cycle restarts on each line.** Both readings work and they read
differently:

| | What happens |
|---|---|
| Run straight through | *"When"* always takes colours 0–3 and the name starts at 4 — but *"Turned One"* then starts at `4 + name.length`, so **the captain's own two lines change colour with the length of the child's name**. Two orders a letter apart print a differently coloured *"Turned One"*, for a reason no reader could perceive as intentional. |
| **Restart per line** | *"When"* and *"Turned One"* print identically on every copy of the book, and **the only line that varies is the name** — the line that is supposed to be the buyer's. The name beginning on the palette's first colour every time is what makes it read as deliberate rather than as wherever the count happened to land. |

**Whitespace takes no colour and does not advance it.** A space puts no ink on
the page, so a step spent on one is a step nobody can see — and it is worse than
invisible, because it decides the colour of every letter after it. With six
colours, *"Turned One"* sets `T u r n e d` 0–5 and then `O n e` 0–2; let the
space take a step and the second word slides by one for no visible cause.
**Visible punctuation does take a step**: the hyphen in *Charlotte-Rose* is a
drawn mark that has to be given some colour, and the next one in the cycle is
the only answer that is not a special case.

`test/title-palette.test.ts` holds all three, each with the control that makes
it an assertion.

### The palettes, measured per letter on every cover

| Palette | Colours | Worst letter, any cover | Verdict |
|---|---|---|---|
| The party pastels | `#F2A8C0` `#F6D06A` `#8FD3C7` `#A9B8E8` `#F3A26D` `#C3A9DD` | 1.00 | **fails on all 14 — every letter of every one** |
| The same pastels, as deep as the artwork allows | `#92163E` `#604806` `#21544B` `#2A459D` `#7B370A` `#61378B` | 4.09 | passes on all 14 |
| The book's colours at ink weight | `#7E3344` `#674010` `#2A5228` `#1A4350` `#413669` `#3B2A20` | 4.28 | passes on all 14 |
| Pulled from each cover | derived, six per cover | 3.02 | passes on all 14, by construction |

**The party pastels fail completely, and that is the finding rather than a
disappointment.** Not "fail on two covers" and not "fail on the light letters":
**every letter of every cover**, worst 1.00:1 — a letter the same luminance as
what is behind it. A pastel is light by definition and every corner these covers
put behind the title is pale. The sheets are the picture of it and they are
worth looking at before reading any further: the words are simply not there.

**The same pastels taken down in lightness do work**, and this is the
interesting answer. Each of the captain's six hues is kept exactly; only its
lightness is walked down, each to the palest value that clears 4:1 on every
cover measured — a third of margin over the bar rather than sitting on it.
`lib/book/title-colour.ts` § `lightestThatPasses` is the derivation and
`npm run cover-colour` prints it again on every run, so a declared value that
has gone stale as covers land is visible rather than assumed. The honest thing
to look at is the **yellow**: at the lightness the artwork allows, `#F6D06A`
becomes `#604806`, which is olive. A pastel yellow is the one colour on the
reference that cannot survive being printed on a photograph at any lightness
that can be read.

**The book's own colours at ink weight** are the alternative that does not start
from the reference: the cover's blush, the cool and warm and green scene washes,
a plum, and the book's own ink as the sixth so the set is anchored to something
the rest of the book is already set in. Every colour clears 4:1 on every cover.

**Pulled from each cover** is the prettier idea and the expensive one. Six hues
are taken out of that cover's own pixels and darkened until they clear the bar
*on that cover*, so it passes by construction — and it is a different palette on
every cover. On girl-01 it comes back `#267360 #C2380A #7E6007 #2D763F #CB0B3B
#5E6F2A`; on girl-07, `#086F91 #B8350A #7E6007 #14715A #CB0B3B #2D763F`. Nobody
has looked at thirteen of those, and the fourteenth cover to land will bring a
fifteenth palette with it.

## The recommendation

**Keep the title one colour, and keep it `#3B2A20`.**

The reason is not that multicolour looks wrong — the sheets say it does not —
but that **the ink has to survive a corner nobody has measured**. Eleven of the
fourteen covers do not exist yet, and the one thing known about every one of
them is that the captain will compose it by hand. A single dark ink is the
colour with the most room in it: at 6.46:1 against the palest ground in the set
it can lose more than half its contrast and still clear the bar. A mid-tone
letter at 4.1:1 cannot lose a third.

Everything else follows from that:

1. **If the captain wants a different single colour, Espresso (`#241812`).** It
   is strictly safer than today's ink — 8.18:1 at worst — and visibly the same
   decision, which is the point: a cover title is not where this shop spends a
   risk.
2. **If the captain wants the title to belong to the picture, Deep teal
   (`#1E4C58`).** It is the hue the delivered covers already put in that corner,
   it clears body text on every cover, and it is one colour rather than six.
3. **If the captain wants the party invitation, "the same pastels, as deep as
   the artwork allows".** It is their own six hues, it clears the bar with
   margin on every cover there is, and it is **one fixed set** — one thing to
   keep true, checked by one command. The sheet for girl-01 is the one to look
   at.
4. **Not "pulled from each cover".** It is the prettiest in principle and it is
   fourteen palettes nobody has reviewed, re-derived every time artwork lands,
   on the one surface of the product where a mistake is printed on the front of
   a book. It is in the lineup so the captain can see what it buys and what it
   costs, not because it should be chosen.

**Whatever is chosen, the check does not go away.** Any colour but a dark one
makes `npm run cover-colour` a thing to run as **each cover lands**, exactly as
`docs/cover-face.md` says a human must look at the corner as each cover lands.
That is a standing cost, and it is the real price of six colours rather than
one.

## Declaring one

For a single colour: the `colour` on `templates/first-book.ts` § `cover`'s title
layer, and `npm run print` to restamp `rev`.

For a palette: add `palette: [...]` to the same layer. `lib/template/validate.ts`
refuses an empty one and refuses an entry that is not `#rgb`, `#rrggbb` or
`#rrggbbaa`. The five-to-seven limit the captain set is a product decision and
lives where the proposals do — `lib/book/title-colour.ts` § `TITLE_PALETTES`,
asserted by `test/title-palette.test.ts` — because the format takes any number
and should not pretend to have an opinion.

Then run `npm run cover-colour` once more and look at the sheets, because none
of the above is a substitute for that.
