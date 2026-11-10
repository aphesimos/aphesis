"""Aphesis Script — the spacing system.

Spacing is measured, not guessed, and it is measured on the ink, not on bounding boxes.

1. PROFILES. Every glyph of a master is cut by horizontal scanlines; the leftmost and rightmost
   ink on each scanline is the side profile.
2. REFERENCE EDGE. Each side has a structural edge: the extreme of the profile in the middle of
   the x-height (15–85 %). Entry hooks and exit tails live at the x-line and the baseline, so they
   never define the edge — they count as ink that reaches into the gap. Sides whose structure IS at
   the top or bottom (r's arm, the terminals of c, e, s …) use the whole band ('full').
3. SIDE WHITE. Between the reference edge and the ink, over the x-height band, with the depth limit
   foundries use (15 % of the x-height): white deeper than that does not count (open counters).
4. SIDEBEARINGS. A side's bearing = target − its mean white. So a straight stem gets the full
   target, a round bowl sits closer by exactly the white its curve already carries. Two glyphs set
   side by side then always enclose the same optical area: the rhythm is even by construction.
   Letters reuse control letters through keys (L='n', R='o' …) so equal shapes get equal bearings.
5. KERNING is only for what bearings cannot do: shapes that could nestle (the sum of two side
   profiles leaves room at every height) are pulled together by a fraction of that room, and shapes
   that would touch are pushed apart. Class-based, per master.
The slanted masters are measured on the sheared outlines; only the φ (which stays upright) meets
the letters differently there, and it is measured as the letters see it.
"""
import math
import numpy as np
import brush as B
from registry import glyph_polys, split_name, NAMES

STEP = 4
YS = np.arange(B.DESC - 40, B.ASC + 64, STEP).astype(float)       # scanlines
BAND = (YS >= 0) & (YS <= B.XH)                                    # where rhythm is judged
MIDB = (YS >= 0.15 * B.XH) & (YS <= 0.85 * B.XH)                   # where the structure is
DEPTH = round(0.15 * B.XH)                                         # depth limit (70)

def gap_target(wght):
    """Mean white between two straight sides, per weight (set by eye on the nn/hh proofs)."""
    return float(np.interp(wght, [300, 400, 800], [176, 150, 116]))

def profiles(polys):
    """Leftmost / rightmost ink per scanline (±inf where the scanline is empty)."""
    Lo = np.full(len(YS), np.inf); Hi = np.full(len(YS), -np.inf)
    for P in polys:
        x0, y0 = P[:, 0], P[:, 1]; x1, y1 = np.roll(x0, -1), np.roll(y0, -1)
        ya, yb = np.minimum(y0, y1), np.maximum(y0, y1)
        hit = (YS[:, None] >= ya[None, :]) & (YS[:, None] < yb[None, :])
        with np.errstate(divide='ignore', invalid='ignore'):
            xs = x0[None, :] + (YS[:, None] - y0[None, :]) / (y1 - y0)[None, :] * (x1 - x0)[None, :]
        Lo = np.minimum(Lo, np.where(hit, xs, np.inf).min(axis=1))
        Hi = np.maximum(Hi, np.where(hit, xs, -np.inf).max(axis=1))
    return Lo, Hi

class Side:
    """One side of a glyph: reference edge and depth of the white behind it on every scanline."""
    def __init__(self, prof, sign, refband):
        band = BAND if refband == 'full' else MIDB
        inside = np.isfinite(prof) & (True if refband == 'all' else band)      # 'all': a mark that lives outside the x-height (the asterisk)
        if not inside.any(): inside = np.isfinite(prof) & BAND
        if not inside.any(): inside = np.isfinite(prof)
        self.ref = float(prof[inside].max() if sign > 0 else prof[inside].min())
        d = (self.ref - prof) * sign                       # >0 white behind the edge, <0 ink beyond it
        self.depth = np.where(np.isfinite(prof), d, np.inf)
        self.white = float(np.minimum(self.depth[BAND], DEPTH).mean())

_M = {}
def measure(G, name, wght, slnt=0, v=0):
    """Profiles of one drawing of a glyph (v = 0 the reference, 1 and 2 its re-writings). Letters
    are measured upright: a slanted master shears every letter alike, so the white between them is
    unchanged. Only the φ stays upright; in a slanted master it is measured as the leaning letters
    see it (sheared the other way)."""
    slnt = slnt if name == 'phi' or G.get(name, {}).get('upright') else 0
    key = (name, wght, slnt, v)
    if key not in _M:
        polys = [B.shear(P, -slnt) if slnt else P for P in glyph_polys(G, name, wght, 0, v)
                 if 0.5 * np.sum(P[:, 0] * np.roll(P[:, 1], -1) - np.roll(P[:, 0], -1) * P[:, 1]) <= 0]
        spec = G.get(name, {})
        Lo, Hi = profiles(polys)
        _M[key] = dict(L=Side(Lo, -1, spec.get('Lref', 'mid')), R=Side(Hi, +1, spec.get('Rref', 'mid')),
                       xmin=float(Lo[np.isfinite(Lo)].min()), xmax=float(Hi[np.isfinite(Hi)].max()))
    return _M[key]

# Sidebearing classes: a letter side that is the same gesture as a control letter's takes that
# letter's bearing (the foundry's "=n", "=o" metric keys). Everything not listed is measured.
KEYS = {
    'L': {  # left sides
        **dict.fromkeys('ijmprt', 'n'),                    # x-height stem with hairline entry        = n
        'dotlessi': 'n',
        **dict.fromkeys('bkl', 'h'),                       # ascender stem with flag                  = h
        **dict.fromkeys('dgq', 'a'),                       # the bowl of a                            = a
        'c': 'e', 'oe': 'o', 'ae': 'a',                    # round backs
        **dict.fromkeys('wy', 'v'),                        # thick diagonal                           = v
    },
    'R': {  # right sides
        **dict.fromkeys('hm', 'n'),                        # arch shoulder, stem, exit tail           = n
        **dict.fromkeys('adlu', 'i'),                      # straight stem, exit tail                 = i
        'dotlessi': 'i',
        'b': 'p',                                          # the bowl of p                            = p
        **dict.fromkeys('gj', 'q'),                        # stem that goes below the line, no tail   = q
        **dict.fromkeys('wy', 'v'),                        # hairline diagonal                        = v
        'oe': 'e', 'ae': 'e',
    },
}

KEY_TOL = 6         # how far a letter's own measure may move it from its control's bearing

def _adj(a, wght):
    """A trim in units; three values are per weight master (300, 400, 800)."""
    return float(np.interp(wght, B.MASTER_WEIGHTS, a)) if isinstance(a, (tuple, list)) else float(a)

def _bearing(G, name, side, wght, seen=(), slnt=0, v=0):
    """Distance from the reference edge of `side` to the edge of the glyph box.
    A side keyed to a control letter belongs to that letter's class: it takes the control's bearing,
    corrected by what its own ink measures (every drawing has its own hand-moved edge), but never
    by more than KEY_TOL units — beyond that the class wins. Composites ride on their base."""
    spec = G.get(name, {})
    key = spec.get(side, KEYS[side].get(name))             # None → measured; 'n' → the class of n's side
    adj = _adj(spec.get(side + 'adj', 0), wght)
    if isinstance(key, (int, float)): return float(key) * hand_scale(wght) + adj     # a hand-set bearing (punctuation)
    if key and key != name and key not in seen:
        ref = _bearing(G, key, side, wght, seen + (name,), slnt, v if spec.get('rides') else 0)
        if spec.get('rides'): return ref + adj
        own = gap_target(wght) / 2 - measure(G, name, wght, slnt, v)[side].white
        return float(np.clip(own, ref - KEY_TOL, ref + KEY_TOL)) + adj
    return gap_target(wght) / 2 - measure(G, name, wght, slnt, v)[side].white + adj

def hand_scale(wght):
    """Hand-set bearings are written for wght 400 and follow the rhythm of the other weights."""
    return gap_target(wght) / gap_target(400)

def metrics(G, name, wght, slnt=0):
    """(x shift to apply to the drawing, advance width) for a master. Every drawing of a letter
    (x, x.1, x.2) is fitted on its own ink, so the rhythm holds whichever one is set."""
    base, v = split_name(name)
    m = measure(G, base, wght, slnt, v)
    lsb, rsb = _bearing(G, base, 'L', wght, slnt=slnt, v=v), _bearing(G, base, 'R', wght, slnt=slnt, v=v)
    return lsb - m['L'].ref, (m['R'].ref - m['L'].ref) + lsb + rsb

def anchor(G, base, mark, wght):
    """Where a mark's centre sits on a base letter, in the base's drawing coordinates: over the
    middle of the letter's structure (its two reference edges), unless the letter says otherwise."""
    spec = G.get(base, {})
    key = 'below' if mark == 'cedilla' else 'top'
    if key in spec: return spec[key] * B.hx(wght)
    m = measure(G, base, wght)
    return (m['L'].ref + m['R'].ref) / 2

def layout(G, text, wght=400, slnt=0, calt=False, kern=None):
    """Set a line: [(glyph name, variant, x offset of the drawing)], total advance."""
    items, x, run, prev = [], 0.0, 0, None
    for ch in text:
        nm = NAMES.get(ch, ch.lower())
        if nm == 'space': x += space_width(wght); run = 0; prev = None; continue
        v = 0
        if calt and nm in G and G[nm].get('alts', len(nm) == 1 and nm.isalpha()): v = run % 3; run += 1
        else: run = 0
        if nm != 'phi' and nm not in G: print(f'[layout] no glyph {nm!r} yet, skipped'); continue
        dx, adv = metrics(G, nm, wght, slnt)
        if kern and prev is not None: x += kern.get((prev, nm), 0)
        items.append((nm, v, x + dx)); x += adv; prev = nm
    return items, x

def space_width(wght):
    """The word space follows the letter gap; the Black gets a little more, its tails reach into it."""
    return round(gap_target(wght) * float(np.interp(wght, B.MASTER_WEIGHTS, [1.45, 1.45, 1.62])))

def report(G, names, wght=400):
    print(f'wght {wght}: target gap {gap_target(wght):.0f}, depth limit {DEPTH}')
    print(f'{"glyph":>8} {"ink":>6} {"Lwhite":>7} {"Rwhite":>7} {"LSB":>6} {"RSB":>6} {"adv":>6}   (LSB/RSB from reference edge; ink = ref to ref)')
    for n in names:
        m = measure(G, n, wght); dx, adv = metrics(G, n, wght)
        print(f'{n:>8} {m["R"].ref - m["L"].ref:6.0f} {m["L"].white:7.1f} {m["R"].white:7.1f} '
              f'{_bearing(G, n, "L", wght):6.1f} {_bearing(G, n, "R", wght):6.1f} {adv:6.0f}')


# ── kerning ───────────────────────────────────────────────────────────────────────────────────────
NESTLE = (0.60, 0.46, 0.32)   # share of the nestling room that is taken back, per weight master: the same
                              # units weigh more in a tighter texture, so the Black takes less
NESTLE_MARK = 0.58            # … and against punctuation, which has its own hand-set bearings, this much of that
LOW_MARKS = ('period', 'comma', 'ellipsis')    # marks on the baseline tuck under what overhangs them:
NESTLE_LOW, DEPTH_LOW = 0.42, 140              # a fixed share, counted to twice the usual depth
NMIN = 14           # nestling room below this is left alone
CLEAR = 0.25        # nothing may come closer than this share of the straight gap
CLEAR_ENCLOSED = 0.45   # … and brackets and parentheses keep more: their ends face ascenders and descenders
ENCLOSERS = ('parenleft', 'parenright', 'bracketleft', 'bracketright')
KMIN = 10           # kerns smaller than this are not worth a pair …
PUSH_MIN = 4        # … unless they keep two shapes apart
KERN_MARKS = ('period', 'comma', 'colon', 'semicolon', 'hyphen', 'quoteright', 'quotedblright', 'quoteleft', 'quotedblleft',
              'quotesingle', 'quotedbl', 'parenleft', 'parenright', 'bracketleft', 'bracketright', 'slash', 'backslash',
              'asterisk', 'exclam', 'question')
ERODE = 6           # scanlines (×STEP units) over which nearness is judged diagonally

def _erode(a, r=ERODE):
    """Minimum over a vertical window: horizontal gaps become (roughly) true distances."""
    p = np.pad(a, r, mode='edge')
    return np.min(np.stack([p[i:i + len(a)] for i in range(2 * r + 1)]), axis=0)

def _rotates(n):
    """Letters take part in the calt cycle (x, x.1, x.2); the φ and everything else do not."""
    return _kind(n) == 'letter' and n != 'phi'

def _meetings(A, B_):
    """The drawings of A and B that can stand side by side: the reference drawings (calt off), and
    along the cycle 0·1, 1·2, 2·0. A non-letter restarts the cycle, so what follows it is drawing 0."""
    if _rotates(A) and _rotates(B_): return [(0, 0), (0, 1), (1, 2), (2, 0)]
    if _rotates(A): return [(0, 0), (1, 0), (2, 0)]
    return [(0, 0)]

def kern_value(G, A, B_, wght, slnt=0):
    """Kerning for the pair A·B in one master. Two effects, both measured on the profiles:
    nestling — at every height the two structural profiles together leave at least N units beyond
    the nominal gap, so B can tuck in (r·a, v·a, x·v …): pull by a share of N. A glyph can ask for
    less with nestleR / nestleL (the crossbar of f and t is what makes them: it keeps more air);
    clearance — after that nothing, tails and extenders included, may be closer than CLEAR·gap,
    whichever drawings of the two letters happen to meet."""
    a, b = measure(G, A, wght, slnt)['R'], measure(G, B_, wght, slnt)['L']
    low = A in LOW_MARKS or B_ in LOW_MARKS
    lim = DEPTH_LOW if low else DEPTH
    da = np.minimum(np.maximum(a.depth, 0), lim); db = np.minimum(np.maximum(b.depth, 0), lim)
    N = float((_erode(da) + _erode(db))[BAND].min())
    mark = _kind(A) == 'mark' or _kind(B_) == 'mark'
    share = NESTLE_LOW if low else float(np.interp(wght, B.MASTER_WEIGHTS, NESTLE)) * (NESTLE_MARK if mark else 1.0)
    share *= G.get(A, {}).get('nestleR', 1.0) * G.get(B_, {}).get('nestleL', 1.0)
    k = -share * N if N >= NMIN else 0.0
    near = np.inf
    for va, vb in _meetings(A, B_):
        ma, mb = measure(G, A, wght, slnt, va)['R'], measure(G, B_, wght, slnt, vb)['L']
        t = _bearing(G, A, 'R', wght, slnt=slnt, v=va) + _bearing(G, B_, 'L', wght, slnt=slnt, v=vb)   # reference edge to reference edge
        near = min(near, float(_erode(t + ma.depth + mb.depth).min()))                               # true white, everything included
    need = (CLEAR_ENCLOSED if A in ENCLOSERS or B_ in ENCLOSERS else CLEAR) * gap_target(wght)
    if near + k < need: k = need - near
    return k

def _signature(G, name, side, wght=400):
    d = measure(G, name, wght)[side].depth
    return np.clip(np.where(np.isfinite(d), d, DEPTH), -60, DEPTH)

_ACCENTED = set()   # accented composites that take part in kerning (filled by kerning_tables)
def _kind(n):
    return 'letter' if (len(n) == 1 and n.isalpha()) or n in _ACCENTED or n in ('oe', 'ae', 'germandbls', 'dotlessi', 'phi', 'alpha', 'epsilon', 'sigma', 'sigmafinal') else \
           'figure' if n in ('zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine') else 'mark'

def kern_classes(G, names, side, tol=7.0):
    """Glyphs of one kind whose side profiles agree (RMS < tol over the whole height) share a
    kerning class."""
    classes = []                                                  # [[representative, member, …], …]
    solo = lambda n: side in G.get(n, {}).get('solo', '')         # a glyph may insist on a class of its own
    for n in names:
        sig = _signature(G, n, side)
        for c in classes:
            if _kind(c[0]) == _kind(n) and not solo(n) and not solo(c[0]) and np.sqrt(np.mean((sig - _signature(G, c[0], side)) ** 2)) < tol: c.append(n); break
        else: classes.append([n])
    return classes

def kerning_tables(G, order, masters, report=False, composites=None):
    """{master: (first classes, second classes, {(i, j): value})} with identical classes and pair
    lists in every master, so the GPOS tables merge into variable kerning.
    composites {name: (base, mark)}: accented letters are measured with their marks on (they keep
    the base's bearings), so a mark that reaches past its letter — î ï beside an ascender, an accent
    under the beak of f — gets its own class and its own clearance instead of riding with the base."""
    for name, (b, mark) in (composites or {}).items():
        bg = 'dotlessi' if b == 'i' else b
        G[name] = dict(comp=[(bg, 0, 0), (mark, anchor(G, bg, mark, 400), 0)], L=bg, R=bg, rides=True); _ACCENTED.add(name)
    bases = [n for n in order if n not in ('.notdef', 'space') and split_name(n)[1] == 0
             and (n == 'phi' or n in _ACCENTED or ('comp' not in G.get(n, {}) and n in G)) and not n.endswith('.ss01')]
    bases = [n for n in bases if n in ('phi',) or n in _ACCENTED or 'strokes' in G[n] or 'like' in G[n]]
    first, second = kern_classes(G, bases, 'R'), kern_classes(G, bases, 'L')
    raw = {m: {(i, j): kern_value(G, a[0], b[0], m[0], m[1]) for i, a in enumerate(first) for j, b in enumerate(second)}
           for m in masters}
    def wanted(p):
        """Letters kern with letters and figures; of the marks only the ones that sit against words."""
        ka, kb = _kind(first[p[0]][0]), _kind(second[p[1]][0])
        if ka == 'mark' and kb == 'mark': return False
        if ka == 'mark' and first[p[0]][0] not in KERN_MARKS: return False
        if kb == 'mark' and second[p[1]][0] not in KERN_MARKS: return False
        return max(abs(raw[m][p]) for m in masters) >= KMIN or max(raw[m][p] for m in masters) >= PUSH_MIN
    keep = sorted(p for p in raw[masters[0]] if wanted(p))
    out = {m: (first, second, {p: int(round(raw[m][p])) for p in keep}) for m in masters}
    if report:
        m = masters[0]
        print(f'kerning: {len(first)} first classes, {len(second)} second classes, {len(keep)} pairs')
        for (i, j) in keep:
            print(f'  {"/".join(first[i][:6]):>22} · {"/".join(second[j][:6]):<22}' + ''.join(f' {out[mm][2][(i, j)]:5d}' for mm in masters))
    return out
