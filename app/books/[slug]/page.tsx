/**
 * **The book page the captain approved.**
 *
 * `/Users/sasha/firstmate/.lavish/book-page.html` is the artefact, built from
 * rather than interpreted: the gallery and the facts on the left, the pitch and
 * the one action on the right, then the reassurance strip, the three screens of
 * the flow, the empty review slot, the green promise band and the questions.
 *
 * **One route for every title.** The slug comes out of the URL and is looked up
 * in `lib/shop/shelf.ts`; an unknown slug is a 404. That is what makes the
 * second title data: it needs an entry on the shelf and no page of its own.
 *
 * **Every picture is the real book.** The cover and the five page thumbnails
 * come from `renderPageSvg` — the same call the print path makes — so this page
 * cannot advertise a book the renderer does not draw.
 *
 * Two departures from the artefact, both recorded where they happen: the
 * gallery rail is a strip of real pages rather than a clickable gallery, and
 * the five-star row above the empty review slot is gone. `lib/shop/copy.ts`
 * carries the reasoning for the second.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { assetUrl } from "../../../lib/assets/resolve";
import { bookAsDelivered } from "../../../lib/artwork/release";
import { showcaseLook } from "../../../lib/book/release-art";
import { pageTitle } from "../../../lib/brand";
import { pageFillFor, pageSequence, pageTemplateFor } from "../../../lib/book/derive";
import { BOOK_UNCONFIRMED } from "../../../lib/book/product";
import { PLACEHOLDER } from "../../../lib/product";
import { renderPageSvg } from "../../../lib/render/svg";
import { titleFor } from "../../../lib/shop/shelf";
import type { BookTemplate } from "../../../lib/book/types";
import {
  HELP,
  PAGE_BOTTOM_QUESTIONS,
  PAGE_CTA,
  RENDER_CAPTION,
  REVIEW_SLOT,
  THREE_MINUTES,
  pageFactsFor,
  pageQuestionsFor,
  priceLineFor,
  specFor,
  stripFor,
} from "../../../lib/shop/copy";
import { STEPS } from "../../../lib/shop/steps";
import { Ribbon, ShopFooter, ShopNav } from "../../_shop/Chrome";
import { currentMarket } from "../../_shop/market";
import Cover from "../../_shop/Cover";
import Icon from "../../_shop/Icon";
import Questions from "../../_shop/Questions";
import { SAMPLE_NAME } from "../../_shop/Shelf";

/**
 * Rendered per request, like `/`.
 *
 * `assetUrl` reads `R2_PUBLIC_BASE_URL`, so a page prerendered at build time
 * would bake in whichever answer was true then. There is deliberately no
 * `generateStaticParams`: the shelf is the list of addresses that exist and
 * `titleFor` is what answers it, in one place.
 */
export const dynamic = "force-dynamic";

/** A label as a `data-testid`: lower case, nothing but letters and hyphens. */
function slugOf(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const title = titleFor(slug);
  if (!title) return { title: pageTitle("Not found") };
  return { title: pageTitle(title.book.name), description: title.description };
}

/**
 * Five pages of the book, drawn small.
 *
 * The cover and the first four interior pages, which is what the rail has room
 * for. They are **a strip and not a gallery**: the artefact's rail implies a
 * click that swaps the big picture, and a thumbnail that looks pressable and is
 * not is worse than one that plainly is not. The real gallery arrives with the
 * photograph of the printed book that replaces the render.
 */
function Rail({ book }: { book: BookTemplate }) {
  const sequence = pageSequence(book);
  const indices = [0, 1, 2, 3, 4].filter((i) => i < sequence.length);
  // The baby whose artwork this machine actually has, where there is one —
  // `showcaseLook` — so the strip is the finished book rather than the
  // placeholder sitting in front of it. With nothing imported it is the first
  // look, exactly as before.
  const chose = { lookId: showcaseLook(book).id, coverId: book.covers[0].id };

  return (
    <ul className="rail" aria-label={`Pages of ${book.name}`}>
      {indices.map((index) => (
        <li
          key={index}
          className={`rail-page ${index === 0 ? "on" : ""}`}
          data-testid={`rail-${index}`}
          dangerouslySetInnerHTML={{
            __html: renderPageSvg(
              pageTemplateFor(book, index, chose),
              pageFillFor(book, index, {
                schema: 1,
                bookId: book.id,
                bookRev: book.rev,
                lookId: chose.lookId,
                coverId: chose.coverId,
                name: SAMPLE_NAME,
                dedication: "",
              }),
              { href: assetUrl },
            ),
          }}
        />
      ))}
    </ul>
  );
}

export default async function BookPageRoute(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const title = titleFor(slug);
  if (!title) notFound();
  // The shelf's book with this machine's artwork bound over it, so the page
  // cannot advertise a book the renderer does not draw — which is this route's
  // own rule, now that there is artwork for it to be wrong about.
  const book = await bookAsDelivered(title.book);
  const start = STEPS[0];
  // Four facts, a price line, a spec table and a strip, all of which say
  // something that depends on where the reader is buying.
  const market = await currentMarket();
  const price = priceLineFor(market);

  return (
    <>
      <Ribbon market={market} />
      <ShopNav market={market} />

      <div className="wrap">
        <p className="crumb">
          <a href="/#shelf">Our books</a> · {book.name}
        </p>
      </div>

      <div className="wrap pdp">
        <div className="gal">
          <div className="main">
            <Cover book={book} name={SAMPLE_NAME} href={assetUrl} />
            <p className="cap">{RENDER_CAPTION}</p>
          </div>
          <Rail book={book} />
        </div>

        <div>
          <p className="eyebrow">{title.eyebrow}</p>
          <h1 className="dsp">{title.heading}</h1>
          <p className="desc">{title.description}</p>

          <ul className="facts">
            {pageFactsFor(market).map((fact) => (
              <li key={fact.line}>
                <Icon name={fact.icon} size={19} /> {fact.line}
              </li>
            ))}
          </ul>

          {/*
            One real price and the upgrade beside it rather than above it. There
            is no struck-out "was", no percentage and no deadline — and nothing
            in `lib/book/editions.ts` that could express one.
          */}
          <p className="price" data-testid="price">
            {price.main} <small>{price.aside}</small>
          </p>
          <a className="btn wide" href={start.path} data-testid="start">
            {PAGE_CTA.action}
          </a>
          <p className="under">{PAGE_CTA.under}</p>

          {pageQuestionsFor(market).map((question, index) => (
            <details className="q" key={question.q} open={index === 0}>
              <summary>{question.q}</summary>
              <p>{question.a}</p>
            </details>
          ))}

          <details className="q">
            <summary>Size &amp; quality</summary>
            <dl>
              {specFor(market).map((row) => (
                <div key={row.term} className="contents">
                  <dt>{row.term}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              {/*
                **And what nobody here knows yet.** `lib/book/product.ts` is a
                union whose only `value` field is on the `confirmed: true` arm,
                so a figure nobody supplied cannot be written — these rows have
                no value to print and say so instead. A plausible number tidied
                up later is a fabricated commercial claim, and a customer cannot
                tell a guess from a quote.
              */}
              {BOOK_UNCONFIRMED.map((fact) => (
                <div key={fact.label} className="contents">
                  <dt>{fact.label}</dt>
                  <dd data-testid={`unconfirmed-${slugOf(fact.label)}`}>
                    <strong>{PLACEHOLDER}</strong> — {fact.needs}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </div>

      <div className="strip">
        <div className="wrap in">
          {stripFor(market).map((item) => (
            <div className="c" key={item.line}>
              <span aria-hidden="true">{item.icon}</span>
              <b>{item.line}</b>
            </div>
          ))}
        </div>
      </div>

      {/* ---- the three screens, drawn as the screens they are ------------ */}
      <section className="shop">
        <div className="wrap">
          <div className="hd mid">
            <p className="eyebrow">{THREE_MINUTES.eyebrow}</p>
            <h2 className="dsp">{THREE_MINUTES.heading}</h2>
          </div>
          <div className="flow">
            <div>
              <div className="shot">
                <div className="top" />
                <div className="body">
                  <p className="mini">{STEPS[1].title}</p>
                  <p className="mini-h">Who is the book for?</p>
                  <div className="fld">Their first name</div>
                  <div className="seg mt-[9px]">
                    {(book.genders ?? []).map((gender, index) => (
                      <span key={gender.id} className={index === 0 ? "on" : ""}>
                        {gender.label}
                      </span>
                    ))}
                  </div>
                  <p className="mini mt-[9px]">{book.looks.length} babies to choose from</p>
                </div>
              </div>
              <p className="shotcap">
                <span className="num">1</span>
                <b>Name them, pick the baby</b>One screen, and it says so.
              </p>
            </div>

            <div>
              <div className="shot">
                <div className="top" />
                <div className="body">
                  <p className="mini">Every page</p>
                  <p className="mini-h">The whole book, right away</p>
                  <div className="spread">
                    <div />
                    <div />
                  </div>
                  <div className="spread mt-[6px]">
                    <div />
                    <div />
                  </div>
                  <p className="mini mt-[9px]">One page · Two pages</p>
                </div>
              </div>
              <p className="shotcap">
                <span className="num">2</span>
                <b>Read all of it</b>No watermark, no account, no wall.
              </p>
            </div>

            <div>
              <div className="shot">
                <div className="top" />
                <div className="body">
                  <p className="mini">On the opening spread</p>
                  <p className="mini-h">Your photograph and your words</p>
                  <div className="grid h-[56px] place-items-center border border-dashed border-[var(--line)] text-[0.74rem] text-[#A79C8B]">
                    Upload a photo
                  </div>
                  <div className="fld mt-[7px] min-h-[38px]">Dear {SAMPLE_NAME},</div>
                  <p className="mini mt-[7px]">The lines left are counted as you type</p>
                </div>
              </div>
              <p className="shotcap">
                <span className="num">3</span>
                <b>Add your bit, then order</b>Checked once more before it prints.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- the review slot, deliberately empty ------------------------- */}
      <div className="band butter" data-testid="review-slot">
        <p className="q dsp">{REVIEW_SLOT.quote}</p>
        <p className="who">{REVIEW_SLOT.who}</p>
      </div>

      <section className="help">
        <div className="pic">{HELP.picture}</div>
        <div className="txt">
          <p className="eyebrow">{HELP.eyebrow}</p>
          <h2 className="dsp">{HELP.heading}</h2>
          <ul>
            {HELP.lines.map((line) => (
              <li key={line.strong}>
                <span aria-hidden="true">{line.icon}</span>
                <span>
                  <b>{line.strong}</b> {line.rest}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="shop tint">
        <div className="wrap" style={{ maxWidth: "860px" }}>
          <Questions questions={PAGE_BOTTOM_QUESTIONS} />
        </div>
      </section>

      <ShopFooter />
    </>
  );
}
