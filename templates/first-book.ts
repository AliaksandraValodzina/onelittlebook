/**
 * **"When They Were Small" — the first personalised baby book, as data.**
 *
 * **Twenty-four interior pages and a cover**, which is twelve spreads. That
 * number is the captain's, settled on 6 November and overriding the brief's
 * "40–50": twelve spreads at 2.000:1 is exactly what the artwork is, and it
 * lands exactly on **Printify's hardcover photo book, 24 pages fixed**, which
 * takes one raster per page — the only file this renderer makes. 40–50 pages
 * exists only at Lulu and Prodigi, and both want a PDF with a structure this
 * codebase does not write.
 *
 * The count is **`pages.length` and nothing else**. There is no constant to
 * keep in step and no component that counts to twenty-four.
 *
 * ## The three kinds of text, which is the thing to understand first
 *
 * | Kind | Who writes it | Where it lives |
 * |---|---|---|
 * | **Story** | the captain, once per spread | `BookPage.story`, below |
 * | **The title** | the captain, once | `cover.story`, below |
 * | **The name** | the buyer, per order | `BookFill.name` |
 * | **The dedication** | the buyer, per order, **pre-filled** | `BookFill.dedication` |
 * | **The from-line** | the buyer, per order, optional | `BookFill.from` |
 *
 * All of them are **drawn by the renderer and never painted into artwork**,
 * which is what makes a typo one edit instead of twenty-four re-generations and
 * keeps a second language possible. The captain's own generation brief says
 * *"the verse, name and photo go on in Canva afterwards"*; that is right for
 * mocking up a spread and wrong for production, because a name baked into a
 * picture cannot change for the next buyer — so no path here burns text into an
 * image, and `docs/look-upload-contract.md` § 3 says the same thing to whoever
 * draws the artwork.
 *
 * The story may contain `{name}`, and `lib/book/validate.ts` therefore checks
 * every story line fits **with the longest name the form will accept** — not
 * merely with an empty one.
 *
 * ## Why this file is TypeScript and why it has a `.map` in it
 *
 * `my-forever.ts` is literal because a page is nine layers. A book is
 * twenty-five pages of which most carry one slot and differ only in which wash
 * is behind them. So the scenes are declared once in `SCENES`, the story copy
 * in `STORY`, the slot-bearing pages in `FEATURED`, and the rest is expanded
 * from the three.
 *
 * It is still data in every sense that matters: no behaviour, the compiler
 * checks the result against `BookTemplate`, `npm run book` writes the **fully
 * expanded JSON** beside the print files so a reviewer reads the real object,
 * and `rev` is eight hex of that object's own content hash. Edit anything below
 * and `npm run book` refuses until `rev` is restamped; it prints the value.
 *
 * ## The page size, which is the open question
 *
 * **3600 × 3600 px on a 612 pt artboard** — an 8.00 in trim with a quarter inch
 * of bleed on every edge, so the file runs at 450 DPI across the trim and
 * 423.5 across the artboard. Declared here, once, in two numbers.
 *
 * The **trim** is settled: the captain's specification names Printify's
 * Softcover Photo Book (8 × 8 in, its only size) and Hardcover Photo Book
 * (8 × 8 in, one of four), and one artwork set serves both. What is **not**
 * settled is Printify's stated print-area pixel size for that product, which
 * is published only inside their signed-in Product Creator. 3600 is generated
 * deliberately above every candidate: 8 in at 300 DPI is 2400 px, so 3600
 * downscales to it with room, and downscaling is free where upscaling is the
 * expensive mistake.
 *
 * `docs/print.md` § The square trim nobody has pinned down carries the
 * evidence, including what is odd about the 3150 this repository's other
 * template uses. **Nothing here resolves it** — both numbers are fields on one
 * object, so the answer is a data edit and a restamp.
 *
 * ## What is a placeholder, and what is not
 *
 * Every page's artwork is `{ kind: "drawn" }` — a scene drawn from the numbers
 * below, with the chosen look's baby in it — and it is a **stand-in and says
 * so.** The production state of the artwork is `{ kind: "asset" }`: the
 * captain's finished page images by content hash, written here by
 * `npm run looks:import` from a folder that satisfies
 * `docs/look-upload-contract.md`.
 *
 * **The copy is no longer a stand-in.** The twelve verses, the title and the
 * dedication's starting text are the captain's own, delivered 12 November and
 * taken in verbatim. The type sizes and the boxes under `storySlot` and the
 * dedication slot moved with them, because the real copy is six lines where the
 * stub was two — that arithmetic is written out where it was done.
 *
 * Everything else — the page order, the slots, the limits, the gender question,
 * the looks axis — is final and does not change when the artwork lands.
 */

import type { Colour, Layer } from "../lib/template/types";
import type { BookPage, BookTemplate, Look, SceneSpec } from "../lib/book/types";
import { SLOT } from "../lib/book/slots";

// ---------------------------------------------------------------------------
// The artboard
// ---------------------------------------------------------------------------

/**
 * 612 pt = 8.5 in: **the 8 × 8 in trim plus a quarter inch of bleed on every
 * edge.**
 *
 * `BLEED` below takes that quarter inch off each side, so the trim is
 * 576 pt — **8.00 inches exactly**, which is the size of both Printify photo
 * books this book is for. The artboard is the page *including* bleed because
 * that is what `docs/print.md` establishes Printify's stated print area to be.
 *
 * With `print.pixels` at 3600 this file is **423.5 DPI across the artboard and
 * 450 DPI across the trim** — far above the 300 a printer asks for, which is
 * deliberate: the captain generates masters once, and downscaling is free where
 * upscaling is the expensive mistake. See `docs/print.md` § The square trim for
 * what is still open about the number, and note that nothing about it is
 * resolved here — both values are data on this one object.
 */
const SIDE = 612;

/** 0.25 in, declared conservatively. `canvas.bleed` below carries the argument. */
const BLEED = 18;

/**
 * The eight washes, cycled through the interior.
 *
 * Declared on the *page* and not on the look, which is the structural half of
 * `docs/look-upload-contract.md` § 4: two looks of this book cannot have
 * different kitchens, because there is one kitchen and it is written here once.
 */
const SCENES: readonly SceneSpec[] = [
  { ground: "#F3E7DA", floor: "#E3CDB8", prop: "#D9BFA6", seed: 1101 },
  { ground: "#E6F0F2", floor: "#BFD9E0", prop: "#A9C9D4", seed: 1102 },
  { ground: "#EAF1E2", floor: "#CBDCB8", prop: "#B3CE9E", seed: 1103 },
  { ground: "#F6EDDC", floor: "#E0CBA8", prop: "#CBAE87", seed: 1104 },
  { ground: "#E6E4F0", floor: "#C6C2DF", prop: "#B0AACF", seed: 1105 },
  { ground: "#EFF3E6", floor: "#CFE0C0", prop: "#F0C8A0", seed: 1106 },
  { ground: "#FBEFE6", floor: "#EED2BE", prop: "#DDB79C", seed: 1107 },
  { ground: "#FDF3E3", floor: "#F0D9B5", prop: "#E8B9A0", seed: 1108 },
];

/** The ink every word in the book is set in. Dark enough for any of the washes. */
const INK = "#3B2A20";

/**
 * The name's limit, in characters, and the number the whole name design turns
 * on.
 *
 * It used to be declared on every `babyName` slot and read back as the
 * tightest box in the book. **Both lone names went on 12 November** — page
 * one's because the dedication facing it already says the name, page
 * twenty-four's with it — so there is no box left to read it off, and it is
 * declared on the book as `nameMaxChars`. `lib/book/types.ts` carries why that
 * is a field and not a derivation.
 *
 * **Fourteen is unchanged, deliberately.** The captain's decision is that the
 * length a buyer may type is a product fact: a layout edit does not get to
 * move it, and the suite proves fourteen still fits rather than this file
 * asserting that it does — `validateBook` substitutes fourteen M's into every
 * `{name}` in the copy and refuses the build if a verse or the cover's title
 * overflows, and `test/book-text.test.ts` is where that is read back.
 */
const NAME_CHARS = 14;

// ---------------------------------------------------------------------------
// The slots
// ---------------------------------------------------------------------------

/**
 * How tall a verse's box is, and **where down each page it sits.**
 *
 * ## The band, and why the box is 160 pt
 *
 * Six lines at 26 pt is 156 pt, which is what the 160 pt box holds.
 *
 * The verse sits on the **left-hand page** of every spread — `interior` below
 * gives the slot to the first page of each — and the captain's generation
 * brief, which every one of those pages was drawn against, reserves a
 * `verse_zone` there: *"on the LEFT page keep the middle 60% soft, out of
 * focus, light in value and low in detail so dark verse text can be added
 * later"*. The middle 60% of a 612 pt page is **y 122 to 490**.
 *
 * The box used to sit at 64 — the top twelfth of the page — which is the half
 * of every spread the artwork puts its *detail* on, and the overlap was real
 * and visible: fairy lights and a window on spread two, hearts and bubbles and
 * music notes on spread three, a moonbeam on five, a bird and branch on eight,
 * a picture frame on ten with *"{name}, you are so loved"* running straight
 * through it, balloons and bunting on twelve. The renderer and the artwork had
 * simply never agreed about which band was the words'.
 *
 * It then sat at `(612 − 160) / 2` — 226, the box centred in the page — for
 * every page but one. That is the value the entries below replace.
 *
 * ## Why there is a position per page and not one for the book
 *
 * On 13 November the captain screenshotted nine of the twelve interior spreads
 * in the preview and drew a rectangle on each showing where that spread's
 * verse belongs. Measured against each spread's own page box, the rectangles
 * average **162 pt tall** against this box's 160 and matched its left and
 * right edges to within a point — so the captain was **moving** the box the
 * book already has, not resizing it. Nothing about the type, the width or the
 * frame changes here, and `VERSE_HEIGHT` is untouched.
 *
 * A **second round** of marks followed, drawn against the first round live on
 * the page: three rectangles, 161, 162 and 166 pt tall, left and right edges
 * on the frame again — the same method and the same move-not-resize rule.
 * Spread seven (`page-013`) was marked for the first time, at 203. Spread
 * eleven (`page-021`) was **re-marked at 60**, superseding the 122 of round
 * one now that the captain has seen it in place; the later mark is the
 * instruction and the two are not averaged. Spread six (`page-011`) was marked
 * again at 331, which is the third number inside half a line height of the 320
 * it already carries — so it was confirmed rather than changed.
 *
 * **No single value can satisfy them.** Spread twelve needs a top of 182 to
 * clear the bunting across the head of the page; spread eight needs 138 so the
 * last line clears the pond and the bridge. Those two rule each other out,
 * which is why the verse kept landing on artwork wherever the shared value was
 * set: the artwork is twelve different pictures and the reserved band is only
 * their average.
 *
 * `VERSE_TOP_ON` is therefore the position of each verse, page by page, in the
 * captain's own marks. The entry for `page-011` is **older than the marks and
 * kept**: it is 320, measured off that spread's artwork — its windowsill, a
 * robin and a jar and a knitted pumpkin, all high-contrast, sits *in* the
 * reserved band at roughly y 160 to 340 — and the captain's hand-drawn
 * rectangle there measured 338, within one line height (26 pt) of it. Two
 * numbers that agree to inside a line are one number, and the measured one is
 * the one with a method behind it.
 *
 * ## The one spread the captain has not marked
 *
 * Spread two (`page-003`, *"Welcome to the world"*) carries no mark, so it
 * falls through to `VERSE_TOP` — and it is **the only page that does**. That
 * default is the **median of the marks** rather than the centre of the page:
 * the captain's marks sit well above centre, so the centred 226 is no longer
 * the best guess for a page nobody has looked at. It is computed from the
 * table below and not typed, so each new mark re-derives it; today it is
 * 172.5.
 *
 * ## The two pages that reach above the brief's band
 *
 * `test/book-verses.test.ts` names them rather than widening the band.
 * `page-007` sits at 113, nine points over the line, to clear what spread four
 * draws low. `page-021` sits at 60, which is **62 pt above the `verse_zone`**
 * and the furthest outside it any page goes: on that spread the top-left is
 * open window light, so nothing collides with the words today, but the artwork
 * does **not** promise to keep that strip clear and a regeneration of spread
 * eleven could fill it. Both are comfortably inside the safe area (36–576), so
 * both print.
 *
 * `test/book-verses.test.ts` rasterises each page against **its own** box, so
 * the extremes here — 60 at the top of the page and 320 at the foot — are
 * measured and not assumed to fit.
 */
const VERSE_HEIGHT = 160;

/**
 * The captain's mark for each spread's verse, keyed by the **left** page of
 * the spread, which is `page-(2N-1)` for spread N. A page absent from this
 * table is a spread the captain has not marked, and takes `VERSE_TOP`.
 */
const VERSE_TOP_ON: Record<string, number> = {
  "page-005": 185, // spread 3 — "{name}, you smiled!"
  "page-007": 113, // spread 4 — "Go, {name}, go!"
  "page-009": 177, // spread 5 — "Night-night, {name}"
  "page-011": 320, // spread 6 — the windowsill; measured, see above
  "page-013": 203, // spread 7 — bath time
  "page-015": 138, // spread 8 — the park, clearing the pond and the bridge
  "page-017": 148, // spread 9 — "Here comes {name}!"
  "page-019": 168, // spread 10 — "{name}, you are so loved"
  "page-021": 60, // spread 11 — "Look at {name} go!"; re-marked, see above
  "page-023": 182, // spread 12 — clearing the birthday bunting
};

/** The median of the marks, for the pages that carry none. */
const VERSE_TOP = (() => {
  const marks = Object.values(VERSE_TOP_ON).sort((a, b) => a - b);
  const middle = marks.length >> 1;
  return marks.length % 2 ? marks[middle] : (marks[middle - 1] + marks[middle]) / 2;
})();

/**
 * The story slot: **one of the captain's twelve verses**, in the band the
 * artwork reserves for it.
 *
 * Every verse is the same shape — a heading, a blank line, then four rhyming
 * lines — so the slot is six lines and not "a line or two", which is what the
 * stub copy it replaced was sized for.
 *
 * **The blank line is a line.** `lib/render/svg.ts` § `drawTextSlot` sets every
 * line at an absolute baseline precisely so that an empty one cannot close up
 * between the browser and `resvg`, which is what makes the gap under the
 * heading paint rather than luck.
 *
 * ## The box, and the one slot where the proxy can be checked
 *
 * `maxCharsPerLine` is a character count here as everywhere, for the reason
 * `lib/render/svg.ts` opens with: two shapers disagree about advance widths by
 * fractions of a point, so a limit that measured would be a different limit in
 * the browser and in the print file. A count is a **proxy**, and a proxy needs
 * a box that is generous rather than exact.
 *
 * This is the one text slot where the proxy can be checked against the real
 * thing, because the copy is committed and the only part of it that varies is
 * `{name}`. Measured in Special Elite against the vendored TTF:
 *
 * | | em | at 15 pt |
 * |---|---|---|
 * | widest line of the twelve verses — spread 5's *"With your bear tucked in close and your blanket pulled tight,"* | 32.07 | 480 pt |
 * | widest line carrying the name, with the longest name the form accepts — spread 12's heading | 20.49 | 306 pt |
 * | this box | | **500 pt** |
 *
 * — 20 pt of headroom on the worst line, ten a side on a centred line.
 *
 * **The copy cannot be set at the 17 pt the stub was set at**: 32.07 em is
 * 545 pt there, which is wider than the whole safe area (540 pt), let alone a
 * box inside it. That is a measurement and not a preference, and it is why
 * this slot's type size came down with the real words.
 *
 * ## Why the box is not as wide as the safe area
 *
 * The verses sit on the **left-hand** page of each spread, whose gutter is its
 * **right** edge, and `lib/book/fold.ts` § `SPREAD_FOLD` shades a band `reach`
 * of a page wide along it in the preview — 48.96 pt here. A box that ended
 * inside that band would be claiming space the buyer sees darkened, so this
 * one ends at 556 and `test/spread-fold.test.tsx` § *"reaches none of them"*
 * is the check — which reads the side off `spreadSideOf` rather than being
 * told, and is why the error this paragraph used to contain never reached the
 * geometry. The band is also the margin the captain's artwork is composed
 * with, so staying clear of it is the same decision twice.
 *
 * The 56 pt it begins at is then the same margin on the outer edge, which is
 * both wider than the safe inset and wider than any guillotine tolerance
 * `docs/print.md` records.
 *
 * `VERSE_HEIGHT` above carries the vertical half of this, and
 * `test/book-verses.test.ts` is the whole arithmetic as pixels — it reads
 * every number off this slot, per page, so a page with its own position is
 * measured against its own box.
 */
function storySlot(id: string, top: number): Layer {
  return {
    id,
    kind: "textSlot",
    slot: SLOT.story,
    frame: { x: 56, y: top, width: 500, height: VERSE_HEIGHT },
    font: "typewriter",
    size: 15,
    baseline: 20,
    lineHeight: 26,
    colour: INK,
    align: "middle",
    /**
     * The longest verse is 253 characters with the longest name in it, so 300
     * is the budget with room for a line the captain might lengthen. Six lines
     * of sixty-two is 372, so this is the limit that binds on **bulk** and the
     * other two that bind on **shape** — which is the division
     * `TextSlotLayer.maxLines` argues for.
     */
    maxChars: 300,
    maxLines: 6,
    /**
     * Sixty-two, where the widest line of the copy is sixty-one.
     *
     * One spare rather than a comfortable margin, deliberately: the box above
     * is sized by measurement and this number's job is to make a *shape*
     * change in the copy fail the build rather than the page. A verse line
     * grown to seventy characters would still be under any generous count and
     * would still run off the paper.
     */
    maxCharsPerLine: 62,
  };
}

/**
 * **The captain's twelve verses, verbatim** — one per spread that carries
 * words, in spread order.
 *
 * Eleven entries for twelve verses, and that is not a gap. The captain wrote a
 * verse for **spread one as well**, and spread one is the page the *buyer's*
 * dedication occupies — so that verse is `FIRST_BOOK.dedicationDefault` below,
 * pre-filled into the buyer's own box rather than printed over it. The eleven
 * here are spreads two to twelve, which is exactly the eleven pages `interior`
 * gives a story slot to.
 *
 * **The punctuation, the line breaks and the blank line after the heading are
 * the poem.** Nothing here is reflowed, re-punctuated or improved; the straight
 * apostrophes and quotes and the spaced hyphens are the captain's document as
 * it was written. `{name}` is the one token (`lib/book/slots.ts`
 * § `NAME_TOKEN`) and `validateBook` checks every line still fits with the
 * longest name the form accepts.
 *
 * The heading carries the name in ten of the eleven, which is the shape the
 * slot above is sized for: the name shares a line only with a short one. The
 * longest line *containing* the name is spread 12's heading at thirty-five
 * characters; the longest line in the book carries no name at all.
 */
const STORY: readonly string[] = [
  // Spread 2 — Welcome to the world
  "Dear {name},\n" +
    "\n" +
    "The day that you came, the whole world felt new,\n" +
    "The stars seemed to shine just a little for you.\n" +
    "So tiny, so perfect, wrapped snug in our arms,\n" +
    "We fell head over heels for your sweet little charms.",
  // Spread 3 — Smiles and giggles
  "{name}, you smiled!\n" +
    "\n" +
    "One morning you grinned and our hearts melted through,\n" +
    'Then came a big giggle, a bubbly "ah-goo!"\n' +
    "We tickled your toes and we kissed your round tum,\n" +
    "And you laughed till the hiccups decided to come.",
  // Spread 4 — Tummy time
  "Go, {name}, go!\n" +
    "\n" +
    "On tummy-time mornings you pushed and you tried,\n" +
    "You wiggled and wobbled and rocked side to side.\n" +
    "Then over you rolled with a squeak and a cheer,\n" +
    "And we clapped for our champion - well done, my dear!",
  // Spread 5 — Night-night
  "Night-night, {name}\n" +
    "\n" +
    "When the moon climbed up high and the stars came to peep,\n" +
    "We rocked you and hummed till you drifted to sleep.\n" +
    "With your bear tucked in close and your blanket pulled tight,\n" +
    'We whispered "we love you" and kissed you goodnight.',
  // Spread 6 — First foods
  "{name} tries something new\n" +
    "\n" +
    "Your very first spoonful was quite a surprise,\n" +
    "You wrinkled your nose and you scrunched up your eyes.\n" +
    "But soon it was pumpkin, banana and pear,\n" +
    "On your cheeks, on your bib, and all over your hair!",
  // Spread 7 — Bath time
  "Splish-splash, {name}!\n" +
    "\n" +
    "Splish-splash in the bath with your ducks in a row,\n" +
    "You kicked and you paddled and put on a show.\n" +
    "Then wrapped in a towel, all rosy and sweet,\n" +
    "From the top of your head to your ten little feet.",
  // Spread 8 — Out and about
  "Out we go, {name}!\n" +
    "\n" +
    "We took you out walking to visit the park,\n" +
    "To hear all the birds and the dogs as they bark.\n" +
    "You reached for the clouds and the sky up so high,\n" +
    "And waved to each duck as it paddled on by.",
  // Spread 9 — Crawling
  "Here comes {name}!\n" +
    "\n" +
    "Then off you went crawling, so speedy and keen,\n" +
    "To explore every corner you'd never yet seen.\n" +
    "You opened the cupboards and pulled out the pots,\n" +
    "And found all the crumbs in the very best spots.",
  // Spread 10 — Loved by so many
  "{name}, you are so loved\n" +
    "\n" +
    "You're loved by so many, both near and afar,\n" +
    "Who think you're the brightest and loveliest star.\n" +
    "With cuddles and kisses and bedtime songs too,\n" +
    "There's no one more loved in the whole world than you.",
  // Spread 11 — First steps
  "Look at {name} go!\n" +
    "\n" +
    "Then one day you stood, holding tight to a chair,\n" +
    "Your legs gave a wobble - but look, you were there!\n" +
    "One step and then two, with your arms open wide,\n" +
    "Each brave little step with our hearts by your side.",
  // Spread 12 — Happy 1st Birthday
  "Happy 1st Birthday, {name}!\n" +
    "\n" +
    "Now here is a cake with one candle so bright,\n" +
    "A year full of wonder, of love and delight.\n" +
    "So make a wish, little one, as we sing just for you,\n" +
    "We love you, we love you, we always will too.",
];

/**
 * What each page carries beyond its story, and the only part of this file
 * written out by hand.
 *
 * The keys are page ids, which are **the same words the upload contract uses
 * for filenames**: `page-012.png` is this `page-012`. Nothing has to be
 * translated between the captain's folder and this template.
 *
 * **Which page carries what is data, and the flow reads it.** `pageWithSlot`
 * finds the photograph's page and the `Personalise with a photo` control
 * appears on that spread; move the slot to page six and the control moves with
 * it. Nobody writes down that it is page twelve.
 */
const FEATURED: Record<string, { scene?: Partial<SceneSpec>; layers?: Layer[] }> = {
  /**
   * **The opening spread, left-hand page — and it has no baby in it.**
   *
   * The captain's settled specification: the one spread drawn with no baby
   * (cream ground, clouds, bunting) is **look-independent**, which is exactly
   * what makes it the right place for the buyer's own photograph and words —
   * everything the buyer supplies sits on the two pages that are identical
   * across every look, so flicking between babies cannot move or reflow
   * a single thing they typed.
   *
   * `babyless` is therefore not a drawing preference. It is the structural
   * reason this spread can carry an order.
   *
   * **It carries no text, and that is the captain's decision of 12 November.**
   * It used to set the child's name alone and large in the middle of the
   * clouds, and the page facing it opens *"Dear {name},"* — the name twice
   * across one open spread reads as a mistake rather than as emphasis. So this
   * entry is a scene and no layers: the name reaches the front of the book on
   * the cover, inside "When {name} Turned One", and the dedication is where it
   * is spoken. The lone name under the cake on `page-024` is a different
   * moment and stays.
   */
  "page-001": {
    scene: { babyless: true },
  },

  /**
   * **The opening spread, right-hand page: the photograph, the dedication and
   * the from-line, in that order down the page.**
   *
   * The order is the captain's — *"in the printed book the photograph sits
   * above the dedication text, framed"* — and all three are on **one page**
   * because one page is what the one control personalises. `Controls.tsx` finds
   * this page by asking which page carries the dedication slot, so the panel
   * holding the photograph and both texts appears on this spread and nowhere
   * else, and moving these three layers to another page moves the panel.
   *
   * The arithmetic, because this is the one page in the book where three things
   * have to share a column:
   *
   * | | pt | inside the safe area (36–576) |
   * |---|---|---|
   * | photograph | 48 → 264 | 216 pt square = 3.00 in |
   * | dedication | 288 → 518 | 10 lines × 23 pt = 230 pt exactly |
   * | from-line | 530 → 562 | one line |
   *
   * **The dedication arrives pre-filled**, with the captain's own verse for
   * this spread — `FIRST_BOOK.dedicationDefault`, and `lib/book/order.ts`
   * § `defaultDedication` is where it becomes the buyer's text. The from-line
   * below it is where that verse's `{from}` goes, which is why its last line
   * reads as finished without one.
   *
   * Ten lines is Wonderbly's own dedication limit, which the research says to
   * copy exactly rather than to improve on, and it is what decides the type
   * size here rather than the other way round.
   */
  "page-002": {
    scene: { babyless: true },
    layers: [
      {
        id: "photo",
        kind: "photoSlot",
        slot: SLOT.photo,
        /**
         * **Square, and that is the decision.**
         *
         * A buyer who touches nothing gets `placePhoto`'s cover-fit about the
         * centre, and a square window is the only shape that takes the same
         * bite out of a portrait and a landscape — a landscape window would cut
         * the top and bottom off every phone portrait, which is most of what a
         * parent has. Crop is offered *after* upload, as an adjustment rather
         * than a step; see `PhotoOrder.view`.
         *
         * 216 pt is three inches printed, so at the book's declared
         * `minPhotoDpi` a photograph needs 600 px on its shorter side. That
         * floor is **derived from this box** — see `lib/book/photo.ts` — so
         * enlarging this window raises the bar a photograph has to clear, and
         * the two can never disagree.
         */
        frame: { x: 198, y: 48, width: 216, height: 216 },
        mask: { kind: "rect", radius: 10 },
        stroke: { colour: "#FFFFFF", width: 6 },
        placeholder: { fill: "#FFFFFF" },
        prompt: "A photograph of them",
      },
      {
        id: "dedication",
        kind: "textSlot",
        slot: SLOT.dedication,
        /**
         * **440 pt wide, where it was 374, and the verse below is why.**
         *
         * `dedicationDefault` pre-fills this box with the captain's own verse
         * for this spread, and `acceptLines` *wraps* prose that is wider than
         * `maxCharsPerLine` rather than refusing it — which is right for a
         * buyer typing and would have been fatal here: at thirty-four
         * characters the verse's forty-eight-character line would have come
         * back as two, and a re-flowed poem is a different poem. So the limit
         * is forty-eight and the box is sized for it.
         *
         * Forty-eight characters at the 0.6 em a character of 15 pt Special
         * Elite is planned at is 432 pt, inside this 440. Measured, the
         * default's widest line is 25.15 em — 377 pt — so the real headroom is
         * 63 pt; the planning figure is the one that matters, because what a
         * *buyer* types here is not measured in advance.
         */
        frame: { x: 86, y: 288, width: 440, height: 230 },
        font: "typewriter",
        size: 15,
        baseline: 19,
        lineHeight: 23,
        colour: INK,
        align: "middle",
        /**
         * Ten lines, forty-eight characters each, three hundred in total.
         *
         * The three are not redundant. `maxLines` stops a buyer pushing line
         * eleven off the bottom of the page; `maxCharsPerLine` stops one long
         * unbroken line running off both sides, which a line count cannot see;
         * `maxChars` is the overall budget. Ten lines at 23 pt is 230 pt, which
         * is this box exactly, and forty-eight characters of 15 pt typewriter
         * is about 432 pt inside a 440 pt one.
         *
         * `maxChars` is **unchanged at three hundred**, because the pre-filled
         * verse is 213 characters with the longest name the form accepts in it
         * and the budget was never the limit the buyer meets first.
         */
        maxChars: 300,
        maxLines: 10,
        maxCharsPerLine: 48,
      },
      {
        id: "from",
        kind: "textSlot",
        slot: SLOT.from,
        frame: { x: 119, y: 530, width: 374, height: 32 },
        /**
         * The handwritten face, where the dedication is typewritten.
         *
         * Not decoration: it is what makes the line read as a **signature**
         * under a dedication rather than as its eleventh line. `SLOT.from`
         * carries the rest of the argument for why it is its own role.
         */
        font: "hand",
        size: 20,
        baseline: 24,
        colour: INK,
        align: "middle",
        /**
         * One line, and the validator insists on it.
         *
         * Twenty-eight characters of 20 pt hand is about 235 pt inside 374, so
         * "Grandma and Grandpa" fits with room to spare and a paragraph does
         * not — which is the point. `text.fromLineMultiLine` is the refusal if
         * anybody ever raises `maxLines` here.
         */
        maxChars: 28,
        maxLines: 1,
        maxCharsPerLine: 28,
      },
    ],
  },

  /**
   * **The last page, and it carries no text either.**
   *
   * It set the name alone under the birthday scene — the closing beat of the
   * book — and the captain's decision of 12 November took it with page one's.
   * The consequence is the one worth knowing: **this book has no `babyName`
   * slot at all**, so the name reaches the pages only inside authored copy,
   * and `nameMaxChars` below is where its length is declared.
   */
  "page-024": {
    scene: { babyAt: { x: 0.5, y: 0.78 }, babySize: 0.28 },
  },
};

/**
 * One interior page.
 *
 * **The wash cycles per *spread*, not per page**, which is the one thing about
 * the placeholder that has to match the artwork rather than merely stand in for
 * it: the captain's twelve spreads are each a single 2.000:1 scene cut down the
 * middle, so two facing pages are two halves of one kitchen. Cycling per page
 * gave every spread a cream left and a blue right — which looks like a bug in a
 * preview the buyer is being asked to approve, and would have trained the eye
 * to expect something the real artwork never does.
 *
 * The **seed** is still the page's own, so the two halves wobble differently
 * and no two pages of the book are the same picture.
 *
 * **A story slot lands on the first page of every spread from the third page
 * on.** Spreads here are (003,004), (005,006) … (023,024), so the odd pages
 * carry the words and the even ones carry the picture — which is the shape the
 * artwork is drawn to, with the baby on one side and the quiet half taking the
 * text. The first page of a spread is its **left** half — `spreadSideOf` is
 * where that is decided and `rightHandPages` is the other half, the one the
 * child is drawn on.
 *
 * **Where down that page the verse sits is `VERSE_TOP_ON`**, the captain's
 * mark for that spread, and `VERSE_TOP` for the two spreads carrying no mark.
 * Both are above, with the measurement.
 */
function interior(index: number): BookPage {
  const number = index + 1;
  const id = `page-${String(number).padStart(3, "0")}`;
  const featured = FEATURED[id];

  const spread = number >= 3 && number <= 23 && number % 2 === 1 ? (number - 3) / 2 : -1;
  const story = spread >= 0 ? STORY[spread] : undefined;

  const layers = [
    ...(featured?.layers ?? []),
    ...(story ? [storySlot("story", VERSE_TOP_ON[id] ?? VERSE_TOP)] : []),
  ];

  return {
    id,
    art: artFor({
      // `index >> 1` is the spread this page is a half of: pages 1 and 2 are
      // spread 0, pages 3 and 4 are spread 1, and so on.
      ...SCENES[(index >> 1) % SCENES.length],
      seed: 2000 + index,
      /**
       * **A page of words is a page with no baby drawn on it**, in the
       * placeholder exactly as in the artwork it stands in for.
       *
       * `lib/book/derive.ts` § `rightHandPages`, `lib/book/ghost.ts` and
       * `lib/artwork/prepare.ts` all already say this about the delivered
       * pages — one 2.000:1 scene a spread, the child on the right-hand half,
       * *"every left half is the quiet half — the words"*. The placeholder was
       * the only thing in the repository claiming otherwise, and it drew its
       * baby at the page's own centre.
       *
       * That claim was invisible while the verse sat in the top twelfth and
       * became a verse printed across a drawn face the moment it moved into
       * the band the artwork reserves (`VERSE_TOP` above). The honest fix is
       * not a smaller baby pushed to the foot of the page — at
       * `VERSE_TOP_ON["page-011"]` there is no room for one — it is for the
       * stand-in to stand in for the right thing.
       *
       * The opening spread's left page says the same through `FEATURED`, for
       * its own reason, and the spread order below puts `featured?.scene`
       * after this so a page may still override it.
       */
      ...(story ? { babyless: true } : {}),
      ...featured?.scene,
    }),
    ...(story ? { story } : {}),
    ...(layers.length ? { layers } : {}),
  };
}

/**
 * This page's artwork, as **published**: the scene drawn from the numbers
 * below.
 *
 * **The captain's finished pages are never written into this file**, and that
 * is the one thing to understand about artwork here. They weigh 155 MB a look
 * and this repository is public, so they live in the artwork store
 * (`lib/artwork/release.ts`) and are bound over this book at request time by
 * `lib/book/release-art.ts`. The consequences are all good ones: nothing in the
 * repository changes when artwork lands, this book's `rev` does not move, a
 * fresh clone and CI draw exactly what they always drew, and the page below is
 * still the thing a reviewer reads in a diff.
 *
 * It is a function rather than a literal because every page calls it, and
 * because the day the artwork is reachable by everybody — a bucket, a decision
 * the captain still owes — this is the one place that would gain an argument.
 */
function artFor(scene: SceneSpec): BookPage["art"] {
  return { kind: "drawn", scene };
}

/**
 * The fourteen looks, and the placeholder baby each one is drawn as until its
 * artwork lands.
 *
 * **Fourteen: seven per gender**, which is the captain's settled count. The
 * count is nonetheless **data and nothing counts it**: no component, validator,
 * copy string or test asserts seven, so the day the captain delivers five or
 * eight the grid renders five or eight. `test/look-count.test.tsx` is that
 * sentence as an assertion — it renders the chooser for a book with a
 * deliberately different number of looks and counts the tiles.
 *
 * **The order is the ladder, and the ladder is skin lightness descending.**
 * Settled with the captain and measured off the portraits: the three fair slots
 * are separated by **hair** rather than by skin, because three shades nobody can
 * tell apart would read as a broken grid.
 *
 * | # | Skin | Undertone | Hair |
 * |---|---|---|---|
 * | 1 | very fair | cool pink | blonde |
 * | 2 | very fair | cool pink | ginger |
 * | 3 | fair | neutral | mid-brown |
 * | 4 | olive / tan | warm | dark brown |
 * | 5 | medium-olive | olive | jet black, straight |
 * | 6 | medium-deep brown | warm golden | black curls |
 * | 7 | deep brown | warm red | black coily |
 *
 * **The ids are the published addresses of the fourteen babies, and they are
 * the captain's own portrait numbering.** An order names one, so they are
 * permanent — and `girl-03` is `03-girl.png` with no table in between, which is
 * the whole reason they are spelled this way. `lib/artwork/import.ts`
 * § `portraitMapping` does the mapping *by the number in the filename* against
 * this list in this order, so there is nothing for anybody to maintain by hand
 * and nothing to match by eye. `docs/artwork.md` is the same mapping written
 * down for a reader.
 *
 * The first look landed on 10 November and is bound over this list at request
 * time by `lib/book/release-art.ts`; `baby` stays on every entry, because every
 * look but that one is still being drawn and a look with no artwork has to be
 * drawable — that is what lets a fresh clone and the whole suite run with no
 * artwork at all. `docs/artwork.md` is what has actually arrived; this file
 * does not track it.
 *
 * **Only the baby differs, and here the baby is four numbers.** The gender tag
 * is a tag on an otherwise opaque look: the captain's decision is that gender
 * lives in the head only — hair shape, plus a bow where the signal needs to be
 * unmistakable — and the sleepsuit stays the same garment throughout. None of
 * that is expressible in a placeholder drawn from three colours and a seed, and
 * none of it needs to be: a look is a folder of finished pages, so whatever the
 * artwork does changes pixels and changes nothing in this format. The two
 * genders therefore read down the **same** ladder, with the same skin and hair
 * at every rung, which is also what makes a renumbered portrait set obvious.
 *
 * **The labels describe the baby and name nobody.** The buyer's child has a
 * name and it is not one of these: a look called *Mabel* — which is what these
 * were — reads as a book about Mabel in a flow whose next question is "what is
 * their name?".
 */

/**
 * **The question asked before the grid**, declared once because two things
 * read it.
 *
 * The captain's decision of 6 November, reversing the brief, after reviewing
 * two sellers that both ask it first. It is a declared list and the flow
 * renders whatever is in it: adding, removing or renaming an answer is a data
 * edit and a restamp.
 *
 * `LOOKS` below is built from these same ids rather than from a second copy of
 * them, so renaming an answer cannot leave the grid tagged with a gender the
 * book no longer offers — which is `look.genderUnknown` from `validateBook`,
 * and a refusal is a poor substitute for being unable to say it.
 */
const GENDERS = [
  { id: "girl", label: "A girl" },
  { id: "boy", label: "A boy" },
];

/** One rung of the ladder: what both genders' looks at that number are drawn as. */
interface Rung {
  /** The chooser's own words for it. Describes the baby and names nobody. */
  label: string;
  skin: Colour;
  hair: Colour;
}

const LADDER: readonly Rung[] = [
  { label: "Very fair skin, blonde hair", skin: "#FBE2DC", hair: "#E3C078" },
  { label: "Very fair skin, ginger hair", skin: "#FBE2DC", hair: "#C0592A" },
  { label: "Fair skin, mid-brown hair", skin: "#F1D2B6", hair: "#8C6239" },
  { label: "Tan skin, dark brown hair", skin: "#D7A678", hair: "#4A2C18" },
  { label: "Olive skin, straight black hair", skin: "#B98C5C", hair: "#16120D" },
  { label: "Brown skin, black curls", skin: "#8E5A32", hair: "#1C120A" },
  { label: "Deep brown skin, black coils", skin: "#6B3A24", hair: "#140D08" },
];

/**
 * The sleepsuit, which is the same garment throughout and only a colour here.
 *
 * One per gender rather than one per look: the placeholder's job is to make the
 * grid read as *which baby*, so the thing that varies down a column is the baby
 * and not the laundry. `lib/render/decoration.ts` draws it.
 */
const CLOTH: Record<string, Colour> = { girl: "#E9A7B1", boy: "#9CBCD2" };

/**
 * The ladder, once per gender, as `girl-01` … `girl-07` and `boy-01` … `boy-07`.
 *
 * Written out by a loop rather than by hand because the two genders are the
 * same ladder: fourteen literals would be seven chances to mistype a colour and
 * no way to see that the rungs line up. The seed is derived from the rung and
 * the gender so that every look wobbles differently and does so identically on
 * every machine — `lib/render/random.ts` on why nothing here may be random.
 */
const LOOKS: Look[] = GENDERS.flatMap(({ id: gender }, column) =>
  LADDER.map((rung, at) => ({
    id: `${gender}-${String(at + 1).padStart(2, "0")}`,
    label: rung.label,
    gender,
    baby: {
      skin: rung.skin,
      hair: rung.hair,
      cloth: CLOTH[gender],
      seed: 31 + column * LADDER.length + at,
    },
  })),
);

// ---------------------------------------------------------------------------

export const FIRST_BOOK: BookTemplate = {
  schema: 1,
  id: "the-book-of-you",
  rev: "80b4996b",
  /**
   * **"When They Were Small".**
   *
   * The book was called *The Book of You* while the shop was being named. The
   * shop is **One Little Book** and this is the title on the pages the captain
   * approved, so it is the title here too — a shop that calls a book one thing
   * on its landing page and another on its order confirmation has two books.
   *
   * **The `id` above does not follow it**, and must not: it is *"stable
   * forever, never renamed, never reused — an order refers to it"*, so every
   * order already placed names `the-book-of-you` and a reprint of one has to
   * find this template. The published address a customer sees is the shelf's
   * own `slug` — `lib/shop/shelf.ts` § Why the slug is here and not the book's
   * `id`.
   *
   * Editing this restamps `rev`, which is what `npm run book` refuses until it
   * is done and what keeps a year-old order from picking up an edited book.
   */
  name: "When They Were Small",
  blurb:
    "Twelve spreads of their first year, with their name through it, one of your own " +
    "photographs, and a dedication in the front.",

  /**
   * **The captain's verse for spread one, pre-filled into the buyer's own box.**
   *
   * The twelfth verse, and the only one that is not in `STORY`: spread one is
   * the page the *buyer's* dedication occupies, so the captain's words for it
   * are offered as the dedication's **starting text** rather than printed over
   * the top of it. A buyer who writes nothing gets a finished page; a buyer who
   * writes their own replaces it entirely, and a buyer who clears it gets an
   * empty box that stays empty — `lib/book/order.ts` § `defaultDedication` is
   * the whole of that behaviour and `Order.dedicationWritten` is the one bit of
   * state it needs.
   *
   * **`{name}` is substituted; `{from}` is a slot and not a token.** The
   * captain's last line is *"With all our love, {from}"*, and this page already
   * declares a `fromLine` slot under the dedication, set in the handwritten
   * face, holding exactly what `{from}` means. So the line is set across the
   * two slots the page has: *"With all our love"* here and the signature
   * beneath it, which is also why the comma is not in this string — the
   * from-line is **optional**, and a dedication that ends in a dangling comma
   * when nobody signs it is a typo in a printed book.
   *
   * It is declared on the book rather than in `lib/` because it is copy, and
   * copy belongs to the title that says it. Absent — which is every other book
   * — means the dedication starts empty, which is what this one did until the
   * captain wrote this.
   */
  dedicationDefault:
    "Dear {name},\n" +
    "\n" +
    "Here is your year, all tucked in a book,\n" +
    "Each first and each giggle, each wide-eyed look.\n" +
    "We'll read it together again and again,\n" +
    "And remember how small you were back then.\n" +
    "\n" +
    "With all our love",

  page: {
    canvas: {
      unit: "pt",
      width: SIDE,
      height: SIDE,
      /**
       * 0.25 in of bleed, declared conservatively exactly as `my-forever.ts`
       * declares it: over-declaring moves the trim guide *inwards*, which keeps
       * content further from any real cut line, where under-declaring moves it
       * towards one. `docs/print.md` carries the evidence and the open question.
       *
       * Here it also does the arithmetic that makes the trim the product's own
       * size: 612 − 2 × 18 = 576 pt = **8.00 in**, which is both Printify photo
       * books exactly.
       */
      bleed: BLEED,
      /** A further 0.25 in. Nothing a buyer can see crosses it. */
      safe: 18,
      /**
       * The ground under every page, and cream rather than white on purpose: a
       * page whose artwork failed to load must look like a missing picture, not
       * like a blank sheet somebody meant to print.
       */
      background: "#F3E7DA",
    },
    print: {
      pixels: { width: 3600, height: 3600 },
      colourSpace: "srgb",
      encoding: "png",
    },
    /** 200 DPI. `lib/book/photo.ts` argues the number and derives the pixels. */
    minPhotoDpi: 200,
  },

  /** Fourteen characters — § `NAME_CHARS` above argues the number. */
  nameMaxChars: NAME_CHARS,

  /** The question asked **before** the grid — § `GENDERS` above. */
  genders: GENDERS,

  /**
   * The looks. Same book, same words, same backgrounds — a different baby.
   *
   * The list is published here and the **artwork is bound over it** — the
   * finished pages and the chooser portrait of each baby are in the artwork
   * store, not in this repository, for the reasons `lib/artwork/release.ts`
   * gives. **Nothing anywhere counts them** — the grid renders the list it is
   * given.
   */
  looks: LOOKS,

  /**
   * **The tiles show page four: a baby, and not one word.**
   *
   * Two reasons, and both were found by looking at the rendered grid rather
   * than by reasoning about it.
   *
   * **Page one is babyless** — see its entry in `FEATURED` — so a grid drawn
   * from it would be one identical tile per look under the question "which baby?".
   * `validateBook` refuses a babyless page here, so that cannot regress by
   * somebody making another page babyless and forgetting this line.
   *
   * **Page three carries story text, and a tile is drawn with no name in it.**
   * `storyTextFor` deliberately leaves `{name}` in place when there is no name
   * yet — on a full-size page that reads as "your name goes here", which is
   * true and useful. Shrunk to a tile it is a literal brace token in the
   * middle of a verse, which reads as a bug. Page four is the picture half of its spread
   * and carries no slot at all, so the tile is the baby and nothing else —
   * which is exactly what "the choice reads as *which baby* rather than *which
   * picture*" asks for.
   */
  tilePage: "page-004",

  /**
   * **One cover scene in three colourways**, the captain's settled shape —
   * not three cover scenes, which would be three more artwork sets.
   *
   * The colourway is chosen in the persistent bar during the preview rather
   * than as a step of its own, which is the other half of the same decision:
   * see `app/_book/Bar.tsx`.
   */
  covers: [
    { id: "blush", label: "Blush", colour: "#E8A0A8" },
    { id: "sage", label: "Sage", colour: "#A9C2A0" },
    { id: "oat", label: "Oat", colour: "#E3CDB8" },
  ],

  /**
   * **No `coverTint` here, on purpose.**
   *
   * The cover choice recolours the cover's whole ground, which is
   * `SceneSpec.groundFromCover` on the page below — a buyer picking "Sage"
   * wants a sage book, not a sage rectangle on a cream one. `coverTint` is the
   * mechanism for the *other* state: when the cover is an uploaded image there
   * is no ground to recolour, and the only way to apply a choice is to fill a
   * declared shape. `validateBook` accepts either and refuses neither.
   */

  cover: {
    id: "cover",
    /**
     * **The title, and it is authored words with the buyer's name in them.**
     *
     * *"When {name} Turned One"* — the captain's. It is a `story` and a
     * `storyText` slot because that is **exactly** the mechanism it needs and
     * there is no second one worth building: words written once for every
     * order, `{name}` substituted per order, checked by `validateBook` against
     * the longest name the form accepts, and drawn by the renderer so that the
     * artwork under it stays wordless. `lib/book/slots.ts` § `SLOT.story` says
     * the same thing from the other end.
     *
     * **Three lines, because the name is the long one.** One line would put
     * the title's twenty-six characters and a fourteen-character name on the
     * same line, and a cover whose type is sized for the longest name the form
     * takes is a cover set in 29 pt. Stacked, the widest line is the name
     * itself and the title can be set at 44.
     *
     * **There is no name slot on the cover, and since 12 November none
     * anywhere in the book.** The name is *in* the title, and a second slot
     * would print the child's name twice on the front — which is the same
     * reason page one's lone name went, one spread further in. So this slot is
     * the front of the book's whole claim on the name, `nameMaxChars` is where
     * its length is declared, and this slot's `maxCharsPerLine` below is the
     * box that has to hold it.
     */
    story: "When\n{name}\nTurned One",
    art: artFor({
      // Replaced by the chosen cover's colour. The only page that does this,
      // and `validateBook` refuses any interior page that tries.
      ground: "#E8A0A8",
      groundFromCover: true,
      floor: "#D9BFA6",
      prop: "#CBAE87",
      babyAt: { x: 0.5, y: 0.84 },
      babySize: 0.24,
      seed: 1001,
    }),
    layers: [
      {
        id: "cover-panel",
        kind: "shape",
        frame: { x: 85, y: 212, width: 442, height: 188 },
        shape: {
          kind: "rect",
          radius: 20,
          // Cream, and not the cover colour: the title is set on this panel and
          // has to stay legible against all three choices.
          fill: "#FBF6EC",
          stroke: { colour: "#FFFFFF", width: 4 },
          shadow: { colour: "#2A1C12", blur: 10, dx: 0, dy: 6 },
        },
      },
      {
        id: "cover-title",
        kind: "textSlot",
        slot: SLOT.story,
        /**
         * Inside the panel above, which is 212 → 400.
         *
         * Three baselines at 226 + 48 + 52 n are 274, 326 and 378, so the
         * first line's ascenders clear 212 and the last line's descenders stop
         * short of 400 — the panel holds the title rather than the title
         * crossing it.
         *
         * 402 pt across: fourteen characters of 44 pt Indie Flower is 374 pt
         * measured against the vendored TTF, which is the longest line this
         * slot can be given.
         */
        frame: { x: 105, y: 226, width: 402, height: 160 },
        font: "hand",
        size: 44,
        baseline: 48,
        lineHeight: 52,
        colour: INK,
        align: "middle",
        /**
         * Sixteen across, where the name's own limit is fourteen and *"Turned
         * One"* is ten.
         *
         * The two numbers are deliberately close, and this is now the
         * **tightest box the name lands in anywhere** — the two `babyName`
         * slots that used to be tighter are gone. Raise `NAME_CHARS` past
         * sixteen and this slot refuses at build time with
         * `text.storyOverflows` — which is the build saying that the cover no
         * longer holds the name, rather than the cover saying it in print.
         */
        maxChars: 32,
        maxLines: 3,
        maxCharsPerLine: 16,
      },
    ],
  },

  /**
   * Twenty-four pages — twelve spreads, which is Printify's hardcover photo
   * book exactly. The count is this list's length and nothing else.
   */
  pages: Array.from({ length: 24 }, (_, i) => interior(i)),
};

export default FIRST_BOOK;
