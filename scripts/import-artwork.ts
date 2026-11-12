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
 * **It writes wherever this environment points.** With `BLOB_READ_WRITE_TOKEN`
 * set that is the public Blob store `olb-looks`; with it unset it is a directory
 * on this machine. Every line it prints names the store it wrote to, so there
 * is no way to be wrong about where the bytes went. `npm run artwork:upload` is
 * the command for the bucket specifically: it does all three sets in one run,
 * refuses without the token, and **skips a set whose pages have not changed** —
 * see `scripts/upload-artwork.ts`.
 *
 * It **refuses before it writes**, every time, rather than trusting that
 * somebody ran a checker first: an import changes what a paid book looks like,
 * and a gate that can be skipped is not a gate. A look's pages are held to
 * `docs/look-upload-contract.md` § 2 by the same function an order's
 * regenerated pages are.
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
  lookSet,
  releaseArtworkFor,
  releaseStoreFromEnv,
} from "../lib/artwork/release";
import { portraitName, type ImportFile } from "../lib/artwork/import";
import {
  pagesForStore,
  pagesNotCovered,
  prepareGhostHalves,
  prepareLookPages,
  preparePortraits,
} from "../lib/artwork/prepare";
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
      "to push all three to the public Blob store instead: npm run artwork:upload",
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

/** The captain's twenty-four finished pages, stored byte for byte. */
async function importLook(dir: string, token: string): Promise<void> {
  const lookId = resolveLook(FIRST_BOOK, token);
  const files = await pngsIn(dir);
  console.log(`${files.length} file(s) from ${dir} as look "${lookId}"`);

  // The same preparation `npm run artwork:upload` does, which is also the same
  // check an order's regenerated pages get and the same place the captain's
  // `spread-NN-left|right` spelling is mapped onto page ids — derived from the
  // book's own spread pairing, so moving a page moves the name.
  const prepared = prepareLookPages(FIRST_BOOK, files);
  report(prepared.problems);

  const version = await store.put(lookSet(lookId), pagesForStore(prepared), NOW);

  for (const page of prepared.pages) console.log(`  ${page.from} → ${page.pageId}`);
  const missing = pagesNotCovered(FIRST_BOOK, prepared);
  console.log(
    `stored ${version.pages.length} page(s) as ${lookSet(lookId)} v${version.version} in ${store.describe}`,
  );
  if (missing.length) {
    // The honest statement of a partial delivery rather than a silent one.
    // There is no cover artwork at all yet; the cover is generated per order
    // with a stored fallback and neither exists.
    console.log(
      `not delivered, still drawn from the placeholder: ${missing.join(", ")}` +
        (missing.includes(FIRST_BOOK.cover.id)
          ? "\n  — the cover is the one that matters: there is no cover artwork yet, so the " +
            "book's cover is still the drawn placeholder and visibly is."
          : ""),
    );
  }
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

  const withoutCover = delivered.filter((id) => !art.pages[id][FIRST_BOOK.cover.id]);
  if (withoutCover.length) {
    console.log(`\nno cover artwork for: ${withoutCover.join(", ")} — the cover is still the placeholder.`);
  }
  // Counted out of the book and what the store holds, never typed: the number
  // of looks is data (`templates/first-book.ts` § `LOOKS`) and a sentence that
  // said "eleven" would be wrong the day the captain settles on a different
  // count — which is exactly what happened to the sentence this replaced.
  console.log(
    `\nstill owed: ${FIRST_BOOK.looks.length - delivered.length} more look(s), a cover for every ` +
      "look, and the portrait replacements in docs/artwork.md § 2. The storage question is\n" +
      "answered — two Vercel Blob stores, olb-looks public and olb-orders private;\n" +
      "lib/artwork/blob.ts is the adapter and `npm run artwork:upload` is how the looks get there.",
  );
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
