"""Aphesis Script — OpenType features (generated; identical structure in every master).

ccmp  Letter + combining marks → the precomposed letter (a + U+0301 → á, α + U+0313 + U+0301 → ἄ,
      also from every precomposed stage on the way: ἀ + U+0301 → ἄ), for text that arrives
      decomposed. Greek ο and Latin o are one glyph, but ό carries the Greek oxia and ó the Latin
      acute: in a Greek run (script grek) the Greek composition comes first. An i or j that keeps a
      combining mark above loses its dot. And because capitals are set as small letters, a capital
      Σ becomes σ before a letter and ς at the end of a word.
locl  In Greek a raised point that follows a letter directly is the ano teleia: it stands at the x-line.
      (Between spaces it stays what the site uses it for, the separator at mid-height.)
calt  Every letter exists in three drawings: the reference (x), and x.1, x.2 — the same skeleton
      written again by the same hand (brush.vary). One contextual lookup rotates them along a run
      of letters:   default default' → .1      .1 default' → .2      (.2 default stays default)
      so the drawings go 0 1 2 0 1 2 … from the first letter of every word. Two neighbouring letters
      are therefore never the same drawing — "ss", "ee", "ll", "oo" cannot look stamped — and the
      pattern is deterministic: the same word always sets the same way. Any non-letter restarts it.
      The φ has one drawing only (it is the logo's). Between Latin letters it restarts the cycle, as
      it always did (aφesis); inside a Greek word it takes its turn in it, so the letters around it
      go on rotating (σοφός, φιλοσοφία).
kern  class-based pairs; classes and pair list are the same in every master, only the values
      differ, so varLib merges them into variable kerning.
mark  Combining marks that found no precomposed letter are placed on the letter's anchor (the same
      anchors the precomposed letters are built with), per master.
tnum  tabular figures: the same oldstyle drawings centred on one common width.
ss01  the stippled (icon-style) versions of a few symbols, where they exist.
ss02  a φ that leans with the slanted styles (by default the φ stands upright in all of them).
GDEF  says which glyphs are combining marks, so calt and kern look past them."""

def _cls(name, glyphs): return f'@{name} = [{" ".join(glyphs)}];\n'

def feature_code(order, rotating, accented, kern, md=None):
    fea = 'languagesystem DFLT dflt;\nlanguagesystem latn dflt;\nlanguagesystem grek dflt;\n'
    have = set(order)
    md = md or dict(marks={}, anchors={}, compose=[], soft={}, capsigma=False)
    c0 = [n for n in rotating if f'{n}.1' in have and f'{n}.2' in have]
    comb = [g for k in ('top', 'ced', 'sub') for g in md['marks'].get(k, [])]
    skip = '  lookupflag IgnoreMarks;\n' if comb else ''
    if comb:
        for k in ('top', 'ced', 'sub'):
            if md['marks'][k]: fea += f'markClass [{" ".join(md["marks"][k])}] <anchor 0 0> @M{k};\n'
        fea += _cls('bases', [g for g in order if g in md['anchors']]) + _cls('combining', comb)
        fea += 'table GDEF {\n  GlyphClassDef @bases, , @combining, ;\n} GDEF;\n'
        rules = lambda rs: ''.join(f'  sub {" ".join(seq)} by {out};\n' for seq, out in rs)
        looks, greek = ['compose'], []
        if md.get('compose_grek'):                         # what Greek composes differently comes first, and only in a Greek run
            fea += 'lookup composegreek {\n' + rules(md['compose_grek']) + '} composegreek;\n'; greek = ['composegreek']
        fea += 'lookup compose {\n' + rules(md['compose']) + '} compose;\n'
        if md['soft'] and md['marks']['top']:
            fea += 'lookup undot {\n' + ''.join(f"  sub {a}' @Mtop by {b};\n" for a, b in md['soft'].items()) + '} undot;\n'; looks.append('undot')
        if md.get('capsigma'):
            fea += _cls('letters', c0 + [g for g in ('phi',) if g in have] + ['Sigma'])
            fea += "lookup capsigma {\n  lookupflag IgnoreMarks;\n  sub Sigma' @letters by sigma;\n  sub @letters Sigma' by sigmafinal;\n  sub Sigma' by sigma;\n} capsigma;\n"
            looks.append('capsigma')
        use = lambda names: ''.join(f'  lookup {n};\n' for n in names)
        fea += 'feature ccmp {\n  script DFLT;\n' + use(looks) + '  script latn;\n' + use(looks) + '  script grek;\n' + use(greek + looks) + '} ccmp;\n'
    if md.get('anoteleia'):                                # · directly after a Greek letter is the ano teleia; between spaces it stays the separator
        fea += _cls('greekletters', [n for n in c0 + ['phi'] if n in md.get('greek', ()) and n in have])
        fea += "feature locl {\n  script grek;\n  lookupflag IgnoreMarks;\n  sub @greekletters periodcentered' by anoteleia;\n} locl;\n"
    if c0:
        fea += _cls('c0', c0) + _cls('c1', [n + '.1' for n in c0]) + _cls('c2', [n + '.2' for n in c0])
        g0 = [n for n in c0 if n in md.get('greek', ())] if 'phi' in have else []
        if g0: fea += _cls('g0', g0) + _cls('g1', [n + '.1' for n in g0]) + _cls('g2', [n + '.2' for n in g0])
        fea += "feature calt {\n" + skip + "  sub @c0 @c0' by @c1;\n  sub @c1 @c0' by @c2;\n"
        if g0:                                             # the φ inside a Greek word takes a turn in the cycle: x φ y' → y.2, x.1 φ y stays, else φ y' → y.1
            fea += "  ignore sub @c1 phi @g0';\n  sub @c0 phi @g0' by @g2;\n  sub phi @g0' by @g1;\n"
        fea += "} calt;\n"
    for tag, label in (('ss01', 'Icon style'), ('ss02', 'Leaning phi')):
        ss = [n for n in order if n.endswith('.' + tag) and n[:-5] in have]
        if ss:
            fea += f'feature {tag} {{\n  featureNames {{ name "{label}"; }};\n' + ''.join(f'  sub {n[:-5]} by {n};\n' for n in ss) + f'}} {tag};\n'
    tn = [n for n in order if n.endswith('.tnum')]
    if tn:
        fea += 'feature tnum {\n' + ''.join(f'  sub {n[:-5]} by {n};\n' for n in tn) + '} tnum;\n'
    first, second, pairs = kern
    if pairs:
        own = {n for c in first for n in c}, {n for c in second for n in c}
        def members(c, side):                 # a class carries its alternates, and the accented forms that are not classed themselves
            out = []
            for n in c:
                fam = [n] + [a for a, (b, m) in accented.items() if b == n and a not in own[side]]
                for f in fam:
                    out += [g for g in (f, f + '.1', f + '.2') if g in have]
            return out
        used1 = sorted({i for i, _ in pairs}); used2 = sorted({j for _, j in pairs})
        for i in used1: fea += _cls(f'k1_{i}', members(first[i], 0))
        for j in used2: fea += _cls(f'k2_{j}', members(second[j], 1))
        fea += 'feature kern {\n' + skip + ''.join(f'  pos @k1_{i} @k2_{j} {v};\n' for (i, j), v in sorted(pairs.items())) + '} kern;\n'
    if comb and md['anchors']:
        fea += 'feature mark {\n'
        for g, a in md['anchors'].items():
            fea += f'  pos base {g}' + ''.join(f' <anchor {x} 0> mark @M{k}' for k, x in a.items()) + ';\n'
        fea += '} mark;\n'
    return fea
