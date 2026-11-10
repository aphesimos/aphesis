"""Build site/index.html: aphes.ist as one continuous page, the home and every section in one document.

  python3 site/build.py                  # writes site/index.html (a full document)
  python3 site/build.py --fragment OUT   # writes the same page without <!doctype>/<html>/<head>/<body>
  python3 site/build.py --out OUT --music-index URL   # the music library from another copy (checks)
  python3 site/build.py --local          # the sections from the local branches (default: what origin has)

Nothing here is a copy of another branch. The build reads, with git, from the branches that own each part:
  design-system  tokens.json, components/bundle.css, components/bundle.js, fonts/AphesisScript-VF.woff2
  mark           engine/model.js and engine/core.js: the live drawing of the φ (the seal)
  section/<name> each section, built by its own build.py
Special Elite is vendored once, in site/vendor (Apache License 2.0).

Each section is built by running its branch's own build.py (--fragment) on a `git archive` of that branch, so the
section branches stay the source of truth. From the section's page the build keeps three things: its markup (the
body), its stylesheet (src/<name>.css) and its script (the section's modules, already concatenated by its build).
Its fonts, tokens and runtime are dropped: the page carries them once. In the page each section becomes a module:
  <template data-sec="name">  the markup, cloned into #aph-host on mount
  <style data-sec="name">     the stylesheet, live only while the section is mounted
  APH_SECTIONS[name].run(...) the script, wrapped in a function whose parameters (window, document, location,
                              history, addEventListener, timers, observers...) are the shell's sandbox, so that
                              unmounting can stop every loop and remove every listener the section made
See src/shell.js for the mount, the unmount and the route scheme.

The section ref defaults to the local branch section/<name>; pass NAME=REF to build another commit, e.g.
  python3 site/build.py experimental=origin/section/experimental
"""
import base64, html, json, os, re, subprocess, sys, tarfile, tempfile, io

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tools'))
import tokens as T   # colour tokens as sRGB, for the tab icon

D = os.path.dirname(os.path.abspath(__file__))
WT = os.path.dirname(D)


def git(*args, binary=False):
    out = subprocess.run(['git', '-C', WT] + list(args), capture_output=True, check=True).stdout
    return out if binary else out.decode('utf-8')


GIT_DIR = os.path.abspath(os.path.join(WT, git('rev-parse', '--git-common-dir').strip()))


VIEW = None   # a private git dir whose branches are pinned for this build (see snapshot); sections build against it


def vgit(*args, binary=False):
    out = subprocess.run(['git', '--git-dir', VIEW or GIT_DIR] + list(args), capture_output=True, check=True).stdout
    return out if binary else out.decode('utf-8')


def show(ref, path, binary=False):
    return vgit('show', f'{ref}:{path}', binary=binary)


def snapshot(local):
    """Pin every branch the build reads (design-system, mark, section/*) to what origin has, or to the local branches
    with --local, in a private bare git dir that borrows the repository's objects (alternates). The sections' own
    builds read `design-system` by name, so they see the pinned one too, and another agent's unpushed commit on a
    local branch, or a branch moving during the build, never reaches the page."""
    global VIEW
    local_refs = dict(l.split(' ', 1)[::-1] for l in git('for-each-ref', '--format=%(objectname) %(refname:short)', 'refs/heads/').splitlines())
    if local:
        refs = local_refs
    else:
        refs = dict((r[len('refs/heads/'):], sha) for sha, r in (l.split('\t') for l in git('ls-remote', 'origin').splitlines()) if r.startswith('refs/heads/'))
        want = [b for b in refs if b in ('design-system', 'mark') or b.startswith('section/')]
        git('fetch', '-q', 'origin', *want)   # their objects only: no local branch moves
        for b in ('design-system', 'mark'):
            if local_refs.get(b) and local_refs[b] != refs.get(b):
                print(f'  {b}: origin {refs[b][:7]} (the local branch, {local_refs[b][:7]}, is not used)', file=sys.stderr)
    VIEW = tempfile.mkdtemp(prefix='aph-site-git-')
    subprocess.run(['git', 'init', '-q', '--bare', VIEW], check=True)
    open(os.path.join(VIEW, 'objects', 'info', 'alternates'), 'w').write(os.path.join(GIT_DIR, 'objects') + '\n')
    for b, sha in refs.items():
        if b in ('design-system', 'mark') or b.startswith('section/'):
            vgit('update-ref', 'refs/heads/' + b, sha)
    import atexit, shutil
    atexit.register(shutil.rmtree, VIEW, True)


def b64(data):
    return base64.b64encode(data).decode('ascii')


# ---------- the home: sections around the seal, passages in the corner ----------
SECTIONS = [
    dict(id='book', name='book', gl='liber', desc='authors, works and what shaped me, leafed through like a codex.'),
    # the section lives on section/experimental; on the site it is the descent, at #descent (#experimental redirects)
    dict(id='experimental', route='descent', name='descent', gl='κατάβασις', desc='chambers discovered through gestures. symbols, motion, no explanation.'),
    dict(id='archive', name='archive', gl='codex', desc='writing about anything, from draft (nigredo) to finished (rubedo).'),
    dict(id='laboratory', name='laboratory', gl='officina', desc='measured experiments: machines that rewrite themselves, metrics that lie, the cost of a truth.'),
    dict(id='works', name='works', gl='opera', desc='things I have built.'),
    dict(id='wall', name='wall', gl='paries', desc='anonymous messages that drift in the fog and fade with time.'),
    dict(id='forum', name='forum', gl='ἀγορά', desc='a plain anonymous forum, in threads.'),
    dict(id='music', name='music', gl='phonotheca', desc='what i listen to, as it sits on my disk, with a player that keeps playing.'),
]
# the music library on R2; --music-index URL builds against another copy (a local one, for checks)
MUSIC_INDEX = 'https://music.aphes.ist/index.json'
LOCAL = False   # --local: build the sections from the local branches instead of what origin has
SECTION_ARGS = {'music': lambda: ['--index', MUSIC_INDEX]}
PASSAGES = [
    dict(o='ἓν τὸ πᾶν', l='grc', t='the one is the all', a='Chrysopoeia of Cleopatra'),
    dict(o='Solve et coagula', l='la', t='dissolve and coagulate', a='alchemical maxim'),
    dict(o='Quod est inferius est sicut quod est superius', l='la', t='that which is below is as that which is above', a='Emerald Tablet'),
    dict(o='πάντα ῥεῖ', l='grc', t='everything flows', a='attributed to Heraclitus'),
    dict(o='γνῶθι σεαυτόν', l='grc', t='know thyself', a='Delphic maxim'),
    dict(o='Wovon man nicht sprechen kann, darüber muss man schweigen.', l='de', t='whereof one cannot speak, thereof one must be silent', a='Wittgenstein'),
    dict(o="Le silence éternel de ces espaces infinis m'effraie.", l='fr', t='the eternal silence of these infinite spaces frightens me', a='Pascal'),
    dict(o='Tudo vale a pena se a alma não é pequena.', l='pt', t='everything is worthwhile if the soul is not small', a='Fernando Pessoa'),
    dict(o='El tiempo es la sustancia de que estoy hecho.', l='es', t='time is the substance I am made of', a='Borges'),
    dict(o='色即是空', l='ja', t='form is emptiness', a='Heart Sutra'),
    dict(o='Nel mezzo del cammin di nostra vita', l='it', t='midway upon the journey of our life', a='Dante'),
    dict(o='Tempus edax rerum', l='la', t='time, devourer of things', a='Ovid'),
    dict(o='The map is not the territory.', l='en', t='—', a='Korzybski'),
    dict(o='Visita interiora terrae, rectificando invenies occultum lapidem', l='la', t='visit the interior of the earth; by rectifying, you will find the hidden stone', a='V.I.T.R.I.O.L.'),
    dict(o='ἀρχὴ ἥμισυ παντός', l='grc', t='the beginning is half of the whole', a='Greek proverb'),
]


def lang(g):
    return 'grc' if g in ('κατάβασις', 'ἄδυτον', 'ἀγορά') else 'la'


# ---------- tokens.css from the design system's tokens.json (the same rules every section's build uses) ----------
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


def faces():
    vf = b64(show('design-system', 'system/fonts/AphesisScript-VF.woff2', True))
    se = {k: b64(open(os.path.join(D, 'vendor', f'SpecialElite-{k}.woff2'), 'rb').read()) for k in ('latin', 'latin-ext')}
    return (
        '@font-face{font-family:"Aphesis Script";src:url(data:font/woff2;base64,' + vf + ') format("woff2");font-weight:300 800;font-display:block}\n'
        '@font-face{font-family:"Special Elite";src:url(data:font/woff2;base64,' + se['latin'] + ') format("woff2");font-display:block;'
        'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n'
        '@font-face{font-family:"Special Elite";src:url(data:font/woff2;base64,' + se['latin-ext'] + ') format("woff2");font-display:block;'
        'unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}\n'
    )


# ---------- sections: each built by its own branch ----------
SANDBOX = ('window, self, globalThis, document, location, history, addEventListener, removeEventListener, '
           'requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout, setInterval, clearInterval, '
           'matchMedia, ResizeObserver, MutationObserver, IntersectionObserver, fetch')


def build_section(name, ref):
    """Run section/<name>'s own build.py --fragment on a git archive of the branch; return (markup, css, js, commit)."""
    commit = vgit('rev-parse', '--short', ref).strip()
    with tempfile.TemporaryDirectory() as tmp:
        tar = vgit('archive', ref, name, binary=True)
        tarfile.open(fileobj=io.BytesIO(tar)).extractall(tmp, filter='data')
        out = os.path.join(tmp, 'out.html')
        env = dict(os.environ, GIT_DIR=VIEW)
        extra = SECTION_ARGS[name]() if name in SECTION_ARGS else []
        subprocess.run([sys.executable, os.path.join(tmp, name, 'build.py')] + extra + ['--fragment', out], check=True, env=env,
                       cwd=tmp, capture_output=True)
        page = open(out, encoding='utf-8').read()
    m = re.search(r'<style>\n?(.*?)</style>', page, re.S)
    own = show(ref, f'{name}/src/{name}.css')
    css = m.group(1)
    if not css.rstrip().endswith(own.rstrip()):
        sys.exit(f'{name}: the page stylesheet does not end with src/{name}.css; check its build')
    rest = page[m.end():]
    first = rest.index('<script>')
    markup = rest[:first].strip()
    scripts = re.findall(r'<script>\n?(.*?)\n?</script>', rest[first:], re.S)
    if len(scripts) != 2 or not scripts[0].lstrip().startswith('/* @ds-bundle'):
        sys.exit(f'{name}: expected the runtime and one section script')
    return markup, own, imports(scripts[1]), commit


def imports(js):
    """Mend the module wiring a section's build wrote. Each build turns `import { a, b } from './m.js'` into
    `const { a, b } = M["m.js"];`; a renamed import (`a as b`) must become a destructuring rename (`a: b`), and a
    namespace or default import, which those builds leave as they are, is wired the same way here."""
    js = re.sub(r'^(const \{)([^}]*)(\} = M\[)', lambda m: m.group(1) + re.sub(r'\b([\w$]+)\s+as\s+([\w$]+)', r'\1: \2', m.group(2)) + m.group(3),
                js, flags=re.M)
    def key(path):
        return json.dumps(os.path.normpath(path.lstrip('./')).replace(os.sep, '/'))
    js = re.sub(r'^import\s+\*\s+as\s+([\w$]+)\s+from\s+[\'"]([^\'"]+)[\'"];?\s*$', lambda m: f'const {m.group(1)} = M[{key(m.group(2))}];', js, flags=re.M)
    js = re.sub(r'^import\s+([\w$]+)\s+from\s+[\'"]([^\'"]+)[\'"];?\s*$', lambda m: f'const {m.group(1)} = M[{key(m.group(2))}].default;', js, flags=re.M)
    return js


def check(name, js):
    """a section's script must parse, as it will run in the page (inside its sandbox function), or the build stops"""
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(f'(function ({SANDBOX}) {{\n{js}\n}});\n'); path = f.name
    try:
        r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
        if r.returncode:
            sys.exit(f'{name}: the section script does not parse:\n{r.stderr.strip()[:1200]}')
    finally:
        os.unlink(path)


def section_modules(refs):
    tpl, styles, js, info = [], [], [], {}

    for s in SECTIONS:
        n = s['id']
        markup, css, script, commit = build_section(n, refs.get(n) or f'section/{n}')
        check(n, script)
        slugs = sorted(set(re.findall(r'data-slug="([a-z0-9-]+)"', markup))) if n == 'archive' else []
        tpl.append(f'<template data-sec="{n}">\n{markup}\n</template>')
        styles.append(f'<style data-sec="{n}" media="not all">\n{css}\n</style>')
        js.append(f'/* ---- section/{n} @ {commit} ---- */\nAPH_SECTIONS[{json.dumps(n)}] = {{ slugs: {json.dumps(slugs)}, '
                  f'run: function ({SANDBOX}) {{\n{script}\n}} }};')
        info[n] = commit
        print(f'  {n:13} {commit}', file=sys.stderr)
    return '\n'.join(tpl), '\n'.join(styles), 'const APH_SECTIONS = {};\n' + '\n'.join(js), info


def favicon_open(red):
    """the open eye's data URI, made by src/favicon.js with the runtime's brush (node), for the head at parse time"""
    js = ('global.window = global;\n' + show('design-system', 'system/components/bundle.js') + '\n' +
          open(os.path.join(D, 'src', 'favicon.js'), encoding='utf-8').read() +
          '\nprocess.stdout.write(favicons(window.Aphesis, ' + json.dumps(red) + ').open);')
    return subprocess.run(['node', '-e', js], capture_output=True, check=True, text=True).stdout


def build(fragment, refs):
    if VIEW is None:
        snapshot(LOCAL)
    refs = {k: git('rev-parse', v).strip() for k, v in refs.items()}   # NAME=REF overrides, resolved in the repository
    tok = json.loads(show('design-system', 'system/tokens.json'))
    bcss = re.sub(r'@import url\([^)]*\);\s*', '', show('design-system', 'system/components/bundle.css'))
    css = faces() + tokens_css(tok) + bcss + open(os.path.join(D, 'src', 'shell.css'), encoding='utf-8').read()
    nav = ''.join(f'<a href="#{s.get("route", s["id"])}">{html.escape(s["name"])}<span class="gl" lang="{lang(s["gl"])}">{html.escape(s["gl"])}</span></a>'
                  for s in SECTIONS)
    tpl, styles, secjs, info = section_modules(refs)
    red = {'light': T.color('rubedo', 'light', tok), 'dark': T.color('rubedo', 'dark', tok)}
    fav_open = favicon_open(red)
    shell = open(os.path.join(D, 'src', 'shell.js'), encoding='utf-8').read()
    shell = (shell.replace('/*__ENGINE__*/', show('mark', 'engine/model.js') + '\n' + show('mark', 'engine/core.js'))
             .replace('/*__SECTIONSJS__*/', json.dumps([dict(id=s['id'], route=s.get('route', s['id']), name=s['name']) for s in SECTIONS], ensure_ascii=False))
             .replace('/*__PASSAGES__*/', json.dumps(PASSAGES, ensure_ascii=False))
             .replace('/*__FAVICON__*/', open(os.path.join(D, 'src', 'favicon.js'), encoding='utf-8').read())
             .replace('/*__ICONRED__*/', json.dumps(red)))
    page = open(os.path.join(D, 'src', 'shell.html'), encoding='utf-8').read()
    # the static icons and the manifest are files in site/public (tools/make_icons.py); the artifact page has none
    links = '' if fragment else ('<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
                                 '<link rel="manifest" href="/site.webmanifest">')   # theme-color: Aphesis.themeColor keeps it with the ground
    page = page.replace('<!--__HEADLINKS__-->', links).replace('__FAVICON_OPEN__', html.escape(fav_open, quote=True))
    page = (page.replace('/*__CSS__*/', css).replace('<!--__NAV__-->', nav).replace('<!--__STYLES__-->', styles)
            .replace('<!--__TEMPLATES__-->', tpl).replace('/*__BUNDLE__*/', show('design-system', 'system/components/bundle.js'))
            .replace('/*__SECTIONS__*/', secjs).replace('/*__SHELL__*/', shell)
            .replace('<!--__BUILT__-->', '<!-- sections: ' + ', '.join(f'{k} {v}' for k, v in info.items()) + ' -->'))
    if fragment:
        return '<meta charset="utf-8">\n' + page.replace('<!--__BODY__-->', '', 1)
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            + page.replace('<!--__BODY__-->', '</head>\n<body>', 1) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    args = sys.argv[1:]
    out, frag, refs = os.path.join(D, 'index.html'), False, {}
    LOCAL = '--local' in args
    args = [a for a in args if a != '--local']
    while args:
        a = args.pop(0)
        if a == '--fragment':
            out, frag = args.pop(0), True
        elif a == '--out':
            out = args.pop(0)
        elif a == '--music-index':
            MUSIC_INDEX = args.pop(0)
        else:
            k, v = a.split('=', 1); refs[k] = v
    page = build(frag, refs)
    open(out, 'w', encoding='utf-8').write(page)
    print(out, len(page))
