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
from registry import glyph_polys, split_name, NAMES, LETTER_GLYPHS, FIGURES, BELOW, CJK

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

EDGE_PLAY = 16      # how far the edge of a re-written letter may sit from the reference drawing's, scanline by scanline

class Side:
    """One side of a glyph: reference edge and depth of the white behind it on every scanline.
    like: the same side of the letter's reference drawing. A letter written again (x.1, x.2) has
    its structure where the reference drawing has it; the free ends of its strokes run a little
    longer or shorter, and in the heavy weights the tip of an exit tail or of an entry can rise into
    the middle band. Such a tip must not become the edge (it would push the next letter away by
    half a letter-space), so only scanlines whose ink lies within EDGE_PLAY units of the reference
    drawing's ink on the same scanline can define the edge; the tip still counts as ink in the gap."""
    def __init__(self, prof, sign, refband, like=None):
        band = BAND if refband == 'full' else MIDB
        inside = np.isfinite(prof) & (True if refband == 'all' else band)      # 'all': a mark that lives outside the x-height (the asterisk)
        if like is not None and refband == 'mid':
            with np.errstate(invalid='ignore'): same = inside & (np.abs(prof - like) <= EDGE_PLAY)
            if same.any(): inside = same
        if not inside.any(): inside = np.isfinite(prof) & BAND
        if not inside.any(): inside = np.isfinite(prof)
        self.ref = float(prof[inside].max() if sign > 0 else prof[inside].min())
        d = (self.ref - prof) * sign                       # >0 white behind the edge, <0 ink beyond it
        self.depth = np.where(np.isfinite(prof), d, np.inf)
        self.white = float(np.minimum(self.depth[BAND], DEPTH).mean())

    def see(self, prof, sign):
        """The same edge, met by other ink: an upright glyph in a slanted master keeps its box, but the
        leaning glyphs beside it meet its ink sheared the other way. Only the depths change."""
        self.depth = np.where(np.isfinite(prof), (self.ref - prof) * sign, np.inf)
        return self

_M = {}
def _leans(G, name):
    """Does the glyph hold a part that leans less than the letters (a Greek mark, or a letter that carries one)?"""
    spec = G.get(name, {})
    if 'comp' in spec: return any(G.get(part, {}).get('lean', 1.0) != 1.0 for part, _, _ in spec['comp'])
    return spec.get('lean', 1.0) != 1.0

def measure(G, name, wght, slnt=0, v=0):
    """Profiles of one drawing of a glyph (v = 0 the reference, 1 and 2 its re-writings). Letters
    are measured upright: a slanted master shears every letter alike, so the white between them is
    unchanged. What does not lean like the letters is measured as the leaning letters meet it, that
    is, sheared the other way: the φ (which stays upright), the Greek marks (which lean half as
    much) and the letters that carry them. The four Chinese characters stay upright too, and they
    keep the same box at every slant: their edges are the upright ones (taken over their whole
    height); only the depths, which the kerning reads, are those the leaning neighbours meet."""
    spec = G.get(name, {})
    whole = 'all' in (spec.get('Lref'), spec.get('Rref'))          # an upright glyph fitted on its whole height (色即是空)
    slnt = slnt if name == 'phi' or spec.get('upright') or _leans(G, name) else 0
    key = (name, wght, slnt, v)
    if key not in _M:
        ink = lambda polys: [P for P in polys if 0.5 * np.sum(P[:, 0] * np.roll(P[:, 1], -1) - np.roll(P[:, 0], -1) * P[:, 1]) <= 0]
        stands = ink(glyph_polys(G, name, wght, slnt, v))             # as it stands in this master …
        polys = [B.shear(P, -slnt) for P in stands] if slnt else stands   # … and as the leaning letters meet it
        spec = G.get(name, {})
        Lo, Hi = profiles(polys)
        ref = measure(G, name, wght, slnt, 0) if v else None      # the reference drawing of the same letter
        L, R = Side(Lo, -1, spec.get('Lref', 'mid'), ref and ref['lo']), Side(Hi, +1, spec.get('Rref', 'mid'), ref and ref['hi'])
        if whole and slnt:
            Lo0, Hi0 = profiles(stands)
            L, R = Side(Lo0, -1, spec.get('Lref', 'mid')).see(Lo, -1), Side(Hi0, +1, spec.get('Rref', 'mid')).see(Hi, +1)
        _M[key] = dict(L=L, R=R, xmin=float(Lo[np.isfinite(Lo)].min()), xmax=float(Hi[np.isfinite(Hi)].max()), lo=Lo, hi=Hi)
    return _M[key]

# Sidebearing classes: a letter side that is the same gesture as a control letter's takes that
# letter's bearing (the foundry's "=n", "=o" metric keys). Everything not listed is measured.
KEYS = {
    'L': {  # left sides
        **dict.fromkeys('ijmprt', 'n'),                    # x-height stem with hairline entry        = n
        'dotlessi': 'n', 'dotlessj': 'n',
        **dict.fromkeys('bkl', 'h'),                       # ascender stem with flag                  = h
        **dict.fromkeys('dgq', 'a'),                       # the bowl of a                            = a
        'c': 'e', 'oe': 'o', 'ae': 'a',                    # round backs
        **dict.fromkeys('wy', 'v'),                        # thick diagonal                           = v
    },
    'R': {  # right sides
        **dict.fromkeys('hm', 'n'),                        # arch shoulder, stem, exit tail           = n
        **dict.fromkeys('adlu', 'i'),                      # straight stem, exit tail                 = i
        'dotlessi': 'i', 'dotlessj': 'q',
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
    dx, adv = _fit(G, base, wght, slnt, v)
    same = G.get(base, {}).get('same')                     # signs that must stand on one width (+ − =): the widest, the others centred in it
    if same:
        w = max(_fit(G, g, wght, slnt, 0)[1] for g, sp in list(G.items()) if isinstance(sp, dict) and sp.get('same') == same)
        dx += (w - adv) / 2; adv = w
    return dx, adv

def _fit(G, base, wght, slnt, v):
    m = measure(G, base, wght, slnt, v)
    lsb, rsb = _bearing(G, base, 'L', wght, slnt=slnt, v=v), _bearing(G, base, 'R', wght, slnt=slnt, v=v)
    return lsb - m['L'].ref, (m['R'].ref - m['L'].ref) + lsb + rsb

def anchor(G, base, mark, wght):
    """Where a mark's centre sits on a base letter, in the base's drawing coordinates: over the
    middle of the letter's structure (its two reference edges), unless the letter says otherwise
    (top= for the marks above, below= where a cedilla hangs, sub= for the Greek iota subscript)."""
    spec = G.get(base, {})
    key = 'below' if mark == 'cedilla' else 'sub' if mark in BELOW else 'top'
    if key in spec: return spec[key] * B.hx(wght)
    m = measure(G, base, wght)
    return (m['L'].ref + m['R'].ref) / 2

def layout(G, text, wght=400, slnt=0, calt=False, kern=None):
    """Set a line: [(glyph name, variant, x offset of the drawing)], total advance."""
    items, x, run, prev = [], 0.0, 0, None
    for i, ch in enumerate(text):
        if ch not in NAMES: ch = ch.lower()                # no capitals, in either script
        nm = NAMES.get(ch, ch)
        if nm == 'space': x += space_width(wght); run = 0; prev = None; continue
        v = 0
        if calt and _rotates(nm): v = run % 3; run += 1
        elif calt and nm == 'phi' and i + 1 < len(text) and ord(text[i + 1]) >= 0x370 and _rotates(NAMES.get(text[i + 1].lower(), '')): run += 1
        else: run = 0                                      # (the φ takes its turn inside a Greek word, as calt has it)
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
              'asterisk', 'exclam', 'question', 'exclamdown', 'questiondown', 'guillemotleft', 'guillemotright',
              'guilsinglleft', 'guilsinglright')
ERODE = 6           # scanlines (×STEP units) over which nearness is judged diagonally
HAN_KEEP = 0.6      # a Chinese character beside leaning ink keeps its upright white there, up to this share of the straight gap

def _erode(a, r=ERODE):
    """Minimum over a vertical window: horizontal gaps become (roughly) true distances."""
    p = np.pad(a, r, mode='edge')
    return np.min(np.stack([p[i:i + len(a)] for i in range(2 * r + 1)]), axis=0)

PHIS = ('phi', 'phi.ss02')                               # the φ, and its leaning form: one drawing each
def _rotates(n):
    """Letters take part in the calt cycle (x, x.1, x.2); the φ and everything else do not."""
    return _kind(n) == 'letter' and n not in PHIS

def _meetings(A, B_):
    """The drawings of A and B that can stand side by side: the reference drawings (calt off), and
    along the cycle 0·1, 1·2, 2·0. A non-letter restarts the cycle, so what follows it is drawing 0;
    after a φ inside a Greek word the cycle goes on, so any of the three can follow it."""
    if _rotates(A) and _rotates(B_): return [(0, 0), (0, 1), (1, 2), (2, 0)]
    if _rotates(A): return [(0, 0), (1, 0), (2, 0)]
    if A in PHIS and _rotates(B_): return [(0, 0), (0, 1), (0, 2)]
    return [(0, 0)]

FLOOR = 24          # between glyphs added after 2.0 no two points of ink come closer than this, in any direction
_SETTLED = None     # the glyphs whose kerning is as 2.0 left it (set by kerning_tables)

def _floor(t, da, db, slnt, F=FLOOR):
    """The kern that keeps every point of A's ink at least F units from every point of B's — the true
    distance, as the two stand in this master (in a slanted one what is higher lies further right)."""
    T = math.tan(math.radians(-slnt)); n = len(da); out = -np.inf
    for s in range(-(F // STEP), F // STEP + 1):                    # B's scanline s steps above A's
        dy = s * STEP
        g = t + da[max(0, -s): n - max(0, s)] + db[max(0, s): n - max(0, -s)] + dy * T
        g = g[np.isfinite(g)]
        if len(g) and abs(dy) < F: out = max(out, math.sqrt(F * F - dy * dy) - float(g.min()))
    return out

def _nearest(G, A, B_, wght, slnt):
    """Smallest white on any scanline between A and B set side by side without kerning, whichever
    drawings meet; and the push the true-distance floor asks for."""
    near, push = np.inf, -np.inf
    for va, vb in _meetings(A, B_):
        ma, mb = measure(G, A, wght, slnt, va)['R'], measure(G, B_, wght, slnt, vb)['L']
        t = _bearing(G, A, 'R', wght, slnt=slnt, v=va) + _bearing(G, B_, 'L', wght, slnt=slnt, v=vb)   # reference edge to reference edge
        near = min(near, float((t + ma.depth + mb.depth).min()))                                    # true white, everything included
        push = max(push, _floor(t, ma.depth, mb.depth, slnt))
    return near, push

def kern_value(G, A, B_, wght, slnt=0):
    """Kerning for the pair A·B in one master. Two effects, both measured on the profiles:
    nestling — at every height the two structural profiles together leave at least N units beyond
    the nominal gap, so B can tuck in (r·a, v·a, x·v …): pull by a share of N. A glyph can ask for
    less with nestleR / nestleL (the crossbar of f and t is what makes them: it keeps more air);
    clearance — after that nothing, tails and extenders included, may be closer than CLEAR·gap,
    whichever drawings of the two letters happen to meet.
    Glyphs added after 2.0 also keep a true distance (FLOOR) in every direction, not only along the
    line. And the Chinese characters, which stand upright in the slanted masters while everything
    around them leans, are never pulled in, and keep there the white they have in the upright one."""
    a, b = measure(G, A, wght, slnt)['R'], measure(G, B_, wght, slnt)['L']
    han = 'han' in (_kind(A), _kind(B_))
    low = A in LOW_MARKS or B_ in LOW_MARKS
    lim = DEPTH_LOW if low else DEPTH
    da = np.minimum(np.maximum(a.depth, 0), lim); db = np.minimum(np.maximum(b.depth, 0), lim)
    N = float((_erode(da) + _erode(db))[BAND].min())
    mark = _kind(A) == 'mark' or _kind(B_) == 'mark'
    share = NESTLE_LOW if low else float(np.interp(wght, B.MASTER_WEIGHTS, NESTLE)) * (NESTLE_MARK if mark else 1.0)
    share *= G.get(A, {}).get('nestleR', 1.0) * G.get(B_, {}).get('nestleL', 1.0)
    k = -share * N if N >= NMIN and not han else 0.0
    need = kern_need(G, A, B_, wght, slnt)
    if k < need:
        k = need
        if 1 < need < PUSH_MIN and _SETTLED is not None and (A not in _SETTLED or B_ not in _SETTLED): k = PUSH_MIN   # (a push too small
    return k                                                                # to be kept as a pair is rounded up to one that is)

def kern_need(G, A, B_, wght, slnt=0):
    """The smallest kern that keeps A·B clear in this master: nothing nearer than CLEAR·gap along the
    line; for glyphs added after 2.0 nothing nearer than FLOOR in any direction; and beside a Chinese
    character in a slanted master, the white it has in the upright one."""
    near, push = _nearest(G, A, B_, wght, slnt)
    need = (CLEAR_ENCLOSED if A in ENCLOSERS or B_ in ENCLOSERS else CLEAR) * gap_target(wght)
    if 'han' in (_kind(A), _kind(B_)) and slnt:
        need = max(need, min(_nearest(G, A, B_, wght, 0)[0] + kern_value(G, A, B_, wght, 0), HAN_KEEP * gap_target(wght)))
    need -= near
    if _SETTLED is not None and (A not in _SETTLED or B_ not in _SETTLED): need = max(need, push)
    return need

def _signature(G, name, side, wght=400):
    d = measure(G, name, wght)[side].depth
    return np.clip(np.where(np.isfinite(d), d, DEPTH), -60, DEPTH)

_ACCENTED = set()   # accented composites (filled by add_composites): letters like their bases
G_BASE = {}         # … and the letter each of them is built on
HAN = set(CJK.values())
def _kind(n):
    return 'letter' if n in LETTER_GLYPHS or n in _ACCENTED else 'figure' if n in FIGURES else 'han' if n in HAN else 'mark'

def add_composites(G, composites):
    """Enter the accented letters {name: (base, [marks])} into the glyph table as composites, so
    they can be set, measured and kerned with their marks on. They keep the base's bearings."""
    for name, (base, marks) in composites.items():
        G[name] = dict(comp=[(base, 0, 0)] + [(m, anchor(G, base, m, 400), 0) for m in marks], L=base, R=base, rides=True)
        _ACCENTED.add(name); G_BASE[name] = base
    return G

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

RIDE_TOL = 6        # a glyph added later rides in a settled class only if it kerns like it, to this many units

def _pairs(A, B_):
    """Is A·B a pair that is kerned at all? Letters kern with letters and figures; of the marks only the
    ones that sit against words, and never two marks — except an opening bracket before a closing
    one, which must not run into each other. The Chinese characters keep their distance from
    everything but each other (among themselves their boxes are the spacing)."""
    ka, kb = _kind(A), _kind(B_)
    if ka == 'han' and kb == 'han': return False
    if ka == 'mark' and kb == 'mark': return A in OPENERS and B_ in CLOSERS
    if ka == 'mark' and A not in KERN_MARKS: return False
    if kb == 'mark' and B_ not in KERN_MARKS: return False
    return True
OPENERS, CLOSERS = ('parenleft', 'bracketleft'), ('parenright', 'bracketright')

def _kerns(n):
    """Does this glyph take part in kerning at all?"""
    return _kind(n) != 'mark' or n in KERN_MARKS

def _refine(G, classes, others, side, settled, masters):
    """The classes are found from the shapes of the sides at wght 400. That is a good guess, not a
    proof: two sides can look alike there and still need different kerning (another bearing, a
    longer bar at 800, a crossbar that must keep its air). The glyphs the family started with were
    checked pair by pair on the finished font, and their classes are left as they are. Every glyph
    added after that has to earn its place: it stays in a class only if, against every class of the
    other side and at every weight, it would get the same kern as the class's first member (within
    RIDE_TOL units). If not, it founds a class of its own, which the next such glyph may join."""
    reps = [c[0] for c in others if _kerns(c[0])]
    def vec(n):
        """(the kerns this glyph would get, the least it needs to stay clear) against every class of the other side, in every master"""
        pair = (lambda o: (n, o)) if side == 'R' else (lambda o: (o, n))
        todo = [(pair(o), w, sl) for o in reps for w, sl in masters]
        return (np.array([kern_value(G, *p, w, sl) if _pairs(*p) else 0.0 for p, w, sl in todo]),
                np.array([kern_need(G, *p, w, sl) if _pairs(*p) else -np.inf for p, w, sl in todo]))
    rides = lambda v, v0: np.abs(v[0] - v0[0]).max() <= RIDE_TOL and (v0[0] >= v[1] - 1).all()
    out, extra = [], []
    for c in classes:
        late = [n for n in c[1:] if n not in settled]
        if not late or not _kerns(c[0]): out.append(c); continue
        v0 = vec(c[0]); keep = [n for n in c if n not in late]; split = []
        for n in late:
            v = vec(n)
            if rides(v, v0): keep.append(n); continue
            for sv, members in split:
                if rides(v, sv): members.append(n); break
            else: split.append((v, [n]))
        out.append(keep); extra += [members for _, members in split]
    return out + extra

def kerning_tables(G, order, masters, report=False, composites=None, settled=None):
    """{master: (first classes, second classes, {(i, j): value})} with identical classes and pair
    lists in every master, so the GPOS tables merge into variable kerning.
    composites {name: (base, marks)}: accented letters are measured with their marks on (they keep
    the base's bearings), so a mark that reaches past its letter — î ï beside an ascender, an accent
    under the beak of f — gets its own class and its own clearance instead of riding with the base.
    settled: the glyphs whose classes are not to be re-examined (see _refine)."""
    global _SETTLED
    add_composites(G, composites or {}); _SETTLED = settled
    bases = [n for n in order if n not in ('.notdef', 'space') and split_name(n)[1] == 0
             and (n in PHIS or n in _ACCENTED or ('comp' not in G.get(n, {}) and n in G)) and not n.endswith('.ss01')]
    bases = [n for n in bases if n in PHIS or n in _ACCENTED or 'strokes' in G[n] or 'like' in G[n]]
    first, second = kern_classes(G, bases, 'R'), kern_classes(G, bases, 'L')
    if settled is not None: first, second = _refine(G, first, second, 'R', settled, masters), _refine(G, second, first, 'L', settled, masters)
    pairs = [p for p in ((i, j) for i in range(len(first)) for j in range(len(second))) if _pairs(first[p[0]][0], second[p[1]][0])]
    raw = {m: {p: kern_value(G, first[p[0]][0], second[p[1]][0], m[0], m[1]) for p in pairs} for m in masters}
    keep = sorted(p for p in pairs if max(abs(raw[m][p]) for m in masters) >= KMIN or max(raw[m][p] for m in masters) >= PUSH_MIN)
    out = {m: (first, second, {p: int(round(raw[m][p])) for p in keep}) for m in masters}
    if report:
        m = masters[0]
        print(f'kerning: {len(first)} first classes, {len(second)} second classes, {len(keep)} pairs')
        for (i, j) in keep:
            print(f'  {"/".join(first[i][:6]):>22} · {"/".join(second[j][:6]):<22}' + ''.join(f' {out[mm][2][(i, j)]:5d}' for mm in masters))
    return out
