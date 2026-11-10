"""Aphesis Script — OpenType features (generated; identical structure in every master).

calt  Every letter exists in three drawings: the reference (x), and x.1, x.2 — the same skeleton
      written again by the same hand (brush.vary). One contextual lookup rotates them along a run
      of letters:   default default' → .1      .1 default' → .2      (.2 default stays default)
      so the drawings go 0 1 2 0 1 2 … from the first letter of every word. Two neighbouring letters
      are therefore never the same drawing — "ss", "ee", "ll", "oo" cannot look stamped — and the
      pattern is deterministic: the same word always sets the same way. Any non-letter restarts it.
kern  class-based pairs; classes and pair list are the same in every master, only the values
      differ, so varLib merges them into variable kerning.
tnum  tabular figures: the same oldstyle drawings centred on one common width.
ss01  the stippled (icon-style) versions of a few symbols, where they exist."""

def _cls(name, glyphs): return f'@{name} = [{" ".join(glyphs)}];\n'

def feature_code(order, rotating, accented, kern):
    fea = ''
    have = set(order)
    c0 = [n for n in rotating if f'{n}.1' in have and f'{n}.2' in have]
    if c0:
        fea += _cls('c0', c0) + _cls('c1', [n + '.1' for n in c0]) + _cls('c2', [n + '.2' for n in c0])
        fea += "feature calt {\n  sub @c0 @c0' by @c1;\n  sub @c1 @c0' by @c2;\n} calt;\n"
    ss = [n for n in order if n.endswith('.ss01') and n[:-5] in have]
    if ss:
        fea += 'feature ss01 {\n  featureNames { name "Icon style"; };\n' + ''.join(f'  sub {n[:-5]} by {n};\n' for n in ss) + '} ss01;\n'
    tn = [n for n in order if n.endswith('.tnum')]
    if tn:
        fea += 'feature tnum {\n' + ''.join(f'  sub {n[:-5]} by {n};\n' for n in tn) + '} tnum;\n'
    first, second, pairs = kern
    if pairs:
        own = {n for c in first for n in c}, {n for c in second for n in c}
        def members(c, side):                 # a class carries its alternates, and the accented forms that are not classed themselves
            out = []
            for n in c:
                fam = [n] + [a for a, (b, m) in accented.items() if (b == n or (b == 'i' and n == 'dotlessi')) and a not in own[side]]
                for f in fam:
                    out += [g for g in (f, f + '.1', f + '.2') if g in have]
            return out
        used1 = sorted({i for i, _ in pairs}); used2 = sorted({j for _, j in pairs})
        for i in used1: fea += _cls(f'k1_{i}', members(first[i], 0))
        for j in used2: fea += _cls(f'k2_{j}', members(second[j], 1))
        fea += 'feature kern {\n' + ''.join(f'  pos @k1_{i} @k2_{j} {v};\n' for (i, j), v in sorted(pairs.items())) + '} kern;\n'
    return fea
