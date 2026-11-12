/**
 * **The buyer's order: the from-line, the crop, the edition, and what counts as
 * finished.**
 *
 * `lib/book/order.ts` is where the five things a buyer supplies become the one
 * document the renderer and the till both read, and every test here is about a
 * decision that is invisible until it is wrong in a printed book or in a price.
 *
 * Three of them are worth naming:
 *
 * **Optional means optional.** `ASKS` marks which asks are required and
 * `isComplete` reads that same table. The photograph and the from-line are
 * ticks, not gates — a parent with no photograph they are happy with still gets
 * the book. The failure this closes is a `Continue` that will not go with no
 * explanation anybody can act on, which `BuyButton`'s docblock already records
 * as the commonest way a checkout loses a sale that was already made.
 *
 * **An untouched photograph writes no crop at all.** Not a full-rectangle crop
 * that happens to mean the same thing — *no field*. `orderFingerprint` is a
 * hash of the fill, so writing one would rename every order's print file and
 * make a reprint of an older order a different document from the first.
 *
 * **Reading is sanitising.** A stored order can come from last week's build, a
 * retired look or a hand-edited devtools session, and `lib/render/svg.ts`
 * throws on a fill that overflows. Everything that comes back out of storage
 * goes through the same acceptors the form applies, so the renderer's refusal
 * stays a genuine backstop rather than a crash waiting behind a tampered key.
 */

import { describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { PORTRAIT } from "../fixtures/order";
import {
  answerGender,
  done,
  dedicationOf,
  dedicationSlot,
  defaultDedication,
  emptyOrder,
  fromSlot,
  isComplete,
  outstanding,
  readOrder,
  toBookFill,
  type Order,
} from "../lib/book/order";
import { ASKS, SLOT } from "../lib/book/slots";
import { DEFAULT_EDITION, EDITIONS, differenceOf, editionOf, upgradeFrom } from "../lib/book/editions";
import { MARKETS } from "../lib/shop/market";
import { photoSlotOf, pageFillFor, pageWithSlot } from "../lib/book/derive";
import { validateBookFill } from "../lib/book/validate";
import { blockingProblems } from "../lib/template/validate";
import { cropFor, DEFAULT_VIEW } from "../lib/editor/view";

/** An order with everything required supplied, so the optional bits can be isolated. */
function finished(): Order {
  return {
    ...emptyOrder(FIRST_BOOK),
    genderId: "boy",
    lookId: "boy-01",
    coverId: "sage",
    name: "Rosalind",
    // A buyer who wrote their own, which is what `dedicationWritten` means —
    // the book pre-fills the box, so "a dedication" and "the buyer's
    // dedication" are two different states and this is the second one.
    dedication: "For Rosalind.",
    dedicationWritten: true,
  };
}

const natural = { width: PORTRAIT.px[0], height: PORTRAIT.px[1] };

// ---------------------------------------------------------------------------

describe("the from-line: optional, one line, its own role", () => {
  it("is a slot the book carries, set in a different face from the dedication", () => {
    const signature = fromSlot(FIRST_BOOK)!;
    const dedication = dedicationSlot(FIRST_BOOK)!;
    expect(signature).toBeTruthy();
    // Not decoration: it is what makes the line read as a signature rather than
    // as the dedication's eleventh line.
    expect(signature.font).not.toBe(dedication.font);
    expect(signature.maxLines).toBe(1);
  });

  it("sits on the same page as the dedication, so one panel can offer both", () => {
    expect(pageWithSlot(FIRST_BOOK, SLOT.from)).toBe(pageWithSlot(FIRST_BOOK, SLOT.dedication));
    expect(pageWithSlot(FIRST_BOOK, SLOT.photo)).toBe(pageWithSlot(FIRST_BOOK, SLOT.dedication));
  });

  it("reaches the page it is on, and no other page", () => {
    const page = pageWithSlot(FIRST_BOOK, SLOT.from);
    expect(pageFillFor(FIRST_BOOK, page, FIXTURE_BOOK_FILL).texts[SLOT.from]).toBe(
      FIXTURE_BOOK_FILL.from,
    );
    // The control: a different page carries no from-line, so the assertion
    // above is about this page and not about every page getting every field.
    expect(pageFillFor(FIRST_BOOK, 0, FIXTURE_BOOK_FILL).texts[SLOT.from]).toBeUndefined();
  });

  it("is clamped to one line, however many the buyer presses Return for", () => {
    const order = { ...finished(), from: "Grandma\nand\nGrandpa" };
    const fill = toBookFill(order, FIRST_BOOK);
    expect(fill.from).not.toContain("\n");
    // And what comes out is printable, which is the contract every acceptor in
    // this codebase is held to.
    expect(blockingProblems(validateBookFill(FIRST_BOOK, fill))).toEqual([]);
  });

  it("never blocks Continue, and neither does the photograph", () => {
    const order = finished();
    expect(order.from).toBe("");
    expect(order.photo).toBeUndefined();
    expect(isComplete(order, FIRST_BOOK)).toBe(true);
    expect(outstanding(order, FIRST_BOOK)).toEqual([]);

    // The ticks still report them honestly rather than ticking them silently.
    expect(done(order, FIRST_BOOK).from).toBe(false);
    expect(done(order, FIRST_BOOK).photo).toBe(false);
    expect(done({ ...order, from: "Grandma" }, FIRST_BOOK).from).toBe(true);
  });

  it("would notice if a required ask stopped blocking, so the check is not vacuous", () => {
    for (const ask of ASKS.filter((a) => a.required)) {
      // Every required ask, knocked out one at a time.
      const broken: Record<string, Partial<Order>> = {
        name: { name: "" },
        look: { genderId: null },
        cover: { coverId: "chartreuse" },
        // Cleared **by the buyer**, which is the only way the box is empty:
        // an untouched one holds the book's own verse.
        dedication: { dedication: "", dedicationWritten: true },
      };
      expect(isComplete({ ...finished(), ...broken[ask.id] }, FIRST_BOOK), ask.id).toBe(false);
      expect(outstanding({ ...finished(), ...broken[ask.id] }, FIRST_BOOK)).toContain(
        ask.label.toLowerCase(),
      );
    }
  });
});

// ---------------------------------------------------------------------------

describe("crop: the one thing the buyer may move", () => {
  const slot = photoSlotOf(FIRST_BOOK)!;

  it("writes no crop at all when the photograph was never touched", () => {
    const order: Order = {
      ...finished(),
      photo: { asset: PORTRAIT, dataUrl: "data:image/png;base64,AA==", view: DEFAULT_VIEW },
    };
    const fill = toBookFill(order, FIRST_BOOK);
    // Not a full-rectangle crop that means the same thing — no field, so the
    // fill is byte-identical to one written before cropping existed.
    expect(fill.photo?.crop).toBeUndefined();
    expect(Object.keys(fill.photo!)).toEqual(["asset"]);
  });

  it("writes the crop `cropFor` produces, at the window's own aspect ratio", () => {
    const view = { zoom: 2, cx: 0.4, cy: 0.6 };
    const order: Order = {
      ...finished(),
      photo: { asset: PORTRAIT, dataUrl: "data:image/png;base64,AA==", view },
    };
    const crop = toBookFill(order, FIRST_BOOK).photo?.crop;
    expect(crop).toEqual(cropFor(view, slot.frame, natural));

    /**
     * The shape, which is the rule `CLAUDE.md` names as the one that bites:
     * `placePhoto` covers a mismatched crop by scaling on the larger axis, so a
     * crop of the wrong ratio puts part of what the buyer framed outside the
     * window. Measured in source pixels, the crop has to be the window's ratio.
     */
    const ratio = (crop!.width * natural.width) / (crop!.height * natural.height);
    expect(ratio).toBeCloseTo(slot.frame.width / slot.frame.height, 6);
  });

  it("survives a hand-edited view rather than producing a crop with no area", () => {
    const order = {
      ...finished(),
      photo: {
        asset: PORTRAIT,
        dataUrl: "data:image/png;base64,AA==",
        view: { zoom: 1e6, cx: NaN, cy: -40 },
      },
    } as unknown as Order;
    const fill = toBookFill(order, FIRST_BOOK);
    const crop = fill.photo!.crop!;
    expect(crop.width).toBeGreaterThan(0);
    expect(crop.height).toBeGreaterThan(0);
    expect(blockingProblems(validateBookFill(FIRST_BOOK, fill))).toEqual([]);
  });

  it("is read back out of storage through the same clamp", () => {
    const stored = {
      ...finished(),
      photo: {
        asset: PORTRAIT,
        dataUrl: "data:image/png;base64,QUJD",
        view: { zoom: 99, cx: 5, cy: -5 },
      },
    };
    const view = readOrder(JSON.parse(JSON.stringify(stored)), FIRST_BOOK).photo!.view;
    expect(view.zoom).toBeLessThanOrEqual(2.5);
    expect(view.cx).toBeGreaterThanOrEqual(0);
    expect(view.cx).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------

describe("the edition, which is a price and never a drawing", () => {
  it("starts as the listed one, so an upgrade nobody was offered is not selected", () => {
    expect(emptyOrder(FIRST_BOOK).editionId).toBe(DEFAULT_EDITION);
    expect(editionOf(DEFAULT_EDITION).id).toBe(EDITIONS[0].id);
    expect(upgradeFrom(DEFAULT_EDITION)?.id).toBe("hardcover");
    expect(upgradeFrom("hardcover")).toBeNull();
  });

  it("is not in the fill, so changing a price cannot restamp the book", () => {
    const fill = toBookFill({ ...finished(), editionId: "hardcover" }, FIRST_BOOK);
    expect(JSON.stringify(fill)).not.toContain("hardcover");
    // Both editions produce the identical document, which is the same print
    // file — one artwork set serves both products.
    expect(fill).toEqual(toBookFill({ ...finished(), editionId: "softcover" }, FIRST_BOOK));
  });

  it("falls back to the listed edition rather than guessing at a retired one", () => {
    const stored = { ...finished(), editionId: "leatherbound" };
    expect(readOrder(JSON.parse(JSON.stringify(stored)), FIRST_BOOK).editionId).toBe(
      DEFAULT_EDITION,
    );
  });

  it("states a real difference and never a struck-out total", () => {
    const [base, up] = EDITIONS;
    expect(differenceOf(base, up, MARKETS.au)).toBe("AUD 10");
    // The difference is stated in the market being shown and is never the same
    // arithmetic twice: USD 59 − USD 49 is not AUD 69 − AUD 59 converted.
    expect(differenceOf(base, up, MARKETS.us)).toBe("USD 10");
    expect(differenceOf(base, up, MARKETS.gb)).toBe("GBP 6");
    // Nothing in the type can express a "was" price, a percentage or an expiry,
    // which is the register the captain settled and the law the page sits under.
    expect(JSON.stringify(EDITIONS)).not.toMatch(/was|discount|rrp|expires|until/i);
  });
});

// ---------------------------------------------------------------------------

describe("answering the question before the grid", () => {
  it("moves the look when the answer no longer contains it", () => {
    const order = { ...finished(), genderId: "boy", lookId: "boy-01" };
    const moved = answerGender(order, FIRST_BOOK, "girl");
    expect(moved.genderId).toBe("girl");
    expect(FIRST_BOOK.looks.find((l) => l.id === moved.lookId)?.gender).toBe("girl");
    // And nothing the buyer wrote is touched, which is why switching cannot
    // lose their work.
    expect(moved.name).toBe(order.name);
    expect(moved.dedication).toBe(order.dedication);
  });
});

// ---------------------------------------------------------------------------

/**
 * **The pre-filled dedication, and the two states a box can be in.**
 *
 * The book offers the captain's verse as the dedication's starting text. The
 * captain's decision is that it must be *text* and not a watermark: editable,
 * clearable, and gone for good once the buyer has had a go at it. That is three
 * behaviours and exactly one of them is easy to get wrong — a default applied
 * whenever the box is empty refills itself the instant somebody clears it,
 * which is the version a buyer cannot delete and would have to work around.
 */
describe("the dedication the buyer is given to start with", () => {
  const started = (): Order => ({ ...emptyOrder(FIRST_BOOK), name: "Rosalind" });

  it("is the book's own verse, with their name in it, before they type anything", () => {
    const order = started();
    expect(order.dedicationWritten).toBe(false);
    expect(order.dedication).toBe("");
    // What the box shows and what the page prints are the same string.
    expect(dedicationOf(order, FIRST_BOOK)).toBe(defaultDedication(FIRST_BOOK, "Rosalind"));
    expect(toBookFill(order, FIRST_BOOK).dedication).toContain("Rosalind");
    // And it counts as done, which is the whole point: a buyer who writes
    // nothing still gets a finished page.
    expect(done(order, FIRST_BOOK).dedication).toBe(true);
  });

  it("follows the name while it is still the book's words, and stops when it is theirs", () => {
    const order = started();
    expect(dedicationOf({ ...order, name: "Ida" }, FIRST_BOOK)).toContain("Ida");
    // Once written it is theirs verbatim, name changes and all — rewriting a
    // buyer's own sentence because they corrected a spelling would be the
    // worst kind of helpful.
    const theirs = { ...order, dedication: "For Rosalind.", dedicationWritten: true };
    expect(dedicationOf({ ...theirs, name: "Ida" }, FIRST_BOOK)).toBe("For Rosalind.");
  });

  it("stays cleared once cleared, which is what tells it from a placeholder", () => {
    const cleared: Order = { ...started(), dedication: "", dedicationWritten: true };
    expect(dedicationOf(cleared, FIRST_BOOK)).toBe("");
    expect(toBookFill(cleared, FIRST_BOOK).dedication).toBe("");
    // An empty required field blocks Continue exactly as it always has — the
    // buyer is told, rather than having the book quietly write for them.
    expect(done(cleared, FIRST_BOOK).dedication).toBe(false);
    expect(isComplete({ ...finished(), ...cleared }, FIRST_BOOK)).toBe(false);

    // And it survives the round trip through storage, which is where a flag
    // like this is actually load-bearing.
    const back = readOrder(JSON.parse(JSON.stringify(cleared)), FIRST_BOOK);
    expect(back.dedicationWritten).toBe(true);
    expect(dedicationOf(back, FIRST_BOOK)).toBe("");
  });

  it("does not offer itself before there is a name to put in it", () => {
    // "Dear {name}," is a brace token in the buyer's own words. The flow asks
    // for the name two screens earlier, so this is the state of a box nobody
    // has reached yet rather than one anybody sees.
    const nameless = emptyOrder(FIRST_BOOK);
    expect(dedicationOf(nameless, FIRST_BOOK)).toBe("");
    expect(dedicationOf(nameless, FIRST_BOOK)).not.toContain("{name}");
  });

  it("keeps a dedication written before the default existed", () => {
    // A stored order from before this field has no `dedicationWritten`, and
    // treating it as unwritten would replace somebody's own words with the
    // book's.
    const old = { ...started(), dedication: "For Rosalind, from us both." };
    delete (old as Partial<Order>).dedicationWritten;
    const back = readOrder(JSON.parse(JSON.stringify(old)), FIRST_BOOK);
    expect(back.dedicationWritten).toBe(true);
    expect(dedicationOf(back, FIRST_BOOK)).toBe("For Rosalind, from us both.");
  });

  it("is a book-level fact, so a book without one starts empty", () => {
    const plain = { ...FIRST_BOOK, dedicationDefault: undefined };
    expect(defaultDedication(plain, "Rosalind")).toBe("");
    expect(dedicationOf(started(), plain)).toBe("");
    // Paired: the real book does have one, so the assertion above is about the
    // field being absent rather than about the function never returning words.
    expect(defaultDedication(FIRST_BOOK, "Rosalind")).not.toBe("");
  });

  it("what it pre-fills is printable, which is the contract every acceptor is held to", () => {
    const order = started();
    const fill = toBookFill({ ...finished(), ...order }, FIRST_BOOK);
    expect(blockingProblems(validateBookFill(FIRST_BOOK, fill))).toEqual([]);
  });
});
