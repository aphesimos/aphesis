<div align="center">

<a href="https://PROJECT.aphes.ist/"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/readme/header-dark.svg"><img src="assets/readme/header-light.svg" alt="PROJECT: what it is, in one plain line." width="100%"></picture></a>

</div>

PROJECT is … built to answer one question with numbers. (what it is and what it measures, in one to three paragraphs, lowercase.)

> the question, in one sentence, answerable with a number?

> **status:** run or not; what is measured and on what; what is still a hypothesis. plain words, with links to the results and the pre-registration.

## what it found

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/results-dark.svg">
  <img alt="a full sentence of what the chart shows: each arm, its number and its interval" src="assets/readme/results-light.svg" width="100%">
</picture>

- **the answer.** the number, its interval, the margin it was tested against.
- **the cost, or the effect size.** the number and its interval.
- **what limits it.** a ceiling, a small sample, one benchmark.

full report, log and pre-registration: [results/…](results/).

(not run yet: "no results yet." and what will be measured, and when.)

## how it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/method-dark.svg">
  <img alt="a full sentence of what the diagram shows" src="assets/readme/method-light.svg" width="100%">
</picture>

1. **first step.** what happens.
2. **second step.** what happens.

## pre-registration

fixed before the run in [PREREGISTRATION.md](PREREGISTRATION.md) (commit `abc1234`, 2026-11-01): the hypotheses, the margin, the sample, the test. deviations: none.

## honesty table

| claim | status | basis |
|---|---|---|
| the main finding | **measured** (pre-registered, n=…) | [results/…](results/): the numbers and intervals |
| a computed estimate | **modelled** | the model and its assumption |
| a property of the code | **tested** | `tests/…` |
| what the study does not show | **hypothesis** | what it would take |

rows move from hypothesis to measured only when a result with its interval is committed under `results/`.

## quick start

```sh
pip install -e ".[dev]"
pytest
PROJECT verify results/…/log.jsonl     # check the log and replay it
PROJECT report results/…/log.jsonl     # every number above, with its interval
```

python 3.11+, no runtime dependencies.

## the data

**[the replay](https://PROJECT.aphes.ist/)**: the study's log, replayed event by event in the browser. the logs, the analysis and the pre-registration are under [`results/`](results/).

## documents

- [design](docs/design.md): the architecture and the experiment
- [statistics](docs/statistics.md)

## budget

about us$… of api credit spent so far, itemised from logged token counts under [`results/`](results).

## related work

- what this builds on, with links.

## licence

apache-2.0 ([LICENSE](LICENSE)).

the pictures in `assets/readme/` are drawn with the aphes.ist readme kit and embed subsets of Aphesis Script (SIL Open Font License 1.1, reserved font name "Aphesis Script") and Special Elite (apache-2.0, © 2010 Astigmatic), and the project's icon, a mark of aphesist's that is not covered by this project's licence.
