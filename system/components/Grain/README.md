Masked text: the mark of a hidden character, a round grain of stipple. The standard for every secret field of the site and the desk.

- **Use** `Aphesis.grains(el, n)` to show `n` hidden characters in `el` (give it the class `aph-grains`), or `Aphesis.grain(i)` for the path data of the i-th grain on a 10 × 10 viewBox. The i-th grain is always the same drawing (seed 900 + 7i), so a character lands as the same grain at its place every time.
- **Size** 14 px with a 4 px gap (`--grain-size`, `--grain-gap`); a line that must hold more shrinks both, keeping the grains round. **Colour** `ink`, through `currentColor`.
- **Caret**: the typewriter's underscore in `accent`, after the last grain, blinking when idle.
- **Accessibility**: the grains are `aria-hidden`. The real `<input type="password">` stays in the page under them, transparent, so screen readers, autofill and password managers work as with any field.
- **Don't** use squares, bullets or asterisks for hidden characters, and don't show the characters themselves.
