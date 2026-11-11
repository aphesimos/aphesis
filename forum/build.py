"""Build forum/index.html: the forum section (forum · ἀγορά) as one self-contained page.

Everything the page needs is inlined: tokens.css (generated from the design system's tokens.json),
bundle.css and bundle.js, the two faces and the section's own modules.
The design system is read from the `design-system` branch with `git show`, so this branch never copies it.
Special Elite (Astigmatic, Apache License 2.0, vendor/SpecialElite-LICENSE.txt) is not in the design system, which
loads it from Google Fonts; it is vendored here so the page carries both faces.

  python3 forum/build.py                 # writes forum/index.html (a full document)
  python3 forum/build.py --fragment OUT  # writes the same page without <!doctype>/<html>/<head>/<body>

The page talks to the Worker in forum/worker when <meta name="forum-api"> carries its URL; built as it is, it runs on
the local mock (an empty board, paged like the Worker; new posts kept in this browser only).

The modules in src/ are plain ES modules with named exports. For this page they are concatenated in
dependency order into one script, each in its own function scope (imports read from a registry); in the Astro site they can be
imported as they are.
"""
import base64, json, os, re, subprocess, sys

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


# ---------- modules ----------
ORDER = ['hash.js', 'store.js', 'motion.js', 'text.js', 'sigil.js', 'owner.js', 'legible.js', 'thumb.js', 'refusal.js', 'density.js',
         'mock.js', 'api.js', 'ground.js', 'composer.js', 'viewer.js', 'views.js', 'main.js']

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


def script():
    parts = []
    for f in ORDER:
        src = open(os.path.join(D, 'src', f), encoding='utf-8').read()
        parts.append(f'/* ---- {f} ---- */\n' + scope_module(f, src))
    return '(function () {\n"use strict";\nconst M = {};\n' + '\n'.join(parts) + '\n})();'


def build(fragment):
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
    # bundle.css imports Special Elite from Google Fonts; the page embeds it instead
    bcss = re.sub(r'@import url\([^)]*\);\s*', '', ds('components/bundle.css'))
    css = faces + tokens_css(tok) + bcss + open(os.path.join(D, 'src', 'forum.css'), encoding='utf-8').read()
    body = open(os.path.join(D, 'src', 'template.html'), encoding='utf-8').read()
    js = ds('components/bundle.js')
    page = body.replace('/*__CSS__*/', css).replace('/*__BUNDLE__*/', js).replace('/*__SCRIPT__*/', script())
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
