"""Aphesis Script — shared anatomy. The parts every letter is assembled from, so that entry hooks,
exit tails, stems and arches are literally the same gesture wherever they occur.
All values are centerline coordinates for wght 400 (see brush.py for how other weights follow)."""
import math
from brush import XH, OV, ASC, DESC, MARK, FIG, PIN, S, touch, WV, WH

HW = WH(400) / 2            # half width of a horizontal stroke at 400 (28.2)
VW = WV(400) / 2            # half width of a vertical stem at 400 (33.3)
TOP = XH + OV - HW          # centerline of a round top    (≈ 443.8)
BOT = -OV + HW              # centerline of a round bottom (≈ 20.2)
MID = (TOP + BOT) / 2       # 232
U = 244                     # the rhythm unit: stem pitch of n / h / m / u (centre to centre)
PA = 258                    # bowl-side to stem pitch of a d g q b p
PO = 288                    # side to side pitch of o

def entry(x, top=XH):
    """Hairline entry rising from the lower left into the top of a stem centred on x."""
    return [(x - 58, top - 62), (x - 7, top - 27), (x + 1, top - 104)]

def flag(x, top=ASC):
    """The same entry, on an ascender."""
    return [(x - 52, top - 52), (x - 6, top - 24), (x + 1, top - 112)]

def head(x, top=XH):
    """A stem begun without an entry: the brush set down at the x-line, cut on the nib's slope.
    The first point is pinned, so an exposed head keeps its height at every weight."""
    return [(x - 7, top - 2, PIN), (x + 1, top - 62)]

def tail(x):
    """Turn at the baseline and exit tail of a stem centred on x (the script's joining gesture)."""
    return [(x, 124), (x + 13, 46), (x + 44, 21), (x + 78, 27), (x + 108, 54)]

def foot(x, y=0):
    """A stem simply lifted at the baseline (or at the descender line)."""
    return [(x, y, PIN)]

def arch(x0, x1, y0=250):
    """Branch leaving a stem at x0 (inside it, at height y0), over the top, into a stem at x1."""
    w = x1 - x0
    return [(x0, y0), (x0 + 0.20 * w, TOP - 66), (x0 + 0.55 * w, TOP), (x0 + 0.88 * w, TOP - 46), (x1, TOP - 156)]

def oval(cx, rx, a0, a1, n=6, sq=2.25, cy=MID, ry=(TOP - BOT) / 2):
    """Points on the round letter's centerline (a slightly squared oval) from angle a0 to a1
    (degrees, counter-clockwise positive, 0° = right, 90° = top)."""
    out = []
    for i in range(n):
        t = math.radians(a0 + (a1 - a0) * i / (n - 1)); c, s = math.cos(t), math.sin(t)
        out.append((cx + rx * math.copysign(abs(c) ** (2 / sq), c), cy + ry * math.copysign(abs(s) ** (2 / sq), s)))
    return out

# stroke presets: how the brush is set down and lifted
STEM = dict(tin=62, tout=30, b1=0.42)          # stem with hairline entry, lifted bluntly on the baseline
DESCENDER = dict(tin=62, tout=120, b1=0.07)    # … or drawn out to a point below it, like the φ's own stem
JOIN = dict(tin=40, tout=70)                   # arch or bowl leaving a stem, ending in the exit tail
