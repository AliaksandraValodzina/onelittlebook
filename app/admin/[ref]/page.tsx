/**
 * **One order, everything the captain needs to make the book, and the file.**
 *
 * The brief's three asks for this page, in the order they are used: see
 * everything that was chosen, download the files that make the book, mark it
 * dispatched with a tracking note. Nothing else — there is no editing, because
 * an order is what the customer approved and the way to change one is to talk
 * to them.
 *
 * **There are three downloads and the order of them is the whole point.**
 * Printify takes one raster per print area, so the prominent one is the
 * twenty-five finished pages as a ZIP; the PDF is secondary and is for reading.
 * The third is the artwork with **no text on it**, which is the file that goes
 * into an image tool for the photo path — and it has to be a separate download
 * because text must never make a round trip through an image model.
 * `lib/book/artwork.ts` carries that argument.
 *
 * **Behind `allowed()` before anything else**, like every other admin entry
 * point, and the file links below are behind it too: `app/api/admin/print/`
 * and `app/api/admin/photo/` each check for themselves rather than trusting
 * that the only links to them are on a protected page. A protected page that
 * links to an unprotected file is the usual way this goes wrong.
 *
 * **The photograph is shown through a route, not a public URL.** It lives
 * under a private prefix in the bucket — `lib/orders/store.ts` § Photographs
 * are private — so the only way to look at it is a signed read on the server,
 * which is what `app/api/admin/photo/[ref]` does.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { pageTitle } from "../../../lib/brand";
import { COOKIE, allowed } from "../../../lib/admin/guard";
import { storeFromEnv } from "../../../lib/orders/store";
import { artworkStoreFromEnv } from "../../../lib/artwork/store";
import { releaseArtworkFor } from "../../../lib/artwork/release";
import { cleanArtworkPages } from "../../../lib/book/artwork";
import { artworkPageIds } from "../../../lib/book/order-art";
import { pageCount } from "../../../lib/book/derive";
import { addressLines, chargedAs, isReference } from "../../../lib/orders/record";
import { editionOf, priceOf } from "../../../lib/book/editions";
import { marketOf } from "../../../lib/shop/market";
import { FIRST_BOOK } from "../../../templates/first-book";
import { lookOf } from "../../../lib/book/derive";
import Gate from "../_Gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: pageTitle("Order"),
  robots: { index: false, follow: false },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="py-1.5 pr-4 font-semibold">{label}</dt>
      <dd className="py-1.5 whitespace-pre-wrap">{children}</dd>
    </>
  );
}

export default async function AdminOrder(props: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ref } = await props.params;
  const access = allowed({ env: process.env, cookie: (await cookies()).get(COOKIE)?.value });
  if (!access.ok) return <Gate access={access} next={`/admin/${ref}`} />;

  if (!isReference(ref)) notFound();
  const storeState = storeFromEnv(process.env);
  if (storeState.kind !== "ready") notFound();
  const record = await storeState.store.get(ref);
  if (!record) notFound();

  // The per-order artwork for the photo path. A separate store from the order's
  // own, because the thing it holds is a family's child and
  // `lib/artwork/store.ts` names the hosting decision the captain still owes.
  const artworkStore = artworkStoreFromEnv(process.env);
  const artworkVersions = await artworkStore.versions(record.ref);
  const currentArtwork = artworkVersions[artworkVersions.length - 1] ?? null;
  const justUploaded = (await props.searchParams).artwork;
  const cleanCount = cleanArtworkPages(FIRST_BOOK, "right").length;
  const everyPage = pageCount(FIRST_BOOK);

  // What the shop would draw this order with, which is not a fact the
  // repository holds: see `lib/artwork/release.ts`.
  const releasedArt = await releaseArtworkFor(FIRST_BOOK);
  const releasedPages = Object.keys(releasedArt.pages[record.fill.lookId] ?? {});

  const edition = editionOf(record.editionId);
  const look = lookOf(FIRST_BOOK, record.fill.lookId);
  const cover = FIRST_BOOK.covers.find((c) => c.id === record.fill.coverId);
  const address = addressLines(record.address);

  return (
    <main className="mx-auto w-full max-w-[46rem] px-5 py-10">
      <p className="text-sm">
        <a className="underline opacity-70" href="/admin">
          ← All orders
        </a>
      </p>

      <h1 className="mt-5 font-mono text-2xl font-semibold">{record.ref}</h1>
      <p className="mt-1 text-sm opacity-70">
        {record.payment === "paid" ? "Paid" : "Not paid"}
        {record.paidAt ? ` on ${record.paidAt.slice(0, 16).replace("T", " ")}` : ""} ·{" "}
        {record.dispatch ? `dispatched ${record.dispatch.at.slice(0, 10)}` : "not dispatched"}
      </p>

      <h2 className="mt-9 text-lg font-semibold">What was chosen</h2>
      <dl className="mt-2 grid grid-cols-[11rem_1fr] border-t border-current/15 text-sm">
        <Row label="Name on the book">{record.fill.name}</Row>
        <Row label="Look">{`${look.label} (${look.id})`}</Row>
        <Row label="Cover">{cover ? `${cover.label} (${cover.id})` : record.fill.coverId}</Row>
        <Row label="Dedication">{record.fill.dedication}</Row>
        <Row label="From">{record.fill.from || "—"}</Row>
        <Row label="Edition">
          {edition.label} — {edition.blueprint}
        </Row>
        <Row label="Photograph">
          {record.fill.photo?.asset ? (
            <a className="underline" href={`/api/admin/photo/${record.ref}`} data-testid="photo-link">
              {record.fill.photo.asset.px[0]} × {record.fill.photo.asset.px[1]}{" "}
              {record.fill.photo.asset.mime}
              {record.fill.photo.crop ? " · cropped by the buyer" : " · uncropped"}
            </a>
          ) : (
            "none"
          )}
        </Row>
      </dl>

      <h2 className="mt-9 text-lg font-semibold">The money</h2>
      <dl className="mt-2 grid grid-cols-[11rem_1fr] border-t border-current/15 text-sm">
        {/*
          The market as well as the price, because the currency does not say
          which price list this order was taken against — USD is both the
          United States and everywhere else. `lib/orders/record.ts` § market.
        */}
        <Row label="Market">{marketOf(record.market).label}</Row>
        <Row label="Listed price">{priceOf(record.asked)}</Row>
        <Row label="Actually charged">{chargedAs(record.charged) ?? "nothing yet"}</Row>
        <Row label="Stripe session">{record.sessionId ?? "—"}</Row>
        <Row label="Stripe payment">{record.paymentIntentId ?? "—"}</Row>
        <Row label="Email">
          {record.email ?? "—"}
          {record.email ? (record.emailed ? " · confirmation sent" : " · CONFIRMATION NOT SENT") : ""}
        </Row>
      </dl>

      <h2 className="mt-9 text-lg font-semibold">Where it goes</h2>
      <p className="mt-2 text-sm whitespace-pre-wrap" data-testid="address">
        {address.length ? address.join("\n") : "Stripe has not sent an address for this order yet."}
      </p>

      {/*
        **The pages are the primary download and the PDF is not.** Printify
        takes one raster per print area, so the thing the captain actually
        uploads is twenty-five images — a PDF has to be taken apart again,
        twenty-five times, in order, by hand, before any of it can be used.
        `lib/book/print.ts` § renderBookPagesZip carries the argument.
      */}
      <h2 className="mt-9 text-lg font-semibold">The files for the printer</h2>
      <p className="mt-2 text-sm opacity-75">
        All {everyPage} finished pages — {everyPage - 1} interiors and the cover — as PNGs at{" "}
        {FIRST_BOOK.page.print.pixels.width} × {FIRST_BOOK.page.print.pixels.height} each, numbered
        in reading order and named with this order&apos;s reference. This is the file that goes to
        Printify: one image per print area, with the baby and the words on them. About half a
        minute to render, roughly ten megabytes.
        {currentArtwork
          ? ` Drawn with this order's own artwork, version ${currentArtwork.version}.`
          : ""}
      </p>
      {/*
        **Which pictures this machine is actually drawing from**, said out loud
        rather than left to be discovered in a finished book. The captain's
        released artwork is not in the repository — `docs/artwork.md` says why —
        so a deployment that has none of it prints the placeholder book, and the
        only way to know which one you are looking at is to be told.
      */}
      <p className="mt-2 text-sm opacity-75" data-testid="release-artwork">
        {releasedPages.length
          ? `The look "${look?.label ?? record.fill.lookId}" draws from ${releasedPages.length} ` +
            `delivered page(s) of released artwork, in ${releasedArt.describe}.`
          : `There is no released artwork for "${look?.label ?? record.fill.lookId}" on this ` +
            `machine, so these pages are the drawn placeholder. ` +
            `Import it with \`npm run artwork\` — see docs/artwork.md.`}
      </p>
      <p className="mt-3">
        <a
          className="inline-block rounded-lg bg-[#2b1d14] px-5 py-3 font-semibold text-[#efe9df]"
          href={`/api/admin/pages/${record.ref}`}
          data-testid="pages-link"
        >
          Download all {everyPage} pages (ZIP)
        </a>
      </p>
      <p className="mt-3 text-sm">
        <a className="underline opacity-80" href={`/api/admin/print/${record.ref}`} data-testid="print-link">
          Or the whole book as one PDF
        </a>{" "}
        <span className="opacity-60">— for reading it, not for uploading it.</span>
      </p>

      {/*
        TEXT NEVER MAKES A ROUND TRIP THROUGH AN IMAGE MODEL. The download
        above has the child's name rendered onto the page; a model asked to
        swap the character redraws the lettering as a garbled near-word, which
        is the failure the captain's own artwork survey found twenty-five times.
        So the file that goes *into* a tool is a different file, and it is this
        one. `lib/book/artwork.ts` is the whole argument.
      */}
      <h2 className="mt-9 text-lg font-semibold">Artwork for a character swap</h2>
      <p className="mt-2 text-sm opacity-75">
        The artwork pages for this order <b>with no text drawn on them</b> — no name, no
        dedication, no story, no photograph. These are the files to put into an image tool to
        replace the child. <b>Never use the download above for that</b>: it has the name rendered
        on it, and a model asked to redraw a page redraws the lettering too, which comes back as a
        garbled near-word in a handwritten face.
      </p>
      <p className="mt-3">
        <a
          className="inline-block rounded-lg border-2 border-current/25 px-5 py-3 font-semibold"
          href={`/api/admin/artwork/${record.ref}`}
          data-testid="clean-artwork-link"
        >
          Download the clean artwork ({cleanCount} right-hand pages, ZIP)
        </a>
      </p>
      <p className="mt-3 text-sm opacity-75">
        The right-hand page of each spread is the only page the child is on, so the other pages are
        not worth regenerating. If you need them:{" "}
        <a className="underline" href={`/api/admin/artwork/${record.ref}?pages=all`} data-testid="clean-all-link">
          all {cleanArtworkPages(FIRST_BOOK, "all").length} interior pages
        </a>{" "}
        or{" "}
        <a
          className="underline"
          href={`/api/admin/artwork/${record.ref}?pages=everything`}
          data-testid="clean-everything-link"
        >
          those and the cover
        </a>
        .
      </p>

      <h2 className="mt-9 text-lg font-semibold">The regenerated artwork for this order</h2>
      {justUploaded ? (
        <p className="mt-2 text-sm font-medium" data-testid="artwork-uploaded">
          Stored as {String(justUploaded)}. Download the pages above to see it drawn.
        </p>
      ) : null}
      <p className="mt-2 text-sm opacity-75">
        Upload the pages that came back from the image tool. They are checked against the same
        contract the looks are — {FIRST_BOOK.page.print.pixels.width} ×{" "}
        {FIRST_BOOK.page.print.pixels.height} exactly, PNG, sRGB, 8 bits per channel, no alpha
        channel — and every problem is reported at once. Name each file for the page it replaces:{" "}
        <code>page-006.png</code> or <code>spread-03-right.png</code>, or leave the names the
        download gave them.
      </p>
      <p className="mt-2 text-sm opacity-75">
        A re-upload adds a version and keeps the last one, so a bad swap found later can be rolled
        back. Nothing here is ever committed to the repository — it is one family&apos;s child and
        git history is permanent. Stored in {artworkStore.describe}.
      </p>
      <form
        method="post"
        action={`/api/admin/artwork/${record.ref}`}
        encType="multipart/form-data"
        className="mt-3"
      >
        <label className="block text-sm font-medium" htmlFor="pages">
          The regenerated pages
        </label>
        <input
          id="pages"
          name="pages"
          type="file"
          multiple
          accept="image/png"
          data-testid="artwork-files"
          className="mt-1 block w-full rounded-lg border-2 border-current/20 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          data-testid="artwork-upload"
          className="mt-3 rounded-xl border-2 border-current/25 px-5 py-3 font-semibold"
        >
          {currentArtwork ? "Replace this order's artwork" : "Upload this order's artwork"}
        </button>
      </form>
      {artworkVersions.length ? (
        <ul className="mt-3 text-sm" data-testid="artwork-versions">
          {[...artworkVersions].reverse().map((version) => (
            <li key={version.version} className="py-0.5">
              <b>v{version.version}</b> · {version.at.slice(0, 16).replace("T", " ")} ·{" "}
              {version.pages.length} page(s): {artworkPageIds(FIRST_BOOK, version).join(", ")}
              {version.version === currentArtwork?.version ? " · in use" : " · kept"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm opacity-70" data-testid="artwork-none">
          Nothing uploaded for this order. The pages above are drawn with the look the buyer chose.
        </p>
      )}

      <h2 className="mt-9 text-lg font-semibold">Dispatch</h2>
      {record.payment === "paid" ? (
        <form method="post" action="/api/admin/dispatch" className="mt-2">
          <input type="hidden" name="ref" value={record.ref} />
          <label className="block text-sm font-medium" htmlFor="tracking">
            Tracking number or note
          </label>
          <input
            id="tracking"
            name="tracking"
            defaultValue={record.dispatch?.tracking ?? ""}
            data-testid="tracking"
            className="mt-1 w-full rounded-lg border-2 border-current/20 bg-transparent px-3 py-2"
          />
          <button
            type="submit"
            data-testid="dispatch"
            className="mt-3 rounded-xl border-2 border-current/25 px-5 py-3 font-semibold"
          >
            {record.dispatch ? "Update the dispatch note" : "Mark dispatched"}
          </button>
        </form>
      ) : (
        <p className="mt-2 text-sm opacity-75">
          Not paid for, so it cannot be dispatched. Nothing to post.
        </p>
      )}
    </main>
  );
}
