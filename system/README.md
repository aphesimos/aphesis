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
- **The clearing.** A section sets `clear` 1: the fog drifts out of the content's column to the sides and leaves only a sparse residue behind the text and pictures, still moving. The home keeps `clear` 0, and the fog flows back when it returns. A section whose subject is the fog itself may keep some (the descent: .4). The fog eases every change of `clear` on its own (minimum jerk, 1.8s); never snap it.
- **Icon fill** (`Aphesis.stipple`): small squares inside a region on the 24-unit grid, size .42 to .95, a few hundred to 1,600 tries.
- **Cells** are 2 CSS pixels and always square. Never antialias them, never round them.

## Simulacra: pictures made of fog

`Aphesis.Simulacrum` turns an image into stipple that coalesces out of the fog and dissolves back into it. Use it for the experimental chambers, section openings, and anywhere a picture would otherwise appear. Never show a photograph or a raster image as itself.

- **Informational pictures** (covers, user uploads) use the legible preset (`{legible: true}`, `Aphesis.Simulacrum.LEGIBLE`): readable at a glance, still stipple. On a 1x screen its 1.25px cell rounds up to 2px (`LEGIBLE.up1x`), so the stipple stays visible there as on 2x and 3x screens; hermetic pictures round to the nearest. Hermetic simulacra keep lost points and erosion, as below.
- **Never picture-perfect.** A simulacrum always keeps lost points: some of the picture drifts loose around the figure (`scatter`, default .5), fog-shaped holes open inside it (`erosion`, .45), and no area ever fills completely (`ceiling`, .8). A crisp silhouette with an empty ground around it reads as a print, not as something conjured; if a render looks finished, raise scatter and erosion.
- **Choose by the ground, not the subject.** What works is a large, modelled, lit mass on a ground that is already dark: chiaroscuro painting (Caravaggio, Rembrandt, La Tour, Wright of Derby), inlaid pavements (Siena), engravings with big light (Flammarion, Doré). What fails: thin line art, even hatching (Khunrath), flat manuscript colour (most ouroboroi), and figures on mid-grey or busy grounds.
- **Sculpture** on a plain ground arrives already isolated: give it `erosion` .5, `scatter` .85, `ceiling` .76, or it looks cut out.
- **Ouroboros.** The serpent works as a detail inside a dark painting (Cagnacci's *Allegory of Human Life*), not as a flat manuscript ring.
- **Any source** is fine: the simulacrum is a recreation. Caption every one with work, artist and date: `saint jerome writing · Caravaggio, 1605–06`.
- **Density maps.** Grayscale, 480 to 640px on the long side, white = dense; JPEG is fine. Crop to the figure and lose frames and borders. Levels: black point at the 30th percentile, white at the 97.5th, gamma 0.8 for dark paintings (lifts the half-tones), 1.1 for pavements, about 2 for white marble. Engravings: blur 1 to 2px first so hatching becomes tone. Paintings on light plaster (the Creation of Adam) keep only the warm skin and drapery.
- **Drawn sources.** `Simulacrum.fromBrush` makes a density map from brush strokes, for symbols no picture holds.
- **Blur in a 2D canvas.** Safari's 2D canvas has no `filter`. Where a screen blurs a map with `ctx.filter`, it keeps the filter when `Aphesis.canFilter(ctx)` is true and otherwise calls `Aphesis.blur2d(ctx, sigma)` (a box blur of the same radius); the Simulacrum's own glow does the same.
- **Motion.** Coalesce over 2.6s, dissolve over 1.8s, swap with a dissolve first. The lost points drift with the fog; the pointer brings nearby cells forward. Keep `accent` at .05 or less: a few red cells, never a red picture.
- **Captions** sit in a corner in `meta`, with the halo, never over the picture's center.

## Icons

Brush strokes in `accent` with stipple fill, on a 24-unit grid, drawn at 28 to 64px. Each has two states where it means something:

- **eye** (*oculus*): the theme switch. Open with a stippled iris in light; closed, one lid and three lashes, in dark. The switch is a blink.
- **sol · luna**: the alchemical sun and moon.
- **terminator** (*linea lucis*): a ring with one half stippled; the lit half follows the theme.
- **threshold** (*limen*): an arched doorway, empty when open, filled with stippled night when closed. Use it for entering a chamber.
- **ear** (*auris*): the sound switch, beside the eye. Listening, three arcs of stipple arrive at the ear; muted, they disperse and fall, and one stroke crosses it. The switch is the arcs scattering and gathering; hovering stirs them.

- **sections**: one mark per section, drawn as an emblem book would engrave them, for where the names would crowd (the home's inscription on a phone, floating as the names do: the first tap shows the name, the second enters). `book` (*liber*): a closed grimoire with two clasps and an eight-rayed star in stipple on its cover. `descent` (*κατάβασις*): the threshold's arch with steps going down into stippled night. `archive` (*codex*): a pile of leaves, the top one written on. `laboratory` (*officina*): a flask with matter settled in it and two bubbles. `works` (*opera*): a pair of compasses and the stippled arc they drew. `wall` (*paries*): courses of stone. `forum` (*ἀγορά*): three eyes, the gate's eye simplified, one larger above two smaller, each looking its own way: many voices, watching. On hover each eye blinks and glances on its own rhythm, at 8 fps in hard cuts, as the gate's eye does; gathering, they close and open together on the centre. `music` (*phonotheca*): Apollo's lyre, its strings in stipple, so they tremble on hover. At rest (0) and chosen (1, the stipple gathered toward the mark's heart); inside an `.aph-icon` control, hover and focus stir the stipple and `.aph-gather` gathers it in motion. Draw them at 32 to 40px.

Drawn large and alive, the eye is a component of its own: `Aphesis.Eye(el, opts)` draws itself in, trembles at 8 fps, blinks in hard cuts between discrete drawings and looks around in saccades (`components/Eye`). Small, in rubedo, it is the owner's mark beside the owner's posts on the forum and the wall, in place of a sigil; those eyes are `shared`: one tick for all of them, still while off screen.

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
- **Theme shift** (`Aphesis.themeShift`): the eye's switch. The theme is applied at once and the ground changes cell by cell as a wave from the eye over `duration-shift`, while the page stays live; text in `.aph-ink` containers is the negative of the cell beneath it until the wave has passed, and each red mark (`.aph-red`) turns to the new theme's red when the wave reaches it. What is not marked the runtime reads at the click: ink that reaches the fog blends the same way, and what cannot (an unmarked red, ink in a layer of its own) turns where it stands as the wave reaches it (`.aph-turn`). Never switch the theme from the eye without it.
- **Tooltip** (`Aphesis.tooltip`): any element with `data-tip`. Never the `title` attribute.
- **Scrollbar** (`Aphesis.Scroll`): no native bar anywhere; a red disturbance in the stipple along the right edge of whatever scrolls, only while it scrolls or the pointer is at that edge. It runs by itself (see "Browser defaults").
- **Masked text** (`Aphesis.grain`, `Aphesis.grains`, `.aph-grains`): every secret field (a password, the gate's words while hidden) shows one round grain of stipple per character, the i-th grain always the same (`components/Grain`). 14 px with a 4 px gap, in `ink` (`currentColor`), centred or left as the line is; where a line must hold more characters, shrink both through `--grain-size` and `--grain-gap`, never to squares or bullets. The caret (the typewriter's underscore, in `accent`) follows the last grain. The grains are `aria-hidden`; the real `<input>` stays under them, transparent, for screen readers, autofill and password managers.
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
- Layers by `zIndex` tokens: fog 0, ray 1, content 2, the scroll disturbance 2 (drawn after the content), seal 3, corners 4, inscription 5, tooltip 15, cursor 20.
- `radius-none` everywhere; `radius-disc` only for the cursor.

## Browser defaults

Everything the browser would otherwise draw by itself follows the system: in the tokens, in both themes, as brush or stipple, never a solid box in the system's colours. The rules live in `components/bundle.css`; the scrollbar is a runtime component (`components/Scroll`). The preview is `components/BrowserDefaults/preview.html`.

How the rules are built, and what that asks of a screen:

- Most rules are wrapped in `:where()` and weigh nothing, so a screen's own rule always wins where it draws something better (the gate's line, the music search). `:disabled` has ordinary weight, so it wins over a control's colour at rest; a screen's own `:disabled` rule still wins. The rules a screen must never undo carry `!important`: the hidden scrollbars.
- A screen adds only what is specific to it. It never restyles a component below in its own way, never sets a property this section says it must not, and never repeats a rule the bundle already has.
- "Chromium" means Chrome, Edge, Opera and Samsung Internet; "Safari" is macOS and iOS (every iOS browser is Safari).

### Scrollbars

- **Looks like.** Nothing at rest. While an element scrolls, or while a fine pointer is within 24px of its right edge, a red disturbance gathers in the stipple along that edge where the thumb would be: 2px accent cells on the fog's grid, in a band 12px wide, its length the visible share of the content and its place the scroll offset, feathered at both ends and thinning away from the edge, never a solid shape. It trembles at 8 fps, grows denser while the element moves, and fades back into the fog a second after the scrolling stops (minimum jerk in and out). Same in both themes, in the current `accent`.
- **Rule.** The browser's bars are hidden on every element (`scrollbar-width: none` and `::-webkit-scrollbar { display: none }`, both `!important`). `Aphesis.Scroll` draws the disturbance on one fixed canvas (`z-scroll`) and finds every scroller by itself, the document included. States: rest (nothing), scrolling (the patch, denser with speed), near the edge (the patch, still), dragging (the patch follows the pointer), fading. With a fine pointer the 14px along the edge drag it, and a press above or below it pages; on touch it shows only while scrolling. Scrolling itself is native: wheel, trackpad, keys, touch, find in page, screen readers.
- **Browsers.** Hidden bars: Chromium 121+ and Firefox through `scrollbar-width`, Safari through `::-webkit-scrollbar` (and `scrollbar-width` from 18.2). The disturbance runs wherever canvas 2D does. Without the runtime, there is simply no bar.
- **A screen must not** set `scrollbar-width`, `scrollbar-color`, `scrollbar-gutter` or any `::-webkit-scrollbar` style, draw a scrollbar of its own, or hide overflow that people need to scroll to: `Aphesis.Scroll` finds a scroller by its `overflow-y: auto | scroll`. Nothing is reserved for a bar, so no layout shifts when content grows past the screen.
- **Overscroll.** `html` carries `bg`, so iOS rubber-banding and overscroll show the ground, never white. A section that scrolls inside its own container gives that container `overscroll-behavior: contain` (the archive column, the forum, the works views, the music panes, the desk and its preview, the book's leaf on a phone), so reaching its end neither scrolls the page behind it nor pulls to refresh. A full-screen gesture surface (the descent's chambers, the book's turning, a laboratory bench) takes `touch-action` for the gestures it handles and `overscroll-behavior: none` if it scrolls at all. The root keeps its default, so the page still bounces.

### Selection

- **Looks like.** Red ink (`accent-text`) on a veil of `accent`: 16% in light, 28% in dark (`--aph-veil`), never the system blue. Selected text reads at 5.3:1 on the light veil and 4.9:1 on the dark one. The halo (`text-shadow`) is dropped inside a selection. `::target-text` (a link to a passage, "scroll to text") reads the same.
- **Rule.** `::selection` and `::target-text` in `bundle.css`, with `-webkit-text-fill-color` so filled text follows. During the eye's wave, selected text in `.aph-ink` turns white ink like the rest of it (red under difference would read as cyan). Canvases and drawn marks take no veil. Marks (`.aph-mark`) cannot be selected at all.
- **Browsers.** All. `::target-text`: Chromium 89+, Safari 18.2+; elsewhere the browser's yellow.
- **A screen must not** colour its own selection, solid or not; a field that draws its words elsewhere (the gate's line, a mirror) may make its input's selection transparent.

### Caret

- **Looks like.** `accent` in both themes. The typist's caret (`.aph-caret`, a block in `currentColor`) is the site's own and is not the text caret.
- **Rule.** `caret-color: var(--accent)` on the root and on every field and `[contenteditable]`. A field that draws its own caret (the gate) sets `caret-color: transparent`.
- **Browsers.** All. Its shape and blink are the OS's.

### Focus

- **Looks like.** A 1px `accent` hairline, offset 4px, for the keyboard only; nothing for a mouse or a tap.
- **Rule.** `:focus-visible` draws it; `:focus:not(:focus-visible)` removes the outline. A screen may remove the outline from an element only when it draws another sign of focus: a baseline turning red (fields), an outline on the wrapper (`:focus-within`), a label turning `accent-text`.
- **Browsers.** All current ones; the heuristic (keyboard or not) is the browser's.
- **A screen must not** write `:focus { outline: none }` without a replacement, or move focus with no visible sign of where it went.

### Buttons

- **Looks like.** Words in `label`: no bevel, no fill, no border, no system font. Hover and focus draw a brushed underline or turn the label `accent-text`; a pressed control shows its result, not a pressed box.
- **Rule.** `:where(button)` drops the appearance, background and border and takes the font and colour of its context. Disabled: `ink-soft`, the plain arrow, no underline; never greyed out by the browser or dimmed by iOS.
- **Browsers.** All.

### Fields: inputs, textareas, placeholders

- **Looks like.** Words in `body` on a brushed baseline drawn by the screen (`ink-soft` at rest, `accent` while focused); no box, no fill, no border, no rounded corners. The placeholder is `ink-soft`, lowercase. Disabled: `ink-soft`, never iOS's dimming. A textarea that may be resized has a grip of a few cells of `ink-soft` stipple in its corner.
- **Rule.** `:where(input, textarea, select)` drops the appearance, background and border and inherits font and colour. `::placeholder` is `ink-soft` at full opacity. Forms carry `novalidate`, and what is wrong is said in the page's own voice. Fields at least 16px, so iOS does not zoom in on focus.
- **Browsers.** All; the grip (`::-webkit-resizer`) is Chromium and Safari only, Firefox draws its own.
- **A screen must not** give a field a box, a fill or a border, or rely on the browser's validation bubble.

### Autofill

- **Looks like.** The ground and the ink stay as they are: no yellow or blue tint, no change of font.
- **Rule.** `:-webkit-autofill` and `:autofill` take `-webkit-text-fill-color: var(--ink)`, an inset shadow of `bg` over the browser's tint, and a transition that never finishes; all in `:where()`, so a field that hides its own words (the gate's line) keeps them hidden.
- **Browsers.** Chromium and Safari (`:-webkit-autofill`), Firefox (`:autofill`).
- **The OS draws** the autofill dropdown and the password manager's sheet; they cannot be styled. Ask for autofill only where it helps (`autocomplete="current-password"` at the gate, `off` elsewhere).

### Spelling marks

- **Looks like.** A dotted line of `accent` under a misspelled word (`ink-soft` for grammar): stipple instead of the system's wavy red.
- **Rule.** `::spelling-error` and `::grammar-error`. Spellcheck is on only in fields of prose (the desk's titles, summaries and bodies); names, slugs, addresses, the wall and the gate set `spellcheck="false"`.
- **Browsers.** Chromium 121+. Safari and Firefox draw the OS's red squiggle; keep spellcheck off where it is not wanted.

### Checkboxes, radios, ranges, progress

- **Looks like.** A checkbox or radio is a square (a circle for the radio) of sparse `ink-soft` stipple, filled with dense `accent` stipple when chosen. A range is a brushed track in `ink-soft` (an ellipse as long as the track, so both ends taper, with the ink thinning in two places) and a thumb of `accent` stipple. Progress and meter are an empty track with a value of `accent` stipple. Disabled: the same at 45%.
- **Rule.** All drawn by `bundle.css` with `appearance: none`; `accent-color` is `accent` everywhere as a fallback for anything still drawn by the system. The site itself chooses with labels (`role="radio"`, `role="switch"` buttons in the site's voice), and a screen that draws its own slider lays a transparent native range on top (the laboratory, music).
- **Browsers.** Chromium, Safari and Firefox for all of them.

### File inputs

- **Looks like.** The button is a `label` in the site's voice with no box, turning `accent-text` on hover; the file name beside it is `meta` in `ink-soft`.
- **Rule.** `::file-selector-button`. A screen may hide the input under its own label (the desk's "choose a picture") and keep it focusable.
- **The OS draws** the file chooser sheet; open it only from a control that says so.

### Search and number fields, dates

- **Looks like.** A line of text like any other: no cancel cross, no magnifier, no spinners, no picker arrow.
- **Rule.** The WebKit search decorations, number spin buttons and calendar indicator are hidden; Firefox's number field is a `textfield`. Dates are typed as text (`yyyy-mm-dd`), checked by the page.
- **A screen must not** use `type="date"`, `type="time"`, `type="color"`, `<select>` or `<datalist>`: their pickers are the OS's (below).

### Markers, details, dialogs, captions

- **Looks like.** List markers in `ink-soft`. A `summary` has no triangle: a grain of `accent` (`·`) marks it. A `dialog` has no box, and its `::backdrop` is a veil of `bg` at 78% with a slight blur. `::cue` captions are `ink` on a veil of `bg` in Special Elite.
- **Rule.** In `bundle.css`; the site uses none of these today, so they are ready rather than seen. A modal dialog (`showModal()`) and its backdrop live in the top layer, above the site's cursor: while one is open, move `.aph-cursor` into it, as the preview does, or the pointer disappears. Close it with Escape and a labelled control; never use `alert`, `confirm` or `prompt`.

### Tooltips

- **Looks like.** The site's tooltip (`Aphesis.tooltip`, any element with `data-tip`): typed in `meta`, beside the pointer.
- **A screen must not** use the `title` attribute, or `<title>` inside an inline SVG: both show the browser's tooltip. Name icons with `aria-label` and give them `data-tip`.

### Touch: tap highlight, callout, drag

- **Looks like.** No grey flash on tap, anywhere. A long press on a mark (the seal, the eye, the ear, the descent's door, a canvas, a control drawn as brush or stipple) brings no iOS callout and selects nothing; dragging a mark, an SVG or an image lifts no ghost.
- **Rule.** `-webkit-tap-highlight-color: transparent` on the root; `.aph-mark` (or `data-aph-mark`) for marks, which `canvas` and the ear get on their own; `-webkit-user-drag: none` on marks, SVG and images. The root keeps text at its size when a phone turns (`text-size-adjust: 100%`).
- **A screen must not** put `.aph-mark` on text or links: those keep select, copy, the link preview and dragging a link out.

### Colour scheme and the browser's bars

- **Rule.** `color-scheme` follows the theme (`light`, `dark`, switched by `data-theme`), so what the system still draws (pickers, the autofill dropdown, form controls a screen left native) matches the ground. `<meta name="theme-color">` follows the current theme's `bg` (`Aphesis.themeColor`, run by itself at load and on every theme change; during the eye's wave it changes when the wave ends); the runtime creates the meta if the page has none.
- **Browsers.** `theme-color`: Safari 15+ (the tab bar), Chrome on Android (the address bar); desktop Chrome ignores it.

### What the OS still draws itself, and how to stay clear of it

- **Copy, paste and lookup bubbles, and the selection handles** on phones: the system's own, in its own colours. They only appear on text a person selects; leave them there, and keep them off marks with `.aph-mark`.
- **`<select>` popups, date, time and colour pickers, the `<datalist>` dropdown, the validation bubble** (`required`, `type="email"`): drawn by the OS, beyond CSS (only `color-scheme` reaches them). Do not use them: build choices as a list of labels, dates as typed text, and say what is wrong in the page's own voice (`novalidate`).
- **The autofill dropdown, the password manager and the keyboard's suggestion bar:** the OS's. Mark fields honestly (`autocomplete`, `enterkeyhint`, `inputmode`) and they behave.
- **Permission prompts** (microphone, camera, motion, notifications), **`alert`, `confirm`, `prompt`**, the file chooser and the share sheet: the browser's. Ask only from a gesture that already says what will happen, and never use the dialogs; a destructive action asks once more in the page itself (the desk's "· sure?").
- **The OS's scroll indicator** on iOS and on macOS with overlay scrollbars may still flash while scrolling in a browser that ignores `::-webkit-scrollbar` and `scrollbar-width`; current ones honour both.
- **Video controls and full screen** are the browser's; a picture is a simulacrum, never a video with controls.
- **The spelling squiggle** outside Chromium, and the caret's shape and blink everywhere.

## Using it in a screen

Load `components/bundle.css` and `components/bundle.js` after `tokens.css`. Set `data-theme` from the system preference and the eye. Then: one `Aphesis.Fog` on a fixed full-screen canvas, `Aphesis.cursor()` and `Aphesis.tooltip()` once per document, and the screen's own marks drawn with `Aphesis.brush` and `Aphesis.stipple`. The scroll disturbance (`Aphesis.Scroll`) starts by itself.
