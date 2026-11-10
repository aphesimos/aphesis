"""Aphesis Script — the Greek of the word the face is named after, αφεσις (drawn by the lead), and
the icon style. Same hand, same parts: α is the a with an open, leaning stem; ε is two of the e's
bowls; σ is the o with its lid; ς is the c with a tail; ι is the a's stem alone: set down on the
x-line without an entry, turned at the baseline into the exit. ο and ν are the Latin o and v."""
from brush import *
from parts import *

GLYPHS = {}
xs = 40 + PA
GLYPHS['alpha'] = dict(strokes=[
    S([(xs - 6, TOP - 10), (xs - 0.30 * PA, TOP), (xs - 0.70 * PA, TOP - 24), (xs - PA + 5, MID + 66),   # (begun 14 further from the stem than in 2.0: the gap stays open in the Black)
       (xs - PA, MID - 34), (xs - 0.82 * PA, BOT + 40), (xs - 0.54 * PA, BOT), (xs - 0.24 * PA, BOT + 42), (xs + 4, 190), (xs + 38, 330), (xs + 62, TOP - 6)],
      tin=30, tout=70, b0=0.5),
    S([(xs + 52, TOP - 2), (xs + 16, 330), (xs + 3, 210)] + tail(xs + 4), tin=40, tout=70),
], L='a')                                                   # the right side is measured: the leaning stem carries white an i's stem does not
W = 236; e0 = 40
GLYPHS['epsilon'] = dict(strokes=[
    S([(e0 + 0.92 * W, 372), (e0 + 0.60 * W, TOP), (e0 + 0.14 * W, 392), (e0 + 0.20 * W, 290), (e0 + 0.62 * W, MID + 12)], tin=36, tout=50, b1=0.2),
    S([(e0 + 0.60 * W, MID + 16), (e0 + 0.12 * W, 196), (e0, 110), (e0 + 0.28 * W, BOT + 6), (e0 + 0.62 * W, BOT), (e0 + 0.95 * W, 34), (e0 + 1.12 * W, 72)], tin=30, tout=70, b0=0.4),
], Rref='full')
cx = 40 + PO / 2
GLYPHS['sigma'] = dict(strokes=[
    S([(cx + PO / 2 + 118, TOP - 4), (cx + PO / 2 + 30, TOP + 2)] + oval(cx, PO / 2, 78, 78 + 300, 12) + [(cx + 0.30 * PO, TOP - 12)], tin=40, tout=50, b0=0.3, b1=0.4),
], L='o', Rref='full')
c0 = 40; Wc = 240
GLYPHS['sigmafinal'] = dict(strokes=[
    S([(c0 + 0.95 * Wc, 372), (c0 + 0.66 * Wc, TOP), (c0 + 0.24 * Wc, 408), (c0, 262), (c0 + 0.16 * Wc, 120), (c0 + 0.55 * Wc, 62),
       (c0 + 0.88 * Wc, 0), (c0 + 0.80 * Wc, -90), (c0 + 0.44 * Wc, -150)], tin=36, tout=90, b1=0.05),
], L='e', Rref='full')

xi = 40
GLYPHS['iota'] = dict(strokes=[
    S(head(xi) + tail(xi), tin=24, tout=70, b0=0.55),
], R='i', top=xi + 4)

# ── ss01: the icon style ───────────────────────────────────────────────────────────────────────────
# The site's icons are drawn as brush outlines filled with a deterministic scatter of small squares
# (stipple). Stylistic set 1 gives a few symbols that treatment: the brush strokes stay, and the white
# they enclose is dusted with squares thrown by the same xorshift generator the icons use. A square is
# kept only where it clears the ink in every weight master, so the same squares exist everywhere
# (they move with the skeleton and swell a little, never appear or vanish) and nothing clogs at 800.
import numpy as np
from glyphs_punct import GLYPHS as PUNCT, P as pinned

def _clear(name, strokes, margin=7):
    """test(x, y, side) for stipple(): True where a square of that side is clear of the strokes at
    300, 400 and 800 (upright; the slant shears ink and squares alike)."""
    spec = dict(strokes=strokes); polys = {}
    for w in MASTER_WEIGHTS:
        polys[w] = [smooth_poly(Q) for Q in glyph_outlines(name, spec, w, 0)]
    def dist_inside(q, Q):
        a, b = Q, np.roll(Q, -1, axis=0); ab = b - a
        t = np.clip(((q - a) * ab).sum(1) / ((ab * ab).sum(1) + 1e-9), 0, 1)
        d = np.hypot(*(a + ab * t[:, None] - q).T).min()
        up = (a[:, 1] <= q[1]) & (b[:, 1] > q[1]); dn = (a[:, 1] > q[1]) & (b[:, 1] <= q[1])
        side = ab[:, 0] * (q[1] - a[:, 1]) - ab[:, 1] * (q[0] - a[:, 0])
        wind = int((up & (side > 0)).sum()) - int((dn & (side < 0)).sum())
        return d, wind != 0
    def test(x, y, side):
        for w in MASTER_WEIGHTS:
            q = np.array([x * hx(w), y]); need = side * (wmax(w) / 80) ** 0.5 * 0.71 + margin
            for Q in polys[w]:
                d, inside = dist_inside(q, Q)
                if inside or d < need: return False
        return True
    return test

def _dusted(base, name, region, box, count, seed, size=15, extra=None, **keep):
    strokes = [dict(st) for st in (extra or PUNCT[base]['strokes'])]
    clear = _clear(name, strokes)
    sq = stipple(lambda x, y, side: region(x, y) and clear(x, y, side), seed, count, box, size=size, sep=1.5)
    return dict(strokes=strokes, squares=sq, **{k: PUNCT[base][k] for k in ('L', 'R', 'Lref', 'Rref') if k in PUNCT[base]}, **keep)

# · — the seed: a small ring of the brush with grains inside (the circled point of the old tables)
def _turn(cx, cy, a, b, tilt, a0, sweep, n):
    ct, st_ = math.cos(math.radians(tilt)), math.sin(math.radians(tilt)); out = []
    for i in range(n):
        t = math.radians(a0 + sweep * i / (n - 1)); u, v = a * math.cos(t), b * math.sin(t)
        out.append((round(cx + u * ct - v * st_, 1), round(cy + u * st_ + v * ct, 1), PIN))
    return out
SEED_Y = 232
GLYPHS['periodcentered.ss01'] = _dusted(
    'periodcentered', 'periodcentered.ss01', lambda x, y: math.hypot(x, y - SEED_Y) < 56, (-60, SEED_Y - 60, 60, SEED_Y + 60), 160, 0x5EED,
    size=13, extra=[S(_turn(0, SEED_Y, 88, 78, 128, 46, 428, 25), tin=40, tout=50, k=0.5, b0=0.2, b1=0.1, grow=0.3, rough=0.6)])
GLYPHS['periodcentered.ss01'].update(L=50, R=50)

# * — the written asterisk with dust between its rays
AY = 580
GLYPHS['asterisk.ss01'] = _dusted('asterisk', 'asterisk.ss01', lambda x, y: 34 < math.hypot(x, y - AY) < 132,
                                  (-135, AY - 135, 135, AY + 135), 700, 0xA57E, size=13)
# # — the grid with its middle field dusted
GLYPHS['numbersign.ss01'] = _dusted('numbersign', 'numbersign.ss01', lambda x, y: 150 < y < 410 and 70 < x - (y - 280) * 0.17 < 290,
                                    (60, 150, 330, 410), 500, 0x4A54, size=14)
# & — the et with a dusted bowl
GLYPHS['ampersand.ss01'] = _dusted('ampersand', 'ampersand.ss01', lambda x, y: ((x - 196) / 150) ** 2 + ((y - 160) / 135) ** 2 < 1,
                                   (40, 20, 350, 300), 260, 0xE7E7)
