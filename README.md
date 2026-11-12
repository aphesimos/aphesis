<div align="center">

<a href="https://aphes.ist/"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/hero-dark.svg">
  <img alt="aφesis: the φ drawn in the fog. what is loosed below is loosed above." src="assets/readme/hero-light.svg" width="100%">
</picture></a>

</div>

**aphes.ist** is an experimental, hermetic personal site. *aphesis* is the greek ἄφεσις, a letting go: release,
remission, the loosing of what was bound. the site is one document that never reloads: a stippled fog, a φ drawn by
hand that travels between the center and the corner, typewriter text, and a brush script for names.

this repository is the hub for all of it. each part lives on its own branch, with its own documentation; `main` only
holds this overview, the agent rules, the map of branches, the plan and the tools for these images.

## the branches

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/branches-dark.svg">
  <img alt="the branches of aphesis around the seal: main, design-system, font, mark, site, section branches" src="assets/readme/branches-light.svg" width="100%">
</picture>

| branch | what lives there | start with |
|---|---|---|
| [`main`](../../tree/main) | this hub: overview, agent rules, plan, section scopes, backlog, readme tools | this file and [`docs/`](docs) |
| [`design-system`](../../tree/design-system) | the rules every screen follows: tokens, brush and stipple, icons, seal, fog, simulacra, typist, tooltip, cursor; the page types and the readme standard | `system/README.md` |
| [`font`](../../tree/font) | Aphesis Script: the authorial variable font drawn with the φ's brush, its source, proofs and specimen | `README.md`, `RATIONALE.md` |
| [`mark`](../../tree/mark) | the φ: the original drawing and the brush engine that redraws it and closes it into Φ | `README.md` |
| [`site`](../../tree/site) | the app: the home and its shell (fog, seal, inscription, passage, routing), later the astro + cloudflare project | `README.md` |
| `section/<name>` | one branch per section while it is built, cut from `site` and merged back | its own README |

the full map is in [`docs/branches.md`](docs/branches.md); what each section is, in [`docs/sections.md`](docs/sections.md).

## the look, in one screen

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/palette-dark.svg">
  <img alt="the neutral scale and rubedo red, drawn as stipple" src="assets/readme/palette-light.svg" width="100%">
</picture>

- **nothing is solid.** every mark is a brush stroke or stipple: square cells that light where a density field passes a threshold.
- **one hand.** the brush is measured from the φ: broad nib at 38°, thick to thin about 2.8, tapered ends. the icons and the font are drawn by it.
- **the fog is the ground.** text sits on calm zones in the fog, never in boxes.
- **red is rare.** rubedo is for the seal, the icons and moments of impact.
- **two faces.** Aphesis Script for the wordmark, titles and glosses, slanted; Special Elite for everything people read.
- **lowercase, english,** with latin and greek glosses as the one deliberate exception.

the full system is on the [`design-system`](../../tree/design-system) branch.

## working here

- english everywhere: code, comments, commits and documents.
- every change goes to the branch that owns the part it changes. `main` only takes what belongs to all of them.
- commits are made by the owner's account alone, with no co-authors and no credit lines; messages say what changed and why. see [`CLAUDE.md`](CLAUDE.md).
- work that waits on something else is in [`docs/backlog.md`](docs/backlog.md).

## licence

the φ mark, the wordmark `aφesis` and the names aphes.ist and aphesis are trademarks of aphesist, not covered by any
licence ([TRADEMARKS.md](../../blob/design-system/TRADEMARKS.md)). Aphesis Script is under the SIL Open Font License 1.1,
reserved font name "Aphesis Script" (on the `font` and `design-system` branches).

the pictures in `assets/readme/` are animated svgs (smil and css), drawn by [`tools/readme/make_readme_svgs.py`](tools/readme)
from the design system's tokens, the φ, the brush icons and the two fonts. they embed subsets of Aphesis Script and Special Elite (apache-2.0, © 2010 Astigmatic). each has a light and a
dark version, and github picks one from the reader's preference.
