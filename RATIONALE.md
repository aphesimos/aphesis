# Aphesis Script — rationale

## What this is

Aphesis Script is a lowercase-only display hand for aphes.is: a wide, upright humanist cursive — the cancellaresca of the Renaissance hermeticists, with some half-uncial roundness — written with the brush of the hand-drawn φ. It began as a spacing repair for six letters. The owner then widened the brief to the whole family in one run, with freedom to rebuild, so the earlier skeletons and numbers were used as input, not as limits.

Three things were kept from the first version because they are the identity: the brush (centreline plus width profile, nib at 38°, thick/thin 2.8, tapered ends, unsure edges), the φ drawing itself, and the axes (wght 300–800 with 400 = the φ’s stroke, slnt −16…0 with the φ upright at every slant).

The order of priorities throughout: the wordmark aφesis first, then an even rhythm at every weight and slant, then one hand across every glyph, then the size of the character set.

Version 2.1 adds everything the site sets that is not Latin. The site uses two faces only — this one for the logo, the titles and the Latin and Greek glosses, Special Elite for everything else — and Special Elite has neither Greek nor Chinese. So the family now carries the whole Greek lowercase with its monotonic and polytonic accents, the four characters of 色即是空, and the signs that were missing: ¡ ¿ « » ‹ › € % + − = and the combining marks. The Latin of 2.0 is kept to the unit — every outline, every advance, every kern — except for one defect that the work on the extension turned up, which is corrected and listed below.


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

The φ also follows the weight axis. Its Light and Black masters keep the drawing’s 434 points and move them so that the local stroke thickness matches the letters’ brush (a least-squares displacement field along the outline normals, with the crotches where loop meets stem treated separately). At 400 the deltas are zero: the glyph is the original, and it never leans. One honest limit: at 800 the small aperture at the top left of the loop tightens to about 30 units. (For running Greek in the slanted styles there is an optional φ that leans, `ss02`; see the Greek section.)


## Kerning: only what bearings cannot do

Two effects are measured on the same profiles, per master, and written as class pairs (classes are found from the profiles themselves: sides that agree within 7 units RMS share a class; alternates and accented letters ride with their base).

- **Nestling.** If at every height the two structural profiles leave room beyond the nominal gap (r·a, f·o, x·v …), the second glyph is pulled in by 60 % of that room (35 % against punctuation, which carries its own bearings).
- **Clearance.** Nothing, tails and extenders included, may come closer than a quarter of the straight gap; if it would, the pair is pushed apart.

The font carries 3229 class pairs (124 first classes, 97 second classes): 975 between letters, 542 involving figures, 1393 against punctuation. The table lists the letter pairs that move 20 units or more in some weight; the complete list is printed by the build report.

| first | second | 300 | 400 | 800 | why |
|---|---|---|---|---|---|
| c ç | phi.ss02 | -24 | -16 | -9 | nestles |
| f | a c d e g o q œ … | -25 | -19 | -13 | nestles |
| f | t | 0 | 8 | 23 | clearance |
| f | ό ὀ ὁ ὂ ὃ ὄ ὅ ὸ | -23 | -18 | -11 | nestles |
| f | phi.ss02 | -25 | -19 | -13 | nestles |
| k | s | 43 | 22 | 3 | clearance |
| k | x | 20 | 14 | 15 | clearance |
| k | z | 46 | 35 | 29 | clearance |
| r | a c d e g o q œ … | -33 | -26 | -20 | nestles |
| r | f | 6 | 14 | 22 | clearance |
| r | t | 13 | 21 | 27 | clearance |
| r | ý ÿ | 27 | 24 | 15 | clearance |
| r | ό ὀ ὁ ὂ ὃ ὄ ὅ ὸ | -27 | -21 | -15 | nestles |
| r | phi.ss02 | -34 | -25 | -18 | nestles |
| t | a c d e g o q œ … | -26 | -21 | -14 | nestles |
| t | ό ὀ ὁ ὂ ὃ ὄ ὅ ὸ | -20 | -17 | -11 | nestles |
| t | phi.ss02 | -40 | -31 | -19 | nestles |
| v w y ý ÿ | a c d e g o q œ … | -20 | -15 | -11 | nestles |
| x | v w | -42 | -32 | -22 | nestles |
| x | y | -42 | -32 | -22 | nestles |
| x | ý ÿ | -42 | -32 | -22 | nestles |
| x | phi.ss02 | -32 | -23 | -12 | nestles |
| z | t | 0 | 10 | 23 | clearance |
| φ | v w | -24 | -13 | 0 | nestles |
| φ | x | -24 | -17 | -7 | nestles |
| φ | y | -24 | -15 | -4 | nestles |
| phi.ss02 | v w | -24 | -13 | 0 | nestles |
| phi.ss02 | x | -24 | -17 | -7 | nestles |
| phi.ss02 | y | -24 | -15 | -4 | nestles |

The pair list and the classes are identical in every master, only the values differ, so the six GPOS tables merge into variable kerning: a pair can be −13 at 400 and −25 at 800 and every weight in between gets its own value.

Classes are formed in the order the family grew — Latin first, then Greek — so adding the Greek did not move a single Latin pair. The table above is the Latin; the Greek pairs are listed in the Greek section.


## Written, not stamped

Every letter has three drawings: the reference and two re-writings of the same skeleton — a slow deformation of the whole glyph so joins stay joined (a little wider or narrower, a degree more or less lean, never shifted as a whole), some play in the free stroke ends, slightly different pressure, a different edge. One contextual lookup rotates them along each run of letters:

`sub @c0 @c0' by @c1;&nbsp;&nbsp; sub @c1 @c0' by @c2;`

After a reference drawing comes the second, after the second the third, then the reference again: 0 1 2 0 1 2 … from the first letter of every word. Neighbouring letters are therefore never the same drawing — ss, ee, ll, oo cannot look stamped — and the result is deterministic: the same word always sets the same way. A non-letter restarts the cycle. Every drawing is fitted on its own ink and rides in its letter’s kerning class, so the rhythm holds whichever drawing is set, with the feature on or off. The φ has one drawing, the logo’s. Between Latin letters it restarts the cycle, as it always did, so aφesis sets exactly as before; inside a Greek word it takes its turn in the cycle, so the letters around it go on rotating (σοφός, φιλοσοφία).


## Figures, marks, capitals, Greek, ligatures

- **Oldstyle figures.** The face has no capitals, so lining figures would have nothing to align with and would stand in the text like a row of capitals. Oldstyle figures live in the lowercase rhythm: 0 1 2 at x-height, 6 8 ascending, 3 4 5 7 9 descending. They are proportional by default and spaced by the same engine; `tnum` centres the same drawings on one common width for tables.
- **Capitals** are mapped in the cmap to the lowercase glyphs, accented capitals included, so typed capitals always render and there is no second alphabet to keep in step.
- **Accents** are composites: the base letter (in all three drawings) plus a brush-written mark placed over the middle of the letter’s structure; î and ï carry narrower marks so they do not reach into their neighbours. œ and æ are written from the strokes of o, a and e; ß is a long s with a small s written into it, open at the foot.
- **Greek** began as four letters, α ε σ ς, so that the word the face is named after could be set. It is now a whole alphabet with its accents; see the next section.
- **No ligatures.** The beak of the f stops short of the next letter’s ascender or dot, so f·i, f·l, f·f never collide; the pairs are solved by spacing and kerning. A drawn fi would bring a second logic into a hand whose point is that every letter is written separately.


## Greek: the whole alphabet, monotonic and polytonic

The Greek is not a second design. It is the same hand writing another alphabet: upright, round, plain modern letterforms, no ligatures and no historical abbreviations, on the same metric lines and with the same parts.

- **Letters from the parts the Latin already has.** η is the n whose second stem runs on below the line to a point; μ is the u whose first stem does; κ is the k at x-height, with k’s own arm and leg; τ and π stand under the written bar of f and t; ρ is the bowl of p without an entry, round at the top left; ι is the a’s stem alone, set down on the x-line without an entry and turned into the exit; υ is the u’s bowl without its second stem, ψ the same bowl with a stem through it; θ is the o’s turn of the brush taken up to the ascender line, with a written bar; β is the long s of ß carried down to a point, with the bowl of p closing it; γ is the v whose thick stroke runs on into a descender, χ an x standing on the descender line, λ the long full-brush diagonal with a hairline leg, turning into the exit as k’s leg does. δ is the o entered through a neck that is the spine of an s; ζ and ξ begin with one written bar under the ascender line and end in the ς’s own back, baseline run and tail; ω is two cups that meet in a point, a round w. ο and ν are the Latin o and v, the same gestures. The φ is the logo itself.
- **Spacing** is the same engine with the same targets. A side that is a control letter’s gesture is keyed to it (the table shows which); everything else is measured on its own ink. η and ο are the controls of the Greek proofs, as n and o are of the Latin ones.
- **Marks.** Greek does not borrow the Latin acute and grave. A polytonic line has to tell a breathing from the accent beside it, also at text sizes, so the two are made unlike each other. Oxia (which is also the tonos) and varia are long, slim, straight flicks: pressed at the top, drawn down and lifted, slimmer and longer than the Latin accents. The breathings are short round hooks, a comma and a comma turned round: a pressed head at the top, a round back, a thin tail — the psili’s to the lower left, the dasia’s to the lower right. The perispomeni is a round cap in one arc, so it cannot be mistaken for the angular Latin circumflex; then macron and breve, and the iota subscript, a very small ι with the ι’s own turn at its foot, hung under α η ω. The dialytika is the dieresis the Latin already had. Three things keep the marks legible where polytonic usually breaks down. They keep their size across the weights better than the Latin accents do: in the Light a breathing is 55 × 88 units (the Latin acute, which shrinks faster with the brush, is 47 × 77 there), and in the Black the marks do not run into each other. In the slanted styles they lean only half as much as the letters, so the varia still falls to the right instead of standing up like a dot. And a stack — breathing beside oxia or varia, breathing under the perispomeni, dialytika with an accent between the dots — is one mark glyph, built by code from the strokes of the single marks at their own size: the gestures are literally the same, a hook beside a flick, and a stack is spaced as a whole instead of being two marks pushed together by a positioning rule. In the Black the parts of a stack keep at least 26 units between them.
- **Accented letters come from the standard, not from a list.** The build walks the Greek and Greek Extended blocks, takes the canonical decomposition of every lowercase letter and assembles it: the letter (in all three of its drawings), one mark glyph above on the letter’s anchor, the iota subscript below where there is one. That gives 123 accented Greek letters as 123 composites (ά with tonos and ά with oxia are one glyph); the 27 accented Latin letters are made the same way, with the Latin marks, and are what they were. ο is the Latin o, but ό is not the Latin ó: it carries the Greek oxia. On the narrow ι the dieresis is the closer-written one the Latin ï already used.
- **Capitals** map to the small letters, as in Latin: Α → α, Ἀ → ἀ, ᾈ → ᾀ. A capital Σ is set as σ, and as ς where it ends a word, so ΛΟΓΟΣ sets as λογος and ΑΣΦΑΛΕΙΑ as ασφαλεια.
- **Decomposed text.** The combining marks (U+0300 – U+0345) are in the font. `ccmp` turns a letter followed by combining marks into the precomposed letter, also from every precomposed stage on the way (ἀ + U+0301 → ἄ); in a Greek run the Greek composition is tried first, so ο + U+0301 becomes ό with the oxia and not the Latin ó. A mark that finds no precomposed letter is placed by `mark` on the same anchor the composites are built with, in every master; GDEF lets the alternates and the kerning look past marks.
- **The raised point.** The Greek ano teleia stands at the x-line, where the middle dot stands at mid-height. U+0387 is that sign; and because Unicode treats it as the same character as the middle dot, a middle dot that follows a Greek letter directly is set as the ano teleia too (`locl`: λόγος·). Between spaces the middle dot stays what the site uses it for, the separator.
- **The φ in Greek.** The φ is the logo’s drawing and, as the brief asks, stands upright at every slant. In an upright Greek line that is simply the φ. In a slanted one it is the only letter that does not lean, which is right for the wordmark and odd in φιλοσοφία — so there is a φ that leans, the same drawing sheared like every letter, as stylistic set 2. It is off by default: nothing changes unless `ss02` is asked for.
- **Kerning with the marks on.** An accented letter keeps its letter’s bearings, but for kerning it is measured with its marks, as they stand in each master. Over α η ο υ ω the marks stay inside the letter’s edges and the composite rides in its letter’s class. Over the narrow ι a breathing with an accent is wider than the letter: those composites get classes of their own and are kept clear of ascenders and of each other by the same clearance rule as everything else.

The table shows what each side of each letter is fitted to, and the bearings that result (units, from the reference edge to the edge of the box):

| letter | left side | right side | bearings L / R at 300 | 400 | 800 | advance at 400 |
|---|---|---|---|---|---|---|
| α | = a | measured | 59 / 66 | 43 / 54 | 23 / 38 | 470 |
| β | measured | = p | 84 / 58 | 71 / 43 | 54 / 22 | 445 |
| γ | = v | = v | 34 / 44 | 27 / 32 | 18 / 14 | 408 |
| δ | = o | = o | 61 / 64 | 47 / 48 | 26 / 27 | 451 |
| ε | measured | measured | 53 / 28 | 39 / 17 | 20 / 3 | 355 |
| ζ | = e | measured | 56 / 24 | 41 / 13 | 21 / 0 | 339 |
| η | = n | = q | 87 / 78 | 73 / 65 | 44 / 48 | 454 |
| θ | measured | measured | 70 / 71 | 57 / 56 | 39 / 36 | 429 |
| ι | measured | = i | 84 / 92 | 71 / 75 | 53 / 56 | 221 |
| κ | = ι | measured | 84 / 58 | 71 / 41 | 53 / 31 | 381 |
| λ | measured | measured | 33 / 53 | 23 / 41 | 8 / 33 | 368 |
| μ | = ι | = i | 86 / 90 | 73 / 73 | 54 / 55 | 467 |
| ν | the Latin v |  | 33 / 44 | 26 / 32 | 18 / 14 | 409 |
| ξ | = e | measured | 55 / 24 | 41 / 13 | 22 / 0 | 340 |
| ο | the Latin o |  | 62 / 61 | 47 / 46 | 27 / 26 | 452 |
| π | measured | measured | 24 / 26 | 19 / 17 | 14 / 10 | 467 |
| ρ | measured | = p | 75 / 57 | 60 / 42 | 40 / 22 | 428 |
| σ | = o | measured | 63 / 22 | 48 / 12 | 28 / -1 | 500 |
| ς | = e | measured | 59 / 34 | 44 / 24 | 24 / 10 | 347 |
| τ | measured | measured | 25 / 20 | 20 / 10 | 15 / 1 | 254 |
| υ | = u | measured | 78 / 71 | 64 / 55 | 38 / 32 | 431 |
| φ | the hand-drawn φ |  | 51 / 53 | 36 / 38 | 18 / 19 | 593 |
| χ | measured | measured | 29 / 38 | 21 / 26 | 11 / 10 | 367 |
| ψ | = u | = υ | 77 / 66 | 62 / 51 | 39 / 30 | 543 |
| ω | measured | measured | 72 / 68 | 57 / 53 | 37 / 31 | 662 |

Kerning is the same two measurements as in the Latin, nestling and clearance, with two additions for everything that came after 2.0. A later glyph rides in an existing kerning class only if it would get the same kern as the class’s first member against every class of the other side, in all six masters, within 6 units — and only if that kern also keeps the glyph itself clear; otherwise it founds a class of its own. That is how τ, which looks like π to the profile but stands closer to its neighbour, got its own clearance in the Black. And between later glyphs the clearance is also a true distance: no two points of ink nearer than 24 units in any direction, measured in the slanted masters as the shapes lean (the Latin keeps the rule it was checked with: a quarter of the gap along the line). The Greek pairs that move 24 units or more in some weight (Greek beside Greek; the rest is printed by the build report):

| first | second | 300 | 400 | 800 | why |
|---|---|---|---|---|---|
| ο | λ | -24 | -17 | -12 | nestles |
| ν | λ | -34 | -22 | -13 | nestles |
| ζ | ο | -28 | -20 | -11 | nestles |
| ζ | ν | -42 | -32 | -22 | nestles |
| ζ | ς φ | -42 | -27 | -13 | nestles |
| ζ | θ | -30 | -21 | -11 | nestles |
| ζ | ξ | -42 | -32 | -16 | nestles |
| ζ | π | -42 | -29 | -16 | nestles |
| ζ | χ | -42 | -32 | -21 | nestles |
| ζ | α | -25 | -18 | -10 | nestles |
| ζ | σ | -26 | -17 | -8 | nestles |
| ζ | δ | -25 | -17 | -8 | nestles |
| ζ | ψ | -27 | -18 | -10 | nestles |
| ζ | γ | -42 | -32 | -22 | nestles |
| ζ | ζ | -42 | -32 | -16 | nestles |
| ζ | τ | -42 | -30 | -16 | nestles |
| θ | λ | -26 | -19 | -12 | nestles |
| λ | ε | 21 | 24 | 32 | clearance |
| λ | λ | 40 | 42 | 43 | clearance |
| χ | ο | -24 | -19 | -14 | nestles |
| χ | λ | -34 | -22 | -13 | nestles |
| φ | λ | -32 | -21 | -13 | nestles |
| φ | π | -27 | -20 | -13 | nestles |
| φ | χ | -24 | -17 | -7 | nestles |
| φ | γ | -24 | -13 | 0 | nestles |
| φ | τ | -27 | -20 | -13 | nestles |
| β | λ | -34 | -25 | -19 | nestles |
| ρ | λ | -36 | -27 | -20 | nestles |
| ε | ν | -25 | -17 | -10 | nestles |
| ε | π | -25 | -17 | -5 | nestles |
| ε | χ | -25 | -17 | -3 | nestles |
| ε | γ | -25 | -17 | -10 | nestles |
| ε | τ | -25 | -17 | 1 | nestles / clearance |
| κ | λ | 49 | 41 | 39 | clearance |
| σ | ο | -37 | -29 | -21 | nestles |
| σ | ς φ | -24 | -19 | -14 | nestles |
| σ | λ | -34 | -21 | -12 | nestles |
| σ | ξ | -27 | -19 | -11 | nestles |
| σ | α | -35 | -27 | -20 | nestles |
| σ | σ | -27 | -20 | -14 | nestles |
| σ | δ | -30 | -23 | -16 | nestles |
| σ | ζ | -26 | -21 | -17 | nestles |
| π | ς φ | -24 | -15 | -7 | nestles |
| π | ξ | -29 | -20 | -11 | nestles |
| π | ζ | -29 | -19 | -11 | nestles |
| τ | ο | -28 | -23 | -15 | nestles |
| τ | ς φ | -31 | -24 | -15 | nestles |
| τ | ξ | -32 | -19 | -10 | nestles |
| τ | α | -26 | -21 | -14 | nestles |
| τ | σ | -24 | -19 | -12 | nestles |
| τ | δ | -24 | -19 | -12 | nestles |
| τ | ζ | -28 | -24 | -18 | nestles |
| γ | λ | -34 | -22 | -13 | nestles |
| ξ | ο | -28 | -20 | -11 | nestles |
| ξ | ν | -42 | -32 | -22 | nestles |
| ξ | ς φ | -42 | -27 | -13 | nestles |
| ξ | θ | -30 | -21 | -11 | nestles |
| ξ | λ | 0 | 4 | 24 | clearance |
| ξ | ξ | -42 | -32 | -16 | nestles |
| ξ | π | -42 | -29 | -16 | nestles |
| ξ | χ | -42 | -32 | -21 | nestles |
| ξ | α | -25 | -18 | -10 | nestles |
| ξ | σ | -26 | -17 | -8 | nestles |
| ξ | δ | -25 | -17 | -8 | nestles |
| ξ | ψ | -27 | -17 | -10 | nestles |
| ξ | γ | -42 | -32 | -22 | nestles |
| ξ | ζ | -42 | -32 | -16 | nestles |
| ξ | τ | -42 | -30 | -16 | nestles |
| ψ | λ | -28 | -20 | -13 | nestles |
| ω | λ | -28 | -20 | -15 | nestles |

Measured on the finished font with the ruler of the before/after table (optical white between neighbours, kerning and alternates on, as the font sets by default): over the Greek control string, a pangram and the six lines the site sets, the mean white is 168 / 144 / 113 units at 300 / 400 / 800 with a spread of 6.9 / 5.9 / 4.6 %; Latin text measured the same way gives 166 / 146 / 116 units and 4.9 / 3.6 / 4.6 %. The two scripts keep one rhythm.


## 色即是空

One passage of the site is 色即是空 — form is emptiness — and it has to be set in this face, because the text face has no Chinese either. Four characters do not make a CJK font, and they are not meant to: they are four glyphs of this family.

- **Why the brush fits.** The nib is held at 38°: strokes that rise to the right are hairlines, horizontals are lighter than verticals, strokes that fall to the right are the full brush. That is the contrast of regular script (楷書) — light 橫, firm 豎, a 撇 drawn out thin, a heavy 捺 — so the characters could be written with the tool as it is. Nothing is borrowed from another typeface and nothing is traced.
- **One stroke of the character is one stroke of the brush**, in stroke order — six, seven, nine and eight of them — with the letters’ own gestures: a 豎 is set down like the head of a stem and lifted like a stem on the baseline, or drawn out to a point like a descender (the needle of 即); a 橫 rises a few degrees and is pressed slightly where its end is free; a 撇 is written at full pressure and the nib itself thins it; hooks and flicks leave a true corner and thin out from before it; a 點 is the letters’ dot. The skeleton is pinned: at other weights only the brush changes, so the structure is the same from Light to Black and the same strokes exist in every master.
- **Size and weight.** The characters stand on the lowercase: ink from about 85 units below the baseline to about 695 above it, a little under the ascender line, 640 to 730 wide, so a line of mixed text keeps one band. Their strokes are written with less pressure than the letters’ stems (about 0.8 on 橫, 0.85 on 豎 and 捺, less inside the 日 of 是, close to the full brush on 空, which has the least ink): a dense character needs a lighter stroke to make the same grey. Measured, a line of 色即是空 carries 1.04 to 1.07 times the ink of a line of letters at every weight from 300 to 800. The Black was planned first: the tightest white between parallel strokes, between the bars of the 日 in 是, is still 37 units at 800.
- **Upright, hand-set, kept clear.** Like the φ, the characters do not lean in the slanted styles, and they keep the same box at every slant. Their sidebearings are set by hand on the whole height of the ink, so the four stand evenly in a row whatever their width (色 is narrower than 是, as it is written); the bearings scale with the weight like the punctuation’s. Among themselves they are not kerned, and they take no part in the alternates. Against everything else they are kerned in one direction only: nothing is ever pulled in, but where a leaning neighbour would take their white — a parenthesis or a quotation mark tipping over the top, a period or a comma sliding under the foot — the pair is pushed apart until the character has the white it has in the upright style. So 色即是空. and (色即是空) set cleanly in the slanted styles too.


## The signs that were missing

¡ and ¿ are not rotated copies of ! and ?: turning a stroke over would put the brush’s thick and thin in the wrong places. They are written again for the lowercase — the touch hangs from the x-line at every weight, as the dot of ! and ? stands on the baseline, and the stroke hangs below it to −176, as far under the baseline as the upright signs rise over the x-line. « » ‹ › are chevrons in the x-height, each one movement with a true corner: thin down to the left, full down to the right, and the right-hand ones the same stroke turned over, so the pair weighs the same; the double ones stand far enough apart to keep their white in the Black. € is the family’s oval between the baseline and the figure line, with two written bars; it stands with the ascending figures 6 and 8. % is the ring of å written larger, twice, and the slash. + − = are the dash, 306 units long, on one common width, so sums line up. µ is the Greek μ.


## The icon style, as stylistic set 1

The site’s icons are brush outlines filled with a scatter of small squares. `ss01` gives four symbols that treatment: the middle dot becomes a small ring with grains inside (the circled point of the old tables), the asterisk gets dust between its rays, the number sign a dusted middle field and the ampersand a dusted bowl. The squares are thrown by the same xorshift generator the icons use and are kept only where they clear the ink in every weight master, so the same squares exist at every weight (they move with the skeleton and swell a little, never appear or vanish). At text sizes they turn to grey, which is why they are an opt-in set and not the default.


## The family

Six masters (300, 400, 800 × upright, −16) build one variable font. fvar carries ten named instances — Light 300, Regular 400, Medium 500, Bold 700, Black 800 and their Slanted partners — and STAT describes both axes (Regular linked to Bold, Upright linked to Slanted and elidable). Line metrics are the same in hhea, OS/2 typo and OS/2 win (820 / −280), with USE_TYPO_METRICS set. The ten statics are cut from the variable font with the instancer and named for four-style linking: within each weight the Slanted cut is the italic partner of the upright one. Each static says in its own STAT where it sits on the same two axes, wght and slnt.

**fontbakery** (check-universal, on 2.101): no check fails. The variable font gives 1 WARN and the ten statics, checked together as a family, 20 — two notices, each once per file. `cjk_not_enough_glyphs`: a font that maps any Chinese character is expected to carry at least 150 of them; this one carries four, on purpose. `contour_count` (statics only): the glyphs have more contours than conventional outlines, because every stroke is its own overlapping contour. Both are the design, not defects. Three warnings of the first release were fixed rather than explained away: outline points that crowded onto one grid unit inside tight turns are re-spaced, the soft hyphen is not mapped, and ss01 carries a name.

**OpenType Sanitizer**: all 22 files (the variable font and ten statics, TTF and WOFF2) pass.


## How it was made and checked

The lead owned the spec (brush rules, metrics, spacing model, master structure), the control letters n o i h a e p s, the spacing engine, the build and the review. Glyph groups were drawn against that spec by subagents — round letters; straight letters; diagonals; figures; punctuation and symbols; marks — each returning one module and proof sheets; another derived the weight masters of the φ. Everything was reviewed on rendered proofs before it went in and corrected where it left the hand (the f, t, ß, the asterisk and the brackets were redrawn at review).

Proofs are rendered by Chromium from the built fonts, so they show real shaping: control strings for every letter (nn·nn··nn, oo·oo··oo, between a e s i and against the φ), hamburgefontsiv, pangrams, Latin texts, all at 300 / 400 / 800 and at slant 0 / −16. Two independent passes then looked at the result without the engine: one measured the optical white of every ordered pair of a–z and φ on the finished font at the six corner instances, the other took the files apart (tables, names, interpolation at 65 locations, shaping, statics against the variable font). The technical pass found no structural fault; its four small findings were fixed — overlap flags on the tabular-figure composites, empty OS/2 strikeout and script fields and a restrictive embedding bit, the φ re-rounded by up to a unit between the upright and slanted masters (it is now moved by whole units only, so its outline is the same everywhere), and Upright not linked to Slanted in STAT. It also confirmed that the φ at 400 is the original drawing to within the rounding of the unit grid (0.67 units at most against the original curve).

**Independent spacing review.** A reviewer that never saw the engine measured, on a snapshot of the finished font, the white of all 729 ordered pairs of a–z and φ on rasterised outlines at the six corner instances (its ruler validated against FreeType and Chromium). Its verdict on the letter fit: spread 7.9–8.7 % at every corner, 88–91 % of pairs within ±12 % of n·n, nothing moving by more than 0.7 % with slant, no overlap anywhere. The faults it found were all in the layer above the sidebearings, mostly in the Black: nestling kerns that were constant in units and so too strong at 800 (f·o, r·g, x·v), clearance pushes below 20 units lost to a threshold, alternates that shared their letter’s metrics although their edges differ (near-touches at 800 with calt on: “after”, “skill”, “otter”), the leg of k, brackets against ascenders, periods floating after v w y, an asterisk wider than its advance. Every one of these was changed in the engine, not patched pair by pair. Re-measured afterwards with fontmeasure.py (one ruler, 15 % depth limit, snapshot against final build): over the same 729 pairs the spread goes from 10.4 / 9.4 / 9.9 % to 9.2 / 6.8 / 5.4 % at 300 / 400 / 800, and no two letters come closer than 20 units in any drawing the cycle can bring together at 300, 400, 700 or 800 upright (five pairs sit at 19–20 units in the slanted Black). The Light figure moves least because that ruler takes the tip of a hairline exit tail for the edge of the letter, which the engine deliberately does not.

Version 2.1 was made the same way. The lead extended the engine first — the registry of names and Unicode decompositions, composites with several marks, combining marks with `ccmp`, `mark` and GDEF, the capital Σ rule, kerning classes that later glyphs have to earn — and proved on a trial build that not one Latin outline, advance or kern had moved against 2.0. Four groups were then drawn against an addendum to the spec, each returning one module and proof sheets: seven Greek letters (β δ ζ θ ξ ρ ω), ten more (γ η κ λ μ π τ υ χ ψ), the Greek marks and the new signs, and the four characters. Everything was reviewed on rendered proofs at the six corner instances and corrected where it left the hand.

**The Latin against 2.0.** Every glyph of 2.0 was compared with its counterpart in 2.1 at seven places of the design space. No Latin outline changed; the advances that differ are those of the correction described below. The kerning was compared meeting by meeting: all 18,879 pairs of Latin letters, accented letters, figures and punctuation in every drawing the alternates can bring together, at 300, 400 and 800. 4 differ at 300, 43 at 400 and 160 at 800: the four bracket pairs and the clearance kerns of the correction, none of them a tightening. The codepoints 2.0 mapped are all still mapped; ι now has its own glyph instead of the Latin ı, and Σ goes through the rule that chooses σ or ς. The wordmark aφesis is the same glyphs in the same places, to the unit, at every weight and slant.

**Shaping.** The six lines the site sets, a line of accented Latin, a line of stacked Greek accents and two lines that mix ό with ó were shaped with HarfBuzz three ways: composed, fully decomposed, and decomposed against a copy of the font whose cmap had every precomposed letter removed, so that only `ccmp` could compose them. The same glyphs and the same positions came out each time. Greek capitals, with and without accents, shape to exactly what the small letters shape to. Ten words test the capital Σ (ΑΣΦΑΛΕΙΑ, ΠΡΟΣΦΟΡΑ, ΦΣ, ΟΔΟΣ …), six the cycle of drawings through the φ, six the raised point, µ and the leaning φ.

**Clearances.** True distances on the finished outlines, in every drawing the alternates can bring together, at the six corner instances: all ordered pairs of the 25 Greek letters and of 29 accented letters whose marks are wider than their letter (ἴ ἶ ἷ ΐ ῗ …), 8,746 meetings per instance; the same letters against 31 punctuation marks, both ways round, 6,421; the four characters against punctuation, figures, Latin and Greek letters, both ways round, 1,096. Nothing is closer than 20 units, anywhere. The Latin is where it was: nothing under 20 units upright, four pairs at 19–20 in the slanted Black.

**Marks.** Across the 450 accented composites at the six corners no mark comes closer than 41 units to its letter (the cedilla, which is written into its letter, aside); the parts of a stacked Greek mark keep at least 26 units between them in the Black; the highest ink in the font is 783 units (ἆ at 800) under an ascent of 820.

**Two independent reviews.** The first build of 2.1 (2.100) was read by two reviewers who had the finished files and nothing else. One read the Greek as a Greek typographer would and measured it: coverage, every composite against its decomposition, 24,444 shaping comparisons, the white of every pair of letters at the six corners, renders down to 28 px. The other took the files apart: tables, 464 new glyphs at 61 places of the design space, sanitizer, statics against the variable font, the four characters stroke by stroke, the signs. Both confirmed the structure — the repertoire complete, composed and decomposed text identical, no mark touching a letter, the statics equal to the variable font, the Greek on one rhythm with the Latin (η·η 151 units against n·n 148), the four characters correct in structure and stroke count and matched to the Latin in grey — and both confirmed that the correction to 2.0 is right. What they found wrong is corrected in this build, 2.101: a capital Σ beside Φ became ς inside a word; a breathing beside an accent read as two ticks at text sizes, so the breathings and the Greek accents were redrawn; λ’s foot and τ’s bar opened holes at λλ κλ στ ντ, so the foot was drawn in under the head and the bar shortened (the spread of the Greek white in the Black went from 5.5 % to 4.6 %); the upright characters ran into leaning punctuation in the slanted styles; the dot of ¡ ¿ drifted with the weight; « » closed up in the Black; ï and î had come a few units too close to a closing bracket; and the points listed under the correction to 2.0. Where a suggestion was not followed, the reason is in the known limits: the φ stays upright by default because the brief says so (the leaning one is an option), and the statics keep `ital` in their STAT because a family whose cuts are style-linked as roman and italic is expected to.


## A correction to 2.0

Testing the extension turned up a defect in the published 2.0, in the Latin, and it is corrected here. Each drawing of a letter is fitted on its own ink, and its reference edge is the extreme of its profile in the middle of the x-height. In the heavy weights the tip of an exit tail rises and thickens; in a few second drawings, whose free stroke ends run a little long, the tip crossed into that middle band and was taken for the edge of the letter. Those drawings — a.1, d.1, h.1, h.2, k.1, m.1 and the accented letters built on a.1 — were 33 to 61 units too wide at 800 and 25 to 46 at 700: with the alternates on, which is the default, “hamburgefontsiv” set as “ha mburgefontsiv” in the Bold and the Black.

The rule is now what the model always meant: a letter written again has its structure where the reference drawing has it, so only scanlines whose ink lies within 16 units of the reference drawing’s ink on the same scanline can define its edge; a tip that sticks out further is ink reaching into the gap, like every other tail. No outline changed. At 800 eighteen advances changed: the six drawings above, the six accented letters built on a.1, and u.1 with its four accented forms and r.1 by 1 to 4 units; at 400 one (k.1, 9 units narrower); at 300 only u.1, by a unit. (The same rule on the left side set r.1 two units further left at 800, and the rounding of one accent, on ù in its second drawing, a unit further left at 300 and 400.) Because those drawings now stand where they should, a few clearance kerns grew — and a kern belongs to a letter in all its drawings, so the other two drawings stand that much further off as well: at 400 the k keeps 1 to 6 units more from . , : ; … ! ( ) [ ] / 2 and 4; at 800 d and l keep 9 to 11 units more, and h m n ñ 5 to 9, from ) ] [ / and 4, and some pairs move by a unit or two. Nothing came closer.

Measured with the alternates on, over hamburgefontsiv, the pangrams and the test words: the spread of the white between neighbours was 9.1 % at 700 and 12.5 % at 800 in 2.0; it is now 4.5 % and 4.9 %, the same as with the alternates off. The first release measured rhythm with the alternates off and only clearances with them on, which is how this passed; rhythm is now measured both ways.

Reading the finished 2.1, the reviewers found three more things in what 2.0 had shipped, and they are corrected too. An opening bracket directly before a closing one — () and [] — ran into each other by 40 to 55 units; such a pair is now kerned apart like any other that would touch (107 to 151 units). The bowl of α began so close to its stem that in the Black the gap at the top of the letter closed to a hairline in one drawing and shut in another; the bowl now begins 14 units further left, and the gap is open at every weight. And the Greek of 2.0 — α ε σ ς, enough for one word — was spaced as four guests among Latin letters: α borrowed the right bearing of i, which left every pair after it about 13 units loose, and ε σ ς were kerned as the Latin letters they resemble. They are now fitted and kerned as letters of the Greek alphabet, by the rules the new letters follow. αφεσις is 26 units narrower at 400 than it was. The wordmark, aφesis, has not moved.


## Known limits

- The alternates are deliberately quiet: at text sizes they are invisible, at display sizes they keep doubled letters from looking stamped.
- The cycle runs by position in the word, not per letter: neighbours and letters two apart always differ, but the same letter three places on is the same drawing again (the first and third s of possess).
- The Black weight closes small apertures (the top left of the φ, the eye of e, the upper counter of 8). It is a display weight.
- Exit tails come within a quarter-gap of the next letter at 800; at small sizes heavy pairs such as e·s can read as joined, which suits a script but is not a join the hand actually makes.
- There are no capitals in either script, no small capitals, lining figures or fractions. Greek is lowercase with its accents; archaic letters (ϝ ϛ ϟ ϡ), the symbol forms ϖ ϲ and Coptic are not drawn. Of the punctuation other languages need, „ ‚ are missing.
- The Chinese is four characters, 色 即 是 空, and nothing else: any other character falls back to another font. They are written in regular script with a broad brush, which is this face’s tool, not the pointed brush of the tradition.
- Combining marks are positioned on letters without ascenders. A mark typed after b d f h k l t or β δ ζ θ λ ξ ψ has no anchor and is not raised above the ascender; no precomposed letter needs that. Two combining marks above one letter are stacked only where Unicode has the precomposed letter (all the Greek stacks); any other pair lands on the same anchor, so vowel length with an accent (ᾱ́, ῐ̈), which has no precomposed letters, is not supported.
- Stacked Greek marks over the narrow ι are wider than the letter. They are kept clear of their neighbours by kerning, which widens such a pair (ἴδιος); it is the usual price of polytonic ι. A breathing under a perispomeni rises to 783 units in the Black: inside the line (820), above the ascenders.
- Polytonic at text sizes has a floor. At 28 px on a 2× screen a breathing reads as a hook and an accent as a flick, in every style. On an ordinary 1× screen at that size a mark is three pixels tall: the direction of the accent still reads, the kind of breathing does not. From about 40 px it does everywhere.
- The φ is one drawing and stands upright at every slant, as the brief asks. In a slanted Greek line it is the one letter that does not lean, unless `ss02` is on; its stem ends at the x-line where ψ’s rises above it, because it is the logo’s φ and not a letter drawn for the alphabet.
- Browsers shape each script as a run of its own. Kerning and the cycle of drawings therefore stop at the boundary between a Latin letter and a Greek one, and between a letter and one of the four characters; inside a script, and against punctuation and figures, they work. Nothing in real text depends on it (µm is fine), but a Greek letter set directly against a Latin one is spaced by the sidebearings alone.
- The four characters are upright in the slanted styles. Leaning punctuation and figures beside them are kerned clear. A leaning letter is not, in a browser, for the reason above: in the slanted styles set a space (or the middle dot, as the site does) between a word and the characters, or a tall letter directly before them will lean over the first one.
- + − = % € are spaced by hand and not kerned: after a minus the oldstyle 7 and 2 leave more white than 9 or 5. They are also a little narrower than the tabular figures.
- In the slanted styles tall and deep shapes lean out of their boxes (the tail of j by up to 0.2 em at the start of a line in the Black): leave padding where a container clips.


## Using it

`@font-face { font-family: "Aphesis Script"; src: url("AphesisScript-VF.woff2") format("woff2"); font-weight: 300 800; font-style: oblique 0deg 16deg; }`

- Weight: `font-weight: 300…800` (Black is 800). Slant: `font-style: oblique 16deg`, or `font-variation-settings: "slnt" -16`; the axis is slnt, not ital, so a bare `italic` will not reach the full lean.
- Greek and 色即是空 need nothing special: precomposed or decomposed text, capitals or small letters, all set from the same file. Stacked marks rise to about 0.8 em above the baseline; with a `line-height` under 1.1 give the line above a little room. The Greek raised point is U+0387, or a middle dot typed directly after the word; a middle dot between spaces stays the separator.
- Alternates are on by default (`calt`). Tabular figures: `font-variant-numeric: tabular-nums` — one width in every weight. The icon style: `font-feature-settings: "ss01"`. A φ that leans in the slanted styles: `font-feature-settings: "ss02"` (for running Greek; leave it off for the wordmark).
- The variable font and the static Regular carry the same names: install one or the other, not both.


## Extending it

A new glyph is a few control points in a glyphs module, assembled from the shared parts (entry, flag, tail, foot, arch, oval). It needs no advance width: the engine measures it. If a side is the same gesture as a control letter, add it to the keys; kerning classes and pairs are recomputed from its profile at build time. `python3 build.py --report` prints every bearing, class and pair for review; `python3 fontmeasure.py` re-measures the finished font.
