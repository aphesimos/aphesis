"""Aphesis Script — the four characters of 色即是空, written as a calm 楷書 with the letters' brush."""
from brush import *
from parts import *
from glyphs_punct import P

# The nib that writes the letters already has the contrast of regular script: 横 lighter than 竖, 撇 and 提
# drawn out thin (they travel along the nib), 捺 the full brush. So nothing is styled: one S per stroke of
# the character, in stroke order, every point pinned — the skeleton is the same at every weight, only the
# brush thickens. Pressure follows the density of the character: about 0.8 on 横, 0.85 on 竖 and 捺, less on
# the bars inside the 日 of 是 (the Black must stay open), more on 空 (0.95–1.0), which has the least ink;
# 撇 are written at full pressure because the nib itself thins them.
# The face is about 760 × 780: ink from −85 to 695, optical centre near y = 300. Flat feet (空, 色) stand a
# little higher than pointed ones; the needle of 即 reaches a little lower.

GLYPHS = {}
CJK = dict(upright=True, Lref='all', Rref='all')

# ── the gestures the four characters share ─────────────────────────────────────────────────────────
def heng(x0, y0, x1, y1, bow=0, press='lr'):
    """横: written to the right and a little upward. A free end is set down with a short press ('l')
    or lifted with a slight press ('r'); an end that lies inside another stroke is simply drawn into it."""
    a = [(x0 - 2, y0 + 3), (x0 + 13, y0)] if 'l' in press else [(x0, y0)]
    b = [(x1 - 13, y1), (x1 + 2, y1 - 3)] if 'r' in press else [(x1, y1)]
    return P(a + [((x0 + x1) / 2, (y0 + y1) / 2 + bow)] + b)
HENG = dict(tin=20, tout=22, b0=0.45, b1=0.5)

def shu(x, top, bot, lean=0):
    """竖: the head of the letters' stems, drawn straight down."""
    return P(head(x, top) + [(x + lean, bot)])
SHU = dict(tin=24, tout=STEM['tout'], b0=0.55, b1=STEM['b1'])                 # … lifted bluntly, like a stem on the baseline
NEEDLE = dict(tin=24, tout=DESCENDER['tout'], b0=0.55, b1=DESCENDER['b1'])    # … or drawn out to a point, like a descender

def zhe(x, y):
    """折: the shoulder of a 横折 at the corner (x, y) — the brush turns down across its full width."""
    return [(x - 24, y), (x - 2, y - 8), (x + 2, y - 36)]
ZHE = dict(tin=20, tout=30, b0=0.45, b1=0.42)                                  # begun inside the left wall, lifted bluntly like a 竖
PIE = dict(tin=24, b0=0.45, b1=0.04)                                           # 撇: pressed head, drawn out thin
# 钩 and 提 leave a true corner: the corner point is written twice, and the stroke thins from before the
# corner to a point (a tight round turn would pass through the nib's hairline and pinch).

# ── 色 ── ⺈ over 巴: 撇, 横撇 · 横折, 竖, 横, 竖弯钩 ────────────────────────────────────────────────
GLYPHS['uni8272'] = dict(strokes=[
    S(P([(360, 696), (334, 640), (290, 580), (240, 534), (196, 506)]), k=1.0, tout=110, **PIE),
    S(P([(320, 622), (388, 631), (440, 638), (462, 638), (472, 628), (472, 628), (456, 572), (414, 506), (358, 446), (308, 400)]),
      k=0.92, tin=22, tout=160, b0=0.3, b1=0.04),                              # begun inside the 撇; its own 撇 lands on the box, left of the inner 竖
    S(P([(158, 392), (350, 402)] + zhe(548, 414) + [(539, 220)]), k=0.8, **ZHE),
    S(shu(358, 414, 226), k=0.85, **SHU),                                      # the 竖 inside the box, from the top 横 to the bottom one
    S(heng(158, 214, 541, 230, press=''), k=0.8, **HENG),
    S(P(head(154, 432) + [(154, 250), (154, 126), (168, 42), (212, -16), (296, -44), (456, -52), (606, -48),
                          (712, -38), (712, -38), (710, 20), (707, 76)]), k=0.86, tin=24, tout=120, b0=0.55, b1=0.04),
], L=61, R=46, **CJK)
GLYPHS['uni8272']['strokes'] = [dict(st, pts=[(433 + (p[0] - 433) * 1.04,) + tuple(p[1:]) for p in st['pts']])
                                for st in GLYPHS['uni8272']['strokes']]     # … written 4 % wider: it was the narrow one of the four

# ── 即 ── 横折, 横, 横, 竖提, 点 · 卩: 横折钩, 竖 ─────────────────────────────────────────────────
GLYPHS['uni5373'] = dict(strokes=[
    S(P([(84, 656), (186, 664)] + zhe(292, 670) + [(288, 318)]), k=0.8, **ZHE),
    S(heng(84, 498, 291, 508, press=''), k=0.8, **HENG),
    S(heng(84, 324, 289, 334, press=''), k=0.8, **HENG),
    S(P(head(84, 694) + [(84, 330), (84, 100), (82, 46), (86, 26), (96, 20), (96, 20), (134, 48), (200, 102)]),
      k=0.85, tin=24, tout=110, b0=0.55, b1=0.04),                             # the left wall, pressed at the foot and flicked up along the nib
    dict(touch(268, 194, k=0.8, size=1.9, ang=124), grow=0.3),                 # 点: the letters' dot, its pressed end at the lower right (it swells less: no wider than a stroke)
    S(P([(450, 606), (566, 616)] + zhe(694, 624) + [(692, 430), (688, 304), (688, 304), (614, 352)]),
      k=0.8, tin=20, tout=170, b0=0.45, b1=0.04),
    S(P(head(450, 650) + [(450, 100), (450, -98)]), k=0.86, **NEEDLE),        # 悬针: the longest stroke, drawn out like the letters' descenders
], L=70, R=57, **CJK)

# ── 是 ── 日: 竖, 横折, 横, 横 · 横 · 竖, 横, 撇, 捺 ──────────────────────────────────────────────
# The pitch of the 日 (107 · 109) and of the long 横 under it (111) is laid out for the Black.
GLYPHS['uni662F'] = dict(strokes=[
    S(shu(232, 692, 422, 5), k=0.82, **SHU),
    S(P([(234, 658), (380, 668)] + zhe(530, 676) + [(522, 430)]), k=0.8, **ZHE),
    S(heng(236, 555, 527, 567, press=''), k=0.78, **HENG),
    S(heng(237, 446, 524, 458, press=''), k=0.78, **HENG),
    S(heng(30, 314, 734, 356, bow=6), k=0.82, **HENG),
    S(shu(386, 351, 76), k=0.85, **SHU),
    S(heng(386, 196, 578, 214, press='r'), k=0.8, **HENG),
    S(P([(262, 246), (236, 200), (190, 135), (124, 58), (40, -34)]), k=1.0, tout=200, **PIE),
    S(P([(168, 114), (262, 100), (392, 58), (524, -6), (636, -52), (708, -60), (756, -50)]),
      k=0.85, tin=120, tout=130, b0=0.12, b1=0.04),                            # 捺: out of the 撇's middle, under the foot of the 竖, thinned along its own foot
], L=44, R=43, **CJK)

# ── 空 ── 穴: 点, 点, 横钩, 撇, 点 · 工: 横, 竖, 横 ───────────────────────────────────────────────
GLYPHS['uni7A7A'] = dict(strokes=[
    dict(touch(386, 656, k=0.78, size=1.9, ang=120, sit=True), grow=0.3),      # stands on its lowest ink, so the white over the cover holds; it swells
                                                                               # less than the letters' dots (grow 0.3): its top stays with the other three
    S(P([(64, 548), (62, 510), (48, 444)]), k=1.0, tin=22, tout=60, b0=0.5, b1=0.1),
    S(P([(58, 512), (340, 533), (600, 543), (660, 547), (696, 550), (710, 542), (710, 542), (698, 506), (660, 452)]),
      k=0.95, tin=20, tout=100, b0=0.45, b1=0.04),
    S(P([(326, 446), (308, 398), (270, 332), (216, 274)]), k=1.0, tout=100, **PIE),
    S(P([(440, 448), (482, 392), (538, 346), (596, 318)]), k=0.8, tin=90, tout=26, b0=0.12, b1=0.5),    # 长点: thin in, pressed at the foot
    S(heng(240, 210, 528, 228), k=0.96, **HENG),
    S(shu(384, 232, -28), k=1.0, **SHU),
    S(heng(40, -48, 728, -16, bow=6), k=0.98, **HENG),
], L=47, R=47, **CJK)
