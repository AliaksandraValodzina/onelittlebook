/**
 * **The twenty-five finished pages of one order, as a ZIP. This is the upload.**
 *
 * The captain uploads to Printify by hand and **Printify takes one raster per
 * print area**, so this — not the PDF — is the file that actually ships.
 * `lib/book/print.ts` § `renderBookPagesZip` carries the argument and the
 * naming; this is the HTTP glue, and it is glue in the same two senses
 * `app/api/admin/print/[ref]/route.ts` is:
 *
 * **It is made from the record and nothing else.** No request body, no
 * browser. The fill comes out of the store, the buyer's photograph comes out of
 * the store digest-checked, and the renderer is the one that drew the preview
 * the buyer approved. A reprint in a year is this URL.
 *
 * **It uses the order's own artwork when there is some.** On the photo path the
 * captain has replaced the child by hand and uploaded the regenerated pages
 * against this order (`app/api/admin/artwork/[ref]/route.ts`), and
 * `bookWithOrderArtwork` binds the current version of that artwork to the
 * published book. With no artwork uploaded the book is the published one
 * unchanged, which is every chosen-look order.
 *
 * **It is behind the guard before the reference is even parsed.** This file
 * carries a child's name, a dedication and a family's photograph at print
 * resolution; a protected page linking to an unprotected download is the usual
 * way a shop leaks its customers. `test/admin-guard.test.ts` reads this file
 * and asserts the guard call comes first.
 */

import { NextResponse } from "next/server";
import { toArrayBuffer } from "../../../../../lib/bytes";
import { allowedFor, refusalFor } from "../../../../../lib/admin/guard";
import { photoFor, storeFromEnv } from "../../../../../lib/orders/store";
import { isReference } from "../../../../../lib/orders/record";
import { artworkBytesFor, artworkStoreFromEnv } from "../../../../../lib/artwork/store";
import { bookWithOrderArtwork } from "../../../../../lib/book/order-art";
import { BookNotPrintable, renderBookPagesZip } from "../../../../../lib/book/print";
import { FIRST_BOOK } from "../../../../../templates/first-book";
import { bookAsDelivered } from "../../../../../lib/artwork/release";

// Native code and the filesystem: this cannot run on the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ ref: string }> }) {
  const access = allowedFor(request, process.env);
  if (!access.ok) {
    return NextResponse.json({ ok: false, detail: refusalFor(access) }, { status: 401 });
  }

  const { ref } = await ctx.params;
  if (!isReference(ref)) {
    return NextResponse.json({ ok: false, detail: "not an order reference" }, { status: 400 });
  }

  const storeState = storeFromEnv(process.env);
  if (storeState.kind !== "ready") {
    return NextResponse.json({ ok: false, detail: "no order store" }, { status: 503 });
  }

  const record = await storeState.store.get(ref);
  if (!record) return NextResponse.json({ ok: false, detail: "no such order" }, { status: 404 });

  // The buyer's photograph, digest-checked on the way out of the bucket.
  const supplied = await photoFor(storeState.store, record);

  // The order's own regenerated artwork, if the captain has uploaded any. The
  // bytes join the photograph in the same `supplied` map, which is the seam
  // `lib/render/raster.ts` already has for "bytes the caller holds" — so
  // nothing downstream knows this artwork came from an order rather than from a
  // release.
  const artworkStore = artworkStoreFromEnv(process.env);
  const artwork = await artworkStore.current(ref);
  if (artwork) {
    for (const [digest, bytes] of await artworkBytesFor(artworkStore, ref, artwork)) {
      supplied.set(digest, bytes);
    }
  }
  // The order's artwork goes **over** the release's: the look the buyer chose,
  // repainted for this order alone. `bookWithOrderArtwork` merges into whatever
  // the page already declared, which is what makes the order of these two lines
  // the only thing that has to be right.
  const book = bookWithOrderArtwork(await bookAsDelivered(FIRST_BOOK), record.fill, artwork);

  try {
    const result = await renderBookPagesZip(book, record.fill, { supplied, ref: record.ref });
    const version = artwork ? `-art-v${artwork.version}` : "";
    const filename = result.filename.replace(/\.zip$/, `${version}.zip`);
    return new NextResponse(new Blob([toArrayBuffer(result.zip)]), {
      headers: {
        "content-type": "application/zip",
        "content-length": String(result.zip.length),
        "content-disposition": `attachment; filename="${filename}"`,
        // The filename carries the book's revision, the order's fingerprint and
        // the artwork version, so a cache keyed on the URL alone would be the
        // one place a re-uploaded character could still serve the old pages.
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof BookNotPrintable) {
      return NextResponse.json(
        { ok: false, detail: "not printable", problems: error.problems },
        { status: 422 },
      );
    }
    throw error;
  }
}
