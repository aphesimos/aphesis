# works · *opera*

Finished projects. One hash route of the site, built here as one self-contained page while the section is made,
on the `section/works` branch (cut from `site`, merged back when finished).

## The screen

- **The list** is one inscription line drawn with the brush, under the title (`works`, its gloss *opera* above it).
  Each work is a grain of stipple on the line: its name above in the text face (`label`), its gloss below in
  Aphesis Script (`gloss`), with the translation in the tooltip. Two works face each other across the middle like a
  diptych; more spread evenly along the same line. When the names no longer fit across the screen, the line turns
  and runs down it, with the names to its right. Nothing else changes as works are added.
- **Choosing a work** dissolves the line and shows the work alone: its simulacrum on one side (on a phone, above),
  and on the other its gloss and name in the display face, a short description, year and role in `meta`, links out
  over a brushed underline, and two ways on: `all works` and `next · <name>`.
- **Routes:** `#works` shows the list, `#works-<id>` one work. The browser's back button, the seal (`#home`),
  `Escape` (back to the list) and `←` `→` (previous and next work) all go through the hash.
- **Light:** the fog (density .62, light .4) and one Simulacrum canvas, reused for every work. It has no ground of
  its own (`ground: false`), stays invisible until its first frame, swaps works with a dissolve (`Simulacrum.set`),
  and rests once it has dissolved, so only the fog draws while the list is shown.
- Seal top-left, eye bottom-left, passage corner free; the runtime's cursor and tooltip. Both themes, phone width,
  keyboard reachable (each work is a link; the work's name takes focus when it opens, and the work's link gets it
  back on return). No typing animations, no pause button.

## The works

| id | where the words come from | where the map comes from |
| --- | --- | --- |
| `heild` | the heild repository's `README.md` (`main`), translated from Portuguese | the heild wordmark (HE · the I pill · LD), `design-system/logos/heild-wordmark-papel.svg` on heild's `design-system` branch |
| `aphesis` | this repository's `README.md` (`main`) and the `mark` branch README | the φ, `system/assets/Logos/phi.svg` on `design-system` |

## Adding a work

1. **Data.** Add an entry to `content/works.json`. The order of the list is the order of the file.

   ```json
   {
     "id": "lowercase-ascii-id",
     "name": "the name as shown, lowercase",
     "gloss": "a latin or greek word",
     "gloss_tip": "the gloss · its english",
     "year": "2026",
     "role": "what I did",
     "description": "40 to 90 words, lowercase, plain: what the work is, not how it was built.",
     "links": [{ "label": "the site", "href": "https://…" }, { "label": "the repository", "href": "https://…" }],
     "map": { "file": "id.png", "caption": "what the picture is · source", "settings": { "scatter": 0.55, "erosion": 0.45, "ceiling": 0.8, "gain": 1 } },
     "sources": { "description": "where the words came from", "map": "where the picture came from" },
     "flags": { "needs_owner_review": false }
   }
   ```

   `id` becomes the route (`#works-<id>`): ASCII letters, digits and hyphens. Use only what the project's own
   README says; nothing secret (no keys, env values or internal hosts), no private links. Set
   `needs_owner_review` when the source was thin or private. `sources` and `flags` stay in the data file; the page
   does not show them.
2. **Map.** Put a grayscale density map in `maps/` (white = dense, dark ground, 480 to 640px on the long side; the
   design system's README, "Density maps"). For a logo or an SVG, add it to `MAPS` in `tools/make_maps.mjs` and run
   it (`NODE_PATH=$(npm root -g) node works/tools/make_maps.mjs`; it reads every source with `git show`). For a
   screenshot or a photo: crop to the subject, black point at the 30th percentile, white at the 97.5th, gamma 0.8 to
   1.1. A project with no picture gets a symbol drawn with the brush instead (`Simulacrum.fromBrush`); none does yet.
3. **Build:** `python3 works/build.py`. It checks every entry for the required fields, a unique id and an existing
   map, and stops with a message if one is wrong.

## The content service

Built with the content service's address, the page asks it for the published works (`GET /v1/works`) before it
draws the line, waiting at most 3 s; it shows the service's works when they come and the ones in
`content/works.json` otherwise (the service down, slow or empty). A work from the service has the fields of
works.json, its map a URL served with CORS, loaded into a canvas for the simulacrum. Edits from the owner's desk are
live with no rebuild.

```sh
python3 works/build.py --content-api https://content-api.aphes.ist     # or APHESIS_CONTENT_API in the environment
```

## Files

- `build.py`: writes `index.html` (one self-contained document) or, with `--fragment OUT`, the same page without
  `<!doctype>`/`<html>`/`<head>`/`<body>`. It reads tokens, the runtime (`bundle.css`, `bundle.js`), the font and
  nothing else from `design-system` with `git show`, generates `tokens.css`, and inlines the works and their maps as
  `src/assets.js`.
- `src/`: small ES modules, concatenated in order by the build. `motion.js` (timing from the tokens, steps that a
  newer step overrules), `marks.js` (the line, the grain, the brushed underline), `theme.js` (the eye),
  `picture.js` (the one simulacrum), `inscription.js` (the list), `work.js` (one work), `content.js` (the content service's address and
  works), `main.js` (shell and routes); `template.html` and `works.css`.
- `content/works.json`: the works. `maps/`: their density maps. `tools/make_maps.mjs`: makes the maps.
- `vendor/`: Special Elite (Apache License 2.0), embedded so the page carries both faces.

## Design-system gaps found here

- **Underline.** The system says links are brush, not borders, but has no underline component; `marks.js` draws one
  with `Aphesis.brush` to the link's width. It belongs in the system.
- **List grain.** The grain that marks a work on the line (stipple disc with a brush ring) is a new mark; it should
  be reviewed and added as an icon or ornament.
- **The φ as a picture.** The seal rules forbid redrawing or recolouring the φ; a simulacrum of it, in fog colour,
  is neither a seal nor a logo use. The system should say whether that is allowed (it is used here for aphes.ist).
- **Simulacrum mist.** With `ground: false` the canvas still draws its own mist while hidden, a second fog inside the
  figure box; the page fades the canvas out after a dissolve to avoid it. An option to switch the mist off would help.
