"""Aphesis Script — the brush.

Every glyph in the family is written with one tool: a broad brush measured from the hand-drawn φ.
A stroke is a centerline (centripetal Catmull-Rom through hand-placed control points) plus a width
profile: nib angle 38°, thick/thin ≈ 2.8, tapered ends, and slightly unsure, hand-moved edges.
Nothing in the font is a geometric solid: dots are short pressed touches of the same brush.

This module owns the metric lines, the brush model, the weight-aware skeleton and the alternates.
Glyph modules only supply control points (see SPEC.md)."""
import math, random
import numpy as np

# ── metric lines: OUTER ink edges, identical in every master ──────────────────────────────────────
UPM = 1000
XH = 464            # flat x-height (the φ's loop, 480 units tall, is the round x-height band)
OV = 8              # overshoot of round shapes: bowls/arches reach XH+OV and −OV
ASC = 730           # top of ascender stems
DESC = -240         # bottom of descender stems (the φ's own stem ends at −244)
FIG = 640           # top of ascending oldstyle figures (6 8)
MARK = 610          # centre line of dots and accents
PIN = 'pin'         # third element of a control point: "do not move with weight" (feet, tips)

# ── the brush ─────────────────────────────────────────────────────────────────────────────────────
NIB = math.radians(38)      # the stroke is thinnest travelling along 38°, thickest across it
THIN = 0.35                 # wmin / wmax  (the φ's thick/thin ratio ≈ 2.8)
SIGMA = 2.7                 # edge drift in units: the hand is equally unsure at every weight
MASTER_WEIGHTS = (300, 400, 800)

def wmax(wght):
    """Full brush width for a weight; 400 is the φ's own stroke."""
    return float(np.interp(wght, [300, 400, 800], [50, 80, 128]))

def nib_width(ang, wm):
    """Stroke width when the brush travels in direction `ang` (radians)."""
    return wm * (THIN + (1 - THIN) * np.abs(np.sin(ang - NIB)) ** 1.25)

def WH(wght): return float(nib_width(0.0, wmax(wght)))            # width of a horizontal stroke
def WV(wght): return float(nib_width(math.pi / 2, wmax(wght)))    # width of a vertical stem

# ── weight-aware skeleton ─────────────────────────────────────────────────────────────────────────
# Control points are drawn for wght 400. For other weights the skeleton is adjusted so the OUTER
# edges stay on the metric lines (a bolder brush eats into the letter, it does not make it taller)
# and the letters widen a little so counters do not clog.
def hx(wght):
    """Horizontal expansion of the skeleton with weight."""
    return float(np.interp(wght, [300, 400, 800], [0.975, 1.0, 1.065]))

def vremap(y, wght):
    """Move skeleton heights so curve extremes keep their outer edge: points at/below the round
    baseline move up by the growth of the half-width, points at/above the round x-line move down,
    linear in between. Points flagged PIN are exempt (stem feet, ascender/descender tips)."""
    d = (WH(wght) - WH(400)) / 2
    yb, yt = -OV + WH(400) / 2, XH + OV - WH(400) / 2
    t = np.clip((np.asarray(y, float) - yb) / (yt - yb), 0, 1)
    return y + d * (1 - 2 * t)

def S(pts, tin=34, tout=60, k=1.0, b0=0.18, b1=0.04, dot=False, rough=1.0, grow=0.0, sit=False, hang=False):
    """One brush stroke.
    pts   control points (x, y) or (x, y, PIN), drawn for wght 400, in the order the hand moves
    tin   length in units over which the stroke swells from its start; tout: over which it thins out
    b0,b1 width fraction at the very start / very end (0.18 = blunt entry, 0.04 = lifted point)
    k     brush pressure (1 = full brush; marks and hairlines use less)
    dot   True for i/j dots, so dotless forms can drop them
    rough multiplier for the edge drift
    grow  marks that must swell with the brush (dots, accents): the stroke is scaled about its own
          centre by (brush width / 80) ** grow; 0 for everything that sits on the metric lines
    sit   True for a growing mark that stands on a line (the period): its lowest ink stays where it
          is at wght 400 instead of sinking as the mark swells
    hang  the same for a growing mark that hangs from a line (the dot of ¡ ¿ under the x-line): its
          highest ink stays where it is at wght 400"""
    return dict(pts=[tuple(p) for p in pts], tin=tin, tout=tout, k=k, b0=b0, b1=b1, dot=dot, rough=rough, grow=grow, sit=sit, hang=hang)

def touch(x, y, k=1.0, size=1.0, ang=-58, sit=False, hang=False):
    """A pressed touch of the brush (dots, periods): the nib is set down and dragged a short way
    across its own edge, then lifted. (x, y) is the centre of the mark at wght 400."""
    a = math.radians(ang); L = 46 * size
    dx, dy = math.cos(a) * L / 2, math.sin(a) * L / 2
    bend = 5 * size
    return S([(x - dx, y - dy, PIN), (x + bend * math.sin(a) * -1, y + bend * math.cos(a), PIN), (x + dx, y + dy, PIN)],
             tin=20 * size, tout=24 * size, k=k, b0=0.34, b1=0.16, rough=0.8, grow=0.75, sit=sit, hang=hang)

# ── centerline ────────────────────────────────────────────────────────────────────────────────────
SPAN = 26
def catmull(pts, n=SPAN):
    """Centripetal Catmull-Rom through the control points, n samples per span (+ the last point)."""
    P = [np.array(p[:2], float) for p in pts]
    P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        t0 = 0.0
        t1 = t0 + np.linalg.norm(p1 - p0) ** .5 + 1e-6
        t2 = t1 + np.linalg.norm(p2 - p1) ** .5 + 1e-6
        t3 = t2 + np.linalg.norm(p3 - p2) ** .5 + 1e-6
        t = np.linspace(t1, t2, n, endpoint=False)[:, None]
        a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
        a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
        a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
        b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
        b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
        out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    out.append(P[-2][None, :])
    return np.vstack(out)

def _curv(c):
    d1 = np.gradient(c, axis=0); d2 = np.gradient(d1, axis=0)
    return (d1[:, 0] * d2[:, 1] - d1[:, 1] * d2[:, 0]) / (np.linalg.norm(d1, axis=1) ** 3 + 1e-9)

def _smooth(a, sig):
    r = max(1, int(3 * sig)); x = np.arange(-r, r + 1); g = np.exp(-x * x / (2 * sig * sig)); g /= g.sum()
    return np.convolve(np.pad(a, r, mode='edge'), g, mode='valid')

def _noise(rng, L, sig):
    """Hand-moved nodes along one edge (40–110 units apart), linear in between."""
    xs = [0.0]
    while xs[-1] < L: xs.append(xs[-1] + rng.uniform(40, 110))
    ys = [rng.gauss(0, sig) for _ in xs]
    return lambda s: np.interp(s, xs, ys)

# ── alternates: the same letter written again ─────────────────────────────────────────────────────
def vary(strokes, v, seed):
    """Variant v (0 = the reference drawing; 1, 2 = the letter written again). A slow deformation
    of the whole glyph (so joins stay joined; a little wider or narrower, leaning a little more or
    less, never shifted as a whole), some play in the free stroke ends, and a slightly different
    pressure. Feet stay on the baseline: PIN points only drift sideways."""
    if v == 0: return strokes
    rng = random.Random(seed * 31 + v * 7919)
    ph = [rng.uniform(0, 2 * math.pi) for _ in range(4)]
    amp = [rng.uniform(4.0, 7.5) for _ in range(4)]
    lam = [rng.uniform(380, 800) for _ in range(4)]
    lean = rng.uniform(-0.018, 0.018); wide = rng.uniform(-0.022, 0.022)
    allp = [p for st in strokes for p in st['pts']]
    xc = sum(p[0] for p in allp) / len(allp)
    def raw(x, y):
        dx = amp[0] * math.sin(y / lam[0] * 6.283 + ph[0]) + amp[1] * math.sin(x / lam[1] * 6.283 + ph[1]) + lean * (y - XH / 2) + wide * (x - xc)
        dy = amp[2] * math.sin(x / lam[2] * 6.283 + ph[2]) + 0.5 * amp[3] * math.sin(y / lam[3] * 6.283 + ph[3])
        return dx, 0.6 * dy
    mx = sum(raw(p[0], p[1])[0] for p in allp) / len(allp)     # the letter is written again in the same place:
    def field(x, y):                                           # no net sideways shift, so the rhythm is untouched
        dx, dy = raw(x, y); return dx - mx, dy
    out = []
    for st in strokes:
        pts = []
        for p in st['pts']:
            dx, dy = field(p[0], p[1])
            pts.append((p[0] + dx, p[1], PIN) if len(p) > 2 else (p[0] + dx, p[1] + dy))
        for end, nb in ((0, 1), (-1, -2)):                     # free ends run a little long or short
            if len(pts[end]) == 2 and len(pts) > 2:
                ex, ey = pts[end]; nx, ny = pts[nb][:2]; d = math.hypot(ex - nx, ey - ny) + 1e-9
                j = rng.uniform(-10, 10)
                pts[end] = (ex + (ex - nx) / d * j, ey + (ey - ny) / d * j)
        out.append(dict(st, pts=pts, k=st['k'] * (1 + rng.uniform(-0.045, 0.045))))
    return out

# ── stroke → outline ──────────────────────────────────────────────────────────────────────────────
def _plan(st, seed):
    """Everything about a stroke that must be IDENTICAL in every master: how many points, where
    along the spline they sit, and the hand's drift on each edge. Computed on the 400 drawing."""
    d = catmull(st['pts'])
    seg = np.linalg.norm(np.diff(d, axis=0), axis=1)
    L = float(seg.sum())
    k = np.abs(_smooth(_curv(d), 2.0))
    dens = 1 + np.minimum(k * 90, 7.0)                         # more points where the stroke turns
    w = np.r_[0, np.cumsum(seg * (dens[:-1] + dens[1:]) / 2)]
    n = int(np.clip(round(w[-1] / 17), 9, 96))
    fi = np.interp(np.linspace(0, w[-1], n), w, np.arange(len(d)))   # fractional index into the dense curve
    rng_l, rng_r = random.Random(seed * 2 + 1), random.Random(seed * 2 + 2)
    s = np.interp(fi, np.arange(len(d)), np.r_[0, np.cumsum(seg)])
    nl, nr = _noise(rng_l, L, SIGMA)(s), _noise(rng_r, L, SIGMA)(s)
    return fi, nl * st['rough'], nr * st['rough']

def stroke_outline(st, wght, seed, plan=None):
    """Closed polygon (N×2) of one stroke for a weight master. Upright; shear is applied later."""
    fi, nl, nr = plan or _plan(st, seed)
    H = hx(wght)
    pts = [(p[0] * H, p[1] if len(p) > 2 else float(vremap(p[1], wght))) for p in st['pts']]
    if st['grow']:
        a = np.array(pts, float); m = a.mean(axis=0)
        pts = [tuple(q) for q in m + (a - m) * (wmax(wght) / 80) ** st['grow']]
    d = catmull(pts)
    idx = np.arange(len(d))
    c = np.c_[np.interp(fi, idx, d[:, 0]), np.interp(fi, idx, d[:, 1])]
    T = np.gradient(c, axis=0); T /= np.linalg.norm(T, axis=1)[:, None] + 1e-9
    N = np.c_[-T[:, 1], T[:, 0]]
    ang = np.arctan2(T[:, 1], T[:, 0])
    wm = wmax(wght) * st['k']
    w = nib_width(ang, wm)
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))]; L = s[-1]
    ts = (wm / 80) ** 0.5                                       # heavier brush, slightly longer tapers
    tap = np.ones_like(s)
    if st['tin'] > 0:
        tap = np.minimum(tap, st['b0'] + (1 - st['b0']) * np.sin(np.clip(s / (st['tin'] * ts), 0, 1) * np.pi / 2))
    if st['tout'] > 0:
        tap = np.minimum(tap, st['b1'] + (1 - st['b1']) * np.sin(np.clip((L - s) / (st['tout'] * ts), 0, 1) * np.pi / 2))
    w = w * tap
    hl, hr = w / 2 + nl * tap, w / 2 + nr * tap
    hl, hr = np.maximum(hl, 1.5), np.maximum(hr, 1.5)             # a lifted point is still three units of ink: no edge collapses onto the other
    # Where the brush turns back on itself (a hook, a tight bowl) the offset edge folds, and a
    # folded outline punches a hole. A real brush leaves none: ink fills the inner corner. Edge
    # points that lie inside another part of the same stroke are therefore not outline; they are
    # laid on the chord between their valid neighbours. The point count never changes, so masters
    # stay compatible.
    hm = np.minimum(hl, hr); tau = 0.22 * wm
    kap = _smooth(_curv(c), 1.5)
    tight = np.abs(kap) * hm > 0.55                                # the turn is about as tight as the brush is wide
    fix = lambda E, inner: _relax(_close(_trim(_unreverse(_unfold(E), c), c, s, hm), tau), tight & inner)
    P = _spread(np.vstack([fix(c + N * hl[:, None], kap > 0), fix(c - N * hr[:, None], kap < 0)[::-1]]))
    return np.roll(P, -(len(c) // 2), axis=0)                    # the outline starts mid-stroke, not at the hairline tip: an unambiguous start point in every master

def _spread(P, step=1.6, crowd=1.0):
    """On the inside of a tight turn the outline points crowd together, closer than the font's
    unit grid, and would round onto one spot. Where neighbours are less than `crowd` units apart, the
    points around them are laid out evenly along the same path until they are `step` units apart. Same
    points, same count, same shape; the first and last point of the outline never move."""
    n = len(P); seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    if n < 4 or seg.min() >= crowd: return P
    P = P.copy(); i = 0
    while i < n - 1:
        if seg[i] >= crowd: i += 1; continue
        a, b = i, i + 1
        while seg[a:b].sum() / (b - a) < step and (a > 0 or b < n - 1):
            a, b = max(a - 1, 0), min(b + 1, n - 1)
        cum = np.r_[0, np.cumsum(seg[a:b])]; t = np.linspace(0, cum[-1], b - a + 1)
        P[a:b + 1] = np.c_[np.interp(t, cum, P[a:b + 1, 0]), np.interp(t, cum, P[a:b + 1, 1])]
        seg[a:b] = cum[-1] / (b - a); i = b
    return P

def _relax(E, mask, reach=3, rounds=5):
    """Inside a tight turn the repaired inner edge is left with a knuckle; ink would have pooled
    there into a smooth fillet. The points of the turn (and a few either side) are relaxed."""
    if not mask.any(): return E
    m = np.convolve(mask.astype(float), np.ones(2 * reach + 1), mode='same') > 0
    m[0] = m[-1] = False
    E = E.copy()
    for _ in range(rounds):
        E[1:-1] = np.where(m[1:-1, None], (E[:-2] + 2 * E[1:-1] + E[2:]) / 4, E[1:-1])
    return E

def _unreverse(E, c):
    """Where the turn is tighter than the brush is wide, the inner edge runs backwards for a few
    points before it would cross itself. Those points are laid on the chord across the turn."""
    back = np.einsum('ij,ij->i', np.diff(E, axis=0), np.diff(c, axis=0)) < 0          # segment i goes against the stroke
    if not back.any(): return E
    E = E.copy(); n = len(E); i = 0
    while i < n - 1:
        if not back[i]: i += 1; continue
        j = i
        while j + 1 < n - 1 and back[j + 1]: j += 1
        a, z = max(i - 1, 0), min(j + 2, n - 1)                                        # chord from the point before to the point after
        if z - a > 1: E[a + 1:z] = E[a] + (np.arange(1, z - a) / (z - a))[:, None] * (E[z] - E[a])
        i = j + 1
    return E

def _close(E, tau, span=44):
    """Close pockets: where the edge comes back to within `tau` of itself after a long detour,
    the detour is a pocket ink would have filled."""
    E = E.copy(); n = len(E)
    a = np.r_[0, np.cumsum(np.linalg.norm(np.diff(E, axis=0), axis=1))]
    i = 0
    while i < n - 2:
        j1 = min(n - 1, i + span)
        d = np.linalg.norm(E[i + 2:j1 + 1] - E[i], axis=1)
        ok = (d < tau) & (a[i + 2:j1 + 1] - a[i] > 2.5 * d + 1.2 * tau)
        if ok.any():
            j = i + 2 + int(np.nonzero(ok)[0][-1])
            E[i + 1:j] = E[i] + (np.arange(1, j - i) / (j - i))[:, None] * (E[j] - E[i]); i = j
        else: i += 1
    return E

def _trim(E, c, s, hm):
    d = np.linalg.norm(E[:, None, :] - c[None, :, :], axis=2)
    ds = np.abs(s[:, None] - s[None, :])
    bad = ((ds >= 1.6 * hm[None, :]) & (ds <= 320) & (d < 0.85 * hm[None, :])).any(axis=1)
    if not bad.any(): return E
    E = E.copy(); n = len(E); i = 0
    while i < n:
        if not bad[i]: i += 1; continue
        j = i
        while j + 1 < n and bad[j + 1]: j += 1
        A = E[i - 1] if i > 0 else None
        Z = E[j + 1] if j + 1 < n else None
        if A is None and Z is None: break
        if A is None: E[i:j + 1] = Z
        elif Z is None: E[i:j + 1] = A
        else: E[i:j + 1] = A + (np.arange(1, j - i + 2) / (j - i + 2))[:, None] * (Z - A)
        i = j + 1
    return E

def _unfold(E, span=40):
    """Remove fold-back loops: where the edge crosses itself within a short span, the points of the
    loop collapse onto the crossing."""
    E = E.copy(); n = len(E); i = 0
    while i < n - 3:
        j1 = min(n - 2, i + span)
        p, r = E[i], E[i + 1] - E[i]
        q, s2 = E[i + 2:j1 + 1], E[i + 3:j1 + 2] - E[i + 2:j1 + 1]
        den = r[0] * s2[:, 1] - r[1] * s2[:, 0]
        qp = q - p
        with np.errstate(divide='ignore', invalid='ignore'):
            t = (qp[:, 0] * s2[:, 1] - qp[:, 1] * s2[:, 0]) / den
            u = (qp[:, 0] * r[1] - qp[:, 1] * r[0]) / den
        ok = (np.abs(den) > 1e-12) & (t >= 0) & (t <= 1) & (u >= 0) & (u <= 1)
        if ok.any():
            m = int(np.nonzero(ok)[0][-1]); j = i + 2 + m                  # the widest fold starting here
            X = p + t[m] * r
            # lay the loop's points along E[i] → X → E[j+1] rather than piling them on X
            k = j - i; la, lb = np.linalg.norm(X - E[i]), np.linalg.norm(E[j + 1] - X)
            ka = int(np.clip(round(k * la / (la + lb + 1e-9)), 1, k))
            E[i + 1:i + ka + 1] = E[i] + (np.arange(1, ka + 1) / ka)[:, None] * (X - E[i])
            if k > ka: E[i + ka + 1:j + 1] = X + (np.arange(1, k - ka + 1) / (k - ka + 1))[:, None] * (E[j + 1] - X)
            i = j
        else: i += 1
    return E

def shear(P, slnt, lean=1.0, about=MARK):
    """OpenType slnt: negative leans right. The pivot is mid x-height, so a slanted glyph stays
    centred on its upright position and keeps its advance (the italic-angle offset is built in).
    lean < 1 is for a mark that leans less than the letters (the Greek accents: a fully sheared
    varia stands almost upright and reads as a dot): it goes as a whole to where the slant carries
    the height `about`, and leans about that height by only this share of the slant."""
    P = np.array(P, float); t = math.tan(math.radians(-slnt))
    if lean == 1.0: P[:, 0] += (P[:, 1] - XH / 2) * t
    else: P[:, 0] += (about - XH / 2) * t + (P[:, 1] - about) * t * lean
    return P

def clockwise(P):
    A = 0.5 * np.sum(P[:, 0] * np.roll(P[:, 1], -1) - np.roll(P[:, 0], -1) * P[:, 1])
    return P[::-1] if A > 0 else P

def rng32(seed):
    """The xorshift generator of the site's icon set (same numbers as the JS reference)."""
    s = (seed & 0xFFFFFFFF) or 1
    def r():
        nonlocal s
        s ^= (s << 13) & 0xFFFFFFFF; s ^= s >> 17; s ^= (s << 5) & 0xFFFFFFFF
        return s / 4294967296
    return r

def stipple(test, seed, count, box, size=16, sep=0.0):
    """Icon-style fill: small squares scattered deterministically inside a region, like the site's
    stippled fog. test(x, y, side) → bool says where; box = (x0, y0, x1, y1) is where points are
    thrown; sep > 0 keeps the squares that many sides apart (centre to centre).
    Returns [(x, y, side)] for a glyph's 'squares' entry."""
    r = rng32(seed); x0, y0, x1, y1 = box; out = []
    for _ in range(count):
        x, y = x0 + r() * (x1 - x0), y0 + r() * (y1 - y0); side = size * (0.7 + r() * 0.6)
        if any(max(abs(x - a), abs(y - b)) < sep * (side + c) / 2 for a, b, c in out): continue
        if test(x, y, side): out.append((round(x, 1), round(y, 1), round(side, 1)))
    return out

def square_outline(sq, wght, slnt):
    """One stipple square for a master: it moves with the skeleton and the slant, swells a little
    with the weight, and always stays an upright square (never added, never removed)."""
    x, y, side = sq
    c = shear(np.array([[x * hx(wght), y]], float), slnt)[0]; h = side * (wmax(wght) / 80) ** 0.5 / 2
    return np.array([[c[0] - h, c[1] - h], [c[0] - h, c[1] + h], [c[0] + h, c[1] + h], [c[0] + h, c[1] - h]])

def glyph_seed(name):
    h = 0
    for ch in name: h = (h * 131 + ord(ch)) % 1000003
    return h

_PLANS = {}
def glyph_outlines(name, spec, wght=400, slnt=0, v=0, dots=True):
    """The outline points of every stroke of a glyph for one master (clockwise, N×2 each), in the
    glyph's drawing frame (x not yet shifted by the left sidebearing). In the font these points are
    quadratic control points with no on-curve points between them (see smooth_poly)."""
    seed = glyph_seed(name) + 977 * v
    strokes = vary(spec['strokes'], v, glyph_seed(name))
    out = []
    for j, st in enumerate(strokes):
        if st['dot'] and not dots: continue
        key = (name, v, j, repr(st['pts']), st['rough'])
        if key not in _PLANS: _PLANS[key] = _plan(st, seed + j * 13)
        P = stroke_outline(st, wght, seed + j * 13, _PLANS[key])
        if st.get('sit') and wght != 400:                           # stand where the 400 drawing stands
            P[:, 1] += stroke_outline(st, 400, seed + j * 13, _PLANS[key])[:, 1].min() - P[:, 1].min()
        if st.get('hang') and wght != 400:                          # … or hang where it hangs
            P[:, 1] += stroke_outline(st, 400, seed + j * 13, _PLANS[key])[:, 1].max() - P[:, 1].max()
        out.append(clockwise(shear(P, 0 if spec.get('upright') else slnt, spec.get('lean', 1.0))))
    return out

def glyph_squares(spec, wght=400, slnt=0):
    """The stipple squares of a glyph (if any) for one master."""
    return [square_outline(sq, wght, slnt) for sq in spec.get('squares', ())]

def smooth_poly(P, k=3):
    """How a stroke's outline is actually rendered: its points are the control points of a closed
    quadratic B-spline (TrueType's implied on-curve points), so the ink edge is smooth like the
    φ's. This flattens that curve for previews and measurements."""
    M0 = (np.roll(P, 1, axis=0) + P) / 2; M1 = (P + np.roll(P, -1, axis=0)) / 2
    t = (np.arange(k) / k)[None, :, None]
    C = (1 - t) ** 2 * M0[:, None, :] + 2 * (1 - t) * t * P[:, None, :] + t ** 2 * M1[:, None, :]
    return C.reshape(-1, 2)
