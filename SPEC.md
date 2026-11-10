# Aphesis Script — design spec

Single source of truth for everyone drawing glyphs. The lead designer owns this file, `src/brush.py`,
`src/parts.py`, `src/spacing.py`, `src/registry.py`, `src/preview.py` and `src/glyphs_core.py`.
**Do not edit those.** You write exactly one module, `src/glyphs_<group>.py`, and proof images in
`work/<group>/`. No git, no publishing, no external services.

## 1. What we are making
"Aphesis Script" is the authorial display face of aphes.is, a hermetic, cult, Latin, experimental personal
site. Its logo is a hand-drawn brush **φ**; the wordmark is **aφesis**. The face is **lowercase only**.

The hand: a wide, upright *humanist cursive* — the cancellaresca of the Renaissance hermeticists, with
half-uncial roundness — written with the φ's own brush. Think of a scribe with a broad brush held at a
steep 38°: hairline entries from the lower left, stems, round bowls with diagonal stress, short exit tails.
It must feel like **one hand and one ritual** across letters, figures and every mark. Coherence and
consistency outrank cleverness. Nothing is ornamental for its own sake.

**Nothing is solid.** Every glyph — letters, figures, punctuation, every dot, accent, quote and dash — is
made of brush strokes: a centreline plus the brush's width profile. No geometric circles, ellipses,
rectangles or polygons. A dot is a short pressed *touch* of the brush.

## 2. Metric lines (outer ink edges, same at every weight)
| line | y | constant |
|---|---|---|
| ascender (top of ascender stems) | 730 | `ASC` |
| top of ascending figures | 640 | `FIG` |
| centre of dots and accents | 610 | `MARK` |
| round x-line (tops of bowls and arches) | 472 | `XH + OV` |
| x-height (flat) | 464 | `XH` |
| baseline | 0 | |
| round baseline (bottoms of bowls) | −8 | `-OV` |
| descender (bottom of descender stems) | −240 | `DESC` |

The φ's loop spans exactly −8 … 472: it *is* the round x-height band. UPM 1000.

Control points are **centrelines**, so a curve that must touch a line sits half a stroke inside it. Use the
constants from `parts.py`: `TOP` (≈443.8, centreline of a round top), `BOT` (≈20.2, centreline of a round
bottom), `MID` (232). For a round extreme in the ascender/descender zone use `ASC - HW`, `DESC + HW`.

## 3. The brush (already implemented — you only place control points)
`wmax` = 80 units at wght 400 (the φ's stroke); 50 at 300; 128 at 800. Width depends on the direction
the brush travels (0° = right, 90° = up):

| direction of travel | width at 400 | name |
|---|---|---|
| ↗ 38° or ↙ 218° | 28 | hairline (entries, exits, branches) |
| → ← horizontal | 56 | |
| ↑ ↓ vertical | 67 | stem |
| ↘ −52° or ↖ 128° | 80 | full brush (the s spine, left-bottom and right-top of an o) |

So: **up-right strokes are thin, down-right strokes are thick.** Design with that: joins and branches should
leave a stem travelling up-right; weight sits on the lower-left and upper-right of a bowl.
Ends are tapered (`tin`, `tout` in units); edges drift slightly (the unsure hand); inner corners fill with
ink. All of that is automatic.

## 4. Glyph format
```python
"""one-line description of the group"""
from brush import *
from parts import *
GLYPHS = {}
x = 40                                    # centre of the first stem (any origin works; spacing is measured from ink)
GLYPHS['n'] = dict(strokes=[
    S(entry(x) + [(x, 200)] + foot(x), **STEM),          # stroke 1: hairline entry, stem, lifted on the baseline
    S(arch(x, x + U) + tail(x + U), **JOIN),             # stroke 2: branch, arch, second stem, exit tail
])
```
- `S(pts, tin=34, tout=60, k=1.0, b0=0.18, b1=0.04, grow=0)` — one stroke. `pts` are `(x, y)` centreline
  points **for wght 400**, in the order the hand moves; a centripetal Catmull-Rom spline passes through
  every point. `tin`/`tout`: length (units) of the swell at the start / thinning at the end. `b0`/`b1`:
  width fraction at the very start / very end (0.04 = lifted point, 0.4 = blunt lift, 0.9 = cut).
  `k`: brush pressure (1 = full; hairline details and small marks 0.6–0.9). `grow`: only for marks that
  float (dots, accents, punctuation touches): they swell about their own centre with weight (use 0.75).
- `(x, y, PIN)` — a point that must not move with weight: stem feet on the baseline, tips of
  ascenders/descenders, and all points of floating marks. Everything else is unpinned: the engine moves
  it so outer edges stay on the metric lines at every weight.
- `touch(x, y, k=1, size=1, ang=-58)` — a pressed touch of the brush centred on (x, y): the dot.
- Names: letters `a`…`z`; figures `zero one two three four five six seven eight nine`; punctuation by
  Adobe names (`period comma colon semicolon exclam question quotesingle quotedbl quoteleft quoteright
  quotedblleft quotedblright hyphen endash emdash parenleft parenright bracketleft bracketright slash
  backslash ampersand at numbersign asterisk ellipsis underscore periodcentered`); marks `acute grave
  circumflex tilde dieresis ring cedilla`; `oe ae germandbls`.
- Shared parts (`parts.py`) — **use them wherever the gesture occurs; never re-draw them by hand**:
  `entry(x)` hairline entry into an x-height stem · `flag(x)` the same on an ascender · `head(x)` a stem
  begun without entry · `tail(x)` baseline turn + exit tail · `foot(x, y=0)` stem lifted on a line (pinned) ·
  `arch(x0, x1)` branch + arch into the next stem · `oval(cx, rx, a0, a1, n)` points on the round letters'
  oval · presets `STEM`, `DESCENDER`, `JOIN` · rhythm constants `U` = 244 (stem pitch of n/h/m/u),
  `PA` = 258 (bowl side ↔ stem of a d g q b p), `PO` = 288 (side ↔ side of o).
- Read `src/glyphs_core.py`: n o i h a e p s are the reference drawings. Match them.

## 5. The hand — rules
1. **Few strokes, long gestures.** 1–3 strokes per letter. Each stroke is something a hand would do in one
   movement. Start strokes buried inside ink that is already there (so no blunt start shows) unless the
   start *is* a terminal.
2. **Terminals.** Stems on the baseline: `foot(x)` with `**STEM` (blunt lift). Stems that end below the
   baseline are drawn out to a point at `DESC` with `**DESCENDER` (like the φ's own stem). Free curve ends
   (c, e, s, r …) end in a lifted taper, or in the exit `tail`. No ball terminals, no serifs.
3. **Joins.** A branch leaves a stem from inside it, at about y = 250, travelling up-right (thin), and
   thickens over the arch. A bowl returns to a stem as a thin up-right stroke at about y = 180.
4. **Roundness.** Round tops at `TOP`, round bottoms at `BOT`, never above/below. Bowls are slightly
   squared ovals (`oval(...)`), not circles. Keep counters open: nothing narrower than ~110 units at 400.
5. **Proportions** (centreline, wght 400): stem pitch `U`; bowl letters `PA`; `o` width `PO`; narrow letters
   (r, t, f, j, l, i) do not get wider to "fill". Ascenders reach `ASC`, descenders `DESC`.
6. **Avoid** hairpin turns tighter than ~15 units radius inside a stroke (split into two strokes instead),
   strokes shorter than ~35 units, and three strokes meeting at one point.
7. Draw for 400, then **look at 300, 800 and slnt −16**. At 800 counters must stay open and nothing may
   clog or sprout spikes; at 300 nothing may look broken or spindly.
8. Alternates are automatic (`--v 1`, `--v 2` re-write the letter with small differences). Check they do
   not break your joins.

## 6. Spacing
Automatic: the engine measures the white beside each glyph and sets sidebearings so every pair encloses the
same optical area (`src/spacing.py`). You do not set advance widths. Only if a side's structure lives at the
top or bottom rather than mid-height (r's arm, the open side of c, f's crossbar …) add `Rref='full'` or
`Lref='full'` to the glyph's dict. The lead sets keys and kerning.

## 7. Looking at your work (do this constantly)
```bash
cd /home/user/aphesis/src
python3 preview.py --glyphs "n o c" --skel --out ../work/<group>/sheet.png          # big, with skeleton
python3 preview.py --glyphs "c d g" --weights 300,400,800 --out ../work/<group>/w.png
python3 preview.py --glyphs "c d g" --slnt -16 --out ../work/<group>/s.png
python3 preview.py --glyphs "c" --v 1 --out ...   # alternates 1 and 2
python3 preview.py --text "nncnnoocoo deacon" --out ../work/<group>/words.png        # set with real spacing
python3 preview.py --text "..." --weights 300,400,800 [--slnt -16] [--calt] --scale 0.3
```
Then **Read the PNG** and judge it as a type designer: is it the same hand as n o a e s? Same weight, same
roundness, same terminals, same rhythm? Iterate until it is. The preview fills with the non-zero rule,
exactly like a font renderer; red lines are baseline / x-height / ascender / descender, grey lines the
overshoots, blue `FIG`, pale `MARK`.

## 8. Acceptance checklist
- [ ] every glyph of the group drawn; module imports cleanly; only `S(...)`/`touch(...)` strokes
- [ ] shared parts used for every entry, flag, tail, foot, arch
- [ ] extremes on the metric lines at 300 / 400 / 800 (check the y-range printed above each glyph)
- [ ] stems and bowls match the control letters in weight and proportion when set in words
- [ ] no white slivers, spikes or blobs at 300 / 400 / 800, upright and at slnt −16, for v = 0, 1, 2
- [ ] words mixing your glyphs with n o i h a e p s look like one hand

## 9. What to send back
Your final message: the path of your module, the proof sheets you want me to look at (max 4), a two-line
note per glyph on the construction and anything you are unsure about, and any glyph you consider below
standard (say so plainly — I would rather redraw it than ship it).

## Addendum — what the review added after the groups were drawn
These were introduced by the lead while integrating; the modules in `src/` already use them.
- `S(..., sit=True)` / `touch(..., sit=True)`: a growing mark that stands on a line (the period, the dot
  of ! and ?) keeps its lowest ink where it is at wght 400 instead of sinking as it swells.
- `upright=True` on a glyph: it is not sheared in the slanted masters (the backslash, which the slant
  would otherwise stand up into a bar). The φ is upright by construction.
- `head(x)` pins its first point, so an exposed stem head keeps its height at every weight.
- `squares=[(x, y, side), …]` on a glyph: stipple squares in the site's icon style (see `stipple` in
  `brush.py`); they exist in every master, move with the skeleton and swell a little, never appear or
  vanish. Used by the `.ss01` glyphs in `glyphs_extra.py`.
- `top=` / `below=` on a letter: where accents attach when the middle of the structure is not the place.
- The crossbar of f and t is written like a stem's entry (hairline in along the nib, bar, small lift), and
  the f carries a pressed beak; ß stays open at the foot; the asterisk is three written strokes.
