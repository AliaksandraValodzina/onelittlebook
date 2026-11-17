/**
 * **The captain's three folders, turned into pages a store can hold — once.**
 *
 * There are two commands that take the delivered artwork: `npm run artwork`
 * imports it onto this machine and `npm run artwork:upload` pushes it to the
 * public artwork bucket. **They do the same preparation and this is it**, extracted
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
  cutOut,
  flattenOntoWhite,
  portraitAgainstContract,
  portraitMapping,
  rightHalfOf,
  spreadNumberOf,
  type ImportFile,
} from "./import";
import { coverWrapPageId, tilePageId } from "./release";
import { checkOrderArtwork } from "../book/order-upload";
import {
  checkCoverWraps,
  coverFileKindOf,
  coverWrapFileNames,
  missingCoverWraps,
} from "../book/cover-upload";
import { COVER_PRODUCTS, measuredProduct } from "../book/cover-wrap";
import { frontPanelPxOf } from "../print/printify";
import { ghostBelongsOn } from "../book/ghost";
import { pageSequence, spreadSideOf } from "../book/derive";
import { readPngHeader } from "../render/png";
import { describeAlpha } from "../render/png-alpha";
import type { Problem } from "../template/validate";
import type { BookTemplate, CoverProductId } from "../book/types";

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
  // The cover files are the other half of this folder and are prepared by
  // `prepareCoverWraps` below. They are taken out **by the same partition**, so
  // the two functions cannot disagree about which file is which — a file that
  // one of them claimed and the other also claimed would be a page stored twice
  // under two different contracts.
  const interior = files.filter((file) => coverFileKindOf(file.name) === null);
  if (interior.length === 0) {
    // Not a problem. A folder of nothing but wraps is what re-delivering a
    // corrected cover looks like, and `pagesNotCovered` is what says the pages
    // are not here.
    return { pages: [], problems: [], skipped: [] };
  }
  const check = checkOrderArtwork(book, interior);
  return {
    pages: check.pages.map((p) => ({ pageId: p.pageId, bytes: p.file.bytes, from: p.file.name })),
    problems: check.problems,
    skipped: [],
  };
}

/**
 * The page ids of this book that nothing prepared covers.
 *
 * **Variadic over the sets**, because a look's folder now prepares two of them:
 * the interior pages and the cover. Asking only about the pages would report
 * the cover as undelivered on every import that delivered one, which is a
 * command lying about the thing it just did.
 */
export function pagesNotCovered(book: BookTemplate, ...prepared: Prepared[]): string[] {
  return pageSequence(book)
    .map((p) => p.id)
    .filter((id) => !prepared.some((set) => set.pages.some((p) => p.pageId === id)));
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
 * A golden half is 887 px — a quarter of a page's linear resolution — and
 * exists to hold a place in the *preview*, so the only pages worth one are the
 * pages a held place belongs on: `ghostBelongsOn` is that question and its
 * answer is the half the figure stands on. Storing the left halves too would be
 * twelve more unprintable files for pages nothing would ever draw them on.
 *
 * **It is not that the left half has no part of the child in it.** It does, on
 * eleven of the twelve spreads — `lib/book/artwork.ts` § Which pages a
 * character swap has to touch has the measurement, and this comment used to
 * claim the opposite. What is true is that the *figure* is on the right-hand
 * half, which is where a silhouette can stand, and `lib/book/ghost.ts` § The
 * two things this still cannot do states the consequence for the left one.
 *
 * The babyless spread is **skipped and derived, never listed**: the opening
 * spread carries the buyer's photograph and dedication and has no child on it
 * at all, which is exactly why the captain's own `spread-01` has no gold figure
 * in it. Storing it would be `ghost.onBabylessPage` from `validateBook`.
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

    if (!ghostBelongsOn(book, index)) {
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

// ---------------------------------------------------------------------------
// The cover wraps, and the square cut out of one of them
// ---------------------------------------------------------------------------

/**
 * **Which product's wrap the display cover is cut out of.**
 *
 * The softcover, because its template is the one somebody has read and because
 * it is the product being sold. Declared here rather than inferred from
 * whichever file a directory listing produced first — the day the hardcover is
 * measured its panel will be a different size, and "which cover does the shop
 * show" should be a sentence somebody wrote.
 */
export const DISPLAY_COVER_FROM: CoverProductId = "softcover";

/** One cover file, with the product it is for, for the table a command prints. */
export interface PreparedCover extends PreparedPage {
  /** The product this wrap is for; absent on the cut display cover. */
  product?: CoverProductId;
}

export interface PreparedCovers extends Prepared {
  pages: PreparedCover[];
  /** Which products this folder delivered no wrap for. Never a problem. */
  missing: CoverProductId[];
  /**
   * **The two page ids to look at side by side, when there are two.**
   *
   * The cut front panel and a page of this look's own interior, so somebody can
   * see at a glance whether it is the same baby. `lib/book/cover-upload.ts`
   * § What cannot be checked, said plainly is why this is a report and not a
   * gate: measuring hair colour was tried twice and failed twice, and a gate
   * that silently fails to catch the thing it is named for is worse than none.
   */
  compare: { cover: string; page: string } | null;
}

/**
 * **One look's cover: two wraps stored as delivered, and the display cover cut
 * out of the softcover one.**
 *
 * Three things happen and the order matters.
 *
 * **The wraps are checked against their own supplied sizes and refused
 * outright if either is wrong** — `lib/book/cover-upload.ts`
 * § `coverWrapAgainstContract`, whose message names both the number given and
 * the number wanted because a wrap has already arrived at the template's
 * *finished* size instead of its *image* size.
 *
 * **The wraps are stored byte for byte.** They are what goes to Printify, and
 * re-encoding what the press is going to print would change the digest, cost
 * quality and buy nothing — the same argument `prepareLookPages` makes about a
 * page.
 *
 * **The display cover is cut out of the softcover wrap's front panel**
 * (`lib/print/printify.ts` § `frontPanelPxOf`) and stored under the book's own
 * cover page id, so the picker, the preview and the basket bind it exactly as
 * they bind page nine. Cut rather than taken from the captain's separate square
 * export, which is the whole point:
 * `lib/book/cover-upload.ts` § Why the square is cut and never supplied.
 *
 * **Nothing is cut from the hardcover wrap and no title will be printed on
 * one.** Its internal geometry is arithmetic nobody has checked against a
 * template (`lib/print/printify.ts` § `HARDCOVER_COVER_WRAP_DERIVED`), so the
 * file is kept — the bytes are right either way — and `measuredProduct` goes on
 * refusing to compose a wrap for it. A cut taken from a guessed panel origin
 * would be a plausible cover with a strip of spine down one side.
 */
export function prepareCoverWraps(
  book: BookTemplate,
  lookId: string,
  files: ImportFile[],
): PreparedCovers {
  const check = checkCoverWraps(files, lookId);
  const pages: PreparedCover[] = [];
  const problems = [...check.problems];
  const skipped: string[] = [];

  for (const wrap of check.wraps) {
    pages.push({
      pageId: coverWrapPageId(wrap.product),
      bytes: wrap.file.bytes,
      from: wrap.file.name,
      // "as delivered" is the whole of what happens to a wrap, and when the
      // file carried an alpha channel the line says what was measured in it —
      // `lib/book/cover-upload.ts` § The alpha refusal measures is why an
      // accepted channel is worth a sentence rather than a silence.
      did:
        `${wrap.want.width}×${wrap.want.height} ${wrap.product} wrap, as delivered` +
        (wrap.alpha ? ` — ${describeAlpha(wrap.alpha)}, kept rather than flattened` : ""),
      product: wrap.product,
    });
  }

  for (const wrap of check.wraps) {
    // **Which product the display cover comes out of, declared rather than
    // "whichever file came first".** The softcover's template is the one that
    // has been read, and when the hardcover's is read too the two panels will
    // be different sizes — so this stays a decision somebody made and not a
    // consequence of a directory listing.
    if (wrap.product !== DISPLAY_COVER_FROM) continue;

    // The one door is `measuredProduct`, so a product whose template nobody has
    // opened cannot reach a panel origin by any route — including this one, if
    // `DISPLAY_COVER_FROM` is ever pointed at it before it is measured.
    let product;
    try {
      product = measuredProduct(wrap.product);
    } catch {
      skipped.push(
        `${lookId}/${wrap.file.name} is kept whole and nothing is cut from it: ` +
          `nobody has measured the ${wrap.product}'s template, so where its front panel ` +
          "starts is arithmetic rather than a reading",
      );
      continue;
    }
    // A wrap the contract refused is not cut: `cutOut` checks the size again and
    // would throw, and a refusal is a list of problems rather than an exception.
    if (problems.some((p) => p.where === `${lookId}/${wrap.file.name}`)) continue;

    const cut = frontPanelPxOf(product.template);
    pages.push({
      pageId: book.cover.id,
      bytes: cutOut(wrap.file.bytes, product.template.area, cut),
      from: wrap.file.name,
      did:
        `front panel cut at ${cut.x},${cut.y} → ${cut.width}×${cut.height} — ` +
        "the display cover, so the preview and the press cannot differ",
    });
  }

  for (const wrap of check.wraps) {
    if (wrap.product === DISPLAY_COVER_FROM) continue;
    // Two reasons and both worth printing. The first is the decision; the
    // second is why that decision could not have gone the other way today.
    skipped.push(
      `${lookId}/${wrap.file.name} is kept whole and nothing is cut from it: the display ` +
        `cover is the ${DISPLAY_COVER_FROM}'s front panel` +
        (COVER_PRODUCTS[wrap.product].measured
          ? ""
          : `, and nobody has measured the ${wrap.product}'s template in any case — where its ` +
            "front panel starts is arithmetic rather than a reading"),
    );
  }

  const cover = pages.find((p) => p.pageId === book.cover.id);
  const page = pageSequence(book).find((p) => p.id === book.tilePage) ?? book.pages[0];
  return {
    pages,
    problems,
    skipped,
    missing: missingCoverWraps(check.wraps),
    compare: cover && page ? { cover: cover.pageId, page: page.id } : null,
  };
}

/** The wrap files a look's folder is expected to hold. For a usage line. */
export { coverWrapFileNames };
