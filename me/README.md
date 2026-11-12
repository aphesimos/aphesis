# me.aphes.ist

A recruiter-friendly personal page in the aphes.ist style: one narrow column on the fog, the φ drawing itself in, the
name pulled into focus letter by letter, a typed line, and the work as stipple pictures. Lowercase house style; proper
nouns keep their capitals. The words are the approved ones from the earlier static page.

## What is here

| path | what |
| --- | --- |
| `content/me.json` | every word on the page, as data: name, meta line, lede, bio, works (name, href, tag, line, map), awards, education, tools, languages, looking, this page, contact |
| `src/template.html`, `src/me.css`, `src/me.js` | the page's shell, its css and its script (plain JavaScript on the design system's `window.Aphesis`) |
| `previews/` | one density map per work (`<id>.png`, 560x350 grayscale, white = dense) of its linked page, made by `tools/capture_previews.mjs` |
| `tools/capture_previews.mjs` | dev tool: opens each work's link with Playwright at 1280x800, waits for load + 2 s (8 s for aphes.ist), and writes the map (inverted for a light ground, auto levels 1st to 99.5th percentile, gentle contrast curve, mild unsharp). A site that fails falls back to its GitHub repo page. Run: `node me/tools/capture_previews.mjs [id ...]` |
| `public/` | `_headers` (security headers and the CSP) and `robots.txt`, copied as they are |
| `build.py` | renders the page and writes `dist/` |

## Build

```bash
python3 me/build.py                         # dist/index.html, dist/phi.svg, dist/_headers, dist/robots.txt
python3 me/build.py --out DIR               # somewhere else
python3 me/build.py --fragment FILE         # also write the page without doctype/html/head/body, for a preview host
python3 me/build.py --content-api URL       # refresh the text from the content service (or APHESIS_CONTENT_API)
python3 me/build.py --require-filled        # fail on any [[placeholder]] left in content/me.json (the deploy does this)
python3 me/build.py --ref design-system     # the design system from another ref
```

`index.html` is fully self-contained: the tokens (generated from the design system's `tokens.json`), `bundle.css`,
`bundle.js`, Aphesis Script and Special Elite, the link previews and the φ's frames are inlined, the favicon is a data
URI, and the text is rendered into the template at build time. The page is therefore complete, readable and
indexable without JavaScript. With no content API the page makes no network request at all (the fragment, too, has no
external request). The design system is read with `git show` from `origin/design-system` (else `design-system`);
nothing of it is copied into this branch. The φ's frames come from `tools/readme/engine_frames.json`.

The build patches one line of `bundle.js`: `var REDUCED = false;` becomes a check of `prefers-reduced-motion`, and the
build fails if the line is not found exactly once. The system's rule is that the site always animates; this page is the
lab-kit-style exception, so the runtime (fog, simulacrum, Typist, seal boil, tooltip) follows the reader's setting here
only.

The build needs Pillow and numpy: each preview map becomes a 1-bit mask of 2px square cells (thresholded against a fixed
blue-noise-like field, a ceiling near .9, some lost points) for the static stipple, and a posterized 420px map for the
live one.

## Header

The lab kit's receding header (system/lab-kit/v1/lab.css 1.1.0: `.lab-header--sticky`, `--blur`, `--lab-band` 50px,
`--lab-veil-blur` 4px), ported as it is: a sticky header in the page column with the φ on the left and the nav
(work, awards, contact) on the right; on a phone the nav runs on one scrolling line beneath. The script measures its
height into `--lab-header-h`. The blur is dropped while the fog is on, as in the kit, and the veil steps aside while the
eye's wave runs.

## Work

Each work shows its project icon (`Aphesis.icon`, stirred by hovering the row and gathered while it is live; aphes.ist
is the φ, heild its HE drawn as stipple from heild's design system `favicon-he.svg`), its text, and its link's preview
beside it (below it on phones): a static stipple mask in `--ink`, themable and free of JavaScript. One
`Aphesis.Simulacrum` (legible, over the fog) moves into the row under the pointer or focus and coalesces that page's map
while the static one fades; on touch screens the row whose preview crosses the middle of the screen goes live. With
reduced motion there is the static stipple only, and no canvas.

## Motion

- **Entrance** (once per load, about five seconds, content already in the DOM): the fog fades in; everything but the
  hero is held soft (opacity .35, blur 10px); the φ draws itself at the hero position from the engine's frames at 1.6x,
  then boils; "nomen" and the name arrive letter by letter (focus pull); the meta line is typed by `Aphesis.Typist`;
  the lede and bio stream in word by word. When the intro ends the page un-blurs and the φ travels (minimum jerk, 1.6s)
  to the top-left seal, which takes over. The "skip · show all" button, or any wheel, touch, key, scroll or pointer
  event, ends it at once. If the page opens scrolled or with a hash, there is no intro.
- **Reveals**: each section glides in once as it enters the viewport (blur 10 to 0, rise 14 to 0, items 70ms apart);
  its icon gathers (`aph-gather`). Hidden states exist only under `html.mo`, and a 6s timeout in the head lifts them if
  the script never starts.
- **Fog**: one `Aphesis.Fog`, started after first paint, density .62, light .4, clear 1; the text blocks in view are its
  zones (at most 12, refreshed on scroll). Reaching the contact section lets some fog back in (clear .6).
- **Work**: see above; the canvas is made when the section is within a viewport of the screen and stopped when no row is live.
- **Theme**: the eye (bottom-left) uses `Aphesis.themeShift`; the choice is kept in `localStorage` (`aphesis.me.theme`)
  and applied before first paint.
- Everything is paused while `document.hidden`; only transform, opacity and filter animate.

### Reduced motion

With `prefers-reduced-motion: reduce` there is no intro (the φ is in the corner), no blur or rise reveals, no typing,
the fog is static, the picture appears without coalescing, the eye switches the theme at once, links draw their
underline at once and there is no smooth scrolling.

## Content refresh

When built with a content API, the page fetches, in parallel with a 2.5s timeout each, `GET {api}/v1/texts` (keys
`me.name`, `me.meta`, `me.lede`, `me.bio`, `me.looking`, `me.page`, `me.contact`, `me.education`, `me.tools.code`,
`.ai`, `.web`, `.infra`, `.design`, `me.languages`, `me.email`, `me.github` override the matching text; `me.education`
is a list of `{title, note}` or lines of `title | note`), `GET {api}/v1/works` (a work's `line` replaces ours, `map.url`
its picture) and `GET {api}/v1/awards` (`{awards: [{title, note, line}]}` replaces the list). Text not yet reached by
the intro is replaced before it plays; text already shown is swapped silently. Failures are silent.
The CSP in `public/_headers` allows `https://content-api.aphes.ist` for `connect-src` and `img-src`, and `data:` fonts
because the faces are embedded.

## Accessibility

Landmarks (`header`, `nav`, `main`, sections labelled by their headings, `footer`), one `h1`, the system's focus
outline, a real `button` for skip, role tokens only for colour. The typed line and the split name are `aria-hidden`
with a visually hidden copy.
