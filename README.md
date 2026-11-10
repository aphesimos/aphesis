<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/site-dark.svg">
  <img alt="The aphes.ist home: the φ in the fog, the sections around it as an inscription, a passage typed in the corner" src="assets/readme/site-light.svg" width="100%">
</picture>

</div>

# site

The aphes.ist app. For now it holds the working prototype of the shell; the Astro + Cloudflare project
replaces it once the design system is settled.

- `prototype/home_template.html`: the shell: stippled fog (WebGL), the φ seal that travels to the corner,
  the inscription of sections around it, the typed passage, custom cursor and tooltip, eye theme toggle, hash routing.
- `prototype/build.py`: fills the template (sections, passages, brush engine) into `prototype/home.html`.
  It reads the engine from a checkout of the `mark` branch at `../../mark/` and the font from a checkout of the `font` branch at `../../font/` (e.g. git worktrees).
- `prototype/home.html`: the last built page.

The home: the φ is drawn live at the center of a stippled fog; the sections sit around it as an inscription, each name
typewritten with its Latin or Greek gloss in Aphesis Script; a passage is typed and erased in the bottom-right corner;
the eye in the bottom-left switches the theme. Entering a section, the φ closes into Φ and travels to the corner.
Published at https://claude.ai/artifact/9wnAdRfQjato82z7SN8qWf (private until shared).

Sections are built on `section/<name>` branches cut from this one.
