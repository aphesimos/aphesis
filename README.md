# aphesis

The monorepo for **aphes.is**, an experimental, hermetic personal site: a hand-drawn φ, stippled fog,
typewriter text and an authorial brush script. One document, continuous navigation, no reloads.

`main` is the hub: it holds only this overview, the agent rules and the map of branches. The work itself
lives on one branch per part, listed in [`docs/branches.md`](docs/branches.md). The plan and its order are in
[`docs/plan.md`](docs/plan.md).

## Stack

- **Site:** Astro, deployed on Cloudflare Pages.
- **Dynamic parts:** Cloudflare Workers and Durable Objects for the wall and the forum, with Turnstile against spam.
- **Type:** Aphesis Script (authorial variable font, built with fontTools) and Special Elite (text face, OFL).
- **Graphics:** WebGL for the fog and the stipple images; the φ brush engine draws the seal and the icons.
