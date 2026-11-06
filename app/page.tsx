/**
 * **The landing page the captain approved — and the shelf that grows.**
 *
 * `/Users/sasha/firstmate/.lavish/landing.html` is the artefact this is built
 * from, and it is built from it rather than interpreted: the sections, their
 * order, their words and their colours are the artefact's. The CSS is
 * `app/shop.css`, which carries the same note.
 *
 * Six bands, and the order is the argument:
 *
 * 1. **The object** — a render of the cover, captioned as a render, because
 *    nothing has been printed yet.
 * 2. **One line** saying what it is, on forest green, with the promise that
 *    every page can be read before anything is paid.
 * 3. **Three reassurances**, which is where a parent decides to keep reading.
 * 4. **The shelf** — one book today and a tile saying the next is being made.
 * 5. **How it works**, in four steps, then the register band in rose.
 * 6. **The questions**, including the one about how the artwork is made, which
 *    is answered plainly on purpose.
 *
 * ## What used to be here
 *
 * The form. `/` was the cover, one line and *Step 1 of 1* straight away, which
 * was right when there was one title and no shop around it. The shelf now owns
 * the front door, the book page owns the pitch, and the form is the first screen
 * of `/make` — see `lib/shop/steps.ts`, which is the sequence as data.
 *
 * **It draws nothing itself.** Every cover on this page comes from
 * `renderPageSvg` by way of `app/_shop/Cover.tsx` — the same call the print path
 * makes — so a shelf tile cannot advertise a book the renderer does not draw.
 */

import type { Metadata } from "next";
import { assetUrl } from "../lib/assets/resolve";
import { BRAND } from "../lib/brand";
import { WHEN_THEY_WERE_SMALL, pathOf } from "../lib/shop/shelf";
import {
  HERO,
  HOW,
  HOW_HEADING,
  LANDING_QUESTIONS,
  MADE,
  RENDER_CAPTION,
  SHELF_ASIDE,
  SHELF_HEADING,
  TRUST,
} from "../lib/shop/copy";
import { Ribbon, ShopFooter, ShopNav } from "./_shop/Chrome";
import Cover from "./_shop/Cover";
import Icon from "./_shop/Icon";
import Questions from "./_shop/Questions";
import Shelf, { SAMPLE_NAME } from "./_shop/Shelf";

/**
 * Rendered per request, as it was before.
 *
 * `assetUrl` reads `R2_PUBLIC_BASE_URL` to decide where a photograph lives, and
 * a page prerendered at build time would bake in whatever that was then — which
 * is "there is no bucket" for every build that happens before one exists.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${BRAND.name} — a printed book with their name in it`,
  description: HERO.sub,
};

export default function Home() {
  return (
    <>
      <Ribbon />
      <ShopNav />

      {/* ---- 1 and 2: the object, and one line about it ------------------ */}
      <header className="hero">
        <div className="pic">
          <Cover book={WHEN_THEY_WERE_SMALL.book} name={SAMPLE_NAME} href={assetUrl} />
          <p className="cap">{RENDER_CAPTION}</p>
        </div>
        <div className="say">
          <h1 className="dsp">{HERO.heading}</h1>
          <p className="sub">{HERO.sub}</p>
          <div className="acts">
            <a className="btn" href="#shelf">
              {HERO.primary}
            </a>
            <a className="btn ghost" href="#how">
              {HERO.secondary}
            </a>
          </div>
          <p className="fine">{HERO.fine}</p>
        </div>
      </header>

      {/* ---- 3: the three reassurances ----------------------------------- */}
      <div className="trust">
        <div className="wrap in">
          {TRUST.map((item) => (
            <div className="i" key={item.title}>
              <Icon name={item.icon} />
              <div>
                <b>{item.title}</b>
                <span>{item.line}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- 4: the shelf ------------------------------------------------ */}
      <section className="shop" id="shelf">
        <div className="wrap">
          <div className="hd">
            <h2 className="dsp">{SHELF_HEADING}</h2>
            {/*
              A statement rather than a link, because there is nothing behind
              it yet. The repository's own lesson about a footer that linked to
              pages nothing served applies to a heading too.
            */}
            <span className="text-[0.95rem] text-[var(--mut)]">{SHELF_ASIDE}</span>
          </div>
          <Shelf href={assetUrl} />
        </div>
      </section>

      {/* ---- 5: how it works, then the register band --------------------- */}
      <section className="shop tint" id="how">
        <div className="wrap">
          <div className="hd">
            <h2 className="dsp">{HOW_HEADING}</h2>
          </div>
          <div className="steps">
            {HOW.map((step) => (
              <div className="step" key={step.heading}>
                <div className="ic">
                  <Icon name={step.icon} size={25} stroke="#F3EBDB" />
                </div>
                <h4>{step.heading}</h4>
                <p>{step.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="made">
        <div className="pic">{MADE.picture}</div>
        <div className="txt">
          <h2 className="dsp">{MADE.heading}</h2>
          <p>{MADE.body}</p>
          {/*
            The artefact's button goes to `#`. It goes to the questions, which
            is where "how it is made" is actually answered — including the
            sentence about the artwork being generated.
          */}
          <a className="btn" href="#questions">
            {MADE.action}
          </a>
        </div>
      </section>

      {/* ---- 6: the questions ------------------------------------------- */}
      <section className="shop">
        <div className="wrap" style={{ maxWidth: "860px" }}>
          <Questions questions={LANDING_QUESTIONS} />
          <p className="mt-6 text-[0.86rem] text-[var(--mut)]">
            Still deciding?{" "}
            <a className="underline" href={pathOf(WHEN_THEY_WERE_SMALL)}>
              Read everything about {WHEN_THEY_WERE_SMALL.book.name}
            </a>
            .
          </p>
        </div>
      </section>

      <ShopFooter />
    </>
  );
}
