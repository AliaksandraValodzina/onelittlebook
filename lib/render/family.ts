/**
 * What family a font file calls itself.
 *
 * **This module exists to keep a second declaration honest, exactly as
 * `./cmap.ts` keeps `./coverage.ts` honest.** `Face.family` is the string the
 * browser is given in an `@font-face` rule *and* the string the rasteriser
 * looks a file up by, and those two readers fail differently when it is wrong.
 * The browser does not care: a rule binds whatever name is written to whatever
 * file is fetched, so a typo there renders perfectly. `resvg` does care — it
 * indexes the file under the family **inside** the bytes and matches by that
 * name, so a typo means no match, and `loadSystemFonts: false` means no match
 * is **no type on the page at all**.
 *
 * That failure is invisible to a build, invisible to a type check, and
 * invisible on screen. `test/fonts.test.ts` compares the registry against this
 * reader so it is instead a red test.
 *
 * It is a `name` table reader and nothing else — no metrics, no outlines, and
 * no `node:` import, so a script, a test or a route can all read it.
 */

export class NoFamilyName extends Error {}

function u16(b: Uint8Array, at: number): number {
  return (b[at] << 8) | b[at + 1];
}

function u32(b: Uint8Array, at: number): number {
  return ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
}

/** Where a table lives in the file, or `null` if the file has no such table. */
export function tableAt(bytes: Uint8Array, tag: string): number | null {
  if (bytes.length < 12) return null;
  const tables = u16(bytes, 4);
  for (let i = 0; i < tables; i++) {
    const at = 12 + i * 16;
    if (String.fromCharCode(...bytes.subarray(at, at + 4)) === tag) return u32(bytes, at + 8);
  }
  return null;
}

/**
 * One `name` record's string.
 *
 * Platform 3 and the later Unicode encodings of platform 0 store UTF-16BE;
 * everything else in practice is ASCII in these files. Decoded by hand rather
 * than with `TextDecoder` so this stays usable wherever the rest of the render
 * path is.
 */
function stringOf(bytes: Uint8Array, platform: number, encoding: number): string {
  const wide = platform === 3 || (platform === 0 && encoding >= 3);
  if (!wide) return String.fromCharCode(...bytes);
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return out;
}

/**
 * The family a font matcher will index this file under.
 *
 * **Name 16 when the file has one, otherwise name 1**, which is the rule every
 * matcher worth using follows and the reason it matters here: a static instance
 * cut from a variable font calls itself *"Baloo 2 ExtraBold"* in name 1 and
 * *"Baloo 2"* in name 16, and only the second is the family the rasteriser will
 * find. A registry that wrote the first would ask for a family nothing has.
 *
 * The first record for the chosen id wins. A file that states its family twice
 * in two languages states the same family, and preferring the first keeps the
 * answer independent of record order.
 */
export function familyNameOf(bytes: Uint8Array): string {
  const name = tableAt(bytes, "name");
  if (name === null) throw new NoFamilyName("no name table");
  const count = u16(bytes, name + 2);
  const strings = name + u16(bytes, name + 4);

  const found = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const rec = name + 6 + i * 12;
    const id = u16(bytes, rec + 6);
    if (id !== 1 && id !== 16) continue;
    if (found.has(id)) continue;
    const length = u16(bytes, rec + 8);
    const offset = u16(bytes, rec + 10);
    if (strings + offset + length > bytes.length) continue;
    found.set(
      id,
      stringOf(
        bytes.subarray(strings + offset, strings + offset + length),
        u16(bytes, rec),
        u16(bytes, rec + 2),
      ),
    );
  }

  const family = found.get(16) ?? found.get(1);
  if (!family) throw new NoFamilyName("no family record in the name table");
  return family;
}
