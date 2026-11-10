A picture made only of fog: an image becomes a density field and coalesces out of the stipple.

- **Provide** a canvas and a source: a grayscale density map URL (white = dense), an image or canvas element, or `Aphesis.Simulacrum.fromBrush(draw, w, h)` for a symbol drawn with the brush.
- `Aphesis.Simulacrum(canvas, {source, fit: 'contain' | 'cover', gain, cell, accent, margin})` returns `{show(src?, done), hide(done), set(src, done), stop()}`. `show` coalesces in 2.6s, `hide` dissolves in 1.8s, `set` dissolves, swaps and coalesces.
- **Use** for the experimental chambers, section openings and any picture. Caption every one with work, artist and date in `meta`.
- **Do** prepare maps as the README's Simulacra rules say (public domain, inverted engravings, isolated figures, ≤ 640px). **Don't** set `accent` above .05.
