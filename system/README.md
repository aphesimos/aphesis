aphes.is is one document that never reloads: a stippled fog, a hand-drawn φ that travels between the center and the corner, typewriter text, and a brush script for names. These rules hold for every screen. When a screen needs something these rules do not cover, extend the system here first, then build the screen.

## Principles

- **Nothing is solid.** Every visible mark is either a **brush stroke** (`Aphesis.brush`: a centerline with a width profile, tapered ends, edges that drift on their own) or **stipple** (square cells that light up where a density field passes a fixed threshold: `Aphesis.Fog`, `Aphesis.Simulacrum`, `Aphesis.stipple`). No filled rectangles, no flat icons, no rounded cards, no gradients.
- **One hand.** The brush is measured from the φ: broad nib at 38°, thick to thin about 2.8 to 1, tapered ends. The icons, the font and the seal are all drawn by it.
- **The fog is the ground.** Content sits on calm zones in the fog, never on boxes. Text on fog carries the `aph-on-fog` halo.
- **Red is rare.** `accent` (rubedo) is for the seal, icons, focus, and moments of impact. Never for large areas or decoration.
- **Slow and human.** Things arrive and settle; typing has rhythm and mistakes; nothing bounces, nothing is instant, and the site animates for everyone.
- **Hermetic, not explained.** Sections name themselves in English with a Latin or Greek gloss. Experimental chambers carry no instructions.

## Content fundamentals

- **Language.** The site is entirely in English. The exceptions are deliberate: the glosses (*liber*, *ἄδυτον*, *codex*, *officina*, *opera*, *paries*, *ἀγορά*) and the passages, which are typed in their original language with the English translation in the tooltip.
- **Case.** Everything is lowercase, the wordmark included: `aφesis`. Names, labels, buttons and titles never use capitals. Proper nouns inside running text keep their capitals (Hermes, Michelangelo).
- **Voice.** First person singular, plain and short. Say what a thing is, not how it was built: "writing about anything, from draft to finished", not "a blog powered by markdown".
- **Labels.** One word where possible: `archive`, `forum`, `open the eye`. A control states what happens.
- **Real examples from the site.**
  - section line: `book · liber`: authors, works and what shaped me, leafed through like a codex.
  - passage: `>> Solve et coagula` (tooltip: dissolve and coagulate).
  - theme control tooltip: `open · close the eye`.
- **No emoji.** Symbols are drawn (icons) or typed as real characters (φ, ☉, ☽, ·).

## Color

One neutral scale (`n-50` to `n-975`) with a slight red bias (hue 25), so the greys belong to the seal, and one accent, `rubedo`. Use the role tokens, never the scale directly in a screen:

- `bg` is the ground (n-100 light, n-975 dark). `ink` is titles and running text (15.6:1 and 17.7:1). `ink-soft` is glosses, meta and tooltips (5.2:1 in both themes).
- `fog` colors the stipple cells, drawn at 55 to 72% over `bg`.
- `accent` and `seal` are rubedo: 6.5:1 on the light ground, 4.1:1 on the dark one. Use `accent-text` when red is text (7.1:1 and 6.1:1).
- `line` is decorative only (hairlines, the dotted ray): it reads at 1.6:1 and must never be the only sign of a control or a state.
- **Themes.** Light is "the eye open", dark is "the eye closed". Follow the system setting by default; the eye in the bottom-left corner overrides it (`data-theme` on the root). Theme changes cross-fade over `duration-theme`.
- **Focus.** A 1px solid `accent` outline, offset 4px, on everything focusable.

## Type

Two faces, no others.

- **`display` (Aphesis Script)**: the wordmark, section titles, headings and every gloss. Lowercase only. Variable: weight 300 to 800, where 400 matches the φ's stroke; slant −16 to 0 (the φ never leans). Titles, headings and glosses always lean: slant −12 (`"slnt" -12`); the φ stays upright on its own. Use weight 400 for titles, 500 for headings, up to 700 for one word of impact. Three drawings per letter rotate on their own (`calt`); leave it on. Styles: `wordmark` (110px, seal red, home only), `title` (68px; `clamp(44px, 8vw, 96px)` on the site), `heading` (42px).
- **Glosses** are Aphesis Script too: `gloss` (19px, slant −12, `ink-soft`, turning `accent-text` on hover) under each English name at home, `gloss-title` above a section title. The font (version 2.1) carries the Latin, the complete polytonic Greek (*ἄδυτον*, *ἀγορά*), 色即是空 drawn with the same brush, and the signs ¿ ¡ « » € % + =. In slanted styles keep a space between a Latin or Greek word and 色即是空: browsers do not kern across scripts. For running Greek in a slanted style, `font-feature-settings: "ss02"` gives a leaning φ; the default φ never leans.
- **`text` (Special Elite)**: everything people read and operate: `lede` 19px, `body` 16px at 1.75 and 52 to 65 characters a line, `label` 13px with 0.22em tracking (navigation, buttons), `meta` 11px with 0.14em tracking (passage, tooltips, dates). Its stack falls back to Aphesis Script, so Greek and CJK inside running text or a passage are drawn with the brush instead of a system font.
- `ss01` in Aphesis Script draws `· * # &` in the icon style (grains). Use it at 40px and up only.
- Slanted Aphesis Script leans out of its box: give any clipping container 0.2em of padding.

## The brush

- Draw every line, icon and ornament with `Aphesis.brush(points, width, seed, taper, wobble)`. Sample the centerline densely with `Aphesis.arc` and `Aphesis.line`.
- Defaults: `taper` .22, `wobble` .08. Use a larger taper (.35 to .45) for flicks and lashes, 0 only where a stroke meets another.
- Each stroke gets its own `seed`, so no two strokes share their unsure edges. Keep seeds fixed so a mark is the same on every visit.
- Widths on the 24-unit icon grid: 1.6 to 1.9 for strokes, 1.0 to 1.2 for fine marks.

## Stipple

Stipple is how areas exist. A density field (0 to 1) is compared, cell by cell, against a fixed threshold; where it passes, a square cell lights in `fog` (or a few in `accent`).

- **Fog** (`Aphesis.Fog`): the ground of every screen. Density 1 at home, .62 inside a section; pointer light 1 at home, .4 inside. Register every text block as a calm zone (`fog.zones([...])`, up to 12), padded 10 to 20px.
- **Icon fill** (`Aphesis.stipple`): small squares inside a region on the 24-unit grid, size .42 to .95, a few hundred to 1,600 tries.
- **Cells** are 2 CSS pixels and always square. Never antialias them, never round them.

## Simulacra: pictures made of fog

`Aphesis.Simulacrum` turns an image into stipple that coalesces out of the fog and dissolves back into it. Use it for the experimental chambers, section openings, and anywhere a picture would otherwise appear. Never show a photograph or a raster image as itself.

- **Never picture-perfect.** A simulacrum always keeps lost points: some of the picture drifts loose around the figure (`scatter`, default .5), fog-shaped holes open inside it (`erosion`, .45), and no area ever fills completely (`ceiling`, .8). A crisp silhouette with an empty ground around it reads as a print, not as something conjured; if a render looks finished, raise scatter and erosion.
- **Choose by the ground, not the subject.** What works is a large, modelled, lit mass on a ground that is already dark: chiaroscuro painting (Caravaggio, Rembrandt, La Tour, Wright of Derby), inlaid pavements (Siena), engravings with big light (Flammarion, Doré). What fails: thin line art, even hatching (Khunrath), flat manuscript colour (most ouroboroi), and figures on mid-grey or busy grounds.
- **Sculpture** on a plain ground arrives already isolated: give it `erosion` .5, `scatter` .85, `ceiling` .76, or it looks cut out.
- **Ouroboros.** The serpent works as a detail inside a dark painting (Cagnacci's *Allegory of Human Life*), not as a flat manuscript ring.
- **Any source** is fine: the simulacrum is a recreation. Caption every one with work, artist and date: `saint jerome writing · Caravaggio, 1605–06`.
- **Density maps.** Grayscale, 480 to 640px on the long side, white = dense; JPEG is fine. Crop to the figure and lose frames and borders. Levels: black point at the 30th percentile, white at the 97.5th, gamma 0.8 for dark paintings (lifts the half-tones), 1.1 for pavements, about 2 for white marble. Engravings: blur 1 to 2px first so hatching becomes tone. Paintings on light plaster (the Creation of Adam) keep only the warm skin and drapery.
- **Drawn sources.** `Simulacrum.fromBrush` makes a density map from brush strokes, for symbols no picture holds.
- **Motion.** Coalesce over 2.6s, dissolve over 1.8s, swap with a dissolve first. The lost points drift with the fog; the pointer brings nearby cells forward. Keep `accent` at .05 or less: a few red cells, never a red picture.
- **Captions** sit in a corner in `meta`, with the halo, never over the picture's center.

## Icons

Brush strokes in `accent` with stipple fill, on a 24-unit grid, drawn at 28 to 64px. Each has two states where it means something:

- **eye** (*oculus*): the theme switch. Open with a stippled iris in light; closed, one lid and three lashes, in dark. The switch is a blink.
- **sol · luna**: the alchemical sun and moon.
- **terminator** (*linea lucis*): a ring with one half stippled; the lit half follows the theme.
- **threshold** (*limen*): an arched doorway, empty when open, filled with stippled night when closed. Use it for entering a chamber.

Render them with `Aphesis.icon(name, state)`; the SVG files under assets are for places that cannot run the script, in the light-theme rubedo `#ab0d19`.

## The seal

The φ is the only logo. It is always `seal` red, with a boil that reseeds 8 times a second (`Aphesis.seal`). At home it is drawn live at the center; entering a section it closes into Φ and travels to the top-left corner (64px), where it leads home. The live drawing engine lives on the `mark` branch. Never redraw, outline, recolor or set the φ in a font other than Aphesis Script.

## Motion

- Anything that travels uses minimum-jerk easing (`Aphesis.MJ`): the seal in 1.6 to 1.8s, a simulacrum in 2.6s.
- CSS transitions use `easing-settle` with `duration-quick` (tooltip), `duration-slow` (letter wave), `duration-theme`, `duration-scene` (sections enter with a blur of 10px and a rise of 14px).
- Text hovers are small and kind: letters lift 2px one after another (`Aphesis.letters` with `.aph-wave`); a gloss turns `accent-text`. Nothing changes size or pushes its neighbours.
- The site always animates. It does not follow the system's reduce-motion setting and has no pause control: the motion is part of the work (the owner's decision). Do not add `prefers-reduced-motion` rules.
- Performance: stipple renders at one canvas pixel per cell (the runtime does this). Keep a screen to the fog plus at most two simulacra running at once; stop a simulacrum's canvas when it is hidden.

## Interaction

- **Cursor** (`Aphesis.cursor`): a disc in difference blend, the negative of what it covers. 0.2 at rest, 1 over links and buttons, `data-cursor=".55"` for small controls, tightening on press. Fine pointers only. It is the only cursor: the system cursor is hidden everywhere while it runs.
- **Tooltip** (`Aphesis.tooltip`): any element with `data-tip`. Never the `title` attribute.
- **Typist** (`Aphesis.Typist`): the voice of the site. Passages, chamber inscriptions, anything that should feel written now.
- **Navigation** is one document with hash routes: the seal returns home, section names sit around the center as an inscription, sections enter without a reload.

## Layout

- Spacing follows Fibonacci steps of 4px: `space-1` 4 to `space-8` 136. Gutters are at least 16px plus the safe-area insets.
- No containers with borders or fills: group by space and by calm zones in the fog.
- Corners: bottom-left holds the eye, bottom-right the passage, top-left the seal (inside a section). Keep them free on every screen.
- Layers by `zIndex` tokens: fog 0, ray 1, content 2, seal 3, corners 4, inscription 5, tooltip 15, cursor 20.
- `radius-none` everywhere; `radius-disc` only for the cursor.

## Using it in a screen

Load `components/bundle.css` and `components/bundle.js` after `tokens.css`. Set `data-theme` from the system preference and the eye. Then: one `Aphesis.Fog` on a fixed full-screen canvas, `Aphesis.cursor()` and `Aphesis.tooltip()` once per document, and the screen's own marks drawn with `Aphesis.brush` and `Aphesis.stipple`.
