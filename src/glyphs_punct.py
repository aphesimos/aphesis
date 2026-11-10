"""Aphesis Script — punctuation and symbols: every dot a pressed touch, every dash a written stroke."""
from brush import *
from parts import *

GLYPHS = {}

def P(pts, dx=0, dy=0):
    """Pin every point (floating marks do not move with weight) and shift the drawing."""
    return [(p[0] + dx, p[1] + dy, PIN) for p in pts]

# ── the dot: one pressed touch ─────────────────────────────────────────────────────────────────────
DOT_K, DOT_SIZE = 1.5, 1.4                   # pressure and length against the i-dot (which is 1, 1)
DOT_Y = 27                                   # centre of a touch whose lowest ink sits on the baseline
DOTS = dict(Lref='full', Rref='full')        # marks whose structure is at the baseline, not at mid-height

def dot(x=0, y=DOT_Y, k=1.0, size=1.0, ang=-58):
    return touch(x, y, k=DOT_K * k, size=DOT_SIZE * size, ang=ang, sit=abs(y - DOT_Y) < 3)    # baseline dots stay on the baseline

# ── the comma: the same touch, not lifted but flicked away down-left ────────────────────────────────
FLICK = [(-14.6, 23.4), (5.6, 3.3), (14.5, -22), (9, -56), (-6, -90), (-36, -122)]   # from the touch's centre

def flick(x=0, y=DOT_Y, s=1.14, turned=False):
    """Touch and tail in one gesture: the brush is set down as for the period and released while it
    turns down-left; pressure falls steadily along the whole stroke, so the tail ends as a hairline.
    turned: the reverse gesture (‘) — thin lead-in from the upper right, ending in the pressed touch."""
    k, tin, tout = 1.68 * s, 24 * s ** .5, 252 * s ** .5
    if turned:
        return S(P([(-a * s, -b * s) for a, b in reversed(FLICK)], x, y), tin=tout, tout=tin, k=k, b0=0.03, b1=0.46, rough=0.8, grow=0.38)
    return S(P([(a * s, b * s) for a, b in FLICK], x, y), tin=tin, tout=tout, k=k, b0=0.46, b1=0.03, rough=0.8, grow=0.38)

GLYPHS['period'] = dict(strokes=[dot()], L=40, R=40, **DOTS)
GLYPHS['comma'] = dict(strokes=[flick()], L=40, R=40, **DOTS)
GLYPHS['colon'] = dict(strokes=[dot(), dot(2, 330, ang=-56)], L=40, R=40, **DOTS)
GLYPHS['semicolon'] = dict(strokes=[flick(), dot(2, 330, ang=-56)], L=40, R=40, **DOTS)
GLYPHS['periodcentered'] = dict(strokes=[dot(0, 228, k=1.08, size=1.14)], L=62, R=62)     # the site's separator: a little fuller than the period, set between word spaces
GLYPHS['ellipsis'] = dict(strokes=[dot(0, DOT_Y, ang=-60, size=0.97), dot(165, DOT_Y + 1, ang=-56, size=1.03),
                                   dot(330, DOT_Y, ang=-59, k=0.98)], L=40, R=40, **DOTS)

# ── exclam, question: a written stroke over a touch ────────────────────────────────────────────────
GLYPHS['exclam'] = dict(strokes=[
    S(P([(-5, FIG - 1), (1, FIG - 70), (2, 390), (-1, 158)]), tin=20, tout=430, k=1.08, b0=0.8, b1=0.04),
    dot(-8)], L=45, R=45, **DOTS)
q = 106                                                    # the question's axis
GLYPHS['question'] = dict(strokes=[
    S([(-4, 536), (38, 580), (104, FIG - HW), (163, 599), (206, 564), (222, 516), (208, 462), (166, 392),
       (126, 318), (q + 1, 240), (q, 150, PIN)], tin=60, tout=230, k=0.96, b0=0.1, b1=0.04),
    dot(q - 8)], L=95, R=45, **DOTS)

# ── quotes ──────────────────────────────────────────────────────────────────────────────────────────
QS = 0.92                                                  # a quote is a slightly smaller comma
QY = ASC - 20 - 47                                         # touch centre of a raised comma (top at ASC − 20)
QT = QY - 62                                               # … and of the turned one (same top)
QP = 148                                                   # pitch of the double quotes
GLYPHS['quoteright'] = dict(strokes=[flick(0, QY, QS)], L=30, R=30)
GLYPHS['quoteleft'] = dict(strokes=[flick(0, QT, QS, turned=True)], L=30, R=30)
GLYPHS['quotedblright'] = dict(strokes=[flick(0, QY, QS), flick(QP, QY, QS)], L=30, R=30)
GLYPHS['quotedblleft'] = dict(strokes=[flick(0, QT, QS, turned=True), flick(QP, QT, QS, turned=True)], L=30, R=30)

def tick(x=0):
    """Straight quote: set down wide at the top, drawn down and lifted to a point."""
    return S(P([(x + 4, ASC - 20), (x + 2, ASC - 90), (x - 3, ASC - 196)]), tin=14, tout=160, k=0.8, b0=0.75, b1=0.04, rough=0.6, grow=0.2)
GLYPHS['quotesingle'] = dict(strokes=[tick()], L=30, R=30)
GLYPHS['quotedbl'] = dict(strokes=[tick(), tick(124)], L=30, R=30)

# ── dashes: short written strokes travelling right, a slight wave, tapered at both ends ─────────────
def dash(pts, k=0.78, tin=34, tout=50):
    return S(P(pts), tin=tin, tout=tout, k=k, b0=0.22, b1=0.05)
GLYPHS['hyphen'] = dict(strokes=[dash([(0, 201), (62, 208), (128, 205), (190, 211)])], L=36, R=36)
GLYPHS['endash'] = dict(strokes=[dash([(0, 200), (120, 208), (270, 204), (420, 210)])], L=36, R=36)
GLYPHS['emdash'] = dict(strokes=[dash([(0, 199), (170, 208), (390, 203), (610, 207), (760, 212)], tout=60)], L=36, R=36)
GLYPHS['underscore'] = dict(strokes=[dash([(0, -112), (150, -106), (340, -111), (500, -105)], tout=56)], L=10, R=10)

# ── parentheses and brackets ───────────────────────────────────────────────────────────────────────
PB = DESC + 60                                             # their lowest ink
PAREN = [(138, ASC), (72, 600), (34, 440), (24, 275), (34, 110), (72, -50), (138, PB)]
GLYPHS['parenleft'] = dict(strokes=[
    S(P(PAREN), tin=100, tout=520, k=0.92, b0=0.1, b1=0.05)], L=50, R=42)
GLYPHS['parenright'] = dict(strokes=[
    S(P([(138 - x, y) for x, y in PAREN]), tin=520, tout=100, k=0.92, b0=0.05, b1=0.1)], L=60, R=50)
b = 30                                                     # bracket stem
BSTEM = dict(tin=24, tout=30, k=0.84, b0=0.6, b1=0.45)
ARM = dict(k=0.74, b0=0.3, b1=0.08, tin=30, tout=70)      # arms: short flicks to the right, out of the stem
AT, AB = ASC - HW * 0.74, PB + HW * 0.74                   # their centrelines (outer edges on the stem's ends)
GLYPHS['bracketleft'] = dict(strokes=[
    S(P([(b - 5, ASC - 1), (b + 1, ASC - 70), (b + 2, 270), (b, PB)]), **BSTEM),
    S([(b, AT - 2), (b + 66, AT - 1), (b + 136, AT + 4)], **ARM),
    S([(b, AB - 1), (b + 66, AB + 1), (b + 136, AB + 7)], **ARM)],
    L=55, R=58)
c = 136                                                    # … and the right one's: arms written into the stem
ARMR = dict(k=0.74, b0=0.08, b1=0.3, tin=70, tout=30)
GLYPHS['bracketright'] = dict(strokes=[
    S([(c - 136, AT - 4), (c - 66, AT - 1), (c, AT)], **ARMR),
    S(P([(c - 5, ASC - 1), (c + 1, ASC - 70), (c + 2, 270), (c, PB)]), **BSTEM),
    S([(c - 136, AB - 2), (c - 66, AB), (c, AB)], **ARMR)],
    L=58, R=55)

# ── slashes ────────────────────────────────────────────────────────────────────────────────────────
GLYPHS['slash'] = dict(strokes=[
    S(P([(250, ASC), (132, 300), (0, DESC + 70)]), tin=50, tout=160, k=1.0, b0=0.3, b1=0.05)], L=35, R=40)
GLYPHS['backslash'] = dict(strokes=[
    S(P([(0, ASC), (118, 300), (250, DESC + 70)]), tin=50, tout=160, k=0.73, b0=0.3, b1=0.05)], L=40, R=35,
    upright=True)                                          # the slant would stand it up into a bar: it keeps its own lean

# ── asterisk, numbersign ───────────────────────────────────────────────────────────────────────────
AY = 580                                                   # centre of the asterisk (it stands on the x-line)
def ray(pts, k): return S(P(pts, 0, AY), tin=44, tout=64, k=k, b0=0.12, b1=0.05, grow=0.35)
GLYPHS['asterisk'] = dict(strokes=[                        # three quick strokes through one point; pressure evens out the nib
    ray([(4, 122), (0, 6), (-3, -116)], 0.5),              # the upright
    ray([(-106, -66), (2, -3), (102, 62)], 1.0),           # rising to the right (the brush's thin direction)
    ray([(-100, 62), (-2, 3), (106, -58)], 0.46)],         # falling to the right (its full direction)
    L=35, R=35, Lref='all', Rref='all')
HASH = dict(tin=40, tout=64, b0=0.15, b1=0.05)
GLYPHS['numbersign'] = dict(strokes=[
    S(P([(136, 560), (90, 280), (40, -10)]), k=0.9, **HASH),
    S(P([(316, 560), (270, 280), (220, -10)]), k=0.9, **HASH),
    S(P([(10, 368), (134, 378), (262, 374), (380, 384)]), k=0.8, **HASH),
    S(P([(-22, 176), (102, 186), (230, 182), (348, 192)]), k=0.8, **HASH)],
    L=35, R=35)

# ── ampersand: the written et — the e's own gesture (bar first, round the eye), but the eye stroke
#    crosses its bar and runs out as the t's leg; the bowl's exit tail is the t's bar ─────────────────
GLYPHS['ampersand'] = dict(strokes=[
    S([(128, 352), (70, 312), (40, 236), (52, 120), (158, BOT), (280, 42), (364, 112), (432, 196), (484, 266)],
      tin=70, tout=110, k=0.97, b0=0.1),
    S([(70, 318), (160, 370), (250, 412), (316, 460), (336, 530), (300, 594), (240, FIG - HW), (180, 590), (148, 526),
       (168, 450), (252, 300), (344, 134), (414, 14, PIN)], tin=40, tout=80, k=0.93, b0=0.3, b1=0.1)],
    L=40, R=30)

# ── at: the a of the wordmark; its exit tail does not stop but travels once round the letter ────────
from glyphs_core import GLYPHS as CORE
xs = 40 + PA                                               # the a's stem (as in glyphs_core)
RK = 0.72                                                  # the ring is lighter than the letter it encloses
RT, RB = 600 - HW * RK, -150 + HW * RK                     # centrelines of its top and bottom
GLYPHS['at'] = dict(strokes=[dict(st) for st in CORE['a']['strokes']] + [
    S(tail(xs)[1:] + [(xs + 144, 96), (xs + 166, 152), (xs + 178, 218)]
      + oval(184, 296, 8, 303, 21, cy=(RT + RB) / 2, ry=(RT - RB) / 2), tin=50, tout=130, k=RK, b0=0.1, b1=0.04)],
    L=30, R=30)
