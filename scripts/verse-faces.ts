/**
 * **The interior verses' candidate faces, as pictures of the real spreads.**
 *
 *     npm run verse-faces                          # sheets, full-size pages, the table
 *     npm run verse-faces -- --name Charlotte-Rose # a different name in the verses
 *     npm run verse-faces -- --table               # the table alone, no pictures
 *     npm run verse-faces -- --full                # every look, not just the first
 *     npm run verse-faces -- --out ./somewhere
 *
 * The captain asked on 19 November whether the book's font can change too,
 * having just chosen a face for the cover. The verses are set in Special Elite
 * — a distressed 1940s typewriter face, on eleven pages of a baby's
 * first-birthday book — so the question is a fair one. **This command does not
 * answer it and nothing it writes switches anything.** It renders the real
 * interior spreads with the verses in every vendored face and prints what the
 * pictures cannot show.
 *
 * It is `scripts/cover-faces.ts` for the other half of the book and it is
 * deliberately the same shape: the real page, the one renderer, the print
 * file's own resolution, the measurement first and the gate before the
 * directories. What differs is the question. A cover title is three words and
 * the thing that can go wrong is a name running off the panel; a verse is six
 * lines a parent reads aloud, and the things that can go wrong are a line that
 * will not fit, a size that has to come down to make it fit, and a face that
 * fits perfectly and is too heavy to read. `lib/book/verse-fit.ts` measures all
 * three.
 *
 * **The spreads, not the pages.** A verse sits on the left half of a spread and
 * the child is drawn on the right half, so a picture of the left page alone
 * shows the words against half the thing they are set on. Each tile here is the
 * spread: two real pages, side by side, in the order the book is bound. The
 * composition is this script's — `lib/book/fold.ts`'s rule turned around, as
 * `scripts/cover-faces.ts` § `sheetSvg` argues: a contact sheet is not a page
 * of any book, no `PageTemplate` describes one, and a treatment the renderer
 * has never heard of is not an option on the render call.
 *
 * Nothing it writes is committed. `.artwork/` is in `.gitignore` and these are
 * a family's artwork.
 *
 * **One face in the lineup is not vendored, and that is the point of it.**
 * Baloo 2 is vendored at ExtraBold, because it was chosen as a *display* face
 * for three words. The measurement below says ExtraBold puts about half again
 * as much ink on a page as Special Elite does, which is the whole of the
 * "too heavy for body text" worry as a number — so the comparison needs the
 * same family at a text weight to be worth having. Baloo 2's lighter weights
 * exist only in its variable file, which this repository does not vendor and
 * `lib/render/fonts.ts` must not learn about for the sake of a measurement. So
 * it is drawn from the file `BALOO2_VARIABLE_TTF` names, by this script's own
 * rasteriser, and measured with `lib/book/verse-fit.ts` § `inkBetween` so its
 * numbers are the same numbers as every other row's. With the variable unset
 * the row is skipped and the sheet says so. `docs/verse-face.md` § The lighter
 * Baloo has the URL to fetch.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import {
  bookAsDelivered,
  looksWithInteriorPages,
  releaseArtworkFor,
  releaseStoreFromEnv,
} from "../lib/artwork/release";
import { printProblems, problemReport } from "../lib/book/print";
import { pageFillFor, pageSequence, pageTemplateFor, spreads } from "../lib/book/derive";
import { renderPrintPng } from "../lib/render/raster";
import { atRenderWidth } from "../lib/book/title-fit";
import {
  VERSE_RENDER_WIDTH,
  bandContrastIn,
  inkBetween,
  longestVerse,
  verseBlanksFor,
  verseFitFor,
  verseLines,
  versePages,
  versePairSvg,
  verseSlotOn,
  versesIn,
  xHeightOf,
} from "../lib/book/verse-fit";
import { checkName, facesTheNameIsSetIn, nameLimit } from "../lib/book/name";
import { FACES } from "../lib/render/fonts";
import { maxCharsPerLineOf } from "../lib/template/defaults";
import type { BookFill, BookTemplate } from "../lib/book/types";
import type { Problem } from "../lib/template/validate";
import type { BandContrast, PageInk, VerseFit } from "../lib/book/verse-fit";

const OUT = path.join(process.cwd(), ".artwork", "verse-faces");

/** One page of a sheet tile. A spread is two of these, so a tile is twice as wide. */
const SHEET_PAGE_PX = 460;

/** The width the x-height is measured at: one render pair per face, so it can be fine. */
const X_HEIGHT_PX = 3600;

/** The name the pictures are drawn with unless `--name` says otherwise. */
const ORDINARY = "Matilda";

/** A real name of exactly `nameLimit` characters — what the captain would actually see. */
const LONGEST_REAL = "Charlotte-Rose";

/** The file a lighter Baloo 2 is drawn from, when this machine has one. */
const BALOO_VAR = "BALOO2_VARIABLE_TTF";

/** The key the reference row is filed under. Not a face key: nothing registers it. */
const REFERENCE = "baloo-text";

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  const next = process.argv[at + 1];
  return at === -1 || next === undefined || next.startsWith("--") ? undefined : next;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The names the "refuses" column probes, each a real one and each a different
 * part of a `cmap`.
 *
 * Reported per face rather than asserted, because which of them the shop can
 * accept is a product decision the captain is making by choosing a face.
 * `lib/book/name.ts` § `facesTheNameIsSetIn` adds the face of any slot whose
 * copy carries `{name}`, and ten of the eleven verses do — so **the verse face
 * decides which names the shop will take**, exactly as the cover's does. This
 * is the half of the question a picture of one name cannot show at all.
 */
const NAMES = [
  { label: "plain", name: "Matilda" },
  { label: "curly apostrophe", name: "O’Brien" },
  { label: "accent", name: "Zoé" },
  { label: "Polish", name: "Żaneta" },
  { label: "Czech", name: "Řehoř" },
  { label: "Turkish", name: "Gülşen" },
  { label: "Vietnamese", name: "Nguyễn" },
];

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

interface Verdict {
  key: string;
  family: string;
  licence: string;
  /** Absent for the reference row, which no registry entry describes. */
  candidate?: string;
  /**
   * **Two fits, because there are two questions — and here they agree.**
   *
   * `guaranteed` is `nameLimit`'s worth of `M`, the widest name the form will
   * accept, which is `validateBook`'s own worst case and
   * `test/book-verses.test.ts`'s. `likely` is a real hyphenated name of the
   * same length. They part company far less than on the cover, because the
   * widest line of the copy carries **no name at all** — spread five's *"With
   * your bear tucked in close…"*, the same string for every buyer. Both are
   * reported and the fact that they agree is itself the finding: the verses'
   * fit is a property of the captain's copy and not of a buyer's name.
   */
  guaranteed: VerseFit;
  likely: VerseFit;
  /** The x-height in points at the declared size, measured as ink. */
  xHeight: number | null;
  /** Which of `NAMES` the shop would still accept with the verses in this face. */
  accepts: string[];
  refuses: string[];
  /** True for the row drawn from a file nothing in this repository vendors. */
  reference: boolean;
}

/**
 * The reference row: the same eleven measurements, in a face the print path
 * cannot reach.
 *
 * It renders each page pair through `versePairSvg`, re-points the family on the
 * string, rasterises both halves here with only that one file loaded, and hands
 * the pixels to the **shared** `inkBetween`. So the row is comparable and the
 * file is still unreachable from `FACES`, from a template and from
 * `lib/book/print.ts`.
 */
async function referenceFit(
  book: BookTemplate,
  fill: BookFill,
  ttf: string,
  family: string,
): Promise<VerseFit> {
  const indices = versePages(book);
  const first = verseSlotOn(pageSequence(book)[indices[0]]);
  const draw = (svg: string, width: number) =>
    new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { loadSystemFonts: false, fontFiles: [ttf] },
      background: book.page.canvas.background,
    }).render();

  const pages: PageInk[] = [];
  for (const index of indices) {
    const page = pageSequence(book)[index];
    const slot = verseSlotOn(page);
    const pair = await versePairSvg(book, fill, index, { renderWidth: VERSE_RENDER_WIDTH });
    const printed = draw(
      pair.printed.replaceAll(`font-family="${pair.family}"`, `font-family="${family}"`),
      VERSE_RENDER_WIDTH,
    );
    const blank = draw(pair.blank, VERSE_RENDER_WIDTH);
    const got = inkBetween(
      { rgba: new Uint8Array(printed.pixels), width: printed.width },
      { rgba: new Uint8Array(blank.pixels), width: blank.width },
      pair.scale,
      pair.colour,
    );
    const ink = got?.box ?? null;
    pages.push({
      index,
      id: page.id,
      frame: slot.frame,
      ink,
      area: got?.area ?? 0,
      spare: ink === null ? -Infinity : slot.frame.width - ink.width,
      above: ink === null ? -Infinity : slot.frame.y - ink.y,
      below: ink === null ? -Infinity : ink.y + ink.height - (slot.frame.y + slot.frame.height),
      // Nothing in this lineup comes within 70 pt of the page edge at the
      // declared size, and a reference row is drawn at the declared size only.
      clipped: false,
    });
  }

  const widest = pages.reduce((worst, p) => (p.spare < worst.spare ? p : worst));
  const tolerance = first.size * 0.3 + 1;
  const tallOn = pages
    .filter((p) => p.ink !== null && (p.above > tolerance || p.below > tolerance))
    .map((p) => p.id);
  const drewNothing = pages.filter((p) => p.ink === null).map((p) => p.id);
  return {
    font: REFERENCE,
    family,
    size: first.size,
    lineHeight: first.lineHeight ?? first.size,
    box: { x: first.frame.x, width: first.frame.width, height: first.frame.height },
    name: fill.name ?? "",
    pages,
    widest,
    spare: widest.spare,
    area: pages.reduce((sum, p) => sum + p.area, 0) / pages.length,
    clipped: false,
    tolerance,
    above: Math.max(...pages.map((p) => p.above)),
    below: Math.max(...pages.map((p) => p.below)),
    tallOn,
    drewNothing,
    marksHold: drewNothing.length === 0 && tallOn.length === 0,
    // A reference row is for looking at. The size it would need, if it needed
    // one, is a question for the day somebody vendors it.
    needsSize: null,
  };
}

/**
 * The reference face's x-height, measured the same way the registered faces'
 * are — one verse page with its copy replaced by a single `x`.
 *
 * `lib/book/verse-fit.ts` § `xHeightOf` cannot be reused here because it ends
 * in the shared rasteriser, which has no such family. So the page is built the
 * same way, drawn here, and the ink's own height is read out of the
 * difference — which keeps the column comparable instead of leaving a dash in
 * it that a reader has to guess at.
 */
async function referenceXHeight(
  book: BookTemplate,
  fill: BookFill,
  ttf: string,
  family: string,
): Promise<number | null> {
  const index = versePages(book)[0];
  const id = pageSequence(book)[index].id;
  const single: BookTemplate = {
    ...book,
    pages: book.pages.map((page) => (page.id === id ? { ...page, story: "x" } : page)),
  };
  const pair = await versePairSvg(single, fill, index, { renderWidth: X_HEIGHT_PX });
  const draw = (svg: string) =>
    new Resvg(svg, {
      fitTo: { mode: "width", value: X_HEIGHT_PX },
      font: { loadSystemFonts: false, fontFiles: [ttf] },
      background: book.page.canvas.background,
    }).render();
  const printed = draw(pair.printed.replaceAll(`font-family="${pair.family}"`, `font-family="${family}"`));
  const blank = draw(pair.blank);
  const got = inkBetween(
    { rgba: new Uint8Array(printed.pixels), width: printed.width },
    { rgba: new Uint8Array(blank.pixels), width: blank.width },
    pair.scale,
    pair.colour,
  );
  // In points, at the slot's declared size. The caller divides by that size to
  // get ems, exactly as it does for every registered face.
  return got === null ? null : got.box.height;
}

/**
 * One fit in a phrase.
 *
 * Three outcomes and they are genuinely different: inside the box the captain's
 * arithmetic drew; past it, which means the type size comes down and is a
 * different design decision; and nothing drawn at all, which is a face the
 * rasteriser could not find.
 */
function phrase(fit: VerseFit): string {
  if (fit.drewNothing.length) return "DREW NOTHING";
  if (fit.spare >= 0) return `fits, ${fit.spare.toFixed(0)} pt spare`;
  return `${(-fit.spare).toFixed(0)} pt over the box, needs ${fit.needsSize} pt`;
}

/** How this face's colour compares with the one the book is on, as a percentage. */
function colourAgainst(fit: VerseFit, today: VerseFit): string {
  const change = (fit.area / today.area - 1) * 100;
  if (Math.abs(change) < 1.5) return "the same ink as today";
  return `${change > 0 ? "+" : ""}${change.toFixed(0)}% ink`;
}

// ---------------------------------------------------------------------------
// The pictures
// ---------------------------------------------------------------------------

/** One real page, in one face, at one width. */
async function pagePng(
  book: BookTemplate,
  key: string,
  index: number,
  fill: BookFill,
  width: number,
): Promise<Uint8Array> {
  const sized = atRenderWidth(versesIn(book, key), width);
  const { png } = await renderPrintPng(
    pageTemplateFor(sized, index, { lookId: fill.lookId }),
    pageFillFor(sized, index, fill),
  );
  return png;
}

/**
 * The same page drawn in the unvendored reference face, by this script's own
 * rasteriser — or drawn normally when the page carries no verse at all.
 *
 * **The right half of a spread has no verse slot**, which is the whole shape of
 * the book: the words go on the left page and the child is drawn on the right
 * (`templates/first-book.ts` § `interior`). A face is therefore not a fact
 * about that half, and asking for its verse's family is asking for something
 * that is not there — it threw, and left the sheets half-written. So the
 * reference path falls through to the ordinary renderer for a page with
 * nothing to re-face, which also means the two halves of a reference tile are
 * drawn by two rasterisers and look identical, because only one of them has
 * any type on it.
 */
async function referencePagePng(
  book: BookTemplate,
  index: number,
  fill: BookFill,
  width: number,
  ttf: string,
  family: string,
): Promise<Uint8Array> {
  // A page with no verse is the same picture in every face, so which key is
  // asked for cannot matter — `versesIn` finds no slot to change on it.
  if (!versePages(book).includes(index)) return pagePng(book, REFERENCE, index, fill, width);
  const pair = await versePairSvg(book, fill, index, { renderWidth: width });
  const svg = pair.printed.replaceAll(`font-family="${pair.family}"`, `font-family="${family}"`);
  return new Uint8Array(
    new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { loadSystemFonts: false, fontFiles: [ttf] },
      background: book.page.canvas.background,
    })
      .render()
      .asPng(),
  );
}

interface Tile {
  /** The spread, left half then right half. */
  halves: Uint8Array[];
  title: string;
  note: string;
  verdict: string;
  /** The face the verses are on today, which a comparison needs marked. */
  today: boolean;
}

/**
 * The contact sheet: one spread per tile, each labelled underneath.
 *
 * Two tiles a row, because a tile is a spread and a spread is twice as wide as
 * a page. Labels are set in `typewriter` for `scripts/cover-faces.ts`
 * § `sheetSvg`'s reason, which is sharper here than there: the labels name the
 * face the book is on today, and setting them in a candidate would be arguing.
 */
function sheetSvg(tiles: Tile[], heading: string, subheading: string): string {
  const pad = 30;
  const label = 92;
  const columns = 2;
  const tileWidth = SHEET_PAGE_PX * 2;
  const rows = Math.ceil(tiles.length / columns);
  const head = 104;
  const width = pad + columns * (tileWidth + pad);
  const height = head + pad + rows * (SHEET_PAGE_PX + label + pad);

  const cell = (tile: Tile, at: number) => {
    const col = at % columns;
    const row = (at - col) / columns;
    const x = pad + col * (tileWidth + pad);
    const y = head + pad + row * (SHEET_PAGE_PX + label + pad);
    const halves = tile.halves
      .map(
        (png, half) =>
          `<image x="${x + half * SHEET_PAGE_PX}" y="${y}" width="${SHEET_PAGE_PX}" ` +
          `height="${SHEET_PAGE_PX}" href="data:image/png;base64,${Buffer.from(png).toString("base64")}"/>`,
      )
      .join("");
    const mark = tile.today
      ? `<rect x="${x - 7}" y="${y - 7}" width="${tileWidth + 14}" height="${SHEET_PAGE_PX + 14}" ` +
        `fill="none" stroke="#B4553A" stroke-width="7"/>`
      : "";
    const line = (text: string, down: number, size: number, fill: string) =>
      `<text x="${x}" y="${y + SHEET_PAGE_PX + down}" font-family="Special Elite" ` +
      `font-size="${size}" fill="${fill}">${esc(text)}</text>`;
    return (
      mark +
      halves +
      line(tile.title, 32, 25, "#2A1C12") +
      line(tile.note, 58, 17, "#6B5A4A") +
      line(tile.verdict, 82, 17, "#6B5A4A")
    );
  };

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#FBF6EC"/>` +
    `<text x="${pad}" y="48" font-family="Special Elite" font-size="31" fill="#2A1C12">` +
    `${esc(heading)}</text>` +
    `<text x="${pad}" y="80" font-family="Special Elite" font-size="18" fill="#6B5A4A">` +
    `${esc(subheading)}</text>` +
    tiles.map(cell).join("") +
    `</svg>`
  );
}

function rasteriseSheet(svg: string, width: number): Uint8Array {
  return new Uint8Array(
    new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: {
        loadSystemFonts: false,
        fontFiles: Object.values(FACES).map((f) => path.join(process.cwd(), "public", f.file)),
      },
      background: "#FBF6EC",
    })
      .render()
      .asPng(),
  );
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * **Whether the print path will draw these spreads at all — asked once, before
 * a single byte is written.**
 *
 * Every picture here is a real page, so a book the print path refuses is a
 * picture of nothing. `scripts/cover-faces.ts` § `refusalsIn` is the whole
 * argument and the 19 November failure it was written for: one code printed
 * three hundred and thirty-six times, two empty directories, and a report of
 * success. The problems are deduplicated across faces because `validateBook` is
 * a statement about the book and every look's artwork at once, and the count of
 * refused combinations is kept because *how much of the sheet is gone* is a
 * different fact from *what is wrong*.
 *
 * A change of verse face cannot by itself make a book unprintable — a character
 * count is face-independent, which is the very gap this command exists to cover
 * — so this is expected to find nothing, and it is here for the case where the
 * artwork store is the thing that is wrong.
 */
function refusalsIn(book: BookTemplate, faces: string[], looks: string[], name: string) {
  const seen = new Map<string, Problem>();
  const refusedFaces = new Set<string>();
  let combinations = 0;
  for (const face of faces) {
    const inFace = versesIn(book, face);
    for (const lookId of looks) {
      const problems = printProblems(inFace, { ...FIXTURE_BOOK_FILL, lookId, name });
      if (problems.length === 0) continue;
      combinations++;
      refusedFaces.add(face);
      for (const p of problems) {
        const key = `${p.code} ${p.where} ${p.detail}`;
        if (!seen.has(key)) seen.set(key, p);
      }
    }
  }
  if (combinations === 0) return null;
  return { problems: [...seen.values()], combinations, faces: [...refusedFaces] };
}

/**
 * **The spreads a sheet is made of, and why each one.**
 *
 * Asked of the book rather than listed, so a re-marked verse or a re-measured
 * widest line moves the choice instead of leaving a stale one:
 *
 *  - the page every fit is decided on, which is the widest-setting verse;
 *  - the highest mark and the lowest, which are the two the captain's own hand
 *    put furthest from the middle of the page and so the two where an ascent or
 *    a descent has least room — `templates/first-book.ts` § `VERSE_TOP_ON`.
 *
 * Deduplicated, because the widest verse may well also be an extreme, and
 * `spreads()` is what turns a page into its pair.
 */
function sheetSpreads(book: BookTemplate, today: VerseFit) {
  const pairFor = (index: number) => spreads(book).find((s) => s.includes(index)) ?? [index];
  const tops = [...today.pages].sort((a, b) => a.frame.y - b.frame.y);
  const wanted = [
    { page: today.widest, why: "the widest verse in the book" },
    { page: tops[0], why: `the highest mark, at y ${tops[0].frame.y}` },
    { page: tops[tops.length - 1], why: `the lowest mark, at y ${tops[tops.length - 1].frame.y}` },
  ];
  const seen = new Set<string>();
  return wanted
    .filter((w) => (seen.has(w.page.id) ? false : (seen.add(w.page.id), true)))
    .map((w) => ({
      slug: w.page.id,
      label: `${w.page.id} — ${w.why}`,
      indices: pairFor(w.page.index),
    }));
}

// ---------------------------------------------------------------------------

async function main() {
  const out = arg("out") ?? OUT;
  const name = arg("name") ?? ORDINARY;
  const everyLook = process.argv.includes("--full");
  const tableOnly = process.argv.includes("--table");
  const ttf = process.env[BALOO_VAR];

  const store = releaseStoreFromEnv(process.env);
  const art = await releaseArtworkFor(FIRST_BOOK, store);
  const delivered = await bookAsDelivered(FIRST_BOOK, store);
  const withPages = looksWithInteriorPages(FIRST_BOOK, art);
  console.log(`artwork store: ${art.describe}`);
  if (withPages.length === 0) {
    console.error(
      "No look has delivered interior pages, so every spread here would be the drawn\n" +
        "placeholder and the comparison would be about a flat colour rather than about a page of\n" +
        "the captain's artwork with words on it. The verse band is the artwork's\n" +
        "(docs/look-upload-contract.md § 3) and judging a face against a drawn square judges\n" +
        "nothing.\n" +
        "Import one first: npm run artwork -- look <dir> <look-id>  (docs/artwork.md § 6b)",
    );
    process.exitCode = 1;
    return;
  }
  console.log(`${withPages.length} look(s) with interior pages: ${withPages.join(", ")}`);

  const limit = nameLimit(FIRST_BOOK);
  const worst = "M".repeat(limit);
  const lookId = withPages[0];
  const base: BookFill = { ...FIXTURE_BOOK_FILL, lookId };

  // -------------------------------------------------------------------------
  // The measurement, first: it is cheap next to the pictures, and a face that
  // draws nothing should be reported before a hundred megabytes are written.
  // -------------------------------------------------------------------------
  const keys = Object.keys(FACES);
  const verse = verseLines(FIRST_BOOK);
  const longest = longestVerse(FIRST_BOOK, worst);
  console.log(
    `\n${versePages(FIRST_BOOK).length} verses, ${verse.lines} lines each, longest ` +
      `${longest.chars} characters on ${longest.id}; the name limit is ${limit}`,
  );

  // The blank half of every difference is face-independent, so the eleven
  // wordless pages are rendered once and every row below is measured against
  // the same ones.
  const blanks = await verseBlanksFor(delivered, { ...base, name: worst });

  /**
   * **What the verses are set on, before a word is said about faces.**
   *
   * Free: the blank half of every difference is a picture of exactly the band
   * the words land in. It is reported first because it decides how to read the
   * ink column — on a light ground more ink is weight, on this one it is also
   * contrast, and the brief promised the first.
   */
  const bands = bandContrastIn(delivered, blanks);
  const worstBand = bands.reduce((low, b) => (b.ratio < low.ratio ? b : low));
  console.log(
    `\nthe band the verses are set on, ${lookId}: ` +
      `${worstBand.ratio.toFixed(2)}:1 at its worst (${worstBand.id}), ` +
      `${(bands.reduce((s, b) => s + b.ratio, 0) / bands.length).toFixed(2)}:1 on average, ` +
      `against ${verseSlotOn(pageSequence(delivered)[versePages(delivered)[0]]).colour} ink`,
  );

  const verdicts: Verdict[] = [];
  // Logged as each face lands rather than when the table is ready. The table
  // needs today's row to compute the ink column against, so it cannot be
  // printed as it goes — and eleven faces by twenty-two renders is minutes of
  // a command that would otherwise print nothing at all while it worked.
  console.log(`measuring ${keys.length} face(s) over ${versePages(FIRST_BOOK).length} pages each`);
  for (const key of keys) {
    const face = FACES[key];
    const started = Date.now();
    const guaranteed = await verseFitFor(delivered, base, key, { name: worst, blanks });
    const likely = await verseFitFor(delivered, base, key, { name: LONGEST_REAL, blanks });
    const xHeight = await xHeightOf(delivered, base, key, guaranteed.size, {
      renderWidth: X_HEIGHT_PX,
    });
    const book = versesIn(FIRST_BOOK, key);
    const accepts: string[] = [];
    const refuses: string[] = [];
    for (const probe of NAMES) (checkName(book, probe.name).ok ? accepts : refuses).push(probe.label);
    verdicts.push({
      key,
      family: face.family,
      licence: face.licence,
      candidate: face.candidate,
      guaranteed,
      likely,
      xHeight,
      accepts,
      refuses,
      reference: false,
    });
    console.log(`  ${face.family} — ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }

  if (ttf) {
    // The variable file's own family is "Baloo 2" — the same string the
    // ExtraBold static declares — which is why it is handed to a rasteriser
    // holding nothing else.
    verdicts.push({
      key: REFERENCE,
      family: `${FACES.baloo.family} (text weight)`,
      licence: FACES.baloo.licence,
      guaranteed: await referenceFit(delivered, { ...base, name: worst }, ttf, FACES.baloo.family),
      likely: await referenceFit(delivered, { ...base, name: LONGEST_REAL }, ttf, FACES.baloo.family),
      xHeight: await referenceXHeight(delivered, base, ttf, FACES.baloo.family),
      accepts: [],
      refuses: [],
      reference: true,
    });
  }

  const setIn = verseSlotOn(pageSequence(FIRST_BOOK)[versePages(FIRST_BOOK)[0]]).font;
  const today = verdicts.find((v) => v.key === setIn)!;
  for (const v of verdicts) {
    console.log(
      `  ${v.key.padEnd(14)} ${v.family.padEnd(22)} ` +
        `widest ${(v.guaranteed.widest.ink?.width.toFixed(0) ?? "—").padStart(4)} pt  ` +
        `${phrase(v.guaranteed).padEnd(34)} ` +
        `${LONGEST_REAL}: ${(v.likely.widest.ink?.width.toFixed(0) ?? "—").padStart(4)} pt  ` +
        `${colourAgainst(v.guaranteed, today.guaranteed).padEnd(22)} ` +
        `x-height ${v.xHeight === null ? "    —" : `${(v.xHeight / v.guaranteed.size).toFixed(3)} em`}  ` +
        `marks ${v.guaranteed.marksHold ? "hold" : `MOVE: ${v.guaranteed.tallOn.join(", ")}`}  ` +
        `refuses ${v.reference ? "—" : v.refuses.join(", ") || "nothing"}`,
    );
  }

  if (tableOnly) {
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, "README.md"), report(verdicts, today, withPages, name, Boolean(ttf), bands));
    console.log(`\n${path.join(out, "README.md")} has the table. No pictures: --table.`);
    return;
  }

  // The gate: before the directories, so a refusal really does leave nothing
  // behind rather than a folder somebody has to interpret.
  const refusal = refusalsIn(delivered, keys, withPages, worst);
  if (refusal) {
    console.error(
      `\nNOTHING WAS WRITTEN. ${out} is unchanged.\n\n` +
        `The print path refuses this book for ${refusal.combinations} of the ` +
        `${keys.length * withPages.length} face-and-look combinations these sheets are made of: ` +
        `${refusal.faces.map((f) => FACES[f]?.family ?? f).join(", ")}. Every picture here is a ` +
        `real page, so there is nothing to draw until that is fixed.\n`,
    );
    for (const line of problemReport(refusal.problems).split("\n")) console.error(`  ${line}`);
    console.error(
      "\nWhat this machine actually holds:        npm run artwork -- status\n" +
        "The contract the sizes are held to:      docs/look-upload-contract.md § 2\n" +
        "The table is still worth having alone:   npm run verse-faces -- --table",
    );
    process.exitCode = 1;
    return;
  }

  await mkdir(path.join(out, "full"), { recursive: true });

  const chosenSpreads = sheetSpreads(delivered, today.guaranteed);
  console.log("\ncomparison sheets");
  for (const spread of chosenSpreads) {
    for (const look of everyLook ? withPages : [lookId]) {
      const file = `sheet-${spread.slug}-${look}.png`;
      const fill: BookFill = { ...base, lookId: look, name };
      const tiles: Tile[] = [];
      for (const v of verdicts) {
        const halves: Uint8Array[] = [];
        for (const index of spread.indices) {
          halves.push(
            v.reference && ttf
              ? await referencePagePng(delivered, index, fill, SHEET_PAGE_PX, ttf, FACES.baloo.family)
              : await pagePng(delivered, v.key, index, fill, SHEET_PAGE_PX),
          );
        }
        tiles.push({
          halves,
          title:
            `${v.family}${v.key === today.key ? "  — today" : ""}` +
            `${v.reference ? "  — not vendored" : ""}`,
          note: `${v.licence}${v.candidate || v.reference ? "" : "  · set in by the book"}`,
          verdict: `${phrase(v.guaranteed)}  ·  ${colourAgainst(v.guaranteed, today.guaranteed)}`,
          today: v.key === today.key,
        });
      }
      const png = rasteriseSheet(
        sheetSvg(
          tiles,
          `Interior verse faces · ${spread.label} · ${look} · “${name}”`,
          `The real spread, the captain’s delivered pages, the verse where they marked it at ` +
            `its declared ${today.guaranteed.size} pt. Outlined: the face the book is on today.` +
            (ttf ? "" : `  (no lighter Baloo 2: ${BALOO_VAR} unset)`),
        ),
        2 * (SHEET_PAGE_PX * 2 + 30) + 30,
      );
      await writeFile(path.join(out, file), png);
      console.log(`  ${file}  ${(png.length / 1024 / 1024).toFixed(1)} MB`);
    }
  }

  // -------------------------------------------------------------------------
  // The full-size renders of the page the fit is decided on
  // -------------------------------------------------------------------------
  const { width } = FIRST_BOOK.page.print.pixels;
  const decided = today.guaranteed.widest;
  console.log(`\nfull size (${width} px) · ${decided.id}, the page every fit above is decided on`);
  for (const v of verdicts) {
    const fill: BookFill = { ...base, name: worst };
    const png =
      v.reference && ttf
        ? await referencePagePng(delivered, decided.index, fill, width, ttf, FACES.baloo.family)
        : await pagePng(delivered, v.key, decided.index, fill, width);
    await writeFile(path.join(out, "full", `${decided.id}-${v.key}.png`), png);
  }
  console.log(
    `  full/${decided.id}-*.png  ${verdicts.length} file(s), with ${limit} M’s in the heading`,
  );

  await writeFile(path.join(out, "README.md"), report(verdicts, today, withPages, name, Boolean(ttf), bands));
  console.log(`\n${path.join(out, "README.md")} has the table and what every file is.`);
}

// ---------------------------------------------------------------------------

function report(
  verdicts: Verdict[],
  today: Verdict,
  looks: string[],
  name: string,
  reference: boolean,
  bands: BandContrast[],
): string {
  const slot = verseSlotOn(pageSequence(FIRST_BOOK)[versePages(FIRST_BOOK)[0]]);
  const limit = nameLimit(FIRST_BOOK);
  const verse = verseLines(FIRST_BOOK);
  const longest = longestVerse(FIRST_BOOK, "M".repeat(limit));
  const decided = today.guaranteed.widest;
  const faces = facesTheNameIsSetIn(FIRST_BOOK).map((f) => FACES[f]?.family ?? f);
  const count = versePages(FIRST_BOOK).length;
  const worstAbove = Math.max(...verdicts.map((v) => v.guaranteed.above));
  const worstBelow = Math.max(...verdicts.map((v) => v.guaranteed.below));

  const row = (v: Verdict) =>
    `| ${v.family}${v.key === today.key ? " **(today)**" : ""}` +
    `${v.reference ? " *(not vendored)*" : ""} | ${v.licence} | ` +
    `${v.guaranteed.widest.ink?.width.toFixed(0) ?? "—"} | ${phrase(v.guaranteed)} | ` +
    `${v.likely.widest.ink?.width.toFixed(0) ?? "—"} | ` +
    `${v.guaranteed.area.toFixed(0)} | ${colourAgainst(v.guaranteed, today.guaranteed)} | ` +
    `${v.xHeight === null ? "—" : (v.xHeight / v.guaranteed.size).toFixed(3)} | ` +
    `${v.guaranteed.marksHold ? "hold" : `**move: ${v.guaranteed.tallOn.join(", ")}**`} | ` +
    `${v.reference ? "—" : v.refuses.join(", ") || "nothing"} |`;

  return [
    "# The interior verses' candidate faces",
    "",
    "Written by `npm run verse-faces`. **Nothing here is committed** — `.artwork/` is in",
    "`.gitignore` and these are a family's artwork. **Nothing here switches the book's face",
    `either**: the verses are set in ${today.family} until the captain picks.`,
    "",
    "## What the files are",
    "",
    `- \`sheet-<page>-<look>.png\` — one real spread, every face, labelled, with “${name}” in the verses.`,
    `- \`full/${decided.id}-<face>.png\` — the page every fit below is decided on, at the print`,
    `  file's own ${FIRST_BOOK.page.print.pixels.width} px, with ${limit} \`M\`s in the heading.`,
    "",
    `Looks shown: ${looks.join(", ")}.`,
    "",
    reference
      ? `The row marked *not vendored* is **${FACES.baloo.family} at its text weight**, drawn from the ` +
        `file \`${BALOO_VAR}\` names. Baloo 2 is vendored at ExtraBold only, because it was chosen ` +
        "as a display face for three words on a cover; its lighter weights live in a variable file " +
        "this repository does not carry. It is measured by the same `inkBetween` as every other " +
        "row, and the print path has no way to reach it."
      : `There is no lighter **${FACES.baloo.family}** row: set \`${BALOO_VAR}\` to a local copy of its ` +
        "variable file to get one. `docs/verse-face.md` has the URL.",
    "",
    "## The fit, measured",
    "",
    `Each verse is ${verse.lines} lines — a heading, a blank line and four rhyming lines — at`,
    `${slot.size} pt on a ${slot.lineHeight} pt line, in a box ${slot.frame.width} × ${slot.frame.height} pt.`,
    `The longest verse is ${longest.chars} characters with the longest name the form takes`,
    `(${longest.id}); the slot's \`maxCharsPerLine\` is ${maxCharsPerLineOf(slot)}.`,
    "",
    "Every width below is the **ink's own bounding box**, read out of a difference between two",
    "renders of the real page — `lib/book/verse-fit.ts`, which is `test/book-verses.test.ts`'s",
    "method applied per face. Three columns, because a change of face raises three separate",
    "questions:",
    "",
    `- **Across.** The box is ${slot.frame.width} pt and the widest-setting line is the binding one.`,
    `  *Which* line is widest is itself a property of the face, so all ${count} verses are`,
    "  measured and the worst is reported.",
    `- **Ink.** Coverage in square points, averaged over the ${count} pages — the *colour* of the`,
    "  block. This is the column the fit cannot reach: a face can fit the box at",
    `  ${slot.size} pt and still put half again as much ink on a page a parent reads aloud.`,
    "- **x-height.** In ems, measured as ink. A face that needs a smaller size is not thereby",
    "  smaller to read; these faces differ by a third between the smallest lowercase and the",
    "  largest, so “size” and “apparent size” are separate facts. It is an ink height and not",
    "  a font's declared figure, so about half a point of it is stroke weight —",
    "  `lib/book/verse-fit.ts` § `xHeightOf`.",
    "",
    `The \`“${LONGEST_REAL}”\` column is the same measurement with a real ${limit}-character name`,
    "instead of the worst case, and **the two agreeing is the finding**: the widest line of every",
    "verse carries no name at all, so unlike the cover the verses' fit is a property of the",
    "captain's copy rather than of a buyer's name. A row where they differed would mean a face so",
    "wide that a *heading* had become the binding line, which is the one way a buyer's name could",
    "start deciding the type size.",
    "",
    `| Face | Licence | Widest line (pt) | Fit at ${slot.size} pt | With “${LONGEST_REAL}” (pt) | Ink (sq pt) | vs today | x-height (em) | Captain's marks | Refuses |`,
    "|---|---|---|---|---|---|---|---|---|---|",
    ...verdicts.map(row),
    "",
    "## What the verses are set on, which decides how to read the ink column",
    "",
    "The captain's generation brief reserves the middle of the left page and asks for it *“soft,",
    "out of focus, light in value and low in detail so dark verse text can be added later”* —",
    "`docs/look-upload-contract.md` § 3. Read that and more ink is a pure cost. **Measured, the",
    "delivered band is not light**, so ink is contrast as well as weight and the column above has",
    "two readings rather than one.",
    "",
    "Per page, the WCAG ratio between the slot's declared ink and the mean of the pixels the verse",
    "is set over — a property of the **artwork**, identical for every face, and free to compute",
    "because it is the blank half of the difference every fit is already measured from",
    "(`lib/book/verse-fit.ts` § `bandContrastIn`). Nothing refuses a book on it.",
    "",
    `| Page | Band luminance | Contrast with the ink |`,
    "|---|---|---|",
    ...bands.map((b) => `| ${b.id} | ${b.luminance.toFixed(3)} | ${b.ratio.toFixed(2)}:1 |`),
    "",
    `Worst: **${bands.reduce((low, b) => (b.ratio < low.ratio ? b : low)).ratio.toFixed(2)}:1**, ` +
      `on ${looks[0]}. The other thirteen looks have no interior pages in this store, so their`,
    "bands are unmeasured — the same gap `docs/cover-face.md` § The corner carries the title",
    "records for the cover, and the same answer: a human, looking at the sheets, per look as it",
    "lands.",
    "",
    "## The captain's marks survive every face, and that is structural",
    "",
    "`templates/first-book.ts` § `VERSE_TOP_ON` is the captain's hand-marked position for each",
    "spread, measured off a rectangle they drew on 13 November. **No face in this table moves one,",
    "and no face could**: `lib/render/svg.ts` § `drawTextSlot` sets every line at an **absolute**",
    `baseline — \`frame.y + ${slot.baseline} + ${slot.lineHeight} × i\` — so where the block sits is`,
    "declared data and not a consequence of the face's metrics.",
    "",
    "What a face *can* change is how far the ink reaches above the first baseline and below the",
    "last, which is its ascent and descent. The marks column is that, measured per page against",
    `that page's own box, with the ${today.guaranteed.tolerance.toFixed(1)} pt allowance`,
    "`test/book-verses.test.ts` grants. Worst reach of any face in the table:",
    `${worstAbove.toFixed(1)} pt above its box and ${worstBelow.toFixed(1)} pt below — both`,
    `negative, so every face clears the ${slot.frame.height} pt box on every page with points to`,
    "spare. A face would need an ascent of about two ems to break out, which is not a thing a",
    "text face is.",
    "",
    "## “Refuses” is the half a picture cannot show",
    "",
    "`lib/book/name.ts` § `facesTheNameIsSetIn` adds the face of any slot whose authored copy",
    `carries \`{name}\`, and ten of the ${count} verses do — so **the verse face is one of the faces`,
    `every buyer's name is checked against**. Today that set is ${faces.join(" and ")}. A face that`,
    "refuses **Polish** would narrow what the shop accepts today; a face that writes **Vietnamese**",
    "would not widen it on its own, because the cover's face is checked too.",
    "",
    "Names probed: " + NAMES.map((n) => `*${n.name}* (${n.label})`).join(", ") + ".",
    "",
    "## The decision",
    "",
    "`docs/verse-face.md` is the recommendation and the reasoning. This file is the numbers it was",
    "made from, and re-running the command re-makes them.",
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
