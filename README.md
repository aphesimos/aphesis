# site

The aphes.is app. For now it holds the working prototype of the shell; the Astro + Cloudflare project
replaces it once the design system is settled.

- `prototype/home_template.html`: the shell: stippled fog (WebGL), the φ seal that travels to the corner,
  the inscription of sections around it, the typed passage, custom cursor and tooltip, eye theme toggle, hash routing.
- `prototype/build.py`: fills the template (sections, passages, brush engine) into `prototype/home.html`.
  It reads the engine from a checkout of the `mark` branch at `../../mark/` (e.g. a git worktree).
- `prototype/home.html`: the last built page.

Sections are built on `section/<name>` branches cut from this one.
