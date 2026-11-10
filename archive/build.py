"""Build archive/index.html and archive/feed.xml: the archive section (codex) as one self-contained page.

Everything the page needs is inlined: tokens.css (generated from the design system's tokens.json),
bundle.css and bundle.js, the two faces, the density maps the posts use, the posts themselves and the
section's own modules. The design system is read from the `design-system` branch with `git show`, so this
branch never copies it. Special Elite (Astigmatic, Apache License 2.0, vendor/SpecialElite-LICENSE.txt) is
vendored here so the page carries both faces.

  python3 archive/build.py                 # writes archive/index.html (a full document) and archive/feed.xml
  python3 archive/build.py --fragment OUT  # also writes the same page without <!doctype>/<html>/<head>/<body>

Posts are markdown files with front matter in content/ (see README.md). They are converted with
python-markdown when it is installed, and with the small converter below when it is not; footnotes and
simulacrum images are handled by this script in both cases, so the page gets the same markup either way.

The modules in src/ are plain ES modules with named exports. For this page they are concatenated in
dependency order into one script, each in its own function scope (imports read from a registry); in the
Astro site they can be imported as they are, with src/assets.js generated or replaced by asset imports.
"""
import base64, datetime, html, json, os, re, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(D)
DS = 'design-system'
SITE = 'https://aphes.ist'
SECTION_URL = SITE + '/archive'          # a post lives at SECTION_URL#<slug>

STAGES = ['nigredo', 'albedo', 'citrinitas', 'rubedo']
STAGE_TIPS = {
    'nigredo': 'nigredo · the black: barely begun',
    'albedo': 'albedo · the white: taking shape',
    'citrinitas': 'citrinitas · the yellow: nearly there',
    'rubedo': 'rubedo · the red: finished',
}
MAP_FILES = {  # density maps a post may name as ![caption](simulacrum:<name>), from system/assets/Simulacra
    'trismegistus': 'trismegistus.png', 'jerome': 'jerome.jpg', 'alchemist': 'alchemist.jpg',
    'flammarion': 'flammarion.png', 'cagnacci': 'cagnacci.jpg', 'magdalen': 'magdalen.jpg',
    'newton': 'newton.jpg', 'paradiso': 'paradiso.jpg', 'faust': 'faust.jpg',
}
MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']


def ds(path, binary=False):
    out = subprocess.run(['git', '-C', REPO, 'show', f'{DS}:system/{path}'], capture_output=True, check=True).stdout
    return out if binary else out.decode('utf-8')


def b64(data):
    return base64.b64encode(data).decode('ascii')


esc = lambda s: html.escape(s, quote=True)


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


# ---------- posts ----------
SLUG = re.compile(r'^[A-Za-z0-9-]+$')


def front_matter(text, name):
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n', text, re.S)
    if not m:
        sys.exit(f'{name}: missing front matter')
    meta = {}
    for line in m.group(1).splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            meta[k.strip()] = v.strip().strip('"').strip("'")
    for k in ('title', 'date', 'stage', 'summary'):
        if not meta.get(k):
            sys.exit(f'{name}: front matter needs {k}')
    if meta['stage'] not in STAGES:
        sys.exit(f'{name}: stage must be one of {", ".join(STAGES)}')
    datetime.date.fromisoformat(meta['date'])
    meta['example'] = meta.get('example', 'false').lower() == 'true'
    return meta, text[m.end():]


def inline(s, notes):
    """markdown inline: code, links, strong, em, footnote markers. Text is escaped first."""
    codes = []

    def keep_code(m):
        codes.append('<code>' + esc(m.group(1)) + '</code>')
        return f'\x00{len(codes) - 1}\x00'
    s = re.sub(r'`([^`]+)`', keep_code, s)
    s = esc(s)
    s = re.sub(r'\[\^([\w-]+)\]', lambda m: notes(m.group(1)), s)
    s = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(?<![\w*])\*([^*]+)\*(?![\w*])', r'<em>\1</em>', s)
    s = re.sub(r'(?<![\w_])_([^_]+)_(?![\w_])', r'<em>\1</em>', s)
    return re.sub(r'\x00(\d+)\x00', lambda m: codes[int(m.group(1))], s)


def small_markdown(src, notes):
    """the subset the posts use: ## and ### headings, paragraphs, > quotes, fenced code, - and 1. lists."""
    out, lines, i = [], src.split('\n'), 0
    while i < len(lines):
        ln = lines[i]
        if not ln.strip():
            i += 1
            continue
        if ln.startswith('```'):
            j = i + 1
            while j < len(lines) and not lines[j].startswith('```'):
                j += 1
            out.append('<pre><code>' + esc('\n'.join(lines[i + 1:j])) + '</code></pre>')
            i = j + 1
            continue
        m = re.match(r'^(#{2,4})\s+(.*)$', ln)
        if m:
            n = len(m.group(1))
            out.append(f'<h{n}>{inline(m.group(2), notes)}</h{n}>')
            i += 1
            continue
        if ln.startswith('\x01'):          # a block placeholder (simulacrum figure), kept as it is
            out.append(ln)
            i += 1
            continue
        if ln.startswith('>'):
            block = []
            while i < len(lines) and lines[i].startswith('>'):
                block.append(re.sub(r'^>\s?', '', lines[i]))
                i += 1
            out.append('<blockquote>' + small_markdown('\n'.join(block), notes) + '</blockquote>')
            continue
        if re.match(r'^(\s*[-*]|\s*\d+\.)\s+', ln):
            tag = 'ol' if re.match(r'^\s*\d+\.', ln) else 'ul'
            items = []
            while i < len(lines) and re.match(r'^(\s*[-*]|\s*\d+\.)\s+', lines[i]):
                items.append('<li>' + inline(re.sub(r'^(\s*[-*]|\s*\d+\.)\s+', '', lines[i]), notes) + '</li>')
                i += 1
            out.append(f'<{tag}>' + ''.join(items) + f'</{tag}>')
            continue
        para = []
        while i < len(lines) and lines[i].strip() and not re.match(r'^(```|#{2,4}\s|>|\x01|\s*[-*]\s|\s*\d+\.\s)', lines[i]):
            para.append(lines[i].strip())
            i += 1
        out.append('<p>' + inline(' '.join(para), notes) + '</p>')
    return '\n'.join(out)


def convert(slug, body):
    """markdown body -> (html, notes html, simulacrum maps used)"""
    # footnote definitions come out first: [^id]: text
    defs = {}

    def take_def(m):
        defs[m.group(1)] = m.group(2).strip()
        return ''
    body = re.sub(r'^\[\^([\w-]+)\]:\s*(.+(?:\n(?!\n|\[\^).+)*)', take_def, body, flags=re.M)
    order = []
    maps = []
    figures = []

    def figure(m):
        cap, name = m.group(1), m.group(2)
        if name not in MAP_FILES:
            sys.exit(f'{slug}: unknown simulacrum map {name}')
        if name not in maps:
            maps.append(name)
        figures.append(
            f'<figure class="sim" data-map="{name}"><div class="sim-box"></div>'
            f'<figcaption class="aph-meta aph-on-fog">{esc(cap)}</figcaption></figure>')
        return f'\x01FIG{len(figures) - 1}\x01'
    body = re.sub(r'^!\[([^\]]*)\]\(simulacrum:([\w-]+)\)\s*$', figure, body, flags=re.M)

    def note_plain(text):
        return re.sub(r'<[^>]+>', '', inline(text, lambda k: ''))

    def marker(key):
        if key not in defs:
            sys.exit(f'{slug}: footnote [^{key}] has no text')
        if key not in order:
            order.append(key)
        n = order.index(key) + 1
        return (f'<sup class="fn"><button type="button" class="fn-mark" id="fnref-{slug}-{n}" '
                f'aria-describedby="fn-{slug}-{n}" aria-label="note {n}" data-cursor=".55" '
                f'data-note="{html.escape(html.unescape(note_plain(defs[key])), quote=True)}">{n}</button></sup>')

    try:
        import markdown as md  # python-markdown, when it is installed
        token = lambda k: f'@@FN{k}@@'
        pre = re.sub(r'\[\^([\w-]+)\]', lambda m: token(m.group(1)), body)
        pre = re.sub(r'^\x01FIG(\d+)\x01$', r'<div>@@FIG\1@@</div>', pre, flags=re.M)
        out = md.markdown(pre, extensions=['fenced_code'], output_format='html5')
        out = re.sub(r'<div>@@FIG(\d+)@@</div>', lambda m: figures[int(m.group(1))], out)
        out = re.sub(r'@@FN([\w-]+)@@', lambda m: marker(m.group(1)), out)
    except ImportError:
        out = small_markdown(body.strip(), marker)
        out = re.sub(r'\x01FIG(\d+)\x01', lambda m: figures[int(m.group(1))], out)
    # a quote's last paragraph that starts with a dash is its source
    out = re.sub(r'<p>(—|&mdash;)\s*', '<p class="cite">— ', out)
    notes = ''
    if order:
        items = ''.join(
            f'<li id="fn-{slug}-{n}">{inline(defs[k], lambda _: "")} '
            f'<a class="fn-back" href="#fnref-{slug}-{n}" data-fnref="fnref-{slug}-{n}" aria-label="back to the text">↑</a></li>'
            for n, k in enumerate(order, 1))
        notes = f'<section class="notes" aria-label="notes"><ol>{items}</ol></section>'
    return out, notes, maps


def date_text(d):
    d = datetime.date.fromisoformat(d)
    return f'{d.day} {MONTHS[d.month - 1]} {d.year}'


def load_posts():
    posts = []
    for f in sorted(os.listdir(os.path.join(D, 'content'))):
        if not f.endswith('.md'):
            continue
        slug = f[:-3]
        if not SLUG.match(slug) or slug in ('archive', 'home'):
            sys.exit(f'{f}: the file name is the route; use ascii letters, digits and hyphens (not "archive" or "home")')
        meta, body = front_matter(open(os.path.join(D, 'content', f), encoding='utf-8').read(), f)
        content, notes, maps = convert(slug, body)
        posts.append(dict(meta, slug=slug, html=content, notes=notes, maps=maps,
                          words=len(re.sub(r'<[^>]+>', ' ', content).split())))
    posts.sort(key=lambda p: (p['date'], p['slug']), reverse=True)
    return posts


# ---------- markup ----------
def stage_icon(stage, cls=''):
    return (f'<span class="stage-icon {cls}" data-stage="{stage}" data-tip="{esc(STAGE_TIPS[stage])}" '
            f'aria-hidden="true"></span>')


def meta_line(p):
    ex = ' · example' if p['example'] else ''
    return f'<time datetime="{p["date"]}">{date_text(p["date"])}</time>{ex}'


def list_html(posts):
    items = []
    for p in posts:
        items.append(
            f'<li class="entry" data-stage="{p["stage"]}">'
            f'<a class="entry-link" href="#{p["slug"]}" data-slug="{p["slug"]}">'
            f'{stage_icon(p["stage"])}'
            f'<span class="entry-main"><span class="entry-title"><span class="entry-name">{esc(p["title"])}</span><span class="uline" aria-hidden="true"></span></span>'
            f'<span class="entry-summary">{esc(p["summary"])}</span></span>'
            f'<span class="entry-meta"><span class="aph-gloss entry-stage" lang="la">{p["stage"]}</span>'
            f'<span class="aph-meta">{meta_line(p)}</span></span>'
            f'</a></li>')
    legend = ''.join(
        f'<li>{stage_icon(s, "small")}<span class="aph-gloss" lang="la">{s}</span></li>' for s in STAGES)
    return (
        '<section class="view list" data-view="list" aria-labelledby="codex-title">'
        '<div class="col">'
        '<header class="head">'
        '<p class="gloss-title aph-gloss" lang="la">codex</p>'
        '<h1 id="codex-title" class="title aph-display" tabindex="-1">archive</h1>'
        '<p class="lede">writing about anything, from draft to finished.</p>'
        f'<ol class="stages" aria-label="from draft to finished: nigredo, albedo, citrinitas, rubedo">{legend}</ol>'
        '</header>'
        f'<ol class="entries">{"".join(items)}</ol>'
        '<footer class="foot"><span class="rule" aria-hidden="true"></span>'
        '<a class="feed aph-label" href="feed.xml" type="application/atom+xml">feed</a>'
        '<span class="aph-meta">atom · every post, from nigredo to rubedo</span></footer>'
        '</div></section>')


def back_link(where):
    return (f'<a class="back {where}" href="#archive" aria-label="back to the archive" '
            f'data-tip="back to the archive · esc"><span class="back-mark" aria-hidden="true"></span>'
            f'<span class="aph-label" aria-hidden="true">archive</span></a>')


def post_html(p):
    return (
        f'<article class="view post" data-view="post" data-slug="{p["slug"]}" aria-labelledby="t-{p["slug"]}" hidden>'
        '<div class="col">'
        f'<nav class="back-row" aria-label="archive">{back_link("top")}</nav>'
        '<header class="post-head">'
        f'<p class="post-stage">{stage_icon(p["stage"])}<span class="aph-gloss" lang="la">{p["stage"]}</span>'
        f'<span class="aph-meta">{meta_line(p)}</span></p>'
        f'<h1 id="t-{p["slug"]}" class="post-title aph-display" tabindex="-1">{esc(p["title"])}</h1>'
        f'<p class="lede">{esc(p["summary"])}</p>'
        '</header>'
        f'<div class="prose">{p["html"]}</div>'
        f'{p["notes"]}'
        f'<footer class="post-foot">{back_link("bottom")}</footer>'
        '</div></article>')


# ---------- feed ----------
def feed_xml(posts):
    x = lambda s: html.escape(s, quote=False)
    updated = max(p['date'] for p in posts) + 'T00:00:00Z'
    entries = []
    for p in posts:
        url = f'{SECTION_URL}#{p["slug"]}'
        # the feed has no runtime: a simulacrum is named by its caption, and a footnote marker is a plain number
        body = re.sub(r'<figure class="sim"[^>]*>.*?<figcaption[^>]*>(.*?)</figcaption></figure>',
                      r'<p><em>[simulacrum: \1]</em></p>', p['html'], flags=re.S)
        body = re.sub(r'<sup class="fn"><button[^>]*>(\d+)</button></sup>', r'<sup>\1</sup>', body)
        body += re.sub(r'<a class="fn-back".*?</a>', '', p['notes'])
        entries.append(
            '  <entry>\n'
            f'    <title>{x(p["title"])}</title>\n'
            f'    <link rel="alternate" type="text/html" href="{url}"/>\n'
            f'    <id>{url}</id>\n'
            f'    <published>{p["date"]}T00:00:00Z</published>\n'
            f'    <updated>{p["date"]}T00:00:00Z</updated>\n'
            f'    <category term="{p["stage"]}" label="{p["stage"]}"/>\n'
            + ('    <category term="example" label="example"/>\n' if p['example'] else '') +
            f'    <summary>{x(p["summary"])}</summary>\n'
            f'    <content type="html">{x(body)}</content>\n'
            '  </entry>')
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">\n'
        '  <title>aphes.ist · archive</title>\n'
        '  <subtitle>writing about anything, from draft to finished.</subtitle>\n'
        f'  <link rel="alternate" type="text/html" href="{SECTION_URL}"/>\n'
        f'  <link rel="self" type="application/atom+xml" href="{SECTION_URL}/feed.xml"/>\n'
        f'  <id>{SECTION_URL}</id>\n'
        f'  <updated>{updated}</updated>\n'
        '  <author><name>aphesis</name></author>\n'
        + '\n'.join(entries) + '\n</feed>\n')


# ---------- modules ----------
ORDER = ['assets.js', 'motion.js', 'stage-icon.js', 'marks.js', 'tip.js', 'figure.js', 'views.js', 'main.js']


def assets_module(maps):
    lines = ['export const MAPS = {']
    for k in maps:
        f = MAP_FILES[k]
        mime = 'image/png' if f.endswith('.png') else 'image/jpeg'
        lines.append(f'  {k}: "data:{mime};base64,{b64(ds("assets/Simulacra/" + f, True))}",')
    lines.append('};')
    return '\n'.join(lines)


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


def script(maps):
    parts = []
    for f in ORDER:
        src = assets_module(maps) if f == 'assets.js' else open(os.path.join(D, 'src', f), encoding='utf-8').read()
        parts.append(f'/* ---- {f} ---- */\n' + scope_module(f, src))
    return '(function () {\n"use strict";\nconst M = {};\n' + '\n'.join(parts) + '\n})();'


def build(posts, fragment):
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
    css = faces + tokens_css(tok) + bcss + open(os.path.join(D, 'src', 'archive.css'), encoding='utf-8').read()
    maps = []
    for p in posts:
        maps += [m for m in p['maps'] if m not in maps]
    body = open(os.path.join(D, 'src', 'template.html'), encoding='utf-8').read()
    page = (body.replace('/*__CSS__*/', css)
            .replace('<!--__LIST__-->', list_html(posts))
            .replace('<!--__POSTS__-->', '\n'.join(post_html(p) for p in posts))
            .replace('/*__BUNDLE__*/', ds('components/bundle.js'))
            .replace('/*__SCRIPT__*/', script(maps)))
    if not fragment:
        page = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' \
               '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' \
               '<link rel="alternate" type="application/atom+xml" title="aphes.ist · archive" href="feed.xml">\n' + \
               page.replace('<!--__BODY__-->', '</head>\n<body>', 1) + '\n</body>\n</html>\n'
    else:
        page = '<meta charset="utf-8">\n' + page.replace('<!--__BODY__-->', '', 1)
    return page


if __name__ == '__main__':
    posts = load_posts()
    feed = feed_xml(posts)
    open(os.path.join(D, 'feed.xml'), 'w', encoding='utf-8').write(feed)
    page = build(posts, False)
    open(os.path.join(D, 'index.html'), 'w', encoding='utf-8').write(page)
    print(os.path.join(D, 'index.html'), len(page))
    print(os.path.join(D, 'feed.xml'), len(feed), f'{len(posts)} posts')
    if len(sys.argv) > 2 and sys.argv[1] == '--fragment':
        frag = build(posts, True)
        open(sys.argv[2], 'w', encoding='utf-8').write(frag)
        print(sys.argv[2], len(frag))
