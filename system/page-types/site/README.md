# 1 · the site

**aphes.ist**: one hermetic document that never reloads. A stippled fog, a hand-drawn φ that travels between the
centre and the corner, an inscription of sections around it, typewriter passages, a sound. It is a work to be seen,
not a page to be read, and it is the reference implementation of this design system: every rule in
[`system/README.md`](../../README.md) is shown there first.

**It is not changed from here.** The site lives on the `site` branch (the shell) and the `section/<name>` branches;
its build and deploy are described in that branch's README. Nothing in `page-types/` asks the site to change, and no
work under these page types touches the `site` branch, except publishing a new lab kit, and only with the owner's
word. This page only records what the site is, so the other two types can say where they differ from it.

## What it is made of

| part | what | where |
| --- | --- | --- |
| the fog | one `Aphesis.Fog`, full screen, density 1 at home, .62 in a section, cleared from a section's column | `site/src/shell.js` |
| the seal | the φ drawing itself at the centre (the `mark` branch's engine), closing into Φ and travelling to the top-left corner (64px) on entering a section | `mark`, `shell.js` |
| the inscription | the section names around the centre, each with its gloss; on a phone, the section icons | `shell.html` |
| the corners | bottom-left the eye (theme) and the ear (sound), bottom-right the passage, top-left the seal | `shell.html` |
| sections | hash routes mounted into one document, each built by its own branch | `section/<name>` |
| the passage | a line typed by `Aphesis.Typist` in its original language, the translation in the tooltip | `shell.js` |
| sound | one ambient voice per screen in Web Audio, crossfading between routes | `Aphesis.Sound` |

## Rules that hold only for the site

These are the owner's decisions for the work. The landing and paper types do **not** inherit them.

- **It always animates, for everyone.** The site does not follow `prefers-reduced-motion` and has no pause control:
  the motion is part of the work. The runtime's `REDUCED` is `false`. Never add a reduced-motion rule to the site.
- **Sound is on by default**, starting under the φ's drawing or at the first gesture, with no prompt; the ear turns
  it off and the choice is remembered. On iPhone it plays through the silent switch.
- **Hermetic, not explained.** Sections name themselves with a gloss and carry no instructions; experimental
  chambers explain nothing.
- **One document, no reloads.** Every route is a hash change; the fog, seal, eye, cursor, tooltip, passage and sound
  persist across routes.
- **The φ is live and travels.** The seal is drawn by the engine and boils 8 times a second; elsewhere the φ is a
  still drawing or the runtime's boiling seal in a corner.
- **The wordmark** `aφesis` (110px, seal red) appears on the home only.
- **Pictures are simulacra.** No raster image is ever shown as itself.
- **The scroll disturbance, the cursor and the theme wave** are everywhere, and nothing draws a native scrollbar.
- **Its fog is at full density** at home and .62 in a section. Pages of the other types keep it far lower.

## What the other types take from it, and what they must not

| take | never take |
| --- | --- |
| tokens, the two faces, lowercase, glosses | the wordmark `aφesis` at display size (only as a small signature link in a footer) |
| the φ in the top-left corner, linking home | the φ drawing itself, travelling or closing into Φ |
| the eye as the theme switch (landing) | the ear and the sound |
| the fog as a quiet ground (landing) | the fog at the site's density, or behind a column of text |
| the cursor and letter waves (landing, fine pointers) | always-on motion that ignores reduced motion |
| the icons, drawn by the runtime | the inscription, the passage, the hash routes |

## Examples

- [aphes.ist](https://aphes.ist/): the home.
- [aphes.ist/#laboratory](https://aphes.ist/#laboratory), [#book](https://aphes.ist/#book): sections.
- The `site` branch's README: the build, the shell and how sections mount.
