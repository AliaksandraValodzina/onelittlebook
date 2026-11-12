/**
 * **The buyer flow, rendered and read: the look screen, the whole book, and no
 * wall.**
 *
 * `test/funnel.test.tsx` makes the argument for the single page and it is the
 * same one here — three claims are made about these screens that only a render
 * can check, and each costs real money if it is wrong:
 *
 * **There is no wall.** `kn-whole-book-preview` measured thirteen sellers and
 * this is the strongest single finding in the research: the narrative sellers
 * show every page, personalised, unwatermarked, with no account. It is the kind
 * of thing that gets quietly reintroduced by somebody adding "just an email
 * field", so it is asserted rather than remembered — every page of the book
 * reaches the markup, and none of the words a wall is built out of do.
 *
 * **The flow says where you are.** The captain approved a seven-screen flow —
 * `/Users/sasha/firstmate/.lavish/flow.html` — which replaced the single
 * *"Step 1 of 1"* form these tests were written against. The counter is derived
 * from the step list's own length by `lib/shop/steps.ts`, so a screen added to
 * that list renumbers every screen at once; this asserts the screen shows its
 * own position rather than a number somebody typed.
 *
 * **The controls are on the pages they affect, and found by asking the
 * template.** Nothing in a component writes down which page carries the
 * photograph, so these tests ask the template the same question the components
 * do — a test that hard-coded page two would be the second copy of the fact the
 * components are specifically built not to keep.
 *
 * Everything stateful is tested where it is pure, in `test/book-order.test.ts`.
 * These render at the state a visitor arrives in, which is what a server render
 * can see: `BookProvider` loads a stored order in an effect, and effects do not
 * run in `renderToStaticMarkup`. That is a real limit and it is the reason
 * `Confirm` takes props rather than reading context.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FIRST_BOOK } from "../templates/first-book";
import BookProvider from "../app/_book/BookProvider";
import LookScreen from "../app/_make/LookScreen";
import Preview from "../app/_book/Preview";
import Confirm from "../app/_book/Confirm";
import { EDITIONS, priceLabel } from "../lib/book/editions";
import { DEFAULT_MARKET } from "../lib/shop/market";
import { pageSequence, pageWithSlot, tileIndexOf } from "../lib/book/derive";
import { assetKey } from "../lib/assets/address";
import type { AssetRef } from "../lib/template/types";
import type { BookTemplate } from "../lib/book/types";
import { ASKS, SLOT } from "../lib/book/slots";
import { next, position, stepFor } from "../lib/shop/steps";
import { nameSlotFont } from "../lib/book/name";
import { FACES } from "../lib/render/fonts";

const book = FIRST_BOOK;

function inProvider(node: React.ReactElement) {
  return renderToStaticMarkup(
    <BookProvider book={book} market={DEFAULT_MARKET}>
      {node}
    </BookProvider>,
  );
}

/**
 * The screen with the gender question already answered.
 *
 * Answered by **removing the question** rather than by driving the control,
 * because effects do not run in `renderToStaticMarkup` and there is no DOM
 * here. A book with no genders shows every look, which is the same branch the
 * answered state takes.
 */
function answeredMarkup(): string {
  return renderToStaticMarkup(
    <BookProvider book={{ ...book, genders: [] }} market={DEFAULT_MARKET}>
      <LookScreen closeTo="/books/when-they-were-small" />
    </BookProvider>,
  );
}

/** Every `data-testid` in a string of markup, in order. */
function testIds(markup: string): string[] {
  return [...markup.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]);
}

/** The screen as a visitor with no order reaches it. */
const look = inProvider(<LookScreen closeTo="/books/when-they-were-small" />);
const preview = inProvider(<Preview />);

// ---------------------------------------------------------------------------

describe("the look screen — the one form that decides what is drawn", () => {
  it("names itself and says where it is in the flow", () => {
    expect(look).toContain(stepFor("look")!.title);
    // Counted from the list, never typed: the whole point of `position`.
    expect(look).toContain(position("look"));
  });

  it("asks the question before the grid, and shows no grid until it is answered", () => {
    // The captain's decision of 6 November, reversing the brief. A fresh order
    // has no answer, so there is nothing to choose a baby from yet.
    for (const gender of book.genders ?? []) {
      expect(testIds(look)).toContain(`gender-${gender.id}`);
    }
    expect(testIds(look)).not.toContain("look-grid");
    for (const one of book.looks) expect(testIds(look)).not.toContain(`look-${one.id}`);
  });

  it("shows every look of the answered gender once the question is answered", () => {
    // Rendered through the real filter rather than by constructing a list: how
    // many looks a gender has is data and nothing here counts them.
    const answered = answeredMarkup();
    const ids = testIds(answered);
    expect(ids).toContain("look-grid");
    for (const one of book.looks) expect(ids).toContain(`look-${one.id}`);
  });

  it("offers one control per look and no second axis beside it", () => {
    /**
     * The screen used to carry a *Skin tone* row under the tiles — one swatch
     * per look, in that look's own `baby.skin`. It could not compose a baby the
     * interior cannot draw, and it still read as though it could: a control
     * beside the grid reads as independent of the grid, as though the blonde
     * baby could be made deep brown. There are seven looks and each is a folder
     * of artwork, not seven skins times seven hairs.
     *
     * Asserted as an absence because that is the mistake worth guarding: this
     * is the kind of row somebody adds back as a kindness. The paired positive
     * is the test above — every look still has exactly one control.
     */
    const answered = answeredMarkup();
    const ids = testIds(answered);
    expect(ids).not.toContain("skin-row");
    for (const one of book.looks) expect(ids, one.id).not.toContain(`skin-${one.id}`);
    expect(answered).not.toContain("Skin tone");
    // One control per look, and it is the tile. A second control per look would
    // pass the three assertions above under any other name.
    expect(ids.filter((id) => /^look-(?!grid$)/.test(id))).toHaveLength(book.looks.length);
  });

  it("will not go on until there is a name and a baby", () => {
    expect(look).toContain("Name them, and pick a baby");
    // The way on is the next step in the list, and it is not a link yet.
    expect(look).not.toContain(`href="${next("look")!.path}"`);
  });

  it("draws each tile from the declared tile page, not from page one", () => {
    /**
     * The opening spread is babyless on purpose, so tiles drawn from it would
     * be one identical picture per look under the question "which baby?". The tile
     * page is declared and the validator refuses a babyless one; this is the
     * other half — that the grid actually draws *different babies*.
     */
    const tile = tileIndexOf(book);
    const page = pageSequence(book)[tile];
    expect(page.art.kind === "drawn" && page.art.scene.babyless).toBeFalsy();

    const answered = answeredMarkup();
    // Each look's baby is drawn in its own colours, so the tiles differ. The
    // control is that this would fail on a babyless page, where every tile is
    // the same string.
    const skins = new Set(book.looks.map((l) => l.baby!.skin));
    for (const skin of skins) expect(answered).toContain(skin);
  });
});

// ---------------------------------------------------------------------------
// The panel: the chosen look, as large as this machine can show it
// ---------------------------------------------------------------------------

/**
 * **The three states of the chooser's big picture, and all three are real.**
 *
 * `app/_book/tile.ts` § `lookPanel` prefers a page of the real book, then this
 * look's portrait, then the page drawn from numbers — and the last of those is
 * not a tidy-up for the unlikely case. It is a fresh clone, it is CI, and it is
 * every look the captain has not finished, so each state is rendered here
 * against a book put into it rather than against whatever this machine happens
 * to have imported. Nothing in these tests reads the artwork store: the
 * pictures are references with made-up digests, which is all a render needs,
 * and `test/release-artwork.test.ts` is where the binding itself is tested.
 */
describe("the panel beside the grid", () => {
  /** A picture that does not exist, named the way a real one would be. */
  function ref(label: string, px: [number, number]): AssetRef {
    return { sha256: label.padEnd(64, "0"), mime: "image/png", px, label };
  }

  /** The book with no gender question, which is how a static render answers it. */
  const asked = { ...book, genders: [] };
  /** The look a fresh order starts on — the panel's subject, never typed here. */
  const chosen = book.looks[0];

  /** The named pages of the book given delivered artwork for one look. */
  function delivered(
    lookId: string,
    pages: Record<string, AssetRef>,
  ): BookTemplate {
    const give = (page: typeof book.cover) =>
      pages[page.id]
        ? {
            ...page,
            art: {
              kind: "asset" as const,
              byLook: { [lookId]: pages[page.id] },
              scene: page.art.scene,
            },
          }
        : page;
    return { ...asked, cover: give(asked.cover), pages: asked.pages.map(give) };
  }

  /** The page id at an index of the sequence, which is how a page is named. */
  function idAt(index: number): string {
    return pageSequence(book)[index].id;
  }

  function panelOf(template: BookTemplate): { ids: string[]; markup: string } {
    const markup = renderToStaticMarkup(
      <BookProvider book={template} market={DEFAULT_MARKET}>
        <LookScreen closeTo="/books/when-they-were-small" />
      </BookProvider>,
    );
    return { ids: testIds(markup), markup };
  }

  it("shows a page of the real book when this look has one", () => {
    const tile = tileIndexOf(book);
    const art = ref("deliveredtilepage", [3600, 3600]);
    const { ids, markup } = panelOf(delivered(chosen.id, { [idAt(tile)]: art }));

    expect(ids).toContain("panel-page");
    // The tile page is preferred, so the panel and the pressed tile agree.
    expect(markup).toContain(`data-page="${tile}"`);
    expect(markup).toContain(assetKey(art));
    // The paired negative: the same screen, the same page, no artwork — the
    // picture is not in the markup and the panel says it is the placeholder.
    const without = panelOf(asked);
    expect(without.markup).not.toContain(assetKey(art));
    expect(without.ids).toContain("panel-drawn");
  });

  it("prefers that page to the portrait, because a page is what is being bought", () => {
    const art = ref("deliveredtilepage", [3600, 3600]);
    const portrait = ref("deliveredportrait", [1254, 1254]);
    const both = delivered(chosen.id, { [idAt(tileIndexOf(book))]: art });
    const { ids, markup } = panelOf({
      ...both,
      looks: both.looks.map((one) => (one.id === chosen.id ? { ...one, tile: portrait } : one)),
    });

    expect(ids).toContain("panel-page");
    expect(ids).not.toContain("panel-portrait");
    expect(markup).toContain(assetKey(art));
    // The portrait is still the look's *tile*, which is the grid and not the
    // panel — so it is in the markup, and the panel is not it.
    expect(markup).toContain(assetKey(portrait));
  });

  it("shows another delivered page when the tile page is not one", () => {
    // A partial import is a legitimate state and it does not arrive in page
    // order. The page is found, not counted: whichever one has artwork.
    const tile = tileIndexOf(book);
    const other = pageSequence(book).findIndex(
      (page, index) => index !== tile && index !== 0,
    );
    const art = ref("deliveredotherpage", [3600, 3600]);
    const { ids, markup } = panelOf(delivered(chosen.id, { [idAt(other)]: art }));

    expect(ids).toContain("panel-page");
    expect(markup).toContain(`data-page="${other}"`);
    expect(markup).not.toContain(`data-page="${tile}"`);
    expect(markup).toContain(assetKey(art));
  });

  it("leaves a delivered cover last, because a cover says which book and not which baby", () => {
    const tile = tileIndexOf(book);
    const inside = pageSequence(book).findIndex((_, index) => index !== tile && index !== 0);
    const coverArt = ref("deliveredcover", [3600, 3600]);
    const insideArt = ref("deliveredinside", [3600, 3600]);
    const { ids, markup } = panelOf(
      delivered(chosen.id, { [idAt(0)]: coverArt, [idAt(inside)]: insideArt }),
    );

    expect(ids).toContain("panel-page");
    expect(markup).toContain(`data-page="${inside}"`);
    expect(markup).toContain(assetKey(insideArt));
    expect(markup).not.toContain(`data-page="0"`);
  });

  it("shows the tile page when every page is delivered, so the panel and the tile agree", () => {
    // The preference, with something for it to prefer: a complete import, where
    // picking the first page in reading order would be a different page.
    const tile = tileIndexOf(book);
    const tileArt = ref("deliveredtilepage", [3600, 3600]);
    const everyPage = Object.fromEntries(
      pageSequence(book).map((page, index) => [
        page.id,
        index === tile ? tileArt : ref(`delivered${index}`, [3600, 3600]),
      ]),
    );

    const { ids, markup } = panelOf(delivered(chosen.id, everyPage));
    expect(ids).toContain("panel-page");
    expect(markup).toContain(`data-page="${tile}"`);
    expect(markup).toContain(assetKey(tileArt));
    // One page in the panel, and it is that one.
    expect([...markup.matchAll(/data-page="(\d+)"/g)].map((m) => Number(m[1]))).toEqual([tile]);
  });

  it("shows this look's portrait, large, when there are no pages for it", () => {
    const portrait = ref("deliveredportrait", [1254, 1254]);
    const { ids, markup } = panelOf({
      ...asked,
      looks: asked.looks.map((one) => (one.id === chosen.id ? { ...one, tile: portrait } : one)),
    });

    expect(ids).toContain("panel-portrait");
    expect(markup).toContain(assetKey(portrait));
    // Large: it is the panel's own picture and not a page with a baby in it,
    // so there is no page drawn in the panel at all.
    expect(markup).not.toContain(`data-page="${tileIndexOf(book)}"`);
    // And the paired negative, which is the only thing that makes the line
    // above mean "the portrait is the panel" rather than "nothing is".
    expect(panelOf(asked).markup).not.toContain(assetKey(portrait));
  });

  it("falls back to the page drawn from numbers, which is what a clone shows", () => {
    // `book` is what is committed: no page artwork and no portrait anywhere.
    // This is therefore the state CI and every fresh clone render in, and the
    // panel has to be a real picture of the chosen baby in it.
    const { ids, markup } = panelOf(asked);
    expect(ids).toContain("panel-drawn");
    expect(markup).toContain(`data-page="${tileIndexOf(book)}"`);
    // Drawn, and drawn as *this* look: the chosen baby's own skin is in the
    // panel's page. The paired negative is another look's, which is not.
    const page = new RegExp(`data-page="${tileIndexOf(book)}"[\\s\\S]*?</div>`);
    const inPanel = markup.match(page)![0];
    expect(inPanel).toContain(chosen.baby!.skin);
    const another = book.looks.find((one) => one.baby!.skin !== chosen.baby!.skin)!;
    expect(inPanel).not.toContain(another.baby!.skin);
  });
});

// ---------------------------------------------------------------------------

describe("straight into the whole book, with nothing in front of it", () => {
  it("renders every page of the book", () => {
    const pages = [...preview.matchAll(/data-page="(\d+)"/g)].map((m) => Number(m[1]));
    expect(new Set(pages).size).toBe(pageSequence(book).length);
    expect(preview).toContain(`All ${pageSequence(book).length} pages`);
  });

  it("has no watermark, no account and no email wall", () => {
    /**
     * The strongest single finding in the research, asserted rather than
     * remembered — this is the kind of thing somebody reintroduces by adding
     * "just an email field".
     *
     * Two assertions, because either alone is weak. The **words** a wall is
     * built out of must not appear; and the **mechanisms** must not either,
     * since a wall with friendlier copy is still a wall.
     */
    const lower = preview.toLowerCase();
    for (const word of [
      "sign in",
      "sign up",
      "log in",
      "create an account",
      "enter your email",
      "unlock",
      "preview only",
      "to see the rest",
    ]) {
      expect(lower, word).not.toContain(word);
    }
    expect(preview).not.toMatch(/type="(email|password)"/);
    expect(preview).toContain("No watermark, no account");

    // The only mention of a watermark anywhere is the promise that there is
    // not one — and the pages themselves carry no overlay text.
    expect(lower.split("watermark").length - 1).toBe(1);
  });

  it("offers one page or two, and two is the default", () => {
    expect(testIds(preview)).toContain("one-page");
    expect(testIds(preview)).toContain("two-page");
    // Attribute order is React's business, so the assertion does not depend on it.
    const two = /<button[^>]*data-testid="two-page"[^>]*>/.exec(preview)?.[0] ?? "";
    const one = /<button[^>]*data-testid="one-page"[^>]*>/.exec(preview)?.[0] ?? "";
    expect(two).toContain('aria-pressed="true"');
    expect(one).toContain('aria-pressed="false"');
  });
});

// ---------------------------------------------------------------------------

describe("the extras sit on the page they affect", () => {
  it("puts one panel on the dedication spread, holding the words and the photograph", () => {
    const ids = testIds(preview);
    expect(ids.filter((id) => id === "dedication-control")).toHaveLength(1);
    // One control, not two: the captain chose Wonderbly's shape, where the
    // dedication and the photograph open together.
    expect(preview).toContain("Personalise your dedication");
    expect(ids).toContain("photo-input");
    expect(ids).toContain("from");
    expect(preview).toContain("Upload a photo");
    expect(preview).toContain("Choose the highest quality one you have");
  });

  it("offers crop and delete only once there is a photograph to crop", () => {
    const ids = testIds(preview);
    expect(ids).not.toContain("crop-photo");
    expect(ids).not.toContain("remove-photo");
  });

  it("shows the dedication's hard limit as a live count", () => {
    const slot = book.cover.layers && pageWithSlot(book, SLOT.dedication);
    expect(slot).toBeGreaterThan(0);
    expect(testIds(preview)).toContain("dedication-count");
    expect(preview).toContain("of 10 lines");
    expect(preview).toContain("of 300 characters");
    // And the warning the research says to copy exactly.
    expect(preview).toContain("Read it back there before you order");
  });

  it("offers the hardcover upgrade exactly once, after the dedication", () => {
    const ids = testIds(preview);
    expect(ids.filter((id) => id === "upgrade-control")).toHaveLength(1);
    // After the dedication and before the bar, which is MyStoryTale's placement
    // and the one thing worth taking from them.
    expect(ids.indexOf("upgrade-control")).toBeGreaterThan(ids.indexOf("dedication-control"));
    expect(ids.indexOf("upgrade-control")).toBeLessThan(ids.indexOf("continue"));
    for (const edition of EDITIONS) {
      expect(preview).toContain(priceLabel(edition, DEFAULT_MARKET));
    }
  });

  it("states one real price with no theatre around it", () => {
    // Under Australian Consumer Law a "was/now" where the higher price was never
    // genuinely charged is a misleading representation about price. There is
    // nowhere in the type to put one, and nothing on the page shows one.
    expect(preview).not.toMatch(/<s>|line-through|was AUD|RRP|% off|ends in/i);
  });
});

// ---------------------------------------------------------------------------

describe("the persistent bar", () => {
  it("ticks every ask and marks the optional ones as optional", () => {
    const ids = testIds(preview);
    for (const ask of ASKS) expect(ids).toContain(`ask-${ask.id}`);
    for (const ask of ASKS.filter((a) => !a.required)) {
      const li = new RegExp(`<li[^>]*data-testid="ask-${ask.id}"[^>]*>`).exec(preview)?.[0] ?? "";
      expect(li, ask.id).toContain('data-required="no"');
    }
    // Nothing is done in a fresh order, and the bar says what is outstanding
    // rather than failing silently.
    expect(preview).toContain("Still to do:");
    expect(preview).toContain("Finish the book first");
  });

  it("carries the cover colourways, because a cover is a property of the object", () => {
    for (const cover of book.covers) {
      expect(testIds(preview)).toContain(`cover-${cover.id}`);
      expect(preview).toContain(cover.colour);
    }
    // And the colourways are in the bar rather than in a panel under the cover
    // spread, which is the captain's decision.
    const ids = testIds(preview);
    expect(ids.indexOf(`cover-${book.covers[0].id}`)).toBeGreaterThan(ids.indexOf("ask-name"));
  });
});

// ---------------------------------------------------------------------------

describe("confirm the spelling, which is where typos die", () => {
  const edition = EDITIONS[0];
  const markup = (name: string) =>
    renderToStaticMarkup(
      <Confirm
        name={name}
        face={FACES[nameSlotFont(book)]?.family}
        edition={edition}
        market={DEFAULT_MARKET}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    );

  it("shows the name large and alone, in the face it will print in", () => {
    const out = markup("Rosalind");
    expect(out).toContain("This is how it will be printed");
    // Alone in its own element: nothing else is in the node the eye goes to.
    const node = /data-testid="confirm-name"[^>]*>([^<]*)</.exec(out);
    expect(node?.[1]).toBe("Rosalind");
    // In the cover's own face, so the letterforms approved are the ones printed.
    expect(out).toContain(FACES[nameSlotFont(book)].family);
  });

  it("makes them click past it, with one button and a way back", () => {
    const out = markup("Rosalind");
    expect(testIds(out)).toContain("confirm-yes");
    // And a way back, so this is a check and not a trap.
    expect(testIds(out)).toContain("confirm-back");
    expect(out).toContain("Let me change it");
  });

  it("has exactly one way on, so an order cannot be sent from two places", () => {
    // `./Bar.tsx` owns the request now. Two submit buttons for one order is
    // two places for the order to be sent from, which is the thing the single
    // `onConfirm` is here to prevent.
    const out = markup("Rosalind");
    expect(out.match(/data-testid="confirm-yes"/g)?.length).toBe(1);
    expect(out).not.toContain("<form");
  });

  it("never reads as a confirmation of an order", () => {
    const out = markup("Rosalind").toLowerCase();
    for (const word of ["thank you", "order confirmed", "payment received", "we have received"]) {
      expect(out, word).not.toContain(word);
    }
    // It says where the card is typed, which is the honest thing this screen
    // can say about money: not here.
    expect(out).toContain("never sees it");
  });
});
