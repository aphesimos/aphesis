"""Build laboratory/index.html: the laboratory section as one self-contained page.

Everything the page needs is inlined: tokens.css (generated from the design system's tokens.json), bundle.css and
bundle.js, the two faces, the experiments' content files and the section's own modules.
The design system is read from the `design-system` branch with `git show`, so this branch never copies it.
Special Elite (Astigmatic, Apache License 2.0, vendor/SpecialElite-LICENSE.txt) is not in the design system, which
loads it from Google Fonts; it is vendored here so the page carries both faces.

  python3 laboratory/build.py                 # writes laboratory/index.html (a full document)
  python3 laboratory/build.py --fragment OUT  # writes the same page without <!doctype>/<html>/<head>/<body>

Content: one file per experiment in content/ (front matter + body, see README.md). They become src/assets.js's
EXPERIMENTS, in the order given by `order`. The experiment named in `module:` is the module in src/experiments/.

The fog experiment measures the fog's own hash. Its GLSL is not copied: it is cut out of bundle.js here (HASH_GLSL),
so the page always measures the hash the fog really uses. The build fails if the fog stops using it the same way.

The modules in src/ are plain ES modules with named exports. For this page they are concatenated in dependency order
into one script, each in its own function scope (imports read from a registry); in the Astro site they can be
imported as they are, with src/assets.js generated or replaced by a content collection.
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


# ---------- content ----------
def inline(text):
    """Escape, then *emphasis* and {value} placeholders (filled live by the experiment's module)."""
    t = html.escape(text, quote=False)
    t = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', t)
    t = re.sub(r'\{([a-z][\w]*)\}', r'<span class="v num" data-v="\1">·</span>', t)
    return t


def parse_content(path):
    src = open(path, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', src, flags=re.S)
    if not m:
        raise SystemExit(f'{path}: no front matter')
    meta = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        k, _, v = line.partition(':')
        v = v.strip()
        if v in ('true', 'false'):
            v = v == 'true'
        elif re.fullmatch(r'-?\d+', v):
            v = int(v)
        meta[k.strip()] = v
    for k in ('slug', 'title', 'gloss', 'order', 'module', 'summary'):
        if k not in meta:
            raise SystemExit(f'{path}: front matter needs `{k}`')
    sections, cur = [], None
    for block in re.split(r'\n\s*\n', m.group(2).strip()):
        block = block.strip()
        h = re.match(r'^##\s+(.+)$', block)
        if h:
            cur = {'name': h.group(1).strip().lower(), 'paras': []}
            sections.append(cur)
            continue
        if cur is None:
            raise SystemExit(f'{path}: body must start with a `## section` heading')
        cur['paras'].append(inline(' '.join(l.strip() for l in block.splitlines())))
    names = [s['name'] for s in sections]
    for need in ('hypothesis', 'method', 'result'):
        if need not in names:
            raise SystemExit(f'{path}: body needs a `## {need}` section')
    meta['sections'] = sections
    return meta


def experiments():
    folder = os.path.join(D, 'content')
    items = [parse_content(os.path.join(folder, f)) for f in sorted(os.listdir(folder)) if f.endswith('.md')]
    items.sort(key=lambda e: e['order'])
    for e in items:
        if not os.path.exists(os.path.join(D, 'src', 'experiments', e['module'] + '.js')):
            raise SystemExit(f'{e["slug"]}: no module src/experiments/{e["module"]}.js')
    return items


# ---------- the fog's hash, cut from the runtime ----------
def fog_hash(bundle):
    m = re.search(r'float h\(vec2 p\)\{[^}]*\}', bundle)
    if not m or 'step(h(cel),dens)' not in bundle:
        raise SystemExit('bundle.js: the fog no longer lights a cell with step(h(cel),dens); update the fog experiment')
    return m.group(0)


# ---------- modules ----------
LIB = ['assets.js', 'motion.js', 'ground.js', 'stipple.js', 'chart.js', 'slider.js', 'bench.js']
TAIL = ['views.js', 'main.js']


def assets_module(items, bundle):
    return ('export const EXPERIMENTS = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';\n'
            'export const HASH_GLSL = ' + json.dumps(fog_hash(bundle)) + ';\n')


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


def script(items, bundle):
    mods = sorted({'experiments/' + e['module'] + '.js' for e in items})
    # main.js reads every experiment module from the registry by name
    reg = 'export const MODULES = {' + ', '.join(json.dumps(m[12:-3]) + ': M[' + json.dumps(m) + ']' for m in mods) + '};'
    parts = []
    for f in LIB + mods + ['modules.js'] + TAIL:
        if f == 'assets.js':
            src = assets_module(items, bundle)
        elif f == 'modules.js':
            src = reg
        else:
            src = open(os.path.join(D, 'src', f), encoding='utf-8').read()
        parts.append(f'/* ---- {f} ---- */\n' + scope_module(f, src))
    return '(function () {\n"use strict";\nconst M = {};\n' + '\n'.join(parts) + '\n})();'


def build(fragment):
    tok = json.loads(ds('tokens.json'))
    bundle = ds('components/bundle.js')
    items = experiments()
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
    css = faces + tokens_css(tok) + bcss + open(os.path.join(D, 'src', 'laboratory.css'), encoding='utf-8').read()
    body = open(os.path.join(D, 'src', 'template.html'), encoding='utf-8').read()
    page = body.replace('/*__CSS__*/', css).replace('/*__BUNDLE__*/', bundle).replace('/*__SCRIPT__*/', script(items, bundle))
    if not fragment:
        page = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' \
               '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + \
               page.replace('<!--__BODY__-->', '</head>\n<body>', 1) + '\n</body>\n</html>\n'
    else:
        page = '<meta charset="utf-8">\n' + page.replace('<!--__BODY__-->', '', 1)
    return page


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--fragment':
        out, frag = sys.argv[2], True
    else:
        out, frag = os.path.join(D, 'index.html'), False
    page = build(frag)
    open(out, 'w', encoding='utf-8').write(page)
    print(out, len(page))
