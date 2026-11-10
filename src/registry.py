"""Aphesis Script — glyph registry: collects every glyphs_*.py module into one table and turns a
glyph name into polygons for a master. Single place that knows about names, scripts, composites,
dotless forms, alternates and the φ."""
import glob, importlib, os, sys, unicodedata
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
         'œ': 'oe', 'æ': 'ae', 'ß': 'germandbls', 'ı': 'dotlessi', 'ȷ': 'dotlessj',
         '¡': 'exclamdown', '¿': 'questiondown', '«': 'guillemotleft', '»': 'guillemotright',
         '‹': 'guilsinglleft', '›': 'guilsinglright', '€': 'Euro', '%': 'percent', '+': 'plus', '=': 'equal', '−': 'minus'}
for i, n in enumerate('zero one two three four five six seven eight nine'.split()): NAMES[str(i)] = n
FIGURES = 'zero one two three four five six seven eight nine'.split()

# ── Greek: the whole lowercase alphabet. ο and ν are the Latin o and v (the same gestures); the φ is
#    the logo itself; everything else is drawn (glyphs_extra, glyphs_greek1, glyphs_greek2).
GREEK = {'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon', 'ζ': 'zeta', 'η': 'eta', 'θ': 'theta',
         'ι': 'iota', 'κ': 'kappa', 'λ': 'lambda', 'μ': 'mu', 'ν': 'v', 'ξ': 'xi', 'ο': 'o', 'π': 'pi', 'ρ': 'rho',
         'σ': 'sigma', 'ς': 'sigmafinal', 'τ': 'tau', 'υ': 'upsilon', 'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega'}
NAMES.update(GREEK)
GREEK_LETTERS = [n for n in GREEK.values() if n not in ('v', 'o', 'phi')]      # the Greek-only drawings, in alphabet order
# ── the four characters of 色即是空, written with the same brush
CJK = {'色': 'uni8272', '即': 'uni5373', '是': 'uni662F', '空': 'uni7A7A'}
NAMES.update(CJK)

LATIN_LETTERS = [chr(c) for c in range(97, 123)]
LETTER_GLYPHS = set(LATIN_LETTERS) | {'oe', 'ae', 'germandbls', 'dotlessi', 'dotlessj', 'phi', 'phi.ss02'} | set(GREEK.values())

# ── marks and composites ──────────────────────────────────────────────────────────────────────────
# A precomposed letter is its Unicode canonical decomposition: a base letter, the marks above it
# (drawn as ONE mark glyph, also where Greek stacks two or three of them), and at most one mark below.
TOP_MARKS = {0x300: 'grave', 0x301: 'acute', 0x302: 'circumflex', 0x303: 'tilde', 0x304: 'macron', 0x306: 'breve',
             0x308: 'dieresis', 0x30A: 'ring', 0x313: 'psili', 0x314: 'dasia', 0x342: 'perispomeni'}
BELOW_MARKS = {0x327: 'cedilla', 0x345: 'ypogegrammeni'}
STACKS = {('psili', 'acute'): 'psilioxia', ('psili', 'grave'): 'psilivaria', ('psili', 'perispomeni'): 'psiliperispomeni',
          ('dasia', 'acute'): 'dasiaoxia', ('dasia', 'grave'): 'dasiavaria', ('dasia', 'perispomeni'): 'dasiaperispomeni',
          ('dieresis', 'acute'): 'dieresistonos', ('dieresis', 'grave'): 'dieresisvaria', ('dieresis', 'perispomeni'): 'dieresisperispomeni'}
GREEK_MARKS = {'acute': 'oxia', 'grave': 'varia'}       # on Greek letters the acute (tonos, oxia) and the grave (varia) are the slimmer Greek marks
BELOW = set(BELOW_MARKS.values())
NARROW = {'circumflex': 'circumflexnarrow', 'dieresis': 'dieresisnarrow'}       # on ı and ι these are written closer
SOFT = {'i': 'dotlessi', 'j': 'dotlessj'}                                        # a letter that loses its dot under a mark
# spacing forms of the marks, and the Greek signs that are another character's glyph
MARK_CODEPOINTS = {'acute': (0xB4,), 'grave': (0x60,), 'oxia': (0x384, 0x1FFD), 'varia': (0x1FEF,), 'circumflex': (0x2C6,), 'tilde': (0x2DC,), 'dieresis': (0xA8,),
                   'ring': (0x2DA,), 'cedilla': (0xB8,), 'macron': (0xAF,), 'breve': (0x2D8,), 'psili': (0x1FBF, 0x1FBD), 'dasia': (0x1FFE,),
                   'perispomeni': (0x1FC0,), 'psilioxia': (0x1FCE,), 'psilivaria': (0x1FCD,), 'psiliperispomeni': (0x1FCF,),
                   'dasiaoxia': (0x1FDE,), 'dasiavaria': (0x1FDD,), 'dasiaperispomeni': (0x1FDF,), 'dieresistonos': (0x385, 0x1FEE),
                   'dieresisvaria': (0x1FED,), 'dieresisperispomeni': (0x1FC1,), 'ypogegrammeni': (0x37A,)}
ALIASES = {0x3D5: 'phi', 0x1E9E: 'germandbls', 0x2010: 'hyphen', 0x2011: 'hyphen', 0x37E: 'semicolon', 0x387: 'anoteleia', 0xB5: 'mu',
           0x1FBE: 'iota', 0x3D0: 'beta', 0x3D1: 'theta', 0x3F4: 'theta', 0x3F0: 'kappa', 0x3F1: 'rho', 0x3F5: 'epsilon', 0x2B9: 'quotesingle', 0x374: 'quotesingle',
           0x2BC: 'quoteright'}
COMBINING = {**TOP_MARKS, **BELOW_MARKS}                                         # codepoint → the mark it is written with
COMB_ALIASES = {0x340: 0x300, 0x341: 0x301, 0x343: 0x313}
def comb_name(cp): return f'uni{cp:04X}'

LATIN_ACCENTED = 'áéíóúý' 'àèìòù' 'âêîôû' 'ãñõ' 'äëïöüÿ' 'å' 'ç'                 # by mark, the order they were first drawn in
MONOTONIC = {'ά': 'alphatonos', 'έ': 'epsilontonos', 'ή': 'etatonos', 'ί': 'iotatonos', 'ό': 'omicrontonos', 'ύ': 'upsilontonos',
             'ώ': 'omegatonos', 'ϊ': 'iotadieresis', 'ϋ': 'upsilondieresis', 'ΐ': 'iotadieresistonos', 'ΰ': 'upsilondieresistonos'}
GREEK_ACCENTED = ''.join(chr(cp) for cp in list(range(0x370, 0x400)) + list(range(0x1F00, 0x2000))
                         if unicodedata.category(chr(cp)) == 'Ll' and len(unicodedata.normalize('NFD', chr(cp))) > 1)

def decompose(ch):
    """(base letter glyph, top mark glyph or None, below mark glyph or None) of a precomposed letter;
    None if it is not one we can write."""
    d = unicodedata.normalize('NFD', ch)
    if len(d) < 2 or d[0] not in NAMES and not ('a' <= d[0] <= 'z'): return None
    base = NAMES.get(d[0], d[0]); marks = [ord(c) for c in d[1:]]
    top = tuple(TOP_MARKS[m] for m in marks if m in TOP_MARKS); below = [BELOW_MARKS[m] for m in marks if m in BELOW_MARKS]
    if len(top) + len(below) != len(marks) or len(below) > 1 or (len(top) > 1 and top not in STACKS): return None
    t = STACKS[top] if len(top) > 1 else top[0] if top else None
    if ord(ch) >= 0x370: t = GREEK_MARKS.get(t, t)                                # Greek writes its own acute and grave
    return base, t, (below[0] if below else None)

def composite_name(ch):
    if ch in MONOTONIC: return MONOTONIC[ch]
    d = decompose(ch)
    if ord(ch) < 0x250: return d[0] + (d[1] or d[2])                              # aacute, ccedilla … the Adobe names
    return f'uni{ord(ch):04X}'

_COMP = {}                                                                         # decomposition → name (ά U+03AC and ά U+1F71 are one glyph)
SEQUENCES = {}                                                                     # composite name → (the letter as typed, [combining codepoints])
for ch in LATIN_ACCENTED + GREEK_ACCENTED:
    d = decompose(ch)
    if d:
        NAMES[ch] = _COMP.setdefault(d, composite_name(ch))
        nfd = unicodedata.normalize('NFD', ch); SEQUENCES.setdefault(NAMES[ch], (NAMES.get(nfd[0], nfd[0]), [ord(c) for c in nfd[1:]]))
ACCENTED = {name: d for d, name in _COMP.items()}                                  # composite name → (base, top, below)
# what the family consisted of before 2.1: these glyphs' kerning classes are settled (see spacing.kerning_tables)
ESTABLISHED = set(LATIN_LETTERS) | set(FIGURES) | {'oe', 'ae', 'germandbls', 'dotlessi', 'phi'} \
    | {NAMES[c] for c in LATIN_ACCENTED} | {NAMES[c] for c in '.,:;!?\'"‘’“”-–—()[]/\\&@#*…_·'} \
    | {'acute', 'grave', 'circumflex', 'tilde', 'dieresis', 'ring', 'cedilla', 'circumflexnarrow', 'dieresisnarrow'}
ASCENDING = set('bdfhklt') | {'germandbls', 'beta', 'delta', 'zeta', 'theta', 'lambda', 'xi', 'psi', 'phi'}   # no room for a mark at MARK height

def composite_table(have):
    """{composite glyph: (base glyph, [mark glyphs])} for every precomposed letter whose parts are
    drawn. have(name) says whether a glyph exists. On the narrow ı and ι the circumflex and the
    dieresis are the closer-written forms."""
    out = {}
    for name, (base, top, below) in ACCENTED.items():
        b = SOFT.get(base, base)
        if b in ('dotlessi', 'iota') and top in NARROW and have(NARROW[top]): top = NARROW[top]
        marks = [m for m in (top, below) if m]
        if have(b) and all(have(m) for m in marks): out[name] = (b, marks)
    return out

def load_glyphs():
    """Merge the GLYPHS tables of all glyph modules (glyphs_core first). A later module may not
    silently redefine a glyph of an earlier one."""
    G = {}
    mods = sorted(glob.glob(os.path.join(HERE, 'glyphs_*.py')), key=lambda p: (not p.endswith('glyphs_core.py'), p))
    for path in mods:
        if os.path.basename(path)[:-3] in os.environ.get('APHESIS_SKIP', '').split(','): continue      # (a module still being drawn)
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
    if base == 'phi.ss02':                              # the φ that leans with the slanted styles
        import phi
        return [B.shear(P, slnt) for P in phi.polygons(wght)]
    spec = G[base]
    if 'comp' in spec:                                  # composite: [(glyph, dx, dy), ...]; only the first part (the letter) is re-written by v
        out = []
        for i, (part, dx, dy) in enumerate(spec['comp']):
            for P in glyph_polys(G, part, wght, 0, v if i == 0 or base in ESTABLISHED else 0, smooth):   # (2.0 measured its accents re-written too: kept, so its kerning is)
                out.append(B.shear(P + np.array([dx * B.hx(wght), dy]), slnt, G.get(part, {}).get('lean', 1.0)) if part != 'phi' else P)
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
