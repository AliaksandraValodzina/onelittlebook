/**
 * The content hash, on its own.
 *
 * One line of code in its own file, and the reason is an import cycle rather
 * than tidiness. `./resolve.ts` is where assets become bytes, and it now looks
 * in three stores — one of which is `lib/artwork/release.ts`, which needs
 * `lib/artwork/store.ts`, which needs the digest. With `sha256` living in
 * `resolve.ts` that is a cycle, and a cycle between modules with top-level
 * constants is not a style problem: whichever one is imported second sees
 * `undefined` where the other's constants should be, which is exactly the
 * failure it produced.
 *
 * So the leaf is a leaf. `./resolve.ts` re-exports it, because every existing
 * caller asks that module for it and a rename would be churn for nothing.
 */

import { createHash } from "node:crypto";

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
