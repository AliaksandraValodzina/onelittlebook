/**
 * **What colour the cover's title could be, as pictures of the real cover and
 * as a number per cover.**
 *
 *     npm run cover-colour                       # sheets, the table, full-size renders
 *     npm run cover-colour -- --table            # the table only, no pictures
 *     npm run cover-colour -- --name O\'Brien    # a different name in the title
 *     npm run cover-colour -- --out ./somewhere
 *
 * `npm run cover-faces` is the sibling command and the same argument applies:
 * the captain is choosing by **looking at it**, and a swatch on white cannot
 * answer a question about type set straight onto a photographic cover. So every
 * picture here is the real cover page — the captain's delivered wrap where
 * there is one, cut to the front panel, with the real title string on it at the
 * size the template declares, drawn by the one renderer.
 *
 * Nothing it writes is committed: `.artwork/` is gitignored, and these are a
 * family's artwork in a public repository.
 *
 * ## The table beside the pictures is the half a picture cannot show
 *
 * A colour is legible on *this* cover. There are fourteen looks and a buyer
 * picks one, so the question is always "on every cover", and
 * `lib/book/title-colour.ts` answers it by measuring **each letter's ink
 * against the artwork pixel actually behind it**. That file carries the method
 * and the reason the probe render exists; what this command adds is the sweep:
 * every colour and every palette, over every look the artwork store has.
 *
 * ## The eleven covers nobody can measure from here
 *
 * Three looks have a delivered cover wrap and eleven do not —
 * `npm run artwork -- status` says which, on this machine. A look without one
 * still renders: `templates/first-book.ts` draws the placeholder cover on the
 * book's own declared `coverColour`, which is a **flat pale ground**. That is a
 * real cover the shop can print today, and it is measured and labelled as
 * exactly what it is. It is *not* a stand-in for the captain's eleven missing
 * wraps: a flat ground is the easiest thing a title ever sits on, so a colour
 * that passes there has been told nothing about a cover with a cake in the
 * corner. The table says `drawn` on those rows and the count of delivered
 * covers is printed at the top.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { FIRST_BOOK } from "../templates/first-book";
import { FIXTURE_BOOK_FILL } from "../fixtures/book-order";
import {
  bookAsDelivered,
  looksWithCoverArtwork,
  releaseArtworkFor,
  releaseStoreFromEnv,
} from "../lib/artwork/release";
import { printProblems, problemReport } from "../lib/book/print";
import { coverPngAt, coverTitleSlot } from "../lib/book/title-fit";
import {
  BODY_TEXT_BAR,
  LARGE_TEXT_BAR,
  lightestThatPasses,
  TITLE_INKS,
  TITLE_PALETTES,
  coverTitleColoured,
  coverTitlePalette,
  inkVerdict,
  palettePulledFrom,
  paletteVerdict,
  titleGroundOf,
} from "../lib/book/title-colour";
import { nameLimit } from "../lib/book/name";
import { FACES } from "../lib/render/fonts";
import type { BookTemplate } from "../lib/book/types";
import type { Colour } from "../lib/template/types";
import type { PaletteVerdict, TitleGround, Verdict } from "../lib/book/title-colour";

const OUT = path.join(process.cwd(), ".artwork", "cover-colour");

/**
 * The bar the declared `pastelDeep` palette was derived at — a third above
 * WCAG's 3:1, so the palette has headroom rather than sitting on the line.
 */
const DECLARED_BAR = 4;
const SHEET_PX = 560;

/** The name the sheets are drawn with: a real one, not fourteen M's. */
const ORDINARY = "Matilda";
/**
 * The name the measurement is taken with: **the guarantee**, fourteen `M`s.
 *
 * Not a realistic name, and deliberately: this is the title that covers the
 * most of the corner, so it is the one that stands on the most artwork and has
 * the most chances to find a pixel it cannot be read against. It is also
 * `validateBook`'s own worst case and `lib/book/title-fit.ts`'s, which keeps
 * the two measurements talking about the same cover. The *pictures* are drawn
 * with a real name, because that is what the captain is looking at.
 */
const LONGEST = "M".repeat(nameLimit(FIRST_BOOK));

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  const next = process.argv[at + 1];
  return at === -1 || next === undefined || next.startsWith("--") ? undefined : next;
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

/** One look's row: the cover it was measured on, and every verdict about it. */
interface Row {
  lookId: string;
  delivered: boolean;
  ground: TitleGround;
  inks: Map<string, Verdict>;
  palettes: Map<string, { colours: readonly Colour[]; verdict: PaletteVerdict }>;
}

async function rowFor(
  book: BookTemplate,
  lookId: string,
  delivered: boolean,
  name: string,
): Promise<Row> {
  const ground = await titleGroundOf(book, { ...FIXTURE_BOOK_FILL, lookId }, { name });
  const inks = new Map<string, Verdict>();
  for (const ink of TITLE_INKS) inks.set(ink.key, inkVerdict(ink.colour, ground));
  const palettes = new Map<string, { colours: readonly Colour[]; verdict: PaletteVerdict }>();
  for (const option of TITLE_PALETTES) {
    const colours = option.pulled ? palettePulledFrom(ground) : option.colours;
    palettes.set(option.key, { colours, verdict: paletteVerdict(colours, ground) });
  }
  return { lookId, delivered, ground, inks, palettes };
}

/** One verdict as a phrase, which is what a tile and a table cell both carry. */
function phrase(v: Verdict): string {
  if (v.pixels === 0) return "DREW NOTHING";
  const bar = v.worst >= LARGE_TEXT_BAR;
  const body = v.worst >= BODY_TEXT_BAR;
  if (!bar) return `FAILS — ${v.worst.toFixed(2)}:1, ${(v.underBar * 100).toFixed(0)}% of ink under ${LARGE_TEXT_BAR}:1`;
  if (!body) return `passes large text — ${v.worst.toFixed(2)}:1, under ${BODY_TEXT_BAR}:1`;
  return `passes — ${v.worst.toFixed(2)}:1`;
}

function palettePhrase(v: PaletteVerdict): string {
  if (v.passes) return `passes — worst letter ${v.worst.toFixed(2)}:1`;
  const named = v.failing
    .slice(0, 6)
    .map((l) => `${l.char === " " ? "␣" : l.char}${l.worst.toFixed(1)}`)
    .join(" ");
  return `FAILS — ${v.failing.length}/${v.letters.length} letters: ${named}${v.failing.length > 6 ? " …" : ""}`;
}

// ---------------------------------------------------------------------------
// The pictures
// ---------------------------------------------------------------------------

interface Tile {
  png: Uint8Array;
  title: string;
  note: string;
  verdict: string;
  /** The colour the product is on today, which a comparison needs marked. */
  today: boolean;
  /** Drawn in red, so a failure is visible in the sheet and not only in a table. */
  failed: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The contact sheet: the tiles in a grid, each labelled underneath.
 *
 * Composed as one SVG and rasterised here rather than by `lib/render/`, for
 * `lib/book/fold.ts`'s reason turned around — a contact sheet is not a page of
 * any book and no `PageTemplate` describes one. Its labels are set in
 * `typewriter`, which is the one face in this comparison that is not on trial.
 */
function sheetSvg(tiles: Tile[], heading: string, subhead: string, columns: number): string {
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
    const mark = (colour: string, inset: number) =>
      `<rect x="${x - inset}" y="${y - inset}" width="${SHEET_PX + inset * 2}" ` +
      `height="${SHEET_PX + inset * 2}" fill="none" stroke="${colour}" stroke-width="6"/>`;
    return (
      (tile.today ? mark("#B4553A", 6) : "") +
      (tile.failed ? mark("#C01B1B", 13) : "") +
      `<image x="${x}" y="${y}" width="${SHEET_PX}" height="${SHEET_PX}" href="${uri}"/>` +
      `<text x="${x}" y="${y + SHEET_PX + 30}" font-family="Special Elite" font-size="24" ` +
      `fill="#2A1C12">${esc(tile.title)}</text>` +
      `<text x="${x}" y="${y + SHEET_PX + 56}" font-family="Special Elite" font-size="17" ` +
      `fill="#6B5A4A">${esc(tile.note)}</text>` +
      `<text x="${x}" y="${y + SHEET_PX + 78}" font-family="Special Elite" font-size="17" ` +
      `fill="${tile.failed ? "#C01B1B" : "#6B5A4A"}">${esc(tile.verdict)}</text>`
    );
  };

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#FBF6EC"/>` +
    `<text x="${pad}" y="46" font-family="Special Elite" font-size="30" fill="#2A1C12">` +
    `${esc(heading)}</text>` +
    `<text x="${pad}" y="74" font-family="Special Elite" font-size="18" fill="#6B5A4A">` +
    `${esc(subhead)}</text>` +
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

async function main() {
  const out = arg("out") ?? OUT;
  const name = arg("name") ?? ORDINARY;
  const measuredWith = arg("name") ?? LONGEST;
  const tableOnly = process.argv.includes("--table");

  const store = releaseStoreFromEnv(process.env);
  const art = await releaseArtworkFor(FIRST_BOOK, store);
  const delivered = await bookAsDelivered(FIRST_BOOK, store);
  const withCovers = new Set(looksWithCoverArtwork(FIRST_BOOK, art));
  const looks = FIRST_BOOK.looks.map((l) => l.id);
  console.log(`artwork store: ${art.describe}`);
  console.log(
    `${looks.length} look(s); ${withCovers.size} with a delivered cover wrap ` +
      `(${[...withCovers].join(", ") || "none"}). The rest are measured on the ` +
      `drawn placeholder cover, which is a flat ground and is labelled "drawn".`,
  );

  /**
   * The gate, before the directories — `scripts/cover-faces.ts` § refusalsIn is
   * the whole story of why. A colour sheet is a picture of the real cover page,
   * so a book the print path refuses is a sheet of nothing, and the refusal has
   * to name the look, the page and the numbers rather than print one code once
   * per combination.
   */
  const refused = new Map<string, ReturnType<typeof printProblems>[number]>();
  for (const lookId of looks) {
    for (const p of printProblems(delivered, { ...FIXTURE_BOOK_FILL, lookId, name: measuredWith })) {
      refused.set(`${p.code} ${p.where} ${p.detail}`, p);
    }
  }
  if (refused.size) {
    console.error(`\nNOTHING WAS WRITTEN. ${out} is unchanged.\n`);
    for (const line of problemReport([...refused.values()]).split("\n")) console.error(`  ${line}`);
    console.error(
      "\nWhat this machine holds:  npm run artwork -- status\n" +
        "The size contract:        docs/look-upload-contract.md § 2",
    );
    process.exitCode = 1;
    return;
  }

  // -------------------------------------------------------------------------
  // The measurement first: it is two renders a look and it is the answer.
  // -------------------------------------------------------------------------
  console.log(`\nmeasuring “${measuredWith}” on every cover`);
  const rows: Row[] = [];
  for (const lookId of looks) {
    const row = await rowFor(delivered, lookId, withCovers.has(lookId), measuredWith);
    rows.push(row);
    const worst = TITLE_INKS.map((i) => `${i.key} ${row.inks.get(i.key)!.worst.toFixed(2)}`).join("  ");
    console.log(`  ${lookId.padEnd(9)} ${row.delivered ? "delivered" : "drawn    "}  ${worst}`);
  }

  // What the captain's own pastels would have to become — printed on every run,
  // so the declared `pastelDeep` palette above cannot quietly go stale as
  // covers land. `lib/book/title-colour.ts` § lightestThatPasses.
  const pastels = TITLE_PALETTES.find((o) => o.key === "pastel");
  const declared = TITLE_PALETTES.find((o) => o.key === "pastelDeep");
  if (pastels && declared) {
    const grounds = rows.map((r) => r.ground);
    console.log(
      `\nthe reference pastels at the palest that clears ${DECLARED_BAR}:1 on all ${rows.length}` +
        " (what `pastelDeep` is derived from)",
    );
    for (const [at, colour] of pastels.colours.entries()) {
      const down = lightestThatPasses(colour, grounds, DECLARED_BAR);
      const same = down !== null && down.toUpperCase() === declared.colours[at]?.toUpperCase();
      console.log(
        `  ${colour} -> ${down ?? "no lightness at this hue passes"}` +
          `   declared ${declared.colours[at] ?? "—"}${same ? "" : "   ** DECLARED VALUE HAS MOVED **"}`,
      );
    }
  }

  console.log("\nevery colour, over every cover");
  for (const ink of TITLE_INKS) {
    const bad = rows.filter((r) => !r.inks.get(ink.key)!.passes);
    const worst = rows.reduce(
      (low, r) => (r.inks.get(ink.key)!.worst < low.worst ? r.inks.get(ink.key)! : low),
      rows[0].inks.get(ink.key)!,
    );
    console.log(
      `  ${ink.label.padEnd(12)} ${ink.colour}  worst ${worst.worst.toFixed(2)}:1  ` +
        (bad.length === 0
          ? `passes on all ${rows.length}`
          : `FAILS on ${bad.length}: ${bad.map((r) => r.lookId).join(", ")}`),
    );
  }
  for (const option of TITLE_PALETTES) {
    const bad = rows.filter((r) => !r.palettes.get(option.key)!.verdict.passes);
    const worst = rows.reduce(
      (low, r) => Math.min(low, r.palettes.get(option.key)!.verdict.worst),
      Infinity,
    );
    console.log(
      `  ${option.label.padEnd(34)} worst letter ${worst.toFixed(2)}:1  ` +
        (bad.length === 0
          ? `passes on all ${rows.length}`
          : `FAILS on ${bad.length}: ${bad.map((r) => r.lookId).join(", ")}`),
    );
  }

  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "README.md"), report(rows, name, measuredWith));
  if (tableOnly) {
    console.log(`\n${path.join(out, "README.md")} has the table. No pictures: --table.`);
    return;
  }

  // -------------------------------------------------------------------------
  // The sheets: one per look, every colour and every palette on that cover.
  // -------------------------------------------------------------------------
  const slot = coverTitleSlot(FIRST_BOOK);
  console.log("\nsheets");
  for (const row of rows) {
    const tiles: Tile[] = [];
    for (const ink of TITLE_INKS) {
      const v = row.inks.get(ink.key)!;
      tiles.push({
        png: await coverPngAt(
          coverTitleColoured(delivered, ink.colour),
          { ...FIXTURE_BOOK_FILL, lookId: row.lookId, name },
          SHEET_PX,
        ),
        title: `${ink.label}  ${ink.colour}${ink.today ? "  — today" : ""}`,
        note: "one colour",
        verdict: phrase(v),
        today: ink.today === true,
        failed: !v.passes,
      });
    }
    for (const option of TITLE_PALETTES) {
      const { colours, verdict } = row.palettes.get(option.key)!;
      tiles.push({
        png: await coverPngAt(
          coverTitlePalette(delivered, colours),
          { ...FIXTURE_BOOK_FILL, lookId: row.lookId, name },
          SHEET_PX,
        ),
        title: option.label,
        note: `${colours.length} colours · ${colours.join(" ")}`,
        verdict: palettePhrase(verdict),
        today: false,
        failed: !verdict.passes,
      });
    }
    const file = `sheet-${row.lookId}.png`;
    const png = rasteriseSheet(
      sheetSvg(
        tiles,
        `Cover title colour · ${row.lookId} · “${name}”${row.delivered ? "" : "  (drawn placeholder cover, not a delivered wrap)"}`,
        `The real cover page, the title in the captain’s corner at its declared ${slot.size} pt in ${FACES[slot.font].family}. ` +
          `Outlined warm: today’s colour. Outlined red: measured below ${LARGE_TEXT_BAR}:1 somewhere under the type.`,
        4,
      ),
      4 * (SHEET_PX + 28) + 28,
    );
    await writeFile(path.join(out, file), png);
    console.log(`  ${file}  ${(png.length / 1024 / 1024).toFixed(1)} MB`);
  }

  // -------------------------------------------------------------------------
  // Full size, on the delivered covers only: a flat placeholder ground says
  // nothing at 3600 px that it has not already said at 560.
  // -------------------------------------------------------------------------
  const { width } = FIRST_BOOK.page.print.pixels;
  const full = rows.filter((r) => r.delivered);
  if (full.length) {
    await mkdir(path.join(out, "full"), { recursive: true });
    console.log(`\nfull size (${width} px) on ${full.map((r) => r.lookId).join(", ")}`);
    for (const row of full) {
      for (const ink of TITLE_INKS) {
        await writeFile(
          path.join(out, "full", `${row.lookId}-ink-${ink.key}.png`),
          await coverPngAt(
            coverTitleColoured(delivered, ink.colour),
            { ...FIXTURE_BOOK_FILL, lookId: row.lookId, name },
            width,
          ),
        );
      }
      for (const option of TITLE_PALETTES) {
        await writeFile(
          path.join(out, "full", `${row.lookId}-palette-${option.key}.png`),
          await coverPngAt(
            coverTitlePalette(delivered, row.palettes.get(option.key)!.colours),
            { ...FIXTURE_BOOK_FILL, lookId: row.lookId, name },
            width,
          ),
        );
      }
      console.log(`  full/${row.lookId}-*.png`);
    }
  }

  console.log(`\n${path.join(out, "README.md")} has the table and what every file is.`);
}

// ---------------------------------------------------------------------------

function report(rows: Row[], name: string, measuredWith: string): string {
  const slot = coverTitleSlot(FIRST_BOOK);
  const deliveredRows = rows.filter((r) => r.delivered);
  const cell = (v: Verdict) =>
    v.pixels === 0 ? "**drew nothing**" : `${v.worst.toFixed(2)}${v.passes ? "" : " **fail**"}`;

  const inkRows = TITLE_INKS.map((ink) => {
    const vs = rows.map((r) => r.inks.get(ink.key)!);
    const bad = rows.filter((_, i) => !vs[i].passes).map((r) => r.lookId);
    const worst = Math.min(...vs.map((v) => v.worst));
    const deliveredWorst = Math.min(
      ...deliveredRows.map((r) => r.inks.get(ink.key)!.worst),
      Infinity,
    );
    return (
      `| ${ink.label}${ink.today ? " **(today)**" : ""} | \`${ink.colour}\` | ` +
      `${worst.toFixed(2)} | ${Number.isFinite(deliveredWorst) ? deliveredWorst.toFixed(2) : "—"} | ` +
      `${bad.length === 0 ? "**passes on all " + rows.length + "**" : "**fails on " + bad.length + "** — " + bad.join(", ")} |`
    );
  });

  const paletteRows = TITLE_PALETTES.map((option) => {
    const vs = rows.map((r) => r.palettes.get(option.key)!);
    const bad = rows.filter((_, i) => !vs[i].verdict.passes).map((r) => r.lookId);
    const worst = Math.min(...vs.map((v) => v.verdict.worst));
    const colours = option.pulled
      ? "derived per cover"
      : option.colours.map((c) => `\`${c}\``).join(" ");
    return (
      `| ${option.label} | ${colours} | ${worst.toFixed(2)} | ` +
      `${bad.length === 0 ? "**passes on all " + rows.length + "**" : "**fails on " + bad.length + "** — " + bad.join(", ")} |`
    );
  });

  const perLook = rows.map((r) => {
    const inks = TITLE_INKS.map((i) => cell(r.inks.get(i.key)!)).join(" | ");
    const pals = TITLE_PALETTES.map((o) => {
      const v = r.palettes.get(o.key)!.verdict;
      return v.passes ? v.worst.toFixed(2) : `${v.worst.toFixed(2)} **${v.failing.length} letters**`;
    }).join(" | ");
    return `| ${r.lookId} | ${r.delivered ? "delivered" : "drawn" } | ${inks} | ${pals} |`;
  });

  const failures: string[] = [];
  for (const option of TITLE_PALETTES) {
    for (const r of rows) {
      const { verdict } = r.palettes.get(option.key)!;
      if (verdict.passes) continue;
      failures.push(
        `- **${option.label} on ${r.lookId}** (${r.delivered ? "delivered" : "drawn"}): ` +
          verdict.failing
            .map((l) => `\`${l.char === " " ? "␣" : l.char}\` line ${l.line + 1} step ${l.step} in \`${l.colour}\` at ${l.worst.toFixed(2)}:1`)
            .join("; "),
      );
    }
  }

  return [
    "# The cover title's colour",
    "",
    "Written by `npm run cover-colour`. **Nothing here is committed** — `.artwork/`",
    "is in `.gitignore`, and these are pictures of a family's artwork.",
    "",
    "## What the files are",
    "",
    `- \`sheet-<look>.png\` — every colour and every palette on that cover, labelled, with “${name}” in the title.`,
    `- \`full/<look>-ink-<key>.png\` — one colour at the print file's own ${FIRST_BOOK.page.print.pixels.width} px.`,
    `- \`full/<look>-palette-<key>.png\` — the same for a palette. Delivered covers only.`,
    "",
    `The title is set in **${FACES[slot.font].family} at ${slot.size} pt** in the captain's corner —`,
    "`templates/first-book.ts` § `TITLE_CORNER`. There is no panel under it, so every",
    "number below is the type against the artwork itself.",
    "",
    "## How it is measured",
    "",
    "`lib/book/title-colour.ts`. Each cover is rendered **twice** — once with the",
    "title taken away and once with each letter in its own probe colour — and out of",
    "the pair comes the list of artwork pixels every letter's ink stands on. Each",
    "proposed colour is then measured against those same pixels, so a difference",
    "between two colours is a difference between the colours and not between two",
    "renders.",
    "",
    `The bar is WCAG's **${LARGE_TEXT_BAR}:1 for large text**, which 29 pt of an ExtraBold face is;`,
    `**${BODY_TEXT_BAR}:1** is body text and is reported beside it. **A colour that fails on one`,
    "cover fails**: a buyer picks one look, so a palette that works on twelve prints",
    "twelve good books and two bad ones.",
    "",
    `Measured with “${measuredWith}” in the title — the longest name the form accepts (${nameLimit(FIRST_BOOK)}`,
    "characters), because that is the title that covers the most of the corner.",
    "",
    `**${deliveredRows.length} of ${rows.length} looks have a delivered cover wrap on this machine**` +
      ` (${deliveredRows.map((r) => r.lookId).join(", ") || "none"}). The rest are measured on the`,
    "drawn placeholder cover, which is a **flat pale ground** — the easiest thing a",
    "title ever sits on. Those rows say `drawn`, and they are not a stand-in for the",
    "captain's missing wraps: a colour that passes on a flat ground has been told",
    "nothing about a cover with a cake in the corner. Run this command wherever the",
    "looks bucket is configured to get all fourteen for real.",
    "",
    "## One colour",
    "",
    "| Colour | Hex | Worst on any cover | Worst on a delivered cover | Verdict |",
    "|---|---|---|---|---|",
    ...inkRows,
    "",
    ...TITLE_INKS.flatMap((ink) => [`**${ink.label}** — ${ink.why}`, ""]),
    "## A colour per letter",
    "",
    "The cycle, stated once and implemented once — `lib/render/palette.ts`:",
    "",
    "- **Positional**, because the title contains the buyer's name and nothing a",
    "  template can write knows what is in it.",
    "- **Restarting on each line**, so *“When”* and *“Turned One”* print identically on",
    "  every copy and the only line that varies is the name. A cycle that ran straight",
    "  through would colour *“Turned One”* differently for every length of name.",
    "- **Whitespace takes no colour and does not advance it**, so the two words of",
    "  *“Turned One”* are coloured by where their letters stand and not by an invisible",
    "  step. Visible punctuation — the hyphen in a double-barrelled name — does take one.",
    "",
    "| Palette | Colours | Worst letter on any cover | Verdict |",
    "|---|---|---|---|",
    ...paletteRows,
    "",
    ...TITLE_PALETTES.flatMap((o) => [`**${o.label}** — ${o.why}`, ""]),
    "## Every cover",
    "",
    `| Look | Cover | ${TITLE_INKS.map((i) => i.label).join(" | ")} | ${TITLE_PALETTES.map((o) => o.label).join(" | ")} |`,
    `|---|---|${TITLE_INKS.map(() => "---").join("|")}|${TITLE_PALETTES.map(() => "---").join("|")}|`,
    ...perLook,
    "",
    "Every figure is the worst contrast ratio any pixel of that ink reaches on that",
    "cover. A palette's figure is its worst **letter**.",
    "",
    ...(failures.length
      ? ["## Which letters fail, and where", "", ...failures, ""]
      : ["Every palette clears the bar on every cover measured here.", ""]),
  ].join("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
