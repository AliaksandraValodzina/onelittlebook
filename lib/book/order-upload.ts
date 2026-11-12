/**
 * **The regenerated artwork for one order, coming back in.**
 *
 * `./artwork.ts` sends the clean pages out; this reads what comes back. It is
 * the other half of the photo path and it is held to exactly the same contract
 * the pre-made looks are: **3600 × 3600 exactly, PNG, sRGB, 8 bits per
 * channel, no alpha channel, not interlaced.** Those rules are not restated
 * here — `./upload.ts` § `pageAgainstContract` is the one implementation and
 * `docs/look-upload-contract.md` § 2 is the agreement. A second set of rules
 * would be a second opinion about what a printable page is, and the one that is
 * wrong is the one nobody reads until a book arrives with a white edge down one
 * side.
 *
 * Two things this adds that a folder of looks does not need:
 *
 * **It accepts the captain's own spelling.** Their files are
 * `spread-03-right.png`; the contract's are `page-006.png`. Both are accepted
 * and mapped, and so is the name the clean-artwork ZIP handed over in the first
 * place (`BK-7QX4K2P-07-page-006-spread-03-right-clean.png`), because the most
 * likely thing a person does with a file they were given is save over it. The
 * mapping is **derived from the book** via `spreadSideOf`, so moving a page in
 * the template moves the name that refers to it and nothing has to be kept in
 * step by hand.
 *
 * **It reports every problem in one pass**, which is `./upload.ts`'s rule for
 * the same reason: the captain is about to go back to an image tool, and one
 * list is one trip.
 *
 * It is a **pure function of bytes and names**. The filesystem, the HTTP body
 * and the versioning live in `lib/artwork/store.ts` and
 * `app/api/admin/artwork/[ref]/route.ts`, so the whole contract is testable
 * against a handful of hand-built PNGs.
 */

import type { Problem } from "../template/validate";
import { pageAgainstContract, type UploadedFile } from "./upload";
import { pageSequence, spreadSideOf } from "./derive";
import type { BookTemplate } from "./types";

/** One file resolved onto the page of the book it replaces. */
export interface ResolvedArtworkPage {
  /** Index into `pageSequence`. */
  index: number;
  pageId: string;
  file: UploadedFile;
}

export interface OrderArtworkCheck {
  pages: ResolvedArtworkPage[];
  problems: Problem[];
}

const PAGE_TOKEN = /page-(\d{3})/;
const SPREAD_TOKEN = /spread-(\d{1,2})-(left|right)/;

/**
 * Which page of the book a filename refers to.
 *
 * It looks for a **token anywhere in the stem** rather than matching the whole
 * name, which is what lets all three spellings through. When a name carries
 * both a page token and a spread token — which the clean-artwork ZIP's own
 * names do — the two must agree: a file called
 * `07-page-006-spread-09-right.png` has been renamed by hand and half-edited,
 * and guessing which half is right is how somebody's book gets page nine where
 * page six should be.
 */
export function pageForArtworkName(
  book: BookTemplate,
  name: string,
): { index: number } | Problem {
  const where = name;
  const stem = /^(.*)\.png$/i.exec(name)?.[1]?.toLowerCase();
  if (stem === undefined) {
    return { code: "artwork.notPngName", where, detail: "the contract is PNG; this is not .png" };
  }

  const sequence = pageSequence(book);

  const pageMatch = PAGE_TOKEN.exec(stem);
  let byPage = -1;
  if (pageMatch) {
    byPage = sequence.findIndex((p) => p.id === `page-${pageMatch[1]}`);
    if (byPage < 0) {
      return {
        code: "artwork.pageUnknown",
        where,
        detail: `the book has no page-${pageMatch[1]}`,
      };
    }
  }

  const spreadMatch = SPREAD_TOKEN.exec(stem);
  let bySpread = -1;
  if (spreadMatch) {
    const spread = Number(spreadMatch[1]);
    const side = spreadMatch[2] as "left" | "right";
    bySpread = sequence.findIndex((_, index) => {
      const at = spreadSideOf(book, index);
      return at !== null && at.spread === spread && at.side === side;
    });
    if (bySpread < 0) {
      return {
        code: "artwork.spreadUnknown",
        where,
        detail: `the book has no spread ${spread} ${side}`,
      };
    }
  }

  if (byPage >= 0 && bySpread >= 0 && byPage !== bySpread) {
    return {
      code: "artwork.nameAmbiguous",
      where,
      detail:
        `the page token says ${sequence[byPage].id} and the spread token says ` +
        `${sequence[bySpread].id}; one of the two has been edited by hand`,
    };
  }
  if (byPage >= 0) return { index: byPage };
  if (bySpread >= 0) return { index: bySpread };

  // The cover is last, because "cover" is a word that could appear in a longer
  // name and a page token is the more specific statement.
  if (/(^|[^a-z])cover([^a-z]|$)/.test(stem)) {
    return { index: sequence.findIndex((p) => p.id === book.cover.id) };
  }

  return {
    code: "artwork.nameUnrecognised",
    where,
    detail: "expected page-NNN.png, spread-NN-left.png, spread-NN-right.png or cover.png",
  };
}

function isProblem(value: { index: number } | Problem): value is Problem {
  return "code" in value;
}

/**
 * Everything wrong with one order's regenerated artwork, in one list.
 *
 * The **book** is the source of truth for the page size and for which pages
 * exist, exactly as in `checkUpload`, so changing the trim is a data edit in
 * `templates/first-book.ts` and this follows it.
 *
 * A **partial** upload is accepted on purpose: the default clean-artwork
 * download is the twelve right-hand pages, so twelve files is the normal case
 * and the other thirteen pages keep the artwork they already had
 * (`./order-art.ts`). An upload of *nothing* is refused, because a form
 * submitted with no file attached is otherwise indistinguishable from a
 * successful upload that changed nothing.
 */
export function checkOrderArtwork(book: BookTemplate, files: UploadedFile[]): OrderArtworkCheck {
  const problems: Problem[] = [];
  const pages: ResolvedArtworkPage[] = [];
  const size = book.page.print.pixels.width;
  const sequence = pageSequence(book);
  const claimed = new Map<number, string>();

  for (const file of files) {
    const resolved = pageForArtworkName(book, file.name);
    if (isProblem(resolved)) {
      problems.push(resolved);
      continue;
    }
    const pageId = sequence[resolved.index].id;
    const where = `${file.name} → ${pageId}`;

    const twin = claimed.get(resolved.index);
    if (twin) {
      problems.push({
        code: "artwork.duplicatePage",
        where,
        detail: `${twin} is already the file for ${pageId}; two files cannot be one page`,
      });
      continue;
    }
    claimed.set(resolved.index, file.name);

    // The same rules the pre-made looks are held to, and the same function.
    problems.push(...pageAgainstContract(file, where, size));
    pages.push({ index: resolved.index, pageId, file });
  }

  if (files.length === 0) {
    problems.push({
      code: "artwork.noFiles",
      where: book.id,
      detail: "no files in the upload; an empty upload is not a replacement",
    });
  }

  // Reading order, so the list a person reads matches the book they are holding.
  pages.sort((a, b) => a.index - b.index);
  return { pages, problems };
}
