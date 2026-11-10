"""Aphesis Script — Greek lowercase, first group: β δ ζ θ ξ ρ ω.

As little as possible is drawn twice. ρ and β carry the bowl of p (shoulder, right side, bottom and the
thin return to the stem are the lead's own points); δ is the o, entered through a neck that is the
spine of an s; θ is the o's one turn of the brush, drawn tall; ζ and ξ end in the ς's own back,
baseline run and tail, and begin with the same written bar. If p, o or ς are retouched, these follow.
Drawn here: the round shoulder of ρ, the upper bowl and waist of β, the hook and neck of δ, the bar of
θ, the two cups of ω, the bar of ζ ξ, the sweep of ζ and the two curves of ξ."""
from brush import *
from parts import *
from glyphs_round import P_BOWL, P_STEM
from glyphs_extra import GLYPHS as EXTRA

GLYPHS = {}

def at(pts, dx):
    """Points moved sideways."""
    return [(p[0] + dx,) + tuple(p[1:]) for p in pts]

YA = ASC - HW                                        # centreline of a round top on the ascender line

# ── the bowl of p, after its top: shoulder, right side, bottom, thin return to the stem ──────────
x = 40                                               # stem of ρ and β
_p = P_BOWL['pts']; _ptop = max(range(len(_p)), key=lambda i: _p[i][1])
P_ROUND = at(_p[_ptop + 1:], x - P_STEM)

# ── ρ: the p without its entry. The left wall of the bowl is the stem; where p has a head and a
#    branch, ρ has a round shoulder: a quarter of the family's oval, as wide as p's bowl (PA).
#    Stem and bowl overlap along the wall on one centreline, so no joint shows: the stem is begun
#    inside the shoulder, the bowl inside the stem.
SHOULDER = oval(x + PA / 2, PA / 2, 180, 90, 7)      # from the wall at mid-height (180°) to the top (90°), every 15°
GLYPHS['rho'] = dict(strokes=[
    S(SHOULDER[3:0:-1] + [(x, 226), (x, 100)] + foot(x, DESC), **DESCENDER),
    S([(x, 240)] + SHOULDER[1:] + P_ROUND, tin=40, tout=P_BOWL['tout']),
], R='p')

# ── β: the long s of ß carried on to a point at the descender line, and a closed lower bowl.
#    Stroke 1 is begun at the waist with a hairline (the entry of the hand, here into a bowl), goes
#    up and over the small upper bowl and down the stem. Stroke 2 is begun inside that hairline and
#    takes p's bowl back to the stem. The waist stays clear of the stem: one counter, never a B.
GLYPHS['beta'] = dict(strokes=[
    S([(x + 118, 452), (x + 168, 496), (x + 196, 568), (x + 180, 648), (x + 112, YA - 2), (x + 46, YA - 14),
       (x + 7, ASC - 80), (x, ASC - 148), (x, 380), (x, 100)] + foot(x, DESC), **dict(DESCENDER, tin=44)),
    S([(x + 134, 466), (x + 166, 453), (x + 190, 431)] + P_ROUND, tin=34, tout=P_BOWL['tout'], b0=0.2),
], R='p')

# ── θ: one turn of the brush like o and zero, from the round baseline to the ascender line, begun and
#    closed at its own thin point (higher up than on the o: the oval is steeper). A little squarer
#    than the o (2.4) so that the long walls do not make a lens of it. The bar is written from wall
#    to wall, rising as the bar of f and t does; both ends are buried in the walls.
RT = 124; ct = 40 + RT; BY = 376
GLYPHS['theta'] = dict(strokes=[
    S(oval(ct, RT, 108, 108 + 408, 22, sq=2.4, cy=(YA + BOT) / 2, ry=(YA - BOT) / 2), tin=40, tout=44, b0=0.5, b1=0.35),
    S([(ct - RT + 2, BY - 7), (ct - 44, BY - 3), (ct + 44, BY + 3), (ct + RT - 2, BY + 7)], tin=20, tout=20, k=0.85, b0=0.6, b1=0.6),
])

# ── δ: one stroke. A hook like the top of s (terminal, over the top on the ascender line, round the
#    left), a straight full-brush neck, and the o: the neck runs into the oval where the oval has the
#    neck's own direction (50°), goes once round and closes buried in the right wall, as the o closes.
cd = 40 + PO / 2; A_IN = 50
_in = oval(cd, PO / 2, A_IN, A_IN, 2)[0]             # where the neck meets the bowl
_hook = [(cd + 106, YA - 28), (cd + 34, YA), (cd - 60, YA - 14), (cd - 82, YA - 88)]
_neck = [(0.42 * _hook[-1][0] + 0.58 * _in[0], 0.42 * _hook[-1][1] + 0.58 * _in[1])]
GLYPHS['delta'] = dict(strokes=[
    S(_hook + _neck + oval(cd, PO / 2, A_IN, 20 - 360, 19), tin=40, tout=50, b1=0.3),
], L='o', R='o')

# ── ω: a round w, two cups that meet in a point at 59 % of the x-height. Each cup has the lower left
#    of the family's oval; the left one rises thin to the peak, the right one is set down beside that
#    lift (pinned, like the middle of w) and goes up the right side. Both arms lean in and are drawn
#    out to a point at the x-line: the left one thin, the right one full, as the brush has it.
x0 = 40; WO = 244; RL = 116; RR = 118                # left wall · wall to peak · where the two bottoms lie
xm = x0 + WO; x1 = xm + WO; PK = 270
GLYPHS['omega'] = dict(strokes=[
    S([(x0 + 64, 468, PIN), (x0 + 34, 440), (x0 + 7, 366)] + oval(x0 + RL, RL, 180, 270, 5)
      + [(x0 + RL + 48, 38), (x0 + RL + 86, 100), (xm - 12, 184), (xm + 2, PK, PIN)], tin=36, tout=80, b0=0.5, b1=0.1),
    S([(xm, PK + 2, PIN), (xm + 7, 170)] + oval(xm + RR, RR, 225, 270, 3)
      + [(xm + RR + 52, 42), (xm + RR + 96, 116), (x1 - 5, 196), (x1, 276), (x1 - 5, 360), (x1 - 17, 420), (x1 - 34, 466, PIN)],
      tin=44, tout=80, b0=0.25, b1=0.2),
], sub=xm)                                           # the iota subscript hangs under the peak

# ── ζ ξ: the ς's cousins. Both end in the ς's own back, baseline run and tail, and begin with the
#    same bar under the ascender line, written like the top of z (a small entry, then the bar).
SF = EXTRA['sigmafinal']['strokes'][0]
_sf = SF['pts']; _back = min(range(len(_sf)), key=lambda i: _sf[i][0])
z0 = 40                                              # the back
LOW = at(_sf[_back:], z0 - _sf[_back][0])            # ς from its back on
TAIL = dict(tout=SF['tout'], b1=SF['b1'])            # … lifted as ς is

def topbar(b, L=160):
    """Bar of ζ and ξ begun at b: hairline entry, bar on the ascender line, L long. It is written a
    little lighter than a stem (BARPEN, as the bars of f t τ π are), so its centreline lies 2 higher."""
    y = YA + 2
    return [(b, y - 30), (b + 24, y - 8), (b + 0.38 * L, y), (b + 0.72 * L, y - 3), (b + L, y - 2)]
BARPEN = dict(tin=40, k=0.92)

# ζ: the bar ends in a corner; out of it one sweep, thin down to the left, into ς's back.
_bar = topbar(z0 + 24)
GLYPHS['zeta'] = dict(strokes=[
    S(_bar, tout=20, b1=0.6, **BARPEN),
    S([(_bar[-1][0] - 12, _bar[-1][1] - 2), (z0 + 136, 608), (z0 + 82, 496), (z0 + 36, 388)] + LOW, tin=40, b0=0.2, **TAIL),
], L='e', Rref='full')

# ξ: the bar is a free arm here and is lifted at its end. The upper curve is begun inside the bar,
#    runs back along it and turns down over the bar's own entry (so the top left is one round
#    corner), then out to the waist; the lower curve is begun inside the waist, as on ε, and is ς.
_bar = topbar(z0 + 38)
_bx, _by = _bar[2]                                   # the bar where it has reached the line
GLYPHS['xi'] = dict(strokes=[
    S(_bar, tout=36, b1=0.25, **BARPEN),
    S([(_bx + 24, _by - 1), (_bx - 12, _by - 3), (z0 + 56, 688), (z0 + 34, 654), (z0 + 22, 604), (z0 + 25, 552), (z0 + 42, 506),
       (z0 + 88, 478), (z0 + 152, 468)], tin=44, tout=50, b0=0.12, b1=0.2),
    S([(z0 + 128, 472), (z0 + 70, 438), (z0 + 14, 352)] + LOW, tin=30, b0=0.4, **TAIL),
], L='e', Rref='full')
