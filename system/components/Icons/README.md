The icon set: brush strokes with stipple fill, two states each.

- **Provide** a name (`eye`, `sol`, `luna`, `terminator`, `threshold`) and a state (0 or 1). `Aphesis.icon(name, state)` returns inline SVG in `currentColor`; size it with CSS (28 to 64px) and color it `var(--accent)`.
- **Use** the eye for the theme (open = light, closed = dark), the threshold for entering a chamber, sol · luna and the terminator for day and night content.
- Buttons holding an icon need an `aria-label` and a `data-tip`.
- New icons are drawn with `Aphesis.brush` and `Aphesis.stipple` on the same 24-unit grid, then added here.
