"""Aphesis Script — glyph registry: collects every glyphs_*.py module into one table and turns a
glyph name into polygons for a master. Single place that knows about composites, dotless forms,
alternates and the φ."""
import glob, importlib, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import brush as B

# character → glyph name (letters and digits get their own rows below)
NAMES = {'.': 'period', ',': 'comma', ':': 'colon', ';': 'semicolon', '!': 'exclam', '?': 'question',
         "'": 'quotesingle', '"': 'quotedbl', '‘': 'quoteleft', '’': 'quoteright',
         '“': 'quotedblleft', '”': 'quotedblright', '-': 'hyphen', '–': 'endash',
         '—': 'emdash', '(': 'parenleft', ')': 'parenright', '[': 'bracketleft', ']': 'bracketright',
         '/': 'slash', '\\': 'backslash', '&': 'ampersand', '@': 'at', '#': 'numbersign', '*': 'asterisk',
         '…': 'ellipsis', '_': 'underscore', '·': 'periodcentered', 'φ': 'phi', ' ': 'space',
         'œ': 'oe', 'æ': 'ae', 'ß': 'germandbls', 'ı': 'dotlessi', 'ȷ': 'dotlessj'}
for i, n in enumerate('zero one two three four five six seven eight nine'.split()): NAMES[str(i)] = n
NAMES.update({'\u03b1': 'alpha', '\u03b5': 'epsilon', '\u03c3': 'sigma', '\u03c2': 'sigmafinal'})      # enough Greek for αφεσις
ACCENTS = {'acute': 'áéíóúý', 'grave': 'àèìòù',
           'circumflex': 'âêîôû', 'tilde': 'ãñõ',
           'dieresis': 'äëïöüÿ', 'ring': 'å', 'cedilla': 'ç'}
BASES = {'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
         'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'í': 'i', 'ì': 'i', 'î': 'i',
         'ï': 'i', 'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ú': 'u',
         'ù': 'u', 'û': 'u', 'ü': 'u', 'ç': 'c', 'ñ': 'n', 'ý': 'y', 'ÿ': 'y'}
for acc, chars in ACCENTS.items():
    for ch in chars: NAMES[ch] = BASES[ch] + acc

def load_glyphs():
    """Merge the GLYPHS tables of all glyph modules (glyphs_core first). A later module may not
    silently redefine a glyph of an earlier one."""
    G = {}
    mods = sorted(glob.glob(os.path.join(HERE, 'glyphs_*.py')), key=lambda p: (not p.endswith('glyphs_core.py'), p))
    for path in mods:
        try:
            m = importlib.import_module(os.path.basename(path)[:-3])
        except Exception as e:                         # a module being edited must not break the others
            print(f'[registry] skipped {os.path.basename(path)}: {type(e).__name__}: {e}', file=sys.stderr); continue
        for k, spec in m.GLYPHS.items():
            if k in G: print(f'[registry] {k!r} already defined, ignoring the copy in {os.path.basename(path)}', file=sys.stderr); continue
            G[k] = spec
    return G

def split_name(name):
    """'a.2' → ('a', 2); 'period' → ('period', 0)"""
    if '.' in name and name.rsplit('.', 1)[1].isdigit():
        b, v = name.rsplit('.', 1); return b, int(v)
    return name, 0

def glyph_polys(G, name, wght=400, slnt=0, v=0, smooth=True):
    """Polygons (clockwise = ink, counter-clockwise = counter) of a glyph in its drawing frame, as
    the rasteriser will see them (strokes as smooth curves, stipple squares as squares)."""
    base, v2 = split_name(name); v = v or v2
    if base == 'phi':
        import phi
        return phi.polygons(wght)
    spec = G[base]
    if 'comp' in spec:                                  # composite: [(glyph, dx, dy), ...]
        out = []
        for part, dx, dy in spec['comp']:
            for P in glyph_polys(G, part, wght, 0, v, smooth):
                out.append(B.shear(P + np.array([dx * B.hx(wght), dy]), slnt) if part != 'phi' else P)
        return out
    strokes, squares = glyph_parts(G, name, wght, slnt, v)
    return [B.smooth_poly(P) if smooth else P for P in strokes] + squares

def glyph_parts(G, name, wght=400, slnt=0, v=0):
    """(stroke outlines, stipple squares) of a drawn glyph — what goes into the font."""
    base, v2 = split_name(name); v = v or v2
    spec = G[base]
    if 'like' in spec:                                  # same drawing as another glyph, minus its dots (ı, ȷ)
        return B.glyph_outlines(spec['like'], G[spec['like']], wght, slnt, v, dots=False), []
    return B.glyph_outlines(base, spec, wght, slnt, v), B.glyph_squares(spec, wght, slnt)
