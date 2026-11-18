/**
 * **The declaration in `lib/render/coverage.ts` is checked against the font
 * files here, and this test is the only reason it can be trusted.**
 *
 * The editor refuses a character the printed book could not carry. That refusal
 * is only correct while the declared coverage matches the TTFs in
 * `public/fonts/`, and nothing else in the codebase would notice if somebody
 * swapped a font file for one with a different `cmap`. So this test re-measures
 * from the bytes every run and prints the replacement string when it disagrees.
 *
 * It then asserts the two facts the editor's refusal rests on — that the faces
 * really do carry Latin and really do not carry Cyrillic or emoji — because a
 * range comparison that happened to pass against two empty sets would prove
 * nothing at all.
 *
 * **The Cyrillic and emoji half is asked of the faces the product sets type
 * in, and not of the candidates**, because that is the scope of the claim it is
 * making. `covers` answers per face and `lib/book/name.ts` asks the faces the
 * name actually lands in, so a vendored face no slot names cannot widen a
 * refusal — and two of the candidates do carry scripts the product will never
 * set. What every face, candidate or not, still has to do is write the words
 * this shop's own pages use; that is asserted of all of them below.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codepointsOf, runsOf } from "../lib/render/cmap";
import { FACE_COVERAGE, covers, parseRuns, unsettable } from "../lib/render/coverage";
import { FACES, isCandidate } from "../lib/render/fonts";

/** The faces a template sets type in — the scope of the editor's refusal. */
const SET_IN = Object.keys(FACES).filter((key) => !isCandidate(key));

const asSpec = (runs: Array<[number, number]>) =>
  runs.map(([a, b]) => (a === b ? a.toString(16) : `${a.toString(16)}-${b.toString(16)}`)).join(" ");

async function measured(key: string): Promise<Set<number>> {
  const file = path.join(process.cwd(), "public", FACES[key].file);
  return codepointsOf(new Uint8Array(await readFile(file)));
}

describe("the declared coverage", () => {
  it("names every registered face", () => {
    expect(Object.keys(FACE_COVERAGE).sort()).toEqual(Object.keys(FACES).sort());
  });

  for (const key of Object.keys(FACES)) {
    it(`matches the glyphs actually in ${FACES[key].file}`, async () => {
      const spec = asSpec(runsOf(await measured(key)));
      // The failure message carries the fix: paste this into FACE_COVERAGE.
      expect(spec, `FACE_COVERAGE.${key} should be:\n${spec}\n`).toBe(
        asSpec(parseRuns(FACE_COVERAGE[key])),
      );
    });

    it(`is not trivially empty for ${key}`, async () => {
      const cps = await measured(key);
      // The comparison above would pass if the parser returned nothing and the
      // declaration were blank. It must not be possible for that to be green.
      // A floor and not a measurement: the narrowest face here is a Latin-1
      // display face of about 230 codepoints, and what each face actually
      // covers is asserted below rather than guessed at from a count.
      expect(cps.size).toBeGreaterThan(200);
      expect(parseRuns(FACE_COVERAGE[key]).length).toBeGreaterThan(10);
    });
  }
});

describe("what the faces on this page can and cannot write", () => {
  const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?'&-";

  for (const key of Object.keys(FACES)) {
    it(`${key} writes every character the page's own words use`, () => {
      expect(unsettable(key, LATIN)).toEqual([]);
      expect(unsettable(key, "my")).toEqual([]);
      expect(unsettable(key, "FOREVER")).toEqual([]);
    });

    it(`${key} cannot write an emoji, and reports it as one character`, () => {
      // An astral codepoint must come back as itself. Reporting two unpaired
      // surrogates to a customer is worse than reporting nothing. True of
      // every face here, candidates included — no display face has emoji.
      expect(unsettable(key, "😍")).toEqual(["😍"]);
      expect(unsettable(key, "❤")).toEqual(["❤"]);
    });
  }

  for (const key of SET_IN) {
    it(`${key} cannot write Cyrillic, and the editor is told so`, () => {
      // Measured, not assumed. Both faces this product sets type in are
      // Latin-only, which is why a Cyrillic word would look right on screen
      // and print as a gap.
      expect(unsettable(key, "моя")).toEqual(["м", "о", "я"]);
      expect(covers(key, "я".codePointAt(0)!)).toBe(false);
    });
  }

  it("has candidates whose coverage genuinely differs, which is the point of measuring", () => {
    // The paired control for the loop above: if every candidate happened to be
    // Latin-only, scoping the Cyrillic claim to `SET_IN` would be a
    // distinction with nothing behind it. Comfortaa carries Cyrillic and
    // Bubblegum Sans does not, and that is read out of the declaration rather
    // than asserted about a name.
    const cyrillic = "я".codePointAt(0)!;
    const candidates = Object.keys(FACES).filter(isCandidate);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.filter((k) => covers(k, cyrillic)).length).toBeGreaterThan(0);
    expect(candidates.filter((k) => !covers(k, cyrillic)).length).toBeGreaterThan(0);
  });

  it("asks the face the slot actually names", async () => {
    // The two faces are not the same set, so "which face" is a question with
    // consequences. Indie Flower carries Vietnamese that Special Elite has
    // never heard of; Special Elite carries a mu that Indie Flower does not.
    // A check that consulted the wrong face would be wrong in both directions,
    // and this is the pair that proves it consults the right one.
    const hand = await measured("hand");
    const typewriter = await measured("typewriter");
    const viet = "ư".codePointAt(0)!;
    const mu = "μ".codePointAt(0)!;

    expect(hand.has(viet)).toBe(true);
    expect(typewriter.has(viet)).toBe(false);
    expect(typewriter.has(mu)).toBe(true);
    expect(hand.has(mu)).toBe(false);

    expect(covers("hand", viet)).toBe(true);
    expect(covers("typewriter", viet)).toBe(false);
    expect(covers("typewriter", mu)).toBe(true);
    expect(covers("hand", mu)).toBe(false);
  });

  it("falls back to the same face the renderer would set", () => {
    // `familyOf` sends an unknown key to the first registered face. Coverage
    // has to follow it there, or a word would be checked against one face and
    // drawn in another.
    const first = Object.keys(FACES)[0];
    // Agreement on the codepoints the two faces disagree about is the only
    // comparison that can tell "followed the fallback" from "said yes to
    // everything".
    for (const ch of ["μ", "ư", "A", "я", "😍", "€"]) {
      const cp = ch.codePointAt(0)!;
      expect(covers("no-such-face", cp), `fallback disagreed about ${ch}`).toBe(
        covers(first, cp),
      );
    }
    expect(unsettable("no-such-face", "моя")).toEqual(unsettable(first, "моя"));
    // And it is not a blanket yes. The first registered face is one the
    // product sets type in, which is what makes the fallback safe: it lands on
    // a Latin-only face and not on a candidate that happens to carry more.
    expect(isCandidate(first)).toBe(false);
    expect(covers("no-such-face", "я".codePointAt(0)!)).toBe(false);
  });
});
