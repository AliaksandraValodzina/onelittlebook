/**
 * **Does this file's alpha channel actually carry anything?**
 *
 * `./png.ts` reads the IHDR, which says whether there *is* an alpha channel.
 * That is not the same question. Four of the captain's softcover wraps were
 * refused on 17 November for carrying one, and all four were measured
 * afterwards at **alpha 255 on every one of 11,496,000 pixels** — the channel
 * was an artefact of the export and nothing in any of them was transparent.
 * Dropping it left the colour data byte-identical. The refusal's reasoning was
 * right and its test was wrong: transparency on a print file really would come
 * off the press as bare paper, but *having a channel* is not *being
 * transparent*, and five round trips were spent on the difference.
 *
 * So this reads the pixels and counts. `lib/book/cover-upload.ts`
 * § `coverWrapAgainstContract` is the one caller and the refusal it writes
 * names the counts either way.
 *
 * ## Why this is not in `./png.ts`
 *
 * Because a channel cannot be read without inflating the image data, and
 * `node:zlib` is a Node builtin. `./png.ts` is reached from a **client**
 * component — `app/_components/Editor.tsx` imports `lib/assets/supplied.ts`,
 * which reads a buyer's photograph's size out of its header — so that module
 * has to stay a browser-safe reader of bytes. This one is server-and-script
 * only, which is the same company `lib/book/upload.ts` keeps with its
 * `node:crypto`.
 *
 * The defiltering below is the PNG specification's five filter types, written
 * out here beside `./png.ts`'s hand-written CRC32 for the same reason: the
 * alternative is a production dependency on an image library to answer one
 * question about one byte per pixel.
 */

import { inflateSync } from "node:zlib";
import { hasAlphaChannel, readPngHeader } from "./png";

/**
 * What a reading of one file's alpha channel found. **Counts, not a verdict.**
 *
 * `transparent === 0` is the whole of "nothing in this file is transparent",
 * and it is a count rather than a boolean so the refusal can say *how much* was
 * found and the acceptance can say *how much was looked at*. A message that
 * said only "has alpha" is what this module exists to replace.
 */
export interface AlphaReading {
  /** Pixels read. Every pixel of the image; this is not a sample. */
  pixels: number;
  /** How many of them carry any transparency at all. */
  transparent: number;
  /** The lowest alpha sample seen, in the file's own scale. */
  lowest: number;
  /** The value that means fully opaque in that scale: 255, or 65535 at 16-bit. */
  opaque: number;
}

/** Thrown when the pixels cannot be reached. Never "there is no transparency". */
export class AlphaUnreadable extends Error {}

/** One line for a refusal or a report, out of a reading. Derived, never typed. */
export function describeAlpha(reading: AlphaReading): string {
  return reading.transparent === 0
    ? `alpha measured on all ${reading.pixels.toLocaleString("en-US")} pixels and every one of ` +
        `them is fully opaque (${reading.opaque})`
    : `alpha measured on all ${reading.pixels.toLocaleString("en-US")} pixels and ` +
        `${reading.transparent.toLocaleString("en-US")} of them are transparent, the lowest at ` +
        `${reading.lowest} of ${reading.opaque}`;
}

/**
 * Every alpha sample in the file, counted.
 *
 * Throws `AlphaUnreadable` rather than returning an all-opaque reading when the
 * pixels cannot be reached — a file with no alpha channel at all, an
 * Adam7-interlaced one, a bit depth the format does not give types 4 and 6.
 * **A failure to measure must never read as a measurement of nothing**, which
 * is the exact shape of the bug this module was written for.
 */
export function readAlphaChannel(bytes: Uint8Array): AlphaReading {
  const header = readPngHeader(bytes);
  if (!hasAlphaChannel(header.colourType)) {
    throw new AlphaUnreadable(`colour type ${header.colourType} carries no alpha channel`);
  }
  if (header.interlaced) {
    throw new AlphaUnreadable("Adam7 interlacing; the pixels are not in one pass");
  }
  if (header.bitDepth !== 8 && header.bitDepth !== 16) {
    throw new AlphaUnreadable(`bit depth ${header.bitDepth} is not one colour type 4 or 6 has`);
  }

  const sample = header.bitDepth / 8;
  // Colour type 6 is RGBA and 4 is grey+alpha, so alpha is the last sample of
  // the pixel either way and the pixel is four samples or two.
  const samples = header.colourType === 6 ? 4 : 2;
  const bpp = samples * sample;
  const stride = header.width * bpp;

  const raw = inflateSync(Buffer.from(imageData(bytes)));
  const want = (stride + 1) * header.height;
  if (raw.length < want) {
    throw new AlphaUnreadable(`${raw.length} bytes of image data where ${want} were needed`);
  }

  const opaque = header.bitDepth === 8 ? 255 : 65535;
  let transparent = 0;
  let lowest = opaque;

  // One row of defiltered bytes and the one before it: the filters reference
  // the pixel to the left and the row above, and nothing else.
  let prior = new Uint8Array(stride);
  let row = new Uint8Array(stride);
  let at = 0;
  for (let y = 0; y < header.height; y++) {
    const filter = raw[at];
    at += 1;
    defilter(filter, raw.subarray(at, at + stride), row, prior, bpp);
    at += stride;
    for (let x = 0; x < header.width; x++) {
      const alphaAt = x * bpp + (samples - 1) * sample;
      const value = sample === 1 ? row[alphaAt] : (row[alphaAt] << 8) | row[alphaAt + 1];
      if (value < opaque) transparent += 1;
      if (value < lowest) lowest = value;
    }
    const spent = prior;
    prior = row;
    row = spent;
  }

  return { pixels: header.width * header.height, transparent, lowest, opaque };
}

/** The IDAT chunks' payloads, in order, as one zlib stream. */
function imageData(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  let total = 0;
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (type === "IEND") break;
    if (type === "IDAT") {
      const part = bytes.subarray(at + 8, at + 8 + length);
      parts.push(part);
      total += part.length;
    }
    at += 12 + length;
  }
  if (total === 0) throw new AlphaUnreadable("no IDAT chunk");
  const out = new Uint8Array(total);
  let into = 0;
  for (const part of parts) {
    out.set(part, into);
    into += part.length;
  }
  return out;
}

/** The specification's five filters, undone into `row`. */
function defilter(
  filter: number,
  from: Uint8Array,
  row: Uint8Array,
  prior: Uint8Array,
  bpp: number,
): void {
  const stride = row.length;
  for (let i = 0; i < stride; i++) {
    const raw = from[i];
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = prior[i];
    const upLeft = i >= bpp ? prior[i - bpp] : 0;
    let value: number;
    switch (filter) {
      case 0:
        value = raw;
        break;
      case 1:
        value = raw + left;
        break;
      case 2:
        value = raw + up;
        break;
      case 3:
        value = raw + ((left + up) >> 1);
        break;
      case 4:
        value = raw + paeth(left, up, upLeft);
        break;
      default:
        throw new AlphaUnreadable(`filter type ${filter} is not one of the five`);
    }
    row[i] = value & 0xff;
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
