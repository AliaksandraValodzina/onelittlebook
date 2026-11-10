/**
 * **The photo path's two doors: the clean artwork out, the regenerated artwork
 * back in.**
 *
 * `GET` hands the captain the artwork pages for this order **with no text drawn
 * on them**. `POST` takes the regenerated pages back and stores them as a new
 * version against this order alone.
 *
 * ## The rule this route exists to enforce
 *
 * **Text never makes a round trip through an image model.** The ordinary
 * download has the child's name rendered onto the page; put that into a model
 * to have the character swapped and the model redraws the lettering as a
 * garbled near-word. `lib/book/artwork.ts` opens with the whole argument and
 * the twenty-five pieces of the captain's own earlier survey that prove it.
 * That is why there are two downloads: this one goes **into** a tool, and
 * `app/api/admin/pages/[ref]` goes **to the press**.
 *
 * ## What the GET carries
 *
 * `?pages=right` — the default — is the twelve right-hand pages, which are the
 * only pages the captain's artwork puts the child on. `?pages=all` is the
 * twenty-four interiors; `?pages=everything` adds the cover. Twelve is not
 * written down anywhere: it is one page per spread, counted out of the book.
 *
 * ## What the POST accepts
 *
 * `multipart/form-data`, any number of PNG files, named the contract's way
 * (`page-006.png`) or the captain's way (`spread-03-right.png`) or exactly as
 * the GET handed them over. Every page is held to the same contract the twelve
 * pre-made looks are — 3600 × 3600 exactly, PNG, sRGB, 8-bit, no alpha — by the
 * same function, `lib/book/upload.ts` § `pageAgainstContract`. **Every problem
 * is reported in one pass**, because the captain is about to go back to an
 * image tool and one list is one trip.
 *
 * A re-upload **adds a version and keeps the previous one**:
 * `lib/artwork/store.ts` says why a character swap that looks right in a
 * thumbnail and wrong at 3600 px must be recoverable.
 *
 * ## Both halves are behind the guard, before anything is read
 *
 * The GET is a child's book; the POST writes to disk. A route that parsed a
 * stranger's multipart body before deciding whether to listen to them is a
 * route doing their work for them, so `allowedFor` is the first statement in
 * both. `test/admin-guard.test.ts` reads this file and asserts it.
 */

import { NextResponse } from "next/server";
import { toArrayBuffer } from "../../../../../lib/bytes";
import { allowedFor, refusalFor } from "../../../../../lib/admin/guard";
import { storeFromEnv } from "../../../../../lib/orders/store";
import { isReference } from "../../../../../lib/orders/record";
import { artworkStoreFromEnv } from "../../../../../lib/artwork/store";
import { checkOrderArtwork } from "../../../../../lib/book/order-upload";
import { isCleanSelection, renderCleanArtworkZip } from "../../../../../lib/book/artwork";
import { BookNotPrintable } from "../../../../../lib/book/print";
import { FIRST_BOOK } from "../../../../../templates/first-book";
import type { UploadedFile } from "../../../../../lib/book/upload";

// Native code, the filesystem and a rasteriser: this cannot run on the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The most an upload may be.
 *
 * Twenty-five pages of 3600 px PNG is of the order of ten megabytes, which is
 * well over the 4.5 MB a Vercel function will accept in a request body at all —
 * so the local store is where a full twenty-five page upload actually happens,
 * and this limit is here to refuse with a sentence rather than to be hit with a
 * platform error nobody can act on. `lib/artwork/store.ts` names the hosting
 * decision that is still open.
 */
const MAX_BODY_BYTES = 40 * 1024 * 1024;

function refuse(detail: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, detail, ...extra }, { status });
}

export async function GET(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const access = allowedFor(request, process.env);
  if (!access.ok) return refuse(refusalFor(access), 401);

  const { ref } = await ctx.params;
  if (!isReference(ref)) return refuse("not an order reference", 400);

  const storeState = storeFromEnv(process.env);
  if (storeState.kind !== "ready") return refuse("no order store", 503);

  const record = await storeState.store.get(ref);
  if (!record) return refuse("no such order", 404);

  const asked = new URL(request.url).searchParams.get("pages");
  const which = isCleanSelection(asked) ? asked : "right";

  try {
    const result = await renderCleanArtworkZip(FIRST_BOOK, record.fill, {
      which,
      ref: record.ref,
    });
    return new NextResponse(new Blob([toArrayBuffer(result.zip)]), {
      headers: {
        "content-type": "application/zip",
        "content-length": String(result.zip.length),
        "content-disposition": `attachment; filename="${result.filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof BookNotPrintable) {
      return refuse("the book's own artwork is not complete", 422, { problems: error.problems });
    }
    throw error;
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const access = allowedFor(request, process.env);
  if (!access.ok) return refuse(refusalFor(access), 401);

  const { ref } = await ctx.params;
  if (!isReference(ref)) return refuse("not an order reference", 400);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return refuse(`${declared} bytes, over the ${MAX_BODY_BYTES} byte limit`, 413);
  }

  const storeState = storeFromEnv(process.env);
  if (storeState.kind !== "ready") return refuse("no order store", 503);
  const record = await storeState.store.get(ref);
  if (!record) return refuse("no such order", 404);

  const form = await request.formData().catch(() => null);
  if (!form) return refuse("not a multipart form", 400);

  const files: UploadedFile[] = [];
  for (const entry of form.getAll("pages")) {
    if (typeof entry === "string") continue;
    files.push({ name: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) });
  }

  // Everything wrong with the upload, in one list, against the book's own
  // declared page size and page list.
  const check = checkOrderArtwork(FIRST_BOOK, files);
  if (check.problems.length) {
    return NextResponse.json(
      {
        ok: false,
        detail: `${check.problems.length} problem(s); nothing has been stored`,
        problems: check.problems,
      },
      { status: 422 },
    );
  }

  const artworkStore = artworkStoreFromEnv(process.env);
  const version = await artworkStore.put(
    record.ref,
    check.pages.map((p) => ({ pageId: p.pageId, bytes: p.file.bytes })),
    new Date(),
  );

  // Back to the order, as a GET, so a reload does not re-submit the upload and
  // write a second identical version.
  const back = new URL(`/admin/${record.ref}`, request.url);
  back.searchParams.set("artwork", `v${version.version}`);
  return NextResponse.redirect(back, 303);
}
