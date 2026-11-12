#!/usr/bin/env python3
"""readme.py: animated README images in the aphes.ist design system, for GitHub.

GitHub shows a README's SVG as an image (through its camo proxy): CSS and SMIL animation run; scripts, external
files and links inside the image do not. So every image here is self-contained: the fonts are embedded as subsets
(only the glyphs used, base64 woff2), the motion is CSS keyframes, `prefers-reduced-motion` stills it, and each image
comes in a -dark and a -light variant for a <picture> element, which GitHub resolves to the viewer's GitHub theme.
Grounds are transparent: the stipple and the type sit on GitHub's own ground.

Needs Python 3.9+, fonttools and brotli (`pip install fonttools brotli`), and Node 18+ for the icons (icons.mjs runs
the design system's own runtime, so an icon here is exactly Aphesis.icon(name, state)). Colours come from
system/tokens.json, the fonts from system/fonts and system/lab-kit; nothing is downloaded.

    python3 tools/readme/readme.py icons  OUT [name ...]       one animated SVG per icon (64px, stirring)
    python3 tools/readme/readme.py static OUT [name ...]       the still icon files (system/assets/Icons)
    python3 tools/readme/readme.py phi    OUT [--height 160]   the φ, boiling
    python3 tools/readme/readme.py header OUT --title anamnesis --gloss ἀνάμνησις --icon anamnesis \\
            --line "a local-first second brain that measures itself." [--typed] [--name header]
    python3 tools/readme/readme.py header OUT --phi --gloss ἄφεσις --line "..." --typed    (the owner's own)
    python3 tools/readme/readme.py card   OUT --title contraprova --gloss "probatio contraria" --icon contraprova \\
            --line "..." [--line2 "..."] [--number 61% --number-meta "less cost per solved task"]
    python3 tools/readme/readme.py ring   OUT --item book=https://aphes.ist/#book ... (eight items, clockwise from the top)

Each command writes <name>-dark.svg and <name>-light.svg into OUT and prints the Markdown to paste.
See tools/readme/README.md.
"""
import argparse, base64, io, json, math, os, random, re, subprocess, sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset as ftsubset

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SCRIPT_FONT = os.path.join(ROOT, 'system', 'fonts', 'AphesisScript-VF.woff2')
ELITE_FONTS = [os.path.join(ROOT, 'system', 'lab-kit', 'v1', 'fonts', f) for f in ('SpecialElite-latin.woff2', 'SpecialElite-latin-ext.woff2')]
TOKENS = os.path.join(ROOT, 'system', 'tokens.json')
PHI_SVG = os.path.join(ROOT, 'system', 'assets', 'Logos', 'phi.svg')

# ------------------------------------------------------------------ tokens
def oklch_hex(s):
    L, C, h = [float(x) for x in re.findall(r'[\d.]+', s)[:3]]
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_, m_, s_ = L + .3963377774 * a + .2158037573 * b, L - .1055613458 * a - .0638541728 * b, L - .0894841775 * a - 1.2914855480 * b
    l, m, s3 = l_ ** 3, m_ ** 3, s_ ** 3
    rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s3, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s3,
           -.0041960863 * l - .7034186147 * m + 1.7076147010 * s3]
    enc = lambda u: 12.92 * u if u <= .0031308 else 1.055 * u ** (1 / 2.4) - .055
    return '#' + ''.join('%02x' % round(max(0, min(1, enc(max(0, c)))) * 255) for c in rgb)

def theme_colors():
    toks = {t['name']: t['value'] for t in json.load(open(TOKENS))['color']['tokens']}
    def get(name, th):
        v = toks[name][th]
        while v.startswith('{'): v = toks[v[1:-1]][th]
        return oklch_hex(v)
    return {th: {k: get(t, th) for k, t in (('ink', 'ink'), ('soft', 'ink-soft'), ('fog', 'fog'), ('accent', 'accent'),
                                            ('accent_text', 'accent-text'), ('seal', 'seal'))} for th in ('dark', 'light')}
THEMES = theme_colors()
FOG_OPACITY = {'dark': .62, 'light': .55}   # fog cells are drawn at 55 to 72% over the ground

# ------------------------------------------------------------------ fonts: subsets, base64
def _woff2(font):
    buf = io.BytesIO(); font.flavor = 'woff2'; font.save(buf); return base64.b64encode(buf.getvalue()).decode()

def _subset(font, text, features):
    o = ftsubset.Options(); o.layout_features = features; o.flavor = 'woff2'; o.notdef_outline = True
    o.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]; o.name_legacy = True   # keep the copyright and licence records
    s = ftsubset.Subsetter(o); s.populate(text=text); s.subset(font); return font

_SCRIPT = None
def script_font():
    """Aphesis Script at the display style: wght 400, slnt -12 (titles and glosses always lean; the φ never does)."""
    global _SCRIPT
    if _SCRIPT is None:
        _SCRIPT = instancer.instantiateVariableFont(TTFont(SCRIPT_FONT), {'wght': 400, 'slnt': -12})
    return _SCRIPT

def elite_font_for(text):
    for p in ELITE_FONTS:
        f = TTFont(p); cm = f.getBestCmap()
        if all(ord(c) in cm for c in text if c != ' '): return p
    return ELITE_FONTS[0]

def font_css(script_text='', elite_text=''):
    """@font-face rules with subset fonts as data URIs. Special Elite has no Greek: as on the site, its stack falls
    back to Aphesis Script, so any Greek in the text joins the Aphesis Script subset."""
    import copy
    greek = ''.join(c for c in elite_text if ord(c) > 0x36f)
    script_text += greek
    css = ''
    if script_text:
        css += "@font-face{font-family:'Aphesis Script';src:url(data:font/woff2;base64,%s) format('woff2')}" % _woff2(
            _subset(copy.deepcopy(script_font()), script_text, ['calt', 'ccmp', 'locl', 'kern', 'mark']))
    latin = ''.join(c for c in elite_text if ord(c) <= 0x36f)
    if latin.strip():
        css += "@font-face{font-family:'Special Elite';src:url(data:font/woff2;base64,%s) format('woff2')}" % _woff2(
            _subset(TTFont(elite_font_for(latin)), latin, ['kern']))
    css += (".d{font-family:'Aphesis Script',serif;letter-spacing:.02em}"
            ".t{font-family:'Special Elite','Aphesis Script',monospace}")
    return css

_METRICS = {}
def advance(text, size, font='elite'):
    if font not in _METRICS:   # read each font once: the ring's fog asks for a name's width at every cell
        f = TTFont(ELITE_FONTS[0]) if font == 'elite' else script_font()
        _METRICS[font] = (f.getBestCmap(), f['hmtx'], f['head'].unitsPerEm)
    cm, hm, upm = _METRICS[font]
    return sum(hm[cm[ord(c)]][0] if ord(c) in cm else upm * .5 for c in text) * size / upm

LICENCE = ('<!-- type: Aphesis Script (c) 2026 aphesist, SIL OFL 1.1, Reserved Font Name "Aphesis Script"; Special Elite '
           '(c) 2010 Astigmatic, Apache License 2.0; both embedded as subsets. The φ mark and the wordmark are trademarks '
           'of aphesist (TRADEMARKS.md) and are not covered by either licence. -->')
MARK_NOTE = '<!-- the φ mark is a trademark of aphesist (TRADEMARKS.md). -->'
REDUCED = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
def num(v): return ('%.2f' % v).rstrip('0').rstrip('.')

def svg_doc(w, h, title, css, body, view=None):
    note = LICENCE if '@font-face' in css else MARK_NOTE if 'id="phi"' in body else ''
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" width="%s" height="%s" role="img">%s<title>%s</title>'
            '<style>%s%s</style>%s</svg>') % (view or '0 0 %s %s' % (num(w), num(h)), num(w), num(h), note, esc(title), css, REDUCED, body)

# ------------------------------------------------------------------ stipple fog (pure Python)
def _value_noise(gw, gh, scale, rnd):
    cw, ch = int(gw / scale) + 3, int(gh / scale) + 3
    g = [[rnd.random() for _ in range(cw)] for _ in range(ch)]
    def at(x, y):
        x /= scale; y /= scale; x0, y0 = int(x), int(y); fx, fy = x - x0, y - y0
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a, b, c, d = g[y0][x0], g[y0][x0 + 1], g[y0 + 1][x0], g[y0 + 1][x0 + 1]
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    return at

def _ss(v): v = max(0., min(1., v)); return v * v * (3 - 2 * v)

def fog_frames(w, h, seed, shape, frames=3, pitch=3, base=.4, gain=.42):
    """frames of one fog field that moves a little between them. shape(x, y) -> 0..1 is how much fog a point may hold
    (calm zones, edges); the field decides where within that it gathers. Cells are 2px squares on a 3px grid."""
    rnd = random.Random(seed); gw, gh = w // pitch + 8 * frames + 4, h // pitch + 4
    n1, n2, n3 = _value_noise(gw, gh, 18, rnd), _value_noise(gw, gh, 7, rnd), _value_noise(gw, gh, 3, rnd)
    jit = random.Random(seed + 1); out = []
    for f in range(frames):
        cells = []
        for r in range(h // pitch + 1):
            for c in range(w // pitch + 1):
                x, y = c * pitch, r * pitch; k = shape(x, y)
                if k <= 0: jit.random(); continue
                gx = c + f * 5
                v = .55 * n1(gx, r) + .3 * n2(gx, r) + .15 * n3(gx, r)
                dens = (max(0., (v - base) / (1 - base)) ** 1.5 * gain + .016) * k
                if jit.random() < dens:
                    cells.append((x + jit.randint(-1, 1), y + jit.randint(-1, 1)))
        out.append(cells)
    return out

def calm_rect(x0, y0, x1, y1, pad, residue):
    def k(x, y):
        d = math.hypot(max(x0 - x, x - x1, 0), max(y0 - y, y - y1, 0))
        return residue + (1 - residue) * _ss(d / pad)
    return k

def edges(w, h, ex=46, ey=26):
    return lambda x, y: _ss(x / ex) * _ss((w - x) / ex) * _ss(y / ey) * _ss((h - y) / ey)

# the fog's shimmer: every cell belongs to one of eight groups (a hash of its place in the whole field), and each group
# fades in and out on its own clock, 0 to 1 and back, ease-in-out, so the curve ends where it starts and nothing
# resets. The periods (4, 6, 8, 12 s) divide 24 s, so the whole loops every 24 s; the phases differ, so cells come
# and go at random while the total stays about even; the phase slides a little with x (bands of SHIMMER_BAND px), so
# the shimmer travels slowly across. Group and phase depend only on a cell's place in the whole field, never on the
# image it falls in, so the pieces of a mosaic keep their seams invisible. Reduced motion: every cell at .6.
SHIMMER = [(4, .0), (6, .37), (8, .71), (12, .13), (6, .86), (8, .29), (4, .55), (12, .62)]
SHIMMER_BAND, SHIMMER_SLIDE = 104, .06

def fog_layer(frames, theme, period=12, ox=0, oy=0, w=None, h=None, name='f'):
    """the cells of all the frames, shimmering (above). frames are in the whole field's coordinates; a piece of a
    mosaic gives its place and size (ox, oy, w, h) and keeps only its own cells. period is kept for callers and unused:
    the shimmer's clocks are SHIMMER's."""
    seen, groups = set(), {}
    for fr in frames:
        for (x, y) in fr:
            if w is not None and not (ox - 2 < x < ox + w and oy - 2 < y < oy + h): continue
            gx, gy = int(round(x)), int(round(y))
            if (gx, gy) in seen: continue
            seen.add((gx, gy))
            g = (((gx * 73856093) ^ (gy * 19349663)) & 0x7fffffff) % len(SHIMMER)
            groups.setdefault((g, gx // SHIMMER_BAND), []).append((x - ox, y - oy))
    css = '@keyframes %ssh{0%%,100%%{opacity:0}40%%,60%%{opacity:1}}' % name
    body = '<g fill="%s" opacity="%s" shape-rendering="crispEdges">' % (THEMES[theme]['fog'], FOG_OPACITY[theme])
    for (g, band), cells in sorted(groups.items()):
        per, ph = SHIMMER[g]
        cls = '%s%d_%d' % (name, g, band)
        css += '.%s{opacity:.6;animation:%ssh %ss ease-in-out %.2fs infinite}' % (cls, name, per, -((ph + band * SHIMMER_SLIDE) % 1) * per)
        body += '<path class="%s" d="%s"/>' % (cls, ''.join('M%d %dh2v2h-2z' % p for p in cells))
    return css, body + '</g>'

# ------------------------------------------------------------------ the φ, boiling
SEEDS = [2, 7, 13, 21, 34, 55, 89, 144]
def seal(x, y, height, color, freq=.09, scale=2.4):
    """the φ (system/assets/Logos/phi.svg, the original) with the seal's boil: the edge displaced by fractal noise,
    reseeded 8 times a second. Each seed is a frame; CSS steps through them. Returns css, body, width."""
    src = open(PHI_SVG).read()
    d = re.search(r' d="([^"]+)"', src).group(1)
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', src).group(1).split()]
    s = height / vb[3]; toks = re.findall(r'[MCLZ]|-?\d+(?:\.\d+)?', d); out, nums = [], []
    for t in toks:
        if t in 'MCLZ': out.append(t)
        else:
            nums.append(float(t))
            if len(nums) == 2: out.append('%.1f %.1f' % (x + (nums[0] - vb[0]) * s, y + (nums[1] - vb[1]) * s)); nums = []
    path = ''.join(o if o in 'MCLZ' else o + ' ' for o in out).replace(' M', 'M').replace(' C', 'C').replace(' L', 'L').replace(' Z', 'Z')
    css, defs, uses = '', '<path id="phi" d="%s" fill="%s" fill-rule="evenodd"/>' % (path.strip(), color), ''
    for i, sd in enumerate(SEEDS):
        defs += ('<filter id="b%d" x="-6%%" y="-6%%" width="112%%" height="112%%"><feTurbulence type="fractalNoise" baseFrequency="%s" '
                 'numOctaves="1" seed="%d"/><feDisplacementMap in="SourceGraphic" scale="%s" xChannelSelector="R" yChannelSelector="G"/></filter>') % (i, freq, sd, scale)
        a, b = i / 8 * 100, (i + 1) / 8 * 100
        kf = ('0%%{opacity:0}%s%%{opacity:1}%s%%{opacity:0}' % (num(a), num(b))) if i else '0%%{opacity:1}%s%%{opacity:0}' % num(b)
        css += '.s%d{opacity:%d;animation:sk%d 1s step-end infinite}@keyframes sk%d{%s}' % (i, 1 if i == 0 else 0, i, i, kf)
        uses += '<use href="#phi" class="s%d" filter="url(#b%d)"/>' % (i, i)
    return css, '<defs>%s</defs><g>%s</g>' % (defs, uses), vb[2] * s

# ------------------------------------------------------------------ icons
_ICONS = None
def icons():
    global _ICONS
    if _ICONS is None:
        _ICONS = json.loads(subprocess.run(['node', os.path.join(HERE, 'icons.mjs')], check=True, capture_output=True, text=True).stdout)
    return _ICONS

# the runtime's hover motion (bundle.css: .aph-icon), here always on: the stipple's two halves stir against each other;
# the forum's eyes run their films at 8 fps in hard cuts
STIR = ('@keyframes aph-stir{0%{transform:translate(0,0)}30%{transform:translate(.45px,-.3px)}65%{transform:translate(-.3px,.35px)}100%{transform:translate(.25px,.15px)}}'
        '.aph-st path{transform-box:fill-box;animation:aph-stir 1.7s ease-in-out infinite alternate}'
        '.aph-st path+path{animation-direction:alternate-reverse;animation-duration:1.45s}')
EYES = ('.aph-film-a{animation:aph-eyes-a 2s step-end infinite}.aph-film-b{animation:aph-eyes-b 1.625s step-end infinite}.aph-film-c{animation:aph-eyes-c 1.375s step-end infinite}'
        '@keyframes aph-eyes-a{0%{transform:translateX(0)}31.25%{transform:translateX(-24px)}50%{transform:translateX(-72px)}56.25%{transform:translateX(-96px)}62.5%{transform:translateX(-72px)}68.75%{transform:translateX(-24px)}87.5%{transform:translateX(-48px)}100%{transform:translateX(-48px)}}'
        '@keyframes aph-eyes-b{0%{transform:translateX(0)}23.08%{transform:translateX(-48px)}46.15%{transform:translateX(-24px)}69.23%{transform:translateX(-72px)}76.92%{transform:translateX(-96px)}84.62%{transform:translateX(-72px)}92.31%{transform:translateX(0)}100%{transform:translateX(0)}}'
        '@keyframes aph-eyes-c{0%{transform:translateX(0)}18.18%{transform:translateX(-72px)}27.27%{transform:translateX(-96px)}36.36%{transform:translateX(-72px)}45.45%{transform:translateX(-24px)}72.73%{transform:translateX(-48px)}100%{transform:translateX(-48px)}}')

def icon_group(name, x, y, size, color, state=0):
    """the icon as the runtime draws it, placed at (x, y), size px square, in color; returns css, body"""
    svg = icons()['icons'][name][str(state)]
    inner = svg[svg.index('>') + 1: svg.rindex('</svg>')]
    return (EYES if 'aph-film' in inner else STIR), '<g transform="translate(%s %s) scale(%s)" color="%s">%s</g>' % (num(x), num(y), '%.4f' % (size / 24), color, inner)

# ------------------------------------------------------------------ the typist (the site's Typist.plan, made deterministic)
def typist(text, seed=7, typo=None, start=1.2, hold=7.2, rest=1.3, pace=58):
    """states [(t, buffer, idle)] and the period. typo = (word, offset, key): a neighbouring key pressed in that word,
    noticed a letter later, deleted and retyped. Rhythm is log-normal, slower at word starts and after punctuation;
    the erase speeds up like a held delete key, then takes whole words."""
    rnd = random.Random(seed); ch = list(text); ops = []
    def key(c, prev):
        d = pace * math.exp(rnd.gauss(0, 1) * .32)
        if prev in (' ', None): d *= 1.3
        if prev and prev in ',;:': d += 140 + rnd.random() * 180
        if prev and prev in '.!?': d += 260 + rnd.random() * 300
        if rnd.random() < .03: d += 200 + rnd.random() * 380
        return d
    at = text.index(typo[0]) + int(typo[1]) if typo else -1
    i = 0
    while i < len(ch):
        c, prev = ch[i], ch[i - 1] if i else None
        if i == at and i + 1 < len(ch):
            ops += [('add', typo[2], key(c, prev)), ('add', ch[i + 1], key(ch[i + 1], typo[2]) * .85), ('wait', '', 180 + rnd.random() * 320),
                    ('del', '', 120), ('del', '', 50 + rnd.random() * 30), ('add', c, pace * (1.1 + rnd.random() * .5)), ('add', ch[i + 1], key(ch[i + 1], c))]
            i += 2; continue
        ops.append(('add', c, key(c, prev))); i += 1
    t, buf, states = start, [], [(0., [], True)]
    for op, c, d in ops:
        t += d / 1000
        if op == 'add': buf = buf + [c]
        elif op == 'del': buf = buf[:-1]
        states.append((t, list(buf), op == 'wait'))
    states.append((t + .25, list(buf), True)); t += hold; taps, dd = 4, .15
    while buf:
        if taps > 0:
            buf = buf[:-1]; taps -= 1; states.append((t, list(buf), False)); dd = max(.055, dd * .78); t += dd * math.exp(rnd.gauss(0, 1) * .15); continue
        while buf and buf[-1] == ' ': buf = buf[:-1]
        while buf and buf[-1] != ' ': buf = buf[:-1]
        states.append((t, list(buf), False)); t += .17 + rnd.random() * .12
    states.append((t, [], True))
    return states, t + rest

def typed_line(text, x, y, size, ink, caret, typo=None, name='k'):
    """the line typed and erased, glyph by glyph, with the site's caret: a block in accent, .55em by 1.05em, .12em
    after the text, at .75; solid while typing, blinking (1.06s) while idle. With reduced motion: the whole line."""
    states, period = typist(text, typo=typo)
    def xs(buf):
        out, cx = [], x
        for c in buf: out.append(cx); cx += advance(c, size)
        return out, cx
    inst, line = {}, []
    for k, (t, buf, idle) in enumerate(states):
        t1 = states[k + 1][0] if k + 1 < len(states) else period
        pos, cx = xs(buf)
        for c, px in zip(buf, pos):
            if c != ' ': inst.setdefault((c, round(px, 2)), []).append((t, t1))
        line.append((t, t1, cx, idle))
    fp, fend = xs(list(text)); final = {(c, round(p, 2)) for c, p in zip(text, fp) if c != ' '}
    pct = lambda t: num(100 * t / period)
    css, body = '', ''
    for n, ((c, px), ivs) in enumerate(sorted(inst.items(), key=lambda kv: kv[0][1])):
        ivs.sort(); merged = []
        for a, b in ivs:
            if merged and abs(merged[-1][1] - a) < 1e-6: merged[-1] = (merged[-1][0], b)
            else: merged.append((a, b))
        kf = ('0%{opacity:0}' if merged[0][0] > 0 else '') + ''.join('%s%%{opacity:1}%s%%{opacity:0}' % (pct(a), pct(b)) for a, b in merged)
        css += '.%s%d{opacity:%d;animation:%s%d %ss step-end infinite}@keyframes %s%d{%s}' % (name, n, (c, px) in final, name, n, num(period), name, n, kf)
        body += '<text class="t %s%d" x="%s" y="%s">%s</text>' % (name, n, num(px), num(y), esc(c))
    kx = ko = ''
    for t0, t1, cx, idle in line:
        kx += '%s%%{transform:translateX(%spx)}' % (pct(t0), num(cx - fend))
        if idle and t1 - t0 > .3:
            tt, on = t0, True
            while tt < t1 - 1e-6: ko += '%s%%{opacity:%s}' % (pct(tt), '.75' if on else '0'); tt += .53; on = not on
        else: ko += '%s%%{opacity:.75}' % pct(t0)
    css += ('.%sc{opacity:.75;animation:%scx %ss step-end infinite,%sco %ss step-end infinite}@keyframes %scx{%s}@keyframes %sco{%s}' %
            (name, name, num(period), name, num(period), name, kx, name, ko))
    body += '<rect class="%sc" x="%s" y="%s" width="%s" height="%s" fill="%s"/>' % (name, num(fend + .12 * size), num(y - .87 * size), num(.55 * size), num(1.05 * size), caret)
    return css, '<g fill="%s" font-size="%s">%s</g>' % (ink, num(size), body), fend

# ------------------------------------------------------------------ outputs
def write(out, name, docs):
    os.makedirs(out, exist_ok=True)
    for th, s in docs.items():
        open(os.path.join(out, '%s-%s.svg' % (name, th)), 'w').write(s)

def picture(path_prefix, alt, href=None, width=None, align=None):
    img = '<img src="%s-light.svg" alt="%s"%s%s>' % (path_prefix, esc(alt), ' width="%s"' % width if width else '', ' align="%s"' % align if align else '')
    p = '<picture><source media="(prefers-color-scheme: dark)" srcset="%s-dark.svg">%s</picture>' % (path_prefix, img)
    return '<a href="%s">%s</a>' % (href, p) if href else p

def cmd_icons(a):
    names = a.names or icons()['sections'] + icons()['projects']
    for n in names:
        docs = {}
        for th in THEMES:
            css, body = icon_group(n, 0, 0, 24, THEMES[th]['accent'])
            docs[th] = svg_doc(a.size, a.size, n, css, body.replace('scale(1.0000)', 'scale(1)'), view='-1 -1 26 26')
        write(a.out, n, docs)
        print(picture(os.path.join(a.prefix, n), n, width=a.size))

def cmd_static(a):
    """the still files under system/assets/Icons: <name>.svg at rest and <name>-chosen.svg gathered, 96px, in the
    light-theme rubedo, for places that cannot run the script"""
    import itertools
    color = THEMES['light']['accent']
    # default: the project icons. The section files were made earlier and stay as they are: forum.svg holds the eyes'
    # still drawing where icon('forum', 0) brings its film, and descent's night is missing from the runtime today
    for n in a.names or icons()['projects']:
        for st, suf in (('0', ''), ('1', '-chosen')):
            paths = re.findall(r'<path d="([^"]*)"', icons()['icons'][n][st])
            half = [re.findall(r'M[^M]+', p) for p in paths[1:3]] + [[], []]
            dots = ''.join(x for pair in itertools.zip_longest(half[0], half[1]) for x in pair if x)   # undo icon()'s two halves
            open(os.path.join(a.out, n + suf + '.svg'), 'w').write(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96"><path d="%s" fill="%s"/>'
                '<path d="%s" fill="%s" opacity=".85"/></svg>' % (paths[0], color, dots, color))

def cmd_phi(a):
    docs = {}
    for th in THEMES:
        css, body, w = seal(4, 4, a.height, THEMES[th]['seal'])
        docs[th] = svg_doc(w + 8, a.height + 8, 'φ', css, body)
    write(a.out, a.name, docs)
    print(picture(os.path.join(a.prefix, a.name), 'aphes.ist', href='https://aphes.ist/'))

def cmd_header(a):
    """a banner: the mark at the left (a project's icon, or the φ), the title in Aphesis Script with its gloss, and one
    line in Special Elite, typed and erased if --typed; the fog around, calm behind the words."""
    w, h = a.width, a.height; docs = {}
    for th, P in THEMES.items():
        css, body = '', ''
        if a.phi:
            mh = h - 34; scss, sbody, mw = seal(34, 17, mh, P['seal']); css += scss; body_mark = sbody; mx1 = 34 + mw
        else:
            ms = a.icon_size; icss, ibody = icon_group(a.icon, 30, (h - ms) / 2 - (8 if a.line else 0), ms, P['accent']); css += icss; body_mark = ibody; mx1 = 30 + ms
        tx = mx1 + 32
        title_size, gloss_size, line_size = (54, 26, 19) if a.title else (0, 34, 22)
        ty = h / 2 - (4 if a.line else -18)
        if a.title:
            tw = advance(a.title, title_size, 'script') * 1.02
            words = '<text class="d" x="%s" y="%s" font-size="%d" fill="%s">%s</text>' % (num(tx), num(ty), title_size, P['ink'], esc(a.title))
            if a.gloss: words += '<text class="d" x="%s" y="%s" font-size="%d" fill="%s">%s</text>' % (num(tx + tw + 18), num(ty), gloss_size, P['soft'], esc(a.gloss))
            ly = ty + 42
        else:
            words = '<text class="d" x="%s" y="%s" font-size="%d" fill="%s">%s</text>' % (num(tx + 2), num(ty - 30), gloss_size, P['soft'], esc(a.gloss or ''))
            ly = ty + 18
        lend = tx + advance(a.line or '', line_size)
        if a.line and a.typed:
            typo = tuple(a.typo.split(':')) if a.typo else None
            kcss, kbody, lend = typed_line(a.line, tx, ly, line_size, P['ink'], P['accent'], typo=typo); css += kcss; words += kbody
        elif a.line:
            words += '<text class="t" x="%s" y="%s" font-size="%d" fill="%s">%s</text>' % (num(tx), num(ly), line_size, P['ink'], esc(a.line))
        right = max(tx + (advance(a.title, title_size, 'script') + 18 + advance(a.gloss or '', gloss_size, 'script') if a.title else 0), lend + 20)
        zones = [calm_rect(tx - 8, ty - title_size - 6, right + 8, ly + 10, 26, .012), calm_rect(20, 10, mx1 + 8, h - 10, 26, .3)]
        e = edges(w, h)
        frames = fog_frames(w, h, a.seed, lambda x, y: e(x, y) * min(z(x, y) for z in zones) * (.35 + .9 * x / w), base=.42)
        fcss, fbody = fog_layer(frames, th)
        script_text = (a.title or '') + (a.gloss or '')
        elite_text = (a.line or '') + (''.join(sorted(set('abcdefghijklmnopqrstuvwxyz'))) if a.typo else '')
        css = font_css(script_text, elite_text) + fcss + css
        docs[th] = svg_doc(w, h, a.title or 'aphes.ist', css, fbody + body_mark + words)
    write(a.out, a.name, docs)
    print(picture(os.path.join(a.prefix, a.name), (a.title or 'aphes.ist') + (': ' + a.line if a.line else ''), href=a.href, width='100%'))

def cmd_card(a):
    """a card for one project: its icon, the name in Aphesis Script and its gloss, one or two lines in Special Elite,
    and the key number in accent where there is one; fog on the open side."""
    w, h = a.width, 132; docs = {}
    for th, P in THEMES.items():
        x0 = 26; css = ''; body = ''
        if a.icon:
            icss, ibody = icon_group(a.icon, 24, 18, 40, P['accent']); css += icss; body += ibody; x0 = 80
        tw = advance(a.title, 42, 'script') * 1.02; gx = x0 + tw + 16
        body += '<text class="d" x="%s" y="52" font-size="42" fill="%s">%s</text>' % (num(x0), P['ink'], esc(a.title))
        if a.gloss: body += '<text class="d" x="%s" y="52" font-size="21" fill="%s">%s</text>' % (num(gx), P['soft'], esc(a.gloss))
        body += '<text class="t" x="%s" y="90" font-size="14.5" fill="%s">%s</text>' % (num(x0 + 2), P['ink'], esc(a.line))
        if a.line2: body += '<text class="t" x="%s" y="112" font-size="14.5" fill="%s">%s</text>' % (num(x0 + 2), P['soft'], esc(a.line2))
        right = max(gx + advance(a.gloss or '', 21, 'script'), x0 + advance(a.line + 'φ', 14.5))
        zones = [calm_rect(x0 - 4, 14, right + 8, 118, 34, .012)]
        if a.icon: zones.append(calm_rect(20, 14, 68, 62, 14, .1))
        if a.number:
            nx = w - 30
            body += ('<text class="d" x="%s" y="78" font-size="58" text-anchor="end" fill="%s">%s</text>'
                     '<text class="t" x="%s" y="104" font-size="11" letter-spacing="1.5" text-anchor="end" fill="%s">%s</text>') % (
                nx, P['accent'], esc(a.number), nx, P['soft'], esc(a.number_meta or ''))
            zones.append(calm_rect(nx - 190, 26, nx + 4, 110, 22, .012))
        e = edges(w, h)
        frames = fog_frames(w, h, a.seed, lambda x, y: e(x, y) * min(z(x, y) for z in zones) * max(0, min(1, .25 + x / w * 1.1)) * a.fog)
        fcss, fbody = fog_layer(frames, th, period=13)
        css = font_css(a.title + (a.gloss or '') + (a.number or ''), a.line + (a.line2 or '') + (a.number_meta or '')) + fcss + css
        docs[th] = svg_doc(w, h, a.title, css, fbody + body)
    write(a.out, a.name or a.title.replace('.', ''), docs)
    print(picture(os.path.join(a.prefix, a.name or a.title.replace('.', '')), '%s, %s: %s %s' % (a.title, a.gloss or '', a.line, a.line2 or ''), href=a.href, width=w))

def cmd_ring(a):
    """the pseudo-home: the φ in the middle and eight icons on a ring, each its own link. A mosaic of centred rows of
    images whose widths are percentages (so a phone scales the ring instead of wrapping it); every piece carries its
    patch of one fog field, so the rows join into one fog. --names adds a tiny name beside each icon, outward."""
    items = [i.split('=', 1) for i in a.item]
    if len(items) != 8: sys.exit('ring: give exactly eight --item name=href, clockwise from the top')
    CW, S, ICON, R, D, BAND, PHI_H = 830, 56, 40, 191, 135, 44, 192
    H3 = 2 * (D - S // 2); ROWS = [BAND, S, S, H3, S, S, BAND]; CH = sum(ROWS); CX, CY = CW / 2, CH / 2
    pos = {}
    for i, (n, _) in enumerate(items):
        ang = math.radians(-90 + 45 * i)
        pos[n] = (CX + round(R * math.cos(ang)), CY + round(R * math.sin(ang))) if i % 2 == 0 else (CX + (D if math.cos(ang) > 0 else -D), CY + (D if math.sin(ang) > 0 else -D))
    nw = lambda n: advance(n, 11) + .22 * 11 * (len(n) - 1)
    def shape(x, y):
        r = math.hypot(x - CX, (y - CY) * 1.05)
        k = (_ss((r - 40) / 90) * .55 + .45 * _ss((r - 70) / 60)) * _ss((R + 175 - r) / 120)
        k *= _ss(x / 70) * _ss((CW - x) / 70) * _ss(y / 40) * _ss((CH - y) / 40)
        k *= .22 + .78 * _ss(math.hypot(max(CX - 60 - x, x - CX - 60, 0), max(CY - PHI_H / 2 - y, y - CY - PHI_H / 2, 0)) / 30)
        for n, (ix, iy) in pos.items():
            k *= 1 if math.hypot(x - ix, y - iy) > 32 else .12 + .88 * _ss((math.hypot(x - ix, y - iy) - 16) / 16)
            if a.names:
                tw = nw(n); x0 = ix + S / 2 if ix >= CX else ix - S / 2 - tw
                dd = math.hypot(max(x0 - x, x - x0 - tw, 0), max(abs(y - iy) - 6, 0))
                k *= .03 + .97 * _ss((dd - 3) / 12) if dd < 15 else 1
        return k
    frames = fog_frames(CW, CH, a.seed, shape, base=.38, gain=.4)
    ys = [sum(ROWS[:i]) for i in range(len(ROWS))]
    order = [n for n, _ in items]; href = dict(items)
    per_row = {1: [order[0]], 2: [order[7], order[1]], 3: [order[6], 'φ', order[2]], 4: [order[5], order[3]], 5: [order[4]]}
    rows = [[('fog', 0, 0, CW, BAND, None)], [], [], [], [], [], [('fog', 0, ys[6], CW, BAND, None)]]
    for r, its in per_row.items():
        y, hh, cells = ys[r], ROWS[r], []
        for it in its:
            if it == 'φ':
                x0 = pos[order[6]][0] + S / 2; cells.append(('phi', x0, y, pos[order[2]][0] - S / 2 - x0, hh, None)); continue
            cx = pos[it][0]; x0, ww, side = cx - S / 2, S, None
            if a.names:
                tw = nw(it) + 8; side = 'left' if cx < CX else 'right'
                if side == 'left': x0 -= tw
                ww += tw
            cells.append(('icon', x0, y, ww, hh, dict(name=it, cx=cx - x0, side=side)))
        x, out = 0, []
        for c in cells:
            if c[1] - x > .01: out.append(('fog', x, y, c[1] - x, hh, None))
            out.append(c); x = c[1] + c[3]
        if CW - x > .01: out.append(('fog', x, y, CW - x, hh, None))
        rows[r] = out
    md = []
    for ri, row in enumerate(rows):
        line, used = '', 0
        for ci, (kind, x, y, ww, hh, ex) in enumerate(row):
            base = ex['name'] if kind == 'icon' else 'phi' if kind == 'phi' else 'fog-%d-%d' % (ri, ci)
            docs = {}
            for th, P in THEMES.items():
                fcss, fbody = fog_layer(frames, th, ox=x, oy=y, w=ww, h=hh); css, body = fcss, fbody
                if kind == 'phi':
                    scss, sbody, sw = seal(0, 0, PHI_H, P['seal']); css += scss
                    body += '<g transform="translate(%s %s)">%s</g>' % (num(ww / 2 - sw / 2), num((hh - PHI_H) / 2), sbody)
                elif kind == 'icon':
                    icss, ibody = icon_group(ex['name'], ex['cx'] - ICON / 2, (hh - ICON) / 2, ICON, P['accent']); css += icss; body += ibody
                    if ex['side']:
                        right = ex['side'] == 'right'
                        css = font_css('', ex['name']) + css
                        body += '<text class="t" x="%s" y="%s" font-size="11" letter-spacing="2.42" text-anchor="%s" fill="%s">%s</text>' % (
                            num(ex['cx'] + (S / 2 + 2 if right else -S / 2 - 2)), num(hh / 2 + 4), 'start' if right else 'end', P['soft'], esc(ex['name']))
                docs[th] = svg_doc(ww, hh, ex['name'] if kind == 'icon' else 'φ' if kind == 'phi' else 'fog', css, body)
            write(a.out, base, docs)
            pct = math.floor(ww / CW * 1e6) / 1e4
            if ci == len(row) - 1: pct = round(100 - used, 4)
            used = round(used + pct, 4)
            link = href.get(base, a.home)
            line += ('<a href="%s"><picture><source media="(prefers-color-scheme: dark)" srcset="%s-dark.svg"><img src="%s-light.svg" alt="%s" width="%s%%" align="top"></picture></a>' % (
                link, os.path.join(a.prefix, base), os.path.join(a.prefix, base), esc(base if kind == 'icon' else 'aphes.ist' if kind == 'phi' else ''), ('%.4f' % pct).rstrip('0').rstrip('.')))
        md.append(line)
    print('<p align="center">\n' + '<br>\n'.join(md) + '\n</p>')

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    def common(p):
        p.add_argument('out', help='folder for the svgs'); p.add_argument('--prefix', default='', help='path the README uses for that folder (default: the folder as given)')
        p.add_argument('--seed', type=int, default=7, help='the fog field')
    p = sub.add_parser('icons'); common(p); p.add_argument('names', nargs='*'); p.add_argument('--size', type=int, default=64)
    p = sub.add_parser('static'); common(p); p.add_argument('names', nargs='*')
    p = sub.add_parser('phi'); common(p); p.add_argument('--height', type=int, default=160); p.add_argument('--name', default='phi')
    p = sub.add_parser('header'); common(p)
    p.add_argument('--title'); p.add_argument('--gloss'); p.add_argument('--line'); p.add_argument('--typed', action='store_true')
    p.add_argument('--typo', help='word:offset:key, one noticed typo while typing (the site\'s Typist makes them)')
    g = p.add_mutually_exclusive_group(required=True); g.add_argument('--icon'); g.add_argument('--phi', action='store_true')
    p.add_argument('--icon-size', type=int, default=72); p.add_argument('--width', type=int, default=840); p.add_argument('--height', type=int, default=200)
    p.add_argument('--href'); p.add_argument('--name', default='header')
    p = sub.add_parser('card'); common(p)
    p.add_argument('--title', required=True); p.add_argument('--gloss'); p.add_argument('--line', required=True); p.add_argument('--line2')
    p.add_argument('--number'); p.add_argument('--number-meta'); p.add_argument('--icon'); p.add_argument('--href'); p.add_argument('--name')
    p.add_argument('--width', type=int, default=660); p.add_argument('--fog', type=float, default=1.25)
    p = sub.add_parser('ring'); common(p)
    p.add_argument('--item', action='append', required=True, help='name=href, eight of them, clockwise from the top')
    p.add_argument('--names', action='store_true'); p.add_argument('--home', default='https://aphes.ist/')
    a = ap.parse_args()
    if not a.prefix: a.prefix = a.out
    {'icons': cmd_icons, 'static': cmd_static, 'phi': cmd_phi, 'header': cmd_header, 'card': cmd_card, 'ring': cmd_ring}[a.cmd](a)

if __name__ == '__main__':
    main()
