/**
 * **The approved theme: five colours, two faces, and one token for the face
 * that has not been finally chosen.**
 *
 * The captain approved a palette and a pair of typefaces in review, and the
 * reference artefacts carry them as CSS custom properties. They are declared
 * here rather than typed into a stylesheet for the same reason `lib/brand.ts`
 * exists: a colour or a family typed in fifteen places is changed in fourteen.
 *
 * `themeCss()` emits the `:root` block and `app/layout.tsx` injects it, exactly
 * as it injects `fontFaceCss()` from `lib/render/fonts.ts`. So the stylesheet
 * in `app/shop.css` reads `var(--green)` and never `#1F4B3F`, and this file is
 * the only place either string appears.
 *
 * ## The one thing that is still open
 *
 * **The display face is one token.** The captain has not finally chosen between
 * Fraunces and Instrument Serif, so the choice is `DISPLAY` — a single
 * assignment — and nothing else in the product names a display family.
 * `test/theme.test.ts` asserts that: it reads every file under `app/` and
 * `lib/` and fails if a second one writes either family name. The switch is
 * therefore literally the edit of one line, which is what was asked for, and
 * `DISPLAY_CANDIDATES` keeps the rejected option next to the chosen one so the
 * line can be swapped without anybody having to remember what it swaps to.
 *
 * ## Why these are not Tailwind theme values
 *
 * Tailwind v4's `@theme` would be the idiomatic place and it would put the
 * palette in CSS, where a test cannot read it as data and where the brand
 * module's argument stops applying. The pages that follow are a design taken
 * verbatim from an approved artefact; the artefact's own CSS is its clearest
 * expression, and the values it reads are these.
 *
 * **Nothing here reaches a print file.** The two faces the renderer draws with
 * are vendored TTFs in `lib/render/fonts.ts` and are a separate list on
 * purpose — `resvg` runs with `loadSystemFonts: false` and a UI face it has
 * never heard of would print as nothing. These are screen faces for the shop
 * around the book, and the book itself is drawn by one renderer in two faces
 * that have been measured.
 */

/**
 * The palette, as the captain approved it.
 *
 * The keys are the custom-property names the artefacts use, so the stylesheet
 * taken from them needs no translation layer and a reviewer comparing the two
 * is comparing like with like.
 */
export const PALETTE = {
  /** Forest green. Headings accent, prices, panels, the footer. */
  green: "#1F4B3F",
  /** The green one step down, for a hover or a shadowed edge of it. */
  "green-d": "#163528",
  /** Near-black ink: buttons and body copy. */
  ink: "#1A1713",
  /** Cream: the ground of a tinted section. */
  cream: "#FAF3E6",
  /** The tinted block a book sits on. One step warmer than `cream`. */
  "cream-2": "#F4EAD8",
  /** The page itself. */
  paper: "#FFFFFF",
  /** The single warm accent, taken from the artwork. There is only one. */
  rose: "#B2453C",
  /** Muted ink, for a caption or a second line. */
  mut: "#6B6459",
  /** A hairline. */
  line: "#E6DDCC",
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** The UI face. Settled, and not the open question. */
export const UI = '"Instrument Sans",ui-sans-serif,system-ui,sans-serif';

/**
 * **The display face — the one token.**
 *
 * Change this line and every heading in the shop changes with it. The
 * candidates are below so the swap is a copy rather than a recollection.
 */
export const DISPLAY = '"Fraunces",Georgia,serif';

/**
 * The two faces under consideration, and the weights each wants.
 *
 * Fraunces is a variable face that is set at 600 for a heading; Instrument
 * Serif has one weight and wants 400 and slightly less negative tracking, which
 * is why the choice is not only a family string. `displayCss()` writes the
 * matching weight and tracking so that switching `DISPLAY` does not also
 * require remembering to change them.
 */
export const DISPLAY_CANDIDATES = {
  '"Fraunces",Georgia,serif': { weight: 600, tracking: "-0.015em" },
  '"Instrument Serif",Georgia,serif': { weight: 400, tracking: "-0.005em" },
} as const;

/** The weight and tracking the chosen display face wants. */
export function displayStyle(): { weight: number; tracking: string } {
  return (
    DISPLAY_CANDIDATES[DISPLAY as keyof typeof DISPLAY_CANDIDATES] ?? {
      weight: 600,
      tracking: "-0.015em",
    }
  );
}

/**
 * The `:root` block, generated from the table above.
 *
 * `--ground` and `--ink` are the two names `app/globals.css` already used for
 * the body's colours and they stay, pointing at the approved values, so the one
 * component that reads `var(--ground)` keeps working.
 */
export function themeCss(): string {
  const style = displayStyle();
  const rows = [
    ...Object.entries(PALETTE).map(([name, value]) => `--${name}:${value};`),
    `--display:${DISPLAY};`,
    `--display-weight:${style.weight};`,
    `--display-tracking:${style.tracking};`,
    `--ui:${UI};`,
    `--ground:${PALETTE.paper};`,
  ];
  return `:root{${rows.join("")}}`;
}
