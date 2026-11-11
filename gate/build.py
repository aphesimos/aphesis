"""Build gate/index.html: the owner's gate and desk as one self-contained page, and the entrances for the shell.

  python3 gate/build.py                          # gate/index.html (a full document)
  python3 gate/build.py --fragment OUT           # the same page without <!doctype>/<html>/<head>/<body>, for the shell
  python3 gate/build.py --content-api URL        # the content service it talks to (or APHESIS_CONTENT_API)
  python3 gate/build.py --mock                   # a demo that answers from memory (password "solve et coagula",
                                                 #   words "ignis lapis aurum"); never deployed
  python3 gate/build.py --entrances OUT          # entrances.js for the shell, with the phrase and the route hashed
                                                 #   from APHESIS_GATE_PHRASE and APHESIS_GATE_ROUTE

Nothing is copied from other branches; they are read with git:
  design-system    tokens.json, components/bundle.css and bundle.js, the Aphesis Script font
  section/archive  archive/src/render.js, stage-icon.js, marks.js, figure.js and archive.css: the preview of a post is
                   drawn by the archive's own modules under its own stylesheet (scoped here to .gp-archive)
  section/forum    forum/src/density.js: a picture becomes a density map in the browser by the forum's rules
  section/book, section/works, design-system maps: only for --mock, the demo's content
Each ref may be overridden (ARCHIVE_REF, FORUM_REF, BOOK_REF, WORKS_REF) and falls back to origin/<ref>.
Special Elite is vendored in vendor/ (Apache License 2.0), as in the other sections.

The modules in src/ are plain ES modules, concatenated in dependency order into one script, each in its own function
scope (imports read from a registry), as every section's build does.
"""
import base64, hashlib, json, os, re, secrets, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(D)


def git(*args, binary=False):
    out = subprocess.run(['git', '-C', REPO] + list(args), capture_output=True, check=True).stdout
    return out if binary else out.decode('utf-8')


def ref(name, env):
    want = os.environ.get(env, name)
    for r in (want, 'origin/' + want):
        if subprocess.run(['git', '-C', REPO, 'rev-parse', '--verify', '-q', r], capture_output=True).returncode == 0:
            return r
    sys.exit(f'no ref {want}: fetch it (git fetch origin {want}:{want})')


def show(r, path, binary=False):
    return git('show', f'{r}:{path}', binary=binary)


def names(r, path):
    """The file names in a folder of a ref, or none when the ref has no such folder (a section with no content)."""
    try:
        return git('ls-tree', '--full-tree', '--name-only', f'{r}:{path}').split()
    except subprocess.CalledProcessError:
        return []


def ds(path, binary=False):
    return show(ref('design-system', 'DS_REF'), 'system/' + path, binary)


def b64(data):
    return base64.b64encode(data).decode('ascii')


# ---------- tokens.css from tokens.json (the same rules every section's build uses) ----------
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


# ---------- the archive's stylesheet, scoped to the preview ----------
DROP = re.compile(r'^(html|body|:root|#fog|#seal|#scroller|#controls|#bTheme|#announce|#codex\b)')


def scope_selector(sel, scope):
    sel = sel.strip()
    if not sel or DROP.match(sel):
        return None
    m = re.match(r'^((?:\.aph-shifting|\.is-dark|\[data-theme[^\]]*\]|\.aph-still)\S*)\s+(.*)$', sel)
    if m:
        return f'{m.group(1)} {scope} {m.group(2)}'
    return f'{scope} {sel}'


def scope_css(css, scope):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        head = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            depth += {'{': 1, '}': -1}.get(css[k], 0)
            k += 1
        body = css[j + 1:k - 1]
        if head.startswith('@media') or head.startswith('@supports'):
            inner = scope_css(body, scope)
            if inner.strip():
                out.append(f'{head}{{{inner}}}')
        elif head.startswith('@'):
            out.append(f'{head}{{{body}}}')
        else:
            sels = [s for s in (scope_selector(x, scope) for x in head.split(',')) if s]
            if sels:
                out.append(','.join(sels) + '{' + body.strip() + '}')
        i = k
    return '\n'.join(out)


# ---------- the demo's content (only with --mock) ----------
def front(text):
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', text.replace('\r\n', '\n'), re.S)
    meta = {}
    for line in m.group(1).split('\n'):
        if ':' in line and not line.strip().startswith('#'):
            k, v = line.split(':', 1)
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
                v = v[1:-1]
            meta[k.strip()] = v
    return meta, m.group(2)


def mock_data():
    media = {}

    def pic(data, name):
        mime = 'image/png' if name.endswith('.png') else 'image/jpeg'
        key = 'm/' + hashlib.sha256(data).hexdigest()[:24] + ('.png' if name.endswith('.png') else '.jpg')
        url = f'data:{mime};base64,{b64(data)}'
        media[key] = url
        w, h = size(data)
        return {'key': key, 'w': w, 'h': h, 'url': url}
    AR, BR, WR = ref('section/archive', 'ARCHIVE_REF'), ref('section/book', 'BOOK_REF'), ref('section/works', 'WORKS_REF')
    maps = {'trismegistus': 'trismegistus.png', 'jerome': 'jerome.jpg', 'alchemist': 'alchemist.jpg', 'flammarion': 'flammarion.png',
            'cagnacci': 'cagnacci.jpg', 'magdalen': 'magdalen.jpg', 'newton': 'newton.jpg', 'paradiso': 'paradiso.jpg', 'faust': 'faust.jpg'}
    posts = []
    for f in sorted(names(AR, 'archive/content')):
        if not f.endswith('.md'):
            continue
        meta, body = front(show(AR, f'archive/content/{f}'))
        notes = []

        def take(m):
            notes.append({'id': m.group(1), 'text': re.sub(r'\s*\n\s*', ' ', m.group(2).strip())})
            return ''
        body = re.sub(r'^\[\^([\w-]+)\]:\s*(.+(?:\n(?!\n|\[\^).+)*)', take, body, flags=re.M)
        body = re.sub(r'\n{3,}', '\n\n', body).strip()
        figs = []
        for name in dict.fromkeys(re.findall(r'^!\[[^\]]*\]\(simulacrum:([\w-]+)\)\s*$', body, flags=re.M)):
            figs.append(dict(pic(ds('assets/Simulacra/' + maps[name], True), maps[name]), name=name))
        posts.append({'slug': f[:-3], 'title': meta['title'], 'summary': meta['summary'], 'stage': meta['stage'], 'date': meta['date'],
                      'example': meta.get('example', '').lower() == 'true', 'body': body, 'notes': notes, 'figures': figs})
    posts.sort(key=lambda p: (p['date'], p['slug']), reverse=True)
    books = []
    for i, f in enumerate(sorted(x for x in names(BR, 'book/content') if x.endswith('.md'))[:3]):
        meta, body = front(show(BR, f'book/content/{f}'))
        adjust = {k: float(meta[k]) for k in ('gain', 'scatter', 'erosion', 'ceiling', 'blur', 'contrast', 'brightness') if k in meta}
        if 'crop' in meta:
            adjust['crop'] = [float(x) for x in meta['crop'].replace(',', ' ').split()]
        books.append({'slug': re.sub(r'^\d+[-_]', '', f[:-3]), 'title': meta['title'], 'author': meta['author'], 'year': meta['year'],
                      'note': [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'\n\s*\n', body.strip()) if p.strip()],
                      'quote': meta.get('quote', ''), 'quote_lang': meta.get('quote_lang', ''), 'quote_en': meta.get('quote_en', ''),
                      'caption': meta['caption'], 'picture': pic(ds('assets/Simulacra/' + meta['map'], True), meta['map']), 'adjust': adjust,
                      'position': i + 1, 'example': meta.get('example') == 'true'})
    works = []
    for i, w in enumerate(json.loads(show(WR, 'works/content/works.json'))['works']):
        m = dict(pic(show(WR, 'works/maps/' + w['map']['file'], True), w['map']['file']), caption=w['map']['caption'], settings=w['map'].get('settings', {}))
        works.append({k: w[k] for k in ('id', 'name', 'gloss', 'gloss_tip', 'year', 'role', 'description', 'links')} |
                     {'map': m, 'sources': w.get('sources', {}), 'flags': w.get('flags', {}), 'position': i + 1})
    return 'export const MOCK = ' + json.dumps({'posts': posts, 'books': books, 'works': works, 'media': media}, ensure_ascii=False) + ';\n'


def size(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        return int.from_bytes(b[16:20], 'big'), int.from_bytes(b[20:24], 'big')
    o = 2
    while o + 9 < len(b):
        if b[o] != 0xff:
            o += 1
            continue
        m = b[o + 1]
        if m in (0xd8, 0x01) or 0xd0 <= m <= 0xd7 or m == 0xff:
            o += 1 if m == 0xff else 2
            continue
        if 0xc0 <= m <= 0xcf and m not in (0xc4, 0xc8, 0xcc):
            return int.from_bytes(b[o + 7:o + 9], 'big'), int.from_bytes(b[o + 5:o + 7], 'big')
        o += 2 + int.from_bytes(b[o + 2:o + 4], 'big')
    return 0, 0


# ---------- modules ----------
ORDER = ['config.js', 'archive/assets.js', 'archive/render.js', 'archive/stage-icon.js', 'archive/marks.js', 'archive/figure.js',
         'archive/css.js', 'forum/density.js', 'mockdata.js', 'mock.js', 'ui.js', 'api.js', 'eye.js', 'line.js',
         'ed-archive.js', 'ed-entries.js', 'moderation.js', 'dash.js', 'main.js']


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


def module_source(f, opts):
    AR, FR = ref('section/archive', 'ARCHIVE_REF'), ref('section/forum', 'FORUM_REF')
    if f == 'config.js':
        return open(os.path.join(D, 'src', f), encoding='utf-8').read().replace(
            "/*__CONFIG__*/{ api: '', mock: false }", json.dumps({'api': opts['api'], 'mock': opts['mock']}))
    if f == 'archive/assets.js':
        return '/* the archive preview names every map by URL (data-src): it needs none of the build\'s own */\nexport const MAPS = {};\n'
    if f == 'archive/css.js':
        return 'export const ARCHIVE_CSS = ' + json.dumps(scope_css(show(AR, 'archive/src/archive.css'), '.gp-archive')) + ';\n'
    if f.startswith('archive/'):
        return show(AR, 'archive/src/' + f[8:])
    if f == 'forum/density.js':
        return show(FR, 'forum/src/density.js')
    if f == 'mockdata.js':
        return mock_data() if opts['mock'] else 'export const MOCK = null;\n'
    if f == 'mock.js' and not opts['mock']:
        return 'export const createMockApi = null;\n'
    return open(os.path.join(D, 'src', f), encoding='utf-8').read()


def script(opts):
    parts = [f'/* ---- {f} ---- */\n' + scope_module(f, module_source(f, opts)) for f in ORDER]
    return '(function () {\n"use strict";\nconst M = {};\n' + '\n'.join(parts) + '\n})();'


def build(fragment, opts):
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
    css = faces + tokens_css(tok) + bcss + open(os.path.join(D, 'src', 'gate.css'), encoding='utf-8').read()
    body = open(os.path.join(D, 'src', 'template.html'), encoding='utf-8').read()
    page = body.replace('/*__CSS__*/', css).replace('/*__BUNDLE__*/', ds('components/bundle.js')).replace('/*__SCRIPT__*/', script(opts))
    if fragment:
        return '<meta charset="utf-8">\n' + page.replace('<!--__BODY__-->', '', 1)
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            + page.replace('<!--__BODY__-->', '</head>\n<body>', 1) + '\n</body>\n</html>\n')


# ---------- the entrances, for the shell ----------
ITERATIONS = 60000


def norm(s):
    import unicodedata
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', s).lower()).strip()


def entrances():
    phrase, route = norm(os.environ.get('APHESIS_GATE_PHRASE', '')), norm(os.environ.get('APHESIS_GATE_ROUTE', '').lstrip('#'))
    cfg = None
    if phrase or route:
        if phrase and len(phrase) < 8:
            sys.exit('APHESIS_GATE_PHRASE: at least 8 characters (a few words is best)')
        if route and len(route) < 8:
            sys.exit('APHESIS_GATE_ROUTE: at least 8 characters')
        salt = os.environ.get('APHESIS_GATE_SALT') or secrets.token_hex(16)
        h = lambda s: hashlib.pbkdf2_hmac('sha256', s.encode('utf-8'), bytes.fromhex(salt), ITERATIONS).hex()
        cfg = {'salt': salt, 'iterations': ITERATIONS, 'phrase': {'len': len(phrase), 'hash': h(phrase)} if phrase else None, 'route': h(route) if route else None}
    src = open(os.path.join(D, 'src', 'entrances.js'), encoding='utf-8').read()
    return src.replace('/*__ENTRANCES__*/null', json.dumps(cfg))


if __name__ == '__main__':
    args = sys.argv[1:]
    opts = {'api': os.environ.get('APHESIS_CONTENT_API', ''), 'mock': False}
    if '--content-api' in args:
        i = args.index('--content-api'); opts['api'] = args[i + 1]; del args[i:i + 2]
    if opts['api'] and not re.match(r'^https?://[^\s"\'<>]+$', opts['api']):
        sys.exit('--content-api is an http(s) URL')
    if '--mock' in args:
        args.remove('--mock'); opts['mock'] = True
    if args and args[0] == '--entrances':
        open(args[1], 'w', encoding='utf-8').write(entrances())
        print(args[1])
        sys.exit(0)
    frag = bool(args) and args[0] == '--fragment'
    out = args[1] if frag else os.path.join(D, 'index.html')
    page = build(frag, opts)
    open(out, 'w', encoding='utf-8').write(page)
    print(out, len(page))
