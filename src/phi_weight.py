"""The hand-drawn phi on the weight axis (Aphesis Script).

wght 400 is the original drawing, untouched.  The Light (300) and Black (800) masters are the same glyf points, moved so
that the local stroke thickness is multiplied by s = 50/80 and 128/80 (the brush of the letters):
 1. the cu2qu outline is sampled densely; the half-thickness r of the stroke at a sample is the radius of the largest
    inscribed disc tangent there (narrow dips of r at convex kinks of the hand-drawn edge are closed; tapered tips keep
    their small r, so they stay tips);
 2. one displacement U per point (on- and off-curve alike) is found by least squares: per unit of (s - 1) the curve
    moves along its outward normal by r, and U stays locally affine along the control polygon (second differences),
    so the wobbles of the hand, the tips and the smooth joins are carried along instead of being re-offset;
 3. at the crotches where the loop meets the stem (tight concave turns) the fillet is carried rigidly to the
    intersection of the two offset edges (miter), so junctions neither bloat nor get notched;
 4. vertical fit: y is remapped piecewise-linearly so that the stem tip, the loop's bottom line and the top of each
    lobe keep their original heights at every weight; the width is left to change naturally.
Weights in between are linear interpolations of the three point-compatible masters.
"""
import os
from functools import lru_cache
import numpy as np
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.svgLib.path import parse_path

PHI_D = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phi_path.txt')).read().strip()
K = 500/364.0                           # art units -> font units (phi loop height = x-height)
SCALE = {300: 50/80, 800: 128/80}       # brush thickness of the masters relative to the drawing (wmax/80)
STEP = 2.5                              # spacing of the dense outline samples (font units)
CLOSE = 16.0                            # dips of r narrower than this are closed
TURN, NEAR, FAR = 35.0, 10.0, 40.0      # crotch: concave turn (deg) within ~8 units; rigid within NEAR, faded out at FAR
STIFF = 1e5                             # weight of the second differences of U: it bends over ~STIFF**.25 = 18 units
RAMP = 150.0                            # length over which the left lobe's own vertical fit sets in beside the stem

def _outline():
    """The drawing as glyf points [[(x, y, on_curve)]]: cu2qu at max_err 0.6, outer contour clockwise (TrueType)."""
    rec = RecordingPen(); parse_path(PHI_D, Cu2QuPen(rec, max_err=0.6))     # not reversed: the art is y-down
    f = lambda p, on: ((p[0]-75)*K + 20, (365 - p[1])*K, on)                # the transform of the build, bit for bit
    cs = []
    for op, args in rec.value:
        if op == 'moveTo': cs.append([])
        if op != 'closePath': cs[-1] += [f(p, False) for p in args[:-1]] + [f(args[-1], True)]
        elif cs[-1][-1] == cs[-1][0]: cs[-1].pop()                          # the closing point repeats the start
    return cs

def _basis(P, on, ends):
    """B, D, spans: dense curve samples = B @ points, their steps = D @ points; spans = sample range per contour."""
    I = np.eye(len(P)); B, D, spans, n = [], [], [], 0
    for a, e in zip([0] + ends[:-1], ends):
        for i in range(a, e):
            p, q = a + (i-1-a) % (e-a), a + (i+1-a) % (e-a)                 # neighbours on the contour
            if on[i] and not on[q]: continue                                # that segment belongs to the off-curve q
            s, c, f = I[p] if on[p] else (I[p]+I[i])/2, I[i], I[q] if on[q] else (I[i]+I[q])/2   # implied on-curves
            if on[i]: s, c, f = I[i], (I[i]+I[q])/2, I[q]                   # straight segment i -> q
            m = max(2, int(np.ceil((np.linalg.norm((c-s) @ P) + np.linalg.norm((f-c) @ P))/STEP)))
            t = ((np.arange(m) + .5)/m)[:, None]
            B.append((1-t)**2*s + 2*t*(1-t)*c + t*t*f); D.append((2*(1-t)*(c-s) + 2*t*(f-c))/m)
        spans.append((n, n := sum(map(len, B))))
    return np.vstack(B), np.vstack(D), spans

def _field(P, ends, B, D, spans):
    """Displacement U of every point per unit of (s - 1), and the dense samples at the crotches (steps 1-3)."""
    N = len(P); X, T = B @ P, D @ P; ds = np.hypot(*T.T); T = T/ds[:, None]; nrm = np.c_[-T[:, 1], T[:, 0]]   # outward
    ring = lambda k: np.concatenate([np.roll(np.arange(a, b), -k) for a, b in spans])        # k samples ahead
    # 1. half-thickness: largest disc tangent at the sample holding no other sample, then a cyclic closing
    d = X[None] - X[:, None]; depth = -(d*nrm[:, None]).sum(-1)
    r = np.where(depth > 1e-9, (d*d).sum(-1)/(2*np.maximum(depth, 1e-9)), np.inf).min(1)
    for pick in (np.max, np.min): r = pick([r[ring(k)] for k in range(-int(CLOSE/STEP/2), int(CLOSE/STEP/2) + 1)], 0)
    # 3. crotches: the rigid move M offsets the edges NEAR units away on both sides; it is faded out NEAR..FAR
    u, v = T[ring(-2)], T[ring(2)]; turn = np.degrees(np.arctan2(u[:, 0]*v[:, 1] - u[:, 1]*v[:, 0], (u*v).sum(1)))
    zone, goal, crotch = np.zeros(len(X)), np.zeros((len(X), 2)), []
    for k in np.where((turn > TURN) & (turn >= turn[ring(-1)]) & (turn > turn[ring(1)]))[0]:
        a, b = next(s for s in spans if s[0] <= k < s[1]); arc = np.cumsum(ds[a:b]); L = arc[-1]
        d = (arc - arc[k-a] + L/2) % L - L/2                                # signed distance along the contour
        j = a + np.array([np.abs(d + NEAR).argmin(), np.abs(d - NEAR).argmin()])
        fade = np.clip((FAR - np.abs(d))/(FAR - NEAR), 0, 1); crotch.append(k)
        zone[a:b] = np.maximum(zone[a:b], fade); goal[a:b][fade > 0] = np.linalg.solve(nrm[j], r[j])
    # 2. least squares: normal move = r outside the crotch zones, U = M inside, small second differences everywhere
    wn, z, wz = np.sqrt(ds*(1-zone))[:, None], zone > 0, np.sqrt(ds*zone)[zone > 0]
    Bz = B[z]*wz[:, None]; i = np.arange(N); nx = np.concatenate([np.roll(i[a:e], -1) for a, e in zip([0] + ends[:-1], ends)])
    pv = np.argsort(nx); h = np.maximum(np.hypot(*(P[nx] - P).T), .05); S = np.zeros((N, N))   # next, previous, leg
    S[i, nx] += 1/h; S[i, i] -= 1/h + 1/h[pv]; S[i, pv] += 1/h[pv]; S *= np.sqrt(2*STIFF/(h + h[pv]))[:, None]
    A = np.block([[B*wn*nrm[:, :1], B*wn*nrm[:, 1:]], [Bz, 0*Bz], [0*Bz, Bz], [S, 0*S], [0*S, S]])
    rhs = np.r_[wn[:, 0]*r, wz*goal[z, 0], wz*goal[z, 1], np.zeros(2*N)]
    return np.linalg.lstsq(A, rhs, rcond=None)[0].reshape(2, N).T, crotch

@lru_cache(None)
def _masters():
    cs = _outline(); P = np.array([p[:2] for c in cs for p in c]); on = [p[2] for c in cs for p in c]
    ends = list(np.cumsum([len(c) for c in cs])); B, D, spans = _basis(P, on, ends)
    U, crotch = _field(P, ends, B, D, spans)
    # 4. vertical fit. The open left lobe is the outer contour between its two crotches; it has a top of its own.
    k1, k2, k3 = sorted(k for k in crotch if k < spans[0][1])      # outer contour: bottom-left, inner-left, bottom-right
    c1, c2 = B[k1].argmax(), B[k2].argmax(); lobe = np.zeros(len(B), bool); lobe[k1:k2] = True
    arc = np.r_[0, np.cumsum(np.hypot(*np.diff(P[c1:c2+1], axis=0).T))]; wl = np.zeros(len(P))
    wl[c1:c2+1] = np.clip(np.minimum(arc, arc[-1] - arc)/RAMP, 0, 1)
    def marks(Q):                                                   # y of: stem tip, bottom line, right top, left top
        Y = (B @ Q)[:, 1]; return Y.min(), (Y[k1] + Y[k3])/2, Y[~lobe].max(), Y[lobe].max()
    def fit(Q):
        (t0, b0, r0, l0), (t, b, rt, lt), y = marks(P), marks(Q), Q[:, 1]
        up = lambda top, top0: b0 + (y - b)*(top0 - b0)/(top - b)
        return np.c_[Q[:, 0], np.where(y < b, t0 + (y - t)*(b0 - t0)/(b - t), (1 - wl)*up(rt, r0) + wl*up(lt, l0))]
    return {400: P, **{w: fit(P + (s - 1)*U) for w, s in SCALE.items()}}, on, ends, B, spans, marks

def phi_contours(wght):
    """Glyf-ready contours [[(x, y, on_curve)]], unrounded; exactly the cu2qu drawing at 400; same structure always."""
    M, on, ends = _masters()[:3]; w = min(max(wght, 300), 800)
    P = M[400] + (M[300] - M[400])*(400 - w)/100 if w < 400 else M[400] + (M[800] - M[400])*(w - 400)/400
    return [[(float(x), float(y), o) for (x, y), o in zip(P[a:e], on[a:e])] for a, e in zip([0] + ends[:-1], ends)]

def phi_stats(wght):
    """Measurements of the outline at a weight (font units): bbox, heights, stem / lobe thicknesses, counter widths."""
    M, on, ends, B, spans, marks = _masters()
    Q = np.array([p[:2] for c in phi_contours(wght) for p in c]); X = B @ Q; tip, _, top, ltop = marks(Q)
    def scan(X, y):                                                 # sorted x where the outline crosses a horizontal
        xs = []
        for a, b in spans:
            V, W = X[a:b], np.roll(X[a:b], -1, 0); m = (V[:, 1] > y) != (W[:, 1] > y)
            xs += list(V[m, 0] + (y - V[m, 1])*(W[m, 0] - V[m, 0])/(W[m, 1] - V[m, 1]))
        return np.sort(xs)
    mid, low, desc = scan(X, 261), scan(X, 150), scan(X, -20)       # mid height of the loop, lower stem, descender
    bottom = np.mean([scan(X[:, ::-1], x)[0] for x in (desc[0] - 8, desc[1] + 8)])   # outer loop edge beside the stem
    return dict(bbox=(X[:, 0].min(), tip, X[:, 0].max(), top), tip=tip, loop_bottom=bottom, loop_top=top, left_top=ltop,
                stem_width=low[3] - low[2], left_lobe=mid[1] - mid[0], right_lobe=mid[5] - mid[4],
                left_counter=mid[2] - mid[1], right_counter=mid[4] - mid[3])
