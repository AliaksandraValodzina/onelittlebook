/**
 * **Push the captain's delivered artwork to the public Blob store.**
 *
 *     npm run artwork:upload
 *     npm run artwork:upload -- --dry-run
 *     npm run artwork:upload -- --only portraits
 *     npm run artwork:upload -- --pages ~/art/pages --portraits ~/art/tiles --ghosts ~/art/gold
 *     npm run artwork:upload -- --look 05-boy --pages ~/art/the-fifth-boy
 *
 * The three directories default to the folders the artwork was delivered into —
 * `~/Downloads/approved-pages-3600x3600`, `~/Downloads/baby-portraits-v2` and
 * `~/Downloads/golden-spreads` — and each is an **argument**, because those
 * folders will not stay in Downloads forever and a tool that can only read one
 * path is a tool that gets edited instead of run.
 *
 * ## What it does, in the order it does it
 *
 * 1. **Reads the folders.** A folder that is not there is reported and skipped,
 *    not an error: the captain may be re-uploading two portraits and have
 *    nothing else to hand.
 * 2. **Prepares every set the same way `npm run artwork` does** —
 *    `lib/artwork/prepare.ts`, which is the one implementation of the filename
 *    mapping, the flattening and the right-half split, held to
 *    `docs/look-upload-contract.md` § 2 by the same function an order's
 *    regenerated pages are held to.
 * 3. **Refuses the whole set if anything is wrong**, before a byte is written.
 *    An upload changes what a paid book looks like and a gate that can be
 *    skipped is not a gate.
 * 4. **Compares against what the store already has.** A set whose pages are
 *    digest-for-digest what the current version holds is **skipped entirely** —
 *    no new version, no upload, no churn — so running this twice in a row does
 *    nothing the second time.
 * 5. **Uploads only the bytes that are not there.** Keys are content hashes
 *    (`lib/artwork/blob.ts` § The layout), so re-uploading a set with two
 *    corrected portraits in it uploads two files and writes one new manifest.
 * 6. **Says what it uploaded, what it skipped and why**, and prints the public
 *    URL of the first picture of each set, which is the thing to paste into a
 *    browser when the question is "is it actually there".
 *
 * ## Why a corrected page cannot be served stale
 *
 * The captain is replacing `02-girl` and `08-boy` for edge fringing. A
 * corrected portrait is **different bytes**, so it gets a different key and a
 * different URL; nothing anywhere — no CDN, no browser, no `cache-control` — can
 * serve the old picture at the new address, because they are not the same
 * address. That is the whole reason the keys are hashes rather than names.
 *
 * ## It never writes to the private store
 *
 * This command can only reach `olb-looks`, and not by convention: it holds a
 * `PublicArtworkStore`, whose key check refuses an order reference and whose
 * type cannot be passed anywhere a per-order store is wanted.
 * `test/artwork-separation.test.ts` is the proof.
 */

import { readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FIRST_BOOK } from "../templates/first-book";
import {
  GHOSTS_SET,
  TILES_SET,
  lookSet,
  releaseRoot,
} from "../lib/artwork/release";
import { LOOKS_TOKEN_VAR, looksBlobStore, looksTokenIn } from "../lib/artwork/blob";
import type { PublicArtworkStore } from "../lib/artwork/store";
import { sha256 } from "../lib/assets/digest";
import { portraitName, type ImportFile } from "../lib/artwork/import";
import {
  pagesForStore,
  pagesNotCovered,
  prepareGhostHalves,
  prepareLookPages,
  preparePortraits,
  type Prepared,
} from "../lib/artwork/prepare";
import type { BookTemplate } from "../lib/book/types";

/** Where the three sets were delivered. Overridable, and the reason they are. */
const DEFAULT_DIRS = {
  pages: path.join(os.homedir(), "Downloads", "approved-pages-3600x3600"),
  portraits: path.join(os.homedir(), "Downloads", "baby-portraits-v2"),
  ghosts: path.join(os.homedir(), "Downloads", "golden-spreads"),
};

/**
 * Which look the pages folder is for.
 *
 * The first delivered look is *the auburn curly girl*, which the captain calls
 * portrait `02-girl`; `--look` takes either that or a look id, resolved by the
 * portraits' own mapping so there is one answer and not two.
 */
const DEFAULT_LOOK = "02-girl";

type SetName = "pages" | "portraits" | "ghosts";

class Quit extends Error {}

function usage(): never {
  console.error(
    [
      "usage: npm run artwork:upload -- [options]",
      "",
      "  --pages <dir>       the 24 finished pages        (default ~/Downloads/approved-pages-3600x3600)",
      "  --portraits <dir>   the 12 portrait tiles        (default ~/Downloads/baby-portraits-v2)",
      "  --ghosts <dir>      the 12 golden spreads        (default ~/Downloads/golden-spreads)",
      "  --look <id|NN-sex>  which look the pages are for (default 02-girl)",
      "  --only <set>        pages | portraits | ghosts, repeatable",
      "  --dry-run           prepare and compare, write nothing",
      "",
      `It writes to the public Blob store and needs ${LOOKS_TOKEN_VAR}.`,
      "To import onto this machine instead: npm run artwork -- look <dir> <look>",
    ].join("\n"),
  );
  process.exitCode = 2;
  throw new Quit();
}

interface Options {
  dirs: typeof DEFAULT_DIRS;
  look: string;
  only: SetName[];
  dryRun: boolean;
}

function parse(argv: string[]): Options {
  const dirs = { ...DEFAULT_DIRS };
  let look = DEFAULT_LOOK;
  const only: SetName[] = [];
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (!v) usage();
      return v;
    };
    if (arg === "--pages") dirs.pages = path.resolve(next());
    else if (arg === "--portraits") dirs.portraits = path.resolve(next());
    else if (arg === "--ghosts") dirs.ghosts = path.resolve(next());
    else if (arg === "--look") look = next();
    else if (arg === "--only") {
      const set = next();
      if (set !== "pages" && set !== "portraits" && set !== "ghosts") usage();
      only.push(set);
    } else if (arg === "--dry-run") dryRun = true;
    else usage();
  }

  return { dirs, look, only: only.length ? only : ["pages", "portraits", "ghosts"], dryRun };
}

/** A look id out of either spelling. The same rule `npm run artwork` uses. */
function resolveLook(book: BookTemplate, token: string): string {
  if (book.looks.some((l) => l.id === token)) return token;
  const parsed = portraitName(`${token}.png`);
  if (parsed) {
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

/** The PNGs in a folder, or null when there is no such folder. */
async function pngsIn(dir: string): Promise<ImportFile[] | null> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const out: ImportFile[] = [];
  for (const entry of entries) {
    // macOS leaves `.DS_Store` in every folder anybody has opened.
    if (!entry.isFile() || !/\.png$/i.test(entry.name)) continue;
    out.push({ name: entry.name, bytes: new Uint8Array(await readFile(path.join(dir, entry.name))) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------

/** What happened to one set, for the summary at the end. */
interface Outcome {
  set: string;
  state: "uploaded" | "unchanged" | "absent" | "refused" | "would-upload";
  detail: string;
}

/**
 * **Is this set already in the store, exactly?**
 *
 * Page id and digest, both ways, against the *current* version. Equal means
 * there is nothing to do: a new version holding identical bytes would be churn
 * with a cost — it is what a reprint of an existing order would then resolve
 * against, for no change in a single pixel.
 */
function sameAsCurrent(
  prepared: Prepared,
  current: { pages: Array<{ pageId: string; asset: { sha256: string } }> } | null,
): boolean {
  if (!current) return false;
  if (current.pages.length !== prepared.pages.length) return false;
  const held = new Map(current.pages.map((p) => [p.pageId, p.asset.sha256]));
  for (const page of prepared.pages) {
    if (held.get(page.pageId) !== sha256(page.bytes)) return false;
  }
  return true;
}

async function uploadSet(
  store: PublicArtworkStore,
  set: string,
  dir: string,
  prepared: Prepared,
  options: Options,
): Promise<Outcome> {
  console.log(`\n${set} — ${prepared.pages.length} page(s) from ${dir}`);
  for (const page of prepared.pages) {
    console.log(`  ${page.from.padEnd(22)} → ${page.pageId.padEnd(10)} ${page.did ?? ""}`);
  }
  for (const line of prepared.skipped) console.log(`  skipped ${line}`);

  if (prepared.problems.length) {
    for (const p of prepared.problems) console.error(`  ${p.code}  ${p.where}  ${p.detail}`);
    return {
      set,
      state: "refused",
      detail: `${prepared.problems.length} problem(s); nothing was written for this set`,
    };
  }
  if (prepared.pages.length === 0) {
    return { set, state: "absent", detail: `no usable PNGs in ${dir}` };
  }

  const current = await store.current(set);
  if (sameAsCurrent(prepared, current)) {
    return {
      set,
      state: "unchanged",
      detail: `v${current!.version} already holds these exact ${prepared.pages.length} page(s)`,
    };
  }

  if (options.dryRun) {
    return {
      set,
      state: "would-upload",
      detail: current
        ? `would become v${current.version + 1} (v${current.version} differs)`
        : "would become v1 (the store has nothing for this set)",
    };
  }

  const version = await store.put(set, pagesForStore(prepared), new Date());
  const first = version.pages[0];
  if (first?.url) console.log(`  one of them is at ${first.url}`);
  return {
    set,
    state: "uploaded",
    detail: `v${version.version}, ${version.pages.length} page(s)` + (current ? ` (was v${current.version})` : ""),
  };
}

async function main() {
  const options = parse(process.argv.slice(2));

  const token = looksTokenIn(process.env);
  if (!token) {
    // Named, never printed. The same refusal shape the money path has: say
    // which row is empty and write nothing.
    console.error(
      `${LOOKS_TOKEN_VAR} is not set, so there is no public Blob store to upload to.\n` +
        "Nothing has been read and nothing has been written.\n\n" +
        "  • on the captain's machine: `vercel env pull .env.local` writes it\n" +
        `  • to import onto this machine instead: npm run artwork -- look <dir> <look>\n` +
        `    (that writes to ${releaseRoot(process.env)}, which .gitignore excludes)`,
    );
    process.exitCode = 1;
    throw new Quit();
  }

  const store = looksBlobStore(token);
  console.log(`uploading to ${store.describe}`);
  if (options.dryRun) console.log("DRY RUN — nothing will be written");

  const lookId = resolveLook(FIRST_BOOK, options.look);
  const outcomes: Outcome[] = [];

  for (const which of options.only) {
    const dir = options.dirs[which];
    const files = await pngsIn(dir);
    const set = which === "pages" ? lookSet(lookId) : which === "portraits" ? TILES_SET : GHOSTS_SET;

    if (!files) {
      // Not an error: the captain re-uploading two portraits has no reason to
      // have the other two folders on this machine at all.
      outcomes.push({ set, state: "absent", detail: `no such directory: ${dir}` });
      continue;
    }

    const prepared =
      which === "pages"
        ? prepareLookPages(FIRST_BOOK, files)
        : which === "portraits"
          ? preparePortraits(FIRST_BOOK, files)
          : prepareGhostHalves(FIRST_BOOK, files);

    outcomes.push(await uploadSet(store, set, dir, prepared, options));

    if (which === "pages" && prepared.problems.length === 0) {
      const missing = pagesNotCovered(FIRST_BOOK, prepared);
      if (missing.length) {
        console.log(
          `  not delivered, still drawn from the placeholder: ${missing.join(", ")}` +
            (missing.includes(FIRST_BOOK.cover.id)
              ? "\n  — the cover is the one that matters: there is no cover artwork yet, so the " +
                "book's cover is still the drawn placeholder and visibly is."
              : ""),
        );
      }
    }
  }

  console.log("\n— what happened —");
  for (const outcome of outcomes) {
    console.log(`  ${outcome.state.padEnd(13)} ${outcome.set.padEnd(16)} ${outcome.detail}`);
  }

  if (outcomes.some((o) => o.state === "refused")) {
    console.error("\nAt least one set was refused. Nothing was written for it.");
    process.exitCode = 1;
    return;
  }
  if (outcomes.every((o) => o.state === "absent")) {
    console.error("\nNothing was uploaded: none of the directories exist.");
    process.exitCode = 1;
    return;
  }

  console.log(
    "\nThe deployed shop reads this store on the next request — there is nothing to redeploy.\n" +
      "`npm run artwork -- status` reads whichever store this environment points at.",
  );
}

main().catch((error) => {
  if (error instanceof Quit) return;
  // The store's own refusals — a rotated token, a store that was deleted, a
  // rate limit — are a sentence and not a stack trace. `@vercel/blob` prefixes
  // every one of them, and matching the prefix keeps this script from being a
  // second importer of the SDK (`lib/artwork/blob.ts` is the only one).
  if (error instanceof Error && error.message.startsWith("Vercel Blob:")) {
    console.error(`\n${error.message}`);
    console.error(
      `Nothing further was written. Check ${LOOKS_TOKEN_VAR} is the token for olb-looks:\n` +
        "  vercel env pull .env.local",
    );
    process.exitCode = 1;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
