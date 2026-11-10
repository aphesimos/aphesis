"""Aphesis Script — the Greek diacritical marks: oxia (tonos) and varia, the two breathings, the
perispomeni, macron and breve, the iota subscript, and the stacks (breathing + accent, dialytika +
accent). The stacks are not drawn: they are the single marks' own strokes written again, side by side
or one above the other.

Greek does not borrow the Latin acute and grave. Polytonic Greek has to tell a breathing from an
accent beside it at text sizes, so the two are made unlike each other: the accents are long, slim,
straight flicks, the breathings short round hooks with a pressed head. The marks also keep their
size better across the weights than the Latin accents do (grow 0.5 against 0.75: the Light's marks
stay large enough to read, the Black's do not run into each other), and in the slanted styles they
lean only half as much as the letters (lean 0.5), so the varia keeps its direction."""
from brush import *
from parts import *
from glyphs_marks import GLYPHS as MARKS, pin
from glyphs_punct import dash, dot, DOTS

GLYPHS = {}
GREEK = dict(grow=0.5, rough=0.8)                          # how a Greek mark swells with the brush, and its tremor
LEAN = dict(lean=0.5)                                      # … and how it follows the slant

# ── the accents: centred on x = 0, standing on the line the Latin accents stand on ───────────────
GLYPHS['oxia'] = dict(strokes=[                            # pressed at the top right, drawn down to the left and lifted: longer and slimmer than the acute
    S(pin([(33, 680), (4, 621), (-29, 561)]), tin=16, tout=100, k=0.98, b0=0.5, b1=0.04, **GREEK),
], **LEAN)
GLYPHS['varia'] = dict(strokes=[                           # pressed at the top left, drawn down to the right (across the nib: less pressure)
    S(pin([(-35, 678), (-3, 620), (32, 562)]), tin=20, tout=108, k=0.58, b0=0.5, b1=0.04, **GREEK),
], **LEAN)

# ── the breathings: a comma and a comma turned round — a pressed head, a round back, a thin tail ──
GLYPHS['psili'] = dict(strokes=[                           # head, down the right side, the tail drawn out to the lower left (along the nib: it thins by itself)
    S(pin([(-24, 660), (-7, 667), (11, 659), (21, 640), (22, 618), (14, 597), (-2, 581), (-21, 572), (-35, 571)]),
      tin=14, tout=90, k=0.55, b0=0.6, b1=0.04, **GREEK),
], **LEAN)
GLYPHS['dasia'] = dict(strokes=[                           # head, down the left side, the tail to the lower right (across the nib: lifted early)
    S(pin([(24, 660), (7, 667), (-11, 659), (-21, 640), (-22, 618), (-15, 597), (0, 581), (17, 573), (30, 571)]),
      tin=14, tout=124, k=0.53, b0=0.62, b1=0.04, **GREEK),
], **LEAN)
GLYPHS['perispomeni'] = dict(strokes=[                     # a round cap in one arc: rising thin, over the top, falling thick, drawn out to the right
    S(pin([(-79, 588), (-60, 611), (-29, 629), (5, 632), (36, 621), (59, 603), (77, 592)]),
      tin=44, tout=80, k=0.74, b0=0.1, b1=0.05, **GREEK),
], **LEAN)
GLYPHS['macron'] = dict(strokes=[                          # a short dash, written like the hyphen
    dict(dash([(-75, 606), (-26, 612), (26, 609), (75, 614)], k=0.64), **GREEK),
], **LEAN)
GLYPHS['breve'] = dict(strokes=[                           # a shallow cup: set down at the upper left, falling thick, under, rising thin
    S(pin([(-66, 634), (-51, 612), (-22, 596), (12, 592), (44, 602), (64, 619), (78, 636)]),
      tin=24, tout=64, k=0.66, b0=0.35, b1=0.05, **GREEK),
], **LEAN)

# ── the iota subscript: a very small ι hanging below the baseline. The ι's own head and its own turn
#    at the foot (parts.py); the turn is written to this size and lifted before the exit runs out. ──
YT, YB, YS = -70, -192, 0.42                               # top of the head · the line the turn stands on · the size of the turn
GLYPHS['ypogegrammeni'] = dict(strokes=[
    S(pin(head(0, YT) + [(1 + x * YS, YB + y * YS) for x, y in tail(0)[:4]]),
      tin=20, tout=44, k=0.62, b0=0.55, b1=0.06, grow=0.5, rough=0.8),
])

# ── the ano teleia: the Greek raised point, a period hanging from the x-line ──────────────────────
GLYPHS['anoteleia'] = dict(strokes=[dict(dot(0, XH - 34), hang=True)], L=40, R=40, **DOTS)

# ── the stacks ────────────────────────────────────────────────────────────────────────────────────
# Every stroke swells about its own centre, so two parts come closer as the brush grows: the
# distances are set on the 800 master (nothing nearer than about 26 units there).
def again(st, s=1.0, dx=0.0, dy=0.0):
    """A mark's stroke written again: scaled by s about (0, MARK), then shifted. PIN is kept, the tapers
    scale with the stroke, the pressure a little less than the size (so a small copy does not go thin)."""
    return dict(st, pts=[(p[0] * s + dx, MARK + (p[1] - MARK) * s + dy) + tuple(p[2:]) for p in st['pts']],
                tin=st['tin'] * s, tout=st['tout'] * s, k=st['k'] * s ** 0.5)

def write(name, s=1.0, dx=0.0, dy=0.0):
    """The strokes of a single mark (one of the above, or a Latin one), written again as a Greek mark."""
    return [dict(again(st, s, dx, dy), **GREEK) for st in (GLYPHS[name] if name in GLYPHS else MARKS[name])['strokes']]

# breathing + accent, side by side, both at their own size: a hook beside a flick
GLYPHS['psilioxia'] = dict(strokes=write('psili', 1, -58) + write('oxia', 1, 60), **LEAN)
GLYPHS['psilivaria'] = dict(strokes=write('psili', 1, -76) + write('varia', 1, 70), **LEAN)     # two heads face each other: more room
GLYPHS['dasiaoxia'] = dict(strokes=write('dasia', 1, -58) + write('oxia', 1, 56), **LEAN)
GLYPHS['dasiavaria'] = dict(strokes=write('dasia', 1, -62) + write('varia', 1, 62), **LEAN)
# breathing + perispomeni: the cap above the breathing
GLYPHS['psiliperispomeni'] = dict(strokes=write('psili', 0.86, -6, -22) + write('perispomeni', 0.92, 0, 112), **LEAN)
GLYPHS['dasiaperispomeni'] = dict(strokes=write('dasia', 0.86, 6, -22) + write('perispomeni', 0.92, 0, 112), **LEAN)

# dialytika + accent (only ever on ι and υ): the two dots lower, where the accents have their foot, and
# the accent above the gap, its foot coming down between them
DOTS = MARKS['dieresis']['strokes']
def dots(apart=0.0, dy=0.0, s=1.0):
    """The two dots of the dieresis written again, each `apart` units further out."""
    return [again(DOTS[0], s, -apart, dy), again(DOTS[1], s, apart, dy)]
LOW = -30
GLYPHS['dieresistonos'] = dict(strokes=dots(28, LOW, 0.9) + write('oxia', 0.8, 22, 40), **LEAN)
GLYPHS['dieresisvaria'] = dict(strokes=dots(24, LOW, 0.9) + write('varia', 0.8, 2, 52), **LEAN)   # the varia crosses the dots' lean: it stands higher
GLYPHS['dieresisperispomeni'] = dict(strokes=dots(-6, LOW, 0.9) + write('perispomeni', 0.85, -6, 78), **LEAN)
