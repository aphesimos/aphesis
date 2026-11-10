#!/usr/bin/env python3
"""
Animated SVGs for the aphes.is READMEs, in both themes (assets/readme/<name>-{light,dark}.svg).

Everything follows the design system: the stippled fog, the φ drawn by hand, the brush icons, Aphesis Script for the
wordmark, titles and glosses (slant -12), Special Elite for text, rubedo red only for the seal and moments of impact.
Nothing is solid: areas are stipple, marks are brush.

GitHub shows a README's SVG as an image: SMIL and CSS animations run, scripts and external files do not. So the two
fonts are embedded as small subsets (only the characters each image uses) and every graphic is inline.

Inputs (pass with flags or keep the defaults, which point at checkouts of the other branches):
  --tokens   design-system: system/tokens.json
  --marks    marks.json: brush icon paths and the φ, exported from system/components/bundle.js (see tools/readme/README.md)
  --aphesis  font: dist/variable/AphesisScript-VF.ttf
  --elite    Special Elite TTF (Apache 2.0, from Google Fonts)
  --maps     design-system: system/assets/Simulacra (density maps)
  --out      output folder

Greek glosses (ἄδυτον, ἀγορά) are drawn only when the Aphesis Script file has the glyphs; until the Greek extension
lands they are left out and the generator says so. Run it again once the font is updated.
"""
import argparse, base64, io, json, math, os, random, re, sys
import numpy as np
from fontTools.ttLib import TTFont
from fontTools import subset as ftsubset
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--tokens', default=os.path.join(HERE, 'tokens.json'))
ap.add_argument('--marks', default=os.path.join(HERE, 'marks.json'))
ap.add_argument('--aphesis', default=os.path.join(HERE, 'AphesisScript-VF.ttf'))
ap.add_argument('--elite', default=os.path.join(HERE, 'SpecialElite.ttf'))
ap.add_argument('--maps', default=os.path.join(HERE, 'maps'))
ap.add_argument('--out', default=os.path.join(HERE, 'out'))
ARGS = ap.parse_args()
os.makedirs(ARGS.out, exist_ok=True)

# ------------------------------------------------------------------ colors (oklch from tokens.json -> hex)
def oklch_hex(s):
    L, C, h = [float(x) for x in re.findall(r'[\d.]+', s)[:3]]
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_, m_, s_ = L + .3963377774 * a + .2158037573 * b, L - .1055613458 * a - .0638541728 * b, L - .0894841775 * a - 1.2914855480 * b
    l, m, s3 = l_ ** 3, m_ ** 3, s_ ** 3
    rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s3, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s3, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s3]
    enc = lambda u: 12.92 * u if u <= .0031308 else 1.055 * u ** (1 / 2.4) - .055
    return '#' + ''.join('%02x' % round(max(0, min(1, enc(max(0, c)))) * 255) for c in rgb)

TOK = json.load(open(ARGS.tokens))
def theme(tid):
    raw = {t['name']: t['value'][tid] for t in TOK['color']['tokens']}
    res = lambda v: res(raw[v[1:-1]]) if v.startswith('{') else v
    return {k: oklch_hex(res(v)) for k, v in raw.items()}
THEMES = {'light': theme('light'), 'dark': theme('dark')}
NEUTRAL = [t['name'] for t in TOK['color']['tokens'] if t['name'].startswith('n-')]

# ------------------------------------------------------------------ fonts
APH, ELITE = TTFont(ARGS.aphesis), TTFont(ARGS.elite)
APH_CMAP, ELITE_CMAP = APH.getBestCmap(), ELITE.getBestCmap()
def has_glyphs(txt, cmap=APH_CMAP):
    return all(ord(c) in cmap or c in ' ' for c in txt)

def font_face(path, family, text, variable=False):
    """woff2 subset of `path` holding only `text`, as an @font-face rule."""
    opts = ftsubset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.notdef_outline = True
    opts.name_IDs = ['*']; opts.hinting = False
    f = TTFont(path)
    sub = ftsubset.Subsetter(opts); sub.populate(text=''.join(sorted(set(text + ' ')))); sub.subset(f)
    buf = io.BytesIO(); f.flavor = 'woff2'; f.save(buf)
    rng = 'font-weight:300 800;' if variable else ''
    return "@font-face{font-family:'%s';src:url(data:font/woff2;base64,%s) format('woff2');%s}" % (family, base64.b64encode(buf.getvalue()).decode(), rng)

def advance(text, size, font=ELITE, cmap=ELITE_CMAP, spacing=0):
    """advance widths for each character (Special Elite), for typing animations and centering"""
    upm = font['head'].unitsPerEm; hm = font['hmtx']; out = []
    for c in text:
        g = cmap.get(ord(c)); w = hm[g][0] if g else upm * .5
        out.append(w / upm * size + spacing)
    return out

MARKS = json.load(open(ARGS.marks))
PHI = MARKS['phi']

def f(v): return ('%.2f' % v).rstrip('0').rstrip('.')

# ------------------------------------------------------------------ stipple
def value_noise(w, h, scale, seed):
    rng = np.random.default_rng(seed)
    gw, gh = int(w / scale) + 3, int(h / scale) + 3
    g = rng.random((gh, gw))
    ys, xs = np.mgrid[0:h, 0:w] / scale
    x0, y0 = xs.astype(int), ys.astype(int); fx, fy = xs - x0, ys - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = g[y0, x0], g[y0, x0 + 1], g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy

def fbm(w, h, scale, seed, octaves=4):
    s, a, tot = 0, 1, 0
    for o in range(octaves):
        s = s + a * value_noise(w, h, scale / 2 ** o, seed + o * 17); tot += a; a *= .5
    return s / tot

def smooth(e0, e1, x): t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def squares(dens, cell, seed, ox=0, oy=0, jitter=0.0):
    """stipple path: a square cell wherever density beats a fixed per-cell threshold (blue-ish noise + hash)"""
    rng = np.random.default_rng(seed); h, w = dens.shape
    yy, xx = np.mgrid[0:h, 0:w]
    ign = np.mod(52.9829189 * np.mod(xx * .06711056 + yy * .00583715, 1), 1)
    thr = .65 * ign + .35 * rng.random((h, w))
    ys, xs = np.nonzero(dens > thr)
    s = max(1, round(cell * .78))
    out = []
    for y, x in zip(ys, xs):
        jx = rng.uniform(-jitter, jitter) if jitter else 0; jy = rng.uniform(-jitter, jitter) if jitter else 0
        out.append('M%d %dh%dv%dh-%dz' % (round(ox + x * cell + jx), round(oy + y * cell + jy), s, s, s))
    return ''.join(out)

def fog_layers(W, H, cell, seed, calm=(), amount=1.0, n=3):
    """n fog layers (same field, drifted) that cross-fade, so the fog seems to move. calm: ellipses (cx, cy, rx, ry)."""
    w, h = W // cell + 1, H // cell + 1
    ys, xs = np.mgrid[0:h, 0:w] * cell
    mask = np.ones((h, w))
    for cx, cy, rx, ry in calm:
        q = np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
        mask *= 1 - .88 * (1 - smooth(.55, 1.05, q))
    paths = []
    big = fbm(w + 40, h + 20, 22, seed)
    for i in range(n):
        d = big[i * 5: i * 5 + h, i * 9: i * 9 + w]
        dens = (smooth(.46, .74, d) * .55 + .015) * mask * amount
        paths.append(squares(dens, cell, seed + i))
    return paths

def fog_svg(paths, color, dur=18, opacity=.55):
    """the layers fade one into the next in a loop"""
    n = len(paths); out = []
    for i, p in enumerate(paths):
        vals = ['0'] * (n + 1); vals[i] = vals[(i + 1) % n] = '0'
        kt = ';'.join(f(k / n) for k in range(n + 1))
        v = []
        for k in range(n + 1):
            v.append('1' if (k % n) == i else '0')
        out.append('<path d="%s" fill="%s" opacity="%s"><animate attributeName="fill-opacity" dur="%ss" repeatCount="indefinite" calcMode="spline" keyTimes="%s" values="%s" keySplines="%s"/></path>'
                   % (p, color, opacity, dur, kt, ';'.join(v), ';'.join(['.45 0 .55 1'] * n)))
    return ''.join(out)

# ------------------------------------------------------------------ pieces
def phi_group(x, y, h, color, draw=True, dur=14, boil=True, fid='boil'):
    """the φ at (x, y) top-left, h tall. draw: revealed stroke by stroke through a mask that follows the pen."""
    vb = [float(v) for v in PHI['viewBox'].split()]
    s = h / vb[3]; tx, ty = x - vb[0] * s, y - vb[1] * s
    filt = ('<filter id="%s" x="-5%%" y="-5%%" width="110%%" height="110%%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="1" seed="2">'
            '<animate attributeName="seed" dur="1s" repeatCount="indefinite" calcMode="discrete" values="2;7;13;21;34;55;89;144"/></feTurbulence>'
            '<feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>' % fid) if boil else ''
    mask = ''; fade = ''
    if draw:
        # the pen, in the engine's order: the stem from top to bottom, then the ring swept around its centre, starting
        # just right of the stem and ending at the free tip on the upper left (art coordinates of phi.svg).
        # The ring is revealed as a growing pie: a circle of radius R/2 stroked R wide, its dash opening clockwise.
        cxr, cyr, R = 262, 172, 230; r = R / 2; L = 2 * math.pi * r
        k = lambda a, b, c, d: 'keyTimes="0;%s;%s;.95;1" values="%s;%s;%s;%s;%s"' % (f(a), f(b), c, c, d, d, c)
        stem = ('<path d="M262 -40 L262 540" fill="none" stroke="#fff" stroke-width="46" pathLength="1" stroke-dasharray="1 1">'
                '<animate attributeName="stroke-dashoffset" dur="%ss" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;.45 0 .25 1;0 0 1 1;0 0 1 1" %s/></path>' % (dur, k(.03, .14, 1, 0)))
        ring = ('<circle cx="%s" cy="%s" r="%s" fill="none" stroke="#fff" stroke-width="%s" stroke-dasharray="%s %s" transform="rotate(-76 %s %s)">'
                '<animate attributeName="stroke-dashoffset" dur="%ss" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;.4 0 .3 1;0 0 1 1;0 0 1 1" %s/></circle>'
                % (cxr, cyr, f(r), R, f(L), f(L), cxr, cyr, dur, k(.15, .40, f(L), 0)))
        mask = ('<filter id="soft" x="-20%%" y="-20%%" width="140%%" height="140%%"><feGaussianBlur stdDeviation="12"/></filter>'
                '<mask id="pen" maskUnits="userSpaceOnUse" x="%s" y="%s" width="%s" height="%s">%s<g filter="url(#soft)">%s</g></mask>' % (f(vb[0] - 80), f(vb[1] - 80), f(vb[2] + 160), f(vb[3] + 160), stem, ring))
        fade = '<animate attributeName="opacity" dur="%ss" repeatCount="indefinite" keyTimes="0;.86;.93;1" values="1;1;0;0"/>' % dur
    return ('<defs>%s%s</defs><g transform="translate(%s %s) scale(%s)">%s<path d="%s" fill="%s" fill-rule="evenodd"%s%s/></g>'
            % (filt, mask, f(tx), f(ty), f(s), fade, PHI['d'], color, ' filter="url(#%s)"' % fid if boil else '', ' mask="url(#pen)"' if draw else ''))

def icon(name, x, y, size, color, inner=''):
    g = MARKS[name]; s = size / 24
    return '<g transform="translate(%s %s) scale(%s)">%s<path d="%s" fill="%s"/>%s</g>' % (f(x), f(y), f(s), inner, g['strokes'], color,
                                                                                         '<path d="%s" fill="%s" opacity=".85"/>' % (g['dots'], color) if g['dots'] else '')

def typed(text, x, y, size, color, dur, start, hold, cls='elite halo-s', anchor='start', spacing=0, erase=True):
    """types `text` one character at a time like the Typist (uneven rhythm), holds, then erases word by word"""
    adv = advance(text, size, spacing=spacing); total = sum(adv)
    if anchor == 'end': x -= total
    if anchor == 'middle': x -= total / 2
    rng = random.Random(len(text) * 7 + int(size)); t = start; times = []
    for i, c in enumerate(text):
        t += .055 * math.exp(rng.gauss(0, .32)) * (1.4 if (i and text[i - 1] == ' ') else 1); times.append(t)
    end = t + hold; out = []; cx = x
    words = []; wi = 0
    for i, c in enumerate(text):
        if c == ' ': wi += 1
        words.append(wi)
    nw = max(words) + 1
    for i, c in enumerate(text):
        if c != ' ':
            gone = end + (nw - 1 - words[i]) * .16 if erase else dur - .01
            kt = [0, times[i] / dur, min(.999, times[i] / dur + .0005), min(.9995, gone / dur), min(.9999, gone / dur + .0005), 1]
            kt = [kt[0]] + [max(kt[j], kt[j - 1] + 1e-4) for j in range(1, len(kt))]
            out.append('<text x="%s" y="%s" class="%s" fill="%s" fill-opacity="0">%s<animate attributeName="fill-opacity" dur="%ss" repeatCount="indefinite" keyTimes="%s" values="0;0;1;1;0;0"/></text>'
                       % (f(cx), f(y), cls, color, c.replace('&', '&amp;').replace('<', '&lt;'), dur, ';'.join(f(min(1, k)) if k < 1 else '1' for k in kt)))
        cx += adv[i]
    # caret
    caret_x = ['%s' % f(x + sum(adv[:i + 1])) for i in range(len(text))]
    on, off = max(0, start - .25) / dur, min(.999, (end + nw * .16 + .3) / dur)
    out.append('<rect y="%s" width="%s" height="%s" fill="%s" opacity=".75" x="%s" visibility="hidden"><animate attributeName="x" dur="%ss" repeatCount="indefinite" calcMode="discrete" keyTimes="0;%s;1" values="%s;%s;%s"/>'
               '<animate attributeName="visibility" dur="%ss" repeatCount="indefinite" calcMode="discrete" keyTimes="0;%s;%s" values="hidden;visible;hidden"/>'
               '<animate attributeName="opacity" dur="1.06s" repeatCount="indefinite" calcMode="discrete" values=".75;0"/></rect>'
               % (f(y - size * .78), f(size * .55), f(size * .95), color, f(x), dur, ';'.join(f(tt / dur) for tt in times), f(x), ';'.join(caret_x), caret_x[-1], dur, f(on), f(off)))
    return ''.join(out)

def svg(name, W, H, body_fn, aph_text='', elite_text='', title=''):
    for tid, T in THEMES.items():
        css = []
        if aph_text: css.append(font_face(ARGS.aphesis, 'Aphesis Script', aph_text, variable=True))
        if elite_text: css.append(font_face(ARGS.elite, 'Special Elite', elite_text))
        css.append(".aph{font-family:'Aphesis Script',serif;font-variation-settings:'wght' 400,'slnt' -12}"
                   ".aphu{font-family:'Aphesis Script',serif;font-variation-settings:'wght' 400,'slnt' 0}"
                   ".elite{font-family:'Special Elite',monospace}"
                   ".halo{paint-order:stroke;stroke:%s;stroke-width:7px;stroke-linejoin:round;stroke-opacity:.92}.halo-s{paint-order:stroke;stroke:%s;stroke-width:2.5px;stroke-linejoin:round}" % (T['bg'], T['bg']))
        body = body_fn(T, tid)
        doc = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"><title>%s</title><style>%s</style>'
               '<rect width="%d" height="%d" fill="%s"/>%s</svg>' % (W, H, W, H, title, ''.join(css), W, H, T['bg'], body))
        p = os.path.join(ARGS.out, '%s-%s.svg' % (name, tid))
        open(p, 'w').write(doc); print('%-28s %6.1f KB' % (os.path.basename(p), len(doc) / 1024))

# ------------------------------------------------------------------ 1. hero (main): the seal drawn in the fog, the wordmark, a passage typed
def hero():
    W, H = 1200, 500
    calm = [(300, 250, 230, 250), (790, 240, 360, 150), (1020, 470, 220, 50)]
    layers = fog_layers(W, H, 4, 11, calm)
    tag = 'what is loosed below is loosed above.'   # the Emerald Tablet, turned toward the name: aphesis, a loosing
    passage = 'solve et coagula'
    def body(T, tid):
        return (fog_svg(layers, T['fog']) + phi_group(190, 40, 420, T['seal']) +
                '<text x="560" y="262" class="aphu halo" font-size="150" fill="%s">aφesis</text>' % T['ink'] +
                '<text x="566" y="318" class="elite halo" font-size="19" letter-spacing="1.5" fill="%s">%s</text>' % (T['ink-soft'], tag.replace('φ', '<tspan class="aphu">φ</tspan>')) +
                typed('>> ' + passage, 1176, 476, 13, T['accent-text'], 14, 3.2, 5.5, anchor='end', spacing=1.6) +
                icon('eye0' if tid == 'light' else 'eye1', 22, 452, 28, T['accent']))
    svg('hero', W, H, body, 'aφesis', tag + '>> ' + passage, 'aphes.is')

# ------------------------------------------------------------------ 2. branches (main): the inscription around the seal, one name per branch
BRANCHES = [('main', 'atrium'), ('design-system', 'canon'), ('font', 'littera'), ('mark', 'sigillum'), ('site', 'domus'), ('section/*', 'cellae')]
def branches():
    W, H = 1200, 560; cx, cy = 600, 280; rx, ry = 410, 205
    layers = fog_layers(W, H, 4, 23, [(cx, cy, 150, 200)] + [(cx + rx * math.cos(a), cy + ry * math.sin(a), 70, 40) for a in np.linspace(0, 2 * math.pi, 25)[:-1]], amount=.9)
    def body(T, tid):
        ring = 'M%s %s a%s %s 0 1 1 %s 0 a%s %s 0 1 1 %s 0' % (f(cx + rx), f(cy), f(rx), f(ry), f(-2 * rx), f(rx), f(ry), f(2 * rx))
        dur = 160; out = [fog_svg(layers, T['fog']), phi_group(cx - 95, cy - 132, 264, T['seal'], draw=False, fid='b')]
        out.append('<path d="%s" fill="none" stroke="%s" stroke-width="1" stroke-dasharray="2 7" opacity=".7"/>' % (ring, T['line']))
        for i, (name, gloss) in enumerate(BRANCHES):
            begin = -dur * i / len(BRANCHES)
            out.append('<g><animateMotion dur="%ss" begin="%ss" repeatCount="indefinite" path="%s"/>'
                       '<text x="0" y="-4" text-anchor="middle" class="elite halo" font-size="17" letter-spacing="3.6" fill="%s">%s</text>'
                       '<text x="0" y="22" text-anchor="middle" class="aph halo" font-size="22" fill="%s">%s</text></g>'
                       % (dur, f(begin), ring, T['ink'], name, T['ink-soft'], gloss))
        return ''.join(out)
    svg('branches', W, H, body, ''.join(g for _, g in BRANCHES), ''.join(n for n, _ in BRANCHES), 'the branches of aphesis')

# ------------------------------------------------------------------ 3. palette (design-system): the neutral scale and rubedo, as stipple
def palette():
    W, H = 1200, 360
    def body(T, tid):
        out = []; n = len(NEUTRAL); cw = 1080 / n; x0 = 60
        for i, name in enumerate(NEUTRAL):
            col = THEMES['light'][name]
            dens = np.full((34, int(cw // 4)), 1.0)
            fade = np.linspace(1, .25, 34)[:, None]
            p = squares(dens * fade, 4, 100 + i, ox=x0 + i * cw + 2, oy=60)
            out.append('<path d="%s" fill="%s"><animate attributeName="opacity" dur="%ss" repeatCount="indefinite" values="1;.82;1" begin="-%ss"/></path>' % (p, col, f(5 + i % 4), f(i * .7)))
            out.append('<text x="%s" y="226" class="elite" font-size="12" letter-spacing="1" fill="%s" text-anchor="middle">%s</text>' % (f(x0 + i * cw + cw / 2), T['ink-soft'], name))
        red = THEMES[tid]['rubedo']; dens = np.full((16, 60), .9) * np.linspace(1, .3, 60)[None, :]
        out.append('<path d="%s" fill="%s"/>' % (squares(dens, 4, 7, ox=60, oy=262), red))
        out.append('<text x="320" y="292" class="aph" font-size="34" fill="%s">rubedo</text>' % T['accent-text'])
        out.append('<text x="462" y="290" class="elite" font-size="14" letter-spacing="1.2" fill="%s">the seal, icons, focus. never a large area.</text>' % T['ink-soft'])
        return ''.join(out)
    svg('palette', W, H, body, 'rubedo', ''.join(NEUTRAL) + 'the seal, icons, focus. never a large area.', 'the palette of aphesis')

# ------------------------------------------------------------------ 4. type (design-system): the two faces
def typefaces():
    W, H = 1200, 470
    lines = 'liber · codex · officina · opera · paries'
    body_txt = ['everything people read and operate is typewritten.', 'names, titles and glosses are drawn with the brush.']
    def body(T, tid):
        return ('<text x="60" y="76" class="elite" font-size="13" letter-spacing="3" fill="%s">display · aphesis script · slant −12</text>' % T['ink-soft'] +
                '<text x="56" y="200" class="aph" font-size="128" fill="%s">experimental</text>' % T['ink'] +
                '<text x="60" y="262" class="aph" font-size="30" fill="%s">%s</text>' % (T['ink-soft'], lines) +
                '<text x="60" y="336" class="elite" font-size="13" letter-spacing="3" fill="%s">text · special elite</text>' % T['ink-soft'] +
                typed(body_txt[0], 60, 382, 21, T['ink'], 16, .8, 9, erase=True) +
                typed(body_txt[1], 60, 418, 21, T['ink'], 16, 4.2, 6, erase=True))
    css_extra = "@keyframes w{0%,100%{font-variation-settings:'wght' 300,'slnt' -12}50%{font-variation-settings:'wght' 800,'slnt' -12}}"
    def body2(T, tid):
        return '<style>%s .breathe{animation:w 9s ease-in-out infinite}</style>' % css_extra + body(T, tid).replace('class="aph" font-size="128"', 'class="aph breathe" font-size="128"')
    svg('type', W, H, body2, 'experimental' + lines, 'display · aphesis script · slant −12text · special elite' + ''.join(body_txt), 'the two faces of aphesis')

# ------------------------------------------------------------------ 5. icons (design-system): brush strokes and stipple, each in its two states
def icons():
    W, H = 1200, 300
    items = [('eye0', 'eye1', 'oculus'), ('sol', 'luna', 'sol · luna'), ('term0', 'term1', 'linea lucis'), ('thr0', 'thr1', 'limen')]
    def body(T, tid):
        out = []
        for i, (a, b, gl) in enumerate(items):
            x = 120 + i * 270; dur = 6; off = -i * 1.5
            for k, nm in enumerate((a, b)):
                vals = '1;1;0;0;1' if k == 0 else '0;0;1;1;0'
                out.append(icon(nm, x, 60, 120, T['accent'], '<animate attributeName="opacity" dur="%ss" begin="%ss" repeatCount="indefinite" keyTimes="0;.42;.5;.92;1" values="%s"/>' % (dur, f(off), vals)))
            out.append('<text x="%s" y="236" text-anchor="middle" class="aph" font-size="26" fill="%s">%s</text>' % (f(x + 60), T['ink-soft'], gl))
        return ''.join(out)
    svg('icons', W, H, body, 'oculussol · lunalinea lucislimen', '', 'the icons of aphesis')

# ------------------------------------------------------------------ 6. simulacrum (design-system): a picture coalescing out of the fog, keeping its lost points
def simulacrum(mapname='hands', title='the two hands'):
    W, H = 1200, 520; cell = 4
    im = Image.open(os.path.join(ARGS.maps, mapname + ('.png' if os.path.exists(os.path.join(ARGS.maps, mapname + '.png')) else '.jpg'))).convert('L')
    w, h = W // cell, H // cell
    sc = min(w * .9 / im.width, h * .86 / im.height); iw, ih = int(im.width * sc), int(im.height * sc)
    img = np.zeros((h, w)); arr = np.asarray(im.resize((iw, ih), Image.LANCZOS), float) / 255
    oy, ox = (h - ih) // 2, (w - iw) // 2; img[oy:oy + ih, ox:ox + iw] = arr ** 1.15
    glow = np.asarray(Image.fromarray((img * 255).astype('uint8')).resize((w // 8, h // 8), Image.BILINEAR).resize((w, h), Image.BICUBIC), float) / 255
    glow = np.asarray(Image.fromarray((glow * 255).astype('uint8')).filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(10)), float) / 255
    d = fbm(w, h, 26, 5); er = smooth(.28, .78, fbm(w, h, 12, 9))
    mist = smooth(.46, .78, d) * .45
    full = img * (.82 + .36 * d) * (.55 + .45 * er) * .8 + .5 * (glow ** .8 * (.45 + .8 * d) * .75 + .02 * smooth(.36, .8, d)) * np.clip(1 - img * 1.6, 0, 1)
    states = [mist, mist * .6 + full * .4, full]
    paths = [squares(s, cell, 40 + i, jitter=[3, 1.5, 0][i]) for i, s in enumerate(states)]
    cap = '%s · Michelangelo, Sistine Chapel, c. 1512' % title
    def body(T, tid):
        out = []; dur = 12
        # fog -> half-formed -> formed, hold, back to fog: the layers always sum to one, so nothing blinks out
        kts = ['0;.15;.3;.8;.92;1', '0;.15;.3;.45;1', '0;.3;.45;.8;.92;1']
        vals = ['1;1;0;0;1;1', '0;0;1;0;0', '0;0;1;1;0;0']
        for p, kt, v in zip(paths, kts, vals):
            out.append('<path d="%s" fill="%s" opacity=".72" fill-opacity="0"><animate attributeName="fill-opacity" dur="%ss" repeatCount="indefinite" keyTimes="%s" values="%s" calcMode="linear"/></path>' % (p, T['fog'], dur, kt, v))
        out.append('<text x="1176" y="500" text-anchor="end" class="elite" font-size="12" letter-spacing="1.6" fill="%s">%s</text>' % (T['ink-soft'], cap))
        return ''.join(out)
    svg('simulacrum', W, H, body, '', cap, 'a simulacrum: ' + title)

# ------------------------------------------------------------------ 7. font (font): the weight and slant axes breathing, the wordmark, a–z
def specimen():
    W, H = 1200, 520
    az = 'abcdefghijklmnopqrstuvwxyz 0123456789'
    words = 'aφesis'
    def body(T, tid):
        st = ("<style>@keyframes ax{0%,100%{font-variation-settings:'wght' 300,'slnt' 0}25%{font-variation-settings:'wght' 800,'slnt' 0}"
              "50%{font-variation-settings:'wght' 800,'slnt' -16}75%{font-variation-settings:'wght' 300,'slnt' -16}}.ax{animation:ax 12s ease-in-out infinite}</style>")
        return (st + '<text x="600" y="270" text-anchor="middle" class="aphu ax" font-size="230" fill="%s">%s</text>' % (T['seal'], words) +
                '<text x="600" y="380" text-anchor="middle" class="aph" font-size="44" fill="%s">%s</text>' % (T['ink'], az) +
                '<text x="600" y="456" text-anchor="middle" class="elite" font-size="14" letter-spacing="2.4" fill="%s">aphesis script · wght 300–800 · slnt −16–0 · the φ never leans</text>' % T['ink-soft'])
    svg('font', W, H, body, words + az, 'aphesis script · wght 300–800 · slnt −16–0 · the φ never leans', 'aphesis script')

# ------------------------------------------------------------------ 8. mark (mark): the φ drawn, boiling
def mark():
    W, H = 1200, 520
    layers = fog_layers(W, H, 4, 31, [(600, 260, 230, 270)], amount=.8)
    def body(T, tid):
        return fog_svg(layers, T['fog']) + phi_group(600 - 170, 30, 460, T['seal'], dur=10)
    svg('mark', W, H, body, '', '', 'the φ, drawn')

# ------------------------------------------------------------------ 9. site (site): the home, small
SECTIONS = [('book', 'liber'), ('experimental', 'ἄδυτον'), ('archive', 'codex'), ('laboratory', 'officina'), ('works', 'opera'), ('wall', 'paries'), ('forum', 'ἀγορά')]
def site():
    W, H = 1200, 600; cx, cy = 600, 300; rx, ry = 380, 220
    angs = [-math.pi / 2 + math.pi / 7 + i * 2 * math.pi / 7 for i in range(7)]
    pos = [(cx + rx * math.cos(a), cy + ry * math.sin(a)) for a in angs]
    layers = fog_layers(W, H, 4, 41, [(cx, cy, 150, 190), (1030, 575, 200, 40)] + [(x, y, 100, 44) for x, y in pos])
    missing = [g for _, g in SECTIONS if not has_glyphs(g)]
    if missing: print('  site: glosses left out until the Greek extension lands:', ' '.join(missing))
    passage = 'quod est inferius est sicut quod est superius'
    def body(T, tid):
        out = [fog_svg(layers, T['fog']), phi_group(cx - 92, cy - 128, 256, T['seal'], draw=False, fid='s')]
        for i, ((name, gl), (x, y)) in enumerate(zip(SECTIONS, pos)):
            out.append('<g><animate attributeName="opacity" dur="9s" begin="-%ss" repeatCount="indefinite" values="1;.55;1"/>'
                       '<text x="%s" y="%s" text-anchor="middle" class="elite halo" font-size="15" letter-spacing="3.3" fill="%s">%s</text>' % (f(i * 1.3), f(x), f(y - 4), T['ink'], name) +
                       ('<text x="%s" y="%s" text-anchor="middle" class="aph halo" font-size="21" fill="%s">%s</text>' % (f(x), f(y + 20), T['ink-soft'], gl) if gl not in missing else '') + '</g>')
        out.append(typed('>> ' + passage, 1176, 582, 12, T['accent-text'], 18, 1.5, 7, anchor='end', spacing=1.5))
        out.append(icon('eye0' if tid == 'light' else 'eye1', 22, 556, 26, T['accent']))
        return ''.join(out)
    svg('site', W, H, body, ''.join(g for _, g in SECTIONS if g not in missing), ''.join(n for n, _ in SECTIONS) + '>> ' + passage, 'the aphes.is home')

if __name__ == '__main__':
    hero(); branches(); palette(); typefaces(); icons(); simulacrum(); specimen(); mark(); site()
