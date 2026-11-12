/**
 * **Making the screen-sized copy — once, at upload, and nowhere else.**
 *
 * A page of this book is 3600 × 3600 and about 2.6 MB. A spread is shown about
 * 700 CSS px wide, so the master is roughly **26 times the pixels the screen
 * uses**, and a twenty-four page preview was 62 MB over the wire. The same
 * artwork at 1600 px as WebP measured 0.13 MB — about 1.5% of the weight — so
 * the whole preview becomes a couple of megabytes.
 *
 * ## At upload, not per request
 *
 * `npm run artwork:upload` already reads every page, so the resize is one more
 * thing done to bytes that are in hand. The alternative — a transform in front
 * of the store, or Vercel's image optimisation — is a cost paid on **every
 * view, forever**, for an answer that can never change: the store is
 * content-addressed, so a given master's screen copy is the same picture for
 * as long as that master exists. `./keys.ts` § `screenKey` is how it is found
 * again.
 *
 * ## What it is allowed to do to a picture
 *
 * **Shrink and re-encode. Never upscale, never crop, never recolour.** The
 * derivative has to be the same picture or the preview stops being a preview:
 * the buyer approves what they see, and `test/screen-derivatives.test.ts`
 * holds the aspect ratio and the width to that. A master narrower than
 * `SCREEN_WIDTH` is re-encoded at **its own width** — the portraits are
 * 1254 px and the golden halves 887 px, and both are still several megabytes
 * of PNG, so the re-encode is most of the saving even where the resize is
 * none of it.
 *
 * ## Why it may not reach the print path, and how that is kept true
 *
 * A screen derivative in a print file is a soft, low-resolution printed book —
 * the single worst failure this product has, and unlike a bad preview it
 * cannot be undone after a box has been posted. So a derivative is **never an
 * `AssetRef`**: what this function returns is bytes and a width, the store
 * keys them by the master's digest, and `lib/assets/screen.ts` turns that into
 * an address for an `<image href>`. There is no type anywhere that lets one be
 * handed to `loadAsset`, put in an `image` layer or named by a `PageArt` —
 * `test/no-derivative-in-a-print-file.ts` is a file of calls that must not
 * compile, which is the same device `test/no-fold-in-a-print-file.ts` is.
 *
 * `sharp` is imported **lazily** and is a devDependency: it is a native
 * dependency with no business in a deployed function, and the only thing in
 * this repository that makes a derivative is a command the captain runs on
 * their own machine.
 */

import { readPngHeader } from "../render/png";
import { sha256 } from "../assets/digest";
import { SCREEN_WIDTH } from "./keys";
import type { PublicArtworkStore, ScreenUpload } from "./store";

/** One derivative, as the store takes it. Never an `AssetRef`. */
export interface ScreenDerivative {
  /** The digest of the **master** it was made from. The key is built on this. */
  of: string;
  /** The width produced: `min(master width, SCREEN_WIDTH)`. */
  width: number;
  height: number;
  bytes: Uint8Array;
  /** What it did, for the table the upload command prints. */
  did: string;
}

/**
 * The WebP quality.
 *
 * 82 is where the artwork stops gaining visibly and the file keeps shrinking;
 * at 1600 px it puts a page of the captain's artwork around 130 KB. It is a
 * *preview* number and carries no print consequence at all, which is the point
 * of the whole arrangement.
 */
const QUALITY = 82;

/**
 * The screen-sized copy of one master, or **null when there is no point to
 * one**.
 *
 * Null means *this picture is already as small as a derivative of it would
 * be* — the ordinary case for something tiny — and a null is a derivative the
 * upload does not write and the preview never looks for, which leaves the
 * master being served exactly as it is today. That is the honest answer: a
 * derivative that is bigger than the thing it stands in for is a second copy
 * of the artwork and a slower page.
 *
 * `digest` is passed in rather than computed, because the caller already has
 * it — the upload command hashed these bytes to decide whether the store
 * needed them at all.
 */
export async function screenDerivativeOf(
  digest: string,
  bytes: Uint8Array,
): Promise<ScreenDerivative | null> {
  const header = readPngHeader(bytes);
  // Shrink to the ceiling, or leave the size alone. `withoutEnlargement` says
  // the same thing to sharp; both are here because the width in the key has to
  // be the width that was actually produced.
  const width = Math.min(header.width, SCREEN_WIDTH);

  const { default: sharp } = await import("sharp");
  const made = await sharp(Buffer.from(bytes))
    .resize({ width, withoutEnlargement: true, fit: "inside" })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true });

  if (made.info.size >= bytes.byteLength) return null;

  return {
    of: digest,
    width: made.info.width,
    height: made.info.height,
    bytes: new Uint8Array(made.data),
    did:
      `${header.width}×${header.height} ${kb(bytes.byteLength)} PNG → ` +
      `${made.info.width}×${made.info.height} ${kb(made.info.size)} WebP ` +
      `(${Math.round((made.info.size / bytes.byteLength) * 1000) / 10}%)`,
  };
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// ---------------------------------------------------------------------------
// The backfill
// ---------------------------------------------------------------------------

/** What one set's screen copies came to. `lines` is what the command prints. */
export interface ScreenBackfill {
  set: string;
  state: "made" | "unchanged" | "absent" | "refused" | "would-make";
  /** One sentence for the summary table. */
  detail: string;
  /** How many copies were written. */
  made: number;
  /** Pictures a copy would not have been smaller than. */
  skipped: number;
  /** One line per page, for the command's own table. Never a credential. */
  lines: string[];
  /** The address of one of them — the thing to paste into a browser. */
  url?: string;
}

/**
 * **Make the screen copies for one set, out of what the store already holds.**
 *
 * Here and not in `scripts/upload-artwork.ts` because this is the whole of the
 * backfill and a command is glue: `test/screen-derivatives.test.ts` runs it
 * against an in-memory bucket, which is the only way the captain's one command
 * is something more than a hope.
 *
 * **Read from the store rather than from the delivery folder.** The masters are
 * already up there, so this needs no folder on the machine running it — which
 * is what makes `npm run artwork:upload -- --screens` a backfill rather than a
 * second upload of two gigabytes.
 *
 * **Only the pages that have not got one.** `screens()` is one listing of one
 * prefix, so *"which of these twenty-four already have a copy"* costs one
 * request, and a second run downloads nothing and uploads nothing.
 *
 * **The master's digest is checked against its own bytes** before anything is
 * made from them, which is `artworkBytesFor`'s rule: a file replaced under its
 * own name would otherwise produce a preview of a picture that is not the one
 * that prints. That is a refusal for the whole set and never a skip.
 */
export async function backfillScreens(
  store: PublicArtworkStore,
  set: string,
  options: { dryRun?: boolean } = {},
): Promise<ScreenBackfill> {
  const nothing = { set, made: 0, skipped: 0, lines: [] as string[] };
  const version = await store.current(set);
  if (!version || version.pages.length === 0) {
    return { ...nothing, state: "absent", detail: "the store holds no version of this set" };
  }

  const held = await store.screens();
  const missing = version.pages.filter((page) => !held[page.asset.sha256]);
  if (missing.length === 0) {
    return {
      ...nothing,
      state: "unchanged",
      detail: `all ${version.pages.length} page(s) of v${version.version} already have a screen copy`,
    };
  }
  if (options.dryRun) {
    return {
      ...nothing,
      state: "would-make",
      detail:
        `would make ${missing.length} of ${version.pages.length} screen copy/copies ` +
        `at ${SCREEN_WIDTH} px or less`,
    };
  }

  const lines: string[] = [];
  const uploads: ScreenUpload[] = [];
  let skipped = 0;

  for (const page of missing) {
    const bytes = await store.read(set, version.version, page.pageId);
    if (!bytes) {
      // The manifest names a page whose bytes are not there. Reported and
      // skipped rather than fatal: the other twenty-three are still worth
      // making, and `npm run artwork -- status` is where that is chased.
      lines.push(`${page.pageId.padEnd(10)} the store has no bytes for this page`);
      continue;
    }
    if (sha256(bytes) !== page.asset.sha256) {
      return {
        ...nothing,
        lines,
        state: "refused",
        detail: `${page.pageId} does not match the digest v${version.version} names for it`,
      };
    }
    const made = await screenDerivativeOf(page.asset.sha256, bytes);
    if (!made) {
      // Already smaller than a copy of it would be. Nothing is written and the
      // preview goes on serving the master, which is the right answer for a
      // picture not worth shrinking.
      lines.push(`${page.pageId.padEnd(10)} left alone — a copy would not be smaller`);
      skipped++;
      continue;
    }
    lines.push(`${page.pageId.padEnd(10)} ${made.did}`);
    uploads.push({ of: made.of, width: made.width, bytes: made.bytes });
  }

  if (uploads.length === 0) {
    return {
      ...nothing,
      lines,
      skipped,
      state: "unchanged",
      detail: `nothing to make (${skipped} left alone)`,
    };
  }

  const written = await store.putScreens(uploads);
  return {
    set,
    state: "made",
    made: uploads.length,
    skipped,
    lines,
    url: Object.values(written)[0]?.url,
    detail:
      `${uploads.length} screen copy/copies at ${SCREEN_WIDTH} px or less` +
      (skipped ? `, ${skipped} left alone` : ""),
  };
}
