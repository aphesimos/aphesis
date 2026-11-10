"""Aphesis Script — the straight letters: m u r l j k f t and ß, built on the lead's n h i."""
from brush import *
from parts import *

GLYPHS = {}
x = 40                                                     # centre of the first stem

# ── parts shared inside this group ───────────────────────────────────────────────────────────────
ARCHFOOT = dict(tin=JOIN['tin'], tout=STEM['tout'], b1=STEM['b1'])    # an arch that ends in a foot (m)

def headp(x, top=XH):
    """head(), with the set-down pinned: where the cut is not covered by a bowl (u, t) it has to stay
    on its line at every weight, like a foot."""
    h = head(x, top)
    return [h[0] + (PIN,)] + h[1:]

def hook(x, top=ASC, w=104):
    """Top of f: begun at the right with a pressed beak, over the top at the ascender line, into the stem."""
    return [(x + w, top - HW - 58), (x + w - 14, top - HW - 20), (x + w - 52, top - HW), (x + 16, top - HW - 34), (x, top - 150)]
HOOK = dict(tin=46, b0=0.25)

def bar(x, l=78, r=112, y=XH - 26):
    """Crossbar of f and t, written like the entry of a stem: a hairline in along the nib's edge, the
    bar just under the x-line (longer to the right), a small lift out. Its ends are the nib's own
    cut, so the bar stays a bar at every weight instead of thinning to two points."""
    return [(x - l - 20, y - 22), (x - l + 4, y - 3), (x + 14, y + 3), (x + r - 8, y + 8), (x + r + 14, y + 24)]
BAR = dict(tin=18, tout=22, k=0.8, b0=0.3, b1=0.2)

# ── m: the n with a second arch ──────────────────────────────────────────────────────────────────
UM = round(0.93 * U)                                       # stem pitch of m (227)
GLYPHS['m'] = dict(strokes=[
    S(entry(x) + [(x, 200)] + foot(x), **STEM),
    S(arch(x, x + UM) + [(x + UM, 124)] + foot(x + UM), **ARCHFOOT),
    S(arch(x + UM, x + 2 * UM) + tail(x + 2 * UM), **JOIN),
])

# ── u: the n turned over ─────────────────────────────────────────────────────────────────────────
GLYPHS['u'] = dict(strokes=[
    S(entry(x) + [(x, 176), (x + 0.12 * U, BOT + 46), (x + 0.45 * U, BOT), (x + U - 62, BOT + 42), (x + U - 2, 180)],
      tin=62, tout=56),
    S(headp(x + U) + tail(x + U), tin=24, tout=70, b0=0.55),
])

# ── r ────────────────────────────────────────────────────────────────────────────────────────────
GLYPHS['r'] = dict(strokes=[
    S(entry(x) + [(x, 200)] + foot(x), **STEM),
    S(arch(x, x + U)[:2] + [(x + 0.41 * U, TOP + 1), (x + 0.565 * U, TOP - 16)], tin=40, tout=60),
], Rref='full', Radj=(-4, -3, 0))

# ── l ────────────────────────────────────────────────────────────────────────────────────────────
GLYPHS['l'] = dict(strokes=[
    S(flag(x) + [(x, 300)] + tail(x), tin=62, tout=70),
])

# ── j ────────────────────────────────────────────────────────────────────────────────────────────
WJ = 92                                                    # the turn: a quarter of the family's squared oval, as under g, but narrow
GLYPHS['j'] = dict(strokes=[
    S(entry(x) + [(x, 120)] + oval(x - WJ, WJ, 0, -90, 4, cy=-40, ry=-40 - (DESC + HW)) + [(x - WJ - 66, -194)],
      tin=62, tout=104),                                   # the tail thins out from the bottom of the turn into a lifted point
    dict(touch(x + 4, MARK), dot=True),
])

# ── k ────────────────────────────────────────────────────────────────────────────────────────────
XK = x + 196                                               # the leg ends like the tail of a stem standing here
GLYPHS['k'] = dict(strokes=[                               # arm and leg are one gesture, lifted at the turn inside the stem
    S(flag(x) + [(x, 300)] + foot(x), **STEM),
    S([(x + 208, XH - 20, PIN), (x + 110, 336), (x - 8, 210)], tin=42, tout=40, b0=0.22, b1=0.3),
    S([(x - 8, 224), (x + 46, 170), (x + 108, 114)] + tail(XK)[1:], tin=36, tout=70, b0=0.3),
], Radj=(6, 10, 18), nestleR=0.5)                           # the leg's tail runs further out than a stem's: it gets more room, most in the Black

# ── f ────────────────────────────────────────────────────────────────────────────────────────────
GLYPHS['f'] = dict(strokes=[
    S(hook(x) + [(x, 380), (x, 100)] + foot(x, DESC), **dict(DESCENDER, **HOOK)),
    S(bar(x), **BAR),
], Rref='full', nestleR=0.6, Radj=(-5, -4, 0))             # the bar must stay a bar: round letters tuck under it only a little

# ── t ────────────────────────────────────────────────────────────────────────────────────────────
GLYPHS['t'] = dict(strokes=[
    S(headp(x, XH + 110) + tail(x), tin=24, tout=70, b0=0.55),
    S(bar(x), **BAR),
], Rref='full', Radj=(-5, -4, 0))

# ── ß ────────────────────────────────────────────────────────────────────────────────────────────
# The long s and a small s written into it. The hook of the long s is carried round into the upper
# bowl (begun, as f is, at the right, here down at the waist); then the lower half of an s: spine, bowl
# and the s's own terminal, which stops short of the stem — the letter stays open below, so it is
# never a B.
GLYPHS['germandbls'] = dict(strokes=[
    S([(x + 124, 452), (x + 166, 496), (x + 184, 568), (x + 168, 648), (x + 104, ASC - HW), (x + 42, ASC - HW - 12),
       (x + 7, ASC - 80), (x, ASC - 148), (x, 380), (x, 200)] + foot(x), **dict(STEM, tin=44)),
    S([(x + 112, 476), (x + 170, 404), (x + 226, 318), (x + 250, 214), (x + 228, 96), (x + 160, BOT), (x + 92, 46)],
      tin=34, tout=60, b0=0.2),
])
