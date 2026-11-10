# Sections: scope

Every section follows the design system (`design-system` branch). Each is one hash route in the same document: the
seal closes into Φ and moves to the corner, the fog thins (density .62), the section enters with a blur and a rise.
Each title is set in the display face with its gloss above it. Names below are the route, the title and the gloss.

## book · *liber*
**What:** the authors, works and ideas that shaped the author, leafed through like a codex.
**Screen:** one entry at a time, as a spread: a simulacrum of the author or the work on one side, a short typed note on
the other. Arrow keys, swipe or the page edge turn the leaf; the turn is a dissolve of the simulacrum, not a 3D flip.
**Entries:** title, author, year, a note of 60–200 words, an optional quote typed by the Typist, the density map.
**Data:** markdown files with front matter (Astro content collection). No backend.

## experimental · *ἄδυτον*
**What:** chambers discovered through gestures. Symbols, motion, simulacra, no explanation.
**Screen:** a threshold icon and nothing else. Each chamber is entered by a gesture (holding still, drawing a circle,
typing a word, waiting), and is one full-screen piece: a simulacrum that answers the pointer, a brush that draws a
sigil, a passage that types itself into the fog. Awwwards-level craft, one idea per chamber, no navigation chrome
beyond the seal. Chambers found are remembered per visitor (local storage), never listed.
**First chambers:** the ouroboros (a simulacrum that rotates and eats its tail as you circle the pointer), the two hands
(the fingers close in as you approach, never touch), the monad (Dee's symbol drawn stroke by stroke with the brush),
the emerald tablet (its lines typed and erased in Latin, English in the tooltip).
**Data:** static. Each chamber is its own module, loaded only when entered.

## archive · *codex*
**What:** the blog. Writing about anything, from draft (*nigredo*) to finished (*rubedo*).
**Screen:** a list of titles in the text face, each with its date and its stage shown by an icon state (nigredo,
albedo, citrinitas, rubedo: four stages of the stipple filling a ring). A post is long-form reading at the `body` style,
52–65 characters a line, with calm fog behind the column, footnotes as tooltips, images only as simulacra.
**Data:** markdown/MDX in a content collection; stage in front matter. RSS feed.

## laboratory · *officina*
**What:** measured experiments: machines that rewrite themselves, the DGM work, generative studies.
**Screen:** each experiment has a hypothesis, a method, a result and a live piece (canvas or embedded run). Numbers are
set in the text face with tabular figures; charts are drawn with the brush and stipple, never with library defaults.
**Data:** content collection plus per-experiment components.

## works · *opera*
**What:** finished projects.
**Screen:** one work at a time, its name in the display face, a simulacrum of it (screens and photos become density
maps), a short description, links out. The list is an inscription like the home's, not a grid of cards.
**Data:** content collection.

## wall · *paries*
**What:** anonymous messages floating in the fog.
**Screen:** messages drift slowly through the fog as typed lines, fading in and out; hovering one stops it. A visitor
writes one line (≤ 140 characters); it is typed into the fog by the Typist. No names, no replies, no likes.
**Data:** Cloudflare Worker + Durable Object (ordered list, rate limit per IP hash), Turnstile on submit, a word filter
and a manual removal tool. Messages expire after a set time.

## forum · *ἀγορά*
**What:** a basic anonymous imageboard.
**Screen:** threads as typed text in the text face; images shown as simulacra (uploaded images are converted to
density maps server-side or in the browser before upload), with the original a click away. Posts get a tripcode-like
sigil drawn with the brush from a hash, instead of a name.
**Data:** Worker + Durable Objects (one per thread), R2 for images, Turnstile, rate limits, report and removal.
Text-only fallback when images are off.

## Later
Further sections from the research survey, scoped once these exist.
