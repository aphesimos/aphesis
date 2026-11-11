The eye, alive: the theme switch's eye (`ICONS.eye`) drawn large, as the owner's gate shows it, for anywhere an eye should look back (the gate, music).

- **Provide** an element whose `color` is `var(--accent)` and whose width is set (its height follows, 14/24 of the width); call `Aphesis.Eye(el, opts)`.
- **Options:** `size` (CSS px, from 24; else the element's width), `gaze` (`'auto'`: saccades that sometimes follow the pointer and `follow`; `'pointer'`: follows the pointer; an Element: follows it), `follow` (an Element or a function returning `[x, y]`, something `'auto'` glances at, such as a caret), `blink` (`true`: blinks on its own at irregular intervals), `drawIn` (`true`), `start` (`true`; `false` waits for `start()`), `shared` (`false`; `true` for one of many small eyes, below).
- **Returns** `{blink(), close(ticks?), open(), wide(ticks?), squint(ticks?), look(x, y), typed(), on(fn), state, start(), stop(), destroy()}`. `close()` without ticks stays closed until `open()`; with ticks it is a hard cut held that long, as for a refusal. `wide()` cuts to wide open with a dilated pupil. `typed()` tells `'auto'` to glance toward `follow`.

How it moves:

- It **draws itself in** first, stroke by stroke, the way the φ draws itself on the home: the upper lid, the lower lid, then the iris cell by cell (2.1 s).
- Then it **trembles** for good: every 125 ms (8 fps) its strokes are redrawn from one of three drawings of the same state, each with its own brush seeds, and the feTurbulence seed swaps, as the seal's boil.
- **Blinks are hard cuts** between discrete drawings, held for whole ticks: open, half (the upper lid lowered), closed (one lid and three lashes, as the icon), squint, wide. One upper lid in every drawing, never a fold that could read as a second. A blink is half · closed · closed · half, sometimes doubled or slow, now and then a held squint.
- **The gaze is its own track**: centre, the eight directions, a narrowed pupil and a dilated one, each a stipple drawing cut to every blink's opening. Saccades: a cut to a fixation, then a hold of irregular length. Blinks and gaze run on independent clocks.
- Everything is drawn **at the size it is shown**: brush widths, boil displacement and stipple cells (about 3 CSS px) are tuned to it, and it is drawn again when the size changes by a tenth. No tween anywhere.

- **Small and many: `shared: true`.** The owner's mark (the eye beside each of the owner's posts on the forum and lines on the wall, where a sigil would be) can put dozens of eyes on one page. Shared eyes step together on one page-wide tick of 125 ms, hold still while off screen (one `IntersectionObserver` for all of them; the tick stops while none is in view), read the pointer from one listener, and share their drawings: a size's drawings are made once (every seed is fixed) and kept for every eye of that size. It is SVG only: no canvas, no WebGL context. Drawn small (from 24 px), the lids keep at least 1.5 CSS px.

- **Do** keep it in `accent`, at most one large one per screen; small shared eyes only as the owner's mark. **Don't** animate its size or position, and don't add a fade between its states: the cuts are the hand-drawn cycle.
