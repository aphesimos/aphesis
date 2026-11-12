#!/usr/bin/env python3
"""Build me.aphes.ist: the page, the lab kit it stands on, the φ, and the files Cloudflare Pages reads.

  python3 me/build.py                        # writes dist/ from origin/design-system (or the local branch)
  python3 me/build.py --out DIR              # somewhere else
  python3 me/build.py --ref design-system    # the lab kit from another ref
  python3 me/build.py --require-filled       # stop if a [[placeholder]] is still in the page (the deploy does this)

The page is me/index.html, served as it is. The lab kit (design-system: system/lab-kit/v1/) is copied beside it, so
the page loads from its own origin and keeps working if aphes.ist is down; the φ comes from
system/assets/Logos/phi.svg. Nothing is generated: the build only gathers files and checks the placeholders.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = 'system/lab-kit/v1/'
PHI = 'system/assets/Logos/phi.svg'
PLACEHOLDER = re.compile(r'\[\[([^\]]+)\]\]')


def git(*args, binary=False):
    out = subprocess.run(['git', '-C', HERE] + list(args), capture_output=True, check=True).stdout
    return out if binary else out.decode('utf-8')


def resolve(ref):
    """The ref asked for, or the first of origin/design-system and design-system that exists."""
    for r in ([ref] if ref else ['origin/design-system', 'design-system']):
        try:
            return git('rev-parse', '--verify', '--quiet', r + '^{commit}').strip(), r
        except subprocess.CalledProcessError:
            continue
    sys.exit(f'build: no design-system ref ({ref or "origin/design-system, design-system"}); '
             'fetch it: git fetch origin design-system:refs/remotes/origin/design-system')


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--out', default='dist')
    ap.add_argument('--ref', help='where the lab kit comes from (default: origin/design-system, else design-system)')
    ap.add_argument('--require-filled', action='store_true', help='fail while a [[placeholder]] is left in the page')
    a = ap.parse_args()

    with open(os.path.join(HERE, 'index.html'), encoding='utf-8') as f:
        page = f.read()
    left = sorted(set(PLACEHOLDER.findall(page)))
    if left:
        print('placeholders still in me/index.html: ' + ', '.join(f'[[{p}]]' for p in left), file=sys.stderr)
        if a.require_filled:
            sys.exit('build: fill them before deploying (or build without --require-filled to preview)')

    sha, ref = resolve(a.ref)
    out = os.path.abspath(a.out)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)

    write(os.path.join(out, 'index.html'), page.encode('utf-8'))
    names = [n for n in git('ls-tree', '-r', '--full-tree', '--name-only', sha, KIT).splitlines() if n != KIT + 'index.html']
    if KIT + 'lab.css' not in names:
        sys.exit(f'build: {ref} has no {KIT}lab.css')
    for n in names:   # lab.css, lab.js and the fonts with their licences; the kit's demo page stays behind
        write(os.path.join(out, 'lab-kit', 'v1', n[len(KIT):]), git('show', f'{sha}:{n}', binary=True))
    write(os.path.join(out, 'phi.svg'), git('show', f'{sha}:{PHI}', binary=True))
    shutil.copytree(os.path.join(HERE, 'public'), out, dirs_exist_ok=True)

    version = re.search(r'lab kit (\d+\.\d+\.\d+)', git('show', f'{sha}:{KIT}lab.css'))
    files = [os.path.join(d, f) for d, _, fs in os.walk(out) for f in fs]
    print(f'{out}: lab kit {version.group(1) if version else "?"} from {ref} {sha[:7]}, '
          f'{len(files)} files, {sum(map(os.path.getsize, files)) // 1024} KB')


if __name__ == '__main__':
    main()
