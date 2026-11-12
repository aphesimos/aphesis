#!/usr/bin/env python3
"""Build me.aphes.ist: one self-contained page, rendered from content/me.json at build time.

  python3 me/build.py                          # writes dist/ (index.html, phi.svg, public/*)
  python3 me/build.py --out DIR                # somewhere else
  python3 me/build.py --fragment FILE          # the same page without doctype/html/head/body, for a preview host
  python3 me/build.py --content-api URL        # the content service to refresh from (or APHESIS_CONTENT_API)
  python3 me/build.py --ref design-system      # the design system from another ref
  python3 me/build.py --require-filled         # stop if a [[placeholder]] is left in the content (the deploy does this)

index.html carries everything: tokens.css (generated from the design system's tokens.json), bundle.css, bundle.js,
the two faces, the link previews (as static stipple masks and live density maps) as data URIs, and the page's own css and js. The text is rendered into the
template here, so the page is complete without javascript; the script only adds motion and, when a content API is
set, refreshes the text. With no content API the page makes no network request at all.

The design system is read with `git show` from origin/design-system (else design-system); nothing of it is copied
into this branch. Special Elite (Apache License 2.0) is not in system/ itself: the lab kit's copy is embedded.
"""
import argparse
import base64
import html
import io
import json
import os
import re
import subprocess
import sys
from urllib.parse import urlparse

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit('build: the link previews need Pillow and numpy (pip install pillow numpy)')

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PLACEHOLDER = re.compile(r'\[\[([^\]]+)\]\]')
REDUCED_LINE = 'var REDUCED = false;'
REDUCED_PATCH = (
    '/* me.aphes.ist is the lab-kit-style exception to "the site always animates": this page is read by recruiters\n'
    '     and research viewers, so the runtime follows the reader\'s reduce-motion setting here (the build patches this\n'
    '     one line; the design system itself is untouched). */\n'
    "  var REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;"
)


# ---------- the design system, read from git ----------
def git(*args, binary=False):
    out = subprocess.run(['git', '-C', REPO] + list(args), capture_output=True, check=True).stdout
    return out if binary else out.decode('utf-8')


def resolve(ref):
    for r in ([ref] if ref else ['origin/design-system', 'design-system']):
        try:
            return git('rev-parse', '--verify', '--quiet', r + '^{commit}').strip(), r
        except subprocess.CalledProcessError:
            continue
    sys.exit(f'build: no design-system ref ({ref or "origin/design-system, design-system"}); '
             'fetch it: git fetch origin design-system:refs/remotes/origin/design-system')


def b64(data):
    return base64.b64encode(data).decode('ascii')


def tokens_css(tok):
    """tokens.css from tokens.json: light on :root, dark under the system setting (unless the eye says light) and under [data-theme=dark]."""
    def val(v):
        return re.sub(r'\{([\w-]+)\}', r'var(--\1)', v)
    light, dark, other = [], [], []
    for t in tok['color']['tokens']:
        light.append(f'--{t["name"]}:{val(t["value"]["light"])}')
        if t['value']['dark'] != t['value']['light']:
            dark.append(f'--{t["name"]}:{val(t["value"]["dark"])}')
    for k, v in tok['type']['families'].items():
        other.append(f'--font-{k}:{v}')
    for g in tok['type']['groups']:
        for s in g['styles']:
            n = s['name']
            other.append(f'--type-{n}-size:{s["fontSize"]}')
            other.append(f'--type-{n}-line:{s["lineHeight"]}')
            other.append(f'--type-{n}-weight:{s["fontWeight"]}')
            if 'letterSpacing' in s:
                other.append(f'--type-{n}-tracking:{s["letterSpacing"]}')
    for group in ('spacing', 'radius', 'duration', 'easing', 'zIndex'):
        for t in tok[group]['tokens']:
            other.append(f'--{t["name"]}:{t["value"]}')
    css = ':root{' + ';'.join(light + other) + ';color-scheme:light}\n'
    d = ';'.join(dark) + ';color-scheme:dark'
    css += '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + d + '}}\n'
    css += ':root[data-theme="dark"]{' + d + '}\n'
    return css


# ---------- the page's text, rendered at build time ----------
def esc(t):
    return html.escape(t, quote=False)


def attr(t):
    return html.escape(t, quote=True)


def inline(t):
    """text with [label](url) links"""
    out, last = '', 0
    for m in re.finditer(r'\[([^\]]+)\]\(([^)\s]+)\)', t):
        out += esc(t[last:m.start()]) + f'<a class="ul" href="{attr(m.group(2))}">{esc(m.group(1))}</a>'
        last = m.end()
    return out + esc(t[last:])


def letters(name):
    words = []
    for w in name.split(' '):
        words.append('<span class="w">' + ''.join(f'<span class="nl">{esc(c)}</span>' for c in w) + '</span>')
    return ' '.join(words)


def section(sid, heading, gloss, inner, icon=None, cls=''):
    ic = f'<span class="si aph-icon aph-red" data-icon="{icon}" aria-hidden="true"></span>' if icon else ''
    return (f'<section id="{sid}" class="sec blk {cls}" aria-labelledby="{sid}-h">\n'
            f'<header class="sh rv">{ic}<h2 id="{sid}-h" class="aph-wave aph-ink">{esc(heading)}</h2>'
            f'<span class="gloss aph-ink" lang="la">{esc(gloss)}</span></header>\n{inner}\n</section>')


def render_main(c, previews, seal):
    h = []
    # the hero
    h.append(
        '<section class="hero blk" aria-labelledby="name">\n'
        '<div class="phi-slot" aria-hidden="true"></div>\n'
        f'<span class="gloss-title hi aph-ink" id="nomen" lang="la">{esc(c["nomen"])}</span>\n'
        f'<h1 id="name" class="title aph-ink" data-key="me.name"><span class="sr">{esc(c["name"])}</span>'
        f'<span class="nm" aria-hidden="true">{letters(c["name"])}</span></h1>\n'
        f'<p class="aph-meta meta aph-ink" data-zone data-key="me.meta"><span class="sr">{esc(c["meta"])}</span>'
        f'<span class="typed" aria-hidden="true">{esc(c["meta"])}</span><span class="aph-caret gone" aria-hidden="true"></span></p>\n'
        f'<p class="lede hp aph-ink" data-zone data-key="me.lede">{esc(c["lede"])}</p>\n'
        f'<p class="hp aph-ink" data-zone data-key="me.bio">{esc(c["bio"])}</p>\n'
        '</section>')

    # work: each row is its text and its link's preview (a static stipple mask; the live one is the script's)
    w = c['works']
    items = []
    for it in w['items']:
        tag = f'<span class="aph-meta tag">{esc(it["tag"])}</span>' if it.get('tag') else ''
        pv = previews[it['id']]
        icon = f'<span class="wi aph-icon aph-red" data-icon="{attr(it["icon"])}" aria-hidden="true">' + (f'<span class="wphi">{seal}</span>' if it['icon'] == 'phi' else '') + '</span>'
        items.append(
            f'<li class="work rv aph-ink" data-id="{attr(it["id"])}" data-zone>\n'
            f'<div class="wtxt"><div class="whead">{icon}<a class="ul wname" href="{attr(it["href"])}">{esc(it["name"])}</a>{tag}</div>'
            f'<p data-line>{esc(it["line"])}</p></div>\n'
            f'<a class="pv" href="{attr(it["href"])}" tabindex="-1" aria-hidden="true">'
            f'<span class="pvbox"><span class="pvs" style="--mk-sm:url({pv["sm"]});--mk-lg:url({pv["lg"]})"></span></span>'
            f'<span class="aph-meta pvhost">{esc(host(it["href"]))} ↗</span></a></li>')
    h.append(section('work', w['heading'], w['gloss'], '<ul class="list works">\n' + '\n'.join(items) + '\n</ul>', 'works', 'sec-work'))

    # awards
    a = c['awards']
    items = []
    for it in a['items']:
        note = f'<span class="aph-meta tag">{esc(it["note"])}</span>' if it.get('note') else ''
        items.append(f'<li class="rv aph-ink" data-zone><span class="iname">{esc(it["title"])}</span>{note}<p>{esc(it["line"])}</p></li>')
    h.append(section('awards', a['heading'], a['gloss'], '<ul class="list" id="award-list">\n' + '\n'.join(items) + '\n</ul>', 'sol'))

    # education
    e = c['education']
    items = []
    for it in e['items']:
        items.append(f'<li class="rv aph-ink" data-zone><span class="iname">{esc(it["title"])}</span><span class="aph-meta tag">{esc(it["note"])}</span></li>')
    h.append(section('education', e['heading'], e['gloss'], '<ul class="list" data-key="me.education">\n' + '\n'.join(items) + '\n</ul>', 'book'))

    # tools
    t = c['tools']
    rows = []
    for r in t['rows'] + [t['languages']]:
        rows.append(f'<div class="rv aph-ink" data-zone><dt class="aph-label">{esc(r["label"])}</dt><dd data-key="me.{"tools." + r["key"] if r["key"] != "languages" else "languages"}">{esc(r["text"])}</dd></div>')
    h.append(section('tools', t['heading'], t['gloss'], '<dl class="pairs">\n' + '\n'.join(rows) + '\n</dl>', 'laboratory'))

    # looking, this page
    k = c['looking']
    h.append(section('looking', k['heading'], k['gloss'], f'<p class="rv aph-ink" data-zone data-key="me.looking">{esc(k["text"])}</p>'))
    p = c['page']
    h.append(section('page', p['heading'], p['gloss'], f'<p class="rv aph-ink" data-zone data-key="me.page">{inline(p["text"])}</p>'))

    # contact
    ct = c['contact']
    gh = re.sub(r'^https?://', '', ct['github'])
    inner = (f'<p class="rv aph-ink" data-zone data-key="me.contact">{esc(ct["lede"])}</p>\n'
             '<ul class="pairs">\n'
             f'<li class="rv aph-ink" data-zone><span class="aph-label">email</span><a class="ul email" data-key="me.email" href="mailto:{attr(ct["email"])}">{esc(ct["email"])}</a></li>\n'
             f'<li class="rv aph-ink" data-zone><span class="aph-label">github</span><a class="ul" data-key="me.github" href="{attr(ct["github"])}">{esc(gh)}</a></li>\n'
             '</ul>')
    h.append(section('contact', ct['heading'], ct['gloss'], inner))
    return '\n\n'.join(h)


def render_foot(c):
    ct = c['contact']
    gh = re.sub(r'^https?://', '', ct['github'])
    works = ''.join(f'<a href="{attr(it["href"])}">{esc(it["name"])}</a>' for it in c['works']['items'])
    return (
        '<footer class="foot blk">\n'
        '<nav class="foot-links" aria-label="contact and work">\n'
        f'<p><span class="foot-h gloss aph-ink" lang="la">{esc(ct["gloss"])}</span>'
        f'<a class="aph-ink" data-key="me.email" href="mailto:{attr(ct["email"])}">{esc(ct["email"])}</a>'
        f'<a class="aph-ink" data-key="me.github" href="{attr(ct["github"])}">github</a></p>\n'
        f'<p><span class="foot-h gloss aph-ink" lang="la">{esc(c["works"]["gloss"])}</span>{works}</p>\n'
        '</nav>\n'
        '<p class="made aph-meta aph-ink">made by aphesist · part of <a href="https://aphes.ist/">aφesis</a></p>\n'
        '</footer>')


def host(href):
    """the link's host, and its path unless it is the root: contraprova.aphes.ist, github.com/aphesist/heuresis"""
    u = urlparse(href)
    return u.netloc + (u.path.rstrip('/') if u.path.strip('/') else '')


def r2_field(w, h):
    """a fixed threshold field for stipple cells: R2 low-discrepancy points blended with a hash, so it reads as blue noise"""
    ys, xs = np.mgrid[0:h, 0:w]
    r2 = (xs * 0.7548776662466927 + ys * 0.5698402909980532) % 1.0
    k = (xs * 374761393 + ys * 668265263) & 0xFFFFFFFF
    k = ((k ^ (k >> 13)) * 1274126177) & 0xFFFFFFFF
    k = (k ^ (k >> 16)) & 0xFFFFFFFF
    return 0.7 * r2 + 0.3 * (k / 4294967295.0), (((k * 2654435761) >> 7) & 0xFFFF) / 65535.0


def thicken(img, r=5, blur=1.4, gain=1.5):
    """thin strokes (page text at 560px) would vanish at the preview's size: widen and soften them first"""
    im = img.filter(ImageFilter.MaxFilter(r)).filter(ImageFilter.GaussianBlur(blur))
    return Image.fromarray((np.clip(np.asarray(im, dtype=float) / 255 * gain, 0, 1) * 255).astype('uint8'))


def static_mask(img, w, h, cell=2, ceiling=0.9, lost=0.09):
    """a density map as a 1-bit mask of square cells (cell px), as a PNG data URI: some lost points, a ceiling near .9.
    The map is cropped to the box's aspect (the preview is 16:10 on wide screens, 16:9 on phones)."""
    sw, sh = img.size
    if sw / sh > w / h:
        nw = round(sh * w / h); img = img.crop(((sw - nw) // 2, 0, (sw - nw) // 2 + nw, sh))
    else:
        nh = round(sw * h / w); img = img.crop((0, (sh - nh) // 2, sw, (sh - nh) // 2 + nh))
    gw, gh = w // cell, h // cell
    d = np.asarray(img.resize((gw, gh), Image.BOX), dtype=float) / 255.0
    thr, rnd = r2_field(gw, gh)
    lit = (np.minimum(d, ceiling) > thr) & (rnd > lost)
    big = np.kron(lit, np.ones((cell, cell))).astype(np.uint8)
    out = Image.fromarray(big, 'P')
    out.putpalette([0, 0, 0, 0, 0, 0])
    buf = io.BytesIO(); out.save(buf, 'PNG', optimize=True, transparency=0)
    return 'data:image/png;base64,' + b64(buf.getvalue())


def preview_data(c):
    """per work: its two static masks (desktop 210x131, phone 320x180) and the density map the live simulacrum uses"""
    pre, live = {}, {}
    for it in c['works']['items']:
        path = os.path.join(HERE, 'previews', it['id'] + '.png')
        if not os.path.exists(path):
            sys.exit(f'build: previews/{it["id"]}.png is missing; run: node me/tools/capture_previews.mjs {it["id"]}')
        img = thicken(Image.open(path).convert('L'))
        pre[it['id']] = {'sm': static_mask(img, 210, 130), 'lg': static_mask(img, 320, 180)}
        small = img.resize((420, 262), Image.LANCZOS).point(lambda v: v // 8 * 8)   # already thickened
        buf = io.BytesIO(); small.save(buf, 'PNG', optimize=True)
        live[it['id']] = {'src': 'data:image/png;base64,' + b64(buf.getvalue())}
    return pre, live


def jsjson(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')


# ---------- the whole page ----------
def build(args):
    sha, ref = resolve(args.ref)

    def ds(path, binary=False):
        return git('show', f'{sha}:system/{path}', binary=binary)

    raw = open(os.path.join(HERE, 'content', 'me.json'), encoding='utf-8').read()
    left = sorted(set(PLACEHOLDER.findall(raw)))
    if left:
        print('placeholders still in me/content/me.json: ' + ', '.join(f'[[{p}]]' for p in left), file=sys.stderr)
        if args.require_filled:
            sys.exit('build: fill them before deploying (or build without --require-filled to preview)')
    c = json.loads(raw)

    tok = json.loads(ds('tokens.json'))
    faces = (
        '@font-face{font-family:"Aphesis Script";src:url(data:font/woff2;base64,' + b64(ds('fonts/AphesisScript-VF.woff2', True)) +
        ') format("woff2");font-weight:300 800;font-display:block}\n'
        '@font-face{font-family:"Special Elite";src:url(data:font/woff2;base64,' + b64(ds('lab-kit/v1/fonts/SpecialElite-latin.woff2', True)) +
        ') format("woff2");font-display:block;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,'
        'U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n')
    # bundle.css imports Special Elite from Google Fonts; the page embeds it instead (no request at all)
    bcss = re.sub(r'@import url\([^)]*\);\s*', '', ds('components/bundle.css'))
    css = faces + tokens_css(tok) + bcss + open(os.path.join(HERE, 'src', 'me.css'), encoding='utf-8').read()

    bundle = ds('components/bundle.js')
    if bundle.count(REDUCED_LINE) != 1:
        sys.exit(f'build: expected exactly one "{REDUCED_LINE}" in bundle.js ({ref} {sha[:7]}), found {bundle.count(REDUCED_LINE)}; '
                 'the runtime changed, so the reduced-motion patch needs a look')
    bundle = bundle.replace(REDUCED_LINE, REDUCED_PATCH)

    # the φ and the seal, from the runtime's own PHI (so the page shows the seal before any script runs)
    m = re.search(r"var PHI = \{ viewBox: '([^']+)', d: '([^']+)'", bundle)
    if not m:
        sys.exit('build: no PHI in bundle.js')
    vb, phi_d = m.group(1), m.group(2)
    seal = (f'<svg viewBox="{vb}" aria-hidden="true" style="width:100%;height:100%;display:block;overflow:visible">'
            f'<path d="{phi_d}" fill="currentColor" fill-rule="evenodd"/></svg>')

    frames = json.load(open(os.path.join(REPO, 'tools', 'readme', 'engine_frames.json'), encoding='utf-8'))
    phi_svg = ds('assets/Logos/phi.svg', True)
    favicon = 'data:image/svg+xml;base64,' + b64(phi_svg)

    api = args.content_api
    if api and not re.match(r'^https?://[^\s"\'<>]+$', api):
        sys.exit('--content-api is an http(s) URL')
    previews, live = preview_data(c)
    config = {'api': api.rstrip('/'), 'maps': live, 'frames': {'dur': frames['dur'], 'frames': frames['frames']}}

    tpl = open(os.path.join(HERE, 'src', 'template.html'), encoding='utf-8').read()
    js = open(os.path.join(HERE, 'src', 'me.js'), encoding='utf-8').read()
    page = (tpl.replace('<!--__MAIN__-->', render_main(c, previews, seal))
            .replace('<!--__FOOT__-->', render_foot(c))
            .replace('__SEAL__', seal)
            .replace('__FAVICON__', favicon)
            .replace('__TITLE__', esc(c['title'])).replace('__DESCRIPTION__', attr(c['description']))
            .replace('__OGDESC__', attr(c['og_description']))
            .replace('/*__CSS__*/', css)
            .replace('/*__BUNDLE__*/', bundle)
            .replace('/*__CONFIG__*/', 'window.__ME=' + jsjson(config) + ';')
            .replace('/*__SCRIPT__*/', js))
    return page, phi_svg, f'{ref} {sha[:7]}'


def wrap(page, fragment):
    head_meta = '<meta charset="utf-8">\n'
    if fragment:
        return head_meta + page.replace('<!--__BODY__-->', '', 1)
    return ('<!doctype html>\n<html lang="en">\n<head>\n' + head_meta +
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
            page.replace('<!--__BODY__-->', '</head>\n<body>', 1) + '\n</body>\n</html>\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--out', default='dist')
    ap.add_argument('--fragment', metavar='FILE', help='also write the page without doctype/html/head/body tags')
    ap.add_argument('--content-api', default=os.environ.get('APHESIS_CONTENT_API', ''), help='the content service (default: $APHESIS_CONTENT_API; none = no network at all)')
    ap.add_argument('--ref', help='where the design system comes from (default: origin/design-system, else design-system)')
    ap.add_argument('--require-filled', action='store_true', help='fail while a [[placeholder]] is left in the content')
    a = ap.parse_args()

    # the fragment is the head's title, meta and style (and its script) and the body, with the tags themselves left out
    page, phi_svg, src = build(a)
    # the fragment keeps the viewport meta out: the host adds its own skeleton
    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(wrap(page, False))
    with open(os.path.join(out, 'phi.svg'), 'wb') as f:
        f.write(phi_svg)
    pub = os.path.join(HERE, 'public')
    for n in os.listdir(pub):
        with open(os.path.join(pub, n), 'rb') as s, open(os.path.join(out, n), 'wb') as d:
            d.write(s.read())
    if a.fragment:
        os.makedirs(os.path.dirname(os.path.abspath(a.fragment)), exist_ok=True)
        with open(a.fragment, 'w', encoding='utf-8') as f:
            f.write(wrap(page, True))
    size = os.path.getsize(os.path.join(out, 'index.html'))
    print(f'{out}: index.html {size // 1024} KB from {src}' + (f', fragment {a.fragment}' if a.fragment else '') +
          (f', content api {a.content_api}' if a.content_api else ', no content api'))


if __name__ == '__main__':
    main()
