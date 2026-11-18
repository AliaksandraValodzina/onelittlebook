/**
 * The face registry. One key, three answers.
 *
 * A `TextSlotLayer.font` names a key here, never a CSS family. The browser
 * needs a family it has an `@font-face` for; the rasteriser needs a file on
 * disk; the iPad app will one day need something else again. If a template
 * named the CSS family directly, the rasteriser would have to keep a private
 * table mapping it back to a file — and a template could name a face that one
 * renderer has and the other has not, which is a difference that shows up
 * **only in the printed book**.
 *
 * Keepnook's `TextElement.fontSource` exists because two namespaces were
 * allowed to share one string and became indistinguishable forever. This is
 * that lesson taken before the fact.
 *
 * **Files are vendored, not fetched.** `public/fonts/` holds the TTFs, which
 * the browser loads over `@font-face` from the same path the rasteriser reads
 * off disk — one file, two readers. A webfont CDN would mean the print file
 * depended on somebody else's uptime.
 *
 * **`family` is read back out of the bytes.** `lib/render/family.ts` says why:
 * the browser cannot tell a wrong family from a right one, and the rasteriser
 * answers a wrong one with a page that has no type on it.
 *
 * **A face is either set in, or a candidate**, and `candidate` is the field
 * that says which. `./coverage.ts`, `./raster.ts` and `fontFaceCss` below do
 * not read it at all: a candidate is vendored, licensed, declared and loaded on
 * exactly the same terms as a face in use, which is the whole point — the
 * picture the captain chooses from has to be the picture the press would make.
 * What `candidate` buys is that `test/fonts.test.ts` can still refuse a face
 * that is in the bundle for *no* reason, and that deleting the losers is one
 * edit with nothing to work out. `docs/cover-face.md` is the choice it is
 * waiting on.
 */

export interface Face {
  /**
   * The CSS family the browser is given, and the family name inside the TTF.
   *
   * Name 16 of the file's `name` table where it has one, name 1 otherwise —
   * `lib/render/family.ts` § `familyNameOf` is that rule and the test compares
   * the two.
   */
  family: string;
  /** Path under `public/`, which is also the URL the browser fetches. */
  file: string;
  /** The licence this face is used under. OFL-1.1 or Apache-2.0, nothing else. */
  licence: "OFL-1.1" | "Apache-2.0";
  /**
   * The licence text's own file under `public/fonts/`.
   *
   * Named here rather than in the notice or in a test, because the obligation
   * is per file: the OFL requires its text to travel with the font, and a
   * repository this public is where somebody will come looking. A face whose
   * licence file is missing fails `test/fonts.test.ts`.
   */
  licenceFile: string;
  /**
   * **Vendored for the captain to look at, set in by nothing.**
   *
   * Absent means *the product sets type in this face* — which is the state
   * every face should eventually be in, and the state both of the original two
   * are in. Present means it is in `public/fonts/` so that
   * `npm run cover-faces` can render the real cover in it, and for no other
   * reason. The string is the argument for it: why this face is in the lineup
   * at all, kept beside the file it argues for rather than in a document that
   * can go stale separately.
   */
  candidate?: string;
}

export const FACES: Record<string, Face> = {
  typewriter: {
    family: "Special Elite",
    file: "fonts/SpecialElite-Regular.ttf",
    licence: "Apache-2.0",
    licenceFile: "fonts/SpecialElite-LICENSE.txt",
  },
  hand: {
    family: "Indie Flower",
    file: "fonts/IndieFlower-Regular.ttf",
    licence: "OFL-1.1",
    licenceFile: "fonts/IndieFlower-OFL.txt",
  },

  // -------------------------------------------------------------------------
  // The cover title's candidates, open since 18 November
  // -------------------------------------------------------------------------
  //
  // The captain's reference is More Sugar, which this shop may not use: its
  // subscription licence prohibits webfont embedding, prohibits installing the
  // file on a server for an automated process, and is a single-user licence for
  // three devices. All three describe exactly what `public/fonts/` and
  // `lib/render/raster.ts` do. So every face below is OFL-1.1 or Apache-2.0,
  // each of which permits webfont, server and commercial use outright.
  //
  // They are ordered as the comparison sheet orders them: the rounded sans
  // first, from the most to the least handmade, then the two faces that are a
  // different idea rather than a variation on the same one.

  baloo: {
    family: "Baloo 2",
    file: "fonts/Baloo2-ExtraBold.ttf",
    licence: "OFL-1.1",
    licenceFile: "fonts/Baloo2-OFL.txt",
    candidate:
      "The mass match. ExtraBold, round terminals, a high x-height and bowls " +
      "that are a shade off geometric — the closest thing with an open licence " +
      "to More Sugar's weight, and the only candidate that also writes " +
      "Vietnamese.",
  },
  sniglet: {
    family: "Sniglet",
    file: "fonts/Sniglet-ExtraBold.ttf",
    licence: "OFL-1.1",
    licenceFile: "fonts/Sniglet-OFL.txt",
    candidate:
      "Rounded and slightly odd, which is the half of More Sugar that Baloo " +
      "has not got. ExtraBold is as heavy as it comes.",
  },
  grandstander: {
    family: "Grandstander",
    file: "fonts/Grandstander-Bold.ttf",
    licence: "OFL-1.1",
    licenceFile: "fonts/Grandstander-OFL.txt",
    candidate:
      "Rounded with the irregularity drawn in rather than implied — the " +
      '"slightly handmade" half of the brief is this face\'s own idea.',
  },
  fredoka: {
    family: "Fredoka",
    file: "fonts/Fredoka-SemiBold.ttf",
    licence: "OFL-1.1",
    licenceFile: "fonts/Fredoka-OFL.txt",
    candidate:
      "The clean rounded display default, at SemiBold. In the lineup as the " +
      "tidy end of the register: nothing to dislike and nothing handmade.",
  },
  bubblegum: {
    family: "Bubblegum Sans",
    file: "fonts/BubblegumSans-Regular.ttf",
    licence: "OFL-1.1",
    licenceFile: "fonts/BubblegumSans-OFL.txt",
    candidate:
      "Soft, bouncy and plainly for a child. One weight only, which is both " +
      "its character and its limit.",
  },
  chewy: {
    family: "Chewy",
    file: "fonts/Chewy-Regular.ttf",
    licence: "Apache-2.0",
    licenceFile: "fonts/Chewy-LICENSE.txt",
    candidate:
      "The chunkiest and the most overtly drawn-by-hand. In the lineup as the " +
      "far end of handmade, so the captain can see where it stops being warm " +
      "and starts being a cartoon.",
  },
  comfortaa: {
    family: "Comfortaa",
    file: "fonts/Comfortaa-Bold.ttf",
    licence: "OFL-1.1",
    licenceFile: "fonts/Comfortaa-OFL.txt",
    candidate:
      "The geometric-cold pole, included to mark the boundary rather than to " +
      "win: rounded by construction, wide, and with no warmth in it. A " +
      "comparison with no wrong answer in it does not show the captain where " +
      "the register ends.",
  },
  breeserif: {
    family: "Bree Serif",
    file: "fonts/BreeSerif-Regular.ttf",
    licence: "OFL-1.1",
    licenceFile: "fonts/BreeSerif-OFL.txt",
    candidate:
      "A different idea: a rounded-terminal slab serif, so it is warm and " +
      "chunky and still reads as a book rather than as a toy. The keepsake " +
      "answer to the brief rather than the nursery one.",
  },
  gochi: {
    family: "Gochi Hand",
    file: "fonts/GochiHand-Regular.ttf",
    licence: "OFL-1.1",
    licenceFile: "fonts/GochiHand-OFL.txt",
    candidate:
      "The other different idea: keep the handwriting the cover already has " +
      "and give it weight. Gochi Hand is a marker rather than a biro, which is " +
      "the one change to today's cover that is not a change of register.",
  },
};

/** Which faces the product sets type in, and which are only vendored to look at. */
export function isCandidate(key: string): boolean {
  return FACES[key]?.candidate !== undefined;
}

/**
 * The family to set a slot in.
 *
 * An unknown key falls back to the first registered face rather than to the
 * platform default. A platform default is whatever the machine happens to have,
 * which means the browser and the rasteriser would disagree — the one thing
 * this module exists to prevent. A fallback that is *wrong* but *the same in
 * both pictures* is recoverable; one that differs between them is not.
 */
export function familyOf(key: string): string {
  return (FACES[key] ?? FACES[Object.keys(FACES)[0]]).family;
}

export function isKnownFace(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(FACES, key);
}

/** The `@font-face` block the screen needs, generated from the same table. */
export function fontFaceCss(): string {
  return Object.values(FACES)
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";src:url("/${f.file}") format("truetype");font-display:block;font-weight:400;font-style:normal;}`,
    )
    .join("");
}
