# The artwork the captain has delivered

**What arrived, what it became, where it is, and what is still owed.**

`look-upload-contract.md` is the *agreement* — what a finished folder of twelve
looks must be. This is the *inventory*: three sets delivered on 10 November
2026, none of them complete, all of them in use.

**Nothing on this page is in the repository.** Every picture lives in the
artwork store (`lib/artwork/release.ts`), which keeps it out of a public git
history and out of a clone. Run the import on the machine that has the folders:

```sh
npm run artwork -- status
npm run artwork -- look      ~/Downloads/approved-pages-3600x3600 02-girl
npm run artwork -- portraits ~/Downloads/baby-portraits-v2
npm run artwork -- ghosts    ~/Downloads/golden-spreads

npm run artwork:upload       # all three, to the public Blob store — § 6
```

With nothing imported the shop draws every page from the numbers in
`templates/first-book.ts` and is a complete, printable book. That is not a
degraded mode; it is the state this repository ships in and the state CI runs
in.

---

## 1. The first look — 24 interior pages

| | |
|---|---|
| **Delivered** | `spread-NN-left-3600x3600.png` / `spread-NN-right-3600x3600.png`, NN = 01…12 |
| **Measured** | 24 files, all **3600 × 3600, 8-bit, colour type 2 (no alpha), no embedded profile** — the contract in `look-upload-contract.md` § 2 exactly |
| **Which look** | the **auburn curly girl** = portrait `02-girl` = look id **`ada`** |
| **Stored as** | `look-ada`, page ids `page-001` … `page-024` |
| **Size** | 155 MB |

The spread-and-side filenames are mapped onto page ids by
`lib/book/order-upload.ts` § `pageForArtworkName`, **derived from the book's own
spread pairing** — so `spread-03-right` is `page-006` because that is what
`spreads()` says, not because anybody wrote it down. The pages are stored byte
for byte: they already satisfy the contract, and re-encoding would change the
digest and cost quality for nothing.

**There is no cover.** The cover is generated per order with a stored fallback
and neither exists yet, so the book's cover page is still the drawn
placeholder — visibly, which is the honest state. `npm run artwork -- status`
says so every time it runs.

**Eleven looks are still being drawn.** That is why `PageArt` has a `scene`
beside `byLook`: a page carries the captain's artwork for the looks that have it
and the placeholder baby for the rest. The chooser offers twelve babies and all
twelve render.

---

## 2. Twelve portrait tiles

| | |
|---|---|
| **Delivered** | `01-girl.png` … `06-girl.png`, `07-boy.png` … `12-boy.png` |
| **Measured** | 1254 × 1254, 8-bit **RGBA**, transparent background, **nothing fully opaque** — the subject sits at alpha 249–253 |
| **Stored as** | `tiles`, page ids `tile-<lookId>`, flattened onto white |
| **Size** | 22 MB |

These are the chooser's tiles, which the captain approved on 10 November. A head
on white is purely *which baby*, which is what a tile has to say; a whole page
shrunk to a tile says *which picture* in a sixth of the pixels. It is what
Wonderbly does. `lib/book/types.ts` § `Look.tile` carries the full argument,
including what it reverses in `look-upload-contract.md` § 4, and the
page-drawn tile stays as the fallback for every look with no portrait.

### The mapping, so nobody matches babies by eye

**Positional within a gender**: the captain's *n*th girl is the book's *n*th
girl look. Derived in `lib/artwork/import.ts` § `portraitMapping` from the
book's own look order, printed by the importer every time it runs, and asserted
in `test/release-artwork.test.ts` against the same list — so a look renamed or
reordered moves the mapping with it. Today that is:

| File | Look id | Label | | File | Look id | Label |
|---|---|---|---|---|---|---|
| `01-girl` | `mabel` | Mabel | | `07-boy` | `wren` | Wren |
| `02-girl` | `ada` | **Ada** | | `08-boy` | `otis` | Otis |
| `03-girl` | `iris` | Iris | | `09-boy` | `albie` | Albie |
| `04-girl` | `nell` | Nell | | `10-boy` | `rufus` | Rufus |
| `05-girl` | `clover` | Clover | | `11-boy` | `milo` | Milo |
| `06-girl` | `juno` | Juno | | `12-boy` | `bear` | Bear |

`ada` is in bold because it is the one look whose 24 pages exist.

### They are flattened onto white at import

Nothing in the delivered files is fully opaque — there is no clean solid region
anywhere — and a page folder requires **no alpha at all**, so an unflattened
portrait could never pass the page validator. `flattenOntoWhite` composites
straight alpha onto white per channel and writes colour type 2 with an `sRGB`
chunk. White and not cream, because that is what the captain generated them on
and what their edges were antialiased against.

### The two portraits to be replaced

**`02-girl` (ada) and `08-boy` (otis)** carry a red/yellow halo from the
background they were cut out of — measured on their own true edge pixels
(alpha 10–220, saturated) at **98.5 %** and **86.5 %**, against under 7 % for
every other file. The captain is regenerating both.

All twelve are imported anyway, so the flow works end to end; a re-import is a
new version and the previous one stays readable (`lib/artwork/store.ts`
§ Versions). Note the overlap worth knowing: `ada` is both the look whose pages
were delivered and one of the two portraits being replaced.

---

## 3. The golden ghost spreads — preview only

| | |
|---|---|
| **Delivered** | `spread-01.png` … `spread-12.png` |
| **Measured** | 1774 × 887, 8-bit, colour type 2, no alpha |
| **Stored as** | `ghosts`, right halves only, 887 × 887, page ids `page-004` … `page-024` |
| **Size** | 24 MB |

The child is a glowing gold sparkle silhouette with the clothing and the props
left solid — the bib, the party hat, the spoon — which is what makes the page
read as *a child will be here* rather than as an empty hole. It replaces the
drawn white silhouette (`lib/render/ghost.ts`) on every page that has one, and
the renderer still draws the caption over it, because every word in this book is
the renderer's.

**Only the right halves are kept.** Every left page is babyless and identical to
the real artwork, so importing both halves would import the left pages twice at
a quarter of the resolution.

**`spread-01` is skipped**, and it is skipped by *derivation* rather than by a
list: its right half is `page-002`, the book declares that page babyless — it is
the one spread identical across all twelve looks, which is why it carries the
buyer's photograph and dedication — and nothing would ever draw a ghost there.
The captain's own `spread-01` correctly has no gold figure in it. Eleven halves
are stored.

**They are 887 px on purpose and must never be printed.** That is enforced
twice and neither way is a rule somebody has to remember:

- They are typed as `PreviewAsset` (`lib/book/preview-art.ts`), which carries
  its hash in `digest` and not `sha256` — so TypeScript refuses one everywhere
  an `AssetRef` is wanted, including `PageArt.byLook` and every `image` layer.
  The one conversion lives in `lib/book/ghost.ts`, which no module on the print
  path may import and `test/ghost.test.ts` reads the import graph to prove it.
- The page contract refuses them on size with no new code at all:
  `pageAgainstContract` reports `page.wrongSize` for anything that is not
  3600 × 3600.

---

## 4. Where it all is

| | |
|---|---|
| **Pixels** | the artwork store — the public Blob store `olb-looks` when `BLOB_READ_WRITE_TOKEN` is set (§ 6), otherwise `.artwork/release/<set>/vNNNN/<pageId>.png` on this machine, `RELEASE_ARTWORK_DIR` to move it. `.gitignore` excludes `.artwork/` and `test/release-artwork.test.ts` asserts the rule. |
| **Manifests** | beside each version's pages — ids, digests, measured sizes, and in the public store the CDN URL of each picture. **Also not committed**, deliberately: see below. |
| **The repository** | the look ids, the labels, the genders, the slot coordinates, the page order — `templates/first-book.ts` — and no pixels. |

**The manifest is not committed either**, and the reason is the property this
repository cannot afford to lose: a fresh clone and the test suite must work
with no artwork at all. A committed manifest naming bytes nobody has is a book
that declares twenty-four uploaded pages and can draw none of them. So the
artwork is **bound over** the published book at request time
(`lib/book/release-art.ts`), the book's `rev` does not move when artwork lands,
and `npm run print`'s byte-identity gate stays meaningful on every machine.

The consequence, stated rather than hidden: **the artwork binding is environment
state, so it is outside the book's `rev`.** A re-import of corrected artwork
changes what a reprint looks like without changing the revision the order names.
Nothing is lost — the store never overwrites — but pinning a chosen-look order
to an artwork version is still owed. The honest place to record it is a version
number beside the look id in the order's record, now that the bytes have a home.

---

## 5. What the captain still owes

- **Eleven more looks.** One of twelve has pages.
- **A cover for every look.** There is no cover artwork at all.
- **Replacements for `02-girl` and `08-boy`.** § 2 above.
- **Uploading it.** The storage decision is answered — see § 6 — and the command
  is `npm run artwork:upload`. Until somebody runs it against the real token,
  the deployed shop renders the placeholder book and the artwork is on one
  laptop.
- **Pinning a chosen-look order to an artwork version**, as § 4 above says.
- **The trim**: `print.md` § The square trim nobody has pinned down. The captain
  confirmed **12 × 12 inches** on 11 November, over which the delivered 3600 px
  pages are 300 DPI native with no upscaling — so **no artwork is regenerated**
  when it is applied. What is still unconfirmed is the interior bleed, about
  225 px an edge, and the repository still *declares* 8.00 in: applying the
  answer is an edit to `page.canvas`/`page.print`, a restamp and a re-run of
  `npm run print`.

---

## 6. Where the artwork lives: two Vercel Blob stores

**The captain picked Vercel Blob and created two stores.**
`lib/artwork/blob.ts` is the adapter, behind the same `ArtworkStore` interface
the filesystem already answered.

| Store | Access | Reached through | Holds |
|---|---|---|---|
| `olb-looks` | **public** | `BLOB_READ_WRITE_TOKEN` | the looks' pages, the twelve portrait tiles, the golden ghost halves |
| `olb-orders` | **private** | `OLB_ORDERS_STORE_ID` + the deployment's OIDC token | one order's regenerated artwork |

**Public is deliberate.** The looks' pages are shown to everyone during the
whole-book preview with no watermark and no account; serving twenty-five of them
from a CDN rather than from twenty-five function invocations is what makes that
promise affordable.

**Private is equally deliberate**, and nothing may cross between the two:
`olb-orders` holds artwork regenerated from a photograph of one family's child
and a guessable URL for that is the worst thing this product could do. The two
stores have **distinct types** with no function that turns one into the other,
the public store's key check refuses an order reference, and the private store
records no URLs at all. `test/artwork-separation.test.ts` and
`test/no-order-asset-in-the-public-store.ts` are the proof — the second is a
file of calls that must not compile, so `npm run lint` is the gate.

### Uploading

```
npm run artwork:upload                       # all three sets, the delivered folders
npm run artwork:upload -- --dry-run          # prepare and compare, write nothing
npm run artwork:upload -- --only portraits   # just the twelve tiles
npm run artwork:upload -- --portraits ~/art/tiles-v3
```

Each directory is an argument; the defaults are the folders the artwork was
delivered into. It validates every set against the same contract an order's
regenerated pages are held to and **refuses before it writes**. A set whose
pages are digest-for-digest what the store already holds is skipped entirely, so
running it twice does nothing the second time, and because a key is a content
hash, re-uploading the two corrected portraits uploads two files and can never
be served stale from a cache.

With no token set it refuses and names the variable. `npm run artwork` writes to
whichever store the environment points at, and every line it prints names that
store.
