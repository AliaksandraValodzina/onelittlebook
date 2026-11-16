/**
 * **The cover wrap for one order: back, spine and front, as one image.**
 *
 * Printify's cover print area is not the square the website shows — it is one
 * wide piece carrying the back cover, the spine and the front, because a
 * softcover is printed flat and wrapped round the block. This is the download
 * that produces it, and `lib/book/cover-wrap.ts` carries the whole argument,
 * including why the shop composes the wrap from one square rather than the
 * captain generating three files per look.
 *
 * `?product=softcover` — the default — is the one whose template has been
 * measured. **`?product=hardcover` refuses with 409 and says what to fetch**,
 * because nobody has opened that template and a hardcover's spine is wider
 * than a softcover's by an amount only its own file states. A wrap built from
 * the wrong spine looks correct on screen and lands off the hinge on the
 * object, which is the one failure worth refusing a download over.
 *
 * It is glue in the same two senses the other admin downloads are: **made from
 * the record and nothing else** — the fill, the buyer's photograph and the
 * order's own regenerated artwork all come out of their stores — and **behind
 * the guard before the reference is even parsed**, because this file carries a
 * child's name at print resolution. `test/admin-guard.test.ts` reads it and
 * asserts the guard call comes first.
 */

import { NextResponse } from "next/server";
import { toArrayBuffer } from "../../../../../lib/bytes";
import { allowedFor, refusalFor } from "../../../../../lib/admin/guard";
import { photoFor, storeFromEnv } from "../../../../../lib/orders/store";
import { isReference } from "../../../../../lib/orders/record";
import { artworkBytesFor, artworkStoreFromEnv } from "../../../../../lib/artwork/store";
import { bookWithOrderArtwork } from "../../../../../lib/book/order-art";
import { BookNotPrintable, renderCoverWrapPng } from "../../../../../lib/book/print";
import {
  CoverWrapUnavailable,
  isCoverProductId,
  COVER_PRODUCT_IDS,
} from "../../../../../lib/book/cover-wrap";
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

  const asked = new URL(request.url).searchParams.get("product") ?? "softcover";
  if (!isCoverProductId(asked)) {
    return NextResponse.json(
      { ok: false, detail: `no such product; the products are ${COVER_PRODUCT_IDS.join(", ")}` },
      { status: 400 },
    );
  }

  const storeState = storeFromEnv(process.env);
  if (storeState.kind !== "ready") {
    return NextResponse.json({ ok: false, detail: "no order store" }, { status: 503 });
  }

  const record = await storeState.store.get(ref);
  if (!record) return NextResponse.json({ ok: false, detail: "no such order" }, { status: 404 });

  const supplied = await photoFor(storeState.store, record);

  // The order's own regenerated artwork, if the captain has uploaded any —
  // the same two lines, in the same order, as the finished-pages download.
  const artworkStore = artworkStoreFromEnv(process.env);
  const artwork = await artworkStore.current(ref);
  if (artwork) {
    for (const [digest, bytes] of await artworkBytesFor(artworkStore, ref, artwork)) {
      supplied.set(digest, bytes);
    }
  }
  const book = bookWithOrderArtwork(await bookAsDelivered(FIRST_BOOK), record.fill, artwork);

  try {
    const wrap = await renderCoverWrapPng(book, record.fill, { supplied, product: asked });
    const version = artwork ? `-art-v${artwork.version}` : "";
    const filename = `${record.ref}-${wrap.filename.replace(/\.png$/, `${version}.png`)}`;
    return new NextResponse(new Blob([toArrayBuffer(wrap.png)]), {
      headers: {
        "content-type": "image/png",
        "content-length": String(wrap.png.length),
        "content-disposition": `attachment; filename="${filename}"`,
        // The filename carries the book's revision, the order's fingerprint and
        // the artwork version, so a cache keyed on the URL alone would be the
        // one place a re-uploaded character could still serve the old cover.
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof CoverWrapUnavailable) {
      // 409 rather than 404 or 500: the request is well formed and the product
      // is real; what is missing is a measurement, and the sentence says whose
      // and from which file.
      return NextResponse.json(
        { ok: false, detail: "no measured template for that product", needs: error.product.needs },
        { status: 409 },
      );
    }
    if (error instanceof BookNotPrintable) {
      return NextResponse.json(
        { ok: false, detail: "not printable", problems: error.problems },
        { status: 422 },
      );
    }
    throw error;
  }
}
