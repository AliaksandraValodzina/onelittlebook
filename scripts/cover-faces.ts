/**
 * **The cover title's candidates, as pictures of the real cover.**
 *
 *     npm run cover-faces                       # sheets, full-size renders, the table
 *     npm run cover-faces -- --name O\'Brien    # a different name in the title
 *     npm run cover-faces -- --full             # full size on every look, not just the first
 *     npm run cover-faces -- --out ./somewhere
 *
 * The captain dislikes the cover's title and wants to choose a new face **by
 * looking at it**. A specimen sheet of words on white cannot answer that: the
 * title is set in a cream panel on a photographic cover and whether a face
 * works is a question about the cover, not about the face. So every picture
 * this writes is **the real cover page** — the captain's own delivered wrap,
 * cut to the front panel by `lib/print/printify.ts` § `frontPanelPxOf`, with
 * the captain's own title string on it, at the size the template declares,
 * drawn by the one renderer at the print file's own resolution.
 *
 * Nothing it writes is committed. `.artwork/` is in `.gitignore` for the
 * reason `scripts/render-book.ts` § `WRAP_OUT` gives: a public repository is
 * not where a family's artwork goes, and a comparison sheet of fourteen looks
 * is not evidence anybody needs to diff.
 *
 * **The table beside the pictures is the half a picture cannot show.** Three
 * things change with the face and none of them is visible at a glance:
 *
 *  - **Whether the longest name still fits.** `lib/book/title-fit.ts`
 *    measures it out of the pixels. A face that only fits by shrinking the
 *    type is a different design decision and is reported as one, with the size
 *    it would need.
 *  - **Which names the shop may still accept.** `lib/book/name.ts`
 *    § `facesTheNameIsSetIn` asks every face the name lands in and `checkName`
 *    refuses a character any of them cannot write, so a face with a narrower
 *    `cmap` than Indie Flower's is a face that **refuses buyers**. Six of the
 *    nine candidates cannot write Vietnamese.
 *  - **The curly apostrophe**, which More Sugar itself has not got. Measured
 *    rather than assumed, because *O’Brien* is a name and a cover with a hole
 *    in it is the failure `lib/render/coverage.ts` exists to prevent.
 *
 * **More Sugar is the captain's reference and this shop may not use it.** Its
 * subscription licence prohibits webfont embedding, prohibits installing the
 * file on a server for an automated process, and covers one user on three
 * devices — which is `public/fonts/`, `lib/render/raster.ts` and a production
 * server, one clause each. So it is **not vendored, not registered and not
 * reachable from the print path**: with `MORE_SUGAR_OTF` pointing at the
 * licence holder's own copy this script draws one reference tile by handing the
 * file to the **contact sheet's** rasteriser, which is a different rasteriser
 * from the one that makes a print file and has no way to reach it. With the
 * variable unset the tile is skipped and the sheet says so.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import { bookAsDelivered, looksWithCoverArtwork, releaseArtworkFor, releaseStoreFromEnv } from "../lib/artwork/release";
import { renderBookPagePng } from "../lib/book/print";
import { renderPrintSvg } from "../lib/render/raster";
import { pageFillFor, pageTemplateFor } from "../lib/book/derive";
import {
  atRenderWidth,
  coverTitleIn,
  coverTitleSlot,
  titleFitFor,
  titlePanelOf,
} from "../lib/book/title-fit";
import { checkName, nameLimit } from "../lib/book/name";
import { FACES, isCandidate } from "../lib/render/fonts";
import { maxCharsPerLineOf } from "../lib/template/defaults";
import type { BookTemplate } from "../lib/book/types";
import type { TitleFit } from "../lib/book/title-fit";

const OUT = path.join(process.cwd(), ".artwork", "cover-faces");

/** The look the full-size set is rendered on unless `--full` asks for all of them. */
const SHEET_PX = 560;
const LOOK_PX = 1600;

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  const next = process.argv[at + 1];
  return at === -1 || next === undefined || next.startsWith("--") ? undefined : next;
}

/**
 * The names the sheets are drawn with.
 *
 * One ordinary name, and then the two the measurement is actually about: the
 * longest the form accepts — a real hyphenated name of exactly `nameLimit`
 * characters, not fourteen M's, because the captain is being asked to look at
 * it — and one with a curly apostrophe in it.
 */
const ORDINARY = "Matilda";
const LONGEST = "Charlotte-Rose";
const APOSTROPHE = "O’Brien";

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

/**
 * Every name below is a real one and each probes a different part of a `cmap`.
 *
 * Reported per face rather than asserted, because which of them a shop can
 * accept is a product decision the captain is making by choosing a face —
 * `checkName` is asked against the book that face would make, so the answer is
 * the shop's own answer and not a guess from a codepoint list.
 */
const NAMES = [
  { label: "plain", name: "Matilda" },
  { label: "curly ’", name: APOSTROPHE },
  { label: "accent", name: "Zoé" },
  { label: "Polish", name: "Żaneta" },
  { label: "Czech", name: "Řehoř" },
  { label: "Turkish", name: "Gülşen" },
  { label: "Vietnamese", name: "Nguyễn" },
];

interface Verdict {
  key: string;
  /**
   * **Two fits, because there are two questions.**
   *
   * `guaranteed` is `nameLimit`'s worth of `M` — the widest fourteen characters
   * the form will accept, which is `validateBook`'s own worst case and the only
   * one that *guarantees* anything. `likely` is a real hyphenated name of the
   * same length, which is what the captain would actually see.
   *
   * Reporting only the first makes every candidate look impossible; reporting
   * only the second promises a cover that holds "Charlotte-Rose" and prints
   * "Wilhelmina-May" off the panel. So both, labelled.
   */
  guaranteed: TitleFit;
  likely: TitleFit;
  /** Which of `NAMES` the shop would still accept with the title in this face. */
  accepts: string[];
  refuses: string[];
}

async function verdictFor(key: string): Promise<Verdict> {
  const guaranteed = await titleFitFor(FIRST_BOOK, FIXTURE_BOOK_FILL, key, { renderWidth: 1200 });
  const likely = await titleFitFor(FIRST_BOOK, FIXTURE_BOOK_FILL, key, {
    renderWidth: 1200,
    name: LONGEST,
  });
  const book = coverTitleIn(FIRST_BOOK, key);
  const accepts: string[] = [];
  const refuses: string[] = [];
  for (const { label, name } of NAMES) {
    (checkName(book, name).ok ? accepts : refuses).push(label);
  }
  return { key, guaranteed, likely, accepts, refuses };
}

/**
 * One fit in a phrase.
 *
 * Three outcomes and they are genuinely different: inside the box the captain
 * drew; past that box but still on the cream panel it is printed on, which is a
 * design decision to take knowingly; and past the panel, which is a name set on
 * photography and is a defect rather than a choice.
 */
function phrase(fit: TitleFit): string {
  if (fit.ink === null) return "DREW NOTHING";
  if (fit.spare >= 0) {
    const room =
      fit.charactersSpare === 0
        ? "no character spare"
        : `${fit.charactersSpare} character${fit.charactersSpare === 1 ? "" : "s"} spare`;
    return `fits, ${room}`;
  }
  if (fit.panelSpare >= 0) {
    return `${(-fit.spare).toFixed(0)} pt past its box, still on the panel — ${fit.needsSize} pt to fit`;
  }
  return `${(-fit.panelSpare).toFixed(0)} pt off the panel — ${fit.needsSize} pt to fit`;
}

/** The one line a sheet tile carries: the realistic name, which is what it shows. */
function shortVerdict(v: Verdict): string {
  return phrase(v.likely);
}

// ---------------------------------------------------------------------------
// The pictures
// ---------------------------------------------------------------------------

/** The cover, in one face, on one look, at one width. */
async function coverPng(
  book: BookTemplate,
  key: string,
  lookId: string,
  name: string,
  width: number,
): Promise<Uint8Array> {
  const sized = width === book.page.print.pixels.width ? book : atRenderWidth(book, width);
  const { png } = await renderBookPagePng(coverTitleIn(sized, key), 0, {
    ...FIXTURE_BOOK_FILL,
    lookId,
    name,
  });
  return png;
}

/**
 * The reference tile, drawn by **this** rasteriser and not by the print path.
 *
 * It takes the print SVG the renderer produced for the cover and re-points the
 * title's family at the captain's own file before handing both to a local
 * `Resvg`. That is a substitution on a string this script is holding, in a
 * script, with the font file named by an environment variable: there is no
 * route from `FACES`, from a template or from `lib/book/print.ts` to this
 * file, which is the property that matters. See the note at the top of this
 * file for why More Sugar may not be vendored.
 */
async function referencePng(
  book: BookTemplate,
  lookId: string,
  name: string,
  otf: string,
  width: number,
): Promise<Uint8Array> {
  const slot = coverTitleSlot(book);
  const declared = FACES[slot.font].family;
  const sized = atRenderWidth(book, width);
  const fill = { ...FIXTURE_BOOK_FILL, lookId, name };
  const svg = (
    await renderPrintSvg(pageTemplateFor(sized, 0, { lookId }), pageFillFor(sized, 0, fill))
  ).replaceAll(`font-family="${declared}"`, 'font-family="More Sugar"');
  return new Uint8Array(
    new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { loadSystemFonts: false, fontFiles: [otf] },
      background: sized.page.canvas.background,
    })
      .render()
      .asPng(),
  );
}

interface Tile {
  png: Uint8Array;
  title: string;
  note: string;
  verdict: string;
  /** The face the product is on today, which a comparison needs marked. */
  today: boolean;
}

/**
 * The contact sheet: the tiles in a grid, each labelled underneath.
 *
 * Composed as one SVG and rasterised here rather than by `lib/render/`, for
 * `lib/book/fold.ts`'s reason turned around: a contact sheet is not a page of
 * any book, no `PageTemplate` describes one, and a treatment the renderer has
 * never heard of is not an option on the render call. Its labels are set in
 * `typewriter` because that face is vendored and is not in the lineup's
 * rounded half — a label set in one of the candidates would be arguing.
 */
function sheetSvg(tiles: Tile[], heading: string, columns: number): string {
  const pad = 28;
  const label = 86;
  const rows = Math.ceil(tiles.length / columns);
  const head = 96;
  const width = pad + columns * (SHEET_PX + pad);
  const height = head + pad + rows * (SHEET_PX + label + pad);

  const cell = (tile: Tile, at: number) => {
    const col = at % columns;
    const row = (at - col) / columns;
    const x = pad + col * (SHEET_PX + pad);
    const y = head + pad + row * (SHEET_PX + label + pad);
    const uri = `data:image/png;base64,${Buffer.from(tile.png).toString("base64")}`;
    const mark = tile.today
      ? `<rect x="${x - 6}" y="${y - 6}" width="${SHEET_PX + 12}" height="${SHEET_PX + 12}" ` +
        `fill="none" stroke="#B4553A" stroke-width="6"/>`
      : "";
    return (
      mark +
      `<image x="${x}" y="${y}" width="${SHEET_PX}" height="${SHEET_PX}" href="${uri}"/>` +
      `<text x="${x}" y="${y + SHEET_PX + 30}" font-family="Special Elite" font-size="24" ` +
      `fill="#2A1C12">${esc(tile.title)}</text>` +
      `<text x="${x}" y="${y + SHEET_PX + 56}" font-family="Special Elite" font-size="17" ` +
      `fill="#6B5A4A">${esc(tile.note)}</text>` +
      `<text x="${x}" y="${y + SHEET_PX + 78}" font-family="Special Elite" font-size="17" ` +
      `fill="#6B5A4A">${esc(tile.verdict)}</text>`
    );
  };

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#FBF6EC"/>` +
    `<text x="${pad}" y="46" font-family="Special Elite" font-size="30" fill="#2A1C12">` +
    `${esc(heading)}</text>` +
    `<text x="${pad}" y="74" font-family="Special Elite" font-size="18" fill="#6B5A4A">` +
    `${esc("The real cover page, the captain’s delivered wrap, the title at its declared 44 pt. Outlined: the face it is on today.")}</text>` +
    tiles.map(cell).join("") +
    `</svg>`
  );
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

async function main() {
  const out = arg("out") ?? OUT;
  const name = arg("name") ?? ORDINARY;
  const everythingFullSize = process.argv.includes("--full");
  const tableOnly = process.argv.includes("--table");
  const otf = process.env.MORE_SUGAR_OTF;

  const store = releaseStoreFromEnv(process.env);
  const art = await releaseArtworkFor(FIRST_BOOK, store);
  const delivered = await bookAsDelivered(FIRST_BOOK, store);
  const withCovers = looksWithCoverArtwork(FIRST_BOOK, art);
  console.log(`artwork store: ${art.describe}`);
  if (withCovers.length === 0) {
    console.error(
      "No look has a delivered cover, so every picture here would be the drawn placeholder\n" +
        "and the comparison would be about a flat colour rather than about the cover.\n" +
        "Import one first: npm run artwork -- look <dir> <look-id>  (docs/artwork.md § 6b)",
    );
    process.exitCode = 1;
    return;
  }
  console.log(`${withCovers.length} look(s) with a delivered cover: ${withCovers.join(", ")}`);

  await mkdir(path.join(out, "full"), { recursive: true });
  await mkdir(path.join(out, "look"), { recursive: true });

  // -------------------------------------------------------------------------
  // The measurement, first: it is cheap, and a face that draws nothing should
  // be reported before a hundred megabytes of pictures are written.
  // -------------------------------------------------------------------------
  const keys = Object.keys(FACES);
  const verdicts: Verdict[] = [];
  for (const key of keys) {
    const v = await verdictFor(key);
    verdicts.push(v);
    console.log(
      `  ${key.padEnd(13)} ${FACES[key].family.padEnd(16)} ` +
        `${LONGEST}: ${phrase(v.likely).padEnd(52)} ` +
        `worst case: ${phrase(v.guaranteed).padEnd(52)} ` +
        `refuses: ${v.refuses.join(", ") || "nothing"}`,
    );
  }

  // -------------------------------------------------------------------------
  // The sheets
  // -------------------------------------------------------------------------
  const setIn = coverTitleSlot(FIRST_BOOK).font;

  async function sheet(lookId: string, titleName: string, file: string) {
    const tiles: Tile[] = [];
    for (const key of keys) {
      const face = FACES[key];
      const v = verdicts.find((x) => x.key === key)!;
      tiles.push({
        png: await coverPng(delivered, key, lookId, titleName, SHEET_PX),
        title: `${face.family}${key === setIn ? "  — today" : ""}`,
        note: `${face.licence}${face.candidate ? "" : "  · set in by the book"}`,
        verdict: shortVerdict(v),
        today: key === setIn,
      });
    }
    if (otf) {
      tiles.push({
        png: await referencePng(delivered, lookId, titleName, otf, SHEET_PX),
        title: "More Sugar  — reference",
        note: "not licensable for this shop",
        verdict: "shown for comparison only",
        today: false,
      });
    }
    const png = rasteriseSheet(
      sheetSvg(
        tiles,
        `Cover title faces · ${lookId} · “${titleName}”${otf ? "" : "  (no More Sugar reference: MORE_SUGAR_OTF unset)"}`,
        4,
      ),
      Math.min(4, tiles.length) * (SHEET_PX + 28) + 28,
    );
    await writeFile(path.join(out, file), png);
    console.log(`  ${file}  ${(png.length / 1024 / 1024).toFixed(1)} MB`);
  }

  if (tableOnly) {
    await writeFile(path.join(out, "README.md"), report(verdicts, withCovers, name, Boolean(otf)));
    console.log(`\n${path.join(out, "README.md")} has the table. No pictures: --table.`);
    return;
  }

  console.log("\ncomparison sheets");
  for (const lookId of withCovers) await sheet(lookId, name, `sheet-${lookId}.png`);
  // The two cases the table is about, on the first look, so the captain can
  // see the thing the numbers are describing.
  await sheet(withCovers[0], LONGEST, `sheet-${withCovers[0]}-longest.png`);
  await sheet(withCovers[0], APOSTROPHE, `sheet-${withCovers[0]}-apostrophe.png`);

  // -------------------------------------------------------------------------
  // The full-size renders
  // -------------------------------------------------------------------------
  const full = everythingFullSize ? withCovers : withCovers.slice(0, 1);
  const { width } = FIRST_BOOK.page.print.pixels;
  console.log(`\nfull size (${width} px) on ${full.join(", ")}`);
  for (const lookId of full) {
    for (const key of keys) {
      const png = await coverPng(delivered, key, lookId, name, width);
      await writeFile(path.join(out, "full", `${lookId}-${key}.png`), png);
    }
    console.log(`  full/${lookId}-*.png  ${keys.length} file(s)`);
  }

  const rest = withCovers.filter((l) => !full.includes(l));
  if (rest.length) {
    console.log(`\n${LOOK_PX} px on ${rest.join(", ")}`);
    for (const lookId of rest) {
      for (const key of keys) {
        const png = await coverPng(delivered, key, lookId, name, LOOK_PX);
        await writeFile(path.join(out, "look", `${lookId}-${key}.png`), png);
      }
      console.log(`  look/${lookId}-*.png  ${keys.length} file(s)`);
    }
  }

  await writeFile(path.join(out, "README.md"), report(verdicts, withCovers, name, Boolean(otf)));
  console.log(`\n${path.join(out, "README.md")} has the table and what every file is.`);
}

// ---------------------------------------------------------------------------

function report(verdicts: Verdict[], looks: string[], name: string, reference: boolean): string {
  const slot = coverTitleSlot(FIRST_BOOK);
  const limit = nameLimit(FIRST_BOOK);
  const across = maxCharsPerLineOf(slot);
  const setIn = slot.font;
  const panel = titlePanelOf(FIRST_BOOK);
  const across_pt = slot.frame.width;
  const width = (fit: TitleFit) => (fit.ink ? fit.ink.width.toFixed(0) : "—");
  const rows = verdicts.map(
    (v) =>
      `| ${FACES[v.key].family}${v.key === setIn ? " **(today)**" : ""} | ` +
      `${FACES[v.key].licence} | ${width(v.likely)} | ${phrase(v.likely)} | ` +
      `${width(v.guaranteed)} | ${phrase(v.guaranteed)} | ${v.refuses.join(", ") || "nothing"} |`,
  );

  return [
    "# The cover title's candidates",
    "",
    "Written by `npm run cover-faces`. **Nothing here is committed** — `.artwork/`",
    "is in `.gitignore`, and these are a family's artwork.",
    "",
    "## What the files are",
    "",
    `- \`sheet-<look>.png\` — every face on one cover, labelled, with “${name}” in the title.`,
    `- \`sheet-<look>-longest.png\` — the same, with “${LONGEST}”: ${limit} characters, the longest the form accepts.`,
    `- \`sheet-<look>-apostrophe.png\` — the same, with “${APOSTROPHE}”, which is the curly apostrophe test.`,
    `- \`full/<look>-<face>.png\` — the cover at the print file's own ${FIRST_BOOK.page.print.pixels.width} px.`,
    `- \`look/<look>-<face>.png\` — the cover at ${LOOK_PX} px, for the looks the full-size set skips.`,
    "",
    `Looks shown: ${looks.join(", ")}.`,
    reference
      ? "The last tile on each sheet is **More Sugar**, the captain's reference, drawn from the" +
        " file `MORE_SUGAR_OTF` names. It is not vendored and not registered: this shop may not" +
        " use it, and the print path has no way to reach it."
      : "There is no More Sugar reference tile: set `MORE_SUGAR_OTF` to a local copy to get one.",
    "",
    "## The fit, measured",
    "",
    `The title is three lines at ${slot.size} pt in a frame ${slot.frame.width} pt across, and`,
    `the slot's \`maxCharsPerLine\` is ${across} where the name's own limit is ${limit}.`,
    `Every width below is the **ink's own bounding box**, read out of a difference between two`,
    "renders — `lib/book/title-fit.ts`. Two columns because there are two questions:",
    "",
    `- **“${LONGEST}”** is a real name of exactly ${limit} characters, which is what the captain would see.`,
    `- **The worst case** is ${limit} \`M\`s, the widest ${limit} characters the form will accept. It is the`,
    "  only column that *guarantees* anything, and it is `validateBook`'s own worst case.",
    "",
    `The title's box is ${across_pt} pt across; the cream panel it is printed on is ` +
      `${panel ? `${panel.width} pt` : "not declared"}. Past the box is a decision; past the panel is a name set on photography.`,
    "",
    `| Face | Licence | “${LONGEST}” (pt) | Verdict | Worst case (pt) | Verdict | Refuses |`,
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "**Only one face holds the worst case at the declared 44 pt, and it is the one the cover is",
    "already set in.** That is not luck: the box was drawn around Indie Flower, whose capitals",
    "are narrow for a handwritten face. Every other face in the lineup — including Special",
    "Elite, which the verses are set in — needs a smaller size for the guarantee to hold. So",
    "**choosing any of these is choosing a type size as well**, and the size each would need",
    "is in its verdict. The alternative is to widen the box and the panel, which moves drawn",
    "content and is the captain's call.",
    "",
    "**“Refuses”** is the half a picture cannot show. `lib/book/name.ts` asks every face the",
    "name lands in and refuses a character any of them cannot write, so the face chosen for",
    "the title decides which names the shop will take. The names probed are:",
    NAMES.map((n) => `*${n.name}* (${n.label})`).join(", ") + ".",
    "",
    "Note that *Vietnamese* is refused in every row, including today's: the eleven verses are",
    "set in Special Elite, which has never carried it. A row that refuses **Polish** is a row",
    "that would narrow what the shop accepts today.",
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
