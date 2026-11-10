A picture made only of fog: an image becomes a density field and coalesces out of the stipple.

- **Provide** a canvas and a source: a grayscale density map URL (white = dense), an image or canvas element, or `Aphesis.Simulacrum.fromBrush(draw, w, h)` for a symbol drawn with the brush.
- `Aphesis.Simulacrum(canvas, {source, fit: 'contain' | 'cover', gain, scatter, erosion, ceiling, cell, accent, margin})` returns `{show(src?, done), hide(done), set(src, done), stop()}`. `show` coalesces in 2.6s, `hide` dissolves in 1.8s, `set` dissolves, swaps and coalesces.
- `scatter` (.5) lets lost points drift around the figure, `erosion` (.45) opens fog-shaped holes in it, `ceiling` (.8) caps how full any area gets. A source may carry its own: `{src, scatter, erosion, ceiling, gain}`. Sculpture on a plain ground: `{erosion: .5, scatter: .85, ceiling: .76}`.
- **Use** for the experimental chambers, section openings and any picture. Caption every one with work, artist and date in `meta`.
- **Do** prepare maps as the README's Simulacra rules say (dark grounds, lit masses, crops without frames, ≤ 640px). **Don't** set `accent` above .05.
