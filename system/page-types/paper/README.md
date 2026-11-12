# 3 · paper page

A study, presented for reading: the question, how it was answered, what was fixed in advance, what came out (with
its intervals), what each claim rests on, and the data or a replay of it to check. For contraprova, heuresis,
autopoiesis and any project that asks a question and answers it with an experiment.

It runs the lab kit only (`system/lab-kit/v1/`), never the site's runtime: a viewer is a document to be read, so the
kit's "readability first" rules hold (see "Lab kit" in [`system/README.md`](../../README.md)). It is built from the
best of what exists: [contraprova's replay](https://contraprova.aphes.ist/) (stat tiles, a chart with its table, the
log replayed, the honesty table) and [the lab kit's demo](https://aphes.ist/lab-kit/v1/) (the receding header, the
charts, the legends). [`template/`](template/) is a starter.

## Sections, in order

| # | part | id · gloss | required | what goes in it |
| --- | --- | --- | --- | --- |
| 0 | header | `header.lab-header.lab-header--sticky` | yes | `.lab-mark` (the φ, to aphes.ist), `.lab-project` with its `.lab-gloss`, `nav.lab-nav` with the parts below, `.lab-controls` (`close the eye`, `fog · off`) |
| 1 | title | `.lab-titles` | yes | `.lab-gloss-title` (Latin or Greek), `h1.lab-title` (what the page is: "the replay", "run viewer", or the study's short name), `p.lab-lede` (one sentence: what was studied, on what), a `.lab-meta` line: the data set, its date, its commit or hash, the status (`.lab-ev`) |
| 2 | question | `#question` · *quaestio* | yes | the question in one sentence, as a `.lab-callout`; then two or three sentences of why it is asked and what answer would change what |
| 3 | method | `#method` · *methodus* | yes | the arms or conditions, the data, the measure, the sample; a figure of the design if one exists; in prose, at most 65ch |
| 4 | pre-registration | `#prereg` · *praescriptum* | yes | what was fixed before the run (hypotheses, margins, sample size, the test), with a link to the committed file and its date or commit; every deviation listed, or "none" |
| 5 | results | `#results` · *inventa* | yes | stat tiles (`dl.lab-stats`, the one that answers the question as `.lab-stat--ref`), then one or more charts, each with its table view; or "no results yet" said plainly, with what will appear here |
| 6 | honesty table | `#honesty` · *fundamenta*, headed "what this rests on" | yes | `table.lab-table.lab-honesty`: each claim on the page and the kind of evidence behind it (`measured`, `modelled`, `tested`, `hypothesis`), always with the word, and its key |
| 7 | replay or data | `#data` · *acta* | yes | the log replayed (contraprova: a scrubber, linked panels, the event trail), or the data: files, sizes, hashes, how to verify and how to re-run, in a `pre` |
| 8 | footer | `footer.lab-footer.lab-meta` | yes | the page's name, the kit's version and where it is vendored, the repository, the licence |

Where there is a reason to put the results first (a replay whose figures *are* the results), the title's lede says
the finding in one sentence; the order of the parts does not change. A study not yet run keeps every part: results
says "no results yet" and what will be measured, and the honesty table says "hypothesis" for each claim.

## Components and classes

All from the lab kit; the page adds layout only, on the kit's tokens, with a prefix of its own (contraprova: `cp-`).

| what | markup |
| --- | --- |
| page and column | `body.lab > .lab-page` (1120px), `.lab-section` between parts, `.lab-prose` for text at 65ch |
| header | `header.lab-header.lab-header--sticky` (+ `--blur` on a page that is mostly text); `a.lab-mark`, `span.lab-project > span.lab-gloss[lang]`, `nav.lab-nav`, `div.lab-controls > button.lab-button[data-lab-toggle]` |
| title | `.lab-titles > .lab-gloss-title + h1.lab-title + p.lab-lede` |
| question | `.lab-callout > .lab-callout-label + p` ("the question") |
| tiles | `dl.lab-stats > .lab-stat > dt.lab-stat-label + dd.lab-stat-value.num + dd.lab-stat-note`; `.lab-stat--ref` for the answer |
| charts | `figure.lab-chart > .lab-chart-head (h3 + ul.lab-legend) + svg[role=img][aria-label] + figcaption` |
| marks | `.lab-line`, `.lab-dot`, `.lab-bar`, `.lab-band` (stippled interval), `.lab-rule-ref` (a target or margin), `.lab-ring` (the one point that matters), `.lab-label`; colours by `.lab-c1`–`.lab-c8`, `.lab-ink`, `.lab-accent` |
| tables | `.lab-table-wrap > table.lab-table(.lab-table--dense)`, `caption`, `th[scope]`, `.num`, `tr.lab-ref-row`, `.lab-pass` / `.lab-fail` |
| honesty | `table.lab-table.lab-honesty` with `span.lab-ev[data-ev]`; the key as `.lab-ev-key.lab-legend` |
| notes | `details > summary` ("what am i looking at?") around a `.lab-prose` explainer, open by default |
| code and data | `pre[data-label] > code`, `.c` for comments; inline `code` |
| tooltips | `[data-tip]`; never `title` |

## Charts

- **The kit's chart layer, nothing else.** Axes and ticks as hairlines in `lab-axis`, gridlines as dotted cells,
  words in the text face at meta size. One y-axis. Draw with plain SVG, D3, Observable Plot (`Lab.plot()`) or Vega
  (`Lab.vega()`); the CSS reads them all.
- **Intervals always.** Every estimate shows its interval, as a stippled `.lab-band` or error bar, and the
  interval's kind is in the caption (95% Wilson, bootstrap, Bayesian). A margin or target is a `.lab-rule-ref`.
- **Red marks the reference, once per chart:** the pre-registered margin or target (`.lab-rule-ref`), and at most a ring
  round the one point that answers the question. Arms take the categorical slots, ink first.
- **Each chart says its finding** in its `aria-label` and in its caption ("the cascade solves within 2.3 points of
  opus, inside the −10 margin"), and has a table view (`lab-table`) with the numbers.
- **Draw once.** No animation in, no transitions on data. A scrubber moves state only when the reader moves it.
- **Synthetic data says so**: a `.lab-callout--alert` above it, and the honesty key's "synthetic" kind.

## The receding header

`header.lab-header.lab-header--sticky` (lab kit 1.1): the header stays while the document scrolls, and what passes
under it fades through the ground's band (`lab-band`, 50px). Add `.lab-header--blur` on a page that is mostly text.
The nav lists the parts (question, method, pre-registration, results, honesty, data) and becomes one sideways line
on a phone. Never a background, a border or a shadow; never inside an element with `overflow`. A pane that scrolls on
its own (a log, an event trail) takes `.lab-bands.lab-bands--inner` and a height.

## Motion

None unless the reader asks. The stipple ground is off by default and still when on; `data-lab-fog="drift"` only on
a page whose subject moves, and never under `prefers-reduced-motion`. Charts draw once; the theme changes at once.
A replay plays only from its play button, and its speed is the reader's. Reduced motion always wins: a replay
stepping on its own shows the final state instead.

## Typography

- Title: the kit's `.lab-title` (Aphesis Script, slant −12, `clamp(44px, 8vw, 68px)`), the gloss above it.
- Headings: `h2` (the heading style, Aphesis Script); `h3` is a label (Special Elite, tracked), used for chart titles
  and sub-parts.
- Text: Special Elite at `body`, 65ch (`.lab-prose`); numbers in `.num` (tabular figures); every word lowercase but
  code, file names and the names of arms or tasks as the data writes them (`A`, `D:control`).
- Status words are always written out (`measured`, `pass`), never only a colour or a mark.

## Readability first

- One column of prose, figures as wide as the column, two charts side by side only above 960px.
- Every number has its sample size and interval within reach; every claim is in the honesty table.
- Say what is not shown: what the replay omits (file contents), what was out of scope, what the benchmark's ceiling
  means.
- Links to the full report, the pre-registration and the log are plain text links, not buttons.

## Accessibility

- One `h1`; sections `aria-labelledby` their `h2`; the nav labelled "on this page".
- Charts: `role="img"` and an `aria-label` that states the finding; a table view with the same numbers.
- Colour never alone: legends, direct labels, status words, the four honesty kinds drawn differently (a square, dense
  stipple, a ring, sparse red stipple) and named.
- Controls are buttons and labels with words ("play", "step", "close the eye"); a scrubber is a native range under
  the kit's styling, with its value spoken (`aria-valuetext`).
- Focus: the kit's 1px accent outline. Native scrollbars in the theme's colours.

## Performance

- Plain static files: `index.html`, the data (`data/*.json`), `vendor/lab-kit-v1/` (pinned by
  `tools/page-types/vendor.py --kit-only`). No framework is needed; a chart library, if any, is vendored too.
- No request outside the page's folder: no CDN, no analytics, no fonts from elsewhere.
- Data exports are summaries (one line per event, never file contents), under 1 MB where possible; a page that can
  open from disk offers a file picker or a standalone build with the data inlined.
- The page renders its words before its data loads; a missing data file says so in words and how to fix it.

## Do

- State the question first and the answer plainly, with its interval, even when the answer is "about the same".
- Put the honesty table on the page itself, with every claim the page makes.
- Show the pre-registration's date and link, and every deviation from it.
- Let the reader check: the log, the hash, the command that recomputes each number.

## Don't

- A hero, a living element, the site's fog, the cursor, the theme wave, sound.
- A number without its basis; a chart without a caption; a red that does not mark the one thing.
- Animation on load, counters, transitions on data, autoplaying replays.
- Boxes or filled panels around text; a sticky header with a background.
- Claims of superiority beyond what the interval supports; hiding a null or a ceiling.
- `title` attributes (contraprova's replay check still has one: move it to `data-tip`).

## Template

[`template/`](template/): `index.html`, with every part in place, a static SVG chart with an interval and a margin,
its table view, stat tiles and the honesty table, all on the lab kit.

```sh
cp -r system/page-types/paper/template ../PROJECT/site
python3 tools/page-types/vendor.py ../PROJECT/site --project PROJECT --kit-only    # vendor/lab-kit-v1
python3 -m http.server -d ../PROJECT/site                                         # http://127.0.0.1:8000/
```

## Examples

- [contraprova.aphes.ist](https://contraprova.aphes.ist/) ([source](https://github.com/aphesist/contraprova/tree/main/ui)):
  the replay of a pre-registered study. The reference for results, the replay and the honesty table; it gains
  question, method and pre-registration parts under this type.
- [aphes.ist/lab-kit/v1](https://aphes.ist/lab-kit/v1/): every component, the receding header and the charts.
- autopoiesis's run viewer ([source](https://github.com/aphesist/autopoiesis/tree/main/site)): a study not yet run.
