# book · *liber*

The authors, works and ideas that shaped me, leafed through like a codex.

One entry at a time, as a spread. The picture page holds a simulacrum of the work (on the left; above, in portrait),
with its caption in the plate's corner. The text page holds the title in Aphesis Script, the author and year in meta,
a short note, and at most one quote in its own language, with the English in the tooltip.

- **Turning the leaf:** the page edges (a click on the brush mark at the left or right edge), the arrow keys or
  Page Up / Page Down, or a swipe sideways on a touch screen. The turn is a dissolve: the picture goes back into the
  fog while the next one gathers out of it. The text leaves with a quick fade and enters with the system's soft
  entrance; nothing is typed out. The codex has a first and a last leaf: the edge fades out at either end.
- **The contents:** `contents · index` under the text page, an inscription like the home's. It replaces the note
  with the list of entries; choosing one turns to it. Escape or the same control closes it.
- **Links:** each leaf has its own address, `#book/<slug>`, so a leaf can be linked to.
- **Weight:** the fog plus two Simulacrum canvases, made once and reused. A canvas becomes visible only after its
  first frame and is stopped once its picture has dissolved.

## Files

- `content/*.md`: the entries, one markdown file each, read in file-name order.
- `src/template.html`, `src/book.css`: the page and its layout.
- `src/main.js`: theme, fog, seal, cursor, tooltip, routing; `src/plate.js`: the two picture canvases;
  `src/leaf.js`: the text page and the contents; `src/turning.js`: edges, keys and swipe;
  `src/motion.js`, `src/numerals.js`: small helpers.
- `build.py`: reads the tokens, runtime, font and density maps from the `design-system` branch with `git show`,
  generates `tokens.css`, and writes `index.html`, one self-contained page.
  `python3 book/build.py --fragment OUT` writes the same page without `<html>`/`<head>`/`<body>`.
- `vendor/`: Special Elite (Apache License 2.0), which the design system loads from Google Fonts.

## Adding an entry

Add a file to `content/`, named with a number for its place in the codex and a slug for its address,
e.g. `07-the-alchemist.md`, then run `python3 book/build.py`.

```markdown
---
title: the alchemist
author: Joseph Wright of Derby
year: 1771
map: alchemist.jpg
caption: the alchemist · Joseph Wright of Derby, 1771
quote: Solve et coagula
quote_lang: la
quote_en: dissolve and coagulate.
---
The note: 60 to 200 words, plain paragraphs separated by a blank line.
```

- `title` is lowercase (Aphesis Script has no capitals). `author` and `year` are free text in meta; proper nouns keep
  their capitals.
- `map` names a density map in `design-system:system/assets/Simulacra/`. A picture that is not there yet is prepared
  and added on the design-system branch first (grayscale, white = dense, 480 to 640px; see its README).
- `caption` names what the picture shows: work · artist, date. It may differ from the entry when the picture is of a
  related work (the Emerald Tablet is shown by Hermes Trismegistus in the Siena pavement).
- `quote`, `quote_lang` and `quote_en` are optional. `quote_en` is the English in the tooltip; for a quote already in
  English, use it for the source.
- `gain`, `scatter`, `erosion` and `ceiling` are optional per-picture settings for the simulacrum
  (sculpture on a plain ground: `erosion: .5`, `scatter: .85`, `ceiling: .76`).
- `crop` (`x y width height`, in map pixels), `blur` (px), `brightness` and `contrast` (CSS filter factors) are
  optional: they cut a frame the map still carries, soften hatching into tone and lift a lit mass out of even line
  work, in the browser, without touching the map (the Flammarion engraving uses all four).
- The build stops on a missing field or an unknown map, and warns when a note is outside 60 to 200 words.

## The six example entries

The six entries in `content/` are **examples** (`example: true`), chosen from the site's hermetic canon because
their density maps already exist: the Emerald Tablet, Dante's Paradiso, Blake's Newton, Rembrandt's Faust,
Caravaggio's Saint Jerome and the Flammarion engraving. Their notes are factual descriptions, not my own words about
them. Replace them with the real reading list and delete the `example` lines.
