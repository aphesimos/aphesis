# Branches

Each part of aphes.ist lives on its own branch. Branch from `main` for a new part; never merge parts into `main`,
which stays a hub.

| branch | what lives there |
| --- | --- |
| `main` | Hub: README, agent rules (`CLAUDE.md`), this map, the plan. |
| `design-system` | Tokens (colors, type, spacing, motion), the brush and stipple rules, icons, cursor, tooltip, typist, stipple images, component references. The source of truth every screen follows. |
| `font` | Aphesis Script: build scripts, masters, the variable font and static instances, proofs. |
| `mark` | The φ: original art, the brush engine (centerline + width profile), the drawing and φ → Φ seal animations. |
| `site` | The Astro + Cloudflare app: the shell (fog, seal, inscription, passage, routing) and, as they are built, each section. |

Sections get their own branches when work on them starts, cut from `site`:
`section/book`, `section/experimental`, `section/archive`, `section/laboratory`, `section/works`, `section/wall`, `section/forum`.
They merge back into `site` when finished.
