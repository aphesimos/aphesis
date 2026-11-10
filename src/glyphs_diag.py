"""Aphesis Script — the diagonal letters: v w x y z. Thick down-right diagonals, thin up-right ones."""
from brush import *
from parts import *

GLYPHS = {}

# ── parts shared inside this group ───────────────────────────────────────────────────────────────
def dentry(x, top=XH):
    """Small hairline entry into the head of a diagonal that starts at x (a shorter `entry`)."""
    return [(x - 42, top - 56), (x, top - 27)]

def fall(xh, xv, tip=None):
    """Thick diagonal from its head at xh down-right to a pointed vertex at xv on the round baseline."""
    r = (xv - xh) / 140
    return [(xv - 118 * r, 340), (xv - 76 * r, 213), (xv - 41 * r, 125), (xv - 18 * r, 59), tip or (xv, -OV, PIN)]

def rise(xv, xt):
    """Thin diagonal from the vertex at xv up-right to a lifted terminal near xt at the x-line."""
    r = (xt - xv) / 153
    return [(xv, -OV, PIN), (xv + 22 * r, 53), (xv + 49 * r, 119), (xv + 85 * r, 208), (xv + 127 * r, 337), (xt, 440), (xt - 6, 470, PIN)]

FALL = dict(tin=54, tout=125, b1=0.07)        # head with entry, drawn out to the vertex
RISE = dict(tin=100, tout=80, b0=0.1, k=0.9)  # hairline swelling out of the vertex, lifted at the x-line

# ── v ────────────────────────────────────────────────────────────────────────────────────────────
xh = 60; xv = xh + 140
GLYPHS['v'] = dict(strokes=[
    S(dentry(xh) + fall(xh, xv), **FALL),
    S(rise(xv, xv + 153), **RISE),
], Lref='full', Rref='full')

# ── w ────────────────────────────────────────────────────────────────────────────────────────────
A, Bw = 120, 128
v1 = xh + A; xa = v1 + Bw; v2 = xa + A; xt = v2 + Bw
ya = XH
rA = A / 118; rB = Bw / 126
GLYPHS['w'] = dict(strokes=[
    S(dentry(xh) + fall(xh, v1), **dict(FALL, k=0.94)),
    S([(v1, -OV, PIN), (v1 + 8 * rB, 46), (v1 + 24 * rB, 104), (v1 + 63 * rB, 228), (v1 + 102 * rB, ya - 112), (v1 + 118 * rB, ya - 54), (xa, ya, PIN)],
      tin=100, tout=100, b0=0.1, b1=0.07, k=0.82),
    S([(xa + 2, ya - 1, PIN), (xa + 6 * rA, ya - 60), (xa + 21 * rA, ya - 123)] + fall(xa, v2)[1:], tin=125, tout=125, b0=0.07, b1=0.07, k=0.94),   # set down a hair beside the lift
    S(rise(v2, xt), **dict(RISE, k=0.82)),
], Lref='full', Rref='full')

# ── x ────────────────────────────────────────────────────────────────────────────────────────────
xs = xh + 205
GLYPHS['x'] = dict(strokes=[
    S(dentry(xh) + [(xh + 32, 372), (xh + 105, 245), (xh + 174, 126)] + tail(xs)[1:], tin=54, tout=70),
    S([(xh - 14, -6, PIN), (xh - 4, 30), (xh + 30, 104), (xh + 105, 242), (xh + 180, 372), (xh + 212, 440), (xh + 207, 470, PIN)],
      tin=70, tout=80, b0=0.1, k=1.1),
], Lref='full', Rref='full')

# ── y ────────────────────────────────────────────────────────────────────────────────────────────
GLYPHS['y'] = dict(strokes=[
    S(dentry(xh) + fall(xh, xv, tip=(xv - 2, -4)), **FALL),
    S(rise(xv, xv + 153)[:1:-1] + [(xv + 22, 53), (xv - 4, -10), (xv - 44, -104), (xv - 96, -178), (xv - 158, -210), (xv - 226, DESC + 8, PIN)],
      tin=80, tout=110, b0=0.04, k=0.9),
], Lref='full', Rref='full')

# ── z ────────────────────────────────────────────────────────────────────────────────────────────
xz = 40; zs = xz + 168
GLYPHS['z'] = dict(strokes=[
    S([(xz, 404), (xz + 26, 426), (xz + 72, 435), (xz + 140, 431), (xz + 224, 432), (xz + 184, 350), (xz + 119, 232),
       (xz + 45, 78), (xz + 24, 38), (xz - 2, 2, PIN)], tin=40, tout=80, b1=0.1),
    S([(xz - 2, 2, PIN), (xz + 42, 27), (xz + 130, 31)] + tail(zs)[2:], tin=44, tout=70, b0=0.07),
], solo='R', Radj=(6, 5, 0))                                 # its right side looks like x's to the profile, but the top bar is not a hairline
