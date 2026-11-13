/**
 * **Reading the catalogue: all at once, in the book's own order, and not on
 * every request.**
 *
 * `lib/artwork/release.ts` § `releaseArtworkFor` asked the store for one look
 * at a time, in a loop with an `await` in it, and `app/make/layout.tsx` calls
 * it on the front of every screen of the buyer flow. Over a bucket on the
 * other side of the world that was fourteen serial round trips — about eight
 * seconds of time to first byte — paid again by every visitor on every screen.
 *
 * Two things fixed it and each is a way the other can go wrong, so both are
 * held here against a store that is **deliberately out of order**: it answers
 * the book's last look instantly and its first one slowly, so a result
 * assembled in completion order comes out visibly backwards.
 *
 * Nothing here touches a bucket or a byte of the captain's artwork. The store
 * is a few lines of this file and the "pages" are manifests, because what is
 * being asserted is the shape and the number of the *reads*.
 */

import { afterEach, describe, expect, it } from "vitest";
import { FIRST_BOOK } from "../templates/first-book";
import {
  CATALOGUE_TTL_MS,
  GHOSTS_SET,
  RELEASE_ARTWORK_DIR_VAR,
  TILES_SET,
  deliveredBook,
  forgetReleaseArtwork,
  lookSet,
  releaseArtworkFor,
  setCatalogueClock,
  tilePageId,
} from "../lib/artwork/release";
import type { ArtworkVersion, PublicArtworkStore } from "../lib/artwork/store";
import { NO_SCREEN_ADDRESSES } from "../lib/artwork/store";

/** A digest-shaped string. Nothing reads these bytes; only their identity. */
const digestOf = (id: string): string =>
  Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0").repeat(8);

function version(set: string, pageIds: string[]): ArtworkVersion {
  return {
    version: 1,
    at: "2026-11-13T09:00:00.000Z",
    pages: pageIds.map((pageId) => ({
      pageId,
      asset: {
        kind: "image" as const,
        mime: "image/png" as const,
        sha256: digestOf(`${set}/${pageId}`),
        bytes: 1,
        px: [3600, 3600] as [number, number],
      },
    })),
  };
}

/**
 * A store that answers out of order on purpose.
 *
 * `delays` is keyed by set: the first look waits, the last does not, so the
 * only way `sets` and `pages` can come out in the book's order is if the
 * assembly walks `book.looks` rather than the answers as they land.
 */
function slowStore(
  held: Record<string, string[]>,
  delays: Record<string, number> = {},
): PublicArtworkStore & { reads: string[]; concurrent: number } {
  let open = 0;
  const store = {
    holds: "released" as const,
    describe: "a store written in test/artwork-catalogue.test.ts",
    reads: [] as string[],
    concurrent: 0,
    async sets() {
      return Object.keys(held);
    },
    async versions(set: string) {
      const one = held[set];
      return one ? [version(set, one)] : [];
    },
    async current(set: string) {
      store.reads.push(set);
      open += 1;
      store.concurrent = Math.max(store.concurrent, open);
      await new Promise((r) => setTimeout(r, delays[set] ?? 0));
      open -= 1;
      const one = held[set];
      return one ? version(set, one) : null;
    },
    async put(): Promise<ArtworkVersion> {
      throw new Error("not written to here");
    },
    async read() {
      return null;
    },
    async screens() {
      return NO_SCREEN_ADDRESSES;
    },
    async putScreens() {
      return NO_SCREEN_ADDRESSES;
    },
  };
  return store;
}

afterEach(() => {
  forgetReleaseArtwork();
  setCatalogueClock(null);
  delete process.env[RELEASE_ARTWORK_DIR_VAR];
});

describe("reading every set of one book", () => {
  const LOOKS = FIRST_BOOK.looks.map((l) => l.id);
  const FIRST = LOOKS[0];
  const LAST = LOOKS[LOOKS.length - 1];

  function twoLooks() {
    return slowStore(
      {
        [lookSet(FIRST)]: ["page-002"],
        [lookSet(LAST)]: ["page-002"],
        [TILES_SET]: LOOKS.map((id) => tilePageId(id)),
        [GHOSTS_SET]: ["page-003"],
      },
      // The book's first look is the slowest answer in the store, and its last
      // is the fastest. Completion order is therefore the reverse of the one
      // that must come out.
      { [lookSet(FIRST)]: 40, [lookSet(LAST)]: 0 },
    );
  }

  it("keeps the book's own look order however the reads finish", async () => {
    const store = twoLooks();
    const art = await releaseArtworkFor(FIRST_BOOK, store);

    const looksInOrder = art.sets
      .map((s) => s.set)
      .filter((s) => s.startsWith("look-"));
    expect(looksInOrder).toEqual([lookSet(FIRST), lookSet(LAST)]);
    expect(Object.keys(art.pages)).toEqual([FIRST, LAST]);

    // The paired negative: the order asserted above is not simply the order
    // the store happened to be asked in, nor the order it answered in. The
    // slow look finished last.
    const finished: string[] = [];
    const watched = twoLooks();
    const current = watched.current.bind(watched);
    watched.current = async (set: string) => {
      const answer = await current(set);
      finished.push(set);
      return answer;
    };
    await releaseArtworkFor(FIRST_BOOK, watched);
    expect(finished.indexOf(lookSet(LAST))).toBeLessThan(finished.indexOf(lookSet(FIRST)));
  });

  it("asks for every set at once rather than one after another", async () => {
    const store = twoLooks();
    await releaseArtworkFor(FIRST_BOOK, store);
    // One `current` per look plus the tiles and the ghosts — all of them in
    // flight together. Serial would make this 1.
    expect(store.reads.length).toBe(FIRST_BOOK.looks.length + 2);
    expect(store.concurrent).toBe(store.reads.length);
  });

  it("still skips a look with no set, and a set for a look the book has not", async () => {
    const store = slowStore({
      [lookSet(LAST)]: ["page-002"],
      "look-not-a-look": ["page-002"],
      [TILES_SET]: [tilePageId("not-a-look"), tilePageId(FIRST)],
    });
    const art = await releaseArtworkFor(FIRST_BOOK, store);

    expect(Object.keys(art.pages)).toEqual([LAST]);
    expect(art.sets.map((s) => s.set)).toEqual([lookSet(LAST), TILES_SET]);
    expect(Object.keys(art.tiles)).toEqual([FIRST]);
  });

  it("an empty version is as good as no version", async () => {
    const store = slowStore({ [lookSet(FIRST)]: [] });
    const art = await releaseArtworkFor(FIRST_BOOK, store);
    expect(art.pages).toEqual({});
    expect(art.sets).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The catalogue is held for a minute, and no longer
// ---------------------------------------------------------------------------

describe("the catalogue held between requests", () => {
  /**
   * The cached path is the one with **no store argument**: a caller that hands
   * its own store in is a test or a script reading a particular directory, and
   * those must never be served another store's answer.
   */
  function pointedAtNothing(): void {
    // A directory with nothing in it: the no-artwork state, which is what CI
    // and a fresh clone are in and what must not become slower or louder.
    process.env[RELEASE_ARTWORK_DIR_VAR] = "/nonexistent-artwork-for-this-test";
    forgetReleaseArtwork();
  }

  it("reads once for many requests and again after the window", async () => {
    pointedAtNothing();
    let clock = 1_000;
    setCatalogueClock(() => clock);

    const first = await deliveredBook(FIRST_BOOK);
    const second = await deliveredBook(FIRST_BOOK);
    // The same answer object, which is the only way to tell a reuse from a
    // read that happened to agree.
    expect(second).toBe(first);

    clock += CATALOGUE_TTL_MS - 1;
    expect(await deliveredBook(FIRST_BOOK)).toBe(first);

    // A minute on, the store is asked again — which is the promise
    // `npm run artwork:upload` makes: an upload is picked up with no redeploy.
    clock += 1;
    const after = await deliveredBook(FIRST_BOOK);
    expect(after).not.toBe(first);
    expect(after.book).toBe(first.book);
  });

  it("is dropped by forgetReleaseArtwork, like every other cache here", async () => {
    pointedAtNothing();
    setCatalogueClock(() => 1_000);
    const first = await deliveredBook(FIRST_BOOK);
    forgetReleaseArtwork();
    expect(await deliveredBook(FIRST_BOOK)).not.toBe(first);
  });

  it("never serves a caller that brought its own store", async () => {
    pointedAtNothing();
    setCatalogueClock(() => 1_000);
    const mine = slowStore({ [lookSet(FIRST_BOOK.looks[0].id)]: ["page-002"] });
    const own = await deliveredBook(FIRST_BOOK, mine);
    expect(own).not.toBe(await deliveredBook(FIRST_BOOK));
    expect(mine.reads.length).toBeGreaterThan(0);
    // And it does not poison the cached one either.
    expect(await deliveredBook(FIRST_BOOK)).toBe(await deliveredBook(FIRST_BOOK));
  });

  it("with no artwork at all it is still the committed book, unchanged", async () => {
    pointedAtNothing();
    const { book, assets, screen } = await deliveredBook(FIRST_BOOK);
    expect(book).toBe(FIRST_BOOK);
    expect(assets).toEqual({});
    expect(screen).toEqual({});
  });
});
