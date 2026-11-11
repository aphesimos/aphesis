"""Make the site's static icons from the closed Φ, the corner seal's form, as the seal engine draws it.

  python3 site/tools/make_icons.py

Writes into site/public/:
  apple-touch-icon.png  180 x 180, the Φ in red on the dark ground (n-975), with a margin
  icon-512.png          512 x 512, the same, for the manifest
  og-card.png           1200 x 630, the same Φ on the same ground, centred: the image of a link preview (og:image)
  favicon.ico           16, 32 and 48, the Φ in red on a transparent ground (the fallback for browsers without SVG icons)
  site.webmanifest      the name and the two colours, from the tokens

The Φ comes from the `mark` branch (engine/model.js and engine/core.js, run with node), in its closed state: the same
geometry the shell paints in the corner. The engine's path is polygons (M, L, Z), filled with the nonzero rule at 8x and
brought down, so the edges are soft at every size. Red is rubedo in the dark theme, which reads on light and dark grounds.
The tab icon itself is the eye, drawn live by the shell (src/shell.js, favicon).
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tokens as T

D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WT = os.path.dirname(D)
OUT = os.path.join(D, 'public')

JS = r"""
const {execSync} = require('child_process');
const g = (p) => execSync('git -C ' + JSON.stringify(process.argv[1]) + ' show mark:' + p).toString();
const d = new Function(g('engine/model.js') + '\n' + g('engine/core.js') +
  "\nreturn caminho(geometria({te: TFIN, r: 'onda', p2: 1, sl: DELTA, hs: NS_ - 1, ponta: 'atravessa', ...posicao(1, 'isolada')}));")();
process.stdout.write(d);
"""


def phi_polygons():
    d = subprocess.run(['node', '-e', JS, WT], capture_output=True, check=True, text=True).stdout
    polys, cur = [], None
    for tok in d.replace('M', ' M ').replace('L', ' L ').replace('Z', ' Z ').split():
        if tok == 'M':
            cur = []; polys.append(cur); mode = 'x'
        elif tok in ('L', 'Z'):
            mode = 'x'
        elif mode == 'x':
            x = float(tok); mode = 'y'
        else:
            cur.append((x, float(tok))); mode = 'x'
    return [p for p in polys if len(p) > 2]


def fill_nonzero(polys, S):
    """fill polygons with the nonzero rule (as the browser fills the seal's path), on an S x S grid"""
    rows = [[] for _ in range(S)]
    for p in polys:
        P = np.array(p + [p[0]], dtype=np.float64)
        for (x0, y0), (x1, y1) in zip(P[:-1], P[1:]):
            if y0 == y1:
                continue
            w = 1 if y1 > y0 else -1
            lo, hi = (y0, y1) if y0 < y1 else (y1, y0)
            ys = np.arange(max(0, int(np.ceil(lo - 0.5))), min(S, int(np.ceil(hi - 0.5))))
            if not len(ys):
                continue
            yc = ys + 0.5
            xs = x0 + (yc - y0) * (x1 - x0) / (y1 - y0)
            for y, x in zip(ys, xs):
                rows[y].append((x, w))
    m = np.zeros((S, S), dtype=np.uint8)
    for y, r in enumerate(rows):
        if not r:
            continue
        r.sort(); wind = 0
        for (xa, wa), (xb, _) in zip(r, r[1:] + [(S, 0)]):
            wind += wa
            if wind:
                m[y, max(0, int(round(xa))):max(0, min(S, int(round(xb))))] = 255
    return Image.fromarray(m, 'L')


def mask(polys, size, margin, ss=8):
    """the Φ as an alpha mask, size x size, fitted inside the margin (a share of the size)"""
    xs = [x for p in polys for x, _ in p]; ys = [y for p in polys for _, y in p]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    S = size * ss; box = S * (1 - 2 * margin); k = box / max(x1 - x0, y1 - y0)
    ox, oy = (S - (x1 - x0) * k) / 2 - x0 * k, (S - (y1 - y0) * k) / 2 - y0 * k
    return fill_nonzero([[(ox + x * k, oy + y * k) for x, y in p] for p in polys], S).resize((size, size), Image.LANCZOS)


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def main():
    tok = T.tokens()
    red, ground = hexrgb(T.color('rubedo', 'dark', tok)), hexrgb(T.color('n-975', 'dark', tok))
    polys = phi_polygons()
    os.makedirs(OUT, exist_ok=True)

    def tile(size, margin, bg):
        m = mask(polys, size, margin)
        im = Image.new('RGBA', (size, size), bg + (255,) if bg else (0, 0, 0, 0))
        im.paste(Image.new('RGBA', (size, size), red + (255,)), (0, 0), m)
        return im

    tile(180, 0.17, ground).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'), optimize=True)
    tile(512, 0.17, ground).convert('RGB').save(os.path.join(OUT, 'icon-512.png'), optimize=True)
    # the link preview's card: the 512 icon's Φ, at the card's height with the same margin, centred on the ground
    card = Image.new('RGB', (1200, 630), ground)
    card.paste(tile(630, 0.17, ground).convert('RGB'), ((1200 - 630) // 2, 0))
    card.save(os.path.join(OUT, 'og-card.png'), optimize=True)
    ico = [tile(s, 0.04, None) for s in (16, 32, 48)]
    ico[2].save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:2])
    manifest = {
        'name': 'aphes.ist', 'short_name': 'aphes.ist', 'start_url': '/', 'display': 'standalone',
        'background_color': T.color('n-975', 'dark', tok), 'theme_color': T.color('n-975', 'dark', tok),
        'icons': [{'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                  {'src': '/apple-touch-icon.png', 'sizes': '180x180', 'type': 'image/png'}],
    }
    open(os.path.join(OUT, 'site.webmanifest'), 'w').write(json.dumps(manifest, indent=1) + '\n')
    print('icons written to', OUT)


if __name__ == '__main__':
    main()
