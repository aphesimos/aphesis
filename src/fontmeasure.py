"""Aphesis Script — measuring a finished font file (not part of the build).

The spacing engine (spacing.py) works on the drawings. This tool checks the result from the other
end: it takes any font file, shapes a string with HarfBuzz (kerning on, alternates off), and measures
the optical white between each pair of neighbours on the positioned outlines. It is how the
"before" font and the new one are compared with the same ruler.

    python3 fontmeasure.py            → before/after table for the six corner instances

White between two neighbours = mean over the x-height band of the horizontal distance between the
ink of the left glyph and the ink of the right glyph on each scanline, where each side's own
contribution (the depth of its white behind its outermost point in the band) is limited to 15 % of
the x-height — the foundry's depth limit: deeper white is counter, not letter space.
Needs fontTools, numpy, uharfbuzz."""
import math, os, sys
import numpy as np
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.basePen import BasePen

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
AFTER = os.environ.get('APHESIS_FONT') or os.path.join(ROOT, 'dist', 'AphesisScript-VF.ttf')
BEFORE = os.path.join(ROOT, 'before', 'AphesisScript-VF.ttf')
STRINGS = ['aφesis', 'aphesis', 'hhihhi', 'sisisis', 'papapa', 'heheh', 'φhφ']      # what the six-glyph font can set
GREEK = 'αβγδεζηθικλμνξοπρσςτυφχψω'
GREEK_STRINGS = ['ηηοηοοηη', 'άφεσις', 'ξεσκεπάζω την ψυχοφθόρα βδελυγμία', 'ἓν τὸ πᾶν', 'πάντα ῥεῖ', 'γνῶθι σεαυτόν', 'ἀρχὴ ἥμισυ παντός', 'ἄδυτον', 'ἀγορά']
CORNERS = [(300, 0), (400, 0), (800, 0), (300, -16), (400, -16), (800, -16)]

class _Flat(BasePen):
    """Outline → polygons (quadratics and cubics flattened)."""
    def __init__(self, gs, n=6): super().__init__(gs); self.polys = []; self.n = n
    def _moveTo(self, p): self.cur = [p]
    def _lineTo(self, p): self.cur.append(p)
    def _qCurveToOne(self, c, p):
        a = self.cur[-1]
        for t in np.linspace(0, 1, self.n + 1)[1:]:
            self.cur.append(((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * p[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * p[1]))
    def _curveToOne(self, c1, c2, p):
        a = self.cur[-1]
        for t in np.linspace(0, 1, self.n + 1)[1:]:
            u = 1 - t
            self.cur.append((u ** 3 * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p[0],
                             u ** 3 * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p[1]))
    def _closePath(self):
        if len(self.cur) > 2: self.polys.append(np.array(self.cur, float))
    _endPath = _closePath

class Measurer:
    def __init__(self, path, wght, slnt, xh, step=4, depth=0.15):
        self.xh, self.depth, self.slnt = xh, depth * xh, slnt
        self.ys = np.arange(step / 2, xh, step)
        blob = hb.Blob.from_file_path(path); face = hb.Face(blob); self.hb = hb.Font(face)
        self.hb.set_variations({'wght': wght, 'slnt': slnt})
        f = TTFont(path)
        self.font = instancer.instantiateVariableFont(f, {'wght': wght, 'slnt': slnt}) if 'fvar' in f else f
        self.gs = self.font.getGlyphSet(); self.order = self.font.getGlyphOrder(); self._p = {}

    def profile(self, gname):
        """(leftmost, rightmost) ink per scanline of the band, in the leaning letters' own frame."""
        if gname not in self._p:
            pen = _Flat(self.gs); self.gs[gname].draw(pen)
            lo = np.full(len(self.ys), np.inf); hi = np.full(len(self.ys), -np.inf)
            k = math.tan(math.radians(-self.slnt))
            for P in pen.polys:
                x0 = P[:, 0] - (P[:, 1] - self.xh / 2) * k; y0 = P[:, 1]         # undo the slant: the band is upright again
                x1, y1 = np.roll(x0, -1), np.roll(y0, -1)
                ya, yb = np.minimum(y0, y1), np.maximum(y0, y1)
                hit = (self.ys[:, None] >= ya[None, :]) & (self.ys[:, None] < yb[None, :])
                with np.errstate(divide='ignore', invalid='ignore'):
                    xs = x0[None, :] + (self.ys[:, None] - y0[None, :]) / (y1 - y0)[None, :] * (x1 - x0)[None, :]
                lo = np.minimum(lo, np.where(hit, xs, np.inf).min(axis=1)); hi = np.maximum(hi, np.where(hit, xs, -np.inf).max(axis=1))
            self._p[gname] = (lo, hi)
        return self._p[gname]

    def shape(self, text, features=None):
        buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
        hb.shape(self.hb, buf, features or {'calt': False, 'kern': True})
        out, x = [], 0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            out.append((self.order[info.codepoint], x + pos.x_offset)); x += pos.x_advance
        return out, x

    def gaps(self, text, calt=False):
        """[(left glyph, right glyph, optical white in units)] for the neighbours in `text`
        (calt=True: with the alternates the font sets by default)."""
        glyphs, _ = self.shape(text, {'calt': calt, 'kern': True}); res = []
        for (a, xa), (b, xb) in zip(glyphs, glyphs[1:]):
            if a == 'space' or b == 'space': continue
            _, hi = self.profile(a); lo, _ = self.profile(b)
            ea = hi[np.isfinite(hi)].max() + xa; eb = lo[np.isfinite(lo)].min() + xb          # outermost points in the band
            da = np.minimum(np.where(np.isfinite(hi), ea - (hi + xa), np.inf), self.depth)
            db = np.minimum(np.where(np.isfinite(lo), (lo + xb) - eb, np.inf), self.depth)
            res.append((a, b, float((eb - ea) + (da + db).mean())))
        return res

def clearances(path, wght, slnt, letters='abcdefghijklmnopqrstuvwxyzφ', calt=True, below=20, pairs=None):
    """Smallest true distance (units, whole height) between the ink of every ordered pair of
    letters, in each drawing the calt cycle can bring together. Returns [(distance, 'x.1+y.2')]
    for the pairs closer than `below`, closest first. pairs: only these (a, b) instead of all."""
    from scipy.spatial import cKDTree
    m = Measurer(path, wght, slnt, 464); pts = {}
    def cloud(g):
        if g not in pts:
            pen = _Flat(m.gs, n=4); m.gs[g].draw(pen); out = []
            for P in pen.polys:
                Q = np.vstack([P, P[:1]]); d = np.linalg.norm(np.diff(Q, axis=0), axis=1); n = np.maximum(1, np.ceil(d / 3).astype(int))
                out.append(np.vstack([Q[i] + (Q[i + 1] - Q[i]) * np.linspace(0, 1, k, endpoint=False)[:, None] for i, k in enumerate(n)]))
            P = np.vstack(out); pts[g] = (P, cKDTree(P))
        return pts[g]
    seen = {}
    pairs = list(pairs) if pairs is not None else [(a, b) for a in letters for b in letters]
    for pre in (('', 'n', 'nn') if calt else ('',)):
        for a, b in pairs:
            glyphs, _ = m.shape(pre + a + b, {'calt': calt, 'kern': True})
            (ga, xa), (gb, xb) = glyphs[-2], glyphs[-1]
            if (ga, gb) in seen: continue
            Pa, _ = cloud(ga); Pb, tb = cloud(gb)
            d, _ = tb.query(Pa + [xa - xb, 0]); seen[(ga, gb)] = float(d.min())
    return sorted((d, f'{a}+{b}') for (a, b), d in seen.items() if d < below), len(seen)

def evenness(path, xh, strings=STRINGS, corners=CORNERS, calt=False):
    """Per corner instance: mean optical white, and its spread over all neighbours in the strings."""
    rows = []
    for w, s in corners:
        m = Measurer(path, w, s, xh)
        g = np.array([v for t in strings for _, _, v in m.gaps(t, calt)])
        rows.append((w, s, g.mean(), g.std(), g.std() / g.mean() * 100, g.min(), g.max()))
    return rows

def wordmark(path, xh, wght=400, slnt=0):
    m = Measurer(path, wght, slnt, xh)
    return [(a, b, v) for a, b, v in m.gaps('aφesis')]

if __name__ == '__main__':
    for label, path, xh in (('BEFORE (six glyphs, x-height 500)', BEFORE, 500), ('AFTER (Aphesis Script 2, x-height 464)', AFTER, 464)):
        print(label)
        print('  wght slnt   mean    sd   spread%   min   max')
        for w, s, mean, sd, cv, lo, hi in evenness(path, xh):
            print(f'  {w:4d} {s:4d} {mean:6.1f} {sd:5.1f} {cv:8.1f} {lo:5.0f} {hi:5.0f}')
        for w in (300, 400, 800):
            print(f'  aφesis @{w}: ' + '  '.join(f'{a[:3]}·{b[:3]} {v:.0f}' for a, b, v in wordmark(path, xh, w)))
