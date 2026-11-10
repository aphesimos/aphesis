"""Density maps of Michelangelo's Creation of Adam: only the warm skin and drapery are kept, so the plaster stays empty.

Source: "Michelangelo - Creation of Adam (cropped).jpg", Wikimedia Commons, 3524 x 1599: the whole fresco panel of the
Sistine Chapel ceiling (c. 1512), photographed after the restoration. Public domain (the work is far older than any
copyright term; Commons marks faithful photographs of it public domain as well).
https://commons.wikimedia.org/wiki/File:Michelangelo_-_Creation_of_Adam_(cropped).jpg

  python3 tools/simulacra/creation.py SOURCE.jpg system/assets/Simulacra

writes
  creation_panel.jpg  the whole panel, 640 x 290. The fingers' gap: x 242.4, y 132 (Adam's fingertip 241.4, 132.9; God's 243.4, 131.1).
  creation_hands.jpg  the hands, columns 905-1765 and rows 540-900 of the scan, 640 x 268. The gap: x 319.6, y 139
                      (Adam's fingertip 315.5, 142.9; God's 323.7, 135.5).

density = clamp(clamp((saturation - .16) / .24) * luminance * 1.6 * warm) ^ 1.1, where warm is 1 for hues within 45 degrees
of 15 (skin, the red mantle, the lilac robe) and falls to .15 over the next 30 (the green hill and the blue sky stay
faint). The last 3% at each edge fades out, so the painted architecture at the corners is lost.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def density(img, s0=.16, s1=.24, k=1.6, g=1.1):
    a = np.asarray(img).astype(np.float32) / 255
    mx, mn = a.max(2), a.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    lum = a @ np.array([.299, .587, .114], np.float32)
    r, gg, b = a[..., 0], a[..., 1], a[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((gg - b) / d) % 6, np.where(mx == gg, (b - r) / d + 2, (r - gg) / d + 4)) * 60
    off = np.minimum(np.abs(h - 15), 360 - np.abs(h - 15))
    warm = np.clip(1 - np.maximum(0, off - 45) / 30, .15, 1)
    v = np.clip(np.clip((sat - s0) / s1, 0, 1) * lum * k * warm, 0, 1) ** g
    hh, ww = v.shape
    m = max(4, round(.03 * max(hh, ww)))
    fy = np.clip(np.minimum(np.arange(hh), hh - 1 - np.arange(hh)) / m, 0, 1)[:, None]
    fx = np.clip(np.minimum(np.arange(ww), ww - 1 - np.arange(ww)) / m, 0, 1)[None, :]
    return v * np.minimum(fy, fx)


def save(v, path):
    Image.fromarray((v * 255).round().astype(np.uint8)).save(path, quality=90)


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert('RGB')
    W, H = im.size
    panel = im.resize((640, round(640 * H / W)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(.4))
    save(density(panel), out + '/creation_panel.jpg')
    hands = im.crop((905, 540, 1765, 900)).resize((640, 268), Image.LANCZOS)
    save(density(hands), out + '/creation_hands.jpg')
