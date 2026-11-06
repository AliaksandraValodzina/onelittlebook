/**
 * **The theme is one module, and the display face is one line in it.**
 *
 * The captain approved a palette and has **not** finally chosen between
 * Fraunces and Instrument Serif. The instruction was explicit: wire the display
 * face as one token so the switch is one line. That is a claim about the whole
 * tree rather than about `lib/theme.ts`, so it is checked across the whole
 * tree — a second file that writes `"Fraunces"` makes the switch two lines, and
 * nobody would notice until half the headings changed and half did not.
 *
 * The same argument covers the colours. `lib/brand.ts` exists because a brand
 * string typed in fifteen places is changed in fourteen; a hex is worse,
 * because the fifteenth copy is a *slightly* different green that reads as a
 * rendering bug rather than as a mistake.
 *
 * `app/shop.css` is where the design lives and it is checked hardest: it may
 * name a custom property and must not name a palette value.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DISPLAY,
  DISPLAY_CANDIDATES,
  PALETTE,
  UI,
  displayStyle,
  themeCss,
} from "../lib/theme";

const ROOT = process.cwd();

/** Every source file under `app/` and `lib/`, which is everything that renders. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx|css)$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = [...sources(path.join(ROOT, "app")), ...sources(path.join(ROOT, "lib"))];
const THEME = path.join(ROOT, "lib", "theme.ts");

describe("the display typeface is one token", () => {
  it("is one of the two the captain is choosing between", () => {
    expect(Object.keys(DISPLAY_CANDIDATES)).toContain(DISPLAY);
    expect(Object.keys(DISPLAY_CANDIDATES)).toHaveLength(2);
  });

  it("carries the weight and tracking that face wants, so the switch is complete", () => {
    // A family string alone is not enough: Fraunces is set at 600 and
    // Instrument Serif has one weight and wants looser tracking. If the switch
    // left those behind it would be one line and a wrong-looking page.
    const style = displayStyle();
    expect(style).toEqual(DISPLAY_CANDIDATES[DISPLAY as keyof typeof DISPLAY_CANDIDATES]);
    expect(themeCss()).toContain(`--display-weight:${style.weight}`);
    expect(themeCss()).toContain(`--display-tracking:${style.tracking}`);
  });

  it("is named in exactly one file", () => {
    const offenders = FILES.filter(
      (file) =>
        file !== THEME &&
        /\b(Fraunces|Instrument Serif)\b/.test(readFileSync(file, "utf8").replace(/^.*@import.*$/gm, "")),
    );
    expect(
      offenders.map((f) => path.relative(ROOT, f)),
      "a display family named outside lib/theme.ts makes the switch more than one line",
    ).toEqual([]);
  });

  it("would catch a second mention, so the check above can fail", () => {
    expect(/\b(Fraunces|Instrument Serif)\b/.test('--display:"Fraunces",Georgia,serif')).toBe(true);
  });

  it("reaches the page as a custom property and nothing else reads a family", () => {
    expect(themeCss()).toContain(`--display:${DISPLAY}`);
    expect(themeCss()).toContain(`--ui:${UI}`);
    const css = readFileSync(path.join(ROOT, "app", "shop.css"), "utf8");
    expect(css).toContain("font-family: var(--display)");
    expect(css).not.toMatch(/font-family:\s*"/);
  });
});

describe("the palette the captain approved", () => {
  /** The five he named, verbatim. A sixth green is a sixth brand. */
  const APPROVED = {
    green: "#1F4B3F",
    cream: "#FAF3E6",
    "cream-2": "#F4EAD8",
    ink: "#1A1713",
    rose: "#B2453C",
  } as const;

  it("is exactly the approved values", () => {
    for (const [name, value] of Object.entries(APPROVED)) {
      expect(PALETTE[name as keyof typeof PALETTE], name).toBe(value);
    }
  });

  it("reaches the page as custom properties, every one of them", () => {
    const css = themeCss();
    for (const [name, value] of Object.entries(PALETTE)) {
      expect(css, name).toContain(`--${name}:${value}`);
    }
    // And `--ground`, which `app/globals.css` and the preview's bar read.
    expect(css).toContain(`--ground:${PALETTE.paper}`);
  });

  it("is written in one file, so a near-miss green cannot exist", () => {
    const values = Object.values(APPROVED).map((v) => v.toLowerCase());
    const offenders: string[] = [];
    for (const file of FILES) {
      if (file === THEME) continue;
      const text = readFileSync(file, "utf8").toLowerCase();
      for (const value of values) if (text.includes(value)) offenders.push(
        `${path.relative(ROOT, file)} writes ${value}`,
      );
    }
    expect(offenders).toEqual([]);
  });

  it("would catch one, so the check above can fail", () => {
    expect("background: #1f4b3f".includes("#1f4b3f")).toBe(true);
  });
});
