"""Aphesis Script — proof sheets, rendered by Chromium from the built fonts (the real rasteriser,
real shaping: calt and kern on). Not part of the font build.

    python3 proofs.py            all sheets → ../proofs/*.png
    python3 proofs.py control    only sheets whose name contains "control"
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
AFTER = os.environ.get('APHESIS_FONT') or os.path.join(ROOT, 'dist', 'AphesisScript-VF.ttf')      # (a trial build can be proofed too)
BEFORE = os.path.join(ROOT, 'before', 'AphesisScript-VF.ttf')
V20 = os.path.join(ROOT, 'before', 'v2.000', 'AphesisScript-VF.ttf')        # the first release of the family, kept for comparison
OUT = os.environ.get('APHESIS_PROOFS') or os.path.join(ROOT, 'proofs')
INSTANCES = [(300, 0), (400, 0), (800, 0), (300, -16), (400, -16), (800, -16)]
ORIGINAL = 'aφesis aphesis hhihhi sisisis papapa heheh φhφ'
PANGRAMS = ['sphinx of black quartz, judge my vow', 'the quick brown fox jumps over the lazy dog',
            'quod est inferius est sicut quod est superius', 'jackdaws love my big sphinx of quartz']
REAL = ['aφesis · liber · codex · officina · opera · paries', 'as above, so below; as within, so without.',
        'solve et coagula — visita interiora terrae', 'hamburgefontsiv hamburgefontsiv', 'in girum imus nocte et consumimur igni',
        '“ἄφεσις” means release: a letting go, 1463–2026.', 'où est l’œuvre? déjà vu, señor; grüße, façade, æther']
SITE = ['ἓν τὸ πᾶν', 'πάντα ῥεῖ', 'γνῶθι σεαυτόν', 'ἀρχὴ ἥμισυ παντός', 'ἄδυτον', 'ἀγορά']        # the Greek the site sets today
GREEK = ['άφεση · λόγος · ψυχή · φύση · κόσμος · αλήθεια · ζωή · θεός', 'ξεσκεπάζω την ψυχοφθόρα βδελυγμία',
         'γαζέες καὶ μυρτιὲς δὲν θὰ βρῶ πιὰ στὸ χρυσαφὶ ξέφωτο', 'ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν θεόν',
         'προϋπόθεση καΐκι · ΓΝΩΘΙ ΣΕΑΥΤΟΝ · Ἑρμῆς ὁ Τρισμέγιστος', 'τῷ ῥήτορι · ᾠδή · ῥᾳδίως · ᾗ · εἷς ὤν · ἆθλον · ὗς · ὦ ἄνδρες']

def sheet(name, rows, width=2300, lh=1.2, bg='#ffffff', fg='#141212', scale=1):
    spec = dict(out=os.path.join(OUT, name + '.png'), width=width, bg=bg, fg=fg, lh=lh, scale=scale,
                fonts={'A': AFTER, 'B': BEFORE, **({'V20': V20} if os.path.exists(V20) else {})}, rows=rows)
    p = os.path.join(ROOT, 'work', f'_spec_{name}.json'); json.dump(spec, open(p, 'w'))
    subprocess.run(['node', os.path.join(ROOT, 'work', 'proof.js'), p], check=True)
    return spec['out']

def row(text, size=96, w=400, s=0, font='A', label=None, feat=None):
    r = dict(font=font, text=text, size=size, wght=w, slnt=s)
    if label: r['label'] = label
    if feat: r['feat'] = feat
    return r

SHEETS = {}
def make(name):
    def deco(fn): SHEETS[name] = fn; return fn
    return deco

for (w, s) in INSTANCES:
    @make(f'before_after_w{w}_s{abs(s)}')
    def _(w=w, s=s):
        return [row(ORIGINAL, 104, w, s, 'B', f'BEFORE — original six-glyph font · wght {w} slnt {s}'),
                row(ORIGINAL, 104, w, s, 'A', f'AFTER — Aphesis Script 2 · wght {w} slnt {s}'),
                row('aφesis', 300, w, s, 'B', 'before'), row('aφesis', 300, w, s, 'A', 'after')]

@make('wordmark')
def _():
    return [row('aφesis', 210, w, s, label=f'wght {w} slnt {s}') for (w, s) in INSTANCES]

for part, letters in (('a_i', 'abcdefghi'), ('j_r', 'jklmnopqr'), ('s_z', 'stuvwxyz')):
    @make(f'control_{part}')
    def _(letters=letters):
        rows = []
        for x in letters:
            rows.append(row(f'nn{x}nn{x}{x}nn oo{x}oo{x}{x}oo n{x}n{x}n o{x}o{x}o a{x}e{x}s{x}i h{x}φ{x}h', 84, label=f'control string · {x}'))
        return rows

@make('control_weights')
def _():
    rows = []
    for (w, s) in INSTANCES:
        rows.append(row('nnnonoonn hhihhi sisisis papapa heheh minimum illuminatio', 84, w, s, label=f'wght {w} slnt {s}'))
        rows.append(row('nnφnn ooφoo aφesis φhφ vφv rφr tφt fφf yφy', 84, w, s))
    return rows

@make('text')
def _():
    return [row(t, 86, label='real text · wght 400' if i == 0 else None) for i, t in enumerate(REAL + PANGRAMS)]

@make('text_instances')
def _():
    rows = []
    for (w, s) in [(300, 0), (400, 0), (500, 0), (700, 0), (800, 0), (300, -16), (400, -16), (500, -16), (700, -16), (800, -16)]:
        rows.append(row('sphinx of black quartz, judge my vow · aφesis 1463', 80, w, s, label=f'wght {w} slnt {s}'))
    return rows

@make('figures_punct')
def _():
    return [row('0123456789 1984 2026 30570 16 89 4·4', 96, label='oldstyle figures'),
            row('no. 7, in 1463; so: 16! or 89? (pa) [ha] a-e n–o s—o a/e a\\e', 96, label='punctuation'),
            row('‘a’ “e” \'i\' "o" … _ · & @ # * aφesis@aphes.ist #7 a&e', 96),
            row('á à â ã ä å é è ê ë í ì î ï ó ò ô õ ö ú ù û ü ç ñ ý ÿ œ æ ß', 80, label='latin-1'),
            row('0123456789 no. 7, in 1463; so: 16! or 89? (pa) [ha] ‘a’ “e” · & @ # *', 80, 300),
            row('0123456789 no. 7, in 1463; so: 16! or 89? (pa) [ha] ‘a’ “e” · & @ # *', 80, 800),
            row('0123456789 no. 7, in 1463; so: 16! or 89? (pa) [ha] ‘a’ “e” · & @ # *', 80, 400, -16)]

@make('alternates')
def _():
    t = 'aphesis possess illuminatio bookkeeper eel moon'
    return [row(t, 110, label='calt on (default): repeated letters are written again'),
            row(t, 110, label='calt off: every letter is the reference drawing', feat="'calt' 0"),
            row('ssss eeee llll oooo nnnn aaaa', 110, label='calt on'), row('ssss eeee llll oooo nnnn aaaa', 110, feat="'calt' 0", label='calt off')]

@make('ss01')
def _():
    t = 'aφesis · liber · codex * no. #7 & opera'
    return [row(t, 110, label='default'), row(t, 110, feat="'ss01' 1", label='ss01: the icon style'),
            row(t, 110, 800, -16, feat="'ss01' 1", label='ss01 · wght 800 slnt -16'), row(t, 110, 300, 0, feat="'ss01' 1", label='ss01 · wght 300'),
            row('· * # &', 300, feat="'ss01' 1")]

# ── extension 2.1: Greek, polytonic, signs, CJK ───────────────────────────────────────────────────
for part, letters in (('alpha_theta', 'αβγδεζηθ'), ('iota_pi', 'ικλμνξοπ'), ('rho_omega', 'ρσςτυφχψω')):
    @make(f'greek_control_{part}')
    def _(letters=letters):
        return [row(f'ηη{x}ηη{x}{x}ηη οο{x}οο{x}{x}οο η{x}η{x}η ο{x}ο{x}ο α{x}ε{x}ι{x}υ{x}ω ν{x}φ{x}ν', 84, label=f'greek control string · {x}') for x in letters]

@make('greek_site')
def _():
    line = ' · '.join(SITE)
    rows = [row(t, 150, label='the site’s strings · wght 400' if i == 0 else None) for i, t in enumerate(SITE)]
    for (w, s) in INSTANCES: rows.append(row(line, 62, w, s, label=f'wght {w} slnt {s}'))
    return rows

@make('greek_text')
def _():
    rows = [row(t, 84, label='greek, monotonic and polytonic · wght 400' if i == 0 else None) for i, t in enumerate(GREEK)]
    for (w, s) in [(300, 0), (800, 0), (400, -16), (800, -16)]:
        rows.append(row(GREEK[1], 76, w, s, label=f'wght {w} slnt {s}')); rows.append(row(GREEK[3], 76, w, s))
    return rows

@make('polytonic')
def _():
    rows = []
    for i, t in enumerate(['α ἀ ἁ ἂ ἃ ἄ ἅ ἆ ἇ ὰ ά ᾶ ᾰ ᾱ ᾳ ᾀ ᾁ ᾄ ᾅ ᾆ ᾇ ᾲ ᾴ ᾷ', 'ε ἐ ἑ ἒ ἓ ἔ ἕ ὲ έ · ο ὀ ὁ ὂ ὃ ὄ ὅ ὸ ό · ρ ῤ ῥ',
                           'η ἠ ἡ ἢ ἣ ἤ ἥ ἦ ἧ ὴ ή ῆ ῃ ᾐ ᾑ ᾔ ᾕ ᾖ ᾗ ῂ ῄ ῇ', 'ι ἰ ἱ ἲ ἳ ἴ ἵ ἶ ἷ ὶ ί ῖ ϊ ΐ ῒ ῗ ῐ ῑ',
                           'υ ὐ ὑ ὒ ὓ ὔ ὕ ὖ ὗ ὺ ύ ῦ ϋ ΰ ῢ ῧ ῠ ῡ', 'ω ὠ ὡ ὢ ὣ ὤ ὥ ὦ ὧ ὼ ώ ῶ ῳ ᾠ ᾡ ᾤ ᾥ ᾦ ᾧ ῲ ῴ ῷ']):
        rows.append(row(t, 80, label='every accented letter · wght 400' if i == 0 else None))
    t = 'ἀἁἂἃἄἅἆἇ ἰἱἲἳἴἵἶἷ ὐὑὒὓὔὕὖὗ ᾳῃῳ ᾷῇῷ ῥῤ ΐΰ'
    for (w, s) in [(300, 0), (800, 0), (400, -16), (800, -16)]: rows.append(row(t, 80, w, s, label=f'wght {w} slnt {s}'))
    rows.append(row('ηἰη ηἴη ηἶη ηἷη οἰο οἴο λἴλ ζἶζ δἷδ θἵθ βἰβ εἴη οἷος εἷς ὗς ἧττον', 96, label='wide marks on the narrow ι, between neighbours'))
    rows.append(row('ηἰη ηἴη ηἶη ηἷη οἰο οἴο λἴλ ζἶζ δἷδ θἵθ βἰβ εἴη οἷος εἷς ὗς ἧττον', 96, 800))
    return rows

@make('greek_small')
def _():
    line = ' · '.join(SITE); pairs = 'ἓν ἒν ἕν ἔν · ἥ ἤ ἢ ἣ · ἄ ἅ ἂ ἃ · ἆ ἇ ᾶ · ά ὰ ἀ ἁ · ΐ ῒ ῗ ϊ · λόγος· σοφία·'
    rows = []
    for (w, s) in INSTANCES:
        rows.append(row(line, 28, w, s, label=f'28 px · wght {w} slnt {s} (this sheet is rendered for a 2× screen)')); rows.append(row(pairs, 28, w, s))
    rows.append(row(line, 20, 400, 0, label='20 px · wght 400')); rows.append(row(line, 44, 400, 0, label='44 px · wght 400')); rows.append(row(pairs, 44, 400, 0))
    return rows

@make('phi_lean')
def _():
    t = 'ἄφεσις · φιλοσοφία · σοφός · aφesis'
    return [row(t, 120, 400, -16, label='slanted: the φ stands upright, as in the logo (default)'),
            row(t, 120, 400, -16, feat="'ss02' 1", label='slanted, ss02: the φ leans with the text'),
            row(t, 120, 800, -16, label='wght 800 slnt -16 · default'), row(t, 120, 800, -16, feat="'ss02' 1", label='wght 800 slnt -16 · ss02'),
            row('ΑΣΦΑΛΕΙΑ · ΠΡΟΣΦΟΡΑ · ΟΔΟΣ · ΣΟΦΟΣ', 100, label='capitals are set small: Σ becomes σ inside a word, ς at its end — also beside the φ'),
            row('αφαφα σοφός φιλοσοφία', 120, label='inside a Greek word the φ takes its turn in the cycle: the letters around it are three different drawings')]

@make('cjk')
def _():
    rows = [row('色即是空', 260, w, 0, label=f'wght {w}') for w in (300, 400, 800)]
    rows += [row('色即是空 · 空即是色', 150, 400, -16, label='wght 400 slnt -16: the characters stay upright, like the φ'),
             row('色即是空. (色即是空) “色即是空” 色/空, 空; 即: 是!', 110, 400, -16, label='… and what leans keeps its distance from them'),
             row('色即是空. (色即是空) “色即是空” 色/空, 空; 即: 是!', 110, 800, -16),
             row('aφesis · 色即是空 · form is emptiness', 110, label='with the latin'), row('色即是空 — ἓν τὸ πᾶν — solve et coagula', 110, label='with the greek'),
             row('aφesis · 色即是空 · form is emptiness', 110, 300), row('aφesis · 色即是空 · form is emptiness', 110, 800),
             row('n色n o即o h是h p空p 色色 即即 是是 空空 色空 空色', 110, label='between the controls')]
    return rows

@make('correction')
def _():
    t = 'hamburgefontsiv papapa minimum data dada had khaki'
    rows = []
    for (w, s) in [(800, 0), (700, 0), (800, -16)]:
        rows.append(row(t, 96, w, s, 'V20', f'2.0 · wght {w} slnt {s} · alternates on: a.1 d.1 h.1 k.1 m.1 too wide'))
        rows.append(row(t, 96, w, s, 'A', f'2.1 · wght {w} slnt {s} · alternates on'))
    rows.append(row(t, 96, 800, 0, 'A', '2.1 · wght 800 · alternates off', feat="'calt' 0"))
    rows.append(row(t, 96, 400, 0, 'V20', '2.0 · wght 400')); rows.append(row(t, 96, 400, 0, 'A', '2.1 · wght 400'))
    return rows

@make('signs')
def _():
    t = '¡hola! ¿qué? «no» ‹sí› 3 + 4 = 7 · 9 − 5 · 50 % · 7 € · «ἀγορά» 1463 €'
    return [row(t, 96, label='the new signs · wght 400'), row(t, 96, 300), row(t, 96, 800), row(t, 96, 400, -16), row(t, 96, 800, -16),
            row('¡ ¿ « » ‹ › € % + − =', 220), row('() [] (a) [e] · 5 µm · λόγος· σοφία· ἓν · πᾶν', 96, label='parentheses and brackets that meet · µ · the Greek raised point after a word, the separator between spaces')]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:]
    for name, fn in SHEETS.items():
        if want and not any(k in name for k in want): continue
        print(sheet(name, fn(), scale=2 if name == 'greek_small' else 1))
