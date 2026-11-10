/**
 * Take a folder of looks the checker accepted and make it the book's artwork.
 *
 *     npm run looks:import -- path/to/looks
 *
 * This is the **finished-release** importer: a folder per look, `looks.json`
 * beside them, every page and every cover present, exactly as
 * `docs/look-upload-contract.md` specifies. One set at a time — one look, the
 * portraits, the golden halves — is `npm run artwork`, which is what the
 * captain's delivery of 10 November actually was.
 *
 * Two things happen, in this order, and the order is the point:
 *
 * **It refuses first.** `checkUpload` runs again here rather than trusting that
 * somebody ran `npm run looks`. An import is the step that changes what a paid
 * book looks like, and a gate that can be skipped is not a gate.
 *
 * **It writes the bytes into the artwork store and nothing into the
 * repository.** Twenty-four pages of 3600 px PNG is 155 MB a look and twelve
 * looks is the better part of two gigabytes, which cannot go in a public
 * repository — so it goes where `lib/artwork/release.ts` says, the manifest
 * goes beside it, and the repository keeps ids, digests and slot coordinates
 * and no pixels. That module also states why the manifest is not committed
 * either: a manifest naming bytes a fresh clone does not have is a book that
 * declares twenty-four pages and can draw none of them.
 *
 * **Nothing has to be restamped.** The book's `rev` does not move when artwork
 * lands, because the artwork is bound over the published book at request time
 * (`lib/book/release-art.ts`) rather than written into it. That is what keeps
 * `npm run print`'s byte-identity gate meaningful on a machine with no artwork.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { FIRST_BOOK } from "../templates/first-book";
import { blockingUploadProblems, checkUpload, readManifest } from "../lib/book/upload";
import { lookSet, releaseRoot, releaseStoreFromEnv } from "../lib/artwork/release";

async function main() {
  const root = process.argv[2];
  if (!root) {
    console.error("usage: npm run looks:import -- path/to/looks");
    process.exitCode = 2;
    return;
  }
  const dir = path.resolve(root);

  // Read exactly what the checker reads, so the thing being imported is the
  // thing that was checked.
  const entries = await readdir(dir, { withFileTypes: true });
  let manifestJson: unknown = null;
  try {
    manifestJson = JSON.parse(await readFile(path.join(dir, "looks.json"), "utf8"));
  } catch {
    manifestJson = null;
  }

  const looks = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const names = (await readdir(path.join(dir, entry.name), { withFileTypes: true }))
      .filter((f) => f.isFile() && f.name !== ".DS_Store")
      .map((f) => f.name)
      .sort();
    const files = [];
    for (const name of names) {
      files.push({
        name,
        bytes: new Uint8Array(await readFile(path.join(dir, entry.name, name))),
      });
    }
    looks.push({ look: entry.name, files });
  }

  const problems = blockingUploadProblems(checkUpload(FIRST_BOOK, { manifest: manifestJson, looks }));
  if (problems.length) {
    for (const p of problems) console.error(`${p.code}  ${p.where}  ${p.detail}`);
    console.error(`\n${problems.length} problem(s). Run \`npm run looks -- ${root}\` for the list.`);
    process.exitCode = 1;
    return;
  }

  const declared = readManifest(manifestJson).looks;

  /**
   * **The book's own look list is the published one**, and a folder for a look
   * it does not offer is refused rather than imported.
   *
   * That is a change from the arrangement this script had when the artwork was
   * written into `templates/`: `looks.json` used to *replace* the book's list.
   * It cannot now — the list is committed and a look id is a published address
   * an order names — so a folder nothing could bind is 155 MB written where
   * nothing will read it, and the person running this needs to know before
   * they wait for it.
   */
  const unknown = looks.filter((l) => !FIRST_BOOK.looks.some((b) => b.id === l.look));
  if (unknown.length) {
    for (const look of unknown) {
      console.error(
        `look.unknownToBook  ${look.look}  ${FIRST_BOOK.id} offers ` +
          `${FIRST_BOOK.looks.map((l) => l.id).join(", ")}; declare it in templates/first-book.ts first`,
      );
    }
    process.exitCode = 1;
    return;
  }

  const store = releaseStoreFromEnv(process.env);
  const now = new Date();
  let bytes = 0;

  for (const look of looks) {
    const version = await store.put(
      lookSet(look.look),
      look.files.map((file) => ({
        // `cover.png` is `cover`; `page-006.png` is `page-006`. The page id and
        // nothing derived from a filename beyond it.
        pageId: file.name === "cover.png" ? "cover" : file.name.replace(/\.png$/, ""),
        bytes: file.bytes,
      })),
      now,
    );
    bytes += look.files.reduce((n, f) => n + f.bytes.length, 0);
    console.log(
      `${look.look}: ${version.pages.length} page(s) as ${lookSet(look.look)} v${version.version}`,
    );
  }

  console.log(
    `\nimported ${looks.length} look(s), ${(bytes / 1024 / 1024).toFixed(0)} MB into ` +
      `${releaseRoot(process.env)}`,
  );
  const undeclared = looks.filter((l) => !declared.some((d) => d.id === l.look));
  if (undeclared.length) {
    // `checkUpload` has already refused this, so it cannot happen — kept as the
    // statement of what the manifest is for rather than as a check.
    console.log(`not in looks.json: ${undeclared.map((l) => l.look).join(", ")}`);
  }
  console.log(
    "Nothing was written into the repository and nothing needs restamping. " +
      "Run `npm run artwork -- status` to see what is bound.",
  );
}

void main();
