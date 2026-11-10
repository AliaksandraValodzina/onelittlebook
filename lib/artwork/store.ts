/**
 * **Where one order's regenerated artwork lives — and the decision the captain
 * still owes.**
 *
 * ## It must never be in git, and that is the hard requirement
 *
 * Per-order artwork is **one family's child**. The repository is public and git
 * history is permanent: a file committed by mistake and deleted in the next
 * commit is still there, still fetchable, forever, by anybody. So nothing this
 * module writes may ever be inside the working tree in a way `git add .` could
 * pick up. `.gitignore` excludes the default directory and
 * `test/order-artwork.test.ts` asserts that it does — a gitignore rule is a
 * one-line thing to lose in a merge, and this is the one rule in the repository
 * whose loss cannot be undone.
 *
 * `fixtures/assets/` is the opposite case and the comparison is worth making:
 * that holds *the shop's own* artwork, the same twenty-four pictures for every
 * buyer, which is why it can be committed at all. The twelve looks are a public
 * product; a regenerated child is one order's private document.
 *
 * ## THE DECISION THE CAPTAIN HAS NOT MADE
 *
 * **Two candidates, and this module does not choose between them:**
 *
 * **Vercel Blob.** Private Blob is generally available and this app runs on
 * Vercel, so it is one integration, no credentials to rotate by hand, and reads
 * are already authenticated by OIDC. Against it: a second storage product
 * beside the R2 bucket the orders are already in, and two places to look when
 * something is missing.
 *
 * **The Keepnook-style content origin** — the R2 bucket this project already
 * has, under a private prefix, exactly as a buyer's photograph is stored
 * (`lib/orders/store.ts` § Photographs are private). Against it: the artwork is
 * forty megabytes an order rather than one, and R2's egress-free pricing is a
 * reason to like it rather than a reason to be sure.
 *
 * **Nothing is picked here, because picking it is the captain's call and the
 * cost of being wrong is a migration.** What is built instead is the seam: the
 * `OrderArtworkStore` interface below is five operations, `localArtworkStore`
 * implements it against the filesystem, and swapping in either candidate is one
 * new file and no change above this line. That is the same arrangement
 * `lib/orders/store.ts` describes for R2 and the same arrangement that made
 * *this* file possible to write before the answer existed.
 *
 * **The local implementation is not production.** A Vercel function's
 * filesystem is read-only outside `/tmp`, and `/tmp` is per instance and gone
 * on the next deploy — `lib/orders/store.ts` opens with that fact. So the local
 * store is right for the captain running this on their own machine, which is
 * where a forty-megabyte artwork swap is actually going to happen, and it is
 * **not** a silent fallback that would accept an upload in production and lose
 * it: `artworkStoreFromEnv` says which directory it is writing to, the admin
 * page prints that sentence, and `describe` is what it prints.
 *
 * ## Versions, and why nothing is ever overwritten
 *
 * A re-upload is a **new version**, numbered, and the previous one stays on
 * disk. The reason is the failure this path actually has: a character swap that
 * looks right in a thumbnail and wrong at 3600 px, discovered after the
 * replacement has been uploaded. If a re-upload overwrote, that discovery would
 * be unrecoverable — the only copy of the artwork the captain was happy with
 * would be gone, and the pages would have to be regenerated, which an image
 * model will not do identically. So `put` only ever adds, `current` is the
 * highest version, and every earlier one is still readable.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "../assets/resolve";
import { readPngHeader } from "../render/png";
import { isReference } from "../orders/record";
import { value } from "../env";
import type { AssetRef } from "../template/types";

/** One page of one version, named by the page it replaces and by its content. */
export interface ArtworkPage {
  /** A page id of the book — `cover`, `page-001`. Never a filename. */
  pageId: string;
  /**
   * The bytes, by content hash and measured size.
   *
   * An `AssetRef` and not a path, which is what lets the renderer treat this
   * artwork exactly as it treats the twelve looks' artwork: `lib/book/derive.ts`
   * puts an `image` layer on the page and the bytes arrive through the
   * `supplied` seam. Nothing downstream knows this picture came from an order
   * rather than from a release.
   */
  asset: AssetRef;
}

export interface ArtworkVersion {
  /** 1, 2, 3 … The highest is the one in use. */
  version: number;
  /** ISO 8601, from the clock the caller passed in. */
  at: string;
  pages: ArtworkPage[];
}

/**
 * The store, as everything above this line sees it.
 *
 * Five operations, which is the whole of what "hand the captain the clean
 * pages, take the regenerated ones back, print the order, and be able to go
 * back a version" needs. Every operation this interface does not have is a
 * feature nobody has asked for that a Blob or R2 implementation would have to
 * provide.
 */
export interface OrderArtworkStore {
  /** How the admin page names where it is reading from. Never a credential. */
  readonly describe: string;
  /** Oldest first. Empty for an order nobody has uploaded artwork for. */
  versions(ref: string): Promise<ArtworkVersion[]>;
  /** The highest version, or null. */
  current(ref: string): Promise<ArtworkVersion | null>;
  /** Adds a version. Never replaces one — see this file's docblock. */
  put(
    ref: string,
    pages: Array<{ pageId: string; bytes: Uint8Array }>,
    now: Date,
  ): Promise<ArtworkVersion>;
  /** One page's bytes, digest-checked by the caller. */
  read(ref: string, version: number, pageId: string): Promise<Uint8Array | null>;
}

/** The variable that says where the local store writes. */
export const ARTWORK_DIR_VAR = "ORDER_ARTWORK_DIR";

/**
 * Where it writes with nothing configured.
 *
 * A dotted directory beside the repository rather than inside `fixtures/` or
 * `data/`, both of which are committed. `.gitignore` excludes it and
 * `test/order-artwork.test.ts` asserts the rule, because the one thing that
 * must not happen here is a child's picture in a public git history.
 */
export const DEFAULT_ARTWORK_DIR = ".artwork";

/** A reference is a path segment here, so it is checked before it is one. */
export class NotAnOrderReference extends Error {}

const PAGE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION_DIR = /^v(\d{4,})$/;

function versionDir(version: number): string {
  return `v${String(version).padStart(4, "0")}`;
}

/**
 * The store on this machine's filesystem.
 *
 * `<root>/<ref>/v0001/page-006.png` and a `manifest.json` beside the pages. The
 * manifest holds the `AssetRef`s — the digest and the measured pixel size —
 * because those are *derived facts about the bytes* and measuring them again on
 * every read would be the slow way to get the same answer, while trusting a
 * filename for them is the wrong answer. `read` is still digest-checked by the
 * caller against the manifest, so a file swapped under its name is caught.
 */
export function localArtworkStore(root: string): OrderArtworkStore {
  const dirFor = (ref: string) => {
    if (!isReference(ref)) {
      // Checked before it becomes a path segment. A reference arrives from a
      // URL, and `../../` is the oldest trick there is.
      throw new NotAnOrderReference(`${JSON.stringify(ref)} is not an order reference`);
    }
    return path.join(root, ref);
  };

  async function readVersion(ref: string, version: number): Promise<ArtworkVersion | null> {
    try {
      const raw = await readFile(path.join(dirFor(ref), versionDir(version), "manifest.json"), "utf8");
      const parsed: unknown = JSON.parse(raw);
      return readManifest(parsed, version);
    } catch {
      return null;
    }
  }

  return {
    describe: `the filesystem at ${root} — this machine only, nothing here survives a deploy`,

    async versions(ref: string) {
      // The reference is checked **outside** the try, so a path that is not an
      // order reference is a refusal rather than "no versions". The catch below
      // is for a directory that does not exist yet, which is the normal state
      // of every order nobody has uploaded artwork for.
      const dir = dirFor(ref);
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return [];
      }
      const out: ArtworkVersion[] = [];
      for (const entry of entries.sort()) {
        const match = VERSION_DIR.exec(entry);
        if (!match) continue;
        const read = await readVersion(ref, Number(match[1]));
        if (read) out.push(read);
      }
      return out.sort((a, b) => a.version - b.version);
    },

    async current(ref: string) {
      const all = await this.versions(ref);
      return all.length ? all[all.length - 1] : null;
    },

    async put(ref: string, pages: Array<{ pageId: string; bytes: Uint8Array }>, now: Date) {
      const existing = await this.versions(ref);
      const version = (existing[existing.length - 1]?.version ?? 0) + 1;
      const dir = path.join(dirFor(ref), versionDir(version));
      await mkdir(dir, { recursive: true });

      const written: ArtworkPage[] = [];
      for (const page of pages) {
        if (!PAGE_ID.test(page.pageId)) {
          throw new NotAnOrderReference(`${JSON.stringify(page.pageId)} is not a page id`);
        }
        await writeFile(path.join(dir, `${page.pageId}.png`), page.bytes);
        const header = readPngHeader(page.bytes);
        written.push({
          pageId: page.pageId,
          asset: {
            sha256: sha256(page.bytes),
            mime: "image/png",
            // Measured out of the IHDR, never copied from a report:
            // `placePhoto` and the renderer divide by these two numbers.
            px: [header.width, header.height],
            label: `${ref} ${page.pageId} v${version}`,
          },
        });
      }

      const record: ArtworkVersion = { version, at: now.toISOString(), pages: written };
      await writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(record, null, 2)}\n`);
      return record;
    },

    async read(ref: string, version: number, pageId: string) {
      if (!PAGE_ID.test(pageId)) return null;
      try {
        return new Uint8Array(
          await readFile(path.join(dirFor(ref), versionDir(version), `${pageId}.png`)),
        );
      } catch {
        return null;
      }
    },
  };
}

/** A manifest read back tolerantly — it may have been written by an older build. */
function readManifest(raw: unknown, version: number): ArtworkVersion | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<ArtworkVersion>;
  if (!Array.isArray(v.pages)) return null;
  const pages: ArtworkPage[] = [];
  for (const entry of v.pages) {
    const page = entry as Partial<ArtworkPage>;
    const asset = page.asset as Partial<AssetRef> | undefined;
    if (typeof page.pageId !== "string" || !PAGE_ID.test(page.pageId)) continue;
    if (!asset || typeof asset.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(asset.sha256)) continue;
    const px = asset.px;
    if (!Array.isArray(px) || px.length !== 2) continue;
    pages.push({
      pageId: page.pageId,
      asset: {
        sha256: asset.sha256,
        mime: "image/png",
        px: [Number(px[0]), Number(px[1])],
        label: typeof asset.label === "string" ? asset.label : undefined,
      },
    });
  }
  return {
    version: typeof v.version === "number" ? v.version : version,
    at: typeof v.at === "string" ? v.at : "",
    pages,
  };
}

/**
 * The store this environment describes.
 *
 * It always answers, which is the opposite of `storeFromEnv` for orders — and
 * the asymmetry is deliberate. An order store that silently fell back to
 * something that does not survive a redeploy would take money for a book
 * nobody can print, so that one refuses. Artwork is a thing the captain uploads
 * from their own machine and immediately downloads the finished pages from; a
 * directory on that machine is the honest answer to "where does this go until
 * the captain picks a bucket", and `describe` says so out loud wherever it is
 * offered.
 */
export function artworkStoreFromEnv(env: Record<string, string | undefined>): OrderArtworkStore {
  const configured = value(env, ARTWORK_DIR_VAR);
  return localArtworkStore(
    configured ? path.resolve(configured) : path.join(process.cwd(), DEFAULT_ARTWORK_DIR),
  );
}

/**
 * One version's bytes, keyed by content hash — the `supplied` map the renderer
 * takes.
 *
 * **Digest-checked on the way out**, which is `lib/orders/store.ts`
 * § `photoFor`'s rule and catches the same mistake: a file replaced under its
 * own name. Here that mistake would print the wrong child, which is the worst
 * thing this product can do.
 */
export async function artworkBytesFor(
  store: OrderArtworkStore,
  ref: string,
  version: ArtworkVersion,
): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  for (const page of version.pages) {
    const bytes = await store.read(ref, version.version, page.pageId);
    if (!bytes) continue;
    if (sha256(bytes) !== page.asset.sha256) {
      throw new Error(
        `the stored artwork for ${ref} ${page.pageId} v${version.version} does not match its digest`,
      );
    }
    out.set(page.asset.sha256, bytes);
  }
  return out;
}
