/**
 * **A picture that may only ever be looked at.**
 *
 * The captain's golden ghost spreads are the reason this type exists. They are
 * **1774 × 887 — preview resolution, deliberately** — a glowing gold sparkle
 * child with the clothing and the props left solid, so the spread reads as *a
 * child will be here* rather than as an empty hole. They are not pages: a page
 * of this book is 3600 × 3600 with no alpha and full bleed
 * (`docs/look-upload-contract.md` § 2), and one of these upscaled four times
 * would be a soft, mushy printed page that nobody looked at before it was
 * boxed.
 *
 * ## Why it is a type and not a rule somebody follows
 *
 * `lib/render/ghost.ts` makes the argument for the ghost being a **render
 * option** rather than a layer: *"a printed book with a glowing void where the
 * child should be is the worst failure this product has"*, so the guarantee has
 * to be the shape of the code and not a flag anybody checks. The same argument
 * applies one level down to the artwork itself, and this is the same answer.
 *
 * A `PreviewAsset` carries its content hash in **`digest` and not `sha256`**,
 * which is the whole trick: `AssetRef` — the thing a page's artwork, a
 * photograph and every `image` layer is — requires `sha256`, so TypeScript
 * refuses a `PreviewAsset` everywhere an `AssetRef` is wanted. It cannot be put
 * in `PageArt.byLook`, it cannot be the asset of an `image` layer, and it
 * cannot be handed to `verifySupplied`. The conversion exists in exactly one
 * module — `lib/book/ghost.ts`, which the print path is forbidden to import and
 * `test/ghost.test.ts` reads the import graph off disk to prove it.
 *
 * The second guard is the page contract, which needs no new code at all:
 * `lib/book/upload.ts` § `pageAgainstContract` refuses anything that is not the
 * book's declared page size, so an 887 px half is `page.wrongSize` if anybody
 * ever hands one to the look importer. `test/release-artwork.test.ts` asserts
 * both halves of that.
 */

/**
 * One preview-only picture, by content hash and measured size.
 *
 * `px` is measured out of the IHDR at import, never copied from a filename or a
 * report, for the same reason an `AssetRef`'s is: the renderer divides by those
 * two numbers.
 */
export interface PreviewAsset {
  /**
   * Discriminates it from an `AssetRef` for a reader. The structural guard is
   * `digest` below; this is so a `console.log` says which kind it is.
   */
  kind: "preview";
  /**
   * The content hash. **Spelled `digest` on purpose** — see this file's
   * docblock. It is the same sha256 hex an `AssetRef` carries, under a name
   * that makes the two types unassignable.
   */
  digest: string;
  mime: "image/png";
  px: [number, number];
  label?: string;
}

/** Is this one of ours? Used when a manifest is read back from disk. */
export function isPreviewAsset(value: unknown): value is PreviewAsset {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PreviewAsset>;
  return (
    v.kind === "preview" &&
    typeof v.digest === "string" &&
    /^[0-9a-f]{64}$/.test(v.digest) &&
    v.mime === "image/png" &&
    Array.isArray(v.px) &&
    v.px.length === 2
  );
}
