"""Colour tokens from the design system's tokens.json, as sRGB, for files that cannot read CSS (icons, the manifest)."""
import json, math, os, re, subprocess

WT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def tokens():
    return json.loads(subprocess.run(['git', '-C', WT, 'show', 'design-system:system/tokens.json'], capture_output=True, check=True).stdout)


def oklch_to_rgb(s):
    """'oklch(L C h)' -> (r, g, b), 0..255, clipped to sRGB"""
    L, C, h = (float(v) for v in re.match(r'oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)', s).groups())
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_, m_, s_ = L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s3 = l_ ** 3, m_ ** 3, s_ ** 3
    lin = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s3,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s3,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s3)
    gam = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return tuple(max(0, min(255, round(gam(max(0.0, x)) * 255))) for x in lin)


def color(name, theme='light', tok=None):
    """a colour token in a theme, following references like {n-975}, as '#rrggbb'"""
    tok = tok or tokens()
    table = {t['name']: t['value'] for t in tok['color']['tokens']}
    v = table[name][theme]
    while v.startswith('{'):
        v = table[v[1:-1]][theme]
    return '#%02x%02x%02x' % oklch_to_rgb(v)
