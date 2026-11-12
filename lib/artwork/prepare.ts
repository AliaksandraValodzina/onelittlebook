/**
 * **The captain's three folders, turned into pages a store can hold — once.**
 *
 * There are two commands that take the delivered artwork: `npm run artwork`
 * imports it onto this machine and `npm run artwork:upload` pushes it to the
 * public Blob store. **They do the same preparation and this is it**, extracted
 * the day the second one existed, because the one thing those two commands may
 * never disagree about is what a page *is* — the mapping from a filename onto a
 * page id, the flattening of a portrait, the half of a spread that is kept, and
 * the contract every page is held to before anything is written.
 *
 * Two copies of that would be two opinions, and the wrong one is always the one
 * nobody is reading when a book comes back with a white edge.
 *
 * **Nothing here re-implements the rules.** `lib/book/upload.ts`
 * § `pageAgainstContract` is the page contract and
 * `lib/book/order-upload.ts` § `checkOrderArtwork` is the filename mapping — the
 * same functions an order's regenerated pages go through, which is the whole
 * reason they were exported. `lib/artwork/import.ts` is the two pixel
 * operations. This module is the arrangement of those, as **pure functions of
 * bytes and names**, so both commands are testable without the captain's
 * folders and without a filesystem.
 */

import {
  flattenOntoWhite,
  portraitAgainstContract,
  portraitMapping,
  rightHalfOf,
  spreadNumberOf,
  type ImportFile,
} from "./import";
import { tilePageId } from "./release";
import { checkOrderArtwork } from "../book/order-upload";
import { pageCarriesTheChild } from "../book/ghost";
import { pageSequence, spreadSideOf } from "../book/derive";
import { readPngHeader } from "../render/png";
import type { Problem } from "../template/validate";
import type { BookTemplate } from "../book/types";

/** One page of one set, ready to be handed to `ArtworkStore.put`. */
export interface PreparedPage {
  /** A page id of the book, derived — never a filename. */
  pageId: string;
  /** The bytes as they will be stored, after any pixel operation. */
  bytes: Uint8Array;
  /** The file it came from, for the line the command prints. */
  from: string;
  /** What was done to it, if anything. One line, for the same reason. */
  did?: string;
}

/**
 * What one folder came to.
 *
 * `problems` non-empty means **nothing may be written** — both commands refuse
 * before they write, every time, rather than trusting that somebody ran a
 * checker first. An import changes what a paid book looks like, and a gate that
 * can be skipped is not a gate.
 */
export interface Prepared {
  pages: PreparedPage[];
  problems: Problem[];
  /** Files deliberately not stored, each with the reason. Never an error. */
  skipped: string[];
}

/**
 * **One look's finished pages, stored byte for byte.**
 *
 * They already satisfy `docs/look-upload-contract.md` § 2, so nothing is done
 * to the pixels: re-encoding would change the digest, cost quality and buy
 * nothing. The page ids come from the book's own spread pairing, so moving a
 * page in the template moves which file lands on it.
 */
export function prepareLookPages(book: BookTemplate, files: ImportFile[]): Prepared {
  const check = checkOrderArtwork(book, files);
  return {
    pages: check.pages.map((p) => ({ pageId: p.pageId, bytes: p.file.bytes, from: p.file.name })),
    problems: check.problems,
    skipped: [],
  };
}

/** The page ids of this book that a prepared set did not cover. */
export function pagesNotCovered(book: BookTemplate, prepared: Prepared): string[] {
  return pageSequence(book)
    .map((p) => p.id)
    .filter((id) => !prepared.pages.some((p) => p.pageId === id));
}

/** One portrait, with the look it maps onto, for the table a command prints. */
export interface PreparedPortrait extends PreparedPage {
  lookId: string;
  label: string;
}

export interface PreparedPortraits extends Prepared {
  pages: PreparedPortrait[];
}

/**
 * **The portraits, flattened onto white, as the chooser's tiles.**
 *
 * They arrive RGBA with nothing in them fully opaque, so a tile left as it came
 * would show the page through the baby and could never pass a page validator.
 * `lib/artwork/import.ts` § `flattenOntoWhite` carries the rest of that, and the
 * mapping from the captain's numbering onto look ids is `portraitMapping`'s,
 * derived from the book's own look order.
 */
export function preparePortraits(book: BookTemplate, files: ImportFile[]): PreparedPortraits {
  const mapping = portraitMapping(book, files);
  if (mapping.problems.length) {
    return { pages: [], problems: mapping.problems, skipped: [] };
  }

  const pages: PreparedPortrait[] = [];
  const problems: Problem[] = [];
  for (const portrait of mapping.portraits) {
    const before = readPngHeader(portrait.file.bytes);
    const bytes = flattenOntoWhite(portrait.file.bytes);
    const after = readPngHeader(bytes);
    problems.push(
      ...portraitAgainstContract(
        { name: portrait.file.name, bytes },
        `${portrait.file.name} → ${portrait.lookId}`,
      ),
    );
    pages.push({
      pageId: tilePageId(portrait.lookId),
      bytes,
      from: portrait.file.name,
      did:
        `${before.width}×${before.height} colour ${before.colourType} → ` +
        `colour ${after.colourType}, flattened onto white`,
      lookId: portrait.lookId,
      label: portrait.label,
    });
  }
  return { pages, problems, skipped: [] };
}

/**
 * **The twelve golden spreads, split, right halves only.**
 *
 * Every left half is the quiet half — the words — and is identical to the real
 * artwork, so importing both would import the left pages a second time at a
 * quarter of the resolution under a type that says they can never print.
 *
 * The babyless spread is **skipped and derived, never listed**: the opening
 * spread carries the buyer's photograph and dedication and has no child on it,
 * which is exactly why the captain's own `spread-01` has no gold figure in it.
 * Storing it would be `ghost.onBabylessPage` from `validateBook`.
 */
export function prepareGhostHalves(book: BookTemplate, files: ImportFile[]): Prepared {
  const sequence = pageSequence(book);
  const pages: PreparedPage[] = [];
  const problems: Problem[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const spread = spreadNumberOf(file.name);
    if (spread === null) {
      problems.push({
        code: "ghost.nameUnrecognised",
        where: file.name,
        detail: "expected spread-NN.png",
      });
      continue;
    }
    const index = sequence.findIndex((_, at) => {
      const side = spreadSideOf(book, at);
      return side !== null && side.spread === spread && side.side === "right";
    });
    if (index < 0) {
      problems.push({
        code: "ghost.spreadUnknown",
        where: file.name,
        detail: `the book has no spread ${spread} right`,
      });
      continue;
    }
    const pageId = sequence[index].id;

    if (!pageCarriesTheChild(book, index)) {
      skipped.push(`${file.name} → ${pageId} (the book declares it babyless)`);
      continue;
    }

    const whole = readPngHeader(file.bytes);
    const half = rightHalfOf(file.bytes);
    const halfHeader = readPngHeader(half);
    pages.push({
      pageId,
      bytes: half,
      from: file.name,
      did: `${whole.width}×${whole.height} → ${halfHeader.width}×${halfHeader.height}, right half`,
    });
  }

  return { pages, problems, skipped };
}

/** What a store's `put` takes, out of what this module produced. */
export function pagesForStore(prepared: Prepared): Array<{ pageId: string; bytes: Uint8Array }> {
  return prepared.pages.map((p) => ({ pageId: p.pageId, bytes: p.bytes }));
}
