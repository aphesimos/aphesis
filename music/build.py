"""Build music/index.html: the music section (phonotheca) as one self-contained page.

  python3 music/build.py                          # music/index.html, with the bundled example library
  python3 music/build.py --index URL              # the same page reading the real library from URL (index.json)
  python3 music/build.py --fragment OUT           # also the page without <!doctype>/<html>/<head>/<body>
  python3 music/build.py --index URL --fragment OUT

Everything the page needs is inlined: tokens.css (generated from the design system's tokens.json), bundle.css
and bundle.js, the two faces and the section's modules. The design system is read from the `design-system` branch
with `git show`, so this branch never copies it. Special Elite (Astigmatic, Apache License 2.0,
vendor/SpecialElite-LICENSE.txt) is vendored here so the page carries both faces.

Without --index the page carries the example library in mock/out: generated tones run through tools/sync.py
(see README.md), inlined as data and played from object URLs. With --index it carries no audio at all: it fetches
index.json from that URL and resolves the tracks, streams and maps against it (the R2 bucket's public domain).

The modules in src/ are plain ES modules with named exports, concatenated here in dependency order into one
script, each in its own function scope (imports read from a registry), as the other sections do.
"""
import base64, json, os, re, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(D)
DS = 'design-system'
MOCK = os.path.join(D, 'mock', 'out')
ORDER = ['assets.js', 'glyphs.js', 'stipple.js', 'library.js', 'vlist.js', 'player.js', 'view.js', 'main.js']
TYPES = {'.flac': 'audio/flac', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png'}


def ds(path, binary=False):
    out = subprocess.run(['git', '-C', REPO, 'show', f'{DS}:system/{path}'], capture_output=True, check=True).stdout
    return out if binary else out.decode('utf-8')


def b64(data):
    return base64.b64encode(data).decode('ascii')


def tokens_css(tok):
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
            other += [f'--type-{n}-size:{s["fontSize"]}', f'--type-{n}-line:{s["lineHeight"]}', f'--type-{n}-weight:{s["fontWeight"]}']
            if 'letterSpacing' in s:
                other.append(f'--type-{n}-tracking:{s["letterSpacing"]}')
    for group in ('spacing', 'radius', 'duration', 'easing', 'zIndex'):
        for t in tok[group]['tokens']:
            other.append(f'--{t["name"]}:{t["value"]}')
    d = ';'.join(dark) + ';color-scheme:dark'
    return (':root{' + ';'.join(light + other) + ';color-scheme:light}\n'
            '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + d + '}}\n'
            ':root[data-theme="dark"]{' + d + '}\n')


def assets_module(index_url):
    np_css = open(os.path.join(D, 'src', 'np.css'), encoding='utf-8').read()
    lines = [f'export const NP_CSS = {json.dumps(np_css)};', f'export const INDEX_URL = {json.dumps(index_url)};']
    if index_url:
        lines.append('export const MOCK = null;')
    else:
        doc = json.load(open(os.path.join(MOCK, 'index.json'), encoding='utf-8'))
        keys = set()
        for t in doc['tracks']:
            keys.update(t[k].split('?')[0] for k in ('orig', 'stream') if t.get(k))
        keys.update(c['map'] for c in doc['covers'].values())
        files = {}
        for k in sorted(keys):
            files[k] = {'type': TYPES[os.path.splitext(k)[1]], 'b64': b64(open(os.path.join(MOCK, *k.split('/')), 'rb').read())}
        lines.append('export const MOCK = ' + json.dumps({'index': doc, 'files': files}, ensure_ascii=False, separators=(',', ':')) + ';')
    return '\n'.join(lines)


def scope_module(name, src):
    """One module as a function scope: its imports read from the registry, its exports return to it."""
    def imp(m):
        return 'const {' + m.group(1) + '} = M[' + json.dumps(os.path.normpath(m.group(2)).replace(os.sep, '/')) + '];'
    src = re.sub(r'^import\s*\{([^}]*)\}\s*from\s*[\'"]\./([^\'"]+)[\'"];\s*$', imp, src, flags=re.M)
    exports = re.findall(r'^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)', src, flags=re.M)
    src = re.sub(r'^export\s+', '', src, flags=re.M)
    return 'M[' + json.dumps(name) + '] = (function () {\n' + src + '\nreturn { ' + ', '.join(exports) + ' };\n})();'


def script(index_url):
    parts = []
    for f in ORDER:
        src = assets_module(index_url) if f == 'assets.js' else open(os.path.join(D, 'src', f), encoding='utf-8').read()
        parts.append(f'/* ---- {f} ---- */\n' + scope_module(f, src))
    return '(function () {\n"use strict";\nconst M = {};\n' + '\n'.join(parts) + '\n})();'


def build(fragment, index_url):
    tok = json.loads(ds('tokens.json'))
    font_vf = b64(ds('fonts/AphesisScript-VF.woff2', True))
    se = {k: b64(open(os.path.join(D, 'vendor', f'SpecialElite-{k}.woff2'), 'rb').read()) for k in ('latin', 'latin-ext')}
    faces = (
        '@font-face{font-family:"Aphesis Script";src:url(data:font/woff2;base64,' + font_vf + ') format("woff2");font-weight:300 800;font-display:block}\n'
        '@font-face{font-family:"Special Elite";src:url(data:font/woff2;base64,' + se['latin'] + ') format("woff2");font-display:block;'
        'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n'
        '@font-face{font-family:"Special Elite";src:url(data:font/woff2;base64,' + se['latin-ext'] + ') format("woff2");font-display:block;'
        'unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}\n'
    )
    bcss = re.sub(r'@import url\([^)]*\);\s*', '', ds('components/bundle.css'))
    css = faces + tokens_css(tok) + bcss + open(os.path.join(D, 'src', 'music.css'), encoding='utf-8').read()
    body = open(os.path.join(D, 'src', 'template.html'), encoding='utf-8').read()
    page = (body.replace('/*__CSS__*/', css)
            .replace('/*__BUNDLE__*/', ds('components/bundle.js'))
            .replace('/*__SCRIPT__*/', script(index_url)))
    if not fragment:
        return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
                + page.replace('<!--__BODY__-->', '</head>\n<body>', 1) + '\n</body>\n</html>\n')
    return '<meta charset="utf-8">\n' + page.replace('<!--__BODY__-->', '', 1)


if __name__ == '__main__':
    args = sys.argv[1:]
    index_url, frag_out = None, None
    while args:
        a = args.pop(0)
        if a == '--index':
            index_url = args.pop(0)
        elif a == '--fragment':
            frag_out = args.pop(0)
        else:
            sys.exit(__doc__)
    page = build(False, index_url)
    out = os.path.join(D, 'index.html')
    open(out, 'w', encoding='utf-8').write(page)
    print(out, len(page))
    if frag_out:
        frag = build(True, index_url)
        open(frag_out, 'w', encoding='utf-8').write(frag)
        print(frag_out, len(frag))
