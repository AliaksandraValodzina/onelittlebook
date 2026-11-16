/**
 * Import what the captain delivered.
 *
 *     npm run artwork -- status
 *     npm run artwork -- look      ~/Downloads/approved-pages-3600x3600 02-girl
 *     npm run artwork -- portraits ~/Downloads/baby-portraits-v2
 *     npm run artwork -- ghosts    ~/Downloads/golden-spreads
 *
 * **Nothing it reads is ever copied into the repository.** The bytes go into
 * the artwork store — `lib/artwork/release.ts`, which says where that is — and
 * the repository keeps ids, digests and slot coordinates and no pixels at all.
 * `docs/artwork.md` is the inventory of what was delivered and what it became.
 *
 * **It writes wherever this environment points.** With the public R2 bucket
 * configured that is the bucket; with it unset it is a directory on this
 * machine. Every line it prints names the store it wrote to, so there is no way
 * to be wrong about where the bytes went. `npm run artwork:upload` is the
 * command for the bucket specifically: it does all three sets in one run,
 * refuses and names the empty rows without the credentials, and **skips a set
 * whose pages have not changed** — see `scripts/upload-artwork.ts`.
 *
 * It **refuses before it writes**, every time, rather than trusting that
 * somebody ran a checker first: an import changes what a paid book looks like,
 * and a gate that can be skipped is not a gate. A look's pages are held to
 * `docs/look-upload-contract.md` § 2 by the same function an order's
 * regenerated pages are, and its **two cover wraps** to § 2b by
 * `lib/book/cover-upload.ts`.
 *
 * **A look folder holds both and `look` imports both**, as two sets: the pages
 * and the cover. `lib/artwork/release.ts` § `coverSet` says why they are two,
 * and the short version is that handing this command one corrected cover must
 * not delete twenty-four pages.
 *
 * Each import **adds a version and keeps the last** — `lib/artwork/store.ts`
 * § Versions carries that argument. Two of the first twelve portraits are being
 * regenerated, so re-importing the set is the normal case and not a repair.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { FIRST_BOOK } from "../templates/first-book";
import {
  GHOSTS_SET,
  TILES_SET,
  coverSet,
  lookSet,
  releaseArtworkFor,
  releaseStoreFromEnv,
} from "../lib/artwork/release";
import { portraitName, type ImportFile } from "../lib/artwork/import";
import {
  pagesForStore,
  pagesNotCovered,
  prepareCoverWraps,
  prepareGhostHalves,
  prepareLookPages,
  preparePortraits,
} from "../lib/artwork/prepare";
import { coverWrapFileNames } from "../lib/book/cover-upload";
import { COVER_PRODUCT_IDS } from "../lib/book/types";
import { hrefIn } from "../lib/assets/address";
import type { ReleaseArtwork } from "../lib/artwork/release";
import type { Problem } from "../lib/template/validate";
import type { BookTemplate } from "../lib/book/types";

const store = releaseStoreFromEnv(process.env);
const NOW = new Date();

function usage(): never {
  console.error(
    [
      "usage:",
      "  npm run artwork -- status",
      "  npm run artwork -- look      <dir> <look-id|NN-gender>",
      "  npm run artwork -- portraits <dir>",
      "  npm run artwork -- ghosts    <dir>",
      "",
      "to push all three to the public R2 bucket instead: npm run artwork:upload",
    ].join("\n"),
  );
  process.exitCode = 2;
  throw new Quit();
}

/** Thrown to stop without a stack trace. `main` catches it. */
class Quit extends Error {}

async function pngsIn(dir: string): Promise<ImportFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: ImportFile[] = [];
  for (const entry of entries) {
    // macOS leaves `.DS_Store` in every folder anybody has opened, and a
    // tool that shouted about one would be shouting about something the
    // captain cannot see and did not create.
    if (!entry.isFile() || !/\.png$/i.test(entry.name)) continue;
    out.push({ name: entry.name, bytes: new Uint8Array(await readFile(path.join(dir, entry.name))) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function report(problems: Problem[]): void {
  for (const p of problems) console.error(`${p.code}  ${p.where}  ${p.detail}`);
  if (problems.length) {
    console.error(`\n${problems.length} problem(s). Nothing was written.`);
    process.exitCode = 1;
    throw new Quit();
  }
}

/**
 * Which look a token names: an id of the book, or the captain's own portrait
 * number.
 *
 * Both are accepted because both are how a person refers to this artwork. The
 * first delivered look is *the auburn curly girl*, which the captain identified
 * as portrait `02-girl` and not as a look id — they have never seen the ids —
 * and the mapping from one to the other is the portraits' own mapping, so there
 * is one answer and not two.
 */
function resolveLook(book: BookTemplate, token: string): string {
  if (book.looks.some((l) => l.id === token)) return token;
  const parsed = portraitName(`${token}.png`);
  if (parsed) {
    // By number within the gender: the captain's `02-girl` is the second girl
    // look of the book, because the book lists its girl looks in the captain's
    // own order. `portraitMapping` is the same indexing applied to a whole
    // folder and `docs/artwork.md` is the table it produces.
    const nth = book.looks.filter((l) => l.gender === parsed.gender)[parsed.number - 1];
    if (nth) return nth.id;
  }
  console.error(
    `"${token}" is neither a look id of ${book.id} nor a portrait number.\n` +
      `look ids: ${book.looks.map((l) => l.id).join(", ")}`,
  );
  process.exitCode = 2;
  throw new Quit();
}

// ---------------------------------------------------------------------------

/**
 * **One look's folder: its finished pages and its cover wraps, as two sets.**
 *
 * The folder holds both and `lib/artwork/prepare.ts` partitions it with one
 * function, so the two preparations cannot claim the same file. They are
 * written as **two versions of two sets** — `lib/artwork/release.ts`
 * § `coverSet` says why: a folder of nothing but a corrected cover is an
 * ordinary thing to be handed, and one set would make writing it delete the
 * interior pages.
 *
 * Everything is checked before anything is written, across both halves: a
 * refusal in the covers stops the pages too, because the captain is about to go
 * back to an image tool either way and half an import is the state nobody can
 * read.
 */
async function importLook(dir: string, token: string): Promise<void> {
  const lookId = resolveLook(FIRST_BOOK, token);
  const files = await pngsIn(dir);
  console.log(`${files.length} file(s) from ${dir} as look "${lookId}"`);

  // The same preparation `npm run artwork:upload` does, which is also the same
  // check an order's regenerated pages get and the same place the captain's
  // `spread-NN-left|right` spelling is mapped onto page ids — derived from the
  // book's own spread pairing, so moving a page moves the name.
  const prepared = prepareLookPages(FIRST_BOOK, files);
  const covers = prepareCoverWraps(FIRST_BOOK, lookId, files);
  report([...prepared.problems, ...covers.problems]);

  if (prepared.pages.length) {
    const version = await store.put(lookSet(lookId), pagesForStore(prepared), NOW);
    for (const page of prepared.pages) console.log(`  ${page.from} → ${page.pageId}`);
    console.log(
      `stored ${version.pages.length} page(s) as ${lookSet(lookId)} v${version.version} in ${store.describe}`,
    );
    // Both sets, so the cover this run just cut is not reported as missing.
    const missing = pagesNotCovered(FIRST_BOOK, prepared, covers);
    if (missing.length) {
      // The honest statement of a partial delivery rather than a silent one.
      console.log(`not delivered, still drawn from the placeholder: ${missing.join(", ")}`);
    }
  } else {
    console.log(`no interior pages in this folder; ${lookSet(lookId)} is untouched`);
  }

  if (covers.pages.length) {
    const version = await store.put(coverSet(lookId), pagesForStore(covers), NOW);
    for (const page of covers.pages) {
      console.log(`  ${page.from.padEnd(24)} → ${page.pageId.padEnd(22)} ${page.did ?? ""}`);
    }
    for (const line of covers.skipped) console.log(`  kept whole: ${line}`);
    console.log(
      `stored ${version.pages.length} cover file(s) as ${coverSet(lookId)} v${version.version} in ` +
        store.describe,
    );
    if (covers.missing.length) {
      console.log(
        `no ${covers.missing.join(" and ")} wrap in this folder — expected ` +
          `${coverWrapFileNames().join(" and ")}`,
      );
    }
    if (covers.compare) {
      console.log(compareByEye(lookId, covers.compare, await releaseArtworkFor(FIRST_BOOK, store)));
    }
  } else {
    console.log(
      `no cover wraps in this folder (expected ${coverWrapFileNames().join(" or ")}); ` +
        `${coverSet(lookId)} is untouched and this look's cover is still the placeholder`,
    );
  }
}

/**
 * **The one check for "is this the right baby", and it is a human looking.**
 *
 * It prints the cut front panel beside a page of the same look's interior, as
 * two addresses to open. `lib/book/cover-upload.ts` § What cannot be checked,
 * said plainly is the argument: a brown-haired cover was submitted for the
 * ginger look once, measuring hair colour to catch it was tried twice and
 * failed twice — the warm floors, blankets and backgrounds swamp hair and skin,
 * and ginger, blonde and brown came back within half a degree of hue of each
 * other. **This is a prompt and not a gate**, and saying so is the point: a
 * check that silently fails to catch the thing it is named for is worse than no
 * check.
 */
function compareByEye(
  lookId: string,
  compare: { cover: string; page: string },
  art: ReleaseArtwork,
): string {
  const href = hrefIn(art.urls);
  const pages = art.pages[lookId] ?? {};
  const cover = pages[compare.cover];
  // `tilePage` — the page the chooser's own grid is drawn from, which is the
  // one page of this book chosen for showing *which baby* rather than which
  // picture. If it has not been imported there is nothing to compare against
  // and the prompt is left out rather than pointed at a babyless page.
  const page = pages[compare.page];
  if (!cover || !page) return "";
  return [
    "",
    "COMPARE THESE BY EYE — is the baby on the cover the baby in the book?",
    `  ${compare.cover.padEnd(8)} ${href(cover)}`,
    `  ${compare.page.padEnd(8)} ${href(page)}`,
    "A brown-haired cover was submitted for the ginger look once. Measuring hair colour to",
    "catch that was tried twice and failed twice: the warm floors and blankets swamp it, and",
    "ginger, blonde and brown came back within half a degree of hue of each other. So this is",
    "a prompt and not a gate — nothing refuses on it.",
  ].join("\n");
}

/** The portraits, flattened onto white, as the chooser's tiles. */
async function importPortraits(dir: string): Promise<void> {
  const files = await pngsIn(dir);
  console.log(`${files.length} portrait(s) from ${dir}`);

  const prepared = preparePortraits(FIRST_BOOK, files);
  for (const portrait of prepared.pages) {
    console.log(
      `  ${portrait.from.padEnd(14)} → ${portrait.lookId.padEnd(8)} ${portrait.label.padEnd(8)} ` +
        `${portrait.did ?? ""}`,
    );
  }
  report(prepared.problems);

  const version = await store.put(TILES_SET, pagesForStore(prepared), NOW);
  console.log(
    `stored ${version.pages.length} portrait(s) as ${TILES_SET} v${version.version} in ${store.describe}`,
  );
  console.log(
    "\nTWO OF THE 10 NOVEMBER SET WERE TO BE REPLACED: `02-girl` and the second boy — `08-boy`\n" +
      "under that set's numbering, which ran 07–12 for the boys — had a red/yellow halo from the\n" +
      "background they were cut out of, measured on their own edge pixels at 98.5 % and 86.5 %.\n" +
      "The set is now fourteen, numbered 01–07 within each gender; either way a re-import is the\n" +
      "next version and the previous one stays readable. docs/artwork.md § 2.",
  );
}

/** The twelve golden spreads, split, right halves kept, preview only. */
async function importGhosts(dir: string): Promise<void> {
  const files = await pngsIn(dir);
  console.log(`${files.length} spread(s) from ${dir}`);

  const prepared = prepareGhostHalves(FIRST_BOOK, files);
  for (const page of prepared.pages) {
    console.log(`  ${page.from.padEnd(16)} → ${page.pageId.padEnd(9)} ${page.did ?? ""}`);
  }
  report(prepared.problems);
  for (const line of prepared.skipped) console.log(`  skipped ${line}`);

  const version = await store.put(GHOSTS_SET, pagesForStore(prepared), NOW);
  console.log(
    `stored ${version.pages.length} preview half/halves as ${GHOSTS_SET} v${version.version} in ` +
      `${store.describe}`,
  );
  console.log(
    "\nThese are preview resolution and can never be printed: they are stored as a different type\n" +
      "(`lib/book/preview-art.ts`) that the renderer's print path has no argument to accept.",
  );
}

/** What this machine holds, and what the captain still owes. */
async function status(): Promise<void> {
  const art = await releaseArtworkFor(FIRST_BOOK, store);
  console.log(`artwork store: ${art.describe}`);
  if (art.sets.length === 0) {
    console.log(
      "nothing imported. The shop draws every page from the numbers in templates/first-book.ts,\n" +
        "which is a complete, printable book — see `npm run book`.",
    );
    return;
  }
  for (const set of art.sets) {
    console.log(`  ${set.set.padEnd(14)} v${set.version}  ${set.at.slice(0, 10)}  ${set.pages} page(s)`);
  }
  const delivered = Object.keys(art.pages);
  console.log(
    `\n${delivered.length} of ${FIRST_BOOK.looks.length} look(s) have pages: ` +
      `${delivered.join(", ") || "none"}`,
  );
  console.log(
    `${Object.keys(art.tiles).length} of ${FIRST_BOOK.looks.length} look(s) have a portrait tile`,
  );
  console.log(`${Object.keys(art.ghosts).length} page(s) have a golden preview half`);

  /**
   * The screen-sized copies, which is what the preview actually fetches.
   *
   * Counted against the pictures this book names rather than against the whole
   * store, and reported as a shortfall with the command that closes it —
   * `docs/artwork.md` § 6a. A local store has none and says so, because a
   * directory has no URL to serve one from.
   */
  const pictures = Object.keys(art.urls).length;
  const copies = Object.keys(art.screen).length;
  console.log(
    pictures === 0
      ? "no screen-sized copies: this store publishes no URLs, so every picture is served whole"
      : `${copies} of ${pictures} published picture(s) have a screen-sized copy` +
          (copies < pictures ? " — `npm run artwork:upload -- --screens` makes the rest" : ""),
  );

  console.log(coverState(art));
  // Counted out of the book and what the store holds, never typed: the number
  // of looks is data (`templates/first-book.ts` § `LOOKS`) and a sentence that
  // said "eleven" would be wrong the day the captain settles on a different
  // count — which is exactly what happened to the sentence this replaced.
  console.log(
    `\nstill owed: ${FIRST_BOOK.looks.length - delivered.length} more look(s), two cover wraps ` +
      "for every look, and the portrait replacements in docs/artwork.md § 2. The storage question is\n" +
      "answered — two Cloudflare R2 buckets, the looks bucket public behind a custom domain\n" +
      "and the order-artwork bucket private; lib/artwork/r2.ts is the adapter and\n" +
      "`npm run artwork:upload` is how the looks get there.",
  );
}

/**
 * **Which of the two wraps each look has, and whether its display cover was
 * cut.**
 *
 * Reported per look and per product rather than as one count, because the
 * states are genuinely different and the captain has to know which file to
 * send: a look with a softcover wrap and no hardcover one is sellable today; a
 * look with a hardcover wrap and no softcover one has **no display cover at
 * all**, because the cut is taken from the softcover's front panel and only
 * from a product whose template has been read.
 *
 * The columns come off `COVER_PRODUCT_IDS` and the rows off the book's own
 * looks, so a third product or a fourteenth look changes this table and not
 * this function.
 */
function coverState(art: ReleaseArtwork): string {
  const rows = FIRST_BOOK.looks.map((look) => {
    const wraps = art.wraps[look.id] ?? {};
    const cut = Boolean(art.pages[look.id]?.[FIRST_BOOK.cover.id]);
    return { look, wraps, cut, any: cut || COVER_PRODUCT_IDS.some((id) => wraps[id]) };
  });
  const some = rows.filter((r) => r.any);
  if (some.length === 0) {
    return (
      `\nno cover artwork for any of the ${FIRST_BOOK.looks.length} look(s): every cover is ` +
      "still the drawn placeholder, and the print path composes a wrap from it.\n" +
      `A look's cover is two wraps — ${coverWrapFileNames().join(" and ")} — in the look's own ` +
      "folder; docs/look-upload-contract.md § 2b."
    );
  }

  const width = Math.max(...FIRST_BOOK.looks.map((l) => l.id.length), 4);
  const head = ["look".padEnd(width), ...COVER_PRODUCT_IDS.map((id) => id.padEnd(10)), "display"];
  const lines = [`\ncover state, per look:`, `  ${head.join("  ")}`];
  for (const row of some) {
    lines.push(
      `  ${row.look.id.padEnd(width)}  ` +
        COVER_PRODUCT_IDS.map((id) => (row.wraps[id] ? "yes" : "—").padEnd(10)).join("  ") +
        `  ${row.cut ? "cut from the softcover wrap" : "none — the placeholder"}`,
    );
  }
  const none = rows.length - some.length;
  if (none) lines.push(`  and ${none} look(s) with no cover artwork at all`);
  lines.push(
    "The display cover is cut out of the softcover wrap's front panel and never supplied " +
      "beside it,",
    "so what a buyer previews and what the press prints cannot differ: " +
      "lib/book/cover-upload.ts.",
  );
  if (some.some((r) => r.wraps.hardcover)) {
    lines.push(
      "A delivered hardcover wrap is stored and nothing is drawn on it: nobody has opened the " +
        "hardcover's",
      "own template, so where its front panel starts is arithmetic. " +
        "lib/print/printify.ts § HARDCOVER_COVER_WRAP_DERIVED",
      "names the four numbers to read out of it and what flips when they are read.",
    );
  }
  return lines.join("\n");
}

async function main() {
  const [command, dir, token] = process.argv.slice(2);
  if (!command) usage();
  if (command === "status") return status();
  if (!dir) usage();
  const resolved = path.resolve(dir);
  if (command === "look") {
    if (!token) usage();
    return importLook(resolved, token);
  }
  if (command === "portraits") return importPortraits(resolved);
  if (command === "ghosts") return importGhosts(resolved);
  usage();
}

main().catch((error) => {
  if (error instanceof Quit) return;
  console.error(error);
  process.exitCode = 1;
});
