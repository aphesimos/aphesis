# the README standard

Every repository's README on GitHub reads as one body of work. The model is
[anamnesis's README](https://github.com/aphesist/anamnesis#readme): the animated header, a picture of the thing
itself, plain lowercase prose that says what it is, the parts in a fixed order, an honesty table where there are
claims, and the licence last. The pictures come from the readme kit ([`tools/readme/`](../../../tools/readme)).

There are two kinds, by the page the project has: a **product** README (a landing page's project, like anamnesis)
and a **study** README (a paper page's project: contraprova, heuresis, autopoiesis). They share the header, the
voice, the pictures and the end; they differ in the middle. Templates: [`template-product.md`](template-product.md),
[`template-study.md`](template-study.md). The profile README (`aphesist/aphesist`, branch `φ`) is its own thing: the
ring, built by `readme.py ring`.

## the header

```html
<div align="center">

<a href="https://PROJECT.aphes.ist/"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/readme/header-dark.svg"><img src="assets/readme/header-light.svg" alt="PROJECT: the line." width="100%"></picture></a>

</div>
```

- Made by `readme.py header` (840 × 200): **the project's icon** on the left, stirring; **the title** in Aphesis
  Script; **the gloss** beside it (Greek or Latin, the project's name in its own language: ἀνάμνησις, *probatio
  contraria*, εὕρεσις, αὐτοποίησις); **one line** under it in Special Elite; fog around, clear behind the words.
- **The line** says what the project is, in under 60 characters, lowercase, ending with a full stop: "a local-first
  second brain that measures itself." It is a description, not a tagline: no slogan, no pun, no promise, no
  imperative, no rhetorical question, nothing that would fit another project. If it reads like an advert, cut it
  down to the noun phrase.
- **The link** wraps the header: the project's page (landing or paper) if it has one, otherwise the repository.
- **The alt** is "PROJECT: the line." exactly.
- Nothing else above the first paragraph but, optionally, one hero picture (below). No badges, no title in Markdown
  (`# PROJECT` would repeat the header), no italic one-liner, no table of contents.

```sh
python3 ../aphesis-ds/tools/readme/readme.py header assets/readme \
  --icon PROJECT --title PROJECT --gloss GLOSS --line "what it is, in one plain line." --href https://PROJECT.aphes.ist/
```

## the hero picture

Optional, right under the header inside the same `<div align="center">`: the project's subject drawn as an animated
SVG in the system (anamnesis: the demo brain turning; contraprova: the results), at `width="100%"`, dark and light.
Its alt says what it shows in a full sentence. A project without such a picture starts its prose straight after the
header.

## the order

| # | product README (landing) | study README (paper) |
| --- | --- | --- |
| 1 | header (+ hero picture) | header (+ hero picture) |
| 2 | what it is: one to three paragraphs, no heading | what it is: one to three paragraphs, no heading |
| 3 | the question, as a blockquote, if it asks one | the question, as a blockquote |
| 4 | what it is made of, in one paragraph (app, cli, server; models or none) | status, as a blockquote starting **status:**, in plain words (run or not, what is measured, what is a hypothesis) |
| 5 | screenshots: a two-column `<table>` of real screenshots, and a `<sub>` line saying what data they show | `## what it found`: the results picture, then three to five findings, each with its number and interval; or "no results yet" and what will be measured |
| 6 | `## what it does`: bold-led bullets | `## how it works`: a picture or a diagram, then the method in short paragraphs or numbered steps |
| 7 | `## quick start`: install (per system, a table), then build from source in a code block | `## pre-registration`: what was fixed, where, when; deviations |
| 8 | project-specific parts (`## bring your own model`), at most three | `## honesty table` |
| 9 | `## privacy`: bold-led bullets, a link to the full account | `## quick start`: install and the commands that reproduce the numbers, in a code block |
| 10 | `## the evaluation` and `### the honesty table`, if it measures itself | `## the data`: the replay link, the logs, how to verify; then the project-specific parts (`## plug-ins`, `## use it in your own project`), at most three |
| 11 | `## architecture` (a mermaid flowchart), `## repository layout` (a table) | `## documents` (a list), `## budget` if it spends on paid apis, `## related work` |
| 12 | `## licence` | `## licence` |

A part the project has nothing for is left out, never kept empty, except the honesty table and the licence. A
section may be retitled in the project's words ("yours, on your machine"), but keeps its place.

## the voice

- **Lowercase, all of it:** headings, prose, table headers, bullet leads, alt texts, captions, names of people and
  products (thoreau, claude code, swe-bench pro). Capitals stay only where changing them breaks something: code and
  commands, file and branch names (`README.md`, `CONTRIBUTING.md`), environment variables, quoted interface text
  ("Continue with ChatGPT"), the names of the typefaces (Special Elite, Aphesis Script), and arm or task ids as the
  data writes them (`A`, `D:control`).
- **Say what it is and what it does.** First paragraph: what it takes in, what it gives back, where it runs. No
  "blazing", "powerful", "seamless", "next-generation", "supercharge", "unlock", no emoji, no exclamation marks.
- **Numbers with their basis.** Every number carries its sample, its interval or its status, in the same sentence.
- **Bold** only to lead a bullet or a status word; *italics* for a gloss or a term defined once.
- English, with Greek or Latin only in the gloss and where the project's name is explained.

## badges

None. The header links the project's page, the status is said in words (step 4), and the licence is the last
section. A CI badge, a version shield or a star count is a box of colour the system does not have.

## the honesty table

Required in every study README, and in a product README whose project makes claims it measures (anamnesis's
evaluation). Three columns, in this order:

| claim | status | basis |
| --- | --- | --- |
| a claim the project makes, as a reader would quote it | **measured** | where: the result, its n and interval, a link to `results/` |
| a number computed from measurements | **modelled** | the model and its assumption |
| a property of the code | **tested** | the test file |
| something not yet checked | **hypothesis** | what it would take |

- The four statuses are the lab kit's (`measured`, `modelled`, `tested`, `hypothesis`), in bold, lowercase, with any
  qualifier after them in plain text ("**measured** (pre-registered, n=88)"). A demonstration on demo data says
  "demonstration" and is never reported as a metric.
- One line under it says when a row may move ("rows move from hypothesis to measured only when a result with its
  interval is committed under `results/`").

## pictures: dark and light

- Every picture the project draws is two SVGs, `NAME-dark.svg` and `NAME-light.svg`, in `assets/readme/`, set as:
  ```html
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/NAME-dark.svg">
    <img alt="a full sentence of what it shows, lowercase, with its numbers" src="assets/readme/NAME-light.svg" width="100%">
  </picture>
  ```
  GitHub resolves `<picture>` to the reader's GitHub theme. The ground is transparent, the colours are the tokens,
  the motion is CSS and is still under reduced motion (the readme kit's rules).
- **When a picture changes, its path changes.** GitHub's image proxy caches by path, so a redrawn SVG keeps showing
  the old one under the same name. Write the new one under a new name (`results-2-dark.svg`; the kit's `--name`)
  and delete the old.
- Screenshots (PNG or WebP of the real app) go in a two-column `<table>` with `width="50%"` cells and full alts; they
  are the one place a raster appears, and only of the real thing.
- A diagram GitHub can draw itself (mermaid) is fine for architecture; anything that should look like the system is
  an SVG from the kit or the project's own generator, with its generator named in the repository layout.

## licence and footer

The last section is `## licence`, and nothing follows it:

```markdown
## licence

apache-2.0 ([LICENSE](LICENSE)).

the pictures in `assets/readme/` are drawn with the aphes.ist readme kit and embed subsets of Aphesis Script (SIL Open
Font License 1.1, reserved font name "Aphesis Script") and Special Elite (apache-2.0, © 2010 Astigmatic), and the
project's icon, a mark of aphesist's that is not covered by this project's licence.
```

The licence's SPDX name in lowercase, the file linked; then the one paragraph on the pictures' fonts and icon (and,
for a project that ships the theme, the φ and Aphesis Script, as anamnesis's does). Contributing and security links
sit at the end of the repository layout, not after the licence. No "made with", no credits line for tools, no
sign-off.

## do

- Keep the first screen to: the header, the hero picture, what it is, the question.
- Put real pictures of the thing high up: a screenshot, a result, the subject drawn from its own data.
- Write status honestly and early; keep the honesty table current with `results/`.
- Generate the header with the kit and commit both SVGs with the README.

## don't

- A tagline, a slogan, a motto in italics, a pun on the name.
- Badges, shields, emoji, a table of contents, a "star history" chart.
- Capitalised headings ("## Quick Start"), title case anywhere.
- A picture without its dark twin, or a changed SVG under its old name.
- Anything after the licence.

## examples

- [anamnesis](https://github.com/aphesist/anamnesis#readme): the product README, the model for this standard.
- [contraprova](https://github.com/aphesist/contraprova#readme): a study README with a result.
- [aphesist](https://github.com/aphesist): the profile, the ring.
