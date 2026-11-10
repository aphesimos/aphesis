The brush: how every line on the site is drawn.

- **Provide** a dense centerline (`Aphesis.arc`, `Aphesis.line`, or your own points), a width, and a fixed seed. `Aphesis.brush(points, width, seed, taper = .22, wobble = .08)` returns SVG path data; fill it with `currentColor`.
- **Use** for icons, ornaments, dividers, underlines, drawn symbols, and density maps for simulacra.
- **Do** give every stroke its own seed. **Don't** use SVG `stroke` or CSS borders for anything a person should notice: those are solid.
