/**
 * **The shelf, and the reason it is a component that takes a list.**
 *
 * The captain's instruction is that adding a second title must be *data*. This
 * renders `SHELF` from `lib/shop/shelf.ts` and takes it as a prop so the proof
 * is a test rather than a promise: `test/shop-landing.test.tsx` renders this
 * with a two-title list and asserts both appear, with nothing in this file
 * changed. A grid of `repeat(auto-fill, minmax(258px, 1fr))` is what makes that
 * true at the CSS level too — a second card needs no new column rule.
 *
 * **The "being made" tile is an entry, not a branch.** It is in the same list,
 * so the shelf has no idea how many books the shop sells and cannot be the
 * thing that needs editing on the day there are two.
 *
 * Each tile's picture is the real cover, drawn by `./Cover.tsx` from the title's
 * own template, so a tile cannot advertise a book the renderer does not draw.
 */

import type { AssetRef } from "../../lib/template/types";
import { SHELF, fromPrice, pathOf, type ShelfEntry } from "../../lib/shop/shelf";
import Cover from "./Cover";

/** The name the hero and the shelf show on a cover with nobody's order behind it. */
export const SAMPLE_NAME = "Rosalind";

export default function Shelf({
  shelf = SHELF,
  href,
}: {
  shelf?: readonly ShelfEntry[];
  href?: (ref: AssetRef) => string;
}) {
  return (
    <div className="shelf" data-testid="shelf">
      {shelf.map((entry) =>
        entry.kind === "title" ? (
          <article className="card" key={entry.slug} data-testid={`shelf-${entry.slug}`}>
            <div className="block">
              {entry.badge ? <span className="badge">{entry.badge}</span> : null}
              <Cover book={entry.book} name={SAMPLE_NAME} href={href} />
            </div>
            <h3 className="dsp">{entry.book.name}</h3>
            <p>{entry.line}</p>
            <p className="pr">{fromPrice()}</p>
            <a className="btn" href={pathOf(entry)}>
              Personalise
            </a>
          </article>
        ) : (
          <article className="card soon" key={entry.heading} data-testid="shelf-being-made">
            <div className="block">
              <p className="ph">
                {entry.placeholder.split("\n").map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </div>
            <h3 className="dsp">{entry.heading}</h3>
            <p>{entry.line}</p>
            <p className="pr">&nbsp;</p>
            {/*
              A dead `<span>` and not a `<button disabled>`: there is nothing to
              press and nothing that would happen, and a disabled control invites
              a second try. It says "Not yet", which is the whole message.
            */}
            <span className="btn off" aria-disabled="true">
              {entry.action}
            </span>
          </article>
        ),
      )}
    </div>
  );
}
