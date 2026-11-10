# archive · *codex*

The blog of aphes.ist: writing about anything, from draft (*nigredo*) to finished (*rubedo*).

- **The list.** Titles in the text face, each with its date and its stage: a brushed ring whose stipple rises from a sediment (*nigredo*) to full and red (*rubedo*). The stage icon is `src/stage-icon.js`, documented in `src/stage-icon.md` so it can move into the design system.
- **A post.** Long-form reading at the `body` style, about 60 characters a line, on a calm zone of the fog. Headings in Aphesis Script, slanted. Footnotes show as the site's tooltip on hover, focus or a tap, and are listed again at the end. Pictures exist only as simulacra, inline in the column with a caption. Quotes carry a brushed rule, code a stippled rule above and below.
- **Routes.** `#<slug>` opens a post, `#archive` (or no hash) is the list. The brushed back mark or Escape returns to the list, at the place it was left.
- **Feed.** `feed.xml` (Atom), written by the build from the same posts.

## Writing a post

Add a markdown file to `content/`. Its name is its route: `content/on-salt.md` opens at `#on-salt`, so use ASCII letters, digits and hyphens (not `archive` or `home`).

```markdown
---
title: on salt
date: 2026-12-01
stage: nigredo
summary: one line under the title, and in the feed.
---

the text. everything lowercase but proper nouns (Hermes, Siena) and acronyms you mean as names.

## a heading

a sentence with a note.[^salt] *a latin or greek word* is set in the script face.

> a quotation.
>
> — its source

![work · Artist, year](simulacrum:jerome)

[^salt]: the note's text: one or two sentences.
```

- **Front matter.** `title`, `date` (YYYY-MM-DD), `stage` (`nigredo`, `albedo`, `citrinitas` or `rubedo`) and `summary` are required. `example: true` marks a post written to show the section; it reads "example" beside its date. Move the stage up as the text matures; nothing else needs to change.
- **Markdown.** Paragraphs, `##` and `###` headings, `>` quotes (a last paragraph starting with `—` is set as the source), fenced code, `-` and `1.` lists, `*em*`, `**strong**`, `` `code` ``, `[links](url)` and `[^notes]`. The build uses python-markdown when it is installed and a small converter of the same subset when it is not; notes and pictures are handled by the build in both cases.
- **Pictures.** Only as simulacra: a line of its own, `![caption](simulacrum:<map>)`, where `<map>` is one of the density maps in the design system's `assets/Simulacra` that `build.py` lists in `MAP_FILES`. Caption it with work, artist and date (`saint jerome writing · Caravaggio, 1605–06`). One canvas serves every picture of the section, so any number of figures costs one WebGL context.
- **Notes.** `[^id]` in the text, `[^id]: text` anywhere in the file. They are numbered in the order they appear. Keep them short: they are read in a tooltip.

Then build:

```sh
python3 archive/build.py                  # archive/index.html and archive/feed.xml
python3 archive/build.py --fragment OUT   # also the page without <!doctype>/<html>/<head>/<body>
```

## The content service

When the page is built with the content service's address, it opens on the posts it was built with and, as soon as
the service answers, shows the published posts from it instead (`GET /v1/posts`), drawn into the same markup by
`src/render.js`. If the service is down, slow or empty, the built-in posts stay. Edits from the owner's desk are live
with no rebuild.

```sh
python3 archive/build.py --content-api https://content-api.aphes.ist     # or APHESIS_CONTENT_API in the environment
```

- `src/render.js` is build.py's converter and markup, ported line for line to the browser (it is also what the
  desk's live preview draws with). `node archive/tools/render-parity.mjs` proves it writes the same markup as
  build.py for the list and every post in `content/`, with the notes in the body and with the notes apart.
- A post from the service names its figures' density maps by URL (`data-src`); they come with CORS, so
  `figure.js` loads them as `crossOrigin` images.

## How it is built

`build.py` reads `tokens.json`, `bundle.css`, `bundle.js`, the Aphesis Script font and the density maps from the `design-system` branch with `git show`, generates `tokens.css`, converts the posts and writes one self-contained `index.html`. The list and every post are in the page as markup; the script only draws the marks, moves between views and conjures the pictures. Special Elite is vendored in `vendor/` (Apache License 2.0).

The modules in `src/` are plain ES modules, concatenated by the build in dependency order:

| module | what it does |
| --- | --- |
| `motion.js` | a tween eased with minimum jerk, a wait |
| `stage-icon.js` | the four-state stage icon |
| `marks.js` | the back mark, title underlines, the quote rule, the stippled code rules, the list's foot rule |
| `tip.js` | the tooltip for this section: pointer, keyboard focus and taps; footnotes |
| `figure.js` | one Simulacrum canvas, moved into the figure in view; invisible until its first frame |
| `views.js` | list ↔ post: the outgoing view lifts and blurs while the incoming one rises, overlapping |
| `content.js` | the content service's address (written by the build) and the fetch of its posts |
| `render.js` | the list and a post from data, the same markup as build.py (see above) |
| `main.js` | theme, fog (density .62, light .4) and its calm zone behind the column, seal, cursor, routes, keys; swaps in the service's posts |

In the Astro site the posts become a content collection with the same front matter, and the feed's links (`SECTION_URL` in `build.py`) follow the site's routes.
