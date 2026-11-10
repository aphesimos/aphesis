"""Aphesis Script — symbols: ¡ ¿ « » ‹ › € % + − =. Nothing new is invented for them: they are written
with gestures the punctuation and the figures already have (the touch, the stroke of !, the hook of ?,
the dash, the slash, the ring, the family's oval), set down in other places."""
from brush import *
from parts import *
from glyphs_punct import GLYPHS as PUNCT, P, dot, dash, DOTS
from glyphs_marks import GLYPHS as MARKS
from glyphs_figures import FT                              # centreline of a round top at FIG

GLYPHS = {}

def moved(st, dx=0.0, dy=0.0):
    """A stroke written again somewhere else: same points, same tapers, same pressure."""
    return dict(st, pts=[(p[0] + dx, p[1] + dy) + tuple(p[2:]) for p in st['pts']])

def turned(pts, cx, cy=XH / 2):
    """Point reflection (by default in the middle of the x-height band), hand order reversed: what stood on
    the baseline and reached FIG hangs from the x-line and reaches as far below the baseline."""
    return [(2 * cx - p[0], 2 * cy - p[1]) + tuple(p[2:]) for p in reversed(pts)]

# ── ¡ ¿: not ! and ? turned over, but written for the lowercase — the touch under the x-line, and
#    below it a stroke that is pressed where it begins and lifted where it ends, like every other ────
HANG = XH - FIG                                            # −176: as far below the baseline as ! and ? rise above the x-line
DOT_UP = XH - 38                                           # centre of the touch at 400; it hangs from its top (the x-line) at every weight
EX = PUNCT['exclam']['strokes'][0]                         # the stroke of !: cut at the top, drawn out to a point
GLYPHS['exclamdown'] = dict(strokes=[
    dict(dot(-8, DOT_UP), hang=True),
    moved(EX, 0, HANG - EX['pts'][-1][1])],                # the same stroke hanging under the dot, its point on HANG
    L=45, R=45, **DOTS)
QU = PUNCT['question']['strokes'][0]                       # the hook of ?: its path turned, so the bowl opens the other way and lies at the bottom …
qc = 113                                                   # (the axis of the turn)
GLYPHS['questiondown'] = dict(strokes=[
    dict(dot(2 * qc - QU['pts'][-1][0] - 12, DOT_UP), hang=True),
    S([(p[0], p[1] - 10 * (i == 0)) + tuple(p[2:]) for i, p in enumerate(turned(QU['pts'], qc))],      # (begun 10 lower: room for the dot in the Black)
      tin=20, tout=110, k=QU['k'] * 0.91, b0=0.7, b1=0.05)],   # … but pressed under the dot and lifted in the curl (turned, the hook
                                                           # runs across the nib where ? runs along it: a little less pressure weighs the same)
    L=45, R=95, **DOTS)

# ── ‹ › « »: chevrons in the x-height. One movement each, the vertex a true corner (the point is
#    doubled, as in the circumflex). › is ‹ turned over, so the two weigh the same. ──────────────────
CH_T, CH_B, CH_W, CH_K = 388, 84, 106, 0.77                # top and bottom of the arms · their reach · the pressure
def chevron(x=0.0):
    """‹ — a thin stroke falling down-left to the vertex, a thick one falling down-right away from it."""
    v = (x, (CH_T + CH_B) / 2)
    return S(P([(x + CH_W - 4, CH_T), v, v, (x + CH_W, CH_B)]), tin=40, tout=64, k=CH_K, b0=0.15, b1=0.05, rough=0.5)   # (little tremor: four of them stand side by side)
def chevron_right(x=0.0):
    """› — the thick stroke first, down-right to the vertex, then the thin one down-left."""
    st = chevron(0)
    return dict(st, pts=[(p[0] + x, p[1]) + tuple(p[2:]) for p in turned(st['pts'], CH_W / 2, (CH_T + CH_B) / 2)],
                tin=st['tout'], tout=st['tin'], b0=st['b1'], b1=st['b0'])
CH_P = 164                                                 # pitch of the double ones (the white between them stays open in the Black)
GLYPHS['guilsinglleft'] = dict(strokes=[chevron()], L=40, R=40)
GLYPHS['guilsinglright'] = dict(strokes=[dict(chevron_right(), k=CH_K * 1.07)], L=40, R=40)     # (this drawing's tremor runs thin: evened with ‹)
GLYPHS['guillemotleft'] = dict(strokes=[chevron(), chevron(CH_P)], L=40, R=40)
GLYPHS['guillemotright'] = dict(strokes=[chevron_right(), chevron_right(CH_P)], L=40, R=40)

# ── €: a large c on the family's oval, from the baseline to FIG like 6 and 8 (terminal, shoulder,
#    back, bottom and exit as on c), and two written bars across its back ──────────────────────────
er = 150; ex = 40 + er; ey = (FT + BOT) / 2; eh = (FT - BOT) / 2
GLYPHS['Euro'] = dict(strokes=[
    S([(ex + 0.86 * er, FT - 44)] + oval(ex, er, 66, 300, 13, cy=ey, ry=eh) + [(ex + 0.86 * er, BOT + 66)], tin=40, tout=70, b0=0.3),
    dash([(ex - er - 80, ey + 51), (ex - er + 30, ey + 58), (ex - er + 120, ey + 55), (ex - er + 206, ey + 61)], k=0.7),
    dash([(ex - er - 80, ey - 61), (ex - er + 30, ey - 54), (ex - er + 110, ey - 57), (ex - er + 186, ey - 52)], k=0.7)],
    L=30, R=40)

# ── %: two small rings and a slash. The rings are the ring accent's one turn written half as large
#    again; they do not float, so they do not swell: the upper hangs from FIG, the lower sits on the
#    baseline. The slash is the slash's own stroke between FIG and the baseline. ─────────────────────
RING = MARKS['ring']['strokes'][0]
RS, RK = 1.5, 0.58                                         # the ring's size against the accent's · its pressure
def ring(cx, cy, **more):
    x0 = sum(p[0] for p in RING['pts']) / len(RING['pts']); y0 = sum(p[1] for p in RING['pts']) / len(RING['pts'])
    return dict(RING, pts=[(cx + (p[0] - x0) * RS, cy + (p[1] - y0) * RS, PIN) for p in RING['pts']],
                tin=RING['tin'] * RS, tout=RING['tout'] * RS, k=RK, grow=0, **more)
SL = PUNCT['slash']['strokes'][0]
def slashed(x0, x1, top=FIG, bot=0.0, k=0.95):
    """The slash's stroke fitted between two heights, its foot at x0 and its head at x1."""
    (xa, ya), (xb, yb) = SL['pts'][0][:2], SL['pts'][-1][:2]; s = (top - bot) / (ya - yb)
    fit = lambda p: (x0 + (p[0] - xb) / (xa - xb) * (x1 - x0), bot + (p[1] - yb) * s, PIN)
    return dict(SL, pts=[fit(p) for p in SL['pts']], tin=SL['tin'] * s, tout=SL['tout'] * s, k=k)
GLYPHS['percent'] = dict(strokes=[
    ring(138, FIG - 88),
    slashed(63, 362),
    ring(285, 76, sit=True)],
    L=40, R=40, Lref='all', Rref='all')

# ── + − =: written like the dashes, around the middle of the x-height. The upright of + is pressed a
#    little less than the bar (a brush is wider going down than going across), so both look equally strong.
MY = 235                                                   # the middle of the signs
BAR = [(0, -4), (100, 3), (205, -1), (306, 5)]             # one bar: the dash's slight wave
def bar(dy=0.0): return dash([(x, MY + y + dy) for x, y in BAR])      # … and the dash's own pressure
GLYPHS['minus'] = dict(strokes=[bar()], L=50, R=50, same='math')            # + − = stand on one width, so sums line up
GLYPHS['plus'] = dict(strokes=[
    bar(),
    S(P([(156, MY + 153), (154, MY + 50), (152, MY - 50), (149, MY - 153)]), tin=34, tout=50, k=0.71, b0=0.22, b1=0.05)],
    L=50, R=50, same='math')
GLYPHS['equal'] = dict(strokes=[bar(75), bar(-75)], L=50, R=50, same='math')
