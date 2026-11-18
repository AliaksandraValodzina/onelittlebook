# Faces

Vendored rather than fetched from a CDN. The browser loads them over
`@font-face` from this directory and the rasteriser reads the same files off
disk, so the screen and the print file are set in the same bytes. A webfont CDN
would make a customer's print file depend on somebody else's uptime.

`lib/render/fonts.ts` is the registry a template names a face through; a
`textSlot` names a key there, never a CSS family. The **family** column below is
read back out of each file's own `name` table by `lib/render/family.ts`, because
a wrong family renders perfectly in a browser and prints as nothing at all.

## Set in by the book

| Key | Face | File | Licence |
|---|---|---|---|
| `typewriter` | Special Elite | `SpecialElite-Regular.ttf` | Apache-2.0 — `SpecialElite-LICENSE.txt` |
| `hand` | Indie Flower | `IndieFlower-Regular.ttf` | SIL Open Font License 1.1 — `IndieFlower-OFL.txt` |

## Candidates for the cover title

**Vendored for the captain to look at, set in by nothing.** The cover's title
is an open question and `docs/cover-face.md` is the whole of it — what each
face costs, what it is measured at, and what switching involves. `npm run
cover-faces` renders the real cover in every one of them.

They are here rather than fetched because a picture the captain chooses from
has to be the picture the press would make, which means the rasteriser has to
load them on exactly the terms it loads the two above. **When the choice is
made, the losers come out** — of this directory, of `FACES` and of
`FACE_COVERAGE` — and `Face.candidate` is the field that says which they are.

| Key | Face | File | Licence |
|---|---|---|---|
| `baloo` | Baloo 2 ExtraBold | `Baloo2-ExtraBold.ttf` | SIL Open Font License 1.1 — `Baloo2-OFL.txt` |
| `sniglet` | Sniglet ExtraBold | `Sniglet-ExtraBold.ttf` | SIL Open Font License 1.1 — `Sniglet-OFL.txt` |
| `grandstander` | Grandstander Bold | `Grandstander-Bold.ttf` | SIL Open Font License 1.1 — `Grandstander-OFL.txt` |
| `fredoka` | Fredoka SemiBold | `Fredoka-SemiBold.ttf` | SIL Open Font License 1.1 — `Fredoka-OFL.txt` |
| `bubblegum` | Bubblegum Sans | `BubblegumSans-Regular.ttf` | SIL Open Font License 1.1 — `BubblegumSans-OFL.txt` |
| `chewy` | Chewy | `Chewy-Regular.ttf` | Apache-2.0 — `Chewy-LICENSE.txt` |
| `comfortaa` | Comfortaa Bold | `Comfortaa-Bold.ttf` | SIL Open Font License 1.1 — `Comfortaa-OFL.txt` |
| `breeserif` | Bree Serif | `BreeSerif-Regular.ttf` | SIL Open Font License 1.1 — `BreeSerif-OFL.txt` |
| `gochi` | Gochi Hand | `GochiHand-Regular.ttf` | SIL Open Font License 1.1 — `GochiHand-OFL.txt` |

## Where they came from

Every file is from the Google Fonts repository, `github.com/google/fonts`, and
every licence text is the one beside it there. Both licences permit embedding,
redistribution, webfont use, server use and commercial use. The text ships
beside each file because the OFL requires it and because a public repository is
where somebody will look; `test/fonts.test.ts` reads the registry's
`licenceFile` and fails if one is missing or does not say what the registry
claims.

Four of the candidates are drawn as variable fonts upstream and are vendored as
**static instances** of the weight named above, cut by Google's own font API
(`fonts.googleapis.com/css?family=…` with the subsets `latin,latin-ext,vietnamese`):
Baloo 2, Fredoka, Grandstander and Comfortaa. The other five are static
upstream and are the repository's own files unchanged. A subsetted instance is
why the coverage of each one is **measured** into
`lib/render/coverage.ts` rather than assumed from the family's name —
`docs/cover-face.md` § The half a picture cannot show is what that measurement
turned out to decide.

No file here is a webfont format. `next.config.ts` traces `./public/fonts/*.ttf`
into the functions that rasterise, which is a glob rather than a list, so a new
face is traced without an edit — and a `.otf` would not be.
