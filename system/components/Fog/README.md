The stippled ground under every screen.

- **Provide** a canvas filling the screen (fixed, `z-fog`). `Aphesis.Fog(canvas, {density, light})` returns `{zones(list), set({density, light}), stop(), start(), destroy()}`. `destroy()` ends it for good: it stops the loop, removes its pointer and theme listeners and gives its WebGL context back to the browser; call it when the screen that made the fog goes away without the page reloading.
- Colors come from `--bg` and `--fog` and follow the theme on their own. When the system setting flips, the new colours spread through the fog in soft stippled patches over `duration-theme`, never through a flat grey; under `Aphesis.themeShift` (the eye) each cell switches as the wave from the eye reaches it.
- Cells are 2 CSS pixels rounded to whole device pixels (`Aphesis.cellPx(2)`). For crisp cells at any pixel ratio, size and move a stipple canvas in multiples of it.
- It survives losing its WebGL context: drawing stops and resumes when the browser restores it.
- **Use** density 1 and light 1 at home, .62 and .4 inside a section. Pass every text block to `zones()` (elements or `{el, pad}`), up to 12.
- **Don't** put a second fog on a page, or place content in boxes over it.
