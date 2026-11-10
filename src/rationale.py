"""Aphesis Script — the written rationale, kept next to the build so its tables are always the
numbers the build actually used. Rendered to HTML for the specimen page and to RATIONALE.md.

    python3 rationale.py   → ../RATIONALE.md
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import brush as B, spacing as SP

ORIGINAL = ['aφesis', 'aphesis', 'hhihhi', 'sisisis', 'papapa', 'heheh', 'φhφ']
STRINGS = [
    ['the wordmark and the φ among letters', ['aφesis', 'nφn oφo hφh aφa eφe sφs iφi pφp vφv rφr tφt']],
    ['straight against round (the n/o method)', ['nnnonoonn nnonn nonon oonoo', 'hhihhi minimum illuminatio']],
    ['every letter between the controls', ['nnannoaoo nnbnnoboo nncnnocoo nndnnodoo nnennoeoo nnfnnofoo nngnnogoo', 'nnhnnohoo nninnoioo nnjnnojoo nnknnokoo nnlnnoloo nnmnnomoo',
                                           'nnpnnopoo nnqnnoqoo nnrnnoroo nnsnnosoo nntnnotoo nnunnouoo', 'nnvnnovoo nnwnnowoo nnxnnoxoo nnynnoyoo nnznnozoo']],
    ['hamburgefontsiv and pangrams', ['hamburgefontsiv', 'sphinx of black quartz, judge my vow', 'the quick brown fox jumps over the lazy dog']],
    ['real text', ['aφesis · liber · codex · officina · opera · paries', 'as above, so below; as within, so without.', 'solve et coagula — visita interiora terrae',
                   'in girum imus nocte et consumimur igni', 'où est l’œuvre? déjà vu, señor; grüße, façade', '0123456789 · 1463–2026 · no. 7 (pa) [ha] ‘a’ “e” & @ # *']],
]
PROOF_IMAGES = [('before_after_w300_s0.png', 'Before and after at weight 300, upright'), ('before_after_w400_s0.png', 'Before and after at weight 400, upright'),
                ('before_after_w800_s0.png', 'Before and after at weight 800, upright'), ('before_after_w300_s16.png', 'Before and after at weight 300, slant −16'),
                ('before_after_w400_s16.png', 'Before and after at weight 400, slant −16'), ('before_after_w800_s16.png', 'Before and after at weight 800, slant −16'),
                ('control_weights.png', 'Control strings at 300, 400 and 800, upright and slanted'),
                ('control_a_i.png', 'Control strings a–i'), ('control_j_r.png', 'Control strings j–r'), ('control_s_z.png', 'Control strings s–z'),
                ('text.png', 'Real text, hamburgefontsiv and pangrams at weight 400'), ('text_instances.png', 'One line at every named instance'),
                ('figures_punct.png', 'Figures, punctuation, symbols and accents'), ('alternates.png', 'Alternates on and off'), ('ss01.png', 'Stylistic set 1: the icon style')]
README = """Aphesis Script
fonts/variable   the variable font (wght 300-800, slnt -16-0), TTF and WOFF2
fonts/static     ten static instances cut from it, TTF and WOFF2
source/          the complete build: python3 src/build.py   (needs numpy, fonttools, brotli)
                 src/build.py is the one entry point; brush.py, parts.py, glyphs_*.py, phi*.py, spacing.py,
                 features.py and registry.py are its modules. proofs.py, preview.py, fontmeasure.py,
                 rationale.py and make_page.py are tools around it (proofs need node + playwright,
                 previews need Pillow, fontmeasure needs uharfbuzz).
                 SPEC.md is the design spec the glyphs were drawn against; RATIONALE.md explains the decisions.

CSS      @font-face { font-family: "Aphesis Script"; src: url("AphesisScript-VF.woff2") format("woff2");
                      font-weight: 300 800; font-style: oblique 0deg 16deg; }
         slant: font-style: oblique 16deg (or font-variation-settings: "slnt" -16); the axis is slnt, not ital
         tabular figures: font-variant-numeric: tabular-nums     icon style: font-feature-settings: "ss01"
Install  the variable font OR the statics, not both: the variable font and the static Regular share their names.
"""

def bearings_table(G):
    """Sidebearing classes with their values per weight master."""
    rows = [('straight · entry', 'L', 'n', 'i j m n p r t ı'), ('straight · ascender', 'L', 'h', 'b h k l'), ('round · o', 'L', 'o', 'o œ σ'),
            ('round · bowl of a', 'L', 'a', 'a d g q æ α'), ('round · back of e', 'L', 'e', 'c e ς'), ('diagonal', 'L', 'v', 'v w y'), ('open · s', 'L', 's', 's'),
            ('straight · shoulder + exit', 'R', 'n', 'h m n'), ('straight · stem + exit', 'R', 'i', 'a d i l u ı α'), ('straight · no exit', 'R', 'q', 'g j q'),
            ('round · o', 'R', 'o', 'o'), ('round · bowl of p', 'R', 'p', 'b p'), ('open · e', 'R', 'e', 'e œ æ'), ('open · c', 'R', 'c', 'c'),
            ('open · arm of r', 'R', 'r', 'r'), ('diagonal', 'R', 'v', 'v w y'), ('open · s', 'R', 's', 's'), ('the φ', 'L', 'phi', 'φ'), ('the φ', 'R', 'phi', 'φ')]
    out = []
    for cls, side, ctl, members in rows:
        if ctl != 'phi' and ctl not in G: continue
        vals = [SP._bearing(G, ctl, side, w) for w in B.MASTER_WEIGHTS]
        whites = SP.measure(G, ctl, 400)[side].white
        out.append((cls, 'left' if side == 'L' else 'right', 'φ' if ctl == 'phi' else ctl, members, f'{whites:.0f}', *[f'{v:.0f}' for v in vals]))
    return ['class', 'side', 'control', 'members', 'white @400', 'bearing 300', '400', '800'], out

_KT = {}
def _kern(G, order):
    import build as BUILD
    if 'kt' not in _KT: _KT['kt'] = SP.kerning_tables(G, order, BUILD.MASTERS)
    return _KT['kt'], BUILD.MASTERS

def kerning_table(G, order, limit=20):
    """The letter·letter pairs that move at least `limit` units in some master (the full list, marks
    and figures included, is printed by build.py --report)."""
    kt, masters = _kern(G, order)
    first, second, _ = kt[masters[0]]
    show = lambda c: ' '.join('φ' if n == 'phi' else {'sigma': 'σ', 'sigmafinal': 'ς', 'alpha': 'α', 'epsilon': 'ε', 'germandbls': 'ß', 'oe': 'œ', 'ae': 'æ', 'dotlessi': 'ı'}.get(n, n) for n in c[:8]) + (' …' if len(c) > 8 else '')
    rows = []
    for p in sorted(kt[masters[0]][2]):
        if SP._kind(first[p[0]][0]) != 'letter' or SP._kind(second[p[1]][0]) != 'letter': continue
        vals = [kt[m][2][p] for m in masters[:3]]
        if max(abs(v) for v in vals) < limit: continue
        why = 'nestles' if max(vals) <= 0 else 'clearance' if min(vals) >= 0 else 'nestles / clearance'
        rows.append((show(first[p[0]]), show(second[p[1]]), str(vals[1]), str(vals[0]), str(vals[2]), why))
    return ['first', 'second', '300', '400', '800', 'why'], rows

def kerning_counts(G, order):
    kt, masters = _kern(G, order)
    first, second, pairs = kt[masters[0]]
    kinds = {}
    for (i, j) in pairs:
        k = (SP._kind(first[i][0]), SP._kind(second[j][0])); kinds[k] = kinds.get(k, 0) + 1
    return len(pairs), len({i for i, _ in pairs}), len({j for _, j in pairs}), kinds

def evenness_table(G=None, order=None):
    """Before and after with the same ruler (fontmeasure.py), on the strings the six-glyph font can set."""
    try:
        import fontmeasure as FM
        rows = []
        b, a = FM.evenness(FM.BEFORE, 500), FM.evenness(FM.AFTER, 464)
        for rb, ra in zip(b, a):
            rows.append((f'{rb[0]}', f'{rb[1]}', f'{rb[2]:.0f}', f'{rb[5]:.0f}–{rb[6]:.0f}', f'{rb[4]:.0f} %', f'{ra[2]:.0f}', f'{ra[5]:.0f}–{ra[6]:.0f}', f'{ra[4]:.1f} %'))
        return ['wght', 'slnt', 'before: mean white', 'range', 'spread', 'after: mean white', 'range', 'spread'], rows
    except Exception as e:                                # the table is a courtesy; the page builds without it
        return ['note'], [(f'measurement not available here ({type(e).__name__})',)]

QA = dict(                                               # the last QA run, on the files in dist/
    fontbakery='<b>fontbakery</b> (check-universal): the variable font passes with 0 FAIL and 0 WARN. The ten statics, checked together as a family, give 0 FAIL and 10 WARN — one per file and the same notice each time, <code>contour_count</code>: the glyphs have more contours than conventional outlines, because every stroke is its own overlapping contour. That is the construction, not a defect. Three earlier warnings were fixed rather than explained away: outline points that crowded onto one grid unit inside tight turns are now re-spaced, the soft hyphen is no longer mapped, and ss01 carries a name.',
    ots='<b>OpenType Sanitizer</b>: all 22 files (the variable font and ten statics, TTF and WOFF2) pass.',
    spacing='<b>Independent spacing review.</b> A reviewer that never saw the engine measured, on a snapshot of the finished font, the white of all 729 ordered pairs of a–z and φ on rasterised outlines at the six corner instances (its ruler validated against FreeType and Chromium). Its verdict on the letter fit: spread 7.9–8.7 % at every corner, 88–91 % of pairs within ±12 % of n·n, nothing moving by more than 0.7 % with slant, no overlap anywhere. The faults it found were all in the layer above the sidebearings, mostly in the Black: nestling kerns that were constant in units and so too strong at 800 (f·o, r·g, x·v), clearance pushes below 20 units lost to a threshold, alternates that shared their letter’s metrics although their edges differ (near-touches at 800 with calt on: “after”, “skill”, “otter”), the leg of k, brackets against ascenders, periods floating after v w y, an asterisk wider than its advance. Every one of these was changed in the engine, not patched pair by pair. Re-measured afterwards with fontmeasure.py (one ruler, 15 % depth limit, snapshot against final build): over the same 729 pairs the spread goes from 10.4 / 9.4 / 9.9 % to 9.2 / 6.8 / 5.4 % at 300 / 400 / 800, and no two letters come closer than 20 units in any drawing the cycle can bring together at 300, 400, 700 or 800 upright (five pairs sit at 19–20 units in the slanted Black). The Light figure moves least because that ruler takes the tip of a hairline exit tail for the edge of the letter, which the engine deliberately does not.')

SECTIONS = [
 ('What this is', [
  'Aphesis Script is a lowercase-only display hand for aphes.is: a wide, upright humanist cursive — the cancellaresca of the Renaissance hermeticists, with some half-uncial roundness — written with the brush of the hand-drawn φ. It began as a spacing repair for six letters. The owner then widened the brief to the whole family in one run, with freedom to rebuild, so the earlier skeletons and numbers were used as input, not as limits.',
  'Three things were kept from the first version because they are the identity: the brush (centreline plus width profile, nib at 38°, thick/thin 2.8, tapered ends, unsure edges), the φ drawing itself, and the axes (wght 300–800 with 400 = the φ’s stroke, slnt −16…0 with the φ upright at every slant).',
  'The order of priorities throughout: the wordmark aφesis first, then an even rhythm at every weight and slant, then one hand across every glyph, then the size of the character set.']),
 ('Why the spacing was uneven, and what changed', [
  'The first font gave each of its six letters an advance width typed in by hand, the same number in every master, and placed the φ by eye. Nothing measured the white between the shapes, so every pair landed where the guesses happened to put it — and as the brush grew heavier the same boxes simply filled up.',
  'Measured with one ruler on both finished fonts (the optical white between neighbours in the x-height band, depth-limited; the strings are the ones the six-glyph font can set: aφesis, aphesis, hhihhi, sisisis, papapa, heheh, φhφ):',
  ('table', 'evenness'),
  'Spread is the standard deviation of the white between neighbours as a share of its mean. The eye starts to see uneven spacing at around 5 %. In the old wordmark at 400 the white ran from 97 units (s·i) to 197 (e·s); in the new one all five gaps lie between 144 and 150.']),
 ('The φ sets the measure', [
  'In the first version the letters were drawn on a 500-unit x-height by their centrelines, so their ink ran from −20 to 530, while the φ’s loop ran from 21 to 501: the mark looked a size smaller than its own alphabet and floated above the baseline. Spacing could not fix that, so the metrics were rebuilt from the φ.',
  ['The φ’s loop, 480 units tall, <em>is</em> the round x-height band. Round letters reach −8 and 472 at every weight; flat x-height is 464.',
   'At weight 400 the φ outline is the drawing, point for point. It is only translated 29 units down so that its loop overshoots the baseline exactly like a round letter.',
   'Ascenders 730, descenders −240 (the φ’s own stem ends at −244), ascending figures 640.',
   'The stem pitch of n (244 units) was chosen against the φ’s inner rhythm: its lobes are about 220 apart, so the φ reads as two letter-widths rather than as a foreign body.']]),
 ('One brush for everything', [
  'Nothing in the font is a geometric solid. Letters, figures, punctuation, accents, the i-dot, the period and the middle dot are all the same thing: a centreline with a width profile, written by one tool.',
  ['<b>The tool.</b> Nib at 38°, thick/thin 2.8, tapered ends, edges moved by an unsure hand (the same drift in units at every weight).',
   '<b>Touches.</b> A dot is a short pressed stroke: the nib is set down, dragged a little way across its own edge and lifted. The comma and the quotes are the same touch flicked away; dashes are short written strokes; the asterisk is three quick strokes through one point. Touches swell with the weight and the ones on the baseline stay on it.',
   '<b>Weight-aware skeleton.</b> Control points are drawn for 400. For other weights the skeleton is moved so that outer edges stay on the metric lines (a heavier brush eats into the letter, it does not make it taller) and letters widen slightly so counters do not clog. Feet and tips are pinned.',
   '<b>Fixed points, smooth ink.</b> Every stroke has a fixed number of outline points placed at fixed positions along its spline, identical in every master. They are stored as quadratic control points with no on-curve points between them, so the edge is smooth like the φ’s and still interpolates point for point. Contours are clockwise; strokes overlap and are flagged as overlapping.',
   '<b>Inner corners fill.</b> Where a turn is tighter than the brush is wide, the offset edge folds. Folds are unfolded, points that fall inside another part of the stroke are laid on a chord, pockets are closed and the corner is relaxed into a fillet — what ink does. The point count never changes.',
   '<b>Shared anatomy.</b> Entry, flag, head, tail, foot, arch and oval are functions; a letter is assembled from them. The bowl of d g q is the bowl of a, moved; b carries the bowl of p; c is e without its eye; f and t share one crossbar. If a control letter is retouched, the letters built from it follow.']]),
 ('Spacing: measured on the ink', [
  'The method is the foundry n/o method with the judgment made explicit and repeatable.',
  ['<b>Profiles.</b> Each glyph of each master is cut by scanlines every 4 units; the leftmost and rightmost ink on each line is its side profile.',
   '<b>Reference edge.</b> Each side has a structural edge: the extreme of its profile in the middle of the x-height (15–85 %). Entry hooks and exit tails live at the x-line and the baseline, so they never define the edge; they count as ink reaching into the gap. Sides whose structure is at the top or bottom (the arm of r, the bar of f and t, the diagonals) use the whole band.',
   '<b>Side white.</b> The white between the edge and the ink, over the x-height band, with the depth limit foundries use: 15 % of the x-height (70 units). Deeper white is an open counter and does not count.',
   '<b>Bearing = target − white.</b> A straight stem gets the full target; a bowl sits closer by exactly the white its curve already carries. Any two glyphs then enclose the same optical area, so the rhythm is even by construction and not by a table of exceptions.',
   '<b>Control letters and classes.</b> n and o are the controls; h, a, e, i, p, q, v, s complete the set. Sides that are the same gesture as a control take its bearing (=n, =h, =a, =i, =p, =q, =v …), so equal shapes are equal to the unit. The classes are in the table below.',
   '<b>Per weight.</b> The target white is 176 / 150 / 116 units at 300 / 400 / 800: it follows the counters, so the texture stays even from Light to Black. Masters are measured separately; varLib turns the differences into advance deltas.',
   '<b>Punctuation</b> has hand-set bearings (written for 400, scaled with the target), because its structure is not in the x-height band.'],
  ('table', 'bearings'),
  'Bearings are distances from the reference edge to the edge of the glyph box, not from the bounding box. That is why a tail or a hook can reach into its neighbour’s space without disturbing the rhythm.']),
 ('Slant and weight around a φ that will not lean', [
  'The shear pivots at mid x-height, so a slanted letter stays centred on its upright position and keeps its advance — the italic-angle offset is built into the outline rather than patched into the sidebearings. Because every letter is sheared alike, the white between letters is unchanged and the upright bearings hold.',
  'The φ is the exception: it stays upright. In the slanted masters it is measured as the leaning letters see it (its profile sheared the other way) and gets its own bearings there; its outline is the same, only its position in the box changes. All three weights have a real slanted master, so the heavy slanted corner is drawn, not extrapolated.',
  'The φ also follows the weight axis. Its Light and Black masters keep the drawing’s 434 points and move them so that the local stroke thickness matches the letters’ brush (a least-squares displacement field along the outline normals, with the crotches where loop meets stem treated separately). At 400 the deltas are zero: the glyph is the original, and it never leans. One honest limit: at 800 the small aperture at the top left of the loop tightens to about 30 units.']),
 ('Kerning: only what bearings cannot do', [
  'Two effects are measured on the same profiles, per master, and written as class pairs (classes are found from the profiles themselves: sides that agree within 7 units RMS share a class; alternates and accented letters ride with their base).',
  ['<b>Nestling.</b> If at every height the two structural profiles leave room beyond the nominal gap (r·a, f·o, x·v …), the second glyph is pulled in by 60 % of that room (35 % against punctuation, which carries its own bearings).',
   '<b>Clearance.</b> Nothing, tails and extenders included, may come closer than a quarter of the straight gap; if it would, the pair is pushed apart.'],
  ('kerncount',),
  ('table', 'kerning'),
  'The pair list and the classes are identical in every master, only the values differ, so the six GPOS tables merge into variable kerning: a pair can be −13 at 400 and −25 at 800 and every weight in between gets its own value.']),
 ('Written, not stamped', [
  'Every letter has three drawings: the reference and two re-writings of the same skeleton — a slow deformation of the whole glyph so joins stay joined (a little wider or narrower, a degree more or less lean, never shifted as a whole), some play in the free stroke ends, slightly different pressure, a different edge. One contextual lookup rotates them along each run of letters:',
  '<code>sub @c0 @c0\' by @c1;&nbsp;&nbsp; sub @c1 @c0\' by @c2;</code>',
  'After a reference drawing comes the second, after the second the third, then the reference again: 0 1 2 0 1 2 … from the first letter of every word. Neighbouring letters are therefore never the same drawing — ss, ee, ll, oo cannot look stamped — and the result is deterministic: the same word always sets the same way. A non-letter restarts the cycle. Alternates share the metrics and kerning classes of their letter, so the rhythm does not move when the feature is switched off.']),
 ('Figures, marks, capitals, Greek, ligatures', [
  ['<b>Oldstyle figures.</b> The face has no capitals, so lining figures would have nothing to align with and would stand in the text like a row of capitals. Oldstyle figures live in the lowercase rhythm: 0 1 2 at x-height, 6 8 ascending, 3 4 5 7 9 descending. They are proportional by default and spaced by the same engine; <code>tnum</code> centres the same drawings on one common width for tables.',
   '<b>Capitals</b> are mapped in the cmap to the lowercase glyphs, accented capitals included, so typed capitals always render and there is no second alphabet to keep in step.',
   '<b>Accents</b> are composites: the base letter (in all three drawings) plus a brush-written mark placed over the middle of the letter’s structure; î and ï carry narrower marks so they do not reach into their neighbours. œ and æ are written from the strokes of o, a and e; ß is a long s with a small s written into it, open at the foot.',
   '<b>Greek.</b> α ε σ ς were drawn so that the word the face is named after can be set — αφεσις — with ι ο ν sharing the Latin drawings. It is a courtesy, not a Greek alphabet.',
   '<b>No ligatures.</b> The beak of the f stops short of the next letter’s ascender or dot, so f·i, f·l, f·f never collide; the pairs are solved by spacing and kerning. A drawn fi would bring a second logic into a hand whose point is that every letter is written separately.']]),
 ('The icon style, as stylistic set 1', [
  'The site’s icons are brush outlines filled with a scatter of small squares. <code>ss01</code> gives four symbols that treatment: the middle dot becomes a small ring with grains inside (the circled point of the old tables), the asterisk gets dust between its rays, the number sign a dusted middle field and the ampersand a dusted bowl. The squares are thrown by the same xorshift generator the icons use and are kept only where they clear the ink in every weight master, so the same squares exist at every weight (they move with the skeleton and swell a little, never appear or vanish). At text sizes they turn to grey, which is why they are an opt-in set and not the default.']),
 ('The family', [
  'Six masters (300, 400, 800 × upright, −16) build one variable font. fvar carries ten named instances — Light 300, Regular 400, Medium 500, Bold 700, Black 800 and their Slanted partners — and STAT describes both axes (Regular linked to Bold, Upright linked to Slanted and elidable). Line metrics are the same in hhea, OS/2 typo and OS/2 win (820 / −280), with USE_TYPO_METRICS set. The ten statics are cut from the variable font with the instancer and named for four-style linking: within each weight the Slanted cut is the italic partner of the upright one.',
  ('qa',)]),
 ('How it was made and checked', [
  'The lead owned the spec (brush rules, metrics, spacing model, master structure), the control letters n o i h a e p s, the spacing engine, the build and the review. Glyph groups were drawn against that spec by subagents — round letters; straight letters; diagonals; figures; punctuation and symbols; marks — each returning one module and proof sheets; another derived the weight masters of the φ. Everything was reviewed on rendered proofs before it went in and corrected where it left the hand (the f, t, ß, the asterisk and the brackets were redrawn at review).',
  'Proofs are rendered by Chromium from the built fonts, so they show real shaping: control strings for every letter (nn·nn··nn, oo·oo··oo, between a e s i and against the φ), hamburgefontsiv, pangrams, Latin texts, all at 300 / 400 / 800 and at slant 0 / −16. Two independent passes then looked at the result without the engine: one measured the optical white of every ordered pair of a–z and φ on the finished font at the six corner instances, the other took the files apart (tables, names, interpolation at 65 locations, shaping, statics against the variable font). The technical pass found no structural fault; its four small findings were fixed — overlap flags on the tabular-figure composites, empty OS/2 strikeout and script fields and a restrictive embedding bit, the φ re-rounded by up to a unit between the upright and slanted masters (it is now moved by whole units only, so its outline is the same everywhere), and Upright not linked to Slanted in STAT. It also confirmed that the φ at 400 is the original drawing to within the rounding of the unit grid (0.67 units at most against the original curve).',
  ('spacingqa',)]),
 ('Known limits', [
  ['The alternates are deliberately quiet: at text sizes they are invisible, at display sizes they keep doubled letters from looking stamped.',
   'The cycle runs by position in the word, not per letter: neighbours and letters two apart always differ, but the same letter three places on is the same drawing again (the first and third s of possess).',
   'The Black weight closes small apertures (the top left of the φ, the eye of e, the upper counter of 8). It is a display weight.',
   'Exit tails come within a quarter-gap of the next letter at 800; at small sizes heavy pairs such as e·s can read as joined, which suits a script but is not a join the hand actually makes.',
   'Greek is four letters, without accents. There are no capitals, small capitals, lining figures, fractions or combining marks, and no ¿ ¡ « » € % + =.',
   'In the slanted styles tall and deep shapes lean out of their boxes (the tail of j by up to 0.2 em at the start of a line in the Black): leave padding where a container clips.']]),
 ('Using it', [
  '<code>@font-face { font-family: "Aphesis Script"; src: url("AphesisScript-VF.woff2") format("woff2"); font-weight: 300 800; font-style: oblique 0deg 16deg; }</code>',
  ['Weight: <code>font-weight: 300…800</code> (Black is 800). Slant: <code>font-style: oblique 16deg</code>, or <code>font-variation-settings: "slnt" -16</code>; the axis is slnt, not ital, so a bare <code>italic</code> will not reach the full lean.',
   'Alternates are on by default (<code>calt</code>). Tabular figures: <code>font-variant-numeric: tabular-nums</code> — one width in every weight. The icon style: <code>font-feature-settings: "ss01"</code>.',
   'The variable font and the static Regular carry the same names: install one or the other, not both.']]),
 ('Extending it', [
  'A new glyph is a few control points in a glyphs module, assembled from the shared parts (entry, flag, tail, foot, arch, oval). It needs no advance width: the engine measures it. If a side is the same gesture as a control letter, add it to the keys; kerning classes and pairs are recomputed from its profile at build time. <code>python3 build.py --report</code> prints every bearing, class and pair for review; <code>python3 fontmeasure.py</code> re-measures the finished font.']),
]

def _table(head, rows, fmt):
    if fmt == 'html':
        import html as H
        th = ''.join(f'<th>{H.escape(h)}</th>' for h in head)
        tr = ''.join('<tr>' + ''.join(f'<td>{H.escape(str(c))}</td>' for c in r) + '</tr>' for r in rows)
        return f'<div class="scroll"><table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'
    return '\n'.join(['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]) + '\n'

def render(G, order, fmt='html'):
    import re
    tables = {'bearings': lambda: bearings_table(G), 'kerning': lambda: kerning_table(G, order), 'evenness': lambda: evenness_table()}
    strip = lambda t: re.sub(r'<[^>]+>', '', t).replace('&amp;', '&')
    md = (lambda t: re.sub(r'</?b>', '**', re.sub(r'</?em>', '*', re.sub(r'</?code>', '`', t))))
    out = []
    for title, blocks in SECTIONS:
        out.append(f'<h3>{title}</h3>' if fmt == 'html' else f'\n## {title}\n')
        for b in blocks:
            if isinstance(b, str): out.append(f'<p>{b}</p>' if fmt == 'html' else md(b) + '\n')
            elif isinstance(b, list): out.append('<ul>' + ''.join(f'<li>{i}</li>' for i in b) + '</ul>' if fmt == 'html' else '\n'.join('- ' + md(i) for i in b) + '\n')
            elif b[0] == 'table': out.append(_table(*tables[b[1]](), fmt))
            elif b[0] == 'kerncount':
                n, n1, n2, kinds = kerning_counts(G, order)
                ll = kinds.get(('letter', 'letter'), 0); fig = sum(v for k, v in kinds.items() if 'figure' in k); mk = sum(v for k, v in kinds.items() if 'mark' in k and 'figure' not in k)
                t = (f'The font carries {n} class pairs ({n1} first classes, {n2} second classes): {ll} between letters, {fig} involving figures, {mk} against punctuation. '
                     f'The table lists the letter pairs that move 20 units or more in some weight; the complete list is printed by the build report.')
                out.append(f'<p>{t}</p>' if fmt == 'html' else t + '\n')
            elif b[0] in ('qa', 'spacingqa'):
                for t in ([QA['fontbakery'], QA['ots']] if b[0] == 'qa' else [QA['spacing']]):
                    if t: out.append(f'<p>{t}</p>' if fmt == 'html' else md(t) + '\n')
    return '\n'.join(out)

def html(G):
    import build as BUILD
    return render(G, BUILD.glyph_table(G)[0], 'html')

if __name__ == '__main__':
    import build as BUILD
    from registry import load_glyphs
    G = load_glyphs(); G['.notdef'] = BUILD.notdef_strokes()
    text = '# Aphesis Script — rationale\n' + render(G, BUILD.glyph_table(G)[0], 'md')
    open(os.path.join(HERE, '..', 'RATIONALE.md'), 'w').write(text); print(len(text), 'chars → RATIONALE.md')
