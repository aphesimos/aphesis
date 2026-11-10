The eye's change of theme: the ground changes cell by cell, as a wave from the eye, while the page stays live.

- **Call** `Aphesis.themeShift(apply, {origin, duration, done})` from the eye's click. `apply()` switches the theme at once (set `data-theme`, update the eye's icon). `origin` is the eye's centre in viewport pixels; `duration` defaults to `duration-shift` (5.2s); `done` is called when the wave has covered the screen. It returns `false`, and does nothing, while a wave is still running.
- **What happens:**
  1. The theme is applied at once; nothing is laid over the page, nothing hides and nothing pauses. Links, buttons and routes keep working.
  2. Every stipple field (`Aphesis.Fog`, `Aphesis.Simulacrum`) keeps drifting and switches each cell to the new theme's colours when the wave from the origin reaches it. The front is loosened by a hash and the fog's own noise, so it is grainy and uneven, never a clean circle.
  3. While the wave runs, every element marked `.aph-ink` blends by difference with white ink: each glyph is the negative of the cell beneath it, so it reads over old and new ground alike. Greys and hairlines get one grey that reads on both grounds.
  4. When the wave has covered the screen the blend is lifted; nothing visibly changes. Colour transitions are held off for the two frames around each switch (`.aph-still`).
- **Mark** with `.aph-ink` the containers of black-and-white text only: never one that holds the seal, the door or other red accents, or an element with its own ground.
- **Use** for the eye only, everywhere on the site. A change of the system setting is not a shift: there the stipple's colours dissolve in soft patches over `duration-theme`.
- It always animates (the site does not follow reduce-motion).
