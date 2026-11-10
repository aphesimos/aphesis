"""Aphesis Script — the round letters c d g q b and the ligature letters œ æ.

Nothing that already exists is drawn twice. The bowls are the lead's own strokes, moved sideways:
d g q æ carry the bowl of a, b the bowl of p, c the lower half of e (back, bottom, exit), œ the o and
the e themselves. Stems are the shared parts. If a control letter is retouched, these follow.
Drawn here: the top terminal of c, the tail of g, the stem and the eye of æ."""
from brush import *
from parts import *
from glyphs_core import GLYPHS as CORE

GLYPHS = {}

# ── the control letters, taken apart ──────────────────────────────────────────────────────────────
def moved(stroke, dx):
    """A stroke of a control letter shifted sideways: same points, same tapers, same pressure."""
    return dict(stroke, pts=[(p[0] + dx,) + tuple(p[1:]) for p in stroke['pts']])

def xs_of(stroke): return [p[0] for p in stroke['pts']]
def wide(stroke): return max(xs_of(stroke)) - min(xs_of(stroke))

A_BOWL = max(CORE['a']['strokes'], key=wide)     # the wide stroke of a is its bowl …
A_STEM = min(xs_of(A_BOWL)) + PA                 # … and PA is, by definition, its side-to-stem pitch
P_BOWL = max(CORE['p']['strokes'], key=wide)
P_STEM = max(xs_of(P_BOWL)) - PA
O = CORE['o']['strokes'][0]
O_SIDE = (min(xs_of(O)) + max(xs_of(O))) / 2 + PO / 2            # centreline of o's right wall
E = CORE['e']['strokes'][0]; _e = E['pts']
_top = max(range(len(_e)), key=lambda i: _e[i][1])               # e's stroke: bar, eye, TOP, shoulder, BACK, bottom, exit
_back = min(range(len(_e)), key=lambda i: _e[i][0])
E_BACK = _e[_back][0]                                            # x of e's back
E_EYE, E_DOWN, E_LOW = _e[:_top + 1], _e[_top + 1:], _e[_back + 1:]   # bar + eye up to the top · all that follows the top · what follows the back
PE = max(p[0] for p in E_EYE) - E_BACK                           # e's width: back to eye

def bowl(xs):
    """The bowl of a on a stem at xs: starts buried in the stem top, returns thin to the stem at y = 180."""
    return moved(A_BOWL, xs - A_STEM)

def pbowl(x):
    """The bowl of p on a stem at x: branches at y = 330, returns thin to the stem near the baseline."""
    return moved(P_BOWL, x - P_STEM)

def e_on(pts, x):
    """Points of e, moved so that e's back lies on x."""
    return [(p[0] + x - E_BACK, p[1]) for p in pts]

x = 40                                           # stem of b
xs = 40 + PA                                     # stem of d g q æ (where a has it)

# ── c: e without its eye. Top terminal as on s, then e's own shoulder, back, bottom and exit, all 0.95 wide
c0 = 40; PC = 0.95 * PE
GLYPHS['c'] = dict(strokes=[
    S([(c0 + PC, TOP - 36), (c0 + 0.64 * PC, TOP)] + [(c0 + 0.95 * (px - E_BACK), py) for px, py in E_DOWN],
      tin=40, tout=E['tout']),
], Rref='full', below=c0 + 0.53 * PC)            # the cedilla hangs from the bottom of the bowl

# ── d q g: the bowl of a on three stems. (Stem first: in this order the hand's drift keeps the bowl
#    on the round x-line and the flag at the height of h's.)
GLYPHS['d'] = dict(strokes=[
    S(flag(xs) + [(xs, 300)] + tail(xs), tin=62, tout=70),                               # h's ascender, i's turn and exit
    bowl(xs),
])
GLYPHS['q'] = dict(strokes=[
    S(head(xs) + [(xs, 100)] + foot(xs, DESC), tin=24, tout=120, b0=0.55, b1=0.07),      # a's head, p's point
    bowl(xs),
])
# g: the stem runs on below the line and swings left under the bowl — the turn is a quarter of the
# family's squared oval, 140 wide, bottom extreme on the descender line; the tail lifts 40 and is
# drawn out to a point below the bowl's left third (the lower terminal of s, written larger).
GLYPHS['g'] = dict(strokes=[
    S(head(xs) + [(xs, 100)] + oval(xs - 140, 140, 0, -90, 4, cy=-40, ry=-40 - (DESC + HW)) + [(xs - 232, -196)],
      tin=24, tout=150, b0=0.55),                                                         # thinned from the bottom of the turn, as on j
    bowl(xs),
])

# ── b: h's stem, p's bowl
GLYPHS['b'] = dict(strokes=[
    S(flag(x) + [(x, 300)] + foot(x), **STEM),
    pbowl(x),
])

# ── œ: the o, and the e written from its right wall — e's back lies on the wall, so both keep their width
GLYPHS['oe'] = dict(strokes=[
    O,
    moved(E, O_SIDE - E_BACK),
])

# ── æ: a, whose stem is the back of an e. The stem keeps a's head, stands straight past the bowl's
#    return, then takes e's bottom and exit; the bar and eye of e grow out of it and the eye closes
#    on the stem's head (end buried in the stem).
GLYPHS['ae'] = dict(strokes=[
    bowl(xs),
    S(head(xs) + [(xs, 200)] + e_on(E_LOW, xs), tin=24, tout=E['tout'], b0=0.55),
    S(e_on(E_EYE, xs) + [(xs + 75, 420), (xs + 4, 392)], tin=E['tin'], tout=30, b0=E['b0'], b1=0.45),
])
