# forum · *ἀγορά*

A basic anonymous imageboard. No names: each voice gets a **sigil**, the same one all through a thread. Every picture
arrives as fog: a **simulacrum** made from a density map the browser prepares before uploading, with the original a
click away.

- `index.html`: the built page, self-contained (tokens, runtime, both faces, example maps, the modules).
- `build.py`: builds it, reading the design system from its branch with `git show` (the same build as
  `experimental/`). `python3 forum/build.py`, or `--fragment OUT` for the page without its document shell.
- `src/`: the section, in small ES modules (below).
- `worker/`: the Cloudflare Worker, its Durable Objects, `wrangler.toml` with placeholders, tests, and
  [its README](worker/README.md) on the API and on deploying.

## The screen

- **Board** (`#forum`): the title with its gloss, one line of lede, `images · on/off`, and the threads, newest
  activity first. The board keeps every thread: the first page (40) arrives at once, older pages as the reader nears
  the end of the list, or presses `older threads` (the same by keyboard, which then goes on from the first new row),
  back to `the board begins here.` Rows stay light for thousands: a still simulacrum is drawn only when its row nears
  the screen, and the fog measures only the blocks near it. `#forum/<id>` opens any thread, however old. A thread shows its opening post's first line, its replies, its age and, when it opens with a
  picture, a still simulacrum 88px wide. `start a thread` unfolds the form.
- **Thread** (`#forum/<id>`, `#forum/<id>/<n>` for a post): the posts in order. Each carries its sigil, its number, its
  age, `reply` (adds `>>n` to the form and moves the keyboard there) and `report`. A reply by the thread's opener says
  so. `>>n` in a post is a link: hover or focus shows the quoted post beside it (sigil, number, its first words),
  following it brings the post to the reader with minimum jerk and its sigil turns rubedo for a moment.
- **Pictures**: still simulacra in the column (SVGs of square cells, rendered once, legibly). Opening one fades the thread
  into the fog and the picture coalesces as a live `Aphesis.Simulacrum` on the one canvas kept for it, caption and
  `original` in the top-right corner, `close` or Escape to return. With `images · off`, or without WebGL, the page
  is words only (a `[picture: caption]` line with the original's link) or the still simulacrum, large.
- **Posting**: a text area whose only line is a brushed baseline (rubedo while it has focus), `add an image`,
  a count, `post` / `reply`, Ctrl or Cmd + Enter. A chosen picture is turned into its density map at once and shown as
  it will appear. Turnstile renders only when a site key is configured.
- **The preview**: with no API configured the page runs on a local mock: four example threads and an archive of 240
  older ones going back more than a year (all marked `example`, pictures from the design system's maps), paged like
  the real board, and whatever is posted, kept in this browser's storage only;
  `preview` under the lede and the send button say so in a tooltip.
- **Shell**: the section's fog (density .62, light .4) whose calm zones follow the text in view, the seal in the
  top-left corner, the eye in the bottom-left (switching through `Aphesis.themeShift` when the runtime has it), the
  passage corner free, the runtime's cursor and tooltip. On narrow screens the column scrolls between the corners and
  dissolves at its edges, so text never passes under the seal or the eye.
- **Motion**: sections and posts enter with a blur and a rise, nothing is typed; scrolling to a post travels with
  minimum jerk. The site always animates (the owner's rule), so there are no reduced-motion branches.

## Modules (`src/`)

| module | what |
| --- | --- |
| `hash.js` | deterministic string hashes (FNV-1a + murmur3 finish) and a bit reader, for drawing only |
| `sigil.js` | the sigil generator (below) |
| `legible.js` | the legible look for forum pictures, on the design system's preset |
| `thumb.js` | still simulacra: a density map rendered once into an SVG of square cells |
| `density.js` | an uploaded picture → a density map, by the design system's rules |
| `text.js` | escaping, `>>n` references, quoted lines, first lines, ages |
| `store.js` | localStorage wrapped in try/catch, with a memory fallback |
| `mock.js` | the local mock, its example threads and their archive, paged like the Worker |
| `api.js` | the client (`board(cursor)` a page at a time): the Worker when `<meta name="forum-api">` (or `window.AphesisForum.api`) is set, else the mock |
| `ground.js` | the fog and its calm zones |
| `composer.js` | the form |
| `viewer.js` | the one live simulacrum |
| `views.js` | the board and a thread as markup |
| `main.js` | the shell, the routes, quotes, reports |

## Legible pictures

Forum pictures carry information, so they are not hermetic simulacra: the owner's rule keeps "never picture-perfect"
for the hermetic ones only. A forum picture reads at a glance (faces, text, composition) and is still stipple: it
coalesces out of the fog, keeps a little erosion and a few lost points, and its cells stay visible as cells.

- **The viewer** opens the picture with the design system's preset, `Aphesis.Simulacrum(canvas, {legible: true})`
  (`Simulacrum.LEGIBLE`: erosion .15, scatter .18, ceiling .93, cells of 1.25px, the map prepared again on upload
  with auto levels, a contrast curve and a mild sharpen), accent .01.
- **The still simulacra** (`thumb.js`) follow the same terms: the same map preparation, the fog's modulation of the
  tones at .94 + .12, a threshold with 12% hash, cells at .84, the preset's cell size. `legible.js` holds them, with
  the hermetic and a too-clean set kept for comparison.
- **The map** (`density.js`) is made in the browser before upload:
  - flat borders trimmed (at most 12% a side); cut to no more than 2:1, so a screenshot keeps its edges;
  - 640px on the long side (the Worker's limit), at least 480, never enlarged past the source;
  - a 5% black margin, so the simulacrum's soft edge falls on the margin, not on the content;
  - a light ground (a screenshot, a page, an engraving, a photo on white) inverted, so text and figures become light
    on dark;
  - hatching (mean high-frequency energy above .05: engravings, halftones) softened by a ~1.5px blur so it becomes
    tone; everything else sharpened (unsharp mask, radius 1px, amount .4);
  - auto levels from the 1st to the 99.5th percentile, with a gamma that puts the median near .42;
  - a grayscale JPEG under 380 KB. The original goes up untouched beside it.
  `prepareMap(file, {mode: 'hermetic'})` gives the system's hermetic preparation, for comparison.

## The sigil

A mark instead of a name, drawn with `Aphesis.brush` and `Aphesis.stipple` on the icon grid, from a poster token.
The Worker makes the token (`SHA-256(salt | thread | IP hash)`, 16 hex characters), so it is the same for one person
all through a thread and different in every other one; the page only draws it.

**How it is drawn.** The token is hashed into 128 bits and read a few bits at a time:

1. **The main stroke** (3 bits), one of eight families, each with variants from further bits: *stem* (leaning a
   little), *ring* (an open circle, 235° to 310°, starting on a 45° step), *crescent* (140° to 185°), *slash*,
   *chevron*, *hook* (a stem that turns over), *wave* (one period), *angle*. Width 1.8, taper .14 to .3.
2. **A second stroke** (3 bits; two of the eight values mean none, so about a quarter of sigils are one stroke):
   *crossbar*, *tick* (a flick from the rim, leaning inward, taper .42), *eyelet* (a small ring on a node),
   *halo* (a 70° arc outside the ring), *bar*, *ticks*. Width 1.15, the fine-mark width.
3. **Grains** (2 bits): none to three small clusters of stipple (size .8), on the rim of the grid or its centre.
4. **Mirror** (1 bit) and **quarter turns** (2 bits) of the whole.
5. **Seeds**: every stroke and grain gets its own brush or stipple seed from the bits, so the unsure edges are the
   same on every visit too.

Everything stays inside 2 to 22 on the 24-unit grid. 8 × 6 (+ none) × 4 × 8 families and placements, before the
variants, give thousands of distinct marks; 400 tokens give more than 390 different sigils in the tests.

**For the design system** (proposed `system/components/Sigil/README.md`):

> A mark instead of a name: a poster token becomes a small brushed drawing on the icon grid.
>
> - **Provide** a token (any string; on the forum, the poster token the server makes per poster per thread).
>   `sigilSVG(token, Aphesis)` returns inline SVG in `currentColor`; `sigilSpec(token)` the strokes and grains as data;
>   `sigilLabel(token)` words for assistive technology ("sigil: ring, crossbar, two grains").
> - **Use** at 28 to 40px, in `ink-soft`, beside the post it signs, with `role="img"` and the label.
> - **Do** keep the token stable: the same token always draws the same sigil. **Don't** color a sigil by poster;
>   `accent` is reserved for a moment of impact (the post a quote leads to), never for a person.

## QA

Playwright with SwiftShader WebGL, served over http, at 1280×800 and 390×844, dark and light: every thread opened
and left, a reply with a `>>` quote written by keyboard, the quote preview on hover and on focus, a picture attached
through the file chooser and opened as a simulacrum, a new thread with an engraving, reload for persistence, images
off, reports, frame captures checked for white or garbled frames, and page errors.
