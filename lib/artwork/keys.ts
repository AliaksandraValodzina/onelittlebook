/**
 * **What may become a path segment, and what a page may be called.**
 *
 * Lifted out of `./store.ts` the day there were two implementations of
 * `ArtworkStore` — the filesystem and Vercel Blob — because both of them turn a
 * key into a path and **the check has to be the same check**. A second copy of
 * this regex in `./blob.ts` is how the bucket would one day accept a key the
 * disk refuses, and the key the disk refuses is `../../`.
 *
 * It is a leaf on purpose: nothing here imports anything of this project, which
 * is what lets `./store.ts` and `./blob.ts` both have it without importing each
 * other. `./store.ts` re-exports `NotAnOrderReference` so no caller had to
 * learn a new module when this one appeared.
 */

/** A key is a path segment here, so it is checked before it is one. */
export class NotAnOrderReference extends Error {}

/**
 * A page id of a book — `cover`, `page-001`, `tile-auburn-curls`. Never a
 * filename, and never anything with a separator or a dot in it.
 */
const PAGE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isArtworkPageId(value: unknown): value is string {
  return typeof value === "string" && PAGE_ID.test(value);
}

/**
 * A key of the captain's released artwork: one of the two sets that are not a
 * look, or a look's own id.
 *
 * Checked for the same reason an order reference is, even though every value
 * is a constant of this repository rather than anything from a request: the
 * check is what makes that still true after somebody wires a set name to
 * something a user typed.
 */
const RELEASE_KEY = /^(tiles|ghosts|look-[a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function isReleaseSet(value: unknown): boolean {
  return typeof value === "string" && RELEASE_KEY.test(value);
}

/**
 * `v0001`, `v0002` … — the same spelling on the disk and in the bucket.
 *
 * Padded so a plain lexical sort of a directory listing or a blob prefix is
 * also a numeric one, which is what lets both implementations find the highest
 * version without parsing every name first.
 */
export function versionDir(version: number): string {
  return `v${String(version).padStart(4, "0")}`;
}

const VERSION_DIR = /^v(\d{4,})$/;

/** The number in a `v0001`, or null for anything else in the listing. */
export function versionOfDir(name: string): number | null {
  const match = VERSION_DIR.exec(name);
  return match ? Number(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Screen derivatives
// ---------------------------------------------------------------------------

/**
 * **The width a screen derivative is made at.**
 *
 * A spread is shown about 700 CSS px wide, so 1600 is sharp on a retina
 * display at twice that and still a WebP under 150 KB; the master it is made
 * from is 3600 px, which is 26 times the pixels the screen uses. The number is
 * here rather than in the module that resizes, because the **key carries it**
 * and a reader of a listing has to be able to get it back out.
 *
 * It is a ceiling and never a target: a master narrower than this is re-encoded
 * at its own width (`screenKey` is given the width that was produced), because
 * upscaling a picture to meet a constant would be a bigger file than the one it
 * replaced. The portraits are 1254 px and the golden halves 887 px, so both of
 * those are the ordinary case rather than an exception.
 */
export const SCREEN_WIDTH = 1600;

/** The prefix every derivative is under, so one listing finds all of them. */
export const SCREEN_PREFIX = "screen/";

/**
 * Where one derivative lives: named by **the digest of the master it was made
 * from**, not by its own content.
 *
 * That is the one place this layout departs from "the content is the name"
 * (`lib/artwork/blob.ts` § The layout) and it is a deliberate trade. A reader
 * holds an `AssetRef` — the master's digest — and needs the answer *"is there a
 * screen-sized copy of this"* without a second manifest to consult. Keying on
 * the master's digest makes that a lookup rather than a round trip, and the
 * immutability argument still holds in the direction that matters: a corrected
 * page is different bytes, so it has a different master digest, so its
 * derivative is at a different key and no cache anywhere can serve the old
 * picture for the new page.
 *
 * The width is in the name so that changing `SCREEN_WIDTH` one day does not
 * silently serve the old size — it is a different key, and the old file stays
 * readable exactly as every earlier artwork version does.
 */
export function screenKey(masterDigest: string, width: number): string {
  return `${SCREEN_PREFIX}${masterDigest}-w${width}.webp`;
}

const SCREEN_KEY = /^([0-9a-f]{64})-w(\d{2,5})\.webp$/;

/**
 * The master digest and width out of a derivative's pathname, or null for
 * anything else in a listing.
 *
 * Tolerant in the same way `versionOfDir` is: a store may hold a file nobody
 * here wrote, and the honest answer for one is "not a derivative" rather than
 * an exception on a read path a page is waiting on.
 */
export function screenKeyOf(pathname: string): { of: string; width: number } | null {
  const name = pathname.startsWith(SCREEN_PREFIX) ? pathname.slice(SCREEN_PREFIX.length) : pathname;
  const match = SCREEN_KEY.exec(name);
  return match ? { of: match[1], width: Number(match[2]) } : null;
}
