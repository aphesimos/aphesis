aphes.ist is one document that never reloads: a stippled fog, a hand-drawn φ that travels between the center and the corner, typewriter text, and a brush script for names. These rules hold for every screen. When a screen needs something these rules do not cover, extend the system here first, then build the screen.

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
- **ear** (*auris*): the sound switch, beside the eye. Listening, three arcs of stipple arrive at the ear; muted, they disperse and fall, and one stroke crosses it. The switch is the arcs scattering and gathering; hovering stirs them.

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
- **Theme shift** (`Aphesis.themeShift`): the eye's switch. The theme is applied at once and the ground changes cell by cell as a wave from the eye over `duration-shift`, while the page stays live; text in `.aph-ink` containers is the negative of the cell beneath it until the wave has passed. Never switch the theme from the eye without it.
- **Tooltip** (`Aphesis.tooltip`): any element with `data-tip`. Never the `title` attribute.
- **Typist** (`Aphesis.Typist`): the voice of the site. Passages, chamber inscriptions, anything that should feel written now.
- **Navigation** is one document with hash routes: the seal returns home, section names sit around the center as an inscription, sections enter without a reload.

## Sound

The site has a sound: one ambient voice per screen, made in Web Audio (`Aphesis.Sound`), with no audio files. It is part of the work, like the motion.

- **On by default.** Every screen starts it at load. It creeps in under the φ while the φ draws itself, or, where the browser holds it back, from the visitor's first gesture of any kind. There is no prompt and no "enable sound". The ear in the bottom-left corner turns it off, and the choice is remembered.
- **One family.** Low sine and triangle partials in slowly beating pairs, a bed of filtered noise, sparse soft harmonics, one shared room. A screen changes the mode, root, density and texture, never the instruments. A new section gets a new voice in `VOICES`, not a new kind of sound.
- **Under attention.** The master sits around −30 dBFS RMS with peaks near −20 dBFS, through a gentle compressor and a limiter. Keep it low and soft: nothing above 4 kHz, no sharp attacks except a soft tick, no melody that asks to be followed.
- **Living, not looping.** Slow movements run at the fog's drift rate times powers of φ, so the sound never repeats. The pointer brightens and leans it a little.
- **Continuous.** The page never reloads, so a route change is a crossfade between voices (`scene`, `duration-voice`), never a restart. Moments of the visuals are heard as soft swells (`event`): a door, a picture coalescing or dissolving, a leaf turning, the eye's theme shift. Simulacra and the theme shift trigger theirs on their own.
- **Kind.** Mute and unmute fade over `duration-hush`, never a cut. A hidden page fades out and sleeps. Anything that must be heard (a track in music) ducks the ambience almost to silence.
- **Mobile.** On iPhone it plays despite the silent switch (a `playback` audio session, the owner's decision), and iOS pauses other apps' audio while it plays; the ear is the way to silence it.

## Layout

- Spacing follows Fibonacci steps of 4px: `space-1` 4 to `space-8` 136. Gutters are at least 16px plus the safe-area insets.
- No containers with borders or fills: group by space and by calm zones in the fog.
- Corners: bottom-left holds the eye and the ear, bottom-right the passage, top-left the seal (inside a section). Keep them free on every screen.
- Layers by `zIndex` tokens: fog 0, ray 1, content 2, seal 3, corners 4, inscription 5, tooltip 15, cursor 20.
- `radius-none` everywhere; `radius-disc` only for the cursor.

## Browser defaults

Everything the browser would otherwise draw in its own colours follows the system. The rules live in `components/bundle.css` (tokens only, both themes); the preview is `components/BrowserDefaults/preview.html`.

- **Selection.** `::selection` and `::target-text` (scroll-to-text) are red ink (`accent-text`) on a veil of `accent`: 16% in light, 28% in dark (`--aph-veil`), never the system blue. Selected text reads at 5.3:1 on the light veil and 4.9:1 on the dark one. The halo is dropped inside a selection. During the eye's wave, selected text in `.aph-ink` turns white ink like the rest of it (red under difference would read as cyan).
- **Scrollbars.** Chromium and Safari: an 8px scrollbar with an empty track, no buttons and no corner, and a thumb made of stipple (2px square cells in `ink-soft`, from grids whose periods never line up); hover makes it denser. Firefox: `scrollbar-width: thin` and a thumb of `ink-soft` at 55% on a clear track. The standard properties are set only where `::-webkit-scrollbar` does not exist, because Chromium drops the WebKit pseudo-elements on any element that sets `scrollbar-width` or `scrollbar-color`. So a screen must not set either property on its own scroll containers, or it loses the stipple; and it must not hide a scrollbar that people need to see where they are.
- **Caret and controls.** `caret-color` and `accent-color` are `accent` everywhere, so checkboxes, radios, ranges and progress bars are rubedo. `color-scheme` follows the theme (`light`, `dark`, switched by `data-theme`), so what the system draws (scrollbars where it still draws them, pickers, the checkbox's box) matches the ground.
- **Touch.** No tap highlight anywhere (`-webkit-tap-highlight-color: transparent`). Mark interactive marks with `.aph-mark` (or `data-aph-mark`): the seal, the eye, the experimental door, controls drawn as brush or stipple. A long press there brings no iOS callout and selects nothing. `canvas` and the ear get it on their own. Never put it on text or links: those keep select, copy and the link preview.
- **Overscroll.** `html` carries `bg`, so iOS rubber-banding and overscroll show the ground, never white. A section that scrolls inside its own container gives that container `overscroll-behavior: contain` (the archive column, the forum, the works views, the music panes and the book's leaf on a phone), so reaching its end neither scrolls the page behind it nor pulls to refresh. A full-screen gesture surface (the experimental chambers, the book's turning, a laboratory bench) takes `touch-action` for the gestures it handles and `overscroll-behavior: none` if it scrolls at all. The root keeps its default, so the page still bounces.
- **Autofill.** `:-webkit-autofill` and `:autofill` keep the ground and the ink: `-webkit-text-fill-color: var(--ink)`, an inset shadow of `bg` over the browser's tint, and a transition that never finishes. The brushed baseline sits outside the field and stays as it is.
- **Fields.** `::placeholder` is `ink-soft` and lowercase. `::file-selector-button` is a `label` in the site's voice with no box, turning `accent-text` on hover; the file name beside it is `meta`. Search fields lose the cancel cross and the magnifier. Ranges have a brushed track (an ellipse as long as the track, so both ends taper, with the ink thinning in two places) and a thumb of stipple in `accent`; a screen that draws its own slider puts a transparent native range on top, as the laboratory and music do.
- **Native elements, should they appear.** `::marker` and the `summary` marker are `ink-soft`; `dialog` has no box and its `::backdrop` is a veil of `bg`; `::cue` captions are `ink` on a veil of `bg` in Special Elite.
- **Focus.** `:focus-visible` is the red hairline everywhere. A screen may remove the outline from an element only when it draws another sign of focus (a baseline turning red, an outline on the wrapper).
- **The browser's bars.** `<meta name="theme-color">` follows the current theme's `bg` (`Aphesis.themeColor`, run by itself at load and on every theme change; during the eye's wave it changes when the wave ends). The runtime creates the meta if the page has none.

What the OS still draws itself, and how to stay clear of it:

- **Copy, paste and lookup bubbles, and the selection handles** on phones: the system's own, in its own colours. They only appear on text a person selects; leave them there, and keep them off marks with `.aph-mark`.
- **`<select>` popups, date and colour pickers, the `<datalist>` dropdown, the native validation bubble** (`required`, `type="email"`): drawn by the OS, beyond CSS (only `color-scheme` reaches them). Do not use them: build choices as a list of labels, dates as typed text, and say what is wrong in the page's own voice (`novalidate` on forms).
- **Permission prompts** (microphone, camera, motion, notifications), **`alert`, `confirm`, `prompt`**, the file chooser sheet and the share sheet: the browser's. Ask only from a gesture that already says what will happen, and never use the dialogs.
- **Scrollbars on Firefox** are a thin bar, not stipple; on iOS and on macOS with overlay scrollbars the system draws its own thin bar while scrolling, whatever the CSS says.
- **Video controls and full screen** are the browser's; a picture is a simulacrum, never a video with controls.

## Using it in a screen

Load `components/bundle.css` and `components/bundle.js` after `tokens.css`. Set `data-theme` from the system preference and the eye. Then: one `Aphesis.Fog` on a fixed full-screen canvas, `Aphesis.cursor()` and `Aphesis.tooltip()` once per document, and the screen's own marks drawn with `Aphesis.brush` and `Aphesis.stipple`.
