# font

**Aphesis Script**, the authorial display face of aphes.is: lowercase only, generated from the φ's brush
(broad nib at 38°, thick/thin ≈ 2.8, tapered ends, hand-moved edges). Variable axes: `wght` 300–800
(400 = the φ's own stroke) and `slnt` −16…0. The φ is the original drawing and never leans.

- `src/build_font.py`: builds the variable font from brush skeletons with fontTools (compatible masters, fixed points per stroke).
- `src/glyphs.py`: shared helpers (Catmull-Rom, edge noise, metrics).
- `build/`: the current variable font (TTF, WOFF2).
- `tester/index.html`: the variable font tester.

**Status:** this is the first sample (a p h e s i φ). A full redesign is in progress: complete lowercase family,
figures, punctuation and accents, alternates, a measured spacing system and kerning, with every mark drawn by the
brush. It will replace these files.
