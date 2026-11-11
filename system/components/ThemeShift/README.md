The eye's change of theme: the ground changes cell by cell, as a wave from the eye, while the page stays live.

- **Call** `Aphesis.themeShift(apply, {origin, duration, done})` from the eye's click. `apply()` switches the theme at once (set `data-theme`, update the eye's icon). `origin` is the eye's centre in viewport pixels; `duration` defaults to `duration-shift` (5.2s); `done` is called when the wave has covered the screen. It returns `false`, and does nothing, while a wave is still running.
- **What happens:**
  1. The theme is applied at once; nothing is laid over the page, nothing hides and nothing pauses. Links, buttons and routes keep working.
  2. Every stipple field (`Aphesis.Fog`, `Aphesis.Simulacrum`) keeps drifting and switches each cell to the new theme's colours when the wave from the origin reaches it. The front is loosened by a hash and the fog's own noise, so it is grainy and uneven, never a clean circle.
  3. While the wave runs, every element marked `.aph-ink` blends by difference with white ink: each glyph is the negative of the cell beneath it, so it reads over old and new ground alike. Greys and hairlines get one grey that reads on both grounds.
  4. Every element marked `.aph-red` keeps the old theme's reds (`accent`, `accent-text`, `seal`) until the wave reaches where it stands, then turns to the new ones over half a second with minimum jerk, so the reds change in step with the ground. Its moment is the fields' own model of the wave: a cell turns once the eased progress passes .76 times its distance from the origin over the farthest corner, plus the hash and the noise (.12 on average); the turn is centred on it.
  5. When the wave has covered the screen the blend is lifted; nothing visibly changes. Colour transitions are held off for the two frames around each switch (`.aph-still`).
- **Mark** with `.aph-ink` the containers of black-and-white text only: never one that holds the seal, the door or other red accents, or an element with its own ground.
- **Mark** with `.aph-red` every red mark outside those containers: the seal, icons, the eye, the ear, red words. Mark the box, not an element that runs a CSS animation of its own (`.aph-red` runs one while the wave lasts), and turn off any colour transition inside it under `.aph-shifting`, or the colour would trail the turn.
- **Use** for the eye only, everywhere on the site. A change of the system setting is not a shift: there the stipple's colours dissolve in soft patches over `duration-theme`.
- **The browser's bars** (`<meta name="theme-color">`) follow the ground on their own (`Aphesis.themeColor`): at load, on every theme change, and, during a shift, only when the wave has finished.
- It always animates (the site does not follow reduce-motion).
