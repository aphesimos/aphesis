"""Aphesis Script — the diacritical marks: acute grave circumflex tilde dieresis ring cedilla
(and the narrow circumflex and dieresis of î ï)."""
import math
from brush import *
from parts import *

GLYPHS = {}

def pin(pts):
    """Marks float: none of their points moves with the weight."""
    return [(p[0], p[1], PIN) for p in pts]

def turn(cx, cy, a, b, tilt, a0, sweep, n):
    """n points on a small oval (semi-axis a along `tilt` degrees, b across it), counter-clockwise
    from angle a0 (measured from the long axis) through `sweep` degrees."""
    ct, st = math.cos(math.radians(tilt)), math.sin(math.radians(tilt)); out = []
    for i in range(n):
        t = math.radians(a0 + sweep * i / (n - 1)); u, v = a * math.cos(t), b * math.sin(t)
        out.append((round(cx + u * ct - v * st, 1), round(cy + u * st + v * ct, 1)))
    return out

FLOAT = dict(grow=0.75, rough=0.8)        # like the i-dot: swells about its own centre, small hand tremor

# ── top marks: drawn centred on x = 0, around MARK ───────────────────────────────────────────────
GLYPHS['acute'] = dict(strokes=[                           # pressed at the top right, flicked down-left; steep + k so it weighs like the grave
    S(pin([(26, 664), (2, 609), (-28, 557)]), tin=18, tout=80, k=1.14, b0=0.5, b1=0.05, **FLOAT),
])
GLYPHS['grave'] = dict(strokes=[                           # pressed at the top left, flicked down-right (the brush's own thick direction)
    S(pin([(-30, 661), (-1, 609), (32, 560)]), tin=23, tout=104, k=0.7, b0=0.5, b1=0.05, **FLOAT),
])
GLYPHS['circumflex'] = dict(strokes=[                      # thin up, thick down; ONE stroke with the apex point doubled (a true corner):
    # two separate strokes each grow about their own centre, so the apex opens at 300 and crosses at 800
    S(pin([(-90, 560), (-12, 661), (-12, 661), (40, 609), (96, 558)]), tin=40, tout=70, k=0.7, b0=0.1, b1=0.05, **FLOAT),
])
GLYPHS['tilde'] = dict(strokes=[                           # thin rising entry, thick diagonal, thin rising exit; bends kept wider than the brush
    S(pin([(-108, 600), (-85, 618), (-71, 626), (-56, 630), (-40, 629.5), (-25, 625), (0, 614),
           (25, 603), (40, 598.5), (56, 598), (71, 602), (85, 610), (108, 628)]),
      tin=50, tout=50, k=0.66, b0=0.08, b1=0.05, grow=0.5, rough=0.8),     # grows less than the dots: at 800 it must not span the letter
])
GLYPHS['dieresis'] = dict(strokes=[                        # two touches a little smaller than the i-dot, pitch 130, the second written again
    touch(-70, MARK, size=0.88),
    touch(60, MARK + 2, size=0.86, ang=-54),
])
# on the i the circumflex and the dieresis are written closer, so they do not reach into the neighbours
GLYPHS['circumflexnarrow'] = dict(strokes=[
    S(pin([(-66, 566), (-9, 656), (-9, 656), (30, 610), (70, 566)]), tin=34, tout=60, k=0.7, b0=0.1, b1=0.05, **FLOAT),
])
GLYPHS['dieresisnarrow'] = dict(strokes=[
    touch(-52, MARK, size=0.8),
    touch(46, MARK + 2, size=0.78, ang=-54),
])
GLYPHS['ring'] = dict(strokes=[                            # one turn on an oval leaning across the nib, so the outside stays round and the
    # counter leans like the o's; begun and closed inside the thick lower left
    S(pin(turn(0, 615, 47, 41, 128, 40, 440, 23)), tin=30, tout=40, k=0.46, b0=0.2, b1=0.1, grow=0.75, rough=0.4),
])

# ── cedilla: hangs from the attach point (0, 0); the stroke begins buried in the letter's bowl ────
# grow 0.5, not 0.75: with 0.75 the buried start lifts off the bowl at 300 or pokes into the counter at 800
GLYPHS['cedilla'] = dict(strokes=[
    S(pin([(0, 30), (8, -14), (26, -58), (30, -100), (12, -136), (-22, -156), (-58, -162)]),
      tin=40, tout=130, k=0.58, b0=0.3, b1=0.04, grow=0.5, rough=0.8),
])

# ── the dotless i that carries the accents (the composites and their anchors are made in build.py) ─
GLYPHS['dotlessi'] = dict(like='i')
GLYPHS['dotlessj'] = dict(like='j')
