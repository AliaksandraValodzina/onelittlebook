"use client";

/**
 * **Step two: "Choose their look" — the baby, the question before it, and the
 * name.**
 *
 * The artefact puts the live character on the left so every change is visible
 * immediately, and that is exactly what this does: the picture is
 * `tilePage` of the real book drawn with the chosen look, by the one renderer,
 * so what updates as they choose is the book.
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
 * ## The axes the artefact drew, and why they are twelve tiles
 *
 * The artefact's screen has rows for skin tone, hair, hair colour and eyes,
 * with glasses and freckles behind *More details*. Its own closing note is the
 * argument against building them here: *"the look editor offers thousands of
 * combinations. Your interior has twelve babies… offering more than the
 * interior can honour is [the problem]."* Its recommended resolution is that
 * the axes resolve to the nearest of the twelve.
 *
 * Until that resolution is built — it needs generated artwork, which is out of
 * scope — the honest surface is the twelve themselves, each drawn from the book
 * it will print. The skin tone of each is the look's own
 * `baby.skin`, so the row the artefact labelled *Skin tone* is here as the
 * swatches under the tiles: one swatch per look, every one of them a baby the
 * interior can draw.
 */

import { looksFor, tileIndexOf } from "../../lib/book/derive";
import { nameLimit } from "../../lib/book/name";
import { next, stepFor } from "../../lib/shop/steps";
import BookPage from "../_book/BookPage";
import { lookTileSvg } from "../_book/tile";
import { useBook } from "../_book/BookProvider";
import Screen from "./Screen";

const step = stepFor("look")!;

export default function LookScreen({ closeTo }: { closeTo: string }) {
  const { book, order, typedName, nameVerdict, setName, setGender, setLook, done, flush } = useBook();
  const genders = book.genders ?? [];
  const grid = looksFor(book, order.genderId);
  const limit = nameLimit(book);
  const onward = next("look")!;
  const canGo = done.name && done.look;

  return (
    <Screen step={step} closeTo={closeTo}>
      <div className="live">
        <div className="av">
          {/* The real page, not an avatar. It is the book, drawn as they choose. */}
          <BookPage index={tileIndexOf(book)} label="The baby you have chosen" />
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
                      <span
                        className="block w-full"
                        dangerouslySetInnerHTML={{
                          __html: lookTileSvg(book, look.id, order.coverId),
                        }}
                      />
                      <span className="lbl">{look.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/*
                The artefact's "Skin tone" row, honoured by the only thing the
                interior can honour: one swatch per look, in that look's own
                `baby.skin`. A swatch that could be combined with any hair
                colour would offer a baby this book cannot draw.
              */}
              <p className="f">Skin tone</p>
              <div className="sw" data-testid="skin-row">
                {grid.map((look) => (
                  <button
                    key={look.id}
                    type="button"
                    onClick={() => setLook(look.id)}
                    aria-pressed={order.lookId === look.id}
                    aria-label={look.label}
                    data-testid={`skin-${look.id}`}
                    style={{ background: look.baby?.skin ?? "transparent" }}
                  />
                ))}
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
