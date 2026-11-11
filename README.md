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
python3 site/build.py                    # site/index.html, a self-contained page (not committed: the deploy builds it)
python3 site/build.py --fragment OUT     # the same page without <!doctype>/<html>/<head>/<body>, for an artifact
python3 site/build.py experimental=REF   # build one section from another ref (a commit, origin/section/...)
python3 site/build.py --local           # the sections from the local branches (by default: what origin has)
python3 site/build.py --out FILE         # write the page elsewhere (the deploy writes dist/index.html)
python3 site/build.py --content-api URL  # the content service for archive, book, works and the gate (or APHESIS_CONTENT_API)
python3 site/build.py --turnstile-sitekey KEY   # the wall and the forum go live (or TURNSTILE_SITEKEY)
python3 site/build.py --require-gate     # stop if APHESIS_GATE_PHRASE or APHESIS_GATE_ROUTE is missing (the deploy sets it)
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
screen, and `text(key, own)` gives the site's texts (below). The section's own `#fog`, `#seal` and `#controls` stay in
its markup, so its script finds them, but never show.

A section's script runs once, on its first visit; after that the section rests and wakes.

- **Leaving**, its text dissolves piece by piece (each `.aph-ink` block and each mark on its own, as the sections
  enter, so no ancestor is faded or filtered and the theme wave's blend stays intact) and its simulacra dissolve
  into the fog.
- **Resting**, a second later: its pending timers are held with the time they had left, its animation frames and
  intervals are held, its listeners and observers are taken off and its simulacra stop. Its markup, anything it added
  to the page, its scroll positions, its title and the classes it put on `<html>` are put aside, and its stylesheet is
  switched off. Its WebGL contexts stay as they are, drawing nothing, until another section is about to make or wake
  its own, or the page is hidden: only then are they given back to the browser (`WEBGL_lose_context`).
- **Waking**, everything is put back; contexts that were given back are restored (the runtime's fields rebuild
  themselves; a canvas the section drew on by itself is redrawn by routing the section to where it was), while
  contexts it kept need nothing. Its pictures coalesce again and its pieces condense in. Coming back by the section's
  own name (`#book`, `#works`) lands where it was left; an address that names another sub-route (`#book/faust`) is
  followed.

So book returns to its leaf, the archive to its post and scroll, works to its work, the descent to its chamber.
Only the mounted section draws or listens, and the page never holds more than the fog and one section's contexts
(two simulacrum canvases at most). Going home and straight back into the same section costs no context, shader or
picture upload at all; giving the contexts back is done on the way into the next section, not on the way home.

## The clearing

Inside a section the fog drifts out of a central band to the sides (`fog.set({clear})`: 1 for every section, 0.4
for the descent, 0 at the home; `CLEAR` in `site/src/shell.js`), and the fog eases each change itself over 1.8 s.
A section can set its own through its scoped `fog.set`.

The fog never changes in one frame. Calm zones carry a weight that travels to 1 or 0 over 1.2 s with minimum jerk
(the zone grows from its centre with it), keep their place among the fog's twelve until they have shrunk away, and
follow a block's change of size gently; density and light move to their targets in minimum-jerk segments of 1.8 s.

## Music

The music section reads its library from R2 (`https://music.aphes.ist/index.json`; `--music-index URL` builds against
another copy). Its player core and the now-playing line (`#aph-np`, top-right) live outside the section, so playback
goes on across every route and through the section resting and waking.
While the index is missing, unreachable or empty, the section shows only its title and gloss in the fog: its request
for the index simply has not answered. The shell asks again, more slowly each time, while the section is on screen,
and the section fills in the moment the index is there, with no rebuild (`WAITS` in `site/src/shell.js`).
The index is decoded and parsed once: the section reads the document the shell parsed for that check.

## Sound

`Aphesis.Sound` (design system) starts at load with a fade as long as the φ's drawing, or on the first gesture where
the browser waits for one. The ear beside the eye mutes it, and the choice is remembered. Every route change crossfades
to that screen's voice (`Sound.scene`); the descent (`experimental` voice) changes it per chamber and plays `door` when the door opens.

## The inscription and its icons

Each name carries its section's icon (`Aphesis.icon`, drawn with the brush). On a wide screen the icon stands to the
left of the name, about twice its cap height, and moves with it as one unit; it stirs with the letter wave on hover
and focus (`.aph-icon`) and gathers (`.aph-gather`) as the press begins, before the section comes in. On a phone
(600 px wide or less, or a small touch screen on its side) the icons alone stand around the φ, 40 px with 44 px
targets: the first tap gathers an icon and condenses its name and gloss beside it, the second enters, a tap elsewhere
dismisses the name. A key enters at once, and keyboard focus shows the name. The icons are decorative: each link is
named by its words. The names sit on an ellipse, spaced along its length, each pushed out until it clears the φ;
their sizes are measured once (again on resize, when the fonts arrive or the ring turns from names to icons), and
nothing is written when nothing moved.

In the eye's wave the names and glosses (`.tx`, each `.aph-ink`) blend by difference with the fog, cell by cell,
while the icons keep their red. A blend reaches no further than the nearest stacking context, so while the wave runs
the ring is laid out without one between a name and the fog (`.aph-blend` in `shell.css`): the ring gives up its fixed
position and z-index, each link is placed by `left` and `top` instead of a transform, and each icon and name carries
the ring's place in the stack, its fade and its dimming itself. The ring changes layout only between its fades, and
outside the wave it is exactly as described above. The seal, the icons, the eye, the ear and the passage are
`.aph-red`: each keeps the old theme's red until the wave reaches it, then turns over half a second (the design
system's `themeShift`), so the reds change in step with the ground.

## The gate

The owner's gate and desk (`section/gate`) is a hidden section: no name in the inscription, no route. The shell opens
it over wherever the visitor is when an entrance dispatches `aph:entrance`, with one history entry, so Back closes it;
the seal, the gate's own Escape and any new address close it too. The entrances:

- **the ritual**: three taps on the passage, then the φ held for seven seconds;
- **the phrase**, typed anywhere outside a field;
- **the secret route**, `#<route>`, taken out of the address bar;
- **the tenth door** in the descent (a circle drawn around the door).

The phrase and the route come from `APHESIS_GATE_PHRASE` and `APHESIS_GATE_ROUTE` and reach the page only as salted
PBKDF2 hashes (section/gate's own build, `--entrances`). Without them those two entrances do not exist; the ritual and
the door still open the gate. The desk talks to the content service (`--content-api`), whose session cookie needs the
real domain (`aphes.ist`), not `aphesist.pages.dev`.

## The site's texts

The short lines the owner changes from the desk without a rebuild: the ledes, the helper lines, the empty states. The shell asks the content service
for `/v1/texts` once, at load, which answers only the keys the owner changed (`backend/content/src/texts.rs` lists
every key and its default). The page always carries its own strings and keeps them when the service is absent, slow
or says nothing for a key.

- In markup a line names its key: `data-text="music.lede"` (its words), `data-text-tip` (its tooltip),
  `data-text-placeholder`. The shell writes the texts into a section's markup before it enters the page.
- In a section's script: `Aphesis.text('forum.empty', 'no threads yet.')`, through the scoped runtime; a section
  built alone has no `text` and keeps its own string.
- A section's first visit waits for the answer (1.2 s at most, `TEXTS_WAIT` in `site/src/shell.js`), so it enters
  with its words already set and no line is ever seen changing.

## Backends

- **Content** (`https://content-api.aphes.ist`): archive, book and works read their entries from it and fall back
  to what they carry when it does not answer; the shell reads the site's texts from it; the gate signs in through it.
- **Wall and forum** (`https://wall-api.aphes.ist`, `https://forum-api.aphes.ist`): they go live only with a
  Turnstile site key, which the build writes into the page's head with both backends' addresses. Without one they
  stay in preview mode (empty, a visitor's posts kept in their browser), and the build log says so.

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
python3 site/build.py --out /tmp/aphes.ist.html && python3 site/build.py --fragment /tmp/aphesis-fragment.html
```

(or `python3 site/build.py experimental=<commit>` without moving the branch). The built page lists the commit of
each section in a comment at the top of the body.

## How the build treats a section's script

Sections are built from what origin has (`git ls-remote`), so another agent's unpushed work on a local branch never
ships; `--local` builds from the local branches. Each section's own build wires its modules as
`const { a, b } = M["m.js"];`; the site build mends a renamed import (`a as b` becomes `a: b`) and wires namespace and
default imports, then checks every section script with `node --check` as it will run in the page, so a bad
rewrite stops the build instead of shipping.

## Adding a section

Add one entry to `SECTIONS` in `site/build.py` (id, name, gloss, line); the shell's routes, sandbox, rest and wake
need nothing more. The section's branch needs a `build.py` that
writes `--fragment OUT` with the same layout as the others: one `<style>` ending with `src/<name>.css`, the markup,
the runtime script and the section script. Its routes are `#<name>` and `#<name>/...`. Route changes also call
`Aphesis.Sound.scene(name)` (or `'home'`) where the runtime has a sound engine.

## Deploy

`aphes.ist` is served by Cloudflare Pages, project `aphesist`, from this branch. The page is **built in the deploy,
not committed**: `.github/workflows/deploy.yml` checks the branch out with its full history, runs `site/build.py`
(which reads every section, design-system and mark from origin), adds `site/public/` (`_headers`, `robots.txt`, the
icons and the manifest) and publishes `dist/`. It runs on every push to `site` and by hand (workflow_dispatch). The
gate's phrase and route therefore exist only as GitHub secrets and as hashes in the published page, never in the
repository. Refreshing a section is pushing it and re-running the workflow.

Repository settings (Settings, Secrets and variables, Actions):

| name | kind | what |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | secret | Account · Cloudflare Pages · Edit |
| `CLOUDFLARE_ACCOUNT_ID` | secret | the account's id |
| `GATE_PHRASE` | secret, required | the phrase (8 characters at least; a few words) |
| `GATE_ROUTE` | secret, required | the secret route, as typed after `#` (8 characters at least) |
| `GATE_SALT` | secret, optional | 32 hex characters, so rebuilds give the same page; random per build without it |
| `CONTENT_API` | variable | the content service; `https://content-api.aphes.ist` when unset |
| `TURNSTILE_SITEKEY` | variable, optional | the wall and the forum go live with it; preview mode until then |

The build stops, and nothing is published, when `GATE_PHRASE` or `GATE_ROUTE` is missing, rather than shipping a gate
without its entrances.

One-time setup:

1. **API token.** In Cloudflare, go to My Profile, API Tokens and Create Token. Use the *Edit Cloudflare Workers* template, or a custom token with **Account · Cloudflare Pages · Edit**.
2. **Secrets and variables**, as in the table.
3. **First deploy.** Run the deploy workflow once from the Actions tab, or push to `site`. The workflow creates the Pages project on its first run.
4. **Domain.** The domain is registered at Hostinger and its DNS runs on Cloudflare:
   - In Cloudflare, use Add a domain, enter `aphes.ist` and choose the Free plan.
   - At Hostinger, replace the domain's nameservers with the two that Cloudflare shows. If Hostinger has DNSSEC on, turn it off first; you can turn it back on later through Cloudflare.
   - Once Cloudflare says the domain is active, open Workers & Pages, then `aphesist`, then Custom domains. Add `aphes.ist`, and `www.aphes.ist` if wanted. Cloudflare creates the DNS records and the certificate itself.

Locally, the same build with the inputs exported (placeholders, never the real ones):

```sh
APHESIS_GATE_PHRASE='<the phrase>' APHESIS_GATE_ROUTE='<the route>' \
  python3 site/build.py --content-api https://content-api.aphes.ist --out /tmp/aphes.ist.html
```
