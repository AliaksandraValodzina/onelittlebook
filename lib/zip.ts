/**
 * **A ZIP file, written by hand, because the alternative is a dependency.**
 *
 * The captain uploads to Printify by hand and Printify takes **one raster per
 * print area**, so what they need is not a PDF — it is the pages as images, in
 * one download, numbered so they sort into reading order. That is a ZIP, and a
 * ZIP of already-deflated PNGs is the simplest container there is: every entry
 * is **stored**, uncompressed, because a PNG's pixel data is a deflate stream
 * already and deflating it again buys a percent and costs a dependency.
 *
 * This file follows `lib/render/pdf.ts` and `lib/orders/r2.ts`: a small, exact
 * implementation of a published format rather than a package, so the bytes on
 * the wire are asserted rather than trusted. The format is PKWARE's APPNOTE,
 * § 4.3.6 onwards; the three structures are a local header per entry, a
 * central directory entry per entry, and one end-of-central-directory record.
 *
 * **It is deterministic.** Every entry carries the same fixed DOS timestamp —
 * 1 January 1980, the earliest the format can express — rather than the clock.
 * A ZIP stamped with `new Date()` would make the same twenty-five pages a
 * different file every time it was asked for, which would put the one thing
 * this repository tests by byte-identity (`npm run print` leaving `data/`
 * unchanged) permanently out of reach for anything that ever zipped a page.
 * Nothing downstream reads the timestamp; a file's identity here is its name
 * and its bytes.
 *
 * No Zip64, no encryption, no directory entries. Twenty-five PNGs of a third
 * of a megabyte each is ten megabytes and twenty-five entries, which is three
 * orders of magnitude inside every limit the base format has. A caller that
 * one day needs more than 65,535 entries or four gigabytes will get a refusal
 * from `buildZip` rather than a file that is quietly wrong.
 */

export interface ZipEntry {
  /** The path inside the archive. Forward slashes, as the format requires. */
  name: string;
  bytes: Uint8Array;
}

/** More than the base format can address. Refused rather than truncated. */
export class ZipTooLarge extends Error {}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;

/** 1 January 1980, 00:00 — the earliest a DOS timestamp can express. */
const DOS_DATE = 0x0021;
const DOS_TIME = 0x0000;

/**
 * Bit 11 of the general-purpose flags: the name is UTF-8.
 *
 * Every name this codebase produces is ASCII — a page id, an order reference
 * and digits — so the flag changes nothing today. It is set because the one
 * name that could ever stop being ASCII is a buyer's child's name, and a
 * reader that guessed code page 437 at that point would hand the captain a
 * folder of mojibake.
 */
const FLAG_UTF8 = 0x0800;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32, the one the format specifies. Exported so a test can check an entry. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A little-endian writer, which is the only byte order the format uses. */
class Out {
  private parts: Uint8Array[] = [];
  length = 0;

  u16(v: number): void {
    this.push(new Uint8Array([v & 0xff, (v >>> 8) & 0xff]));
  }
  u32(v: number): void {
    this.push(new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]));
  }
  push(bytes: Uint8Array): void {
    this.parts.push(bytes);
    this.length += bytes.length;
  }
  done(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const part of this.parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }
}

/**
 * The archive.
 *
 * Entry order is the order given, and it is the order a reader lists them in —
 * which is why the callers number their names rather than relying on it. A
 * zip's own order is not something Finder, `unzip -l` or Printify's uploader
 * agree about; a two-digit prefix is something they all sort the same way.
 */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  if (entries.length > 0xffff) {
    throw new ZipTooLarge(`${entries.length} entries; the base format addresses 65535`);
  }

  const encoder = new TextEncoder();
  const body = new Out();
  const central = new Out();

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const offset = body.length;
    if (offset > 0xffffffff || entry.bytes.length > 0xffffffff) {
      throw new ZipTooLarge(`${entry.name} puts this archive over four gigabytes`);
    }

    body.u32(SIG_LOCAL);
    body.u16(20); // the version needed to extract a stored entry
    body.u16(FLAG_UTF8);
    body.u16(0); // stored, not deflated — see this file's docblock
    body.u16(DOS_TIME);
    body.u16(DOS_DATE);
    body.u32(crc);
    body.u32(entry.bytes.length);
    body.u32(entry.bytes.length);
    body.u16(name.length);
    body.u16(0); // no extra field
    body.push(name);
    body.push(entry.bytes);

    central.u32(SIG_CENTRAL);
    central.u16(20); // made by
    central.u16(20); // needed to extract
    central.u16(FLAG_UTF8);
    central.u16(0);
    central.u16(DOS_TIME);
    central.u16(DOS_DATE);
    central.u32(crc);
    central.u32(entry.bytes.length);
    central.u32(entry.bytes.length);
    central.u16(name.length);
    central.u16(0); // extra
    central.u16(0); // comment
    central.u16(0); // disk the entry starts on
    central.u16(0); // internal attributes
    central.u32(0); // external attributes
    central.u32(offset);
    central.push(name);
  }

  const out = new Out();
  const directory = central.done();
  const files = body.done();
  out.push(files);
  out.push(directory);
  out.u32(SIG_END);
  out.u16(0); // this disk
  out.u16(0); // the disk the directory starts on
  out.u16(entries.length);
  out.u16(entries.length);
  out.u32(directory.length);
  out.u32(files.length);
  out.u16(0); // no archive comment
  return out.done();
}

export interface ZipListing {
  name: string;
  size: number;
  crc: number;
}

/**
 * The central directory of an archive, read back.
 *
 * **For the tests, and that is why it reads the directory rather than the local
 * headers.** A reader — `unzip`, Finder, Printify's uploader — finds the
 * entries through the central directory, so a test that walked the local
 * headers instead could pass on an archive no tool could open. It parses
 * backwards from the end-of-central-directory record exactly as a real reader
 * does.
 */
export function readZipListing(bytes: Uint8Array): ZipListing[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === SIG_END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("no end-of-central-directory record; this is not a zip");

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const out: ZipListing[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== SIG_CENTRAL) throw new Error(`entry ${i} is not a directory entry`);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    out.push({
      name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)),
      size,
      crc,
    });
    at += 46 + nameLength + extra + comment;
  }
  return out;
}

/**
 * One entry's bytes, by name, out of an archive.
 *
 * Also for the tests, and it is the half that matters: a listing proves the
 * names, and this proves the **pixels** are in the file — which is the
 * difference between an archive of twenty-five PNGs and an archive of
 * twenty-five empty files with the right names.
 */
export function readZipEntry(bytes: Uint8Array, name: string): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const encoder = new TextEncoder();
  const want = encoder.encode(name);
  let at = 0;
  while (at + 30 <= bytes.length && view.getUint32(at, true) === SIG_LOCAL) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extra = view.getUint16(at + 28, true);
    const start = at + 30 + nameLength + extra;
    const got = bytes.subarray(at + 30, at + 30 + nameLength);
    if (got.length === want.length && got.every((b, i) => b === want[i])) {
      return bytes.subarray(start, start + size);
    }
    at = start + size;
  }
  return null;
}
