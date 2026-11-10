"""Aphesis Script — Greek lowercase, second group: γ η κ λ μ π τ υ χ ψ.

Nothing that exists is drawn twice. η is the n and μ the u, each with one stem drawn out to a point;
κ is the k at x-height (its arm and leg are the Latin strokes themselves); γ χ λ are written with the
diagonals of v and x; τ and π stand under the written crossbar of t; υ is the turn of u carried up
the right side, and ψ the same gesture, wider, with a stem through it.
Drawn here: the right side of υ and ψ, the long diagonals of χ and λ, the descender of γ."""
from brush import *
from parts import *
from glyphs_core import GLYPHS as CORE
from glyphs_straight import GLYPHS as STRAIGHT, bar, BAR
from glyphs_diag import dentry, fall, rise, FALL, RISE

GLYPHS = {}
x = 40                                                     # centre of the first stem

# ── the Latin letters, taken apart ───────────────────────────────────────────────────────────────
N_STEM = CORE['n']['strokes'][0]                           # entry, stem, foot
U_BOWL, U_STEM = STRAIGHT['u']['strokes']                  # entry + stem + turn · second stem with its tail
u_turn = U_BOWL['pts'][len(entry(x)):]                     # u's turn alone: (x, 176) … (x + U − 2, 180)
K, T = STRAIGHT['k'], STRAIGHT['t']
K_ARM, K_LEG = K['strokes'][1:]

HEADSTEM = dict(tin=24, b0=0.55)                           # a stem set down without an entry (a, ι, q)
POINTED = dict(DESCENDER, **HEADSTEM)                      # … and drawn out to a point on the descender line (q)

# ── η: the n whose second stem runs on to a point ────────────────────────────────────────────────
GLYPHS['eta'] = dict(strokes=[
    N_STEM,
    S(arch(x, x + U) + [(x + U, 100)] + foot(x + U, DESC), tin=JOIN['tin'], tout=DESCENDER['tout'], b1=DESCENDER['b1']),
], L='n', R='q', sub=x + 0.44 * U)                         # the iota subscript hangs under the counter, clear of the descender

# ── μ: the u whose first stem runs on to a point ─────────────────────────────────────────────────
GLYPHS['mu'] = dict(strokes=[
    S(head(x) + [(x, 100)] + foot(x, DESC), **POINTED),
    S([(x, 300)] + u_turn, tin=40, tout=U_BOWL['tout']),   # u's turn, begun inside the stem and leaving it as it does on u
    U_STEM,
], L='iota', R='i')

# ── υ: the turn of u carried up the right side to the x-line ────────────────────────────────────
def cup(w):
    """u's turn (down the left side, round the bottom on BOT), w wide, then up the right side like the
    wall of an o and lifted at the x-line, leaning in a little. At w = U the left half is u's, point
    for point."""
    return [(x + (px - x) * w / U, py) for px, py in u_turn[:3]] + [
        (x + 0.78 * w, BOT + 36), (x + 0.95 * w, 130), (x + w, 250), (x + w - 6, 370), (x + w - 20, XH + 2, PIN)]
CUP = dict(tin=U_BOWL['tin'], tout=110, b1=0.15)           # entry as on u; the brush lifted slowly on the way up

GLYPHS['upsilon'] = dict(strokes=[
    S(entry(x) + cup(U), **CUP),
], L='u')

# ── ψ: the υ, wide enough for two counters, with a stem through it ───────────────────────────────
WP = 356; xp = x + WP / 2 + 2                              # the stem a hair right of the middle: the left of the turn is the heavy side
GLYPHS['psi'] = dict(strokes=[
    S(entry(x) + cup(WP), **CUP),
    S(head(xp, 665) + [(xp, 100)] + foot(xp, DESC), **POINTED),
], L='u', R='upsilon')

# ── τ π: the written bar over stems ──────────────────────────────────────────────────────────────
LINTEL = dict(BAR, k=0.9)                                  # the bar of f and t, pressed a little more: here it is the top of
                                                           # the letter, and at this pressure its top edge keeps to the x-line
def under(x, lintel):
    """A stem begun inside a bar (its centreline points). The bar moves with the weight — its top edge
    stays on the x-line — so the set-down is pinned at the one height that lies well inside it in every
    master, a little above the bar's centreline at wght 400, and cut level: nothing of it shows, in
    any drawing."""
    y = next(y0 + (y1 - y0) * (x - x0) / (x1 - x0) for (x0, y0), (x1, y1) in zip(lintel, lintel[1:]) if x0 <= x <= x1) + 12
    return [(x, y, PIN), (x, y - 60)]
UNDER = dict(tin=24, b0=0.9)                                # set down at full width

xt = 40; tbar = bar(xt, l=72, r=116)                       # shorter to the left than t's: τ follows σ ν ε τ all the time, and their tops reach for it
GLYPHS['tau'] = dict(strokes=[
    S(tbar, **LINTEL),
    S(under(xt, tbar) + tail(xt), tout=70, **UNDER),
], Lref='full', Rref='full', Radj=T['Radj'])                # the right side is t's: bar end over stem and tail

PP = 226; xl = 40; xr = xl + PP; xm = xl + PP / 2           # leg pitch a little under U; the bar overhangs both legs
pbar = bar(xm, l=PP / 2 + 74, r=PP / 2 + 86)
GLYPHS['pi'] = dict(strokes=[
    S(pbar, **LINTEL),
    S(under(xl, pbar) + [(xl, 200)] + foot(xl), **dict(STEM, **UNDER)),
    S(under(xr, pbar) + tail(xr), tout=70, **UNDER),
], Lref='full', Rref='full')

# ── κ: the k at x-height ─────────────────────────────────────────────────────────────────────────
GLYPHS['kappa'] = dict(strokes=[
    S(head(x) + [(x, 200)] + foot(x), **dict(STEM, **HEADSTEM)),
    K_ARM,
    K_LEG,
], L='iota', Radj=K['Radj'], nestleR=K['nestleR'])

# ── γ: the v whose thick stroke runs on into a descender ─────────────────────────────────────────
xh = 60; xv = xh + 140                                     # head and vertex of v
GLYPHS['gamma'] = dict(strokes=[
    S(dentry(xh) + fall(xh, xv)[:2] + [(xv - 40, 115), (xv - 14, 30), (xv - 2, -50), (xv, -140)] + foot(xv, DESC),
      tin=FALL['tin'], tout=DESCENDER['tout'], b1=DESCENDER['b1']),
    S(rise(xv, xv + 153), **RISE),                         # v's thin arm, out of the stem where v has its vertex
], L='v', R='v', Lref='full', Rref='full')

# ── χ: an x standing on the descender line ───────────────────────────────────────────────────────
WX = 270; yx = 112                                         # width; height of the crossing (halfway from the x-line to the descender line)
GLYPHS['chi'] = dict(strokes=[
    S(dentry(xh + 8) + [(xh + 46, 340), (xh + 0.5 * WX, yx), (xh + WX - 72, -44), (xh + WX - 30, -150), (xh + WX - 2, DESC, PIN)],
      tin=FALL['tin'], tout=DESCENDER['tout'], b1=DESCENDER['b1']),          # full brush, drawn out to a point like a descender
    S([(xh - 10, DESC + 4, PIN), (xh + 2, -198), (xh + 40, -110), (xh + 0.5 * WX, yx), (xh + WX - 48, 330), (xh + WX - 8, 436), (xh + WX - 13, 470, PIN)],
      tin=70, tout=80, b0=0.1, k=1.1),                     # x's thin stroke, written longer
], Lref='full', Rref='full')

# ── λ: the long diagonal from the ascender line into the exit, and a thin leg ────────────────────
#    (The leg stands first in the list: in this order the hand's drift leaves the long diagonal calm.)
xa = 70; xs = xa + 250                                     # head of the diagonal; where its tail turns
GLYPHS['lambda'] = dict(strokes=[
    S([(xa + 163, 300), (xa + 70, 150), (xa + 8, 30), (xa - 5, -6, PIN)], tin=40, tout=70, b0=0.3, b1=0.1, k=1.1),     # begun inside the diagonal; x's foot, kept
                                                           # under the head (a foot reaching further left meets every exit tail before it: λλ, αλ, ελ)
    S(dentry(xa, ASC) + [(xa + 32, ASC - 124), (xa + 116, 380), (xs - 32, 126)] + tail(xs)[1:], tin=FALL['tin'], tout=70, k=0.92),
], Lref='full', Radj=K['Radj'], nestleR=K['nestleR'])       # the right side is k's: a leg that runs out into its tail
