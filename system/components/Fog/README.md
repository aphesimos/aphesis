The stippled ground under every screen.

- **Provide** a canvas filling the screen (fixed, `z-fog`). `Aphesis.Fog(canvas, {density, light})` returns `{zones(list), set({density, light}), stop()}`.
- Colors come from `--bg` and `--fog` and follow the theme on their own.
- **Use** density 1 and light 1 at home, .62 and .4 inside a section. Pass every text block to `zones()` (elements or `{el, pad}`), up to 12.
- **Don't** put a second fog on a page, or place content in boxes over it.
