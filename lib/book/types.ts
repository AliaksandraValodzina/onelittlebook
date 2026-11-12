/**
 * **A book, as data — the object one level above a page.**
 *
 * `docs/template-format.md` § What the format does not do yet named this
 * precisely: *"Multiple pages. A book is a list of these; nothing here forbids
 * it and nothing here does it."* This is that, and it is deliberately the
 * smallest thing that can be: a `BookTemplate` is **a declared page size, a
 * looks axis, a cover, and an ordered list of pages**, where a page is the
 * artwork behind it plus the slots on top of it.
 *
 * Three decisions carry the weight, and all three come straight out of the
 * research in `data/kn-baby-book-design/report.md` § 3.1.
 *
 * **1. A page is not a second format.** `./derive.ts` turns one entry of
 * `pages` into a real `PageTemplate` — the format that already exists, with the
 * canvas and the print spec the book declares — and `lib/render/svg.ts` draws
 * that. So there is no second renderer, no second validator and no second set
 * of defaults: a book is a *source* of page templates, not a rival to them.
 * `test/one-renderer.test.ts` already fails on an `if (forPrint)`; a book that
 * drew itself would have been a far bigger version of the same mistake.
 *
 * **2. A look is a named axis on the book, never a separate book.** A book's
 * looks must be references, not separate books, or a typo in the story is one
 * edits and switching look mid-order is opening a different document. So the
 * *text, the slots, the page order and the page size live on the book*, and a
 * look contributes nothing but what is drawn underneath. The buyer's fill names
 * a look by id and could be re-pointed at another one without changing a single
 * other field — which is what makes "flick between looks" structurally
 * incapable of losing their work.
 *
 * **3. The buyer's filling of it is still a separate document.** `BookFill` is
 * a name, a photograph, a dedication, an optional signature, a look and a
 * cover — **no layout and nothing per-page**. The buyer never positions
 * anything *on a page*, so there is nothing per-page for them to have
 * positioned. The one thing they may move is which part of their own
 * photograph the fixed window shows, which is a `Crop` on the photograph and
 * not a coordinate on the book; `lib/book/order.ts` § `PhotoOrder.view` and
 * `app/_book/CropSurface.tsx` carry that distinction.
 *
 * The page size is a **declared value on the book** (`page.canvas`,
 * `page.print`) and the open trim question is why: see `docs/print.md`
 * § The square trim nobody has pinned down. Changing 3600 to 3150, or to
 * anything else, is editing two numbers and re-running `npm run book`.
 */

import type { AssetRef, Canvas, Colour, Layer, PhotoFill, PrintSpec } from "../template/types";
import type { PreviewAsset } from "./preview-art";

// ---------------------------------------------------------------------------
// The looks axis
// ---------------------------------------------------------------------------

/**
 * One baby.
 *
 * `id` is published and permanent — a buyer's order names it, and renaming a
 * look after a sale orphans that order. `docs/look-upload-contract.md` § 1 is
 * the same sentence addressed to whoever generates the folder, because the
 * folder name *is* this id.
 */
export interface Look {
  id: string;
  /** What the chooser calls it. Changeable; it is not an address. */
  label: string;
  /**
   * Which gender's grid this look appears in — an id from `BookTemplate.genders`.
   *
   * The buyer is asked gender **before** the grid and the grid then shows only
   * that gender's looks. That is the captain's decision of 6 November,
   * reversing the brief, taken after reviewing two sellers that both ask it
   * first.
   *
   * It is a **tag on an otherwise opaque look** and nothing more. How gender is
   * expressed in the artwork — hair, a bow, an outfit colour — is still open and
   * is deliberately invisible here: a look is a folder of finished pages, so
   * whatever the captain decides changes pixels and changes nothing in this
   * format. Absent means the look appears in **every** gender's grid, which is
   * the right reading of silence: a look nobody tagged is still a look somebody
   * drew, and hiding it would be a worse failure than showing it twice.
   */
  gender?: string;
  /**
   * The placeholder baby, drawn from numbers.
   *
   * **Present means this look has no artwork yet.** `./derive.ts` draws the
   * page's own scene and puts this baby into it, which is how the whole buyer
   * flow is testable, deployable and reviewable before a single PNG exists —
   * the brief's "build against fixtures" in one field. Absent means the look is
   * artwork-only and every page must carry an asset for it.
   *
   * It is the *only* thing a look may say about what a page looks like. A look
   * cannot move a slot, change a word or alter a background, because those live
   * on the book and a look that could touch them would be a separate book
   * wearing a costume.
   */
  baby?: BabySpec;
  /**
   * The chooser's tile: a portrait of this baby, head and shoulders on white.
   *
   * **Present means the tile is this picture; absent means the tile is
   * `tilePage` of the book drawn with this look**, which is what it has always
   * been and still is for a look nobody has delivered a portrait for.
   *
   * The captain approved the portraits as the tiles on 10 November, and the
   * reasoning is worth keeping because it reverses what
   * `docs/look-upload-contract.md` § 4 argued for: a rendered page makes the
   * pose *identical by construction*, which is the property the research asked
   * for — but a head on white says **which baby** and nothing else, where a
   * whole page at tile size says "which picture" in a sixth of the pixels. It
   * is also what Wonderbly does. The page-drawn tile stays as the fallback
   * rather than being deleted, so the chooser works on a machine with no
   * artwork at all.
   *
   * It is **not a page** and is never held to the page contract: a portrait is
   * 1254 × 1254 with the subject flattened onto white, and `validateBook`
   * refuses one that claims to be a page size. `docs/artwork.md` carries the
   * mapping from the captain's numbering to these ids.
   */
  tile?: AssetRef;
}

/**
 * The placeholder baby: four colours and a seed.
 *
 * Not an attempt at the captain's artwork and not trying to be. It exists so
 * the grid of tiles is a real grid of visibly different babies on identical
 * backgrounds — which is the thing the research says the chooser has to
 * communicate (*"the choice reads as which baby rather than which picture"*) —
 * and so the print path has something at full resolution to produce a real
 * file from today.
 */
export interface BabySpec {
  skin: Colour;
  hair: Colour;
  /** The babygro. */
  cloth: Colour;
  /** Wobble, seeded. `lib/render/random.ts` says why nothing here may be random. */
  seed: number;
}

/**
 * One answer to the question asked before the grid.
 *
 * A **declared list of unknown length**, exactly like `covers`. The captain has
 * settled that the question is asked; what the answers are, and how many looks
 * sit behind each, is still being decided — so nothing in this codebase counts
 * them, and the chooser renders whatever is here.
 */
export interface GenderChoice {
  id: string;
  label: string;
}

/**
 * A cover the buyer can pick.
 *
 * `colour` is applied to **one declared layer** of the cover page —
 * `BookTemplate.coverTint` names which — so a cover choice is a fill and not a
 * different page. That keeps the cover artwork one file per look rather than
 * one file per look *per cover*, which is the combinatorial explosion that
 * makes a second cover unaffordable.
 */
export interface CoverChoice {
  id: string;
  label: string;
  colour: Colour;
}

// ---------------------------------------------------------------------------
// A page
// ---------------------------------------------------------------------------

/**
 * The scene behind a page, drawn from numbers.
 *
 * Declared **on the page and not on the look**, which is the structural half of
 * the upload contract's hardest rule: *"every look has the same backgrounds;
 * only the baby differs."* Two looks of this book cannot have different
 * kitchens, because there is only one kitchen and it is written here once.
 *
 * `lib/render/decoration.ts` draws it. See the note on `Art` in
 * `lib/template/types.ts` for why decoration is numbers rather than files.
 */
export interface SceneSpec {
  /** The wash behind everything. */
  ground: Colour;
  /** The band across the lower part — a floor, a blanket, the water in a bath. */
  floor: Colour;
  /** The soft shape the baby is in or on — a cot, a rug, a tub. */
  prop: Colour;
  /**
   * Where the baby stands, 0–1 of the page. Absent is `{ x: 0.5, y: 0.6 }`.
   *
   * The scenes alternate sides so the baby is never in the gutter, which
   * `docs/look-upload-contract.md` § 2 calls the one that bites.
   */
  babyAt?: { x: number; y: number };
  /** The baby's height, 0–1 of the page height. Absent is `0.34`. */
  babySize?: number;
  /**
   * The ground and nothing in it. Absent is `false`.
   *
   * The opening spread of this book is babyless on purpose: it is the one
   * spread identical across every look, which is what makes it the right
   * place for the buyer's own photograph and dedication. `lib/render/decoration.ts`
   * § `scene` carries the rest of the argument.
   */
  babyless?: boolean;
  /**
   * When true, `ground` is replaced by the colour of the cover the buyer chose.
   *
   * Absent is false — the page uses its own `ground`. Only the cover page sets
   * it, and `./validate.ts` says so: a tinted interior page would mean the
   * cover choice silently recoloured the middle of the book.
   */
  groundFromCover?: boolean;
  seed: number;
}

/**
 * The artwork behind one page, across every look.
 *
 * Two states, and which one a page is in is the difference between "the captain
 * has uploaded this" and "we are standing in for it".
 */
export type PageArt =
  /**
   * The captain's finished page images, one per look, by content hash.
   *
   * **The production state.** A look missing from `byLook` is a refusal and not
   * a book with one look fewer — `./validate.ts` reports `art.lookMissing` —
   * because the alternative is a chooser offering a tile that renders a blank
   * page. `docs/look-upload-contract.md` is the agreement these refs come from
   * and `npm run looks:import` is what writes them.
   */
  | {
      kind: "asset";
      byLook: Record<string, AssetRef>;
      /**
       * The drawn placeholder for the looks `byLook` does not cover.
       *
       * **Present means the import is partial and that is a legitimate state.**
       * The captain delivered the first look on 10 November and the rest are
       * still being drawn, so a page with one look's artwork and a placeholder
       * baby for every other look is what the shop honestly is — where
       * refusing it would mean no real artwork could be seen until the last
       * look was finished.
       *
       * **Absent means every look must have an asset**, which is the state a
       * finished release is in: `./validate.ts` then reports `art.lookMissing`
       * for any look without one, because in a complete book that is a chooser
       * offering a tile that renders a blank page.
       */
      scene?: SceneSpec;
    }
  /**
   * Drawn from numbers, with the look's own baby placed in it.
   *
   * **The placeholder state**, and the reason the whole flow is live and tested
   * with no artwork in the repository. Sharp at any size, so the print file it
   * produces is a genuine 3600 px file rather than an upscale — see
   * `lib/render/decoration.ts` on why a curve has no resolution.
   */
  | { kind: "drawn"; scene: SceneSpec };

/**
 * One page of the book.
 *
 * `layers` is the **existing** `Layer` union — the same `photoSlot`,
 * `textSlot`, `shape` and `art` a single page has always had. `./derive.ts`
 * puts the artwork underneath them and hands the result to the one renderer.
 * Nothing about a page here is a new drawing primitive.
 */
export interface BookPage {
  /** Stable within the book, forever. An order's print file is named with it. */
  id: string;
  art: PageArt;
  /**
   * The authored narrative line or two for this spread.
   *
   * **A third kind of text, and the one the brief did not have.** The captain
   * confirmed on 6 November that the book carries words they write once, per
   * spread, fixed for every order — as distinct from the name and the
   * dedication, which the buyer writes per order.
   *
   * It lives here, on the page, because that is what it is: part of the
   * published book rather than part of anybody's order. The buyer's own fields
   * cannot touch it and a `BookFill` has nowhere to put it.
   *
   * **`{name}` is substituted with the buyer's name.** The captain's own note is
   * that the name may appear inside the story and not only on the cover, so the
   * slot has to be capable of it — and because it is, `./validate.ts` checks
   * that the line still fits **with the longest name the form will accept**,
   * not merely with the empty string. A story line that fits "Jo" and overflows
   * "Clementine" is a book that prints wrong for one buyer in ten.
   *
   * **The cover's authored words are its title**, and they live in this same
   * field. One mechanism rather than two: a title is words written once for
   * every order with `{name}` in them, checked against the longest name the
   * form accepts, drawn by the renderer so the artwork stays wordless — which
   * is this field's definition, word for word. `lib/book/slots.ts`
   * § `SLOT.story` makes the same argument from the slot's end.
   *
   * Absent means the page carries no story, which most pages of this book do
   * not. A page with `story` and no `storyText` slot is a refusal, and so is
   * the reverse: both are words that would silently go nowhere.
   */
  story?: string;
  /**
   * What is drawn on top of the artwork, bottom first.
   *
   * Absent and empty are the same thing and both are normal: most pages of a
   * narrative book carry nothing but the picture. A slot's `slot` name must be
   * one of `./slots.ts`'s declared roles — the validator refuses anything else,
   * because a slot nothing fills is a dashed placeholder box printed in a book.
   */
  layers?: Layer[];
  /**
   * **The photo path's preview art for this page, and it can never print.**
   *
   * The captain's golden ghost spread for this page: the whole scene with the
   * child drawn as a glowing gold sparkle silhouette, clothing and props left
   * solid. On the photo path the child does not exist yet
   * (`lib/book/ghost.ts`), so this is what holds their place — and it holds it
   * far better than a drawn silhouette, because it is the page's own artwork
   * with the child *in* it rather than a white shape over a scene.
   *
   * **Absent means the drawn silhouette**, which is `lib/render/ghost.ts` and
   * is still what every page without a delivered golden half gets. A page the
   * child is not on ignores this entirely: `lib/book/ghost.ts` asks whether the
   * child is on the page *first*, which is why the captain's `spread-01` —
   * correctly, since the opening spread is babyless — has no ghost in it.
   *
   * It is a `PreviewAsset` and not an `AssetRef`, so **the type system refuses
   * it as page artwork**: it is 887 px, a quarter of a page's linear
   * resolution, and a printed book drawn from one would be soft. See
   * `./preview-art.ts` for how the two types are kept apart and
   * `test/ghost.test.ts` for the import graph that keeps the print path away
   * from the one module that can convert it.
   */
  ghost?: PreviewAsset;
}

// ---------------------------------------------------------------------------
// The book
// ---------------------------------------------------------------------------

export interface BookTemplate {
  /** The format's own version. A reader that does not know it must refuse. */
  schema: 1;
  /** Stable forever. Never renamed, never reused — an order refers to it. */
  id: string;
  /**
   * Eight hex of this book's own content hash, stamped at publish.
   *
   * Exactly `PageTemplate.rev` one level up, for exactly the same reason: a
   * fill names `(bookId, bookRev)`, so a reprint of a year-old order cannot
   * quietly pick up a book that has been edited since. `npm run book` refuses
   * to write anything until it matches and prints the value to use.
   */
  rev: string;
  name: string;
  /**
   * The subject line of the whole thing, shown in the chooser.
   *
   * Copy, not a fact. Nothing about price, pages, paper or delivery goes here:
   * `lib/product.ts` is where a claim has to earn a `confirmed: true` arm.
   */
  blurb: string;
  /**
   * **What the dedication box already says when the buyer first sees it.**
   *
   * A *starting value*, not a placeholder and not a watermark: it is the
   * buyer's text from the first keystroke, it prints exactly as it reads, and
   * clearing it leaves it cleared. `lib/book/order.ts` § `defaultDedication`
   * holds the mechanism and `Order.dedicationWritten` is the single bit that
   * tells "never touched" from "deliberately empty" — without it the box would
   * either refill itself after being cleared or never fill at all.
   *
   * **`{name}` is substituted, exactly as in `BookPage.story`.** Until there
   * is a name there is no default either, because a dedication reading
   * "Dear {name}," is a brace token in the buyer's own words — which is
   * tolerable in authored copy on a live preview and is not tolerable here.
   * The flow asks for the name before it asks for the message, so in practice
   * the box is already filled when it is first seen.
   *
   * `{from}` is **not** a token. The one book that uses this field has a
   * `fromLine` slot under its dedication, which is what `{from}` means, so the
   * signature goes there — see `templates/first-book.ts`
   * § `dedicationDefault`.
   *
   * **Absent means the dedication starts empty**, which is the normal state of
   * a book whose copy nobody has written for that page. `./validate.ts` checks
   * a declared default against the dedication slot's own limits with the
   * longest name the form accepts in it, so a default that cannot print is a
   * build refusal rather than a clamp the buyer never asked for.
   */
  dedicationDefault?: string;
  /**
   * **The page size, declared once for every page of the book.**
   *
   * One place, so changing it is a data edit. `docs/print.md` § The square trim
   * nobody has pinned down is why that matters: 3600 × 3600 is 12.00 in at 300
   * dpi and 3150 × 3150 is 10.5 in, which is not a square trim anybody sells —
   * and the question of which is right is the captain's, not this file's.
   */
  page: {
    canvas: Canvas;
    print: PrintSpec;
    /**
     * The lowest resolution a buyer's photograph may print at, in dots per inch.
     *
     * **A photograph too small to print is refused rather than printed soft** —
     * the captain's own wording, reconfirmed on 6 November. The *pixels*
     * required are never declared: they are derived from this and the slot's
     * own width, so moving or enlarging the photo window moves the floor with
     * it and the two can never disagree. `lib/book/photo.ts` does the
     * arithmetic and says why 200 rather than 300.
     */
    minPhotoDpi: number;
  };
  /**
   * What the buyer is asked **before** the grid of looks.
   *
   * Absent or empty means the question is not asked and the grid shows every
   * look — which is what the brief originally specified and what this field
   * exists to make a *data* decision rather than a code one. Nothing counts the
   * entries and nothing counts the looks behind them.
   */
  genders?: GenderChoice[];
  /** The looks the buyer picks between. At least one. Order is the grid order. */
  looks: Look[];
  /**
   * Which page the chooser's tiles show. A page id; absent is `pages[0]`.
   *
   * **It has to be a page with a baby on it.** The research's instruction is
   * that the grid shows *the same pose in every tile*, so the choice reads as
   * which baby rather than which picture — and this codebase satisfies that by
   * construction, with every tile being the *same page* of the book drawn with
   * a different look. The catch is that this book's opening spread is
   * deliberately **babyless**: it is the one spread identical across every
   * look, which is what makes it the right place for the buyer's photograph
   * and dedication. Pointing the tiles at it would render one identical tile
   * per look under the question "which baby?".
   *
   * So the page is declared rather than inferred. `./validate.ts` refuses a
   * page id the book does not have **and** a page whose drawn scene is
   * babyless, because that is the mistake this field exists to make
   * impossible, and it is not one a reviewer would catch in a thumbnail.
   */
  tilePage?: string;
  /** The covers the buyer picks between. At least one. */
  covers: CoverChoice[];
  /**
   * Which layer of the cover page takes the chosen cover's colour.
   *
   * A layer id on `cover`. Absent means the cover choice changes nothing
   * visible, which `./validate.ts` reports — a choice with no consequence is
   * worse than no choice, because the buyer ticks it and believes something
   * happened.
   */
  coverTint?: { layerId: string };
  /** The cover. Separate from the interior, and never one of `pages`. */
  cover: BookPage;
  /** The interior, in reading order. `pages[0]` is `page-001.png`. */
  pages: BookPage[];
}

// ---------------------------------------------------------------------------
// The buyer's document
// ---------------------------------------------------------------------------

/**
 * One buyer's filling of a book: five values and nothing else.
 *
 * **There is no layout in here, because the buyer never does any.** The brief's
 * *"the buyer never positions, resizes or lays out anything; every slot is
 * fixed"* is not a UI decision that could be revisited in a component — it is
 * the absence of a field. A `PageFill` for a single page carries a `Crop`; this
 * does not, and `./derive.ts` has nothing to put one in.
 *
 * `lookId` sits beside the content rather than above it, which is the whole
 * point of § 3.1's *"the fill belongs to the listing, not to any one variant"*:
 * changing which baby the book has is changing one string, and the name, the
 * photograph and the dedication are untouched by construction.
 */
export interface BookFill {
  schema: 1;
  bookId: string;
  /** The exact book revision this fill was composed against. */
  bookRev: string;
  lookId: string;
  coverId: string;
  /** The baby's name, as the buyer typed it. `./name.ts` decides what may be. */
  name: string;
  /** The buyer's one photograph. Absent is an empty window. */
  photo?: PhotoFill;
  /** The dedication. `lib/editor/lines.ts` decides what fits. */
  dedication: string;
  /**
   * The line under the dedication — "Grandma", "Mum and Dad". Absent is none.
   *
   * **Its own field rather than the dedication's last line**, for the reason
   * `SLOT.from` gives: it is set differently and it is *optional*, and folding
   * the two together would leave the bar unable to say which of them is still
   * missing. Optional here means the field may be absent **and** may be the
   * empty string, and both mean the same thing — a dedication with no
   * signature is a complete dedication.
   */
  from?: string;
}
