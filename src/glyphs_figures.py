"""Aphesis Script — the figures: proportional oldstyle 0–9, written with the letters' brush.
0 1 2 live in the x-height band, 6 8 rise to FIG, 3 4 5 7 9 hang to FD."""
from brush import *
from parts import *

GLYPHS = {}
FD = -190                      # bottom (outer edge) of the descending figures 3 4 5 7 9
FB = FD + HW                   # centreline of a round bottom down there
FT = FIG - HW                  # centreline of a round top of the ascending figures 6 8
FLAT = XH - HW                 # centreline of a flat stroke lying under the x-line

# ── parts the figures share ───────────────────────────────────────────────────────────────────────
def hook(x0, w, top=TOP):
    """The start of 2 and 3: a small terminal at the upper left, rising into the round top."""
    return [(x0, top - 86), (x0 + 0.10 * w, top - 28), (x0 + 0.37 * w, top)]

def belly(xl, xr, yt, a0):
    """The hanging bowl of 3 and 5: over its top (yt), round the right side (xr), under to FD and
    out to the left in a lifted taper — the s's last movement, a storey lower."""
    w = xr - xl; cx = xl + 0.52 * w
    return oval(cx, xr - cx, a0, -84, 7, cy=(yt + FB) / 2, ry=(yt - FB) / 2) + [(xl + 0.20 * w, FB + 16), (xl - 0.02 * w, FB + 54)]

# 0 — the o's one turn of the brush, narrower
rz = 120; cz = 40 + rz
GLYPHS['zero'] = dict(strokes=[
    S(oval(cz, rz, 126, 126 + 408, 18), tin=40, tout=44, b0=0.5, b1=0.35),
])

# 1 — a long open flag on the hairline angle, stem, lifted on the baseline
x = 170
GLYPHS['one'] = dict(strokes=[
    S([(x - 124, XH - 122), (x - 64, XH - 75), (x - 7, XH - 30), (x + 1, XH - 106), (x, 200)] + foot(x), **STEM),
])

# 2 — terminal, round top, the neck thinning to a hairline on the baseline; the base swells out of that point
x0 = 40; w = 232
GLYPHS['two'] = dict(strokes=[
    S([(x0 + 10, 346), (x0 + 0.16 * w, 410), (x0 + 0.50 * w, TOP), (x0 + 0.90 * w, 400), (x0 + w, 318),
       (x0 + 0.78 * w, 206), (x0 + 0.40 * w, 96), (x0 - 2, 10, PIN)], tin=40, tout=34, b0=0.3, b1=0.1),
    S([(x0 + 2, 14, PIN), (x0 + 60, 22), (x0 + 110, 26), (x0 + 0.62 * w, 25), (x0 + 0.80 * w, 28), (x0 + w + 26, 42)], tin=50, tout=60, b0=0.15),
], Rref='full')

# 3 — two bowls open to the left, meeting in a point
x0 = 40; w = 250; yw = 196
GLYPHS['three'] = dict(strokes=[
    S([(x0 + 0.13 * w, 358), (x0 + 0.23 * w, 416), (x0 + 0.50 * w, TOP), (x0 + 0.80 * w, 408), (x0 + 0.89 * w, 336),
       (x0 + 0.79 * w, yw + 78), (x0 + 0.36 * w, yw)], tin=40, tout=40, b0=0.3, b1=0.1),
    S([(x0 + 0.36 * w + 2, yw + 3)] + belly(x0, x0 + w, yw + 12, 100), tin=50, tout=60, b0=0.15),
])

# 4 — diagonal out of the head of the stem, bar on the baseline, stem to a point
x0 = 40; xs = x0 + 240
GLYPHS['four'] = dict(strokes=[
    S([(xs - 6, 430), (xs - 100, 270), (x0 + 60, 100), (x0 - 2, 10, PIN)], tin=20, tout=34, b0=0.4, b1=0.1),
    S([(x0 + 2, 14, PIN), (x0 + 60, 22), (x0 + 110, 26), (x0 + 170, 25), (xs + 20, 29), (xs + 82, 40)], tin=50, tout=50, b0=0.15),
    S([(xs - 7, XH - 2, PIN), (xs + 1, XH - 62), (xs, 100)] + foot(xs, FD), tin=24, tout=120, b0=0.55, b1=0.07),
], Lref='full')

# 5 — short stem, the bowl branching from its foot, flag
xs = 60; w = 230
GLYPHS['five'] = dict(strokes=[
    S([(xs - 7, XH - 2, PIN), (xs + 1, XH - 62), (xs, 300), (xs - 2, 228)], tin=24, tout=30, b0=0.55, b1=0.42),
    S([(xs - 10, 232)] + belly(xs - 30, xs + w, 304, 116), tin=40, tout=60, b0=0.3),
    S([(xs - 8, FLAT - 2), (xs + 0.36 * w, FLAT - 3), (xs + 0.62 * w, FLAT), (xs + 0.86 * w, FLAT + 10)], tin=16, tout=56, b0=0.5),
])

# 6 — one sweep from the upper right into the bowl; 9 — the 6 turned over
def six_path(cx, rx, bt=350):
    return ([(cx + 0.80 * rx, FT - 26), (cx + 0.20 * rx, FT), (cx - 0.46 * rx, 510), (cx - 0.97 * rx, 316)]
            + oval(cx, rx, 188, 450, 9, cy=(bt + BOT) / 2, ry=(bt - BOT) / 2)
            + [(cx - 0.62 * rx, 296), (cx - 0.96 * rx, 220)])
cx = 40 + 124
GLYPHS['six'] = dict(strokes=[S(six_path(cx, 124), tin=60, tout=50, b0=0.2, b1=0.3)])
def turned(pts, cx):
    """Point reflection in the middle of the x-height band, hand order reversed; what hangs below the baseline is drawn out to FD."""
    f = (BOT - FB - 4) / (FT - TOP)
    return [(2 * cx - x, (lambda y: y if y >= BOT else BOT + (y - BOT) * f)(TOP + BOT - y)) for x, y in reversed(pts)]
GLYPHS['nine'] = dict(strokes=[S(turned(six_path(cx, 124), cx), tin=50, tout=60, b0=0.3, b1=0.2)])

# 7 — bar under the x-line with a small entry, drawn to a point at the right; the diagonal hangs from that point
x0 = 40; w = 256
GLYPHS['seven'] = dict(strokes=[
    S([(x0 - 22, FLAT - 40), (x0 + 14, FLAT - 12), (x0 + 0.34 * w, FLAT - 1), (x0 + 0.70 * w, FLAT), (x0 + w + 4, XH - 4, PIN)],
      tin=36, tout=50, b0=0.15, b1=0.1),
    S([(x0 + w + 4, XH - 4, PIN), (x0 + 0.80 * w, 300), (x0 + 0.50 * w, 20), (x0 + 0.34 * w, FD, PIN)], tin=50, tout=120, b0=0.1, b1=0.07),
], Lref='full', Rref='full')

# 8 — an S that returns. Two strokes that meet inside the spine, so that neither crosses itself.
cx = 40 + 120; ru = 104; rl = 120; cyu = 482; cyl = 170
U = lambda a0, a1, n: oval(cx, ru, a0, a1, n, cy=cyu, ry=FT - cyu)
L = lambda a0, a1, n: oval(cx, rl, a0, a1, n, cy=cyl, ry=cyl - BOT)
(ux, uy), (lx, ly) = U(220, 220, 2)[0], L(45, 45, 2)[0]            # where the spine leaves the upper bowl / enters the lower one
yc = uy + (cx - ux) * (ly - uy) / (lx - ux)                         # the crossing
dx, dy = 10 * (lx - ux) / math.hypot(lx - ux, ly - uy), -10 * (ly - uy) / math.hypot(lx - ux, ly - uy)
GLYPHS['eight'] = dict(strokes=[
    S(U(126, 220, 4) + [(cx, yc)] + L(45, -225, 9) + [(cx + dx, yc + dy)], tin=40, tout=30, b0=0.5, b1=0.5),
    S([(cx - dx, yc - dy)] + U(-40, 172, 7), tin=30, tout=44, b0=0.5, b1=0.35),
])
