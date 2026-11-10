<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/site-dark.svg">
  <img alt="The aphes.ist home: the φ in the fog, the sections around it as an inscription, a passage typed in the corner" src="assets/readme/site-light.svg" width="100%">
</picture>

</div>

# site

aphes.ist as one continuous page. The home and every section live in one document: entering or leaving a section
is a hash change, never a page load. One fog, one seal, one eye, one cursor, one tooltip and one passage stay for
the whole visit; the eye's theme wave keeps running across routes.
Published at https://claude.ai/artifact/XdYZE8XBH9vX6psPWHbc2y (private until shared).

## Build

```
python3 site/build.py                    # site/index.html, a self-contained page
python3 site/build.py --fragment OUT     # the same page without <!doctype>/<html>/<head>/<body>, for an artifact
python3 site/build.py experimental=REF   # build one section from another ref (a commit, origin/section/...)
```

The build copies nothing from other branches; it reads them with git:

- `design-system`: `tokens.json` (made into tokens.css), `components/bundle.css`, `components/bundle.js`, the Aphesis Script font
- `mark`: `engine/model.js` and `engine/core.js`, the live drawing of the φ
- `section/<name>`: each section, built by its own `build.py`
- Special Elite is vendored once, in `site/vendor/` (Apache License 2.0).

## The shell

- `site/src/shell.html`: the page: the fog canvas, the seal, the inscription, the host for a section, the passage, the eye.
- `site/src/shell.css`: the shell's marks, all under `aph-*` ids, so no section stylesheet touches them and they touch no section.
- `site/src/shell.js`: the home (seal, inscription, passage, eye), the routes, and the mount and unmount of sections.
- `site/tools/make_icons.py`: the static icons in `site/public/` (apple-touch-icon, icon-512, favicon.ico, site.webmanifest),
  made from the closed Φ as the seal engine draws it. The tab icon is the eye, drawn live by the shell: open while the
  page is seen, closed while it is hidden or the window is left.
- `prototype/`: the home as it was built before the merge, kept for reference.

## How the sections mount

The build runs each section branch's own `build.py --fragment` on a `git archive` of the branch and keeps three
things from it: the markup, the stylesheet (`src/<name>.css`) and the script (the section's modules, already
concatenated). Its fonts, tokens and runtime are dropped, since the page carries them once. In the page a section is

- a `<template data-sec="name">`, cloned into `#aph-host` on mount;
- a `<style data-sec="name">`, live only while the section is mounted;
- a function whose parameters (`window`, `document`, `location`, `history`, `addEventListener`, timers, animation
  frames, observers, `matchMedia`) are the shell's sandbox.

Inside the sandbox the section's runtime calls go to a scoped `Aphesis`: `Fog` hands back the shared fog (its
`zones` and `set({density, light})` drive the one fog), `seal`, `cursor` and `tooltip` are the shell's own,
`Simulacrum` is tracked, and `Sound.scene` and `Sound.event` reach the shared sound only while the section is on
screen. The section's own `#fog`, `#seal` and `#controls` stay in its markup, so its script finds them, but never show.

A section's script runs once, on its first visit; after that the section rests and wakes.

- **Leaving**, its text dissolves piece by piece (each `.aph-ink` block and each mark on its own, as the sections
  enter, so no ancestor is faded or filtered and the theme wave's blend stays intact) and its simulacra dissolve
  into the fog.
- **Resting**, a second later: its pending timers are held with the time they had left, its animation frames and
  intervals are held, its listeners and observers are taken off, its simulacra stop and their WebGL contexts are
  given back to the browser (`WEBGL_lose_context`). Its markup, anything it added to the page, its scroll positions,
  its title and the classes it put on `<html>` are put aside, and its stylesheet is switched off.
- **Waking**, everything is put back, the contexts are restored (the runtime's fields rebuild themselves; a canvas the
  section drew on by itself is redrawn by routing the section to where it was), its pictures coalesce again and its
  pieces condense in. Coming back by the section's own name (`#book`, `#works`) lands where it was left; an address
  that names another sub-route (`#book/faust`) is followed.

So book returns to its leaf, the archive to its post and scroll, works to its work, the descent to its chamber.
Only the mounted section draws or listens, and the page never holds more than the fog and two simulacrum canvases.

## Music

The music section reads its library from R2 (`https://music.aphes.ist/index.json`; `--music-index URL` builds against
another copy). Its player core and the now-playing line (`#aph-np`, top-right) live outside the section, so playback
goes on across every route and through the section resting and waking.
While the index is missing, unreachable or empty, the section shows only its title and gloss in the fog: its request
for the index simply has not answered. The shell asks again, more slowly each time, while the section is on screen,
and the section fills in the moment the index is there, with no rebuild (`WAITS` in `site/src/shell.js`).

## Sound

`Aphesis.Sound` (design system) starts at load with a fade as long as the φ's drawing, or on the first gesture where
the browser waits for one. The ear beside the eye mutes it, and the choice is remembered. Every route change crossfades
to that screen's voice (`Sound.scene`); the descent (`experimental` voice) changes it per chamber and plays `door` when the door opens.

## Routes

| route | screen |
| --- | --- |
| `#home` or none | the home |
| `#book`, `#book/<slug>` | book, one leaf |
| `#descent` | the descent (κατάβασις), built from `section/experimental`; `#experimental` redirects here |
| `#archive`, `#archive/<slug>` | the archive, one post (inside the archive script the post is still `#<slug>`; a bare `#<slug>` is redirected) |
| `#laboratory`, `#laboratory/<slug>` | the laboratory, one experiment |
| `#works`, `#works-<id>` | works, one work |
| `#wall` | the wall |
| `#forum`, `#forum/<id>[/<n>]` | the forum, one thread |
| `#music`, `#music/folders/…`, `#music/artists/…`, `#music/albums/<artist>/<album>` | music, a folder, an artist, an album |

Escape goes up: from a section's own page to its index, from an index to the home, whenever the section itself
did not use the key. The seal always leads home.

## Refreshing a section

Every section is built from its branch at build time, so refreshing one is updating its branch ref and rebuilding.
For the descent (section/experimental):

```
git fetch origin section/experimental:section/experimental
python3 site/build.py && python3 site/build.py --fragment /tmp/aphesis-fragment.html
```

(or `python3 site/build.py experimental=<commit>` without moving the branch). The built page lists the commit of
each section in a comment at the top of the body.

## Adding a section

Add one entry to `SECTIONS` in `site/build.py` (id, name, gloss, line); the shell's routes, sandbox, rest and wake
need nothing more. The section's branch needs a `build.py` that
writes `--fragment OUT` with the same layout as the others: one `<style>` ending with `src/<name>.css`, the markup,
the runtime script and the section script. Its routes are `#<name>` and `#<name>/...`. Route changes also call
`Aphesis.Sound.scene(name)` (or `'home'`) where the runtime has a sound engine.

## Deploy

`aphes.ist` is served by Cloudflare Pages, project `aphesist`, from this branch.
`.github/workflows/deploy.yml` publishes `site/index.html`, together with everything in `site/public/` (`_headers`, `robots.txt`), whenever a push to `site` changes them.
It can also be run by hand from the Actions tab (workflow_dispatch).
The workflow creates the Pages project on its first run.
Rebuild and commit `site/index.html` to put a change online.

One-time setup:

1. **API token.** In Cloudflare, go to My Profile, API Tokens and Create Token. Use the *Edit Cloudflare Workers* template, or a custom token with **Account · Cloudflare Pages · Edit**.
2. **Repository secrets.** In this repository's Settings, open Secrets and variables, then Actions. Add `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (shown on the Cloudflare dashboard's overview, right column).
3. **First deploy.** Run the deploy workflow once from the Actions tab, or push to `site`.
4. **Domain.** The domain is registered at Hostinger and its DNS runs on Cloudflare:
   - In Cloudflare, use Add a domain, enter `aphes.ist` and choose the Free plan.
   - At Hostinger, replace the domain's nameservers with the two that Cloudflare shows. If Hostinger has DNSSEC on, turn it off first; you can turn it back on later through Cloudflare.
   - Once Cloudflare says the domain is active, open Workers & Pages, then `aphesist`, then Custom domains. Add `aphes.ist`, and `www.aphes.ist` if wanted. Cloudflare creates the DNS records and the certificate itself.
