"""Build the lab kit's stylesheet, system/lab-kit/v1/lab.css, and check its colours.

  python3 tools/lab-kit/build.py           # write lab.css and copy the Aphesis Script font next to it
  python3 tools/lab-kit/build.py --check   # stop if lab.css or the font copy is not what this script would write

lab.css is made of, in order:
  1. the @font-face rules, with paths relative to the stylesheet (fonts/), so a pinned copy and the served copy both work
  2. the tokens: every colour, type, spacing, radius, duration and easing token of system/tokens.json, plus the
     data-viz tokens (tokens.json "dataviz"), per theme. A theme can be set on any element, not only the root.
  3. what cannot be written by hand: the stipple masks (square cells, the same tiles lab.js draws into SVG), the φ as
     a mask, and one colour class per data-viz colour
  4. tools/lab-kit/lab_src.css, the components, written by hand with tokens only

Contrast is checked on the way (WCAG 2): every text colour at 4.5:1 or more on bg, every data colour a mark can take
at 3:1 or more, in both themes. The build stops if one fails.
"""
import json, math, os, re, shutil, sys
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SYS = os.path.join(ROOT, 'system')
OUT = os.path.join(SYS, 'lab-kit', 'v1')

TOK = json.load(open(os.path.join(SYS, 'tokens.json'), encoding='utf-8'))
VERSION = TOK['dataviz']['version']


# ---------- colour: oklch -> sRGB, contrast ----------
def oklch_rgb(s):
    L, C, h = (float(v) for v in re.match(r'oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)', s).groups())
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_, m_, s_ = L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s3 = l_ ** 3, m_ ** 3, s_ ** 3
    lin = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s3,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s3,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s3)
    if any(x < -0.001 or x > 1.001 for x in lin):
        sys.exit(f'{s} is outside sRGB: browsers would map it differently; pick a colour inside the gamut')
    gam = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return tuple(max(0, min(255, round(gam(max(0.0, x)) * 255))) for x in lin)


def lum(rgb):
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (f(c / 255) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


TABLE = {t['name']: t['value'] for t in TOK['color']['tokens'] + TOK['dataviz']['color']['tokens']}


def resolve(name, theme):
    v = TABLE[name][theme]
    while v.startswith('{'):
        v = TABLE[v[1:-1]][theme]
    return oklch_rgb(v)


def hexof(rgb):
    return '#%02x%02x%02x' % rgb


TEXT = ['ink', 'ink-soft', 'accent-text', 'lab-axis-text', 'lab-pass', 'lab-fail']
MARKS = [f'lab-cat-{i}' for i in range(1, 9)] + ['lab-mark', 'lab-ref', 'accent']


def check_contrast():
    rows, bad = [], []
    for theme in ('light', 'dark'):
        bg = resolve('bg', theme)
        for names, need, kind in ((TEXT, 4.5, 'text'), (MARKS, 3.0, 'mark')):
            for n in names:
                r = ratio(resolve(n, theme), bg)
                rows.append((theme, kind, n, hexof(resolve(n, theme)), r))
                if r < need:
                    bad.append(f'{n} ({theme}) {r:.2f}:1 < {need}:1')
    return rows, bad


# ---------- stipple tiles (the same generator as lab.js: xorshift32, one cell per 2px, 48px tiles) ----------
DENSITY = {1: 0.16, 2: 0.32, 3: 0.56}
TILE, CELL = 48, 2


def xorshift(seed):
    s = (seed * 2654435761) & 0xffffffff or 1   # spread a small seed over the word, then let it run in
    for _ in range(32):
        s ^= (s << 13) & 0xffffffff; s ^= s >> 17; s ^= (s << 5) & 0xffffffff; s &= 0xffffffff
    while True:
        s ^= (s << 13) & 0xffffffff
        s ^= s >> 17
        s ^= (s << 5) & 0xffffffff
        s &= 0xffffffff
        yield s / 4294967296


def tile_cells(density, seed):
    r = xorshift(seed)
    return [(x, y) for y in range(0, TILE, CELL) for x in range(0, TILE, CELL) if next(r) < density]


def svg_uri(svg):
    return 'url("data:image/svg+xml,' + quote(svg, safe=" =:/'(),.-;") + '")'


def stipple_mask(level):
    d = ''.join(f'M{x} {y}h{CELL}v{CELL}h-{CELL}z' for x, y in tile_cells(DENSITY[level], 1000 + level))
    return svg_uri(f"<svg xmlns='http://www.w3.org/2000/svg' width='{TILE}' height='{TILE}' shape-rendering='crispEdges'><path d='{d}'/></svg>")


def ring_mask():
    """a square ring of cells, 14px: the honesty table's mark for 'tested'"""
    cells = [(x, y) for y in range(0, 14, 2) for x in range(0, 14, 2) if x in (0, 12) or y in (0, 12)]
    d = ''.join(f'M{x} {y}h2v2h-2z' for x, y in cells)
    return svg_uri(f"<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' shape-rendering='crispEdges'><path d='{d}'/></svg>")


def phi_mask():
    svg = open(os.path.join(SYS, 'assets', 'Logos', 'phi.svg'), encoding='utf-8').read()
    vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
    d = re.search(r'<path[^>]*\sd="([^"]+)"', svg).group(1)
    return svg_uri(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='{vb}'><path fill-rule='evenodd' d='{d}'/></svg>")


# ---------- the stylesheet ----------
def var(v):
    return re.sub(r'\{([\w-]+)\}', r'var(--\1)', v)


def faces():
    return ('@font-face{font-family:"Aphesis Script";src:url("fonts/AphesisScript-VF.woff2") format("woff2");font-weight:300 800;font-display:swap}\n'
            '@font-face{font-family:"Special Elite";src:url("fonts/SpecialElite-latin.woff2") format("woff2");font-display:swap;'
            'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n'
            '@font-face{font-family:"Special Elite";src:url("fonts/SpecialElite-latin-ext.woff2") format("woff2");font-display:swap;'
            'unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}\n')


def tokens():
    colors = TOK['color']['tokens'] + TOK['dataviz']['color']['tokens']
    light = [f'--{t["name"]}:{var(t["value"]["light"])}' for t in colors]
    dark = [f'--{t["name"]}:{var(t["value"]["dark"])}' for t in colors if t['value']['dark'] != t['value']['light']]
    # a token that is the same in both themes but points at one that is not must be restated in dark, so that a
    # nested theme (an element with data-theme) resolves it against its own values
    other = [f'--font-{k}:{v}' for k, v in TOK['type']['families'].items()]
    for g in TOK['type']['groups']:
        for s in g['styles']:
            n = s['name']
            other += [f'--type-{n}-size:{s["fontSize"]}', f'--type-{n}-line:{s["lineHeight"]}', f'--type-{n}-weight:{s["fontWeight"]}']
            if 'letterSpacing' in s:
                other.append(f'--type-{n}-tracking:{s["letterSpacing"]}')
    for group in ('spacing', 'radius', 'duration', 'easing'):
        other += [f'--{t["name"]}:{t["value"]}' for t in TOK[group]['tokens']]
    other += [f'--{t["name"]}:{t["value"]}' for t in TOK['dataviz']['size']]
    refs = [f'--{t["name"]}:{var(t["value"]["light"])}' for t in colors
            if t['value']['dark'] == t['value']['light'] and t['value']['light'].startswith('{')]
    L = ';'.join(light) + ';color-scheme:light'
    D = ';'.join(dark + refs) + ';color-scheme:dark'
    return ('/* tokens (system/tokens.json). Light by default; dark follows the system unless data-theme says otherwise.\n'
            '   data-theme="light" | "dark" works on the root and on any element inside it. */\n'
            ':root{' + ';'.join(other) + '}\n'
            ':root,[data-theme="light"]{' + L + '}\n'
            '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + D + '}}\n'
            '[data-theme="dark"]{' + D + '}\n'
            '@media print{:root,[data-theme]{' + L + '}}\n')


def generated():
    out = ['/* stipple: square cells as masks (lab.js draws the same tiles into SVG). Paint the colour, mask the cells. */',
           ':root{' + ';'.join(f'--lab-stipple-{k}:{stipple_mask(k)}' for k in DENSITY) + f';--lab-ring:{ring_mask()}' + '}',
           '/* the φ, as drawn (system/assets/Logos/phi.svg), painted in seal */',
           ':root{--lab-phi:' + phi_mask() + '}',
           '/* colour classes: each sets --lab-k, which every mark, key and swatch of the kit paints with */']
    cls = [f'.lab-c{i}{{--lab-k:var(--lab-cat-{i})}}' for i in range(1, 9)]
    cls += [f'.lab-s{i}{{--lab-k:var(--lab-seq-{i})}}' for i in range(1, 8)]
    cls += [f'.lab-d{i}{{--lab-k:var(--lab-div-{i})}}' for i in range(1, 8)]
    cls += ['.lab-ink{--lab-k:var(--lab-mark)}', '.lab-soft{--lab-k:var(--ink-soft)}', '.lab-dim{--lab-k:var(--lab-dim)}',
            '.lab-accent{--lab-k:var(--lab-ref)}']
    out.append(''.join(cls))
    return '\n'.join(out) + '\n'


def build():
    head = (f'/* aphes.ist lab kit {VERSION}: the design system for research viewers. https://aphes.ist/lab-kit/v1/\n'
            '   Generated by tools/lab-kit/build.py on the design-system branch from system/tokens.json and\n'
            '   tools/lab-kit/lab_src.css: change those and rebuild, never this file. */\n')
    src = open(os.path.join(HERE, 'lab_src.css'), encoding='utf-8').read()
    return head + faces() + tokens() + generated() + src


def main():
    rows, bad = check_contrast()
    for theme, kind, n, hx, r in rows:
        print(f'  {theme:5} {kind:4} {n:14} {hx} {r:5.2f}:1', file=sys.stderr)
    if bad:
        sys.exit('contrast below WCAG AA:\n  ' + '\n  '.join(bad))
    css = build()
    font_src = os.path.join(SYS, 'fonts', 'AphesisScript-VF.woff2')
    font_dst = os.path.join(OUT, 'fonts', 'AphesisScript-VF.woff2')
    css_dst = os.path.join(OUT, 'lab.css')
    if '--check' in sys.argv:
        stale = []
        if not os.path.exists(css_dst) or open(css_dst, encoding='utf-8').read() != css:
            stale.append('lab.css')
        if not os.path.exists(font_dst) or open(font_dst, 'rb').read() != open(font_src, 'rb').read():
            stale.append('fonts/AphesisScript-VF.woff2')
        js = open(os.path.join(OUT, 'lab.js'), encoding='utf-8').read()
        if f"VERSION = '{VERSION}'" not in js:
            stale.append(f'lab.js (VERSION is not {VERSION})')
        if stale:
            sys.exit('out of date, run python3 tools/lab-kit/build.py: ' + ', '.join(stale))
        print('lab kit up to date', VERSION)
        return
    os.makedirs(os.path.dirname(font_dst), exist_ok=True)
    shutil.copyfile(font_src, font_dst)
    open(css_dst, 'w', encoding='utf-8').write(css)
    print(css_dst, len(css))


if __name__ == '__main__':
    main()
