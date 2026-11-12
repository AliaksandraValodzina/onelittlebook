"use client";

/**
 * **Step two: "Choose their look" — the baby, the question before it, and the
 * name.**
 *
 * The artefact puts the live character on the left so every change is visible
 * immediately, and that is exactly what this does: the picture is the chosen
 * look's own artwork where this machine has it — a page of the real book, drawn
 * by the one renderer — and the look's portrait or the drawn placeholder where
 * it does not. `app/_book/tile.ts` § `lookPanel` is that preference order and
 * why; the three states are all real states, because the artwork is not in the
 * repository and a fresh clone has none of it.
 *
 * **The question comes before the grid.** The captain reversed the brief on
 * 6 November after reviewing two sellers that both ask it first; the looks then
 * shown are only that answer's. Nothing here counts them — how many per gender
 * is data and arrives as data.
 *
 * **The name is refused, not corrected.** What is typed stays typed; the
 * message says what the press cannot print and *Next* will not go. See
 * `lib/book/name.ts` for why a name is the one field that must behave this way,
 * and `app/_book/BookProvider.tsx` for why a controlled input that rewrote the
 * value on every keystroke would be the silent substitution the whole guard
 * exists to prevent.
 *
 * ## The axes the artefact drew, and why this is a grid of tiles instead
 *
 * The artefact's screen has rows for skin tone, hair, hair colour and eyes,
 * with glasses and freckles behind *More details*. Its own closing note is the
 * argument against building them here, quoted as it was written — the count has
 * moved since and the argument has not: *"the look editor offers thousands of
 * combinations. Your interior has twelve babies… offering more than the
 * interior can honour is [the problem]."* Its recommended resolution is that
 * the axes resolve to the nearest look the interior actually has.
 *
 * Until that resolution is built — it needs generated artwork, which is out of
 * scope — the honest surface is the looks themselves: the captain's portrait
 * of each where there is one, and otherwise the tile drawn from the book it
 * will print. `app/_book/tile.ts` carries that choice and its reasoning.
 *
 * **There is no separate skin-tone control, and there must not be one.** A row
 * of swatches beside the grid read as an axis of its own — as though the blonde
 * baby could be made deep brown — and a look is a folder of finished artwork,
 * not a skin crossed with a hair. The row existed as one swatch per look in
 * the look's own `baby.skin`, which could not compose a baby the interior
 * cannot draw but could still be read as offering to; a portrait with a plain
 * label is simply the better control for the only question being asked. Nothing ever stored a skin: the look is the whole answer, and
 * `BookFill` has nowhere to put a second one.
 */

import { looksFor } from "../../lib/book/derive";
import { nameLimit } from "../../lib/book/name";
import { next, stepFor } from "../../lib/shop/steps";
import BookPage from "../_book/BookPage";
import { lookPanel, lookTile, type LookPanel } from "../_book/tile";
import type { AssetAddresses } from "../../lib/assets/address";
import type { BookTemplate } from "../../lib/book/types";
import { useBook } from "../_book/BookProvider";
import Screen from "./Screen";

const step = stepFor("look")!;

/**
 * The tile, in whichever of its two shapes this look has.
 *
 * `app/_book/tile.ts` decides which — a delivered portrait of that baby, or
 * `tilePage` of the book drawn with them — and this is the eight lines of
 * markup that difference needs. A plain `<img>` and not `next/image`: the
 * bytes are content-addressed and immutable, served by
 * `app/api/assets/[key]/route.ts` with a year of cache, so there is nothing for
 * an optimiser to add and a loader in front of it would be one more thing
 * between the buyer and the baby they are choosing.
 */
function LookTileImage({
  book,
  lookId,
  coverId,
  assets,
}: {
  book: BookTemplate;
  lookId: string;
  coverId: string;
  assets: AssetAddresses;
}) {
  const tile = lookTile(book, lookId, coverId, assets);
  if (tile.kind === "portrait") {
    return (
      <img
        className="block aspect-square w-full object-cover"
        src={tile.src}
        width={tile.width || undefined}
        height={tile.height || undefined}
        alt=""
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <span className="block w-full" dangerouslySetInnerHTML={{ __html: tile.svg }} />;
}

/**
 * The large picture of the baby being chosen.
 *
 * Three states and two kinds of markup, decided by `lookPanel` and not here:
 * a page of the real book — delivered artwork or the drawn placeholder, the
 * same component either way, because `BookPage` draws whatever that page of
 * the bound book has — or this look's portrait, large. The `<img>` is the
 * grid tile's, for the reason given there: content-addressed immutable bytes
 * have nothing for an optimiser to add.
 */
function LookPanelPicture({ panel }: { panel: LookPanel }) {
  if (panel.kind === "portrait") {
    return (
      <img
        className="block aspect-square w-full object-cover"
        src={panel.src}
        width={panel.width || undefined}
        height={panel.height || undefined}
        alt=""
        decoding="async"
      />
    );
  }
  return <BookPage index={panel.index} label="The baby you have chosen" />;
}

export default function LookScreen({ closeTo }: { closeTo: string }) {
  const { book, assets, order, typedName, nameVerdict, setName, setGender, setLook, done, flush } =
    useBook();
  const genders = book.genders ?? [];
  const panel = lookPanel(book, order.lookId, assets);
  const grid = looksFor(book, order.genderId);
  const limit = nameLimit(book);
  const onward = next("look")!;
  const canGo = done.name && done.look;

  return (
    <Screen step={step} closeTo={closeTo}>
      <div className="live">
        <div className="av" data-testid={`panel-${panel.kind}`}>
          {/* The real page, not an avatar. It is the book, drawn as they choose. */}
          <LookPanelPicture panel={panel} />
          <span className="tag">updates as you choose</span>
        </div>

        <div>
          {genders.length > 0 ? (
            <fieldset>
              <legend className="f">Is the book for a girl or a boy?</legend>
              <div className="seg">
                {genders.map((gender) => (
                  <button
                    key={gender.id}
                    type="button"
                    onClick={() => setGender(gender.id)}
                    aria-pressed={order.genderId === gender.id}
                    data-testid={`gender-${gender.id}`}
                  >
                    {gender.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {genders.length === 0 || order.genderId ? (
            <div data-testid="look-grid">
              <p className="f">Which baby?</p>
              <div className="carou">
                <div className="row">
                  {grid.map((look) => (
                    <button
                      key={look.id}
                      type="button"
                      onClick={() => setLook(look.id)}
                      aria-pressed={order.lookId === look.id}
                      data-testid={`look-${look.id}`}
                      title={look.label}
                    >
                      <LookTileImage
                        book={book}
                        lookId={look.id}
                        coverId={order.coverId}
                        assets={assets}
                      />
                      <span className="lbl">{look.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <label className="f" htmlFor="their-name">
            Their name
          </label>
          <input
            id="their-name"
            type="text"
            className={`fld ${typedName.length > 0 && nameVerdict.ok ? "on" : ""}`}
            value={typedName}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            data-testid="name"
            aria-invalid={typedName.length > 0 && !nameVerdict.ok}
            aria-describedby="name-note"
            placeholder="Rosalind"
          />
          <p id="name-note" role="status" className="count">
            {typedName.length === 0 ? (
              <span>It goes on the cover and through the story — up to {limit} letters.</span>
            ) : nameVerdict.ok ? (
              <span>
                {typedName.length} of {limit} letters.
              </span>
            ) : (
              <span data-testid="name-refusal" className="warn">
                {nameVerdict.message}
              </span>
            )}
          </p>
        </div>
      </div>

      {canGo ? (
        <a className="btn wide mt-[22px]" href={onward.path} onClick={flush} data-testid="next">
          Next
        </a>
      ) : (
        <span className="btn wide off mt-[22px]" aria-disabled="true" data-testid="next">
          Name them, and pick a baby
        </span>
      )}
      <p className="foot">Every page, no watermark, no account. Nothing is paid for yet.</p>
    </Screen>
  );
}
