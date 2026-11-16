/**
 * **The cover wraps coming in, and saying exactly what is wrong with one.**
 *
 * A cover does not arrive as a square. The captain uploads spreads to Printify
 * directly, so what they produce per look is **two finished wraps** — back
 * cover, spine and front in one piece, wordless, at each product's own supplied
 * size:
 *
 * | | |
 * |---|---|
 * | Softcover | **4790 × 2400 px** — Printify's own supplied area, bleed included |
 * | Hardcover | **5370 × 2850 px** — the captain's export, counted off three files |
 *
 * Both sizes are read out of `lib/book/cover-wrap.ts` § `suppliedAreaOf` and
 * neither is typed here. `docs/look-upload-contract.md` § 2b is the agreement
 * this enforces.
 *
 * ## Why the square is cut and never supplied
 *
 * The display cover — the picture the picker, the preview and the basket show —
 * is the **front panel of the softcover wrap, cut out of it**
 * (`lib/print/printify.ts` § `frontPanelPxOf`). The captain also has a separate
 * square export, and taking that instead would be the obvious thing to do and
 * the wrong one: their square and their wrap were composed by hand, twice, and
 * on the three looks in hand the two are not the same composition. A buyer
 * would preview one cover and receive another, and nothing anywhere would
 * notice. **Cut from the wrap and the two cannot disagree** — not by a pixel,
 * not ever, because there is only one file.
 *
 * It also comes out at exactly the size the captain's own square export is,
 * 2325 × 2325, which is the arithmetic confirmed from two directions: Printify
 * says the finished panel is 2325 and so does an image tool somebody else was
 * driving.
 *
 * ## Why the page contract is not used here, and must not be
 *
 * `./upload.ts` § `pageAgainstContract` is **3600 × 3600 exactly, square**.
 * That is right for an interior page and wrong for every wrap: a wrap is wide,
 * and loosening the page rule to let one through would loosen it for the
 * twenty-four pages too. So this is a second contract for a second kind of
 * object, and the parts that are genuinely about *any* printable file — PNG,
 * 8-bit, no alpha, sRGB — are the same checks called from the same place, so
 * there is one opinion about those and not two.
 *
 * ## The size refusal teaches the difference between two lines of a template
 *
 * This has already gone wrong: a wrap arrived at **4715 × 2325**, which is the
 * template's *FINISHED SIZE* line and not its *IMAGE SIZE* line — no bleed at
 * all, so any drift in the cut shows as a white hairline down the edge of a
 * finished book. The refusal therefore names **both numbers**, the one given
 * and the one wanted, and says which line of the template each is. A message
 * that said only "wrong size" would send somebody back to the same line of the
 * same file.
 *
 * ## What cannot be checked, said plainly
 *
 * The other failure that has happened is **a cover showing a different baby
 * from the look's own pages** — a brown-haired cover submitted for the ginger
 * look, whose twenty-four interior pages are all ginger. There is no check for
 * that here and there deliberately is not: measuring hair colour was tried
 * twice and failed both times, because the warm wooden floors, the blankets and
 * the backgrounds swamp the hair and the skin, and ginger, blonde and brown
 * came back within half a degree of hue of each other. A pass/fail gate on that
 * measurement would be a check that is named for the thing it does not catch,
 * which is worse than no check at all.
 *
 * What *is* checked is the mechanical half of the same mistake — **a file used
 * twice**. `coverWrapsDiffer` catches one wrap copied over the other, and
 * `./upload.ts` § `checkUpload`'s existing digest comparison catches one look's
 * cover submitted for another. Those are reliable because they are about bytes.
 * The baby itself is a **reported comparison for the captain's eye**:
 * `npm run artwork -- status` prints the cut front panel beside a page of the
 * same look, and that is a prompt and not a gate.
 */

import type { Problem } from "../template/validate";
import { NotAPng, hasAlphaChannel, pngChunkTypes, readPngHeader } from "../render/png";
import { suppliedAreaOf } from "./cover-wrap";
import { COVER_PRODUCT_IDS, type CoverProductId } from "./types";
import type { UploadedFile } from "./upload";
import type { Px } from "../print/printify";

/** The name a wrap is expected under, derived from the product's own id. */
export function coverWrapFileName(id: CoverProductId): string {
  return `cover-${id}.png`;
}

/** Both of them, for a usage line and for a refusal that names what it wants. */
export function coverWrapFileNames(): string[] {
  return COVER_PRODUCT_IDS.map(coverWrapFileName);
}

/**
 * What a filename in a look's folder is, as far as covers are concerned.
 *
 * `null` means *not a cover file at all* — an interior page, which this module
 * has no opinion about. Everything else is a cover file, including the ones
 * that are refused: a name that is nearly right has to be reported rather than
 * fall through to "unexpected file", because the commonest version of this
 * mistake is a correct file under a stale name.
 *
 * The product is matched as a **token anywhere in the stem**, which is
 * `./order-upload.ts` § `pageForArtworkName`'s rule and is here for the same
 * reason: `cover-softcover.png`, `softcover.png`, `cover-wrap-softcover.png`
 * and `girl-01-softcover-wrap.png` are all obviously the same intention, and a
 * tool that accepted exactly one spelling is a tool somebody renames files for.
 */
export type CoverFileKind =
  | { kind: "wrap"; product: CoverProductId }
  /** A name that means a cover and does not say which product. */
  | { kind: "productUnnamed" }
  /** A piece of a wrap, which is not how a wrap is delivered. */
  | { kind: "piece"; piece: string };

export function coverFileKindOf(name: string): CoverFileKind | null {
  const stem = /^(.*)\.png$/i.exec(name)?.[1]?.toLowerCase();
  if (stem === undefined) return null;

  const word = (token: string) =>
    new RegExp(`(^|[^a-z])${token}([^a-z]|$)`).test(stem);

  const named = COVER_PRODUCT_IDS.filter((id) => word(id));
  if (named.length === 1) return { kind: "wrap", product: named[0] };
  if (named.length > 1) return { kind: "productUnnamed" };

  // The pieces of a wrap, which the contract used to reserve as names and now
  // refuses for a better reason: they are not separate files any more, they are
  // regions of one.
  for (const piece of ["back", "spine", "front"]) {
    if (word(piece) && (word("cover") || piece === "spine")) return { kind: "piece", piece };
  }
  return word("cover") || word("wrap") ? { kind: "productUnnamed" } : null;
}

/** One wrap resolved onto the product it is for. */
export interface ResolvedCoverWrap {
  product: CoverProductId;
  file: UploadedFile;
  /** The size it was held to, so a command can print it without knowing it. */
  want: Px;
}

export interface CoverWrapCheck {
  wraps: ResolvedCoverWrap[];
  problems: Problem[];
}

/**
 * Every cover file in one look's folder, resolved and checked.
 *
 * Takes the whole folder and keeps only what is a cover file, so the caller
 * does not have to partition first and cannot partition differently from
 * `./upload.ts`. Reports everything in one pass, which is this family of
 * functions' rule: the captain is about to go back to an image tool and one
 * list is one trip.
 *
 * **A look with no cover file at all is not a problem here.** Most looks have
 * none, the shop composes a wrap from the square for those, and "which wraps
 * does each look have" is a question `npm run artwork -- status` answers rather
 * than a refusal. A caller that needs one says so itself — `missingCoverWraps`
 * is that sentence.
 */
export function checkCoverWraps(files: UploadedFile[], where = ""): CoverWrapCheck {
  const problems: Problem[] = [];
  const wraps: ResolvedCoverWrap[] = [];
  const prefix = where ? `${where}/` : "";
  const claimed = new Map<CoverProductId, string>();

  for (const file of files) {
    const kind = coverFileKindOf(file.name);
    if (!kind) continue;
    const at = `${prefix}${file.name}`;

    if (kind.kind === "productUnnamed") {
      problems.push({
        code: "cover.productUnnamed",
        where: at,
        detail:
          `a cover is two wraps now and this name does not say which: expected ` +
          `${coverWrapFileNames().join(" and ")}. The old cover.png was one square and is not ` +
          "uploaded any more — the display cover is cut out of the softcover wrap's front " +
          "panel so that what a buyer previews and what they receive cannot differ.",
      });
      continue;
    }
    if (kind.kind === "piece") {
      problems.push({
        code: "cover.pieceOfAWrap",
        where: at,
        detail:
          `the ${kind.piece} is a region of a wrap and not a file: one wrap carries the back ` +
          `cover, the spine and the front in one piece. Expected ` +
          `${coverWrapFileNames().join(" and ")}.`,
      });
      continue;
    }

    const twin = claimed.get(kind.product);
    if (twin) {
      problems.push({
        code: "cover.duplicateProduct",
        where: at,
        detail: `${twin} is already the ${kind.product} wrap; two files cannot be one wrap`,
      });
      continue;
    }
    claimed.set(kind.product, file.name);

    const want = suppliedAreaOf(kind.product);
    problems.push(...coverWrapAgainstContract(file, at, want, kind.product));
    wraps.push({ product: kind.product, file, want });
  }

  problems.push(...coverWrapsDiffer(wraps, prefix));
  return { wraps, problems };
}

/**
 * One wrap's bytes, against the contract.
 *
 * **The size is refused outright and the refusal names both numbers**, with the
 * line of Printify's template each of them is — see this module's docblock for
 * the 4715 × 2325 that got here. Everything else is what any printable file in
 * this repository has to be, and is the same reading `./upload.ts`
 * § `pageAgainstContract` does of an interior page: PNG, 8 bits, no alpha, no
 * embedded profile that is not sRGB, not interlaced.
 *
 * **Not square and not 3600.** That is the point of a separate function: the
 * page rule is right for a page and a wrap is wide, and the way to keep the
 * page rule strict is to not ask it this question.
 */
export function coverWrapAgainstContract(
  file: UploadedFile,
  where: string,
  want: Px,
  product?: CoverProductId,
): Problem[] {
  const out: Problem[] = [];
  const say = (code: string, detail: string) => out.push({ code, where, detail });

  let header;
  try {
    header = readPngHeader(file.bytes);
  } catch (error) {
    say("cover.notPng", error instanceof NotAPng ? error.message : "could not be read as a PNG");
    return out;
  }

  if (header.width !== want.width || header.height !== want.height) {
    say(
      "cover.wrongSize",
      `${header.width} × ${header.height}; the ${product ?? "cover"} wrap is ` +
        `${want.width} × ${want.height} exactly. ` +
        `${want.width} × ${want.height} is the template's IMAGE SIZE line, which includes the ` +
        "bleed; its FINISHED SIZE line is the smaller number and is what is left after the cut. " +
        "A file supplied at the finished size has no bleed, so any drift in the guillotine " +
        "prints a white hairline down the edge of the cover.",
    );
  }
  if (hasAlphaChannel(header.colourType)) {
    say(
      "cover.hasAlpha",
      `colour type ${header.colourType} carries an alpha channel; paper would show through`,
    );
  }
  if (header.bitDepth !== 8) say("cover.notEightBit", `bit depth ${header.bitDepth}`);
  if (header.interlaced) say("cover.interlaced", "Adam7 interlacing; some RIPs mishandle it");
  if (pngChunkTypes(file.bytes).includes("iCCP")) {
    say("cover.notSrgb", "an embedded ICC profile; supply sRGB with no profile, or an sRGB one");
  }
  return out;
}

/**
 * **The two wraps of one look must not be the same file.**
 *
 * The reliable half of "is this the right baby": a wrap copied over the other
 * is a mistake about bytes, and bytes can be compared. It is also the only one
 * of the two wraps' failure modes that a size check cannot already see — two
 * identical files cannot both be 4790 × 2400 and 5370 × 2850, so this fires
 * only when the sizes have been made to agree by hand, which is exactly the
 * state somebody reaches by exporting the same canvas twice.
 *
 * It says nothing about *which* baby is on either of them. See this module's
 * docblock for why there is no check for that and what there is instead.
 */
export function coverWrapsDiffer(wraps: ResolvedCoverWrap[], prefix = ""): Problem[] {
  const out: Problem[] = [];
  for (let i = 0; i < wraps.length; i++) {
    for (let j = i + 1; j < wraps.length; j++) {
      const a = wraps[i];
      const b = wraps[j];
      if (a.file.bytes.length !== b.file.bytes.length) continue;
      if (!a.file.bytes.every((byte, at) => byte === b.file.bytes[at])) continue;
      out.push({
        code: "cover.wrapsIdentical",
        where: `${prefix}${b.file.name}`,
        detail:
          `byte-identical to ${prefix}${a.file.name}, and the two products are different sizes: ` +
          "one of them has been exported from the wrong canvas",
      });
    }
  }
  return out;
}

/** Which products this folder did not deliver a wrap for. For a report. */
export function missingCoverWraps(wraps: ResolvedCoverWrap[]): CoverProductId[] {
  return COVER_PRODUCT_IDS.filter((id) => !wraps.some((w) => w.product === id));
}
