# The artwork the captain has delivered

**What arrived, what it became, where it is, and what is still owed.**

`look-upload-contract.md` is the *agreement* — what a finished folder for a look
must be. This is the *inventory*: three sets delivered on 10 November
2026, none of them complete, all of them in use.

**Nothing on this page is in the repository.** Every picture lives in the
artwork store (`lib/artwork/release.ts`), which keeps it out of a public git
history and out of a clone. Run the import on the machine that has the folders:

```sh
npm run artwork -- status
npm run artwork -- look      ~/Downloads/approved-pages-3600x3600 02-girl
npm run artwork -- portraits ~/Downloads/baby-portraits-v2
npm run artwork -- ghosts    ~/Downloads/golden-spreads

npm run artwork:upload       # all three, to the public R2 bucket — § 6
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
| **Which look** | the **auburn curly girl** = portrait `02-girl` = look id **`girl-02`** |
| **Stored as** | `look-girl-02`, page ids `page-001` … `page-024` |
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

**The rest are still being drawn.** That is why `PageArt` has a `scene` beside
`byLook`: a page carries the captain's artwork for the looks that have it and
the placeholder baby for the rest. Every look the chooser offers renders.
`npm run artwork -- status` counts what is outstanding off the book rather than
stating a number — the count has already moved once.

---

## 2. The portrait tiles

| | |
|---|---|
| **Delivered** | `01-girl.png` … `07-girl.png`, `01-boy.png` … `07-boy.png` — **numbered 01–07 within each gender.** The set delivered on 10 November was twelve, numbered `01-girl`…`06-girl` and `07-boy`…`12-boy`; the captain settled on seven per gender on 12 November and renumbered the folder. |
| **Measured** | 1254 × 1254, 8-bit **RGBA**, transparent background, **nothing fully opaque** — the subject sits at alpha 249–253 |
| **Stored as** | `tiles`, page ids `tile-<lookId>`, flattened onto white |
| **Size** | 22 MB for the twelve measured on 10 November |

These are the chooser's tiles, which the captain approved on 10 November. A head
on white is purely *which baby*, which is what a tile has to say; a whole page
shrunk to a tile says *which picture* in a sixth of the pixels. It is what
Wonderbly does. `lib/book/types.ts` § `Look.tile` carries the full argument,
including what it reverses in `look-upload-contract.md` § 4, and the
page-drawn tile stays as the fallback for every look with no portrait.

### The mapping, which is the identity on purpose

**By number within a gender**: the captain's `03-girl` is the book's third girl
look. The look ids are spelled to *be* that numbering — `03-girl.png` is
`girl-03` — so there is no table for anybody to maintain and nothing to match
by eye. It is still **derived** rather than spelled: `lib/artwork/import.ts`
§ `portraitMapping` reads the book's own look order, the importer prints the
whole table every time it runs, and `test/release-artwork.test.ts` asserts it
against the same list, so a look renamed or reordered moves the mapping with it.

| File | Look id | Label | | File | Look id |
|---|---|---|---|---|---|
| `01-girl` | `girl-01` | Very fair skin, blonde hair | | `01-boy` | `boy-01` |
| `02-girl` | `girl-02` | **Very fair skin, ginger hair** | | `02-boy` | `boy-02` |
| `03-girl` | `girl-03` | Fair skin, mid-brown hair | | `03-boy` | `boy-03` |
| `04-girl` | `girl-04` | Tan skin, dark brown hair | | `04-boy` | `boy-04` |
| `05-girl` | `girl-05` | Olive skin, straight black hair | | `05-boy` | `boy-05` |
| `06-girl` | `girl-06` | Brown skin, black curls | | `06-boy` | `boy-06` |
| `07-girl` | `girl-07` | Deep brown skin, black coils | | `07-boy` | `boy-07` |

`girl-02` is in bold because it is the one look whose 24 pages exist — the
auburn curly girl, who is the ginger rung of the ladder and the captain's own
`02-girl` both.

**The order is the ladder**, which is skin lightness descending with the three
fair rungs separated by hair; both genders read down the same one.
`templates/first-book.ts` § `LOOKS` is the table and the reasoning. **Nothing
counts them** — `test/look-count.test.tsx` renders the chooser for a book with a
deliberately different number of looks, so delivering five or eight stays an
upload and never a release.

### They are flattened onto white at import

Nothing in the delivered files is fully opaque — there is no clean solid region
anywhere — and a page folder requires **no alpha at all**, so an unflattened
portrait could never pass the page validator. `flattenOntoWhite` composites
straight alpha onto white per channel and writes colour type 2 with an `sRGB`
chunk. White and not cream, because that is what the captain generated them on
and what their edges were antialiased against.

### The two portraits to be replaced

Two files of the **10 November twelve** carry a red/yellow halo from the
background they were cut out of — measured on their own true edge pixels
(alpha 10–220, saturated) at **98.5 %** and **86.5 %**, against under 7 % for
every other file. They were `02-girl` and `08-boy`, which under that set's
numbering — 01–06 girls, 07–12 boys — were the second girl and the second boy.
The captain is regenerating both, and the fourteen-portrait set renumbered to
01–07 per gender supersedes the folder either way, so **the halo is a property
of files, not of look ids**: whether a given replacement has landed is a
question for `npm run artwork -- status` and the captain, not for this page.

Everything is imported anyway, so the flow works end to end; a re-import is a
new version and the previous one stays readable (`lib/artwork/store.ts`
§ Versions). Note the overlap worth knowing: `girl-02` is both the look whose
pages were delivered and one of the two portraits being replaced.

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
the one spread identical across every look, which is why it carries the
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
| **Pixels** | the artwork store — the public R2 bucket when `R2_LOOKS_BUCKET` and `R2_PUBLIC_BASE` are set (§ 6), otherwise `.artwork/release/<set>/vNNNN/<pageId>.png` on this machine, `RELEASE_ARTWORK_DIR` to move it. `.gitignore` excludes `.artwork/` and `test/release-artwork.test.ts` asserts the rule. |
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

- **Every look but one.** One has pages; `npm run artwork -- status` counts the
  rest off the book rather than quoting a number here that goes stale.
- **A cover for every look.** There is no cover artwork at all.
- **The two portrait replacements.** § 2 above.
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

## 6. Where the artwork lives: two Cloudflare R2 buckets

**It was two Vercel Blob stores until the public one filled up.** `olb-looks`
held **1.03 GB across 331 files** against Vercel Blob's 1 GB limit, and the last
upload landed `girl-07`'s masters and not its screen copies. Fourteen looks at
twenty-four pages is 336 images plus covers — about **2.5 GB** — so it was never
going to fit at any point rather than being one tier short. R2 is 10 GB free
with no egress charge, which is the right shape for a shop whose whole promise is
that anybody may read the entire book with no account. The private store
followed because it was **empty**: no data to migrate, and one provider is one
credential set, one adapter and one failure mode.

**Nothing has been deleted from either Blob store.** `.env.example` § Vercel
Blob, retired is the record of what is still sitting there.

`lib/artwork/r2.ts` is the adapter and `lib/artwork/object-store.ts` is the key
layout both buckets share, behind the same `ArtworkStore` interface the
filesystem already answered — which is why the move changed no caller.

| Bucket | Access | Reached through | Holds |
|---|---|---|---|
| the looks bucket | **public** | `R2_LOOKS_BUCKET` + `R2_PUBLIC_BASE` | the looks' pages, the portrait tiles, the golden ghost halves, the covers |
| the order-artwork bucket | **private** | `R2_ORDERS_BUCKET` | one order's regenerated artwork |

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are shared: one
Cloudflare account, one token with read-write over both buckets.

**Public is deliberate.** The looks' pages are shown to everyone during the
whole-book preview with no watermark and no account; serving twenty-five of them
from a CDN rather than from twenty-five function invocations is what makes that
promise affordable. **Reads come from `R2_PUBLIC_BASE` and never from a signed
URL** — do not point that row at the default `r2.dev` address for anything but a
local smoke test, because Cloudflare rate-limits it and does not intend it for
production traffic.

**Private is equally deliberate**, and nothing may cross between the two: the
order-artwork bucket holds artwork regenerated from a photograph of one family's
child and a guessable URL for that is the worst thing this product could do.

**Two buckets and never one, and that is the whole safety argument.** A
Cloudflare custom domain is attached to a **bucket** and not to a prefix, so
"they are under different prefixes" is not a defence. With both halves on one
provider the wall matters *more* than it did, because the only thing separating
them in a signed request is the bucket name in the path. There are five walls,
not four:

1. The two store types are mutually unassignable, with no cast anywhere.
2. The two bucket **configurations** are too — `publicBase` exists on one and
   does not exist at all on the other, so a private store with URLs cannot be
   asked for.
3. The public bucket's key check refuses an order reference; the private one
   refuses a release set.
4. The private store records no URLs, and `objectScreenStore` — the only thing
   that makes them — takes a non-optional origin, so it cannot be composed onto
   it.
5. **A public bucket that is also a private bucket is refused at the environment
   seam**, naming the row that collided, and the read falls back to the local
   directory. One token covers both buckets, so a copy-paste in a dashboard is
   exactly how the two would become one — and it would look configured.

`test/artwork-separation.test.ts` and
`test/no-order-asset-in-the-public-store.ts` are the proof — the second is a
file of calls that must not compile, so `npm run lint` is the gate.

### The keys outlive the provider

```
assets/<sha256>.png            the bytes, named by their own content
sets/<set>/v0001.json          one version's manifest
screen/<sha256>-w1600.webp     a screen-sized copy of those bytes
```

A hash, a set name and a padded integer. **No provider, no account, no store id
and no URL in any of it** — which is what made the move off Vercel Blob a new
`ObjectApi` and nothing else, and what will make the next move the same.
`test/artwork-r2.test.ts` § The key layout asserts it both ways.

### Uploading

```
npm run artwork:upload                       # all three sets, the delivered folders
npm run artwork:upload -- --screens          # ONLY the screen copies — the backfill
npm run artwork:upload -- --dry-run          # prepare and compare, write nothing
npm run artwork:upload -- --only portraits   # just the tiles
npm run artwork:upload -- --no-screens       # masters only
npm run artwork:upload -- --portraits ~/art/tiles-v3
```

Each directory is an argument; the defaults are the folders the artwork was
delivered into. It validates every set against the same contract an order's
regenerated pages are held to and **refuses before it writes**. A set whose
pages are digest-for-digest what the store already holds is skipped entirely, so
running it twice does nothing the second time, and because a key is a content
hash, re-uploading the two corrected portraits uploads two files and can never
be served stale from a cache.

With the bucket unconfigured it refuses and **names every empty row**, not just
the first. It also refuses outright if `R2_LOOKS_BUCKET` names the same bucket as
either private row. `npm run artwork` writes to whichever store the environment
points at, and every line it prints names that store.

### 6b. Repopulating R2 from the captain's folders

**There is no copier from Vercel Blob to R2, deliberately.** The captain holds
every original locally and `npm run artwork:upload` already reads from those
folders, so re-uploading is simpler, verifiable, and has no half-copied state to
reason about — which is exactly the state the old store was left in when it hit
its limit.

With the five public rows set in `.env.local` (`vercel env pull .env.local`
after adding them in Vercel), and `$ART` wherever the delivered folders are:

```sh
# 1. One command per look. --only pages, so the tiles and ghosts are not
#    re-read once per look; --no-screens, so the derivatives are one pass at
#    the end rather than fourteen.
for look in $LOOKS; do
  npm run artwork:upload -- --only pages --no-screens \
    --look "$look" --pages "$ART/pages/$look"
done

# 2. The portrait tiles — one set, every look's tile in the folder.
npm run artwork:upload -- --only portraits --no-screens --portraits "$ART/tiles"

# 3. The golden ghost halves — one set, one per spread.
npm run artwork:upload -- --only ghosts --no-screens --ghosts "$ART/gold"

# 4. The screen copies, for everything now in the bucket. Store-driven, so no
#    delivery folder has to be on the machine and a re-run writes nothing.
npm run artwork:upload -- --screens
```

`$LOOKS` is the look ids whose pages exist — `npm run artwork -- status` reports
what the store this environment points at actually has, and § 2 above is the
`NN-gender` → look id mapping if the folders are named the captain's way
(`--look 02-girl` and `--look girl-02` are the same instruction).

Add `--dry-run` to any of them to prepare, validate and compare without writing.
Every step is **idempotent**: a set that is digest-for-digest what the bucket
already holds is skipped entirely, and a key that is already there is not
re-uploaded, so a run that dies half way is fixed by running it again.

### 6a. The screen-sized copies

A page is 3600 × 3600 and about 2.6 MB. The preview shows a spread about 700 CSS
px wide, so it was sending roughly **26 times the pixels the screen uses** — about
62 MB for a twenty-four page preview, and the first spread arrived half-painted.

So every upload also writes a **WebP copy at 1600 px**, beside the master:

```
assets/<sha256>.png            the master — what prints
screen/<sha256>-w1600.webp     the screen copy — what the preview fetches
```

Measured on this repository's own committed 3600 px pages (flat placeholder art,
which compresses far better than a painting, so this is the conservative end):
**1.20 MB → 35 KB, 2.9%.** On the captain's real artwork the same transform
measured 7.06 MB → 0.13 MB.

- **Never upscales.** The width is `min(master, 1600)`, so the 1254 px portraits
  and the 887 px golden halves are re-encoded at their own size — which is most
  of the saving anyway.
- **Keyed on the master's digest**, so "is there already one of these" is a
  `head` and a re-run writes nothing. That is what makes the backfill a command
  rather than a migration.
- **The preview reads them; the print path cannot.** A derivative is never an
  `AssetRef`, so it cannot be loaded, inlined, put in `PageArt.byLook` or drawn
  as a layer. `lib/assets/screen.ts` is the only module that turns one into a
  URL and no module the print path imports may import it —
  `test/no-derivative-in-a-print-file.ts` is the compiler's half and
  `test/screen-derivatives.test.ts` walks the import graph and reads both
  renders of one page.
- **Public bucket only.** The order-artwork bucket has no such operation,
  because the whole point of a derivative is that it has a URL.

**To backfill the screen copies for everything already uploaded**, run this once
with the public bucket configured:

```
npm run artwork:upload -- --screens
```

It reads the current version of every set **out of the store**, so no delivery
folder has to be on the machine, and it skips anything that already has a copy.
Nothing redeploys: the shop reads the store on the next request.
