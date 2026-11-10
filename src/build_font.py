"""aphesis script — variable font (wght 300–800, slnt -16–0) from the φ's brush. Sample glyph set: a p h e s i φ."""
import math, random, re, sys
import numpy as np
sys.path.insert(0, '.')
from glyphs import catmull, edge_noise, X, ASC, DESC, UPM
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.svgLib.path import parse_path
from fontTools.designspaceLib import DesignSpaceDocument, AxisDescriptor, SourceDescriptor
from fontTools import varLib
from fontTools.ttLib import TTFont

NPTS = 72          # points per stroke edge: identical in every master, so weight and slant interpolate
WIDEN = 1.30       # letters widened toward the φ's roundness
NIB = 38
def widths(wght):  # brush widths for a weight: 400 is the φ's own stroke (≈80 units at its thickest)
    wmax = float(np.interp(wght, [300, 400, 800], [50, 80, 128]))
    return wmax, wmax * 0.35                 # wmax, wmin (the φ's thick/thin ratio, ≈2.8)

E = 40
SKEL = {
 'i': dict(adv=200, strokes=[([(28,X-34),(72,X+4),(74,X-90),(72,120),(92,18),(140,8),(140+E,48)], 0.06, 0.20)], dots=[(92, X+170, 44)]),
 'h': dict(adv=390, strokes=[([(40,ASC-30),(70,ASC),(70,ASC-120),(68,300),(66,0)], 0.06, 0.08),
                             ([(70,300),(118,430),(196,X+2),(262,440),(276,320),(276,110),(300,18),(348,8),(348+E,48)], 0.02, 0.18)]),
 'a': dict(adv=420, strokes=[([(300,X-30),(236,X+4),(130,X-22),(66,370),(52,210),(96,52),(176,14),(250,70),(300,190)], 0.10, 0.10),
                             ([(304,X+6),(302,330),(300,110),(326,18),(372,8),(372+E,48)], 0.08, 0.18)]),
 'p': dict(adv=390, strokes=[([(36,X-40),(78,X+8),(76,X-90),(74,0),(72,DESC+20)], 0.06, 0.14),
                             ([(78,370),(150,X),(266,456),(310,320),(286,150),(196,34),(84,62)], 0.08, 0.20)]),
 'e': dict(adv=320, strokes=[([(54,232),(170,300),(236,398),(196,X+2),(98,456),(50,300),(68,116),(150,16),(240,26),(240+E,70)], 0.10, 0.20)]),
 's': dict(adv=310, strokes=[([(262,456),(196,X+4),(104,478),(86,388),(170,290),(256,196),(250,70),(160,8),(54,40)], 0.10, 0.16)]),
}

def fixed_resample(c, n):
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))]
    s = np.linspace(0, d[-1], n); return np.c_[np.interp(s, d, c[:,0]), np.interp(s, d, c[:,1])], d[-1]

def stroke_poly(pts, wmax, wmin, seed, t_in, t_out):
    rng = random.Random(seed)
    pts = [(x*WIDEN, y) for x, y in pts]
    c, L = fixed_resample(catmull(pts), NPTS)
    T = np.gradient(c, axis=0); T /= np.linalg.norm(T, axis=1)[:, None] + 1e-9
    Nn = np.c_[-T[:,1], T[:,0]]; ang = np.arctan2(T[:,1], T[:,0])
    w = wmin + (wmax - wmin) * np.abs(np.sin(ang - math.radians(NIB)))**1.25
    u = np.linspace(0, 1, NPTS); tap = np.ones_like(u)
    if t_in > 0: tap = np.minimum(tap, 0.18 + 0.82*np.sin(np.clip(u/t_in, 0, 1)*np.pi/2))
    if t_out > 0: tap = np.minimum(tap, 0.04 + 0.96*np.sin(np.clip((1-u)/t_out, 0, 1)*np.pi/2))
    w = w * tap; s = u * L; sig = 78 * 0.035          # edge drift fixed in units: the hand is the same at every weight
    nl, nr = edge_noise(rng, L, sig), edge_noise(rng, L, sig)
    hl = w/2 + nl(s)*tap; hr = w/2 + nr(s)*tap
    # inside a tight turn the edge may not cross the turn's center, or the outline folds and punches a hole:
    # the half-width on the inner side is capped by the local radius of curvature (ink pools instead)
    d1 = np.gradient(c, axis=0); d2 = np.gradient(d1, axis=0)
    k = (d1[:,0]*d2[:,1] - d1[:,1]*d2[:,0]) / (np.linalg.norm(d1, axis=1)**3 + 1e-9)       # signed curvature (+ = turns left)
    from scipy.ndimage import gaussian_filter1d
    k = gaussian_filter1d(k, 1.5)
    R = 1/np.maximum(np.abs(k), 1e-6)
    cap = 0.92*R
    hl = np.where(k > 0, np.minimum(hl, cap), hl); hr = np.where(k < 0, np.minimum(hr, cap), hr)
    left = c + Nn * hl[:, None]; right = c - Nn * hr[:, None]
    return np.vstack([left, right[::-1]])

def dot_poly(cx, cy, r, seed):
    rng = random.Random(seed); a = np.linspace(0, 2*np.pi, 40, endpoint=False)
    rr = r * (1 + 0.08*np.sin(3*a + rng.uniform(0, 6)) + 0.05*np.sin(5*a + rng.uniform(0, 6)))
    return np.c_[cx*WIDEN + rr*np.cos(a)*1.05, cy + rr*np.sin(a)*0.92]

def shear(P, slnt):  # slnt in degrees, negative leans right (OpenType convention)
    t = math.tan(math.radians(-slnt)); P = np.array(P, float); P[:,0] = P[:,0] + P[:,1]*t; return P

def clockwise(P):
    A = 0.5*np.sum(P[:,0]*np.roll(P[:,1], -1) - np.roll(P[:,0], -1)*P[:,1])
    return P[::-1] if A > 0 else P   # TrueType: outer contours clockwise (negative area, y up)

# the φ: your drawing, converted once to quadratic curves (upright), then sheared point by point
PHI_D = re.search(r' d="([^"]+)"', open('/tmp/claude-0/-home-user/b86134f0-5066-55eb-9eed-e7bff27da970/scratchpad/logo/phi.svg').read()).group(1)
K = 500/364.0
class _Map:
    def __init__(s, pen): s.p = pen
    def _t(s, pt): return ((pt[0]-75)*K + 20, (365 - pt[1])*K)
    def moveTo(s, pt): s.p.moveTo(s._t(pt))
    def lineTo(s, pt): s.p.lineTo(s._t(pt))
    def curveTo(s, *pts): s.p.curveTo(*[s._t(q) for q in pts])
    def qCurveTo(s, *pts): s.p.qCurveTo(*[s._t(q) for q in pts])
    def closePath(s): s.p.closePath()
    def endPath(s): s.p.endPath()
REC = RecordingPen(); parse_path(PHI_D, Cu2QuPen(_Map(REC), max_err=0.6, reverse_direction=True))
PHI_ADV = int((447-75)*K) + 50

def glyph_set(wght, slnt):
    wmax, wmin = widths(wght); out = {}
    for ch, g in SKEL.items():
        pen = TTGlyphPen(None); seed = ord(ch)*101
        for j, (pts, ti, to) in enumerate(g['strokes']):
            P = clockwise(shear(stroke_poly(pts, wmax, wmin, seed + j, ti, to), slnt))
            pen.moveTo(tuple(map(round, P[0]))); [pen.lineTo(tuple(map(round, q))) for q in P[1:]]; pen.closePath()
        for k, (x, y, r) in enumerate(g.get('dots', [])):
            P = clockwise(shear(dot_poly(x, y, r*wmax/80, seed + 50 + k), slnt))
            pen.moveTo(tuple(map(round, P[0]))); [pen.lineTo(tuple(map(round, q))) for q in P[1:]]; pen.closePath()
        out[ch] = (pen.glyph(), int(g['adv']*WIDEN) - 34)   # wider letters, but the gaps between them stay tight
    # φ: same outline at every weight (it is the drawn original); only the slant moves it
    pen = TTGlyphPen(None)           # the φ never leans: same outline in every master
    for op, args in REC.value:
        sh = [ (round(x), round(y)) for x, y in args ]
        getattr(pen, op)(*sh)
    out['phi'] = (pen.glyph(), PHI_ADV)
    return out

def master(path, wght, slnt):
    fb = FontBuilder(UPM, isTTF=True)
    gs = glyph_set(wght, slnt)
    order = ['.notdef', 'space'] + list(SKEL) + ['phi']
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({0x20: 'space', **{ord(c): c for c in SKEL}, 0x3C6: 'phi'})
    empty = TTGlyphPen(None).glyph()
    glyf = {'.notdef': empty, 'space': empty, **{k: v[0] for k, v in gs.items()}}
    fb.setupGlyf(glyf)
    adv = {'.notdef': 500, 'space': 260, **{k: v[1] for k, v in gs.items()}}
    fb.setupHorizontalMetrics({k: (adv[k], glyf[k].xMin if hasattr(glyf[k], 'xMin') and glyf[k].numberOfContours else 0) for k in order})
    fb.setupHorizontalHeader(ascent=ASC+80, descent=DESC-60)
    fb.setupNameTable({'familyName': 'Aphesis Script', 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=ASC+80, sTypoDescender=DESC-60, usWinAscent=ASC+120, usWinDescent=-(DESC-100), sxHeight=X)
    fb.setupPost(); fb.save(path)

if __name__ == '__main__':
    locs = {'Regular': (400, 0), 'Light': (300, 0), 'Bold': (800, 0), 'Slanted': (400, -16)}
    ds = DesignSpaceDocument()
    for tag, name, mn, df, mx in [('wght', 'Weight', 300, 400, 800), ('slnt', 'Slant', -16, 0, 0)]:
        a = AxisDescriptor(); a.tag, a.name, a.minimum, a.default, a.maximum = tag, name, mn, df, mx; ds.addAxis(a)
    for nm, (w, s) in locs.items():
        p = f'master-{nm}.ttf'; master(p, w, s)
        src = SourceDescriptor(); src.path = p; src.location = {'Weight': w, 'Slant': s}; ds.addSource(src)
    vf, _, _ = varLib.build(ds)
    vf['name'].setName('Aphesis Script', 1, 3, 1, 0x409)
    vf.save('AphesisScript-VF.ttf'); vf.flavor = 'woff2'; vf.save('AphesisScript-VF.woff2')
    f = TTFont('AphesisScript-VF.ttf'); print('ok', [a.axisTag for a in f['fvar'].axes], len(f.getGlyphOrder()), 'glyphs')
