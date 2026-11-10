"""Aphesis Script — specimen page. Assembles one self-contained HTML file (fonts, proofs, rationale
and the downloadable family + build source all inline) from page_template.html.

    python3 make_page.py   → ../dist/aphesis-script.html   (+ ../dist/AphesisScript-family.zip, -source.zip)
"""
import base64, datetime, html, io, json, os, sys, unicodedata, zipfile
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
sys.path.insert(0, HERE)
import brush as B, spacing as SP, build as BUILD, rationale as RAT
from registry import load_glyphs, glyph_polys
from fontTools.ttLib import TTFont

DIST = os.environ.get('APHESIS_OUT') or os.path.join(ROOT, 'dist')        # (APHESIS_OUT: a trial build elsewhere)
BUILD_SOURCES = ['build.py', 'brush.py', 'parts.py', 'registry.py', 'spacing.py', 'features.py', 'phi.py', 'phi_weight.py', 'phi_path.txt',
                 'glyphs_core.py', 'glyphs_round.py', 'glyphs_straight.py', 'glyphs_diag.py', 'glyphs_figures.py', 'glyphs_punct.py',
                 'glyphs_marks.py', 'glyphs_extra.py', 'glyphs_greek1.py', 'glyphs_greek2.py', 'glyphs_polytonic.py', 'glyphs_symbols.py',
                 'glyphs_cjk.py']                                              # what build.py needs
TOOLS = ['proofs.py', 'preview.py', 'fontmeasure.py', 'rationale.py', 'make_page.py', 'page_template.html']    # the tools around it
SOURCES = BUILD_SOURCES + TOOLS
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
def png_small(path, width=1700, levels=12):
    """A proof sheet for the page: narrower and in a few greys (they are black on white), a fifth of the bytes."""
    try:
        from PIL import Image
        im = Image.open(path).convert('L')
        if im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        buf = io.BytesIO(); im.quantize(levels).save(buf, 'PNG', optimize=True)
        return base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        return b64(path)

def human(n): return f'{n / 1024:.0f} KB' if n < 1024 * 1024 else f'{n / 1024 / 1024:.1f} MB'

def zips():
    """family.zip: every font + sources + docs; source.zip: just what is needed to rebuild."""
    fam, src = io.BytesIO(), io.BytesIO()
    with zipfile.ZipFile(fam, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z, zipfile.ZipFile(src, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zs:
        for f in ('AphesisScript-VF.ttf', 'AphesisScript-VF.woff2'): z.write(os.path.join(DIST, f), 'fonts/variable/' + f)
        for f in sorted(os.listdir(os.path.join(DIST, 'static'))): z.write(os.path.join(DIST, 'static', f), 'fonts/static/' + f)
        for f in SOURCES:
            p = os.path.join(HERE, f)
            if os.path.exists(p): z.write(p, 'source/src/' + f); zs.write(p, 'src/' + f)
        for f, arc in (('SPEC.md', 'SPEC.md'), ('RATIONALE.md', 'RATIONALE.md'), ('work/proof.js', 'work/proof.js')):
            p = os.path.join(ROOT, f)
            if os.path.exists(p): z.write(p, 'source/' + arc); zs.write(p, arc)
        z.writestr('README.txt', RAT.README); zs.writestr('README.txt', RAT.README)
    for name, buf in (('AphesisScript-family.zip', fam), ('AphesisScript-source.zip', src)):
        open(os.path.join(DIST, name), 'wb').write(buf.getvalue())
    open(os.path.join(DIST, 'AphesisScript-build-source.txt'), 'w').write(source_text())

def source_text():
    """The build source as one readable text file (the same files as in the zip)."""
    out = ['Aphesis Script ' + BUILD.VERSION + ' — complete build source. Entry point: python3 build.py (needs numpy, fonttools, brotli).\n']
    for f in BUILD_SOURCES:
        if os.path.exists(os.path.join(HERE, f)): out.append('\n' + '=' * 100 + f'\n== src/{f}\n' + '=' * 100 + '\n' + open(os.path.join(HERE, f)).read())
    return ''.join(out)

def diagram(G, wght=400):
    """The pair n·o as the spacing engine sees it: reference edges, the x-height band, and the
    white that is counted (up to the depth limit) on each side. Drawn from the engine's own data."""
    A, Bn = 'n', 'o'
    dxa, adva = SP.metrics(G, A, wght); dxb, advb = SP.metrics(G, Bn, wght)
    ma, mb = SP.measure(G, A, wght), SP.measure(G, Bn, wght)
    ra, lb = ma['R'].ref + dxa, mb['L'].ref + dxb + adva                       # reference edges in line coordinates
    W, top, bot = adva + advb, 560, -110
    path = lambda polys, ox: ''.join('M' + ' L'.join(f'{x + ox:.0f} {-y:.0f}' for x, y in P[::2]) + 'Z' for P in polys)
    out = [f'<svg viewBox="-20 {-top} {W + 40:.0f} {top - bot}" role="img" aria-label="How the white between n and o is measured">']
    strips = []
    ys = SP.YS[SP.BAND]
    for side, ref, sgn, col in ((ma['R'], ra, 1, 'var(--red)'), (mb['L'], lb, -1, 'var(--red)')):
        d = np.minimum(side.depth[SP.BAND], SP.DEPTH)
        for y, dd in zip(ys[::2], d[::2]):
            x0, x1 = (ref - dd, ref) if sgn > 0 else (ref, ref + dd)
            if x1 - x0 > 0.5: strips.append(f'<rect x="{x0:.0f}" y="{-y - 4:.0f}" width="{x1 - x0:.0f}" height="8" fill="{col}" opacity=".5"/>')
    out.append(f'<rect x="{ra:.0f}" y="{-B.XH}" width="{lb - ra:.0f}" height="{B.XH}" fill="var(--red)" opacity=".18"/>')
    out += strips
    out.append(f'<path d="{path(glyph_polys(G, A, wght), dxa)}{path(glyph_polys(G, Bn, wght), dxb + adva)}" fill="var(--ink)" fill-rule="nonzero"/>')
    for y, lab in ((0, 'baseline'), (B.XH, 'x-height')):
        out.append(f'<line x1="-20" x2="{W + 20:.0f}" y1="{-y}" y2="{-y}" stroke="var(--dim)" stroke-width="1.5" stroke-dasharray="6 7"/>')
        out.append(f'<text x="{W + 16:.0f}" y="{-y - 9}" text-anchor="end" font-size="19" fill="var(--dim)" font-family="var(--data)">{lab}</text>')
    for x, lab, anchor, yy in ((ra, 'reference edge of n', 'end', -top + 26), (lb, 'reference edge of o', 'start', -top + 26), (adva, 'edge of the glyph box', 'middle', -bot - 14)):
        dash = ' stroke-dasharray="3 6"' if 'box' in lab else ''
        y1, y2 = (-top + 36, 14) if 'box' not in lab else (-B.XH - 14, -bot - 34)
        out.append(f'<line x1="{x:.0f}" x2="{x:.0f}" y1="{y1}" y2="{y2}" stroke="var(--ink)" stroke-width="1.5"{dash}/>')
        out.append(f'<text x="{x + (-8 if anchor == "end" else 8 if anchor == "start" else 0):.0f}" y="{yy}" text-anchor="{anchor}" font-size="19" fill="var(--ink)" font-family="var(--data)">{lab}</text>')
    out.append(f'<text x="{(ra + lb) / 2:.0f}" y="{-B.XH - 22}" text-anchor="middle" font-size="19" fill="var(--red)" font-family="var(--data)">{SP._bearing(G, A, "R", wght):.0f} + {SP._bearing(G, Bn, "L", wght):.0f}</text>')
    out.append('</svg>')
    half = SP.gap_target(wght) / 2
    cap = (f'The pair n·o at wght {wght}, drawn from the engine’s own data. Each side has a reference edge: n’s stem, o’s extreme. The white behind an edge '
           f'(bright strips) is counted over the x-height band, never deeper than {SP.DEPTH} units, 15 % of the x-height. A bearing is the target, {half:.0f} units per side, minus '
           f'that side’s mean white: the stem carries {ma["R"].white:.0f} and gets {SP._bearing(G, A, "R", wght):.0f}; the bowl carries {mb["L"].white:.0f} and gets {SP._bearing(G, Bn, "L", wght):.0f}. '
           f'Every pair therefore encloses the same area. The exit tail reaches past its edge: it counts as ink in the gap and never sets it.')
    return '\n'.join(out), cap

def stats():
    """Before and after in four numbers (fontmeasure.py on the two finished fonts, wght 400 upright)."""
    try:
        import fontmeasure as FM
        b = FM.evenness(FM.BEFORE, 500, corners=[(400, 0)])[0]; a = FM.evenness(FM.AFTER, 464, corners=[(400, 0)])[0]
        wb = [v for _, _, v in FM.wordmark(FM.BEFORE, 500)]; wa = [v for _, _, v in FM.wordmark(FM.AFTER, 464)]
        return [[f'{b[4]:.0f} %', 'before: spread of the white between neighbours, wght 400', False], [f'{a[4]:.1f} %', 'after, same strings, same ruler', True],
                [f'{min(wb):.0f}–{max(wb):.0f}', 'before: the five gaps of aφesis, in units', False], [f'{min(wa):.0f}–{max(wa):.0f}', 'after', True]]
    except Exception as e:
        print('[page] no measurement:', e); return []

def build_page():
    G = load_glyphs(); G['.notdef'] = BUILD.notdef_strokes()
    vf = TTFont(os.path.join(DIST, 'AphesisScript-VF.ttf')); cmap = vf.getBestCmap()
    zips()
    from registry import GREEK_ACCENTED, MONOTONIC
    poly = [c for c in dict.fromkeys(unicodedata.normalize('NFC', c) for c in GREEK_ACCENTED) if c not in MONOTONIC]
    groups = [('letters', [c for c in 'abcdefghijklmnopqrstuvwxyz' if ord(c) in cmap] + [c for c in 'œæßφ' if ord(c) in cmap]),
              ('greek', [c for c in 'αβγδεζηθικλμνξοπρσςτυφχψω' if ord(c) in cmap]),
              ('greek · tonos and dialytika', [c for c in 'άέήίόύώϊϋΐΰ' if ord(c) in cmap]),
              ('greek · polytonic', [c for c in poly if ord(c) in cmap]),
              ('色即是空', [c for c in '色即是空' if ord(c) in cmap]),
              ('figures', [c for c in '0123456789' if ord(c) in cmap]),
              ('punctuation and symbols', [c for c in '.,:;!?¡¿·\u0387…\'"‘’“”«»‹›-–—_()[]/\\&@#*%+−=€' if ord(c) in cmap]),
              ('accented', [c for c in 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ' if ord(c) in cmap]),
              ('marks', [c for c in '´`ˆ˜¨˚¸¯˘᾿῾῀῎῍῏῞῝῟΅῭῁ͺ' if ord(c) in cmap])]
    data = dict(
        instances=[[(nm + (' Slanted' if s else '')) if nm != 'Regular' or not s else 'Slanted', w, s] for s in (0, -16) for nm, w in BUILD.INSTANCES],
        letters=[c for c in 'abcdefghijklmnopqrstuvwxyz' 'αβγδεζηθικλμξπρσςτυχψω' if ord(c) in cmap],
        site=RAT.SITE, greek=[['the alphabet', 'αβγδεζηθικλμνξοπρσςτυφχψω'], ['tonos and dialytika', 'ά έ ή ί ό ύ ώ ϊ ϋ ΐ ΰ'],
                              ['breathings, accents, their stacks, the iota subscript', 'ἀ ἁ ἂ ἃ ἄ ἅ ἆ ἇ ὰ ᾶ ᾳ ᾷ ῥ ῤ'],
                              ['typed in capitals — ΓΝΩΘΙ ΣΑΥΤΟΝ · ΛΟΓΟΣ · ΟΔΟΣ ΑΝΩ ΚΑΤΩ — and set as small letters, the last Σ of a word as ς', 'ΓΝΩΘΙ ΣΑΥΤΟΝ · ΛΟΓΟΣ · ΟΔΟΣ ΑΝΩ ΚΑΤΩ']],
        cjk=['aφesis · 色即是空 · form is emptiness', '空即是色 — ἓν τὸ πᾶν — solve et coagula'],
        glyphs=[[t, [[c, cmap[ord(c)]] for c in cs], ''] for t, cs in groups if cs]
               + [['stylistic set 1 · the icon style', [[c, cmap[ord(c)] + '.ss01'] for c in '·*#&' if cmap.get(ord(c), '') + '.ss01' in vf.getGlyphOrder()], 'ic-on']],
        strings=RAT.STRINGS, original=RAT.ORIGINAL, sample='solve et coagula 1463', stats=stats(),
        files=[dict(id='vf', title='Variable font', name='AphesisScript-VF.ttf', size=human(os.path.getsize(os.path.join(DIST, 'AphesisScript-VF.ttf')))),
               dict(id='fam', title='Whole family: variable + ten statics, TTF and WOFF2, with sources', name='AphesisScript-family.zip', size=human(os.path.getsize(os.path.join(DIST, 'AphesisScript-family.zip')))),
               dict(id='src', title='Build source and tools', name='AphesisScript-source.zip', size=human(os.path.getsize(os.path.join(DIST, 'AphesisScript-source.zip')))),
               dict(id='txt', title='Build source as one text file', name='AphesisScript-build-source.txt', size=human(os.path.getsize(os.path.join(DIST, 'AphesisScript-build-source.txt'))))])
    mime = {'vf': 'font/ttf', 'fam': 'application/zip', 'src': 'application/zip', 'txt': 'text/plain'}
    have = [f for f in BUILD_SOURCES if os.path.exists(os.path.join(HERE, f))]
    srcs = ''.join(f'<details><summary>src/{f}</summary><pre class="src">{html.escape(open(os.path.join(HERE, f)).read())}</pre></details>\n' for f in have)
    blocks = ''.join(f'<script type="text/plain" id="f-{f["id"]}">data:{mime[f["id"]]};base64,{b64(os.path.join(DIST, f["name"]))}</script>\n' for f in data['files'])
    proofs = ''
    for name, alt in RAT.PROOF_IMAGES:
        p = os.path.join(ROOT, 'proofs', name)
        if os.path.exists(p): proofs += f'<img alt="{html.escape(alt)}" loading="lazy" src="data:image/png;base64,{png_small(p)}">\n'
    dia, cap = diagram(G)
    t = open(os.path.join(HERE, 'page_template.html')).read()
    rep = {'VF_WOFF2': b64(os.path.join(DIST, 'AphesisScript-VF.woff2')), 'BEFORE_WOFF2': b64(os.path.join(ROOT, 'before', 'AphesisScript-VF.woff2')),
           'GLYPH_COUNT': str(len(vf.getGlyphOrder())), 'DIAGRAM': dia, 'DIAGRAM_CAPTION': cap, 'PROOF_IMAGES': proofs,
           'RATIONALE': RAT.html(G), 'VERSION': BUILD.VERSION, 'DATE': datetime.date.today().isoformat(),
           'DATA_JSON': json.dumps(data, ensure_ascii=False).replace('</', '<\\/'), 'FILE_BLOCKS': blocks,
           'SOURCE_BLOCKS': srcs, 'SOURCE_COUNT': str(len(have)), 'SOURCE_SIZE': human(sum(os.path.getsize(os.path.join(HERE, f)) for f in have))}
    for k, v in rep.items(): t = t.replace('{{' + k + '}}', v)
    out = os.path.join(DIST, 'aphesis-script.html'); open(out, 'w').write(t)
    print(out, human(len(t.encode())))

if __name__ == '__main__':
    build_page()
