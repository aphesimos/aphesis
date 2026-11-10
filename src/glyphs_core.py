"""Aphesis Script — control letters, drawn by the lead. They define the hand: n (straight control),
o (round control), and the letters of the wordmark."""
from brush import *
from parts import *

GLYPHS = {}
x = 40                                                     # centre of the first stem
GLYPHS['n'] = dict(strokes=[
    S(entry(x) + [(x, 200)] + foot(x), **STEM),
    S(arch(x, x + U) + tail(x + U), **JOIN),
])
GLYPHS['i'] = dict(strokes=[
    S(entry(x) + tail(x), tin=62, tout=70),
    dict(touch(x + 4, MARK), dot=True),
])
GLYPHS['h'] = dict(strokes=[
    S(flag(x) + [(x, 300)] + foot(x), **STEM),
    S(arch(x, x + U) + tail(x + U), **JOIN),
])
cx = 40 + PO / 2                                           # one turn of the brush, begun and closed at the thin point
GLYPHS['o'] = dict(strokes=[
    S(oval(cx, PO / 2, 126, 126 + 408, 18), tin=40, tout=44, b0=0.5, b1=0.35),
])
xs = 40 + PA                                               # stem of the a
GLYPHS['a'] = dict(strokes=[
    S([(xs + 8, TOP - 10), (xs - 0.30 * PA, TOP), (xs - 0.70 * PA, TOP - 24), (xs - PA + 5, MID + 66),
       (xs - PA, MID - 34), (xs - 0.82 * PA, BOT + 40), (xs - 0.54 * PA, BOT), (xs - 0.24 * PA, BOT + 42), (xs - 2, 180)],
      tin=30, tout=56, b0=0.5),
    S(head(xs) + tail(xs), tin=24, tout=70, b0=0.55),
])
PE = 250; e0 = 40                                          # e: bar first, then round the eye and down the back
GLYPHS['e'] = dict(strokes=[
    S([(e0 + 4, 206), (e0 + 0.62 * PE, 268), (e0 + PE, 356), (e0 + 0.80 * PE, TOP), (e0 + 0.27 * PE, 410),
       (e0, 262), (e0 + 0.10 * PE, 108), (e0 + 0.53 * PE, BOT), (e0 + 0.95 * PE, 32), (e0 + 1.13 * PE, 72)],
      tin=40, tout=70, b0=0.4),
], top=172)                                                 # accents sit over the eye, a little right of the letter's middle
GLYPHS['p'] = dict(strokes=[
    S(entry(x) + [(x, 100)] + foot(x, DESC), **DESCENDER),
    S([(x + 2, 330), (x + 0.31 * PA, TOP), (x + 0.80 * PA, TOP - 34), (x + PA, MID + 58), (x + PA - 26, 140),
       (x + 0.50 * PA, BOT), (x + 10, 56)], tin=40, tout=60),
])
GLYPHS['s'] = dict(strokes=[
    S([(277, 408), (202, TOP), (98, 427), (78, 348), (173, 263), (270, 181), (264, 71), (166, BOT - 2), (60, 50)], tin=40, tout=60),
], Ladj=(-3, -3, 0))                                         # the open left side reads a little loose by area alone
