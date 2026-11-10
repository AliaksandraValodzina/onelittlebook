/**
 * **The archive is a real archive, read back the way a reader reads one.**
 *
 * `lib/zip.ts` writes the container the captain's twenty-five pages arrive in,
 * by hand, because the alternative is a dependency. The risk of writing a
 * format by hand is a file that looks plausible and that no tool can open —
 * and the way that happens is almost always the **central directory**: the
 * entries are fine, the offsets are wrong, and every reader finds the archive
 * through the directory rather than through the entries.
 *
 * So these tests parse the directory, not the local headers, and they check the
 * bytes of an entry rather than its name. An archive of twenty-five correctly
 * named empty files would pass a test that only read names, and it is exactly
 * what a mistake here would produce.
 */

import { describe, expect, it } from "vitest";
import { buildZip, crc32, readZipEntry, readZipListing, ZipTooLarge } from "../lib/zip";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("the zip container", () => {
  it("lists every entry through its central directory, in order", () => {
    const zip = buildZip([
      { name: "00-cover.png", bytes: bytes("cover") },
      { name: "01-page-001.png", bytes: bytes("one") },
      { name: "02-page-002.png", bytes: bytes("two") },
    ]);
    const listing = readZipListing(zip);
    expect(listing.map((e) => e.name)).toEqual([
      "00-cover.png",
      "01-page-001.png",
      "02-page-002.png",
    ]);
    expect(listing.map((e) => e.size)).toEqual([5, 3, 3]);
  });

  it("carries the bytes, not just the names", () => {
    // The assertion the name check cannot make: twenty-five empty files with
    // the right names is what a broken writer produces.
    const zip = buildZip([
      { name: "a.png", bytes: bytes("first") },
      { name: "b.png", bytes: bytes("second") },
    ]);
    expect(new TextDecoder().decode(readZipEntry(zip, "a.png")!)).toBe("first");
    expect(new TextDecoder().decode(readZipEntry(zip, "b.png")!)).toBe("second");
    expect(readZipEntry(zip, "c.png")).toBeNull();
  });

  it("records a CRC that is actually the entry's CRC", () => {
    const content = bytes("the pages of a book");
    const zip = buildZip([{ name: "a.png", bytes: content }]);
    expect(readZipListing(zip)[0].crc).toBe(crc32(content));
    // The paired negative: a different payload is a different CRC, so the
    // assertion above is not comparing two copies of zero.
    expect(crc32(bytes("the pages of a boo"))).not.toBe(crc32(content));
  });

  it("agrees with a known CRC-32, so the table is the right table", () => {
    // The value for "123456789" is published with the algorithm. A CRC that is
    // self-consistent and wrong would pass every test above.
    expect(crc32(bytes("123456789")).toString(16)).toBe("cbf43926");
  });

  it("is byte-identical for the same input, so a download is reproducible", () => {
    // Nothing in here reads the clock. A ZIP stamped with `new Date()` would
    // make the same pages a different file every time they were asked for.
    const entries = [{ name: "a.png", bytes: bytes("x") }];
    expect(buildZip(entries)).toEqual(buildZip(entries));
  });

  it("starts with the local-header signature, which is how a tool sniffs it", () => {
    const zip = buildZip([{ name: "a.png", bytes: bytes("x") }]);
    expect([...zip.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("stores rather than deflates, because a PNG is already deflated", () => {
    const content = bytes("a".repeat(500));
    const zip = buildZip([{ name: "a.png", bytes: content }]);
    const entry = readZipEntry(zip, "a.png")!;
    expect(entry.length).toBe(content.length);
    expect(new TextDecoder().decode(entry)).toBe("a".repeat(500));
  });

  it("refuses more entries than the base format can address", () => {
    const many = Array.from({ length: 0x10000 }, (_, i) => ({
      name: `${i}.png`,
      bytes: new Uint8Array(0),
    }));
    expect(() => buildZip(many)).toThrow(ZipTooLarge);
  });

  it("refuses to read something that is not a zip", () => {
    expect(() => readZipListing(bytes("not a zip at all, not even close"))).toThrow(/not a zip/);
  });
});
