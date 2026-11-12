# Page types

Everything the owner publishes is one of three kinds of page, and every repository's README follows one standard.
Each has its own folder here: what it is for, the sections it must have and in what order, the components and
classes, motion, type, do's and don'ts, a starter template, and the live pages that show it.

| type | what it is | runs | motion | examples |
| --- | --- | --- | --- | --- |
| [**1 · the site**](site/README.md) | aphes.ist itself: the hermetic one-page work | the runtime (`components/bundle.*`), the whole system | always, for everyone; sound on | [aphes.ist](https://aphes.ist/) |
| [**2 · landing page**](landing/README.md) | an open-source product's page: what it is, what it does, how to get it | the runtime, quietly, plus the lab kit's faces | a budget; still under reduced motion | [anamnesis.aphes.ist](https://anamnesis.aphes.ist/) |
| [**3 · paper page**](paper/README.md) | a study presented for reading: question, method, results, what it rests on | the lab kit only | none unless asked; still under reduced motion | [contraprova.aphes.ist](https://contraprova.aphes.ist/), [the lab kit demo](https://aphes.ist/lab-kit/v1/) |
| [**README standard**](readme/README.md) | a repository's README on GitHub | the readme kit's animated SVGs | CSS only; still under reduced motion | [anamnesis](https://github.com/aphesist/anamnesis#readme) |

## Which one

- A repository that ships something people install or use gets a **landing page** (anamnesis).
- A repository that asks a question and answers it with an experiment gets a **paper page** (contraprova, heuresis,
  autopoiesis). A project can have both: the landing page links its paper page from "what it does" or the
  evaluation, and the paper page links back from its header.
- Nothing else is a site. A new section of aphes.ist is built on the site's own branch, by its rules, not as a page
  of these types.

## What all of them share

The principles of [`system/README.md`](../README.md) hold everywhere: two faces (Aphesis Script for names, titles
and glosses at slant −12; Special Elite for what people read), lowercase, English with Latin or Greek glosses as the
one exception, tokens instead of loose values, red is rare, nothing solid that is not a value, no boxes, no
gradients, no emoji, the `title` attribute never (use `data-tip`).

Across the three types the differences are deliberate and run one way: from the site (a work to be seen) to the
paper (a document to be read), motion falls away and readability rules more.

| rule | site | landing | paper |
| --- | --- | --- | --- |
| ground | the fog, density 1 at home, .62 in a section | the fog, low (.15 to .2), cleared from the column below the hero | none, or the kit's static stipple ground when the reader turns it on |
| the φ | the seal, live, boiling, travelling | top-left, boiling, links to aphes.ist; still under reduced motion | `.lab-mark`, the drawing, still |
| the project's icon | (sections' icons) | beside the name in the header, stirring on hover; the tab's favicon | in the header beside the name, still |
| hero | the φ drawing itself | one living stipple element of the project's subject | none: the title and the question |
| motion | always; never `prefers-reduced-motion` | a budget (below); everything still under reduced motion | nothing moves unless asked; reduced motion always wins |
| cursor, letter waves, theme wave | yes | yes (fine pointers; the wave from the eye) | no |
| sound | yes, on by default | no | no |
| scrollbar | the scroll disturbance | the scroll disturbance (the runtime's) | native, in the theme's colours |
| header | the seal and the corners | fixed, slim, a veil of the ground once the page moves | `.lab-header--sticky`, the receding band |
| data marks | stipple only | stipple; screenshots dissolve at the edges | solid where that is what makes a value readable |
| width | the screen | 760px for prose, 1040px for wide parts, 1280px column | 1120px column, 65ch prose |

## The words

Every type, and every README, speaks the same way:

- **Say what it is, not how good it is.** "a local-first second brain that measures itself" names the thing.
  No taglines, no slogans, no rhetorical questions, no "blazing", "powerful", "seamless", "revolutionary",
  "supercharge", "unlock", "effortless", no exclamation marks. A line that would fit on any other project is wrong.
- **Lowercase.** Titles, headings, labels, buttons and running text, names of people and products included
  (thoreau, claude code, obsidian, swe-bench pro), as anamnesis's README and page write them. Capitals stay only where
  changing them would change the meaning or break a copy: code, commands, file names (`README.md`), environment
  variables, quoted interface text ("Continue with ChatGPT"), the names of the two typefaces, and an artist's name in a
  simulacrum's caption (the site's rule).
- **Numbers carry their basis.** A number on a page has its sample size, its interval or its status nearby, and the
  honesty table (landing and paper) says whether it is measured, modelled, tested or a hypothesis.
- **One voice.** First person singular where a person speaks ("tell me in an issue"); plain and short everywhere.
