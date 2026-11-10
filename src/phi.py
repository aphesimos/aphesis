"""Aphesis Script — the φ. The original hand drawing, upright in every master.

Two things are done to it, and nothing else:
  · it is translated 29 units down. Its loop (480 units tall) defines the round x-height band of the
    whole family, so it must overshoot the baseline exactly like a round letter (loop: −8 … 472);
  · it follows the weight axis (phi_weight.py): at wght 400 the outline is the drawing, point for
    point; at 300 and 800 the same points are moved so the local stroke thickness matches the
    letters' brush. Set FOLLOW_WEIGHT = False to keep it static."""
import numpy as np
import phi_weight

PHI_DY = -29                    # loop bottom 21 → −8 (round overshoot); loop top 501 → 472 = XH + OV
FOLLOW_WEIGHT = True

_C = {}
def contours(wght=400):
    """glyf-ready point lists [[(x, y, on_curve), …]], outer contour clockwise — the same structure
    in every master."""
    w = float(wght) if FOLLOW_WEIGHT else 400.0
    if w not in _C:
        _C[w] = [[(x, y + PHI_DY, on) for x, y, on in c] for c in phi_weight.phi_contours(w)]
    return _C[w]

def polygons(wght=400, steps=6):
    """The same outline flattened to polygons (for measuring and previews)."""
    out = []
    for c in contours(wght):
        n = len(c); pts = []
        for i, (x, y, on) in enumerate(c):
            if on: pts.append((x, y)); continue
            (px, py, pon), (qx, qy, qon) = c[i - 1], c[(i + 1) % n]            # off-curve: a quadratic around it
            a = (px, py) if pon else ((px + x) / 2, (py + y) / 2)
            b = (qx, qy) if qon else ((qx + x) / 2, (qy + y) / 2)
            ts = np.linspace(0, 1, steps + 1)[1:]                             # the start is already there;
            for t in (ts[:-1] if qon else ts):                               # an on-curve end adds itself
                pts.append(((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * x + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * y + t * t * b[1]))
        out.append(np.array(pts, float))
    return out
