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

- **projects**: one mark per project of the owner's, each a repository of its own, drawn as the sections are so they can stand among them (the profile README sets them on a ring with four sections). They are not sections of the site: `Aphesis.PROJECTS` lists them apart from `Aphesis.SECTIONS`. `contraprova` (*probatio contraria*): a balance, its beam level, an equal heap of stipple in each pan: two marks weighed against each other and found equal. `heuresis` (*εὕρεσις*): an oil lamp carried into the dark, the flame in stipple at the spout's mouth. `anamnesis` (*ἀνάμνησις*): small rings linked by fine strokes, stipple gathering in the ones being recalled. `autopoiesis` (*αὐτοποίησις*): the ouroboros, its jaws parting round its own tail's tip, matter in stipple turning inside the ring. `parataxis` (*παράταξις*): three lanes side by side under one bar, the interface round, leaning in below to meet at a gate, the test-gated merge; work in stipple runs between the lanes and gathers where they meet. Same states and motion as the sections; seeds 401 to 499. They read at 34px and hold their shape at 17px, where the ouroboros becomes a ring with a knot.

Drawn large and alive, the eye is a component of its own: `Aphesis.Eye(el, opts)` draws itself in, trembles at 8 fps, blinks in hard cuts between discrete drawings and looks around in saccades (`components/Eye`). Small, in rubedo, it is the owner's mark beside the owner's posts on the forum and the wall, in place of a sigil; those eyes are `shared`: one tick for all of them, still while off screen.

Render them with `Aphesis.icon(name, state)`; the SVG files under assets are for places that cannot run the script, in the light-theme rubedo `#ab0d19`. Where nothing can run and the icon should still move (a README on GitHub), use `assets/Icons/animated/<name>-{dark,light}.svg`: self-contained, transparent, in each theme's accent, the stipple stirring always, the forum's eyes running their film, still under `prefers-reduced-motion`; `tools/readme` makes them and the rest of an animated README.

## The seal

The φ is the only logo. It is always `seal` red, with a boil that reseeds 8 times a second (`Aphesis.seal`). At home it is drawn live at the center; entering a section it closes into Φ and travels to the top-left corner (64px), where it leads home. The live drawing engine lives on the `mark` branch. Never redraw, outline, recolor or set the φ in a font other than Aphesis Script.

## Motion

- Anything that travels uses minimum-jerk easing (`Aphesis.MJ`): the seal in 1.6 to 1.8s, a simulacrum in 2.6s.
- CSS transitions use `easing-settle` with `duration-quick` (tooltip), `duration-slow` (letter wave), `duration-theme`, `duration-scene` (sections enter with a blur of 10px and a rise of 14px).
- Text hovers are small and kind: letters lift 2px one after another (`Aphesis.letters` with `.aph-wave`); a gloss turns `accent-text`. Nothing changes size or pushes its neighbours.
- The site always animates. It does not follow the system's reduce-motion setting and has no pause control: the motion is part of the work (the owner's decision). Do not add `prefers-reduced-motion` rules. (The lab kit, for research viewers, is the one exception: see "Lab kit".)
- Performance: stipple renders at one canvas pixel per cell (the runtime does this). Keep a screen to the fog plus at most two simulacra running at once; stop a simulacrum's canvas when it is hidden.

## Interaction

- **Cursor** (`Aphesis.cursor`): a disc in difference blend, the negative of what it covers. 0.2 at rest, 1 over links and buttons, `data-cursor=".55"` for small controls, tightening on press. Fine pointers only. It is the only cursor: the system cursor is hidden everywhere while it runs.
- **Theme shift** (`Aphesis.themeShift`): the eye's switch. The theme is applied at once and the ground changes cell by cell as a wave from the eye over `duration-shift`, while the page stays live; text in `.aph-ink` containers is the negative of the cell beneath it until the wave has passed, and each red mark (`.aph-red`) turns to the new theme's red when the wave reaches it. What is not marked the runtime reads at the click: ink that reaches the fog blends the same way, and what cannot (an unmarked red, ink in a layer of its own) turns where it stands as the wave reaches it (`.aph-turn`). Never switch the theme from the eye without it.
- **Bands** (`.aph-bands`, or `mask-image: var(--aph-bands)` where only some widths need it): a scroller that covers the screen lets what scrolls under the seal (top-left) and the eye, the ear and the passage (the bottom corners) recede instead of running into them; its content fades out through a band at the top and one at the bottom, sized to those marks and the safe-area insets. A mask, so the fog stays crisp and nothing solid is laid on the page; through the eye's wave the runtime keeps the text inside painted cell by cell (a mirror of the fog at the scroller's back). Outside the site (a research viewer, a project page), the lab kit carries the same band in a standalone form: `.lab-header--sticky` and `.lab-bands` (see "Lab kit", "The receding header").
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

## Page types

Everything published is one of three kinds of page, and every repository's README follows one standard. Each has
its spec, a starter template and its live examples in `system/page-types/`:

- **the site** (`page-types/site/`): aphes.ist itself, the reference. Its own rules (it always animates, sound on,
  hermetic) belong to it alone, and nothing here changes it.
- **landing page** (`page-types/landing/`): an open-source project's page, modelled on anamnesis.aphes.ist: the
  runtime kept quiet, one living stipple element as the hero, a motion budget, still under reduced motion.
- **paper page** (`page-types/paper/`): a study for reading (contraprova, heuresis, autopoiesis): the lab kit only,
  question, method, pre-registration, results with charts, the honesty table, the data or a replay.
- **the README standard** (`page-types/readme/`): the readme kit's header, lowercase, the parts in order, the
  honesty table, dark and light pictures, the licence last.

`tools/page-types/vendor.py` pins the runtime and the lab kit beside a project's page.

## Lab kit

The laboratory's research viewers (autopoiesis, contraprova, anamnesis, the reasoning-engine benchmark) live in their own repositories and are not screens of the site. The lab kit gives them this system as one stylesheet and one optional script, so that they read as one body of work without each restyling itself. It lives in `system/lab-kit/v1/` and is served at **https://aphes.ist/lab-kit/v1/** (the demo, every component with sample data, is that address itself).

```html
<link rel="stylesheet" href="https://aphes.ist/lab-kit/v1/lab.css">
<script src="https://aphes.ist/lab-kit/v1/lab.js" defer></script>   <!-- optional -->
<body class="lab"> … </body>
```

### What is in it

- `lab.css`: the fonts (relative paths, `fonts/`), every token of `tokens.json` plus the data-viz tokens, and the components. Generated by `tools/lab-kit/build.py` from `system/tokens.json` and `tools/lab-kit/lab_src.css`: edit those and rebuild, never `lab.css` (`build.py --check` says whether it is current; the build also stops if a colour fails its contrast).
- `lab.js` (optional, no dependencies, `window.Lab`): the theme switch and the stipple ground, both remembered per reader; the stipple masks that chart bands use; tooltips for `data-tip`; the tokens as hex for canvas, WebGL and chart libraries; presets for Observable Plot, Vega and 3D point clouds.
- `index.html`: the demo. `fonts/`: Aphesis Script (copied from `system/fonts/` by the build) and Special Elite (Apache License 2.0, its licence beside it).

### Readability first: where the kit differs from the site

The site is a work to be seen; a viewer is a document to be read. The rules hold (two faces, lowercase, English, tokens only, red is rare, no decorative boxes or fills, no gradients), with these exceptions, which apply to the lab kit only:

- **Data marks may be solid.** A bar, a dot, a heatmap cell or a series line is painted flat where that is what makes the value readable. Stipple stays for what is a range or a ground rather than a value (confidence bands, areas, the ground, swatches of a range), and every decorative mark is still stipple or a dotted line of cells, never a solid rule or a box.
- **Motion is minimal and follows `prefers-reduced-motion`.** Nothing moves unless asked: the stipple ground is off by default, static when on, and drifts (at ten frames a second, slowly) only with `data-lab-fog="drift"` on `<body>` and never for a reader who asks for reduced motion. Charts draw once. The site's own rule (it always animates) is unchanged.
- **Scrollbars stay native**, in the theme's colours (`scrollbar-color`); the scroll disturbance belongs to the site's runtime.
- **No cursor, seal boil, sound or theme wave.** The φ is the drawing itself (`phi.svg`) painted in `seal`, still; the theme changes at once.
- **A theme can be set on any element** (`data-theme="dark"` on a panel inside a light page); the site sets it on the root only.

### Components

All lowercase, all on tokens. Classes start with `lab-`.

| component | markup | notes |
| --- | --- | --- |
| page | `body.lab > .lab-page` | the column (1120px) with the gutters and safe-area insets; `.lab-prose` for 65ch text; `.lab-section` between parts |
| header | `header.lab-header` with `a.lab-mark`, `.lab-project` (with an optional `.lab-gloss`), `nav.lab-nav`, `.lab-controls` | `.lab-mark` is the φ at 24 × 33px; buttons with `data-lab-toggle="theme"` / `"fog"` are wired by lab.js and say what pressing does (`close the eye`, `fog · off`) |
| title | `.lab-titles > .lab-gloss-title + h1.lab-title + p.lab-lede` | Aphesis Script at slant −12, `clamp(44px, 8vw, 68px)`; the gloss above, in Latin or Greek |
| type | `h2`, `h3`, `.lab-label`, `.lab-meta`, `.num` | `h2` is the heading style; `h3` is a label; `.num` sets tabular figures |
| stipple ground | lab.js; `[data-lab-toggle="fog"]`; `body[data-lab-fog="drift"]`, `[data-lab-fog-start]`, `[data-lab-fog-density=".7"]` | the site's fog at a reader's density, cleared from the column of `.lab-page` down to a sparse residue; text gets the ground's halo |
| stat tiles | `dl.lab-stats > .lab-stat > dt.lab-stat-label + dd.lab-stat-value + dd.lab-stat-note` | a row of cells above each; `.lab-stat--ref` for the one figure that matters (red) |
| tables | `.lab-table-wrap > table.lab-table` | rows parted by single cells; `th` in label; `.num` right-aligned; `.lab-table--dense`; `tr.lab-ref-row`; `.lab-pass` / `.lab-fail` status words (always the word) |
| honesty table | `table.lab-table.lab-honesty` with `span.lab-ev[data-ev]` | `measured` a solid square of cells (observed directly), `modelled` dense stipple (computed from what was measured), `tested` a ring of cells (checked, and it held), `hypothesis` sparse stipple in red (not checked yet); the word is always written |
| callouts | `.lab-callout > .lab-callout-label + p` | a column of cells on the left; `.lab-callout--alert` in red |
| code | `pre[data-label] > code`, `.c` for comments; inline `code` | the typewriter face, a column of sparse cells on the left |
| legend | `ul.lab-legend > li.lab-key.lab-cN` | keys: line (default), `--dot`, `--bar`, `--band` (stipple), `--dotted`, `--rule` (the red reference), `--ramp` (sequential), `--ramp.lab-key--div` |
| charts | `figure.lab-chart > svg`, `figcaption` | below |
| point clouds | `figure.lab-cloud > canvas`, `Lab.points()` | below |
| receding header | `header.lab-header.lab-header--sticky` (+ `.lab-header--blur`), `footer.lab-footer--sticky`, `.lab-bands` | since 1.1: what scrolls fades out under a sticky header through the site's band; below |
| tooltip | any `[data-tip]` inside `.lab` | typed in meta beside the pointer, a hairline of accent on its left; also on keyboard focus |

### Data-viz tokens

In `tokens.json` under `dataviz`, both themes, checked by the build (WCAG 2: text 4.5:1, marks 3:1 on `bg`):

- **Categorical** `lab-cat-1` to `8`, in this order: lapis, ochre, verdigris, rosa, umber, caeruleum, iosis, olive. Pigments held to rubedo's discipline in OKLCH (L .46 to .62 light, .52 to .66 dark; C .10 to .14). Every slot is at least 3:1 on the ground. Adjacent slots stay apart under protanopia and deuteranopia (OKLab ΔE ≥ 8.3 light, 9.0 dark, Machado 2009) and for full colour vision (ΔE ≥ 18); the first four are pairwise distinct, so a scatter of up to four groups is safe. Rubedo is not a slot: red stays for the one mark that matters (`lab-ref`).
- **Sequential** `lab-seq-1` to `7`: the neutral scale, low to high (`n-300` to `n-900` light, `n-800` to `n-150` dark): magnitude is the density of ink.
- **Diverging** `lab-div-1` to `7`: lapis, through the ground's grey (`n-200` light, `n-800` dark), to rubedo. Put what asks for attention (worse, over budget) on the rubedo side.
- **Roles**: `lab-mark` (one series: ink), `lab-ref` (the one that matters: accent), `lab-dim` (context marks), `lab-grid`, `lab-axis` (both decorative: the labels carry the values), `lab-axis-text` (`ink-soft`), `lab-pass`, `lab-fail`.
- **Sizes**: `lab-cell` 2px, `lab-stroke` 2px, `lab-hair` 1px, `lab-dot` 6px, `lab-point` 2px, `lab-point-emph` 4px, `lab-point-pick` 8px, `lab-dim-alpha` .32, `lab-fog-alpha` .55, `lab-band` 50px and `lab-veil-blur` 4px (the receding header).
- **Colour classes**: `.lab-c1` to `.lab-c8`, `.lab-s1` to `.lab-s7`, `.lab-d1` to `.lab-d7`, `.lab-ink`, `.lab-soft`, `.lab-dim`, `.lab-accent` each set `--lab-k`, which every mark, key and swatch paints with.

### Charts

The chart layer styles SVG; it draws nothing. Wrap the `<svg>` in `figure.lab-chart` and give marks classes instead of colours.

- **Anatomy.** Axes and ticks are 1px hairlines in `lab-axis`; gridlines are dotted single cells in `lab-grid` (a d3 axis with `tickSize(-inner)` inside `g.lab-grid`); every word is in the text face at meta size, in `lab-axis-text`, with tabular figures. One y-axis per chart.
- **Marks.** `.lab-line` (2px), `.lab-line.lab-dotted` (a line of cells: a model, an expectation), `.lab-step`, `.lab-dot` (a 6px square with a 1px ring of ground, so overlapping dots stay apart), `.lab-bar`, `.lab-cell` (heatmap, 2px gap of ground), `.lab-rule-ref` (a dotted red rule: a target), `.lab-ring` (a red ring around the one point that matters), `.lab-label` / `.lab-label-soft` (direct labels, in text colours), `.lab-halo` (a line of ground under a line that crosses a band), `.lab-faded`.
- **Stipple fills.** `.lab-band` (sparse) and `.lab-area` (medium) are stippled through SVG masks that lab.js adds (`url(#lab-stipple-1..3)`; `.lab-sparse`, `.lab-medium`, `.lab-dense` override). Without lab.js they fall back to a light wash. The masks are in user units: draw at one unit per CSS pixel, as D3 and Plot do. `Lab.defsMarkup()` gives them as a string for an SVG that leaves the page.
- **D3**: classes as above; the CSS reads `.domain`, `.tick line` and `.tick text` as d3-axis writes them.
- **Observable Plot**: `Plot.plot({...Lab.plot(), marks})` (transparent ground, the text face, the categorical range); the CSS restyles Plot's grids, ticks and rules.
- **Vega and Vega-Lite**: `vegaEmbed(el, spec, {config: Lab.vega(), renderer: 'svg', actions: false})`; the config carries the fonts, axes, grids, legends and the categorical, sequential and diverging ranges. The CSS catches what a spec leaves out.
- **Canvas**: `Lab.palette()`, `Lab.seq()`, `Lab.div()`, `Lab.color('lab-grid')` give hex for the current theme; redraw in `Lab.onTheme(fn)`. `Lab.stipple(ctx, x, y, w, h, {density, color})` fills a rectangle with cells (clip to a path first for a shape).
- **Readable.** One series is ink and needs no key; two or more take the slots in order and always a legend, with direct labels where there are four or fewer; never more than eight (fold the rest into "other" or use small multiples). Text never wears a series colour. Red marks one thing per chart. Each chart has a caption saying what it shows and an `aria-label` that states the finding; a table view (a `lab-table`) carries the numbers when they matter.

### Point clouds

`Lab.points()` returns the style for a 3D viewer (three.js, regl, deck.gl): `background` (`bg`), `point` (`fog`, for one class), `colors` (the categorical slots, for clusters), `dim` and `dimAlpha` (out of focus), `pick` (`lab-ref`), sizes in device pixels, `square: true`, `sizeAttenuation: false`, and `depthFog` (the ground's colour). Points are square cells that do not grow with nearness: at rest one cell (2px); a cluster in focus two cells (4px) while the others go to `lab-dim` at 32%; the one picked point four cells (8px) in red; far points sink into the ground (mixed toward `bg`) instead of shrinking. In three.js: `new THREE.PointsMaterial({size: P.size, sizeAttenuation: false, vertexColors: true})` (its points are squares already) and `scene.fog = new THREE.Fog(P.background, near, far)`. Turning is by hand (drag, arrow keys); a cloud never spins on its own.

### The receding header

Since 1.1. The lab kit's form of the site's bands (`.aph-bands`): content that scrolls under a sticky header (or over a sticky footer) does not meet a hard edge; it is faint under most of the header and comes clear just past it, through the same eased band (`lab-band`, 50px: the content at 0, .12 halfway, .45 at four fifths, then whole).

**When.** A page or app with a header that stays while long content scrolls: a landing page, a viewer with many sections, a log. A short page needs no sticky header at all.

**A page whose document scrolls** (most pages):

```html
<body class="lab">
  <div class="lab-page">
    <header class="lab-header lab-header--sticky lab-header--blur">
      <a class="lab-mark" href="https://aphes.ist/" aria-label="aphes.ist"></a>
      <span class="lab-project">anamnesis</span>
      <nav class="lab-nav" aria-label="sections"><a href="#notes">notes</a> …</nav>
      <div class="lab-controls">
        <button class="lab-button" data-lab-toggle="theme">close the eye</button>
      </div>
    </header>
    <main> … </main>
  </div>
</body>
```

- `.lab-header--sticky` keeps the header at the top and lays a veil of the ground under it: opaque over the header's own box, easing out over `lab-band` below it, across the column and its gutters. It is the ground's own colour, so no bar is seen, only text receding. Both themes, and a nested `data-theme`, follow by themselves.
- `.lab-header--blur` (optional) adds a faint blur, `lab-veil-blur` (4px), under the same graded mask, only where the browser has `backdrop-filter` (`@supports`). It is dropped while the stipple ground is on, so the cells are never smeared, and for readers who ask for less transparency (`prefers-reduced-transparency`).
- `.lab-footer--sticky` (and `.lab-footer--blur`) is the same from the bottom.
- Links to a part of the page land below the header: `scroll-padding-top` follows `--lab-header-h`, which lab.js measures from the header itself (without lab.js it is 73px plus the safe-area inset).
- On a phone the header stays short: the name and the controls on one line, the nav on one line beneath that scrolls sideways.

**An app whose own pane scrolls** (a full-height scroller under a fixed header): put `.lab-bands` on the scroller. It is the site's bands as a mask, sized by `--lab-header-h` and `--lab-footer-h` (set them, or let lab.js measure a `.lab-header--sticky` / `.lab-footer--sticky`). For a box inside the page (a log, a list) use `.lab-bands.lab-bands--inner`: no header, no insets, only the bands. Give the box a height; its first and last children get room so that at rest nothing sits in a band.

**Do**: keep the header to one line of marks and words; let the document scroll; leave the blur off unless the page is mostly text; keep the header inside `.lab-page` so the veil spans the column. **Don't**: give the header a background, a border, a shadow or a solid bar; raise `lab-veil-blur` past a few pixels or blur the stipple ground; put the sticky header inside an element with `overflow` (sticky stops working there; use `.lab-bands` on that element instead); mask the document itself (a mask follows the element, not the screen). Nothing here moves: there is no animation to reduce, and the theme and ground change at once.

### Versions and how a project takes it

- The major version is in the path: `v1` only changes in ways that keep a page working (fixes, new classes, new tokens); a change that would break a page goes to `v2/`, and `v1/` stays served. The exact version is in the head of `lab.css` and in `Lab.version`: 1.0.0 the kit, 1.1.0 the receding header (`.lab-header--sticky`, `.lab-header--blur`, `.lab-footer--sticky`, `.lab-bands`, tokens `lab-band` and `lab-veil-blur`).
- The site's deploy publishes every `system/lab-kit/v*/` directory of `design-system` to `https://aphes.ist/lab-kit/`, with `Access-Control-Allow-Origin: *` (the fonts load from other origins) and an hour of caching. A push to `design-system` reaches the address with the site's next deploy.
- **Link it** (above) to follow `v1` as it is fixed. **Or vendor it**: copy `system/lab-kit/v1/` (lab.css, lab.js, fonts/) into the project, link it relatively, and note the version from the head of `lab.css`. The paths inside are relative, so the copy works as it is.
- A viewer inside an app (React, a canvas app) puts `lab` on its own root element instead of `<body>`; the tokens are on `:root`, so they reach it. The kit's custom properties have the system's names (`--bg`, `--ink`, `--accent`, `--lab-*`); an app whose own properties use those names renames its own.
