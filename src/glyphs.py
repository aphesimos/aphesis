"""aphesis script — first sample. Skeletons (pen paths) + the φ's brush -> traced outlines (font units, y up)."""
import json, math, random, sys
import numpy as np, potrace
from PIL import Image, ImageDraw

UPM, X, ASC, DESC = 1000, 500, 760, -250
S = 2                       # raster px per unit
RASTER_Y0 = 300             # raster origin offset (units) for descenders

def catmull(pts, n=26):
    """centripetal Catmull-Rom through the control points"""
    P = [np.array(p, float) for p in pts]
    P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        t0 = 0; t1 = t0 + np.linalg.norm(p1-p0)**.5 + 1e-6; t2 = t1 + np.linalg.norm(p2-p1)**.5 + 1e-6; t3 = t2 + np.linalg.norm(p3-p2)**.5 + 1e-6
        for t in np.linspace(t1, t2, n, endpoint=False):
            a1 = (t1-t)/(t1-t0)*p0 + (t-t0)/(t1-t0)*p1; a2 = (t2-t)/(t2-t1)*p1 + (t-t1)/(t2-t1)*p2; a3 = (t3-t)/(t3-t2)*p2 + (t-t2)/(t3-t2)*p3
            b1 = (t2-t)/(t2-t0)*a1 + (t-t0)/(t2-t0)*a2; b2 = (t3-t)/(t3-t1)*a2 + (t-t1)/(t3-t1)*a3
            out.append((t2-t)/(t2-t1)*b1 + (t-t1)/(t2-t1)*b2)
    out.append(P[-2]); return np.array(out)

def resample(c, step=3.0):
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))]
    s = np.arange(0, d[-1], step); return np.c_[np.interp(s, d, c[:,0]), np.interp(s, d, c[:,1])], d[-1]

def edge_noise(rng, L, sig):
    """hand-moved nodes along one edge (spacing 40–110 units), linear between, lightly smoothed"""
    xs = [0.0]
    while xs[-1] < L: xs.append(xs[-1] + rng.uniform(40, 110))
    ys = [rng.gauss(0, sig) for _ in xs]
    return lambda s: np.interp(s, xs, ys)

def stroke(pts, P, rng, t_in=0.10, t_out=0.16, wscale=1.0):
    """the φ's brush along a skeleton: broad nib (thick on verticals), tapered ends, edges that drift independently"""
    c, L = resample(catmull(pts))
    T = np.gradient(c, axis=0); T /= np.linalg.norm(T, axis=1)[:, None] + 1e-9
    Nn = np.c_[-T[:,1], T[:,0]]
    ang = np.arctan2(T[:,1], T[:,0])
    nib = math.radians(P['nib'])
    w = P['wmin'] + (P['wmax'] - P['wmin']) * np.abs(np.sin(ang - nib))**1.25
    w *= wscale
    u = np.linspace(0, 1, len(c))
    tap = np.ones_like(u)
    if t_in > 0: tap = np.minimum(tap, 0.18 + 0.82*np.sin(np.clip(u/t_in, 0, 1)*np.pi/2))
    if t_out > 0: tap = np.minimum(tap, 0.04 + 0.96*np.sin(np.clip((1-u)/t_out, 0, 1)*np.pi/2))
    w *= tap
    s = u * L; sig = P['wmax'] * P['rough']
    nl, nr = edge_noise(rng, L, sig), edge_noise(rng, L, sig)
    left = c + Nn * (w/2 + nl(s)*tap)[:, None]; right = c - Nn * (w/2 + nr(s)*tap)[:, None]
    return left, right

def dot(cx, cy, r, rng):
    a = np.linspace(0, 2*np.pi, 40, endpoint=False)
    rr = r * (1 + 0.08*np.sin(3*a + rng.uniform(0, 6)) + 0.05*np.sin(5*a + rng.uniform(0, 6)))
    return np.c_[cx + rr*np.cos(a)*1.05, cy + rr*np.sin(a)*0.92]

# ---- skeletons (upright; x from 0, baseline y=0) ----
def skel(P):
    E = P['exit']   # how far exit strokes reach toward the next letter
    return {
     'i': dict(adv=200, strokes=[([(28,X-34),(72,X+4),(74,X-90),(72,120),(92,18),(140,8),(140+E,48)], 0.06, 0.20)], dots=[(92, X+170, 44)]),
     'h': dict(adv=390, strokes=[([(40,ASC-30),(70,ASC),(70,ASC-120),(68,300),(66,0)], 0.06, 0.08),
                                 ([(70,300),(118,430),(196,X+2),(262,440),(276,320),(276,110),(300,18),(348,8),(348+E,48)], 0.0, 0.18)]),
     'a': dict(adv=420, strokes=[([(300,X-30),(236,X+4),(130,X-22),(66,370),(52,210),(96,52),(176,14),(250,70),(300,190)], 0.10, 0.10),
                                 ([(304,X+6),(302,330),(300,110),(326,18),(372,8),(372+E,48)], 0.08, 0.18)]),
     'p': dict(adv=390, strokes=[([(36,X-40),(78,X+8),(76,X-90),(74,0),(72,DESC+20)], 0.06, 0.14),
                                 ([(78,370),(150,X),(266,456),(310,320),(286,150),(196,34),(84,62)], 0.08, 0.20)]),
     'e': dict(adv=320, strokes=[([(54,232),(170,300),(236,398),(196,X+2),(98,456),(50,300),(68,116),(150,16),(240,26),(240+E,70)], 0.10, 0.20)]),
     's': dict(adv=310, strokes=[([(262,456),(196,X+4),(104,478),(86,388),(170,290),(256,196),(250,70),(160,8),(54,40)], 0.10, 0.16)]),
    }

def build(P, seed=7):
    """returns {letter: {'adv', 'path' (SVG d in font units, y up)}}"""
    rng = random.Random(seed); sh = math.tan(math.radians(P['slant'])); out = {}
    for ch, g in skel(P).items():
        W = int((g['adv'] + 260) * S); H = int((ASC - DESC + 400) * S)
        img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img)
        tr = lambda x, y: ((x + y*sh + 60) * S, (ASC + 200 - y) * S)
        polys = []
        for pts, ti, to in g['strokes']:
            l, r = stroke(pts, P, rng, ti, to)
            for k in range(len(l)-1):
                d.polygon([tr(*l[k]), tr(*l[k+1]), tr(*r[k+1]), tr(*r[k])], fill=255)
        for (x, y, rr) in g.get('dots', []):
            d.polygon([tr(*p) for p in dot(x, y, rr*P['wmax']/80, rng)], fill=255)
        path = potrace.Bitmap(np.array(img) <= 127).trace(turdsize=20, alphamax=1.0, opticurve=True, opttolerance=0.2)
        inv = lambda X_, Y_: (X_/S - 60, ASC + 200 - Y_/S)    # back to font units (unshear not needed: the slant stays)
        dd = []
        for c in path:
            p0 = inv(c.start_point.x, c.start_point.y); dd.append(f"M{p0[0]:.1f} {p0[1]:.1f}")
            for sgm in c.segments:
                if sgm.is_corner:
                    a = inv(sgm.c.x, sgm.c.y); b = inv(sgm.end_point.x, sgm.end_point.y); dd.append(f"L{a[0]:.1f} {a[1]:.1f}L{b[0]:.1f} {b[1]:.1f}")
                else:
                    a = inv(sgm.c1.x, sgm.c1.y); b = inv(sgm.c2.x, sgm.c2.y); e = inv(sgm.end_point.x, sgm.end_point.y)
                    dd.append(f"C{a[0]:.1f} {a[1]:.1f} {b[0]:.1f} {b[1]:.1f} {e[0]:.1f} {e[1]:.1f}")
            dd.append("Z")
        out[ch] = dict(adv=g['adv'], path=''.join(dd))
    return out

VARIANTS = {
 'chancery':     dict(slant=9,  nib=38, wmax=78, wmin=27, rough=0.035, exit=40, note='Roman chancery italic: 9° slant, nib at 38°, exits that reach toward the next letter.'),
 'uncial':       dict(slant=2,  nib=30, wmax=82, wmin=30, rough=0.03,  exit=18, note='Almost upright and rounder, short exits: closer to the φ standing still.'),
 'experimental': dict(slant=14, nib=46, wmax=86, wmin=20, rough=0.06,  exit=70, note='Steep 14° slant, higher contrast, long exits and a less certain hand.'),
}
if __name__ == '__main__':
    res = {k: dict(note=v['note'], glyphs=build(v)) for k, v in VARIANTS.items()}
    json.dump(res, open(sys.argv[1], 'w')); print('ok', {k: len(v['glyphs']) for k, v in res.items()})
