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
