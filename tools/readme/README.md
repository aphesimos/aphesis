# readme kit

Animated README images in the design system: a header with a project's icon beside its title, project cards, the
icons and the φ on their own, and the pseudo-home ring of the owner's profile. Every image is a self-contained SVG that
GitHub can show:

- **No scripts, no outside files.** GitHub shows a README's SVG as an image, through its camo proxy. CSS and SMIL
  animation run there; scripts, external fonts and links inside the image do not. So the fonts are embedded as subsets
  (only the glyphs the image uses, base64 woff2), and all motion is CSS keyframes.
- **Two themes.** Each image comes as `<name>-dark.svg` and `<name>-light.svg`. A `<picture>` element picks between
  them, and GitHub resolves it to the viewer's GitHub theme, which a media query inside the SVG cannot see. The
  ground is transparent, so the stipple and the type sit on GitHub's own ground.
- **Reduced motion.** `@media (prefers-reduced-motion: reduce)` stills everything: the line shows whole, the caret
  stays, the φ and the icons rest.
- **The house style.** Colours come from `system/tokens.json`: `ink`, `ink-soft`, `fog` at 55 to 72%, and `accent`
  or `seal` for the red. The φ and the icons are those of `Aphesis.icon` and `Aphesis.seal`, run from
  `system/components/bundle.js`. Titles and glosses are set in Aphesis Script (slant −12) and lines in Special Elite.
  Everything is lowercase, and nothing is solid.

## Requirements

Python 3.9+ with `fonttools` and `brotli` (`pip install fonttools brotli`), and Node 18+ (`icons.mjs` loads the
runtime to draw the icons). Nothing is downloaded: fonts, tokens and the φ come from this branch.

## A project's README header

From the project's repository:

```sh
git clone --depth 1 --branch design-system https://github.com/aphesist/aphesis ../aphesis-ds
pip install fonttools brotli
python3 ../aphesis-ds/tools/readme/readme.py header assets/readme \
  --icon anamnesis --title anamnesis --gloss ἀνάμνησις \
  --line "a local-first second brain that measures itself." \
  --href https://anamnesis.aphes.ist/
```

This writes `assets/readme/header-dark.svg` and `header-light.svg` (840 × 200) and prints the Markdown to put at the
top of the README:

```html
<a href="https://anamnesis.aphes.ist/"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/readme/header-dark.svg"><img src="assets/readme/header-light.svg" alt="anamnesis: a local-first second brain that measures itself." width="100%"></picture></a>
```

Commit the two SVGs with the README. The header shows the project's icon on the left, stirring, with the title in
Aphesis Script and its gloss beside it, the line underneath, and fog around, kept clear behind the words.

- `--typed` types and erases the line with the site's typist: uneven rhythm, a red block caret, and an erase that
  speeds up.
- `--typo word:offset:key` adds one typo, noticed and fixed.
- `--phi` puts the boiling φ in place of the icon. Use it for the owner's own profile only: the φ is the site's mark,
  not a project's.

Options: `--width`, `--height`, `--icon-size`, `--name` (the file name), `--prefix` (the path the README uses for the
output folder, if it is not the folder as given) and `--seed` (the fog).

Icon names are the sections (`book`, `descent`, `archive`, `laboratory`, `works`, `wall`, `forum`, `music`) and the
projects (`contraprova`, `heuresis`, `anamnesis`, `autopoiesis`, `parataxis`). A new project gets its icon in
`tools/bundle_src.js` first, under "PROJECT ICONS", drawn the same way, and is added to `PROJECTS`. Then rebuild
`system/components/bundle.js` (below).

## The README standard

What goes around the header, in what order, and in what voice is the README standard:
`system/page-types/readme/README.md`, with a template for a product (`template-product.md`) and one for a study
(`template-study.md`). In short: the header first, linking the project's page; a line that says what the project is,
never a tagline; lowercase; no badges; the honesty table where there are claims; every picture dark and light; the
licence last.

**When an image changes, give it a new name** (`--name header-2`, then delete the old pair): GitHub's image proxy
caches by path, so a redrawn SVG under the same name keeps showing the old one.

## The other images

```sh
readme.py card   OUT --title contraprova --gloss "probatio contraria" --icon contraprova \
                     --line "on 88 fresh swe-bench pro tasks, on par with a single opus" \
                     --line2 "at ~61% less cost per solved task." --number 61% --number-meta "less cost per solved task" \
                     --href https://contraprova.aphes.ist/
readme.py icons  OUT [name ...]      # each icon alone, 64px, stirring: OUT/<name>-{dark,light}.svg
readme.py phi    OUT [--height 160]  # the φ, boiling
readme.py ring   OUT --item book=https://aphes.ist/#book ... [--names]
readme.py static OUT [name ...]      # the still icon files of system/assets/Icons
```

**Cards** (660 × 132) stack one per line. Each is its own `<a>`, because a link inside an SVG does nothing on GitHub.

**`ring`** builds the owner's pseudo-home: the φ in the middle and eight icons on a circle, each its own link, given
clockwise from the top.
- GitHub strips positioning CSS and image maps, so the ring is a mosaic: seven centred rows of images inside one
  `<p align="center">`, with no whitespace between the images of a row.
- Widths are percentages that sum to 100% per row, so a phone shrinks the circle instead of wrapping it.
- `align="top"` closes the gap under each row.
- The pieces between the icons carry their patch of one fog field, so the rows join into one fog.
- `--names` adds a tiny name beside each icon, on its outer side.
- The command prints the whole `<p>`.

## Already published

These need no build; link them, or copy them into the repository:

- `system/assets/Icons/animated/<name>-{dark,light}.svg`: every section and project icon (64px, stirring).
- `system/assets/Logos/phi-boil-{dark,light}.svg`: the φ, boiling.

```html
<picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/aphesist/aphesis/design-system/system/assets/Icons/animated/heuresis-dark.svg"><img src="https://raw.githubusercontent.com/aphesist/aphesis/design-system/system/assets/Icons/animated/heuresis-light.svg" alt="heuresis" width="48"></picture>
```

## Checking an image

Open the SVG, or a page with it in an `<img>` at about 830px wide (GitHub's README width), in a browser. To look at
one moment, add this rule to the SVG's `<style>`:

```css
*{animation-delay:-3s!important;animation-play-state:paused!important}
```

Every animation starts at 0, so this freezes the image at 3 s. It is exact for the type, the caret, the icons and the φ. The fog's eight groups carry their phases as negative delays, so the rule puts them all in step: judge the fog live, where its cells should visibly come and go with no moment where the whole field jumps.

## Rebuilding the runtime

`system/components/bundle.js` is `tools/bundle_src.js` with `__PHI_D__` replaced by the path of the φ:
`system/assets/Logos/phi.svg`, which is `art/phi.svg` on `mark`. The two files differ in nothing else.

```sh
python3 - <<'PY'
import re
src = open('tools/bundle_src.js').read()
d = re.search(r' d="([^"]+)"', open('system/assets/Logos/phi.svg').read()).group(1)
open('system/components/bundle.js', 'w').write(src.replace('__PHI_D__', d))
PY
```

## Licences

- **Special Elite:** Apache 2.0, © 2010 Astigmatic.
- **Aphesis Script:** SIL OFL 1.1, with the Reserved Font Name "Aphesis Script".

Both are embedded as subsets, which keep the fonts' copyright and licence records. Each SVG also carries a comment
naming both licences.

The φ mark and the wordmark `aφesis` are trademarks of aphesist and are not covered by either licence (see
`TRADEMARKS.md`). Projects show their own icon, not the φ.
