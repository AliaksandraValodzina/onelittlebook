/**
 * **Turning what the captain delivered into what the store holds.**
 *
 * Three sets arrived on 10 November and each needs something different done to
 * it before it is artwork this shop can use. `docs/artwork.md` is the inventory;
 * `scripts/import-artwork.ts` is the command; this is the pixels and the
 * naming, as **pure functions of bytes and names** so the whole of it is
 * testable without a filesystem and without the captain's folders.
 *
 * | Set | What happens to it | Why |
 * |---|---|---|
 * | **The 24 finished pages** | nothing at all | They already satisfy `docs/look-upload-contract.md` § 2 — 3600 × 3600, sRGB, no alpha — so they are stored byte for byte. Re-encoding would change the digest, cost quality and buy nothing. |
 * | **The portraits** | flattened onto white | They are RGBA with a transparent background and **nothing in them is fully opaque** — the subject tops out at alpha 249–253. A portrait with an alpha channel could never pass the page validator, and a tile with 2 % transparency over a dark page would show the page through the baby. |
 * | **The 12 golden spreads** | split, right half kept | Each is one 1774 × 887 spread. Every left half is babyless and identical to the real artwork, so importing both halves would import the left pages twice at a quarter of the resolution. |
 *
 * ## What it does not re-check
 *
 * The page contract is `lib/book/upload.ts` § `pageAgainstContract` and the
 * mapping from the captain's filenames onto page ids is
 * `lib/book/order-upload.ts` § `checkOrderArtwork`. Neither is reimplemented
 * here: a look's folder is checked by the same function an order's regenerated
 * pages are, which is the whole reason that function was exported. A second
 * opinion about what a printable page is would be one opinion too many, and the
 * wrong one is always the one nobody is reading when a book comes back with a
 * white edge.
 *
 * ## pngjs
 *
 * `pngjs` is a **devDependency** and this module is imported only by
 * `scripts/` and `test/`. Nothing under `app/` or in the rendering path reaches
 * it, so a production install with `--omit=dev` is unaffected. The two
 * operations here are the only places in this repository that decode a PNG's
 * pixels — the renderer hands PNGs to `resvg` and never looks inside one.
 */

import { PNG } from "pngjs";
import type { Problem } from "../template/validate";
import { NotAPng, hasAlphaChannel, pngChunkTypes, readPngHeader, withSrgbChunk } from "../render/png";
import type { BookTemplate, Look } from "../book/types";

/** One file as it arrived, by its own name. The same shape `lib/book/upload.ts` uses. */
export interface ImportFile {
  name: string;
  bytes: Uint8Array;
}

// ---------------------------------------------------------------------------
// The portraits
// ---------------------------------------------------------------------------

/**
 * `01-girl.png` … `07-boy.png`: the captain's number, and the gender from the
 * filename.
 *
 * **The number is 1-based within the gender**, which is the captain's own
 * spelling of their folder: seven girls numbered 01–07 and seven boys numbered
 * 01–07, not fourteen files numbered 01–14. It is also, exactly, the look ids —
 * `03-girl.png` is `girl-03` — which is what makes this a derivation and not a
 * table.
 *
 * **Gender is read from the name rather than guessed from the pixels**, which
 * is `docs/look-upload-contract.md` § 1's own rule for `looks.json`: gender is
 * not a fact about an image, so it is declared. Here the declaration is the
 * filename, because that is where the captain put it.
 */
const PORTRAIT_FILE = /^(\d{1,2})-([a-z]+)(?:\b|_).*\.png$/i;

export interface PortraitName {
  /** The captain's own number, 1-based and theirs. */
  number: number;
  /** The gender id the filename declares. Checked against the book's. */
  gender: string;
}

export function portraitName(name: string): PortraitName | null {
  const match = PORTRAIT_FILE.exec(name) ?? /^(\d{1,2})-([a-z]+)\.png$/i.exec(name);
  if (!match) return null;
  return { number: Number(match[1]), gender: match[2].toLowerCase() };
}

/** One portrait, mapped onto the look it is a portrait of. */
export interface MappedPortrait {
  file: ImportFile;
  number: number;
  gender: string;
  lookId: string;
  label: string;
}

export interface PortraitMapping {
  portraits: MappedPortrait[];
  problems: Problem[];
}

/**
 * **The mapping from the captain's numbering onto the look ids, derived once
 * and printed.**
 *
 * The rule is **by number within a gender**: the captain's `03-girl` is the
 * book's third girl look, because the book lists its girl looks in the
 * captain's own order. Nothing else is available — a PNG of a baby's head says
 * nothing about which girl look it is — and the alternative is somebody
 * matching fourteen babies to fourteen ids by eye, once, with no record of how.
 *
 * So the mapping is derived from **the book's own look order and the filename's
 * own number and gender**, which means it cannot drift from the list it maps
 * onto, and `scripts/import-artwork.ts` prints the whole table every time it
 * runs. `docs/artwork.md` is that table written down, which is what makes it
 * reviewable. It comes out as the identity — `03-girl` → `girl-03` — and that is
 * on purpose (`templates/first-book.ts` § `LOOKS`), but it is still read off the
 * book rather than spelled, so a reordered or renamed look moves the mapping
 * with it.
 *
 * **By number and not by position**, which is the one thing here worth being
 * careful about: a folder holding only `05-girl.png` is the fifth girl look and
 * not the first. Position would quietly make it the first, which is the kind of
 * mistake that is invisible until a buyer gets the wrong baby — and it is the
 * same indexing `scripts/import-artwork.ts` § `resolveLook` already does for
 * `npm run artwork -- look <dir> 05-girl`.
 */
export function portraitMapping(book: BookTemplate, files: ImportFile[]): PortraitMapping {
  const problems: Problem[] = [];
  const portraits: MappedPortrait[] = [];
  const say = (code: string, where: string, detail: string) =>
    problems.push({ code, where, detail });

  const parsed: Array<{ file: ImportFile; name: PortraitName }> = [];
  for (const file of files) {
    const name = portraitName(file.name);
    if (!name) {
      say("portrait.nameUnrecognised", file.name, "expected NN-gender.png, e.g. 01-girl.png");
      continue;
    }
    parsed.push({ file, name });
  }

  const byGender = new Map<string, Array<{ file: ImportFile; name: PortraitName }>>();
  for (const entry of parsed) {
    const list = byGender.get(entry.name.gender) ?? [];
    list.push(entry);
    byGender.set(entry.name.gender, list);
  }

  for (const [gender, entries] of byGender) {
    const looks: Look[] = book.looks.filter((l) => l.gender === gender);
    if (looks.length === 0) {
      say(
        "portrait.genderUnknown",
        gender,
        `no look of this book is tagged "${gender}"; the book offers ` +
          `${[...new Set(book.looks.map((l) => l.gender ?? "untagged"))].join(", ")}`,
      );
      continue;
    }
    entries.sort((a, b) => a.name.number - b.name.number);
    const seen = new Set<number>();
    for (const entry of entries) {
      if (seen.has(entry.name.number)) {
        say("portrait.duplicateNumber", entry.file.name, `two files are ${gender} number ${entry.name.number}`);
        continue;
      }
      seen.add(entry.name.number);
      const look = looks[entry.name.number - 1];
      if (!look) {
        say(
          "portrait.noLookForNumber",
          entry.file.name,
          `${gender} number ${entry.name.number} is past the end of the book's ` +
            `${looks.length} ${gender} looks`,
        );
        continue;
      }
      portraits.push({
        file: entry.file,
        number: entry.name.number,
        gender,
        lookId: look.id,
        label: look.label,
      });
    }
  }

  // Reported in the book's own order: by gender as the book lists them, then by
  // the captain's number. Sorting by number alone was right only while the
  // numbers were globally unique — the first set ran 01–06 for the girls and
  // 07–12 for the boys — and would now interleave the two genders, which is a
  // table nobody can read.
  const order = (gender: string) => book.looks.findIndex((l) => l.gender === gender);
  portraits.sort((a, b) => order(a.gender) - order(b.gender) || a.number - b.number);
  return { portraits, problems };
}

/**
 * What a portrait has to be, once it has been flattened.
 *
 * Deliberately **not** the page contract: a portrait is not a page and holding
 * it to 3600 × 3600 would refuse every one of them. What matters about a
 * tile is that it is square — the chooser's box is — that it is 8-bit PNG so a
 * browser draws it the same everywhere, and that the flattening actually
 * happened.
 */
export function portraitAgainstContract(file: ImportFile, where: string): Problem[] {
  const out: Problem[] = [];
  const say = (code: string, detail: string) => out.push({ code, where, detail });

  let header;
  try {
    header = readPngHeader(file.bytes);
  } catch (error) {
    say("portrait.notPng", error instanceof NotAPng ? error.message : "could not be read as a PNG");
    return out;
  }
  if (header.width !== header.height) {
    say("portrait.notSquare", `${header.width} × ${header.height}; the chooser's box is square`);
  }
  if (header.bitDepth !== 8) say("portrait.notEightBit", `bit depth ${header.bitDepth}`);
  if (hasAlphaChannel(header.colourType)) {
    say(
      "portrait.hasAlpha",
      `colour type ${header.colourType} still carries an alpha channel; it should have been ` +
        "flattened onto white",
    );
  }
  if (pngChunkTypes(file.bytes).includes("iCCP")) {
    say("portrait.notSrgb", "an embedded ICC profile; the contract is sRGB");
  }
  return out;
}

// ---------------------------------------------------------------------------
// The two pixel operations
// ---------------------------------------------------------------------------

/**
 * The same picture, composited onto white, with no alpha channel at all.
 *
 * **Straight alpha, onto white, per channel**: `c · a + 255 · (1 − a)`. pngjs
 * decodes to unassociated alpha, so the colour has not been premultiplied and
 * this is the whole of the compositing.
 *
 * White and not cream, even though the book's ground is cream: the portrait is
 * a tile in a white-ish chooser, the captain generated them on white, and the
 * edge pixels were anti-aliased against white — compositing them onto anything
 * else is what produces a visible halo.
 *
 * The output is **colour type 2** and carries an `sRGB` chunk, so "we chose
 * sRGB" is a fact in the file rather than a convention somebody else maintains
 * (`lib/render/png.ts` § `withSrgbChunk`).
 */
export function flattenOntoWhite(bytes: Uint8Array): Uint8Array {
  const read = PNG.sync.read(Buffer.from(bytes));
  const out = new PNG({ width: read.width, height: read.height });
  for (let i = 0; i < read.width * read.height; i++) {
    const at = i * 4;
    const a = read.data[at + 3] / 255;
    for (let c = 0; c < 3; c++) {
      out.data[at + c] = Math.round(read.data[at + c] * a + 255 * (1 - a));
    }
    out.data[at + 3] = 255;
  }
  return withSrgbChunk(
    new Uint8Array(PNG.sync.write(out, { colorType: 2, inputHasAlpha: true, bitDepth: 8 })),
  );
}

/**
 * The right half of a spread.
 *
 * **The only half that is needed.** Every left page of this book is the quiet
 * half — the words — and is identical to the real artwork; the child is on the
 * right. Importing both halves would import the left pages a second time at a
 * quarter of the resolution, under a type that says they can never be printed,
 * which is a worse version of a page that already exists.
 *
 * An odd width is refused rather than rounded: half of 1775 is not a column of
 * pixels, and a spread that is not an even number of pixels wide has been
 * resized by something that did not know it was a spread.
 */
export class NotASpread extends Error {}

export function rightHalfOf(bytes: Uint8Array): Uint8Array {
  const read = PNG.sync.read(Buffer.from(bytes));
  if (read.width % 2 !== 0) {
    throw new NotASpread(`a spread ${read.width} px wide has no middle column`);
  }
  const half = read.width / 2;
  const out = new PNG({ width: half, height: read.height });
  for (let y = 0; y < read.height; y++) {
    for (let x = 0; x < half; x++) {
      const from = (y * read.width + half + x) * 4;
      const to = (y * half + x) * 4;
      out.data[to] = read.data[from];
      out.data[to + 1] = read.data[from + 1];
      out.data[to + 2] = read.data[from + 2];
      out.data[to + 3] = 255;
    }
  }
  return withSrgbChunk(
    new Uint8Array(PNG.sync.write(out, { colorType: 2, inputHasAlpha: true, bitDepth: 8 })),
  );
}

// ---------------------------------------------------------------------------
// The golden ghost halves
// ---------------------------------------------------------------------------

/** `spread-01.png` … `spread-12.png`, which is how the captain names them. */
const SPREAD_FILE = /^spread-(\d{1,2})\b.*\.png$/i;

export function spreadNumberOf(name: string): number | null {
  const match = SPREAD_FILE.exec(name);
  return match ? Number(match[1]) : null;
}
