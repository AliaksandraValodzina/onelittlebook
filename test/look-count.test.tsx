/**
 * **Nothing counts the looks.**
 *
 * The book declares a list of looks and every surface renders *that list*. How
 * many there are is the captain's to change and has already changed once — six
 * per gender until 12 November, seven per gender since — so the property worth
 * holding is not "there are fourteen" but **"nobody anywhere has written the
 * number down"**. Delivering five or eight has to stay an upload rather than a
 * release.
 *
 * That is a property no single assertion can state, so this is three:
 *
 * **The chooser renders the list it is given.** Not `FIRST_BOOK`'s list —
 * books built with a deliberately different number of looks, which is the only
 * way to tell a component that counts from one that reads. A grid that said
 * seven would pass against the real book forever.
 *
 * **`validateBook` has no opinion about the count.** One look per gender and
 * nine both validate clean. The floor is one — an empty grid is a dead end a
 * buyer reaches by answering a question honestly — and there is no ceiling.
 *
 * **No copy string names a number the grid does not show.** This is the one
 * that actually went wrong: the landing page said *"Twelve to choose from"* in
 * a typed string, which was a sentence the grid contradicted the moment the
 * count moved. `lib/shop/copy.ts` § `BABIES` counts it off the book now, and
 * the check below walks every string the shop can say in every market and
 * insists that any number standing in front of the word *babies* is that one.
 *
 * And because the ids are the other half of the same decision — `girl-03` is
 * `03-girl.png`, derived and not tabulated — the shape of the list is asserted
 * here too: the id of every look is its gender and its own position, so the
 * portrait importer needs no mapping anybody maintains.
 *
 * `test/release-artwork.test.ts` § the portraits holds the import end of it:
 * `npm run artwork -- portraits` accepting exactly the folder the book implies.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../app/page";
import BookPageRoute from "../app/books/[slug]/page";
import BookProvider from "../app/_book/BookProvider";
import MakeScreen from "../app/_make/MakeScreen";
import { FIRST_BOOK } from "../templates/first-book";
import { validateBook } from "../lib/book/validate";
import { looksFor } from "../lib/book/derive";
import { WHEN_THEY_WERE_SMALL, pathOf } from "../lib/shop/shelf";
import { DEFAULT_MARKET, MARKET_LIST, type Market } from "../lib/shop/market";
import * as COPY from "../lib/shop/copy";
import type { BookTemplate, Look } from "../lib/book/types";

const closeTo = pathOf(WHEN_THEY_WERE_SMALL);

/**
 * The same book with a different number of looks, and no gender question.
 *
 * The question is dropped so the grid is the whole list and a server render can
 * see it: gender is answered by a click and `renderToStaticMarkup` runs no
 * effects and no handlers. What the grid does *with* an answer is
 * `test/book-format.test.ts` § `looksFor`.
 */
function bookWithLooks(howMany: number): BookTemplate {
  const looks: Look[] = Array.from({ length: howMany }, (_, at) => ({
    id: `look-${String(at + 1).padStart(2, "0")}`,
    label: `Look ${at + 1}`,
    baby: { skin: "#E8B48C", hair: "#6B4A33", cloth: "#E8A0A8", seed: 100 + at },
  }));
  return { ...FIRST_BOOK, genders: [], looks };
}

function lookScreen(book: BookTemplate): string {
  return renderToStaticMarkup(
    <BookProvider book={book} market={DEFAULT_MARKET}>
      <MakeScreen id={"look" as never} closeTo={closeTo} />
    </BookProvider>,
  );
}

function testIds(markup: string): string[] {
  return [...markup.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------------------

describe("the chooser renders the list it is given", () => {
  // Deliberately not fourteen, and on both sides of it: a grid that counted
  // would pass against the real book and fail here.
  for (const howMany of [1, 5, 9, 20]) {
    it(`offers exactly ${howMany} tile(s) and ${howMany} swatch(es) for a book of ${howMany} looks`, () => {
      const book = bookWithLooks(howMany);
      const ids = testIds(lookScreen(book));
      // `skin-row` is the row itself and `look-grid` is the grid itself; every
      // other `skin-…` and `look-…` is one look.
      expect(ids.filter((id) => /^skin-(?!row$)/.test(id))).toHaveLength(howMany);
      expect(ids.filter((id) => /^look-(?!grid$)/.test(id))).toHaveLength(howMany);
      for (const look of book.looks) expect(ids, look.id).toContain(`look-${look.id}`);
    });
  }

  it("and `looksFor` is the only thing that narrows it, by the answer and not by a number", () => {
    const grids = (FIRST_BOOK.genders ?? []).map((g) => looksFor(FIRST_BOOK, g.id));
    // Every look is in exactly one grid, and the grids together are the list.
    expect(grids.flat().map((l) => l.id).sort()).toEqual(
      FIRST_BOOK.looks.map((l) => l.id).sort(),
    );
    for (const grid of grids) expect(grid.length).toBeGreaterThan(0);
  });
});

describe("the format has no opinion about how many there are", () => {
  for (const howMany of [1, 5, 9, 20]) {
    it(`validates a book of ${howMany} looks`, () => {
      expect(validateBook(bookWithLooks(howMany))).toEqual([]);
    });
  }

  it("but still refuses none, because an empty grid is a dead end", () => {
    expect(validateBook({ ...FIRST_BOOK, genders: [], looks: [] }).map((p) => p.code)).toContain(
      "looks.empty",
    );
  });
});

// ---------------------------------------------------------------------------

describe("the ids are the captain's portrait numbering and nothing else", () => {
  it("spells every id as its gender and its own position in that gender", () => {
    for (const gender of FIRST_BOOK.genders ?? []) {
      const looks = FIRST_BOOK.looks.filter((l) => l.gender === gender.id);
      expect(looks.map((l) => l.id)).toEqual(
        looks.map((_, at) => `${gender.id}-${String(at + 1).padStart(2, "0")}`),
      );
    }
    // No look sits outside a gender's grid, which is what would make the
    // numbering above a partial statement about the list.
    expect(FIRST_BOOK.looks.filter((l) => !l.gender)).toEqual([]);
  });

  it("gives every look a placeholder baby, which is what a fresh clone draws", () => {
    for (const look of FIRST_BOOK.looks) {
      expect(look.baby, look.id).toBeDefined();
      for (const colour of [look.baby!.skin, look.baby!.hair, look.baby!.cloth]) {
        expect(colour, look.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
    // And no two looks are the same baby, or the grid is a row of twins.
    const babies = FIRST_BOOK.looks.map((l) => JSON.stringify(l.baby));
    expect(new Set(babies).size).toBe(FIRST_BOOK.looks.length);
  });
});

// ---------------------------------------------------------------------------
// The copy
// ---------------------------------------------------------------------------

/** Every string `lib/shop/copy.ts` can produce, in every market. */
function everyString(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) everyString(item, out);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) everyString(item, out);
  }
  return out;
}

const COPY_FUNCTIONS = (Object.values(COPY) as unknown[]).filter(
  (value): value is (market: Market) => unknown =>
    typeof value === "function" && value.length === 1,
);

const SAYABLE = [
  ...everyString(COPY),
  ...MARKET_LIST.flatMap((market) => COPY_FUNCTIONS.flatMap((fn) => everyString(fn(market)))),
  // The pages themselves, because a count can be typed into a component as
  // easily as into the copy module — and one was.
  text(renderToStaticMarkup(await Home())),
  text(
    renderToStaticMarkup(
      await BookPageRoute({ params: Promise.resolve({ slug: WHEN_THEY_WERE_SMALL.slug }) }),
    ),
  ),
  text(lookScreen(FIRST_BOOK)),
];

function text(markup: string): string {
  return markup.replace(/<[^>]*>/g, " ");
}

const NUMBER =
  "\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|" +
  "fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|dozen";

/** `7 babies`, `twelve to choose from` — a number standing in for the grid. */
const COUNTS_THE_LOOKS = new RegExp(
  `\\b(${NUMBER})\\b[^.!?]{0,24}?\\b(babies|to choose from)\\b`,
  "gi",
);

/** The same pattern without `g`, because `RegExp.test` on a global is stateful. */
const COUNTS_ONE = new RegExp(COUNTS_THE_LOOKS.source, "i");

describe("no string the shop can say counts the looks itself", () => {
  it("quotes the grid's own number or no number at all", () => {
    const expected = COPY.BABIES === null ? null : String(COPY.BABIES);
    const wrong: string[] = [];
    for (const line of SAYABLE) {
      for (const match of line.matchAll(COUNTS_THE_LOOKS)) {
        if (match[1].toLowerCase() !== expected) wrong.push(`${match[0].trim()}  —  in: ${line}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("and the control: the number the grid does show is said somewhere", () => {
    // Without this the assertion above would pass on a shop that had quietly
    // stopped saying how many babies there are — which is a real selling point
    // and the reason the sentence exists at all.
    const grid = looksFor(FIRST_BOOK, (FIRST_BOOK.genders ?? [])[0]?.id);
    expect(COPY.BABIES).toBe(grid.length);
    expect(SAYABLE.some((line) => COUNTS_ONE.test(line))).toBe(true);
  });
});
