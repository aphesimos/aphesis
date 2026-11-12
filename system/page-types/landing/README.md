# 2 · landing page

An open-source project's own page: what it is, what it does, what it looks like, how to get it, what it does with
your data, under what licence. One page, one scroll, plain static files. The model is
[anamnesis.aphes.ist](https://anamnesis.aphes.ist/); [`template/`](template/) is a starter built the same way.

It runs the aphes.ist runtime (the fog, the φ, the eye, the cursor, the icons), kept quiet, and the lab kit's faces.
It is a page to be read by someone deciding whether to use the thing: the site's look, with the reader's comfort
first.

## Sections, in order

| # | part | id · gloss | required | what goes in it |
| --- | --- | --- | --- | --- |
| 0 | header | `header.top` | yes | the φ (to aphes.ist), the project's icon and name (to `#top`), 3 to 5 links to the page's parts plus `github`, the eye |
| 1 | hero | `#top` | yes | the **living stipple element**; the title; the lede (**what it is**, one or two sentences); the question, if the project asks one; two actions; one line of meta |
| 2 | what it is | `#what` · *quid* | only if the lede cannot hold it | two or three short paragraphs: what it is, who it is for, what it is not |
| 3 | what it does | `#does` · *opus* | yes | three to six features, each an `h3.aph-label` and one paragraph, two columns |
| 4 | demo or screenshots | `#pictures` · *imagines* | yes | the real thing: one main picture and two beside it, captioned; or a live demo; say what data it shows |
| 5 | install and quick start | `#install` · *limen* | yes | per system (the reader's own first, marked "this computer"), the warnings they will meet, then "or build it from source" with a copyable block |
| 6 | privacy | `#privacy` · *secretum* | yes | four or five plain statements of what stays on the machine and what leaves, then a link to the full account |
| 7 | licence and status | `#status` · *νῦν* | yes | the version and how finished it is, where to report problems, the licence in one sentence; beside privacy on a wide screen (`.pair`) |
| 8 | links | `footer.foot` | yes | two lines of links, each led by a gloss (*libri*: the docs; *opus*: github, releases, contributing, issues, the licence), the signature "made by aphesist · part of aφesis", one line of notice for the design system's assets |

A part may be renamed in the project's words ("yours, on your machine" for privacy, "the app" for the pictures), but
keeps its id, its place and its gloss. Add a part only between 4 and 5 (an evaluation, models, an architecture
picture), at most two, each with a gloss. If the project has a paper page, link it from "what it does" or from an
added "the evaluation" part, never from the hero.

## The hero: one living stipple element

The hero is the project's subject drawn in stipple and alive: anamnesis's demo brain, 1,100 dated entries turning in
WebGL. It is the only large moving thing on the page.

- **Its subject, its data.** Draw what the project is made of, from real data where there is some (a brain from a
  demo snapshot, a cascade from a real log). Without such data, a `Aphesis.Simulacrum` of the project's own icon
  (`Simulacrum.fromBrush`, as the template does) holds the place until the project draws its own.
- **Cells, not pictures.** Square cells on the fog's grid, `fog` colour, at most a few in `accent` for the one thing
  that matters (a region being born). Transparent ground: it lies over the fog, never in a box.
- **Placement.** Desktop: from behind the title out to the right edge of the screen (`left: 26%`), the full height
  of the hero (100svh); the words lie over it with their halo. Phone (≤ 720px): the title, then the element the whole
  width (aspect about 1 : .92), then the words.
- **Loading.** A still image of it (`hero/fallback.webp` and `fallback-light.webp`, under 250 KB each, with
  `width`, `height` and `fetchpriority="high"`) is in the markup and paints first. The live element is imported
  after the first paint, when the browser is idle; the still stays until the element's first frame is on screen, and
  for good where WebGL2 is missing or the import fails.
- **Labels** (region names, a count) in `meta`, `ink-soft`, faded in and out; none on a phone.

## Header

- **Fixed and slim**: one line of marks and words, `padding: space-3`, the page's column (1280px) with gutters and
  safe-area insets. The φ is the runtime's seal (`Aphesis.seal`, 32px tall, `seal` red), boiling, linking to
  `https://aphes.ist/` with `data-tip="aφesis"`. Then the project's icon (`Aphesis.icon(name)`, 24px, `accent`)
  and its name in `label`; hovering stirs the icon (`.aph-icon`), pressing gathers it (`.aph-gather`).
- **Nav** in `label`, `ink-soft`, turning `accent-text`, letters lifting (`Aphesis.letters`). On a phone only the
  short ones stay (`.wide` hides the rest); under 400px the name hides and the icon names the project.
- **The eye** at the right, 26px in a 44px target: the theme switch, drawn as the site draws it, with the theme
  wave (`Aphesis.themeShift`) from the eye; `aria-pressed`, and a tip that says what pressing does.
- **Receding.** At rest the header lies on the ground with nothing behind it. Once the page has moved
  (`html.scrolled`, `scrollY > 8`), a veil of the ground at 80% with a 6px blur eases in behind it and fades out at
  its lower edge; a matching band (`.veil-bottom`) lies at the foot of the screen. Both step aside during the eye's
  wave (`.aph-shifting`), since they are the ground's colour. Never a bar, a border or a shadow.
- A page that does not run the runtime uses the lab kit's `.lab-header--sticky.lab-header--blur` instead (see the
  paper type): the same idea, without the wave.

## Components and classes

| what | markup | from |
| --- | --- | --- |
| ground | `canvas#fog` (fixed, `z-fog`, `aria-hidden`), `Aphesis.Fog` | runtime |
| column | `.lab-page` (max 1280px); `.sec` 760px; `.sec-wide` and `.pair` 1040px | kit + page |
| title | `h1.title.aph-ink`: Aphesis Script, slant −12, weight 400, `clamp(56px, 8.5vw, 104px)` | page |
| section head | `.head > p.aph-gloss.gloss-title[lang] + h2.heading.aph-ink (+ p.note)` | runtime + page |
| lede, question | `p.lede`; `p.question`, with a column of red cells on its left | page |
| actions | `p.acts > a.act(.act-main) > span.act-w`; a brushed stroke under each, drawn by `Aphesis.brush` | page |
| features | `ul.does > li > h3.aph-label + p` (two columns, one on a phone) | page |
| pictures | `figure.shot > a > img` + `figcaption.aph-meta`; edges dissolve through `assets/stipple-edge.png` as a mask | page |
| systems | `ul.os > li[data-os]` with `span.yours` ("this computer"), moved first by the script | page |
| code | `.code > pre[tabindex=0] + button.act.copy[data-copy]` + `span.sr[role=status]` | page |
| plain list | `ul.plain > li`: a grain of three red cells for a bullet | page |
| footer | `footer.foot > nav.foot-links > p > span.foot-h.aph-gloss + a…`, `p.made`, `p.notices` | page |
| text on the fog | `.aph-ink` on every block of text (the theme wave blends it); the halo on every element inside `.hero-text`, `.sec`, `.foot` | runtime + page |

Every value is a token; a value that is not says why in a comment.

## Motion budget

What may move, and nothing else:

- **the fog**, density .19 and light .1 on a desktop, .15 and .08 on a phone; calm zones on the header, the hero
  element and every block of text on screen (twelve at most); `clear: 1` once the hero has scrolled past 45%.
- **the hero element**: one, with at most one WebGL context besides the fog's; it stops while the tab is hidden.
- **the φ's boil**; the project's icon stirring on hover; letters lifting on hover; the brushed strokes under the
  actions brightening; the theme wave from the eye; the cursor (fine pointers).

Never: entrance animations on scroll, parallax, auto-playing carousels, video, counters that count up, a typing
effect on the lede, anything that loops in the reader's line of sight other than the hero.

**Reduced motion** (`prefers-reduced-motion: reduce`) gets the same page held still: the fog draws one frame and
redraws only when something changes (a theme, a resize, a calm zone), the hero shows one still frame, the φ does
not boil, the theme changes at once without the wave, and every CSS transition is 1ms. This is the difference from
the site, which always animates.

## Typography

- Title: Aphesis Script, weight 400, slant −12, `clamp(56px, 8.5vw, 104px)`; 52 to 76px on a phone.
- Section headings: Aphesis Script, weight 500, slant −12, `heading` (42px; 36px on a phone), with 0.2em of padding
  for the lean. The gloss above, `gloss-title`, in Latin or Greek with its `lang`.
- Lede and question: `lede` (19px, 17px on a phone), at most 34em.
- Body: `body` 16px at 1.75, at most 62ch; asides 14px in `ink-soft` (`.small`).
- Labels: `label` 13px, 0.22em tracking: nav, actions, feature names, the footer's links. Meta: 11px for captions,
  the hero's meta line, the notice.

## Accessibility

- A skip link to `main`; one `h1`; every section `aria-labelledby` its heading; the nav labelled "on this page".
- Text never only on a canvas: the hero's canvas is `aria-hidden`, its still image carries the `alt`.
- Every picture says what it shows in `alt`; captions say it in words too.
- The eye: a button with `aria-label` and `aria-pressed`; the copy button reports to an `aria-live` status.
- Focus: the system's 1px `accent` outline, offset 4px, keyboard only. Targets at least 44px where they stand alone.
- Contrast from the tokens only: `ink` and `ink-soft` on `bg`, `accent-text` for red words. Text on the fog always
  carries the halo.
- `lang` on every gloss (`la`, `grc`); `data-tip`, never `title`.
- The page reads in order without CSS and works without JavaScript: words, still pictures and links.

## Performance

- Plain static files, no build step, no framework: `index.html`, `style.css`, `main.js`, `hero/`, `assets/`,
  `vendor/`. Served from GitHub Pages (a `site` branch with its workflow) or any static host.
- Everything pinned beside the page (`tools/page-types/vendor.py`): no request to aphes.ist or any other origin at
  run time.
- The two faces preloaded (`AphesisScript-VF.woff2`, `SpecialElite-latin.woff2`). Scripts `defer`.
- Before the hero loads: under 1 MB transferred, the fonts and the hero's still image included. The live hero and
  its data come after the first paint.
- Screenshots as WebP, 1440 × 900, under 100 KB each, `loading="lazy"`, `decoding="async"`, with `width` and `height`
  so nothing shifts.
- One fog, one hero; both stop while the tab is hidden.
- Open Graph and Twitter cards (1200 × 630 `og.png`), a canonical link, `color-scheme`, the project's own favicon
  from its icon (SVG, ICO, apple-touch, manifest).

## Do

- Let the hero be the project's own subject, from its own data.
- Keep the column narrow and the words on the ground, with space between parts (`space-7`).
- Say what the reader will meet: unsigned installers, the first-launch download, what "measuring" means.
- Mark the reader's own system first, and keep the others visible.
- Put the honest status near the end (pre-release, what is rough) and invite issues in the first person.

## Don't

- A tagline, a slogan, a superlative, an exclamation mark, a rhetorical question as the lede.
- Boxes, cards, filled buttons, badges, shadows, rounded corners, gradients.
- A second large moving element; scroll-triggered animation; autoplaying video.
- The site's own marks: the wordmark at size, the ear and sound, the passage, the inscription.
- Logos of other companies, or "as seen on" rows; stars or download counts as decoration.
- Load fonts, scripts or tokens from aphes.ist or a CDN at run time.

## Template

[`template/`](template/): `index.html`, `style.css`, `main.js`, with every required part in place and marked
`<!-- fill: ... -->`. To start a project's page:

```sh
cp -r system/page-types/landing/template ../PROJECT-site
python3 tools/page-types/vendor.py ../PROJECT-site --project PROJECT     # vendor/aphesis + vendor/lab-kit-v1
# in index.html and main.js: set PROJECT, the words, the links; replace the hero when the project has its own
python3 -m http.server -d ../PROJECT-site                               # http://127.0.0.1:8000/
```

`template/assets/stipple-edge.png` is the mask that dissolves a screenshot's edges into the ground (from anamnesis).

## Examples

- [anamnesis.aphes.ist](https://anamnesis.aphes.ist/) ([source](https://github.com/aphesist/anamnesis/tree/site)): the
  reference.
