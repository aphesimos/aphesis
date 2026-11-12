The icon set as files, for places that cannot run the script. Ink: rubedo `#ab0d19` (the light-theme accent). In a screen, draw them with `Aphesis.icon(name, state)` so they take `currentColor` and follow the theme.

The section icons come in two files each: `book.svg` at rest and `book-chosen.svg` with its stipple gathered, and the same for `descent`, `archive`, `laboratory`, `works`, `wall`, `forum` and `music`.

The project icons follow the same pattern: `contraprova`, `heuresis`, `anamnesis` and `autopoiesis`, each at rest and chosen. They come from `python3 tools/readme/readme.py static system/assets/Icons`.

`animated/` holds the icons that move without the script, for READMEs: `<name>-dark.svg` and `<name>-light.svg` for each section and project, transparent, in each theme's accent, with the stir (the forum: its eyes' film) always running and still under `prefers-reduced-motion`. Use them in a `<picture>` so GitHub picks the one for the viewer's theme; `tools/readme/README.md` shows how. They come from `python3 tools/readme/readme.py icons system/assets/Icons/animated`.
