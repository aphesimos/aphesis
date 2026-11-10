"""Build book/index.html: the book section as one self-contained page.

Everything the page needs is inlined: tokens.css (generated from the design system's tokens.json),
bundle.css and bundle.js, the two faces, the density maps the entries use, the entries themselves and the section's
own modules. The design system is read from the `design-system` branch with `git show`, so this branch never copies it.
Special Elite (Astigmatic, Apache License 2.0, vendor/SpecialElite-LICENSE.txt) is not in the design system, which
loads it from Google Fonts; it is vendored here so the page carries both faces.

  python3 book/build.py                 # writes book/index.html (a full document)
  python3 book/build.py --fragment OUT  # writes the same page without <!doctype>/<html>/<head>/<body>

Entries live in content/, one markdown file each, read in file-name order (see README.md). The modules in src/ are
plain ES modules with named exports; for this page they are concatenated in dependency order into one script, each in
its own function scope (imports read from a registry). In the Astro site they can be imported as they are, with
src/entries.js generated from the content collection instead.
"""
import base64, html, json, os, re, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(D)
DS = 'design-system'


def ds(path, binary=False):
    out = subprocess.run(['git', '-C', REPO, 'show', f'{DS}:system/{path}'], capture_output=True, check=True).stdout
    return out if binary else out.decode('utf-8')


def b64(data):
    return base64.b64encode(data).decode('ascii')


# ---------- tokens.css from tokens.json ----------
def tokens_css(tok):
    def val(v):
        return re.sub(r'\{([\w-]+)\}', r'var(--\1)', v)
    light, dark = [], []
    for t in tok['color']['tokens']:
        light.append(f'--{t["name"]}:{val(t["value"]["light"])}')
        if t['value']['dark'] != t['value']['light']:
            dark.append(f'--{t["name"]}:{val(t["value"]["dark"])}')
    other = []
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


# ---------- entries from content/*.md ----------
FIELDS = {'title', 'author', 'year', 'map', 'caption', 'quote', 'quote_lang', 'quote_en', 'example', 'example_note',
          'gain', 'scatter', 'erosion', 'ceiling', 'crop', 'blur', 'contrast', 'brightness'}
REQUIRED = ('title', 'author', 'year', 'map', 'caption')
NUMBERS = ('gain', 'scatter', 'erosion', 'ceiling', 'blur', 'contrast', 'brightness')


def scalar(v):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
        return v[1:-1]
    if v in ('true', 'false'):
        return v == 'true'
    return v


def read_entry(path):
    text = open(path, encoding='utf-8').read().replace('\r\n', '\n')
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', text, flags=re.S)
    if not m:
        sys.exit(f'{path}: no front matter (--- ... ---)')
    meta = {}
    for line in m.group(1).split('\n'):
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        k, sep, v = line.partition(':')
        k = k.strip()
        if not sep or k not in FIELDS:
            sys.exit(f'{path}: unknown front matter line: {line!r}')
        meta[k] = scalar(v)
    for k in REQUIRED:
        if not meta.get(k):
            sys.exit(f'{path}: missing "{k}"')
    for k in NUMBERS:
        if k in meta:
            meta[k] = float(meta[k])
    if 'crop' in meta:
        meta['crop'] = [float(v) for v in str(meta['crop']).replace(',', ' ').split()]
        if len(meta['crop']) != 4:
            sys.exit(f'{path}: crop is x y width height, in map pixels')
    paras = [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'\n\s*\n', m.group(2).strip()) if p.strip()]
    words = sum(len(p.split()) for p in paras)
    if not 60 <= words <= 200:
        print(f'warning: {os.path.basename(path)}: the note has {words} words (60 to 200 read best)', file=sys.stderr)
    slug = re.sub(r'^\d+[-_]', '', os.path.splitext(os.path.basename(path))[0])
    entry = {'slug': slug, 'note': paras}
    entry.update(meta)
    entry['example'] = bool(meta.get('example', False))
    return entry


def entries():
    folder = os.path.join(D, 'content')
    files = sorted(f for f in os.listdir(folder) if f.endswith('.md') and not f.startswith('_'))
    out = [read_entry(os.path.join(folder, f)) for f in files]
    if not out:
        sys.exit('content/: no entries')
    return out


def entries_module(items):
    maps = {}
    for e in items:
        f = e['map']
        if f not in maps:
            mime = 'image/png' if f.endswith('.png') else 'image/jpeg'
            try:
                data = ds('assets/Simulacra/' + f, True)
            except subprocess.CalledProcessError:
                sys.exit(f'{e["slug"]}: no density map "{f}" in {DS}:system/assets/Simulacra/')
            maps[f] = f'data:{mime};base64,{b64(data)}'
    return ('export const MAPS = ' + json.dumps(maps) + ';\n'
            'export const ENTRIES = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';\n')


# ---------- modules ----------
ORDER = ['entries.js', 'content.js', 'motion.js', 'numerals.js', 'plate.js', 'leaf.js', 'turning.js', 'main.js']


def scope_module(name, src):
    """One module as a function scope: its imports read from the registry, its exports return to it."""
    base = os.path.dirname(name)

    def imp(m):
        names, path = m.group(1), m.group(2)
        key = os.path.normpath(os.path.join(base, path)).replace(os.sep, '/')
        return 'const {' + names + '} = M[' + json.dumps(key) + '];'
    src = re.sub(r'^import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"];\s*$', imp, src, flags=re.M)
    exports = re.findall(r'^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)', src, flags=re.M)
    src = re.sub(r'^export\s+', '', src, flags=re.M)
    return 'M[' + json.dumps(name) + '] = (function () {\n' + src + '\nreturn { ' + ', '.join(exports) + ' };\n})();'


def script(items):
    parts = []
    for f in ORDER:
        src = entries_module(items) if f == 'entries.js' else open(os.path.join(D, 'src', f), encoding='utf-8').read()
        if f == 'content.js':
            src = src.replace("/*__CONTENT_API__*/''", json.dumps(CONTENT_API))
        parts.append(f'/* ---- {f} ---- */\n' + scope_module(f, src))
    return '(function () {\n"use strict";\nconst M = {};\n' + '\n'.join(parts) + '\n})();'


def build(fragment):
    tok = json.loads(ds('tokens.json'))
    items = entries()
    font_vf = b64(ds('fonts/AphesisScript-VF.woff2', True))
    se = {k: b64(open(os.path.join(D, 'vendor', f'SpecialElite-{k}.woff2'), 'rb').read()) for k in ('latin', 'latin-ext')}
    faces = (
        '@font-face{font-family:"Aphesis Script";src:url(data:font/woff2;base64,' + font_vf + ') format("woff2");font-weight:300 800;font-display:block}\n'
        '@font-face{font-family:"Special Elite";src:url(data:font/woff2;base64,' + se['latin'] + ') format("woff2");font-display:block;'
        'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n'
        '@font-face{font-family:"Special Elite";src:url(data:font/woff2;base64,' + se['latin-ext'] + ') format("woff2");font-display:block;'
        'unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}\n'
    )
    # bundle.css imports Special Elite from Google Fonts; the page embeds it instead
    bcss = re.sub(r'@import url\([^)]*\);\s*', '', ds('components/bundle.css'))
    css = faces + tokens_css(tok) + bcss + open(os.path.join(D, 'src', 'book.css'), encoding='utf-8').read()
    body = open(os.path.join(D, 'src', 'template.html'), encoding='utf-8').read()
    # the first entry is in the markup, so the page reads before its script runs and without it
    first = items[0]
    body = body.replace('<!--__TITLE__-->', html.escape(first['title']))
    js = ds('components/bundle.js')
    page = body.replace('/*__CSS__*/', css).replace('/*__BUNDLE__*/', js).replace('/*__SCRIPT__*/', script(items))
    if not fragment:
        page = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' \
               '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + \
               page.replace('<!--__BODY__-->', '</head>\n<body>', 1) + '\n</body>\n</html>\n'
    else:
        page = '<meta charset="utf-8">\n' + page.replace('<!--__BODY__-->', '', 1)
    return page


CONTENT_API = os.environ.get('APHESIS_CONTENT_API', '')


if __name__ == '__main__':
    if '--content-api' in sys.argv:
        i = sys.argv.index('--content-api')
        CONTENT_API = sys.argv[i + 1]
        del sys.argv[i:i + 2]
    if CONTENT_API and not re.match(r'^https?://[^\s"\'<>]+$', CONTENT_API):
        sys.exit('--content-api is an http(s) URL')
    if len(sys.argv) > 2 and sys.argv[1] == '--fragment':
        out, frag = sys.argv[2], True
    else:
        out, frag = os.path.join(D, 'index.html'), False
    page = build(frag)
    open(out, 'w', encoding='utf-8').write(page)
    print(out, len(page))
