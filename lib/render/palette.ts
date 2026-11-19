/**
 * **One colour per letter, and the two decisions that make it a rule rather
 * than a taste.**
 *
 * The captain's reference is a party invitation whose headline sets every
 * letter in a different pastel. `TextSlotLayer.palette` is that as data, and
 * this module is the whole of how a list of colours becomes a colour for each
 * character. It exists as its own file because **two callers must not be
 * allowed to differ**: `lib/render/svg.ts` draws the letters and
 * `lib/book/title-colour.ts` measures each one's contrast against the artwork
 * behind it, and a measurement of a different assignment from the one that
 * prints is worse than no measurement.
 *
 * ## The title carries the buyer's name, so the rule has to be positional
 *
 * The cover's title is *"When {name} Turned One"*. Nothing a template can
 * write knows how long the name will be or what is in it, so there is no
 * per-word scheme and no hand-assigned one: the only thing knowable about a
 * letter at publish time is **where it stands**. Hence a cycle.
 *
 * ## The cycle restarts on each line
 *
 * Both readings work and they read differently, so this is a choice:
 *
 *  - **Continue through the whole title.** The first line is fixed, so *"When"*
 *    always takes colours 0–3 and the name always starts at 4 — but
 *    *"Turned One"* then starts at `4 + name.length`, which means **the two
 *    lines the captain wrote change colour with the length of the child's
 *    name**. Two orders a letter apart print a differently coloured *"Turned
 *    One"*, for a reason no reader could perceive as intentional.
 *  - **Restart on each line**, which is what this does. *"When"* and *"Turned
 *    One"* then print identically on every copy of the book, and **the only
 *    thing that varies is the name** — which is the line that is *supposed* to
 *    be the buyer's. The name starting on the palette's first colour every time
 *    is what makes it read as deliberate rather than as wherever the count
 *    happened to land.
 *
 * ## Whitespace takes no colour and does not advance the cycle
 *
 * A space puts no ink on the page, so a palette step spent on one is a step
 * nobody can see — and it is worse than invisible, because it decides the
 * colours of every letter after it. *"Turned One"* with a six-colour palette
 * sets `T u r n e d` 0–5 and then `O n e` 0–2; let the space take a step and
 * the second word slides by one for no visible cause. **Visible punctuation
 * does take a step**: a hyphen in *Charlotte-Rose* is a drawn mark that has to
 * be given some colour, and the next colour in the cycle is the only answer
 * that is not special-casing.
 *
 * Line breaks never reach here — `drawTextSlot` has already split on them, and
 * each line is passed separately, which is the restart.
 */

import type { Colour } from "../template/types";

/** One character of a line, and the colour it is set in. */
export interface Lettering {
  /** The character itself, in the order it is drawn. */
  char: string;
  /**
   * The colour this character is set in, or `null` for whitespace — which is
   * drawn in whatever the slot's own `colour` is, because it draws nothing.
   */
  colour: Colour | null;
  /**
   * Its step in the cycle, or `null` for whitespace. This is the letter's
   * identity for a measurement: `lib/book/title-colour.ts` tells one letter
   * from another by the step it is on, which is why a palette of as many
   * distinct colours as a line is long makes every letter distinguishable.
   */
  step: number | null;
}

/** Whitespace, which is the one class of character that takes no step. */
function isSpace(char: string): boolean {
  return /\s/.test(char);
}

/**
 * **One line of a slot's text, letter by letter, with the colour each takes.**
 *
 * Called once per line, which is where the restart comes from. An empty palette
 * is `null` colours throughout — the caller then draws the line as one run in
 * the slot's own colour, which is the same thing `./validate.ts` refuses a
 * template for declaring.
 */
export function letteringOf(line: string, palette: readonly Colour[]): Lettering[] {
  const out: Lettering[] = [];
  let step = 0;
  for (const char of line) {
    if (isSpace(char) || palette.length === 0) {
      out.push({ char, colour: null, step: null });
      continue;
    }
    out.push({ char, colour: palette[step % palette.length], step });
    step++;
  }
  return out;
}

/**
 * How many steps a line of this text takes — the most a single line spends.
 *
 * `lib/book/title-colour.ts` uses it to size the probe palette that tells one
 * letter from another, and `test/title-palette.test.ts` uses it to state the
 * cycle's own arithmetic.
 */
export function stepsIn(line: string): number {
  return letteringOf(line, ["#000000"]).filter((l) => l.step !== null).length;
}
