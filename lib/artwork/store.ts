/**
 * **Where artwork too big or too private for git lives — and which of the two
 * Blob stores it goes to.**
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
 * **The captain's released artwork is now here too**, for a different reason
 * that lands in the same place: one look of finished pages is 155 MB and twelve
 * of them are the better part of two gigabytes, which is not a thing to put in
 * a public repository either. `lib/artwork/release.ts` is that half and it
 * reuses this interface rather than inventing a second one — two storage seams
 * would have been two places to migrate the day the captain picked a bucket,
 * and the one that got missed would have been the one holding the pictures.
 *
 * `fixtures/assets/` is the remaining case and the comparison is worth making:
 * that holds the fixture **photographs**, a few kilobytes each, which the test
 * suite and `npm run print` need with no network and no credential. Small,
 * synthetic and public; neither of the two kinds of artwork is any of those.
 *
 * ## THE DECISION, AND THE ANSWER THE CAPTAIN GAVE
 *
 * The two candidates were **Vercel Blob** — one integration on the platform
 * this app already runs on, no credentials to rotate by hand, reads
 * authenticated by OIDC — and the **Keepnook-style content origin**, the R2
 * bucket the orders are already in, under a private prefix exactly as a buyer's
 * photograph is (`lib/orders/store.ts` § Photographs are private).
 *
 * **The captain picked Blob, and picked it twice**, which is the part worth
 * reading. Two stores exist, not one:
 *
 * | Store | Access | Reached through | Holds |
 * |---|---|---|---|
 * | `olb-looks` | **public** | `BLOB_READ_WRITE_TOKEN` | the looks' pages, the portrait tiles, the golden ghost halves |
 * | `olb-orders` | **private** | `OLB_ORDERS_STORE_ID` + OIDC | one order's regenerated artwork |
 *
 * `./blob.ts` implements this interface against both and `./keys.ts` is the key
 * check both of them share. **`localArtworkStore` below did not become legacy**
 * — it is what a fresh clone, the whole test suite and the captain's own laptop
 * run on, with no token and no network, and the bucket was only ever possible
 * to add because this interface existed first.
 *
 * ## The one thing that may never cross between the two stores
 *
 * Public is a deliberate choice: the looks' pages are shown to everyone during
 * the whole-book preview, with no watermark and no account, and serving
 * twenty-five of them from a CDN rather than from twenty-five function
 * invocations is the reason that promise is affordable. Private is the equally
 * deliberate other half: `olb-orders` holds artwork regenerated from a
 * photograph of **one family's child**, and a guessable URL for that is the
 * worst thing this product could leak.
 *
 * So the types below make the mistake **not compile**. `PublicArtworkStore` and
 * `PrivateArtworkStore` are distinct types with no function that turns one into
 * the other, every caller that writes per-order artwork asks for the private
 * one by type, and the public store's key check (`isReleaseSet`) refuses an
 * order reference at runtime as well. `test/artwork-separation.test.ts` is the
 * proof, including a file whose `@ts-expect-error`s fail `npm run lint` the day
 * the wall stops standing.
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
import { sha256 } from "../assets/digest";
import { NO_SCREEN_ADDRESSES, type ScreenAddresses } from "../assets/address";
import { isReference } from "../orders/record";
import { value } from "../env";
import { NotAnOrderReference, isArtworkPageId, versionDir, versionOfDir } from "./keys";
import {
  artworkPageFor,
  manifestBytes,
  readManifest,
  type ArtworkPage,
  type ArtworkVersion,
} from "./manifest";
import {
  OIDC_TOKEN_VAR,
  ORDERS_STORE_VAR,
  ordersBlobStore,
  ordersStoreIn,
  ordersStoreNamedButUnreachable,
} from "./blob";

export { NotAnOrderReference, NO_SCREEN_ADDRESSES };
export type { ArtworkPage, ArtworkVersion };
/**
 * Re-exported from `lib/assets/address.ts`, where it lives beside
 * `AssetAddresses` so the two can be read against each other — and because a
 * client component needs the type and may not import this module, which reads
 * a filesystem.
 */
export type { ScreenAddress, ScreenAddresses } from "../assets/address";

/**
 * The store, as everything above this line sees it.
 *
 * Six operations, which is the whole of what "hand the captain the clean pages,
 * take the regenerated ones back, print the order, and be able to go back a
 * version" needs. Every operation this interface does not have is a feature
 * nobody has asked for that both implementations would have to provide.
 *
 * `sets` is the sixth and arrived with the bucket. It was a `readdir` in
 * `lib/artwork/release.ts` — the one line up there that knew the local
 * implementation's layout — and that module's docblock said at the time that a
 * bucket would "list a prefix instead, which is the same operation under a
 * different name". It was, so it is an operation now and not a special case.
 */
export interface ArtworkStore {
  /** How the admin page names where it is reading from. Never a credential. */
  readonly describe: string;
  /** Every key this store holds anything under. Unordered. */
  sets(): Promise<string[]>;
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

/**
 * **A store for the captain's released artwork, and nothing else.**
 *
 * The looks' pages, the portrait tiles and the golden ghost halves: the
 * same twenty-four pictures for every buyer, shown to anybody who opens the
 * preview. Backed by `olb-looks`, which is **public**, so everything in it has
 * a CDN URL and that is the point of it.
 *
 * `holds` is a discriminant and exists for exactly one reason: to make
 * `PublicArtworkStore` and `PrivateArtworkStore` **mutually unassignable**, so
 * a function that takes one cannot be handed the other. There is no cast, no
 * widening helper and no function in this repository that turns one into the
 * other. A store is minted by exactly four constructors — `localOrderStore`
 * below, `localReleaseStore` in `./release.ts`, and `looksBlobStore` /
 * `ordersBlobStore` in `./blob.ts` — and that is the whole of the surface.
 *
 * **It has two operations the interface above does not**, and they are here
 * rather than there for the same reason the tag is: a screen-sized copy exists
 * to be fetched from a CDN, and the private store has no URLs at all. A
 * `putScreens` on `ArtworkStore` would be a way to write a page regenerated
 * from a photograph of one family's child to a guessable public key, which is
 * the one thing this file exists to make impossible. `./blob.ts`
 * § `blobScreenStore` is the implementation and is composed only into the
 * public store, so the private one has no such method at runtime either.
 */
export interface PublicArtworkStore extends ArtworkStore {
  readonly holds: "released";
  /**
   * **Every screen-sized derivative this store holds, by the digest of the
   * master it was made from.**
   *
   * One listing of one prefix, exactly as `sets` is: the keys carry the master
   * digest and the width (`./keys.ts` § `screenKey`), so there is no second
   * manifest and nothing to keep in step with the one that already exists.
   *
   * `{}` is an ordinary answer and the one a fresh clone gets.
   */
  screens(): Promise<ScreenAddresses>;
  /**
   * Adds the derivatives that are not there yet, and answers with the
   * addresses of **all** of the ones asked about.
   *
   * **Idempotent, which is the whole point of it**: the key is a function of
   * the master's digest, so a second run uploads nothing and a run against a
   * store that already holds the masters uploads only the derivatives. That is
   * the backfill, and it is a property of the key rather than of a flag.
   */
  putScreens(items: readonly ScreenUpload[]): Promise<ScreenAddresses>;
}

/** One derivative to store, already made. `of` is the master's digest. */
export interface ScreenUpload {
  of: string;
  width: number;
  bytes: Uint8Array;
}

/**
 * **A store for one order's regenerated artwork, and nothing else.**
 *
 * A child who resembles the buyer's own, painted by hand into this book's
 * pages. Backed by `olb-orders`, which is **private**: nothing in it has a URL,
 * reads happen on the server behind `lib/admin/guard.ts`, and the type above is
 * what stops anybody putting one of these pictures somewhere a URL would exist.
 */
export interface PrivateArtworkStore extends ArtworkStore {
  readonly holds: "per-order";
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

/**
 * The store on this machine's filesystem.
 *
 * `<root>/<ref>/v0001/page-006.png` and a `manifest.json` beside the pages. The
 * manifest holds the `AssetRef`s — the digest and the measured pixel size —
 * because those are *derived facts about the bytes* and measuring them again on
 * every read would be the slow way to get the same answer, while trusting a
 * filename for them is the wrong answer. `read` is still digest-checked by the
 * caller against the manifest, so a file swapped under its name is caught.
 *
 * **`keyIsValid` is an argument because there are two kinds of key and both
 * become a path segment.** An order's artwork is keyed by its reference, which
 * arrives from a URL — so the default is `isReference` and nothing about that
 * has loosened. The captain's released artwork is keyed by the *set* it belongs
 * to (`lib/artwork/release.ts` § `RELEASE_SETS`), which is a constant in this
 * repository and never a request parameter. One store with the check passed in
 * beats a second store with the check copied, which is how the two would end up
 * disagreeing about what a path segment may contain.
 *
 * **It returns an untagged `ArtworkStore`, which is deliberate**: it is the
 * shared implementation and not a store anybody above this line may use.
 * `localOrderStore` and `localReleaseStore` are the two that tag it, each
 * setting the tag and the key check together because they are the same fact.
 * An untagged store satisfies neither typed interface, so passing this straight
 * to anything is a compile error rather than a store with no opinion about what
 * it holds.
 */
export function localArtworkStore(
  root: string,
  keyIsValid: (value: unknown) => boolean = isReference,
): ArtworkStore {
  const dirFor = (ref: string) => {
    if (!keyIsValid(ref)) {
      // Checked before it becomes a path segment. A reference arrives from a
      // URL, and `../../` is the oldest trick there is.
      throw new NotAnOrderReference(`${JSON.stringify(ref)} is not an artwork store key`);
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

    async sets() {
      try {
        const entries = await readdir(root, { withFileTypes: true });
        return entries.filter((e) => e.isDirectory() && keyIsValid(e.name)).map((e) => e.name);
      } catch {
        // No directory is the normal state of a machine nobody has imported
        // anything on, which is every fresh clone and all of CI.
        return [];
      }
    },

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
        const version = versionOfDir(entry);
        if (version === null) continue;
        const read = await readVersion(ref, version);
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
        if (!isArtworkPageId(page.pageId)) {
          throw new NotAnOrderReference(`${JSON.stringify(page.pageId)} is not a page id`);
        }
        await writeFile(path.join(dir, `${page.pageId}.png`), page.bytes);
        // No URL: a directory on this machine has no address, which is what
        // `ArtworkPage.url`'s absence means and why nothing here invents one.
        written.push(artworkPageFor(page.pageId, page.bytes, `${ref} ${page.pageId} v${version}`));
      }

      const record: ArtworkVersion = { version, at: now.toISOString(), pages: written };
      await writeFile(path.join(dir, "manifest.json"), manifestBytes(record));
      return record;
    },

    async read(ref: string, version: number, pageId: string) {
      if (!isArtworkPageId(pageId)) return null;
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

/**
 * The local store, tagged as the only kind of thing it may hold.
 *
 * The tag and the key check are the **same fact** stated twice — a store keyed
 * by order references holds per-order artwork — which is why they are set in
 * one place rather than passed in as two arguments that could disagree.
 */
export function localOrderStore(root: string): PrivateArtworkStore {
  return { holds: "per-order", ...localArtworkStore(root, isReference) };
}

/** The directory the local per-order store writes to under this environment. */
export function artworkRoot(env: Record<string, string | undefined>): string {
  const configured = value(env, ARTWORK_DIR_VAR);
  return configured ? path.resolve(configured) : path.join(process.cwd(), DEFAULT_ARTWORK_DIR);
}

/**
 * The store this environment describes.
 *
 * **`olb-orders` when it is configured, this machine's filesystem when it is
 * not**, and it always answers — which is the opposite of `storeFromEnv` for
 * orders, deliberately. An order *record* store that silently fell back to
 * something that does not survive a redeploy would take money for a book nobody
 * can print, so that one refuses. Artwork is a thing the captain uploads and
 * immediately downloads the finished pages from; a directory on their own
 * machine is the honest answer when there is no bucket, and `describe` says
 * which of the two it is out loud wherever it is offered — the admin page
 * prints that sentence.
 *
 * The return type is `PrivateArtworkStore`, so every caller of this function is
 * holding a store that **cannot be handed to anything expecting the public
 * one.** That is the whole of the wall; the rest is this file's docblock saying
 * why it is there.
 */
export function artworkStoreFromEnv(env: Record<string, string | undefined>): PrivateArtworkStore {
  const configured = ordersStoreIn(env);
  if (configured) return ordersBlobStore(configured.storeId, configured.oidcToken);
  const local = localOrderStore(artworkRoot(env));
  if (!ordersStoreNamedButUnreachable(env)) return local;
  // Named but unreachable is its own state and gets its own sentence, because
  // it is the one that looks configured from the dashboard and is not: the
  // store id is set and this process has no OIDC token to authenticate with.
  // `./blob.ts` § the OIDC token says why that may not quietly fall through to
  // the SDK's own credential search.
  return {
    ...local,
    describe:
      `${local.describe} — ${ORDERS_STORE_VAR} is set, but this process has no ` +
      `${OIDC_TOKEN_VAR}, so nothing can be written to the private Blob store`,
  };
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
  store: ArtworkStore,
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
