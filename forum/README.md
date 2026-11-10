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
- **Pictures**: still simulacra in the column (SVGs of 2px square cells, rendered once). Opening one fades the thread
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

## Density maps in the browser

`density.js` follows *Simulacra: pictures made of fog* in `system/README.md`: flat borders and frames are trimmed
(at most 12% a side), the picture is cut to no more than 3:2 either way and scaled to 560px on the long side (never
past the source), turned to luminance, levels set with the black point at the 30th percentile and the white at the
97.5th, gamma 0.8. A picture on a light ground (an engraving, a photo on white) is blurred 1px and inverted first,
so its figure becomes light on dark. The result is a grayscale JPEG; the original goes up untouched beside it.

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
