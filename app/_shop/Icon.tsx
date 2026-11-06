/**
 * **The line icons, traced from the approved artefacts.**
 *
 * Eight paths, taken across from `landing.html` and `book-page.html` exactly as
 * they were drawn. They are here rather than in the pages because the trust
 * row, the four how-it-works steps and the book page's fact list each name an
 * icon by key in `lib/shop/copy.ts` — copy is data and so is the picture beside
 * it, which is what lets a fact be added without a component being touched.
 *
 * **No icon font and no sprite sheet.** One `<svg>` per use is a handful of
 * bytes inline, needs no second request, and inherits `currentColor` where the
 * artefact wanted it to — the steps draw theirs in cream on green and the trust
 * row draws the same shape in forest green on cream.
 *
 * An unknown key draws nothing rather than a question mark: a missing icon is a
 * gap, and a gap is better than a glyph that says the page is broken.
 */

export type IconName =
  | "book"
  | "star"
  | "van"
  | "heart"
  | "eye"
  | "pen"
  | "photo"
  | "open";

const PATHS: Record<IconName, React.ReactNode> = {
  book: <path d="M4 5h7v15H4zM13 5h7v15h-7z" />,
  star: <path d="M12 3l2.6 5.6 6 .8-4.4 4.3 1.1 6.1L12 17l-5.3 2.8 1.1-6.1L3.4 9.4l6-.8z" />,
  van: (
    <>
      <path d="M3 13h13V6H3zM16 9h3l2 3v4h-5z" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="18" cy="17" r="2" />
    </>
  ),
  heart: <path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z" />,
  eye: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
    </>
  ),
  pen: <path d="M4 20l4-1 11-11-3-3L5 16z" />,
  photo: (
    <>
      <path d="M3 6h18v12H3z" />
      <path d="M8 11a2 2 0 100-4 2 2 0 000 4zM3 16l5-4 4 3 4-4 5 5" />
    </>
  ),
  open: (
    <path d="M20 8H4v12h16zM2 4h20v4H2zM12 20V4M12 4c-2 0-4-1-4-2.2S10 1 12 4c2-3 4-2.2 4-1.2S14 4 12 4z" />
  ),
};

export default function Icon({
  name,
  size = 20,
  stroke = "var(--green)",
}: {
  name: string;
  size?: number;
  stroke?: string;
}) {
  const path = PATHS[name as IconName];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.7}
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
