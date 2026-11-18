/**
 * The faces, and the deployment bug they are one half of.
 *
 * `lib/render/raster.ts` opens the TTFs by path with `loadSystemFonts: false`,
 * so a machine's own fonts can never leak into a print file — and a *missing*
 * file does not throw, it silently produces a page with no type on it. That
 * failure mode is why these assertions exist: it is invisible to a build, it is
 * invisible to a type check, and on Vercel it is the default, because `public/`
 * is not part of a function's filesystem unless `next.config.ts` says so.
 *
 * The second half of it is the **family string**, which fails the same way and
 * is why `lib/render/family.ts` exists: the browser cannot tell a wrong family
 * from a right one, because an `@font-face` rule binds whatever name is written
 * to whatever file is fetched. `resvg` matches by the name **inside** the
 * bytes, so a typo there is a page with no type on it — on the press only.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FACES, familyOf, fontFaceCss, isCandidate, isKnownFace } from "../lib/render/fonts";
import { familyNameOf } from "../lib/render/family";
import { fontFilesPresent } from "../lib/render/raster";
import { FIRST_BOOK } from "../templates/first-book";
import { pageSequence } from "../lib/book/derive";
import { MY_FOREVER } from "../templates/my-forever";

const bytesOf = async (file: string) =>
  new Uint8Array(await readFile(path.join(process.cwd(), "public", file)));

/** Every face key a template actually sets a slot in, across both titles. */
const NAMED_BY_A_TEMPLATE = new Set(
  [
    ...MY_FOREVER.layers,
    ...pageSequence(FIRST_BOOK).flatMap((page) => page.layers ?? []),
  ].flatMap((l) => (l.kind === "textSlot" ? [l.font] : [])),
);

describe("the registry", () => {
  it("has a file on disk for every face", async () => {
    expect(await fontFilesPresent()).toBe(true);
  });

  it("points at real TrueType, not at a stub", async () => {
    for (const face of Object.values(FACES)) {
      const bytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", face.file)));
      expect(bytes.length).toBeGreaterThan(20_000);
      // sfnt version 0x00010000 — a TrueType outline font.
      expect(Array.from(bytes.subarray(0, 4))).toEqual([0, 1, 0, 0]);
    }
  });

  it("ships a licence beside each one", async () => {
    // The repository is public and every face is licensed, not public domain.
    // Read off the registry rather than from a list typed here, because the
    // obligation belongs to the file and a list is a second place to forget.
    for (const [key, face] of Object.entries(FACES)) {
      const text = await readFile(path.join(process.cwd(), "public", face.licenceFile), "utf8");
      expect(text.length, `${key}: ${face.licenceFile}`).toBeGreaterThan(500);
      // The two licences this shop may use, and the words each one's text
      // actually contains. A face whose declared licence and licence text
      // disagree is the thing a public repository must not ship.
      if (face.licence === "OFL-1.1") {
        expect(text, key).toContain("SIL OPEN FONT LICENSE");
      } else {
        expect(text, key).toContain("Apache License");
      }
    }
  });

  it("calls every face by the family that is inside its own file", async () => {
    // The failure this closes renders perfectly in a browser and prints blank.
    for (const [key, face] of Object.entries(FACES)) {
      expect(familyNameOf(await bytesOf(face.file)), key).toBe(face.family);
    }
  });

  it("has a reason for every face in the bundle: a slot names it, or it is a candidate", async () => {
    // The rule that replaced "both templates use both faces", which a lineup
    // of cover candidates would fail while being exactly what it says on the
    // tin. The property worth keeping is that nothing is in `public/fonts/`
    // and in the rasteriser's font list by accident — so a face is either set
    // in by a template, or it carries the argument for being vendored.
    for (const [key, face] of Object.entries(FACES)) {
      const named = NAMED_BY_A_TEMPLATE.has(key);
      expect(named || face.candidate !== undefined, `${key} is dead weight`).toBe(true);
      // And never both: a face a template sets type in is not a candidate for
      // anything, and the day one is chosen its `candidate` note comes off.
      expect(named && face.candidate !== undefined, `${key} is both`).toBe(false);
    }
    // The paired control. Both halves have to be non-empty or the assertion
    // above is satisfied by a registry of one kind of thing.
    expect(NAMED_BY_A_TEMPLATE.size).toBeGreaterThan(0);
    expect(Object.keys(FACES).filter(isCandidate).length).toBeGreaterThan(0);
  });

  it("gives the browser the same families the rasteriser loads", () => {
    const css = fontFaceCss();
    for (const face of Object.values(FACES)) {
      expect(css).toContain(`font-family:"${face.family}"`);
      expect(css).toContain(`url("/${face.file}")`);
    }
  });
});

describe("a face the registry does not have", () => {
  it("falls back to a registered one, never to whatever the machine has", () => {
    // A platform default would differ between the browser and the rasteriser,
    // which is the one difference this indirection exists to prevent. Wrong and
    // identical is recoverable; right-ish and different is not.
    expect(isKnownFace("Comic Sans MS")).toBe(false);
    const fallback = familyOf("Comic Sans MS");
    expect(Object.values(FACES).map((f) => f.family)).toContain(fallback);
  });
});

describe("the page", () => {
  it("names only faces the registry has", () => {
    for (const layer of MY_FOREVER.layers) {
      if (layer.kind === "textSlot") expect(isKnownFace(layer.font)).toBe(true);
    }
  });

  it("sets no slot in a candidate, so the committed cover is the decided one", () => {
    // **The gate on the open question.** Nine faces are vendored for the
    // captain to choose the cover title from and the cover is still on the one
    // it has always been on. A slot that quietly moved to a candidate would be
    // a design change nobody approved, arriving as a font download.
    for (const [key] of NAMED_BY_A_TEMPLATE.entries()) {
      expect(isCandidate(key), `a slot is set in the candidate "${key}"`).toBe(false);
    }
  });
});
