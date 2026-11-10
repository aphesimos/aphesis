"""Aphesis Script — build. One entry point:

    python3 build.py            masters → variable font (TTF + WOFF2) → static instances (TTF + WOFF2)
    python3 build.py --report   also print the spacing tables (sidebearings, classes, kerning) per master
    python3 build.py --vf-only  skip the statics            python3 build.py --statics-only  only cut the statics again

Structure of the family
  scripts   Latin and Greek (monotonic and polytonic), lowercase only: every capital is mapped to its
            small letter; the four characters of 色即是空; figures, punctuation, a few signs
  axes      wght 300–800 (400 = the φ's own stroke), slnt −16…0 (OpenType: negative leans right)
  masters   3 weights × 2 slants = 6, so the heavy slanted corner is drawn, not extrapolated
  instances Light 300 · Regular 400 · Medium 500 · Bold 700 · Black 800, each also Slanted (−16)
Everything that must match between masters does by construction: every stroke has a fixed number of
points placed at fixed positions along its spline (brush.py), composites keep their components, the
φ keeps its points, and GSUB/GPOS are generated from the same tables with per-master values."""
import os, sys, math, shutil
import numpy as np
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen, TTGlyphPointPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.designspaceLib import DesignSpaceDocument, AxisDescriptor, SourceDescriptor, InstanceDescriptor
from fontTools import varLib
from fontTools.varLib import instancer
from fontTools.otlLib.builder import buildStatTable
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables import ttProgram
from fontTools.ttLib.tables._g_l_y_f import flagOverlapSimple, OVERLAP_COMPOUND, USE_MY_METRICS

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import brush as B, spacing as SP, phi as PHI, features as FEA
from registry import (load_glyphs, glyph_polys, glyph_parts, split_name, composite_table, comb_name, NAMES, FIGURES, LATIN_LETTERS,
                      GREEK_LETTERS, MARK_CODEPOINTS, NARROW, ALIASES, COMBINING, COMB_ALIASES, BELOW, SEQUENCES, ASCENDING, ESTABLISHED)

FAMILY, VERSION = 'Aphesis Script', '2.101'
OUT = os.environ.get('APHESIS_OUT') or os.path.join(HERE, '..', 'dist'); TMP = os.path.join(HERE, '..', 'build')      # (APHESIS_OUT: a trial build elsewhere)
MASTERS = [(400, 0), (300, 0), (800, 0), (400, -16), (300, -16), (800, -16)]          # default first
INSTANCES = [('Light', 300), ('Regular', 400), ('Medium', 500), ('Bold', 700), ('Black', 800)]
ASCENT, DESCENT = 820, -280                                    # hhea = typo = win: one line height everywhere

# ── glyph set ─────────────────────────────────────────────────────────────────────────────────────
LETTERS = LATIN_LETTERS
EXTRA_LETTERS = ['oe', 'ae', 'germandbls', 'dotlessi', 'alpha', 'epsilon', 'sigma', 'sigmafinal']        # also get alternates

def glyph_table(G):
    """(glyph order, cmap, rotating letters, accented composites, combining marks). Only what has
    been drawn is included. The order is the order things were added to the family in: the Latin
    with its accents first, then the rest of the Greek — kerning classes are formed in this order,
    so the Latin's are not disturbed by what came later."""
    have = lambda n: n in G or n == 'phi'
    first = [l for l in LETTERS + EXTRA_LETTERS if have(l)]
    accented = composite_table(have)                           # composite name → (base glyph, [mark glyphs])
    latin = [n for n, (b, _) in accented.items() if b in LETTERS or b in ('dotlessi', 'dotlessj')]
    later = [n for n in ['dotlessj'] + GREEK_LETTERS if have(n) and n not in first]
    rotating = first + latin + later + [n for n in accented if n not in latin]     # every letter takes part in the calt cycle
    order = ['.notdef', 'space'] + rotating + [f'{n}.{v}' for v in (1, 2) for n in rotating]
    for ch, n in NAMES.items():
        if n not in order and have(n): order.append(n)
    order += [m for m in MARK_CODEPOINTS if have(m) and m not in order]
    order += [m for m in NARROW.values() if have(m)]
    combining = {comb_name(cp): m for cp, m in COMBINING.items() if have(m)}      # zero-width forms of the marks
    order += list(combining)
    if have('sigma') and have('sigmafinal'): order.append('Sigma')   # the capital Σ: set as σ, or as ς where it ends a word (ccmp)
    order += [n for n in ('anoteleia',) if have(n) and n not in order]   # the Greek raised point (U+0387, and · in a Greek run)
    order += [f + '.tnum' for f in FIGURES if f in order]            # tabular figures: the same drawings on one width
    order += [n for n in G if n.endswith('.ss01')]
    order.append('phi.ss02')                                         # the φ that leans with the slanted styles
    cmap = {0x20: 'space', 0xA0: 'space'}
    for ch, n in NAMES.items():
        if n in order: cmap[ord(ch)] = n
    for l in LETTERS:
        if l in order: cmap[ord(l)] = l
    for m, cps in MARK_CODEPOINTS.items():
        if m in order: cmap.update(dict.fromkeys(cps, m))
    for cp, n in ALIASES.items():
        if n in order: cmap[cp] = n
    for cp in COMBINING:
        if comb_name(cp) in order: cmap[cp] = comb_name(cp)
    for cp, to in COMB_ALIASES.items():
        if to in cmap: cmap[cp] = cmap[to]
    if 'Sigma' in order: cmap[0x3A3] = 'Sigma'
    for cp in [*range(0x41, 0x250), *range(0x370, 0x400), *range(0x1E00, 0x2000)]:     # no capitals: A → a, Ω → ω, Ἀ → ἀ
        lo = chr(cp).lower()
        if cp not in cmap and len(lo) == 1 and ord(lo) != cp and ord(lo) in cmap: cmap[cp] = cmap[ord(lo)]
    return order, cmap, rotating, accented, combining

def mark_data(G, table, wght, slnt):
    """What the ccmp and mark features need for one master: the combining marks by position, the
    anchors of the letters that can carry them (in font units, after each drawing's own fit), and the
    rules that turn letter + combining marks into the precomposed letter."""
    order, cmap, rotating, accented, combining = table
    have = set(order)
    cls = lambda m: 'ced' if m == 'cedilla' else 'sub' if m in BELOW else 'top'
    marks = {k: [g for g, m in combining.items() if cls(m) == k] for k in ('top', 'ced', 'sub')}
    anchors = {}
    for b in rotating:
        if b in accented or b in ASCENDING or b in ('i', 'j'): continue      # i and j lose their dot first (ccmp), then carry the mark
        for g in (b, b + '.1', b + '.2'):
            if g not in have: continue
            dx = SP.metrics(G, g, wght, slnt)[0]; a = {'top': SP.anchor(G, b, 'acute', wght) + dx}
            if 'below' in G.get(b, {}): a['ced'] = SP.anchor(G, b, 'cedilla', wght) + dx
            if b in ('alpha', 'eta', 'omega'): a['sub'] = SP.anchor(G, b, 'ypogegrammeni', wght) + dx
            anchors[g] = {k: int(round(v)) for k, v in a.items() if marks[k]}
    by_seq = {(b, tuple(cps)): n for n, (b, cps) in SEQUENCES.items() if n in have}
    compose = []
    for n, (b, cps) in SEQUENCES.items():
        if n not in have or b not in have or any(comb_name(c) not in have for c in cps): continue
        for j in range(len(cps)):                                   # from the bare letter, and from every precomposed stage on the way
            start = b if j == 0 else by_seq.get((b, tuple(cps[:j])))
            if start: compose.append(([start] + [comb_name(c) for c in cps[j:]], n))
    first, general, greek_first = {}, [], []                         # Greek ο is the Latin o: the same sequence, another letter (ό, not ó)
    for seq, n in compose:
        if first.setdefault(tuple(seq), n) == n: general.append((seq, n))
        else: greek_first.append((seq, n))
    soft = {a: b for a, b in (('i', 'dotlessi'), ('j', 'dotlessj')) if a in have and b in have}
    greek = {g for cp, g in cmap.items() if 0x370 <= cp < 0x400 or 0x1F00 <= cp < 0x2000}
    return dict(marks=marks, anchors=anchors, compose=general, compose_grek=greek_first, soft=soft, capsigma='Sigma' in have,
                greek=greek, anoteleia='anoteleia' in have and 'periodcentered' in have)

# ── outlines ──────────────────────────────────────────────────────────────────────────────────────
def notdef_strokes():
    """Even the missing-glyph box is written with the brush."""
    w, h = 300, 640
    return dict(strokes=[B.S([(40, h, B.PIN), (38, h / 2, B.PIN), (40, 0, B.PIN)], tin=20, tout=30, b0=0.5, b1=0.4),
                         B.S([(40 + w, h, B.PIN), (42 + w, h / 2, B.PIN), (40 + w, 0, B.PIN)], tin=20, tout=30, b0=0.5, b1=0.4),
                         B.S([(30, h - 6, B.PIN), (40 + w / 2, h, B.PIN), (50 + w, h - 4, B.PIN)], tin=20, tout=30, b0=0.5, b1=0.4),
                         B.S([(30, 4, B.PIN), (40 + w / 2, 0, B.PIN), (50 + w, 6, B.PIN)], tin=20, tout=30, b0=0.5, b1=0.4)],
                L=60, R=60)

def draw_simple(strokes, squares, dx):
    """Strokes: the brush's outline points become quadratic control points with no on-curve points
    (TrueType implies them halfway), so the edge is smooth ink with a fixed point count. Stipple
    squares stay squares."""
    pen = TTGlyphPen(None)
    for P in strokes:
        pen.qCurveTo(*[(int(round(x + dx)), int(round(y))) for x, y in P], None); pen.closePath()
    for P in squares:
        pts = [(int(round(x + dx)), int(round(y))) for x, y in P]
        pen.moveTo(pts[0])
        for q in pts[1:]: pen.lineTo(q)
        pen.closePath()
    g = pen.glyph()
    if g.numberOfContours > 0: g.flags[0] |= flagOverlapSimple      # strokes overlap: tell the rasteriser
    return g

def draw_phi(wght, dx, slnt=0):
    """The φ's own points go straight into the glyph (same structure in every master). slnt: for the
    form that leans (ss02), the same points sheared like every letter."""
    pen = TTGlyphPointPen(None); t = math.tan(math.radians(-slnt))
    for c in PHI.contours(wght):
        pen.beginPath()
        for i, (x, y, on) in enumerate(c):
            seg = None if not on else ('line' if c[i - 1][2] else 'qcurve')
            pen.addPoint((int(round(x + dx + (y - B.XH / 2) * t)), int(round(y))), segmentType=seg)
        pen.endPath()
    return pen.glyph(dropImpliedOnCurves=False)

def build_master(G, wght, slnt, path, table, kern):
    order, cmap, rotating, accented, combining = table
    glyphs, adv = {}, {}
    empty = TTGlyphPen(None).glyph()
    for name in order:
        base, v = split_name(name)
        if name == 'space': glyphs[name] = empty; adv[name] = SP.space_width(wght); continue
        if name.endswith('.tnum'):                                  # the figure, centred on the common figure width
            fig = name[:-5]; _, a = SP.metrics(G, fig, wght, slnt)
            tw = max(SP.metrics(G, f, w, 0)[1] for f in FIGURES if f in G for w in B.MASTER_WEIGHTS)   # one width in every weight: columns align
            pen = TTGlyphPen(dict.fromkeys(order)); pen.addComponent(fig, (1, 0, 0, 1, int(round((tw - a) / 2)), 0))
            g = pen.glyph(); g.components[0].flags |= OVERLAP_COMPOUND
            glyphs[name] = g; adv[name] = tw; continue
        if name in ('phi', 'phi.ss02'):                             # the φ stands upright in every master; its ss02 form leans with the letters
            dx, a = SP.metrics(G, name, wght, slnt)                  # moved by whole units only: the drawing is never re-rounded
            glyphs[name] = draw_phi(wght, round(dx), slnt if name != 'phi' else 0); glyphs[name].flags[0] |= flagOverlapSimple; adv[name] = a; continue
        if base in accented:                                        # composite: base letter + its mark(s)
            b, marks = accented[base]
            bname = b + (f'.{v}' if v else '')
            dxb, a = SP.metrics(G, bname, wght, slnt)                # the base letter in this drawing, with its own fit
            pen = TTGlyphPen(dict.fromkeys(order)); pen.addComponent(bname, (1, 0, 0, 1, 0, 0))
            for mark in marks:                                      # a mark is drawn around x = 0: it goes to the letter's anchor
                ax = SP.anchor(G, b, mark, wght) + dxb - SP.metrics(G, mark, wght, slnt)[0]
                pen.addComponent(mark, (1, 0, 0, 1, int(round(ax)), 0))
            g = pen.glyph(); g.components[0].flags |= USE_MY_METRICS | OVERLAP_COMPOUND
            glyphs[name] = g; adv[name] = a; continue
        if name == 'Sigma':                                         # a σ until ccmp has decided between σ and ς
            pen = TTGlyphPen(dict.fromkeys(order)); pen.addComponent('sigma', (1, 0, 0, 1, 0, 0))
            g = pen.glyph(); g.components[0].flags |= USE_MY_METRICS | OVERLAP_COMPOUND
            glyphs[name] = g; adv[name] = SP.metrics(G, 'sigma', wght, slnt)[1]; continue
        if name in combining:                                       # the mark itself, centred on the origin, no advance
            mark = combining[name]
            pen = TTGlyphPen(dict.fromkeys(order)); pen.addComponent(mark, (1, 0, 0, 1, int(round(-SP.metrics(G, mark, wght, slnt)[0])), 0))
            g = pen.glyph(); g.components[0].flags |= OVERLAP_COMPOUND
            glyphs[name] = g; adv[name] = 0; continue
        dx, a = SP.metrics(G, name, wght, slnt)
        glyphs[name] = draw_simple(*glyph_parts(G, name, wght, slnt, v), round(dx)); adv[name] = a   # placed by whole units: spacing never re-rounds a drawing
    fb = FontBuilder(B.UPM, isTTF=True)
    fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap); fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({n: (int(round(adv[n])), glyphs[n].xMin if glyphs[n].numberOfContours else 0) for n in order})
    fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
    fb.setupNameTable({'familyName': FAMILY, 'styleName': 'Regular', 'fullName': FAMILY + ' Regular', 'psName': 'AphesisScript-Regular',
                       'uniqueFontIdentifier': f'{VERSION};APHS;AphesisScript-Regular', 'version': f'Version {VERSION}'}, mac=False)
    fb.setupOS2(version=4, sTypoAscender=ASCENT, sTypoDescender=DESCENT, sTypoLineGap=0, usWinAscent=ASCENT, usWinDescent=-DESCENT,
                sxHeight=B.XH, sCapHeight=B.ASC, usWeightClass=400, fsSelection=0x40 | 0x80, achVendID='APHS', fsType=0,
                yStrikeoutSize=56, yStrikeoutPosition=250, ySubscriptXSize=650, ySubscriptYSize=600, ySubscriptXOffset=0, ySubscriptYOffset=75,
                ySuperscriptXSize=650, ySuperscriptYSize=600, ySuperscriptXOffset=0, ySuperscriptYOffset=350)
    fb.setupPost(underlinePosition=-110, underlineThickness=56)
    addOpenTypeFeaturesFromString(fb.font, FEA.feature_code(order, rotating, accented, kern[(wght, slnt)], mark_data(G, table, wght, slnt)))
    fb.save(path)

# ── variable font ─────────────────────────────────────────────────────────────────────────────────
def build_vf(G, report=False):
    os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
    table = glyph_table(G)
    G['.notdef'] = notdef_strokes()
    kern = SP.kerning_tables(G, table[0], MASTERS, report=report, composites=table[3], settled=ESTABLISHED)
    ds = DesignSpaceDocument()
    for tag, name, mn, df, mx in (('wght', 'Weight', 300, 400, 800), ('slnt', 'Slant', -16, 0, 0)):
        a = AxisDescriptor(); a.tag, a.name, a.minimum, a.default, a.maximum = tag, name, mn, df, mx; ds.addAxis(a)
    for w, s in MASTERS:
        p = os.path.join(TMP, f'master-{w}-{abs(s)}.ttf'); build_master(G, w, s, p, table, kern)
        src = SourceDescriptor(); src.path = p; src.location = {'Weight': w, 'Slant': s}; ds.addSource(src)
        if report and s == 0: SP.report(G, [n for n in table[0] if n != '.notdef' and '.' not in n and (n == 'phi' or 'strokes' in G.get(n, ()) or 'like' in G.get(n, ()))], w)
    for s, suffix in ((0, ''), (-16, ' Slanted')):
        for nm, w in INSTANCES:
            style = (nm + suffix) if nm != 'Regular' or not suffix else 'Slanted'
            i = InstanceDescriptor(); i.styleName = style; i.familyName = FAMILY
            i.postScriptFontName = 'AphesisScript-' + style.replace(' ', ''); i.location = {'Weight': w, 'Slant': s}; ds.addInstance(i)
    vf, _, _ = varLib.build(ds)
    finish(vf)
    return vf

def finish(font, style='Regular', wght=400, slnt=0):
    """Names, STAT and the small tables a production font carries."""
    name = font['name']
    def setn(i, s): name.setName(s, i, 3, 1, 0x409)
    setn(0, 'Copyright 2026 The Aphesis Script Project Authors (aphes.is)')
    setn(5, f'Version {VERSION}'); setn(3, f'{VERSION};APHS;AphesisScript-{style.replace(" ", "")}')
    setn(8, 'aphes.is'); setn(9, 'aphes.is'); setn(11, 'https://aphes.is'); setn(12, 'https://aphes.is')
    setn(10, 'A lowercase-only brush script for Latin and Greek (monotonic and polytonic), written with the brush of a hand-drawn φ; '
             'with the four characters of 色即是空. Every glyph is brush strokes; nothing is solid.')
    font['head'].fontRevision = float(VERSION); font['head'].flags |= 0b1011
    font['OS/2'].panose.bFamilyType = 3; font['OS/2'].recalcUnicodeRanges(font)
    font['OS/2'].ulCodePageRange1 = 0b1001                        # Latin 1 and Greek
    gasp = font['gasp'] = newTable('gasp'); gasp.version = 1; gasp.gaspRange = {0xFFFF: 0x000F}
    prep = font['prep'] = newTable('prep'); prep.program = ttProgram.Program(); prep.program.fromAssembly(['PUSHW[]', '511', 'SCANCTRL[]', 'PUSHB[]', '4', 'SCANTYPE[]'])
    if 'fvar' in font:
        buildStatTable(font, [
            dict(tag='wght', name='Weight', values=[dict(value=300, name='Light'), dict(value=400, name='Regular', flags=0x2, linkedValue=700),
                                                    dict(value=500, name='Medium'), dict(value=700, name='Bold'), dict(value=800, name='Black')]),
            dict(tag='slnt', name='Slant', values=[dict(value=0, name='Upright', flags=0x2, linkedValue=-16), dict(value=-16, name='Slanted')])],
            elidedFallbackName=2)
        if 'avar' not in font:                                    # the axes are linear in design space: say so explicitly
            avar = font['avar'] = newTable('avar'); avar.segments = {a.axisTag: {-1.0: -1.0, 0.0: 0.0, 1.0: 1.0} for a in font['fvar'].axes}
    name.names = [n for n in name.names if n.platformID == 3]      # Windows/Unicode names only

def build_statics(vf_path):
    """Static TTF + WOFF2 for every named instance, cut from the variable font with the instancer.
    Names follow the usual four-style linking: within each weight the Slanted cut is the 'Italic'
    partner of the upright one, and Bold links to Regular."""
    for s in (0, -16):
        for nm, w in INSTANCES:
            style = (nm + (' Slanted' if s else '')) if nm != 'Regular' or not s else 'Slanted'
            f = instancer.instantiateVariableFont(TTFont(vf_path), {'wght': w, 'slnt': s})
            ribbi = nm in ('Regular', 'Bold')
            fam1 = FAMILY if ribbi else f'{FAMILY} {nm}'
            sub2 = ('Bold ' if nm == 'Bold' else '') + ('Italic' if s else '') or 'Regular'
            ps = 'AphesisScript-' + style.replace(' ', '')
            n = f['name']
            def setn(i, t): n.setName(t, i, 3, 1, 0x409)
            setn(1, fam1); setn(2, sub2.strip()); setn(3, f'{VERSION};APHS;{ps}'); setn(4, f'{FAMILY} {style}'); setn(6, ps)
            setn(16, FAMILY); setn(17, style)
            buildStatTable(f, [                                    # a static cut says where it sits: its weight, and upright or not. The cuts are
                # style-linked as roman and italic, and for such a family the second axis is 'ital' (the variable font, which has the real axis, says slnt)
                dict(tag='wght', name='Weight', values=[dict(value=w, name=nm, **(dict(flags=0x2, linkedValue=700) if nm == 'Regular' else {}))]),
                dict(tag='ital', name='Italic', values=[dict(value=1, name='Slanted') if s else dict(value=0, name='Roman', flags=0x2, linkedValue=1)])],
                elidedFallbackName='Regular', macNames=False)
            st = f['STAT'].table                                   # … and keeps no names of the variable font that nothing points to any more
            used = {a.AxisNameID for a in st.DesignAxisRecord.Axis} | {v.ValueNameID for v in st.AxisValueArray.AxisValue} | {st.ElidedFallbackNameID}
            used |= {fr.Feature.FeatureParams.UINameID for fr in f['GSUB'].table.FeatureList.FeatureRecord if getattr(fr.Feature.FeatureParams, 'UINameID', None)}
            n.names = [r for r in n.names if r.platformID == 3 and (r.nameID < 256 or r.nameID in used)]
            os2 = f['OS/2']; os2.usWeightClass = w
            sel = (os2.fsSelection & ~0x261) | (0x201 if s else 0) | (0x20 if nm == 'Bold' else 0)
            os2.fsSelection = sel if sel & 0x21 else sel | 0x40
            f['head'].macStyle = (1 if nm == 'Bold' else 0) | (2 if s else 0)
            if s:
                f['post'].italicAngle = float(s)
                f['hhea'].caretSlopeRise = 1000; f['hhea'].caretSlopeRun = round(1000 * math.tan(math.radians(-s)))
            base = os.path.join(OUT, 'static', ps); os.makedirs(os.path.dirname(base), exist_ok=True)
            f.save(base + '.ttf'); f.flavor = 'woff2'; f.save(base + '.woff2')

if __name__ == '__main__':
    p = os.path.join(OUT, 'AphesisScript-VF.ttf')
    if '--statics-only' in sys.argv: build_statics(p); sys.exit()   # (cut the statics again from the variable font that is there)
    G = load_glyphs()
    vf = build_vf(G, report='--report' in sys.argv)
    vf.save(p)
    w2 = TTFont(p); w2.flavor = 'woff2'; w2.save(p.replace('.ttf', '.woff2'))
    print('VF', os.path.getsize(p), 'bytes;', len(vf.getGlyphOrder()), 'glyphs')
    if '--vf-only' not in sys.argv: build_statics(p)
