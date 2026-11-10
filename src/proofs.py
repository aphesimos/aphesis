"""Aphesis Script — proof sheets, rendered by Chromium from the built fonts (the real rasteriser,
real shaping: calt and kern on). Not part of the font build.

    python3 proofs.py            all sheets → ../proofs/*.png
    python3 proofs.py control    only sheets whose name contains "control"
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
AFTER = os.path.join(ROOT, 'dist', 'AphesisScript-VF.ttf')
BEFORE = os.path.join(ROOT, 'before', 'AphesisScript-VF.ttf')
OUT = os.path.join(ROOT, 'proofs')
INSTANCES = [(300, 0), (400, 0), (800, 0), (300, -16), (400, -16), (800, -16)]
ORIGINAL = 'aφesis aphesis hhihhi sisisis papapa heheh φhφ'
PANGRAMS = ['sphinx of black quartz, judge my vow', 'the quick brown fox jumps over the lazy dog',
            'quod est inferius est sicut quod est superius', 'jackdaws love my big sphinx of quartz']
REAL = ['aφesis · liber · codex · officina · opera · paries', 'as above, so below; as within, so without.',
        'solve et coagula — visita interiora terrae', 'hamburgefontsiv hamburgefontsiv', 'in girum imus nocte et consumimur igni',
        '“αφεσις” means release: a letting go, 1463–2026.', 'où est l’œuvre? déjà vu, señor; grüße, façade, æther']

def sheet(name, rows, width=2300, lh=1.2, bg='#ffffff', fg='#141212', scale=1):
    spec = dict(out=os.path.join(OUT, name + '.png'), width=width, bg=bg, fg=fg, lh=lh, scale=scale,
                fonts={'A': AFTER, 'B': BEFORE}, rows=rows)
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
            row('‘a’ “e” \'i\' "o" … _ · & @ # * aφesis@aphes.is #7 a&e', 96),
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

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:]
    for name, fn in SHEETS.items():
        if want and not any(k in name for k in want): continue
        print(sheet(name, fn()))
