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

# Extension 2.1 — Greek, polytonic marks, symbols, CJK

Everything above still holds: one hand, one brush, **nothing solid**, shared parts wherever a gesture
already exists, fixed strokes (the same strokes in every master — never add or remove one per weight).
The lead owns `brush.py parts.py spacing.py registry.py preview.py build.py features.py` and the existing
glyph modules. You write only the module(s) named in your brief and proof images in `work/<group>/`.

## E1. What exists already (read it before drawing)
- Latin a–z, figures, punctuation, accents: `glyphs_core.py glyphs_round.py glyphs_straight.py
  glyphs_diag.py glyphs_figures.py glyphs_punct.py glyphs_marks.py`.
- Greek so far, in `glyphs_extra.py`: `alpha epsilon sigma sigmafinal iota`. **ο is the Latin `o`, ν is the
  Latin `v`, φ is the hand-drawn logo** (`phi`, not a brush glyph: never redraw it). These set the tone of
  the Greek: an upright, round, cursive Greek in the *same* hand as the Latin — modern, plain letterforms
  (what a Greek schoolbook shows), no ligatures, no historical abbreviations, written with the φ's brush.
- Glyph names (fixed, `registry.py`): `alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu
  xi pi rho sigma sigmafinal tau upsilon chi psi omega`; marks `psili dasia perispomeni macron breve
  ypogegrammeni psilioxia psilivaria psiliperispomeni dasiaoxia dasiavaria dasiaperispomeni dieresistonos
  dieresisvaria dieresisperispomeni`; symbols `exclamdown questiondown guillemotleft guillemotright
  guilsinglleft guilsinglright Euro percent plus minus equal`; CJK `uni8272 uni5373 uni662F uni7A7A`.

## E2. Extra keys a glyph dict may carry
```python
GLYPHS['eta'] = dict(strokes=[...], L='n', sub=120)
```
- `L=` / `R=`: a **glyph name** — "this side is the same gesture as that letter's side, give it the same
  bearing" (e.g. `L='n'` stem with entry, `L='h'` ascender stem, `L='o'` round, `L='a'` bowl of a,
  `L='e'` back of e, `R='i'` stem with exit tail, `R='n'` arch + stem + tail, `R='q'` stem below the line
  without tail, `R='p'` bowl of p, `R='o'`). Leave it out and the side is measured from its own ink.
  A **number** instead is a hand-set bearing in units at wght 400 (punctuation, symbols, CJK).
- `Lref='full'` / `Rref='full'`: the side's structure lives at the top or the bottom, not at mid-height
  (τ's bar, γ's arms …). `'all'`: a glyph that lives outside the x-height band (CJK, signs).
- `top=x`: where accents sit, if not over the middle of the letter. `sub=x`: where the iota subscript
  sits under α η ω, if not under the middle. Both in the drawing's own x coordinates at wght 400.
- `upright=True`: not sheared in the slanted masters (CJK).
- Addendum keys from the first run still apply (`sit`, `grow`, `PIN`, `squares`).

## E3. Looking at Greek, accents and CJK
```bash
cd /home/user/aphesis/src
python3 preview.py --glyphs "beta delta rho" --skel --out ../work/<group>/sheet.png
python3 preview.py --glyphs "beta delta" --weights 300,400,800 --scale 0.3 --out ...
python3 preview.py --glyphs "ά ἄ ᾷ ῥ" --weights 300,400,800 --scale 0.3 --out ...     # accented letters are composites
python3 preview.py --text "ἓν τὸ πᾶν · γνῶθι σεαυτόν" --weights 300,400,800 --scale 0.28 --out ...
python3 preview.py --text "aφesis 色即是空 αφεσις" --weights 300,400,800 [--slnt -16] --out ...
```
`--glyphs` takes names or characters separated by spaces; `--text` sets a line with the real spacing engine
(letters that are not drawn yet are skipped with a note). Accented letters are assembled automatically from
the Unicode decomposition: base letter + ONE mark glyph above (Greek stacks are single glyphs:
`psilioxia` …) + at most one below (`cedilla`, `ypogegrammeni`), placed at the letter's `top` / `sub`.
Always judge at **300, 400 and 800, upright and `--slnt -16`**, and for letters also `--v 1` and `--v 2`.

## E4. Marks (for whoever draws them)
Top marks are drawn **centred on x = 0, around `MARK` (y = 610)**, every point pinned, with `grow`
(see `glyphs_marks.py`: `pin()`, `FLOAT`, `touch()`). A mark must work over α ε η ι ο υ ω and ρ at
every weight: it may not touch the letter (lowest ink of a top mark ≥ 520 at 800) and, at wght 800, its
highest ink must stay below y = 800. `ypogegrammeni` is drawn centred on x = 0 below the baseline.

## E5. CJK
Four characters: 色 即 是 空 (the passage 色即是空). Written with the same brush as everything else,
upright (`upright=True`), sized to sit with the lowercase Latin at display sizes: ink from about −85 to
about 695, body about 760 wide, optical centre near y = 300. Bearings hand-set (`L=`, `R=` numbers),
`Lref='all', Rref='all'`. See the CJK brief for the rest.
- `same='math'` (added at review): signs that must stand on one advance width (+ − =) name a common group; each
  gets the widest advance of the group and is centred in it.
- `hang=True` on a stroke or touch (added at review): the counterpart of `sit` — a growing mark that hangs from a
  line (the dot of ¡ ¿ under the x-line) keeps its highest ink where it is at wght 400.
- Review notes of 2.1: α's right side is measured on its own ink (it was keyed to i and stood 13 units loose);
  空's top dot swells less than a letter's dot (grow 0.3) so the four characters keep one top line; ¡ ¿ hang from
  the x-line at every weight.


## 2.101 — after the two independent reviews of 2.100

- **Greek marks.** Greek has its own `oxia` (= tonos) and `varia`, slimmer and longer than `acute` / `grave`; `psili` and `dasia`
  are a comma and a comma turned round (head on top in both). Greek marks: `grow=0.5` (Latin marks keep 0.75) and `lean=0.5`
  (a glyph spec key: in the slanted masters the glyph goes to where the slant carries the height MARK and leans about it by
  that share only). Stacks are the single marks' strokes at their own size; parts ≥ 26 units apart at 800.
  `registry.GREEK_MARKS` maps acute → oxia, grave → varia for every Greek precomposed letter, so ό ≠ ó although ο = o;
  `ccmp` tries the Greek composition first in a `grek` run.
- **Engine.** `measure()` measures what does not lean like the letters (φ, Greek marks and the letters that carry them,
  the four characters) as the leaning letters meet it. Kerning of glyphs added after 2.0: a true-distance floor
  (`FLOOR`, with the slant), and a late glyph rides in a class only if the class's kern also keeps it clear (`kern_need`).
  The four characters (`han`) are kerned against everything but each other, never pulled in; in the slanted masters they
  keep their upright white (`HAN_KEEP`). An opening bracket before a closing one is a kerned pair.
- **Features.** Capital Σ rule knows the φ. `calt`: the φ takes its turn inside a Greek word (`@g0`), restarts the cycle
  between Latin letters as before. `locl` (grek): a middle dot directly after a Greek letter → `anoteleia` (U+0387 maps to
  it); between spaces it stays `periodcentered`. `ss02`: `phi.ss02`, the φ sheared like every letter.
- **Glyphs.** λ: left foot under the head. τ: bar 72 to the left (was 100). α: bowl begins 14 further from the stem.
  ¡ ¿: dot top on the x-line (`DOT_UP = XH − 38`, `hang`). « »: pitch 164, pressure 0.77, rough 0.5. 色: 4 % wider;
  空: pressures 0.95–1.0; 即: dot `grow=0.3`. New: `anoteleia`; U+00B5 → `mu`, U+03D0 → `beta`.
- **Kept as it was, with the reason.** The φ stands upright by default (brief). The statics' STAT uses `ital`
  (fontbakery requires it of a style-linked static family; the variable font says `slnt`).
