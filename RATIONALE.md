# Aphesis Script — rationale

## What this is

Aphesis Script is a lowercase-only display hand for aphes.is: a wide, upright humanist cursive — the cancellaresca of the Renaissance hermeticists, with some half-uncial roundness — written with the brush of the hand-drawn φ. It began as a spacing repair for six letters. The owner then widened the brief to the whole family in one run, with freedom to rebuild, so the earlier skeletons and numbers were used as input, not as limits.

Three things were kept from the first version because they are the identity: the brush (centreline plus width profile, nib at 38°, thick/thin 2.8, tapered ends, unsure edges), the φ drawing itself, and the axes (wght 300–800 with 400 = the φ’s stroke, slnt −16…0 with the φ upright at every slant).

The order of priorities throughout: the wordmark aφesis first, then an even rhythm at every weight and slant, then one hand across every glyph, then the size of the character set.


## Why the spacing was uneven, and what changed

The first font gave each of its six letters an advance width typed in by hand, the same number in every master, and placed the φ by eye. Nothing measured the white between the shapes, so every pair landed where the guesses happened to put it — and as the brush grew heavier the same boxes simply filled up.

Measured with one ruler on both finished fonts (the optical white between neighbours in the x-height band, depth-limited; the strings are the ones the six-glyph font can set: aφesis, aphesis, hhihhi, sisisis, papapa, heheh, φhφ):

| wght | slnt | before: mean white | range | spread | after: mean white | range | spread |
|---|---|---|---|---|---|---|---|
| 300 | 0 | 141 | 99–212 | 24 % | 166 | 155–176 | 4.6 % |
| 400 | 0 | 126 | 94–197 | 27 % | 145 | 138–150 | 3.1 % |
| 800 | 0 | 100 | 57–169 | 36 % | 114 | 110–119 | 2.1 % |
| 300 | -16 | 140 | 15–211 | 33 % | 166 | 155–176 | 4.6 % |
| 400 | -16 | 125 | 15–197 | 37 % | 145 | 138–150 | 3.0 % |
| 800 | -16 | 100 | 13–171 | 46 % | 115 | 110–120 | 2.1 % |

Spread is the standard deviation of the white between neighbours as a share of its mean. The eye starts to see uneven spacing at around 5 %. In the old wordmark at 400 the white ran from 97 units (s·i) to 197 (e·s); in the new one all five gaps lie between 144 and 150.


## The φ sets the measure

In the first version the letters were drawn on a 500-unit x-height by their centrelines, so their ink ran from −20 to 530, while the φ’s loop ran from 21 to 501: the mark looked a size smaller than its own alphabet and floated above the baseline. Spacing could not fix that, so the metrics were rebuilt from the φ.

- The φ’s loop, 480 units tall, *is* the round x-height band. Round letters reach −8 and 472 at every weight; flat x-height is 464.
- At weight 400 the φ outline is the drawing, point for point. It is only translated 29 units down so that its loop overshoots the baseline exactly like a round letter.
- Ascenders 730, descenders −240 (the φ’s own stem ends at −244), ascending figures 640.
- The stem pitch of n (244 units) was chosen against the φ’s inner rhythm: its lobes are about 220 apart, so the φ reads as two letter-widths rather than as a foreign body.


## One brush for everything

Nothing in the font is a geometric solid. Letters, figures, punctuation, accents, the i-dot, the period and the middle dot are all the same thing: a centreline with a width profile, written by one tool.

- **The tool.** Nib at 38°, thick/thin 2.8, tapered ends, edges moved by an unsure hand (the same drift in units at every weight).
- **Touches.** A dot is a short pressed stroke: the nib is set down, dragged a little way across its own edge and lifted. The comma and the quotes are the same touch flicked away; dashes are short written strokes; the asterisk is three quick strokes through one point. Touches swell with the weight and the ones on the baseline stay on it.
- **Weight-aware skeleton.** Control points are drawn for 400. For other weights the skeleton is moved so that outer edges stay on the metric lines (a heavier brush eats into the letter, it does not make it taller) and letters widen slightly so counters do not clog. Feet and tips are pinned.
- **Fixed points, smooth ink.** Every stroke has a fixed number of outline points placed at fixed positions along its spline, identical in every master. They are stored as quadratic control points with no on-curve points between them, so the edge is smooth like the φ’s and still interpolates point for point. Contours are clockwise; strokes overlap and are flagged as overlapping.
- **Inner corners fill.** Where a turn is tighter than the brush is wide, the offset edge folds. Folds are unfolded, points that fall inside another part of the stroke are laid on a chord, pockets are closed and the corner is relaxed into a fillet — what ink does. The point count never changes.
- **Shared anatomy.** Entry, flag, head, tail, foot, arch and oval are functions; a letter is assembled from them. The bowl of d g q is the bowl of a, moved; b carries the bowl of p; c is e without its eye; f and t share one crossbar. If a control letter is retouched, the letters built from it follow.


## Spacing: measured on the ink

The method is the foundry n/o method with the judgment made explicit and repeatable.

- **Profiles.** Each glyph of each master is cut by scanlines every 4 units; the leftmost and rightmost ink on each line is its side profile.
- **Reference edge.** Each side has a structural edge: the extreme of its profile in the middle of the x-height (15–85 %). Entry hooks and exit tails live at the x-line and the baseline, so they never define the edge; they count as ink reaching into the gap. Sides whose structure is at the top or bottom (the arm of r, the bar of f and t, the diagonals) use the whole band.
- **Side white.** The white between the edge and the ink, over the x-height band, with the depth limit foundries use: 15 % of the x-height (70 units). Deeper white is an open counter and does not count.
- **Bearing = target − white.** A straight stem gets the full target; a bowl sits closer by exactly the white its curve already carries. Any two glyphs then enclose the same optical area, so the rhythm is even by construction and not by a table of exceptions.
- **Control letters and classes.** n and o are the controls; h, a, e, i, p, q, v, s complete the set. Sides that are the same gesture as a control take its bearing (=n, =h, =a, =i, =p, =q, =v …), so equal shapes are equal to the unit. The classes are in the table below.
- **Per weight.** The target white is 176 / 150 / 116 units at 300 / 400 / 800: it follows the counters, so the texture stays even from Light to Black. Masters are measured separately; varLib turns the differences into advance deltas.
- **Punctuation** has hand-set bearings (written for 400, scaled with the target), because its structure is not in the x-height band.

| class | side | control | members | white @400 | bearing 300 | 400 | 800 |
|---|---|---|---|---|---|---|---|
| straight · entry | left | n | i j m n p r t ı | 2 | 87 | 73 | 45 |
| straight · ascender | left | h | b h k l | 7 | 81 | 68 | 51 |
| round · o | left | o | o œ σ | 28 | 62 | 47 | 27 |
| round · bowl of a | left | a | a d g q æ α | 34 | 56 | 41 | 21 |
| round · back of e | left | e | c e ς | 32 | 58 | 43 | 23 |
| diagonal | left | v | v w y | 49 | 33 | 26 | 18 |
| open · s | left | s | s | 44 | 42 | 28 | 12 |
| straight · shoulder + exit | right | n | h m n | 8 | 84 | 67 | 50 |
| straight · stem + exit | right | i | a d i l u ı α | 2 | 92 | 73 | 57 |
| straight · no exit | right | q | g j q | 5 | 83 | 70 | 53 |
| round · o | right | o | o | 29 | 61 | 46 | 26 |
| round · bowl of p | right | p | b p | 30 | 60 | 45 | 24 |
| open · e | right | e | e œ æ | 44 | 45 | 31 | 11 |
| open · c | right | c | c | 57 | 29 | 18 | 3 |
| open · arm of r | right | r | r | 62 | 19 | 10 | -1 |
| diagonal | right | v | v w y | 43 | 44 | 32 | 14 |
| open · s | right | s | s | 41 | 48 | 34 | 15 |
| the φ | left | φ | φ | 39 | 51 | 36 | 18 |
| the φ | right | φ | φ | 37 | 53 | 38 | 19 |

Bearings are distances from the reference edge to the edge of the glyph box, not from the bounding box. That is why a tail or a hook can reach into its neighbour’s space without disturbing the rhythm.


## Slant and weight around a φ that will not lean

The shear pivots at mid x-height, so a slanted letter stays centred on its upright position and keeps its advance — the italic-angle offset is built into the outline rather than patched into the sidebearings. Because every letter is sheared alike, the white between letters is unchanged and the upright bearings hold.

The φ is the exception: it stays upright. In the slanted masters it is measured as the leaning letters see it (its profile sheared the other way) and gets its own bearings there; its outline is the same, only its position in the box changes. All three weights have a real slanted master, so the heavy slanted corner is drawn, not extrapolated.

The φ also follows the weight axis. Its Light and Black masters keep the drawing’s 434 points and move them so that the local stroke thickness matches the letters’ brush (a least-squares displacement field along the outline normals, with the crotches where loop meets stem treated separately). At 400 the deltas are zero: the glyph is the original, and it never leans. One honest limit: at 800 the small aperture at the top left of the loop tightens to about 30 units.


## Kerning: only what bearings cannot do

Two effects are measured on the same profiles, per master, and written as class pairs (classes are found from the profiles themselves: sides that agree within 7 units RMS share a class; alternates and accented letters ride with their base).

- **Nestling.** If at every height the two structural profiles leave room beyond the nominal gap (r·a, f·o, x·v …), the second glyph is pulled in by 60 % of that room (35 % against punctuation, which carries its own bearings).
- **Clearance.** Nothing, tails and extenders included, may come closer than a quarter of the straight gap; if it would, the pair is pushed apart.

The font carries 644 class pairs (48 first classes, 43 second classes): 78 between letters, 268 involving figures, 298 against punctuation. The table lists the letter pairs that move 20 units or more in some weight; the complete list is printed by the build report.

| first | second | 300 | 400 | 800 | why |
|---|---|---|---|---|---|
| f | a c d e g o q œ … | -25 | -19 | -13 | nestles |
| f | t | 0 | 8 | 23 | clearance |
| k | s | 43 | 22 | 3 | clearance |
| k | x | 20 | 14 | 15 | clearance |
| k | z | 46 | 35 | 29 | clearance |
| k | ε | 24 | 17 | 22 | clearance |
| r σ | a c d e g o q œ … | -33 | -26 | -20 | nestles |
| r σ | f | 6 | 14 | 22 | clearance |
| r σ | t | 13 | 21 | 27 | clearance |
| r σ | ε | -20 | -15 | -12 | nestles |
| r σ | ς φ | -21 | -17 | -14 | nestles |
| t | a c d e g o q œ … | -26 | -21 | -14 | nestles |
| t | ς φ | -31 | -24 | -14 | nestles |
| v w y | a c d e g o q œ … | -20 | -15 | -11 | nestles |
| x | v w | -42 | -32 | -22 | nestles |
| x | y | -42 | -32 | -22 | nestles |
| x | ς φ | -24 | -15 | -7 | nestles |
| z | t | 0 | 10 | 23 | clearance |
| φ | v w | -24 | -13 | 0 | nestles |
| φ | x | -24 | -17 | -7 | nestles |
| φ | y | -24 | -15 | -4 | nestles |

The pair list and the classes are identical in every master, only the values differ, so the six GPOS tables merge into variable kerning: a pair can be −13 at 400 and −25 at 800 and every weight in between gets its own value.


## Written, not stamped

Every letter has three drawings: the reference and two re-writings of the same skeleton — a slow deformation of the whole glyph so joins stay joined (a little wider or narrower, a degree more or less lean, never shifted as a whole), some play in the free stroke ends, slightly different pressure, a different edge. One contextual lookup rotates them along each run of letters:

`sub @c0 @c0' by @c1;&nbsp;&nbsp; sub @c1 @c0' by @c2;`

After a reference drawing comes the second, after the second the third, then the reference again: 0 1 2 0 1 2 … from the first letter of every word. Neighbouring letters are therefore never the same drawing — ss, ee, ll, oo cannot look stamped — and the result is deterministic: the same word always sets the same way. A non-letter restarts the cycle. Alternates share the metrics and kerning classes of their letter, so the rhythm does not move when the feature is switched off.


## Figures, marks, capitals, Greek, ligatures

- **Oldstyle figures.** The face has no capitals, so lining figures would have nothing to align with and would stand in the text like a row of capitals. Oldstyle figures live in the lowercase rhythm: 0 1 2 at x-height, 6 8 ascending, 3 4 5 7 9 descending. They are proportional by default and spaced by the same engine; `tnum` centres the same drawings on one common width for tables.
- **Capitals** are mapped in the cmap to the lowercase glyphs, accented capitals included, so typed capitals always render and there is no second alphabet to keep in step.
- **Accents** are composites: the base letter (in all three drawings) plus a brush-written mark placed over the middle of the letter’s structure; î and ï carry narrower marks so they do not reach into their neighbours. œ and æ are written from the strokes of o, a and e; ß is a long s with a small s written into it, open at the foot.
- **Greek.** α ε σ ς were drawn so that the word the face is named after can be set — αφεσις — with ι ο ν sharing the Latin drawings. It is a courtesy, not a Greek alphabet.
- **No ligatures.** The beak of the f stops short of the next letter’s ascender or dot, so f·i, f·l, f·f never collide; the pairs are solved by spacing and kerning. A drawn fi would bring a second logic into a hand whose point is that every letter is written separately.


## The icon style, as stylistic set 1

The site’s icons are brush outlines filled with a scatter of small squares. `ss01` gives four symbols that treatment: the middle dot becomes a small ring with grains inside (the circled point of the old tables), the asterisk gets dust between its rays, the number sign a dusted middle field and the ampersand a dusted bowl. The squares are thrown by the same xorshift generator the icons use and are kept only where they clear the ink in every weight master, so the same squares exist at every weight (they move with the skeleton and swell a little, never appear or vanish). At text sizes they turn to grey, which is why they are an opt-in set and not the default.


## The family

Six masters (300, 400, 800 × upright, −16) build one variable font. fvar carries ten named instances — Light 300, Regular 400, Medium 500, Bold 700, Black 800 and their Slanted partners — and STAT describes both axes (Regular linked to Bold, Upright linked to Slanted and elidable). Line metrics are the same in hhea, OS/2 typo and OS/2 win (820 / −280), with USE_TYPO_METRICS set. The ten statics are cut from the variable font with the instancer and named for four-style linking: within each weight the Slanted cut is the italic partner of the upright one.

**fontbakery** (check-universal): the variable font passes with 0 FAIL and 0 WARN. The ten statics, checked together as a family, give 0 FAIL and 10 WARN — one per file and the same notice each time, `contour_count`: the glyphs have more contours than conventional outlines, because every stroke is its own overlapping contour. That is the construction, not a defect. Three earlier warnings were fixed rather than explained away: outline points that crowded onto one grid unit inside tight turns are now re-spaced, the soft hyphen is no longer mapped, and ss01 carries a name.

**OpenType Sanitizer**: all 22 files (the variable font and ten statics, TTF and WOFF2) pass.


## How it was made and checked

The lead owned the spec (brush rules, metrics, spacing model, master structure), the control letters n o i h a e p s, the spacing engine, the build and the review. Glyph groups were drawn against that spec by subagents — round letters; straight letters; diagonals; figures; punctuation and symbols; marks — each returning one module and proof sheets; another derived the weight masters of the φ. Everything was reviewed on rendered proofs before it went in and corrected where it left the hand (the f, t, ß, the asterisk and the brackets were redrawn at review).

Proofs are rendered by Chromium from the built fonts, so they show real shaping: control strings for every letter (nn·nn··nn, oo·oo··oo, between a e s i and against the φ), hamburgefontsiv, pangrams, Latin texts, all at 300 / 400 / 800 and at slant 0 / −16. Two independent passes then looked at the result without the engine: one measured the optical white of every ordered pair of a–z and φ on the finished font at the six corner instances, the other took the files apart (tables, names, interpolation at 65 locations, shaping, statics against the variable font). The technical pass found no structural fault; its four small findings were fixed — overlap flags on the tabular-figure composites, empty OS/2 strikeout and script fields and a restrictive embedding bit, the φ re-rounded by up to a unit between the upright and slanted masters (it is now moved by whole units only, so its outline is the same everywhere), and Upright not linked to Slanted in STAT. It also confirmed that the φ at 400 is the original drawing to within the rounding of the unit grid (0.67 units at most against the original curve).

**Independent spacing review.** A reviewer that never saw the engine measured, on a snapshot of the finished font, the white of all 729 ordered pairs of a–z and φ on rasterised outlines at the six corner instances (its ruler validated against FreeType and Chromium). Its verdict on the letter fit: spread 7.9–8.7 % at every corner, 88–91 % of pairs within ±12 % of n·n, nothing moving by more than 0.7 % with slant, no overlap anywhere. The faults it found were all in the layer above the sidebearings, mostly in the Black: nestling kerns that were constant in units and so too strong at 800 (f·o, r·g, x·v), clearance pushes below 20 units lost to a threshold, alternates that shared their letter’s metrics although their edges differ (near-touches at 800 with calt on: “after”, “skill”, “otter”), the leg of k, brackets against ascenders, periods floating after v w y, an asterisk wider than its advance. Every one of these was changed in the engine, not patched pair by pair. Re-measured afterwards with fontmeasure.py (one ruler, 15 % depth limit, snapshot against final build): over the same 729 pairs the spread goes from 10.4 / 9.4 / 9.9 % to 9.2 / 6.8 / 5.4 % at 300 / 400 / 800, and no two letters come closer than 20 units in any drawing the cycle can bring together at 300, 400, 700 or 800 upright (five pairs sit at 19–20 units in the slanted Black). The Light figure moves least because that ruler takes the tip of a hairline exit tail for the edge of the letter, which the engine deliberately does not.


## Known limits

- The alternates are deliberately quiet: at text sizes they are invisible, at display sizes they keep doubled letters from looking stamped.
- The cycle runs by position in the word, not per letter: neighbours and letters two apart always differ, but the same letter three places on is the same drawing again (the first and third s of possess).
- The Black weight closes small apertures (the top left of the φ, the eye of e, the upper counter of 8). It is a display weight.
- Exit tails come within a quarter-gap of the next letter at 800; at small sizes heavy pairs such as e·s can read as joined, which suits a script but is not a join the hand actually makes.
- Greek is four letters, without accents. There are no capitals, small capitals, lining figures, fractions or combining marks, and no ¿ ¡ « » € % + =.
- In the slanted styles tall and deep shapes lean out of their boxes (the tail of j by up to 0.2 em at the start of a line in the Black): leave padding where a container clips.


## Using it

`@font-face { font-family: "Aphesis Script"; src: url("AphesisScript-VF.woff2") format("woff2"); font-weight: 300 800; font-style: oblique 0deg 16deg; }`

- Weight: `font-weight: 300…800` (Black is 800). Slant: `font-style: oblique 16deg`, or `font-variation-settings: "slnt" -16`; the axis is slnt, not ital, so a bare `italic` will not reach the full lean.
- Alternates are on by default (`calt`). Tabular figures: `font-variant-numeric: tabular-nums` — one width in every weight. The icon style: `font-feature-settings: "ss01"`.
- The variable font and the static Regular carry the same names: install one or the other, not both.


## Extending it

A new glyph is a few control points in a glyphs module, assembled from the shared parts (entry, flag, tail, foot, arch, oval). It needs no advance width: the engine measures it. If a side is the same gesture as a control letter, add it to the keys; kerning classes and pairs are recomputed from its profile at build time. `python3 build.py --report` prints every bearing, class and pair for review; `python3 fontmeasure.py` re-measures the finished font.
