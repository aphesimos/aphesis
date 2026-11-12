#!/usr/bin/env python3
"""Pin the design system into a project's page: vendor/aphesis/ and vendor/lab-kit-v1/.

A landing page (system/page-types/landing) runs the aphes.ist runtime; a paper page (system/page-types/paper) runs the
lab kit only. Neither loads anything from aphes.ist at run time: this copies the files beside the page and writes a
NOTICE.md that says what they are, where they came from (the commit) and that they are the owner's, not covered by
the project's own licence.

    python3 tools/page-types/vendor.py ../anamnesis-site --project anamnesis            # a landing page: runtime + kit
    python3 tools/page-types/vendor.py ../contraprova/ui --project contraprova --kit-only  # a paper page: the kit

Run it from a checkout of the design-system branch. It writes, under OUT/vendor/:
    aphesis/tokens.json, tokens.css (generated as the site's build does), bundle.css (without its Google Fonts
    @import: the faces come from the kit), bundle.js, <project>.svg (the still icon, for favicons), NOTICE.md
    lab-kit-v1/lab.css, lab.js, fonts/
"""
import argparse, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.normpath(os.path.join(HERE, '..', '..'))
SYS = os.path.join(DS, 'system')


def tokens_css(tok):
    """tokens.json as custom properties, exactly as site/build.py (tokens_css) writes them."""
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


def commit():
    try:
        return subprocess.check_output(['git', '-C', DS, 'rev-parse', 'HEAD'], text=True).strip()
    except Exception:
        return 'unknown'


def kit_version():
    head = open(os.path.join(SYS, 'lab-kit', 'v1', 'lab.css'), encoding='utf-8').read(400)
    m = re.search(r'lab kit (\d+\.\d+\.\d+)', head)
    return m.group(1) if m else '1.x'


NOTICE = """# the aphes.ist design system: not part of {project}'s licence

The files in this folder{beside} are aphesist's: the aphes.ist design system{runtime}, from the
[aphesis](https://github.com/aphesist/aphesis) repository, `design-system` branch. Their owner uses them on
{project}'s own page. They are **not** covered by {project}'s licence, and a fork may not use them to present itself.

Nothing on the page loads anything from aphes.ist at run time: every file is here, pinned.

| file | what | terms |
|---|---|---|
{rows}

The φ, the project icons and the wordmarks set in Aphesis Script are trademarks of aphesist and are not licensed by
the OFL or by any project's licence.

Pinned from design-system `{commit}` by `tools/page-types/vendor.py`. To update, run it again from a newer checkout.
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('out', help='the folder that holds the page (index.html)')
    ap.add_argument('--project', required=True, help='the project, for its icon and the notice')
    ap.add_argument('--kit-only', action='store_true', help='a paper page: the lab kit alone, no runtime')
    a = ap.parse_args()

    vend = os.path.join(a.out, 'vendor')
    kit_dst = os.path.join(vend, 'lab-kit-v1')
    if os.path.exists(kit_dst):
        shutil.rmtree(kit_dst)
    shutil.copytree(os.path.join(SYS, 'lab-kit', 'v1'), kit_dst, ignore=shutil.ignore_patterns('index.html'))
    rows = [f'| `{"../" if not a.kit_only else ""}lab-kit-v1/` | the lab kit {kit_version()}: `lab.css`, `lab.js` and `fonts/`: '
            'Aphesis Script (SIL OFL 1.1, Reserved Font Name "Aphesis Script") and Special Elite (Apache 2.0, © 2010 Astigmatic) '
            '| the owner\'s; the fonts under their own licences |']

    if a.kit_only:
        notice_dir = vend
    else:
        rt = os.path.join(vend, 'aphesis')
        os.makedirs(rt, exist_ok=True)
        tok = json.load(open(os.path.join(SYS, 'tokens.json'), encoding='utf-8'))
        shutil.copy(os.path.join(SYS, 'tokens.json'), rt)
        open(os.path.join(rt, 'tokens.css'), 'w', encoding='utf-8').write(
            '/* tokens.json as custom properties, generated as aphes.ist\'s build makes its tokens.css */\n' + tokens_css(tok))
        css = open(os.path.join(SYS, 'components', 'bundle.css'), encoding='utf-8').read()
        css = re.sub(r'@import url\("https://fonts\.googleapis\.com[^"]*"\);\n?', '', css, count=1)
        open(os.path.join(rt, 'bundle.css'), 'w', encoding='utf-8').write(css)
        shutil.copy(os.path.join(SYS, 'components', 'bundle.js'), rt)
        icon = os.path.join(SYS, 'assets', 'Icons', a.project + '.svg')
        if os.path.exists(icon):
            shutil.copy(icon, rt)
        rows = [
            '| `bundle.js` | the runtime, `window.Aphesis`: the fog, the brush and stipple, the icons, the eye\'s theme wave, the cursor, the tooltip, the letters, the scroll disturbance | the owner\'s; all rights reserved |',
            '| `bundle.css` | the components and the browser defaults, without the Google Fonts `@import` (the faces come from the kit) | the owner\'s; all rights reserved |',
            '| `tokens.json`, `tokens.css` | the tokens, and the same as custom properties | the owner\'s; all rights reserved |',
        ] + ([f'| `{a.project}.svg` | {a.project}\'s still icon, the source of the favicons | the owner\'s mark; all rights reserved |'] if os.path.exists(icon) else []) + rows
        notice_dir = rt

    beside = ' and the lab kit beside it (`../lab-kit-v1/`)' if not a.kit_only else ''
    runtime = ' and its runtime' if not a.kit_only else '\'s lab kit'
    open(os.path.join(notice_dir, 'NOTICE.md'), 'w', encoding='utf-8').write(
        NOTICE.format(project=a.project, beside=beside, runtime=runtime, rows='\n'.join(rows), commit=commit()))
    print(f'vendored into {vend} (design-system {commit()[:7]}, lab kit {kit_version()})')


if __name__ == '__main__':
    sys.exit(main())
