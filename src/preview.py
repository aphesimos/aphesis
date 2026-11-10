"""Aphesis Script — drawing preview (PNG). Not part of the font build; needs Pillow.

  python3 preview.py --glyphs "n o a" [--wght 400] [--slnt 0] [--v 0] [--skel] [--out sheet.png]
  python3 preview.py --text "hamburgefontsiv" [--wght 400] [--slnt 0] [--calt] [--out line.png]
  python3 preview.py --glyphs "n o" --weights 300,400,800      (one row per weight)

--glyphs shows each glyph large on the metric lines (red = baseline / x-height / ascender /
descender, grey = overshoot lines), with --skel the control points and centreline are drawn too.
--text sets a line with the spacing engine (spacing.py) if available, else with a flat gap.
Glyph names: single characters, or names separated by spaces ("n o period a.1")."""
import argparse, sys, os, math
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brush as B
from registry import load_glyphs, glyph_polys, NAMES

def raster_union(polys, scale, ox, oy, W, H, im=None, fill=(24, 22, 22), ss=2):
    """Fill a glyph the way a font rasteriser does: NON-ZERO winding over all its contours together
    (overlapping strokes merge, a stroke crossing itself stays solid, counter-clockwise contours
    cut counters). Pillow's own polygon fill is even-odd and would show false holes."""
    im = im or Image.new('RGB', (W, H), 'white')
    Ws, Hs = W * ss, H * ss
    X0, Y0, X1, Y1 = [], [], [], []
    for P in polys:
        px = (P[:, 0] + ox) * scale * ss; py = (oy - P[:, 1]) * scale * ss
        X0.append(px); Y0.append(py); X1.append(np.roll(px, -1)); Y1.append(np.roll(py, -1))
    x0, y0, x1, y1 = map(np.concatenate, (X0, Y0, X1, Y1))
    lo = max(0, int(np.floor(min(y0.min(), y1.min())))); hi = min(Hs, int(np.ceil(max(y0.max(), y1.max()))) + 1)
    mask = np.zeros((Hs, Ws), bool)
    rows = np.arange(lo, hi) + 0.5
    ya, yb = np.minimum(y0, y1), np.maximum(y0, y1)
    hit = (rows[:, None] >= ya[None, :]) & (rows[:, None] < yb[None, :])
    with np.errstate(divide='ignore', invalid='ignore'):
        xs = x0[None, :] + (rows[:, None] - y0[None, :]) / (y1 - y0)[None, :] * (x1 - x0)[None, :]
    dirn = np.where(y1 > y0, 1, -1)
    for r in range(len(rows)):
        h = hit[r]
        if not h.any(): continue
        xr = xs[r, h]; dr = dirn[h]; o = np.argsort(xr); xr = xr[o]; w = np.cumsum(dr[o])
        for k in range(len(xr) - 1):
            if w[k] != 0:
                a, b = max(int(round(xr[k])), 0), min(int(round(xr[k + 1])), Ws)
                if b > a: mask[lo + r, a:b] = True
    cov = mask.reshape(H, ss, W, ss).mean(axis=(1, 3))
    arr = np.asarray(im).astype(float)
    arr = arr * (1 - cov[..., None]) + np.array(fill, float) * cov[..., None]
    out = Image.fromarray(arr.astype(np.uint8)); im.paste(out)
    return im

def guides(d, scale, oy, W, x0=0):
    def line(y, col): d.line([(x0, (oy - y) * scale), (W, (oy - y) * scale)], fill=col, width=1)
    for y in (0, B.XH, B.ASC, B.DESC): line(y, (235, 80, 70))
    for y in (-B.OV, B.XH + B.OV): line(y, (170, 170, 170))
    line(B.FIG, (120, 160, 230)); line(B.MARK, (200, 200, 235))

def sheet(names, wght, slnt, v, skel, scale, G):
    cellw, pad = 620, 40
    ymax, ymin = B.ASC + 70, B.DESC - 60
    W = int((cellw * len(names) + pad) * scale); H = int((ymax - ymin) * scale)
    im = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(im)
    guides(d, scale, ymax, W)
    for i, nm in enumerate(names):
        polys = glyph_polys(G, nm, wght, slnt, v)
        allp = np.vstack(polys); x0 = allp[:, 0].min()
        ox = pad + i * cellw - x0 + 60
        raster_union(polys, scale, ox, ymax, W, H, im)
        d = ImageDraw.Draw(im)
        if skel and nm in G and 'strokes' in G[nm]:
            H_ = B.hx(wght)
            for st in B.vary(G[nm]['strokes'], v, B.glyph_seed(nm)):
                pts = [(p[0] * H_, p[1] if len(p) > 2 else float(B.vremap(p[1], wght))) for p in st['pts']]
                c = B.shear(B.catmull(pts), slnt)
                d.line([((x + ox) * scale, (ymax - y) * scale) for x, y in c], fill=(255, 60, 60), width=1)
                for (x, y) in B.shear(np.array(pts, float), slnt):
                    X, Y = (x + ox) * scale, (ymax - y) * scale
                    d.ellipse([X - 3, Y - 3, X + 3, Y + 3], outline=(0, 90, 255))
        d.text(((pad + i * cellw + 8) * scale, 6), f"{nm}  w{wght} s{slnt} v{v}  x:{allp[:,0].min():.0f}..{allp[:,0].max():.0f} y:{allp[:,1].min():.0f}..{allp[:,1].max():.0f}", fill=(0, 0, 0))
    return im

def text_line(text, wght, slnt, scale, G, calt=False, pad=60):
    try:
        import spacing
        lay = spacing.layout(G, text, wght, slnt, calt=calt)      # [(name, v, x_offset)], total advance
    except Exception as e:                                            # engine not there yet: flat gaps
        lay, x = [], 0
        for ch in text:
            nm = NAMES.get(ch, ch)
            if ch == ' ': x += 220; continue
            polys = glyph_polys(G, nm, wght, 0, 0); allp = np.vstack(polys)
            lay.append((nm, 0, x - allp[:, 0].min())); x += allp[:, 0].max() - allp[:, 0].min() + 70
        lay = (lay, x)
    items, total = lay
    ymax, ymin = B.ASC + 60, B.DESC - 50
    W = int((total + 2 * pad) * scale); H = int((ymax - ymin) * scale)
    im = Image.new('RGB', (W, H), 'white')
    for nm, v, xo in items:
        raster_union(glyph_polys(G, nm, wght, slnt, v), scale, pad + xo, ymax, W, H, im)
    return im

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--glyphs'); ap.add_argument('--text'); ap.add_argument('--out', default='preview.png')
    ap.add_argument('--wght', type=float, default=400); ap.add_argument('--slnt', type=float, default=0)
    ap.add_argument('--weights'); ap.add_argument('--v', type=int, default=0)
    ap.add_argument('--skel', action='store_true'); ap.add_argument('--calt', action='store_true')
    ap.add_argument('--scale', type=float, default=None)
    a = ap.parse_args()
    G = load_glyphs()
    weights = [float(w) for w in a.weights.split(',')] if a.weights else [a.wght]
    rows = []
    for w in weights:
        if a.glyphs:
            names = [NAMES.get(t, t) for t in a.glyphs.split()]
            rows.append(sheet(names, w, a.slnt, a.v, a.skel, a.scale or 0.5, G))
        else:
            rows.append(text_line(a.text, w, a.slnt, a.scale or 0.3, G, a.calt))
    W = max(r.width for r in rows); H = sum(r.height for r in rows)
    out = Image.new('RGB', (W, H), 'white'); y = 0
    for r in rows: out.paste(r, (0, y)); y += r.height
    out.save(a.out); print(a.out, out.size)
