# laboratory · *officina*

Measured experiments. Each experiment is a page with a hypothesis, a method, a live bench the visitor can run or
touch, and a result computed in the browser while the page is open. Nothing on the page is invented: every number
in a result comes from the bench.

```
python3 laboratory/build.py                 # writes laboratory/index.html (a full, self-contained document)
python3 laboratory/build.py --fragment OUT  # the same page without <!doctype>/<html>/<head>/<body>
```

The build reads the design system from the `design-system` branch with `git show` (tokens, runtime, fonts) and
generates `tokens.css`. Serve `index.html` over http to try it. Routes: `#laboratory` (the index) and
`#laboratory/<slug>` (one experiment). The `--fragment` build is published at
https://claude.ai/artifact/QRZieEZnGQTHg4FGeBmBvr (private until shared).

## Files

| path | what it is |
| --- | --- |
| `content/NN-name.md` | one experiment: front matter and body |
| `src/experiments/<module>.js` | its live piece: exports `mount(host, ctx)` |
| `src/chart.js` | the chart module: brush and stipple charts (documented below) |
| `src/stipple.js` | stipple fields on a 2D canvas, lit by the fog's rule |
| `src/slider.js` | the brushed slider (a native range input under a brush drawing) |
| `src/bench.js` | the bench's frame: specimen, plot, controls, text buttons with a brushed underline |
| `src/views.js` | the index (an inscription) and the experiment page |
| `src/ground.js` | the fog at a section's density, with calm zones that follow the scroll |
| `src/motion.js` | minimum-jerk tween, frame ticker, number formats, theme listener |
| `src/main.js` | theme, seal, cursor, tooltip, routing and transitions |
| `src/template.html`, `src/laboratory.css` | the page and its styles (tokens only) |

## Adding an experiment

1. **Write the content file**, `content/04-name.md`:

   ```
   ---
   slug: name-in-the-url
   title: the name, lowercase
   gloss: a latin or greek gloss
   order: 4
   module: name            # src/experiments/name.js
   summary: one line for the index.
   example: false          # true only for the three examples
   ---

   ## hypothesis
   what i expect, in a sentence or two.

   ## method
   what the bench does and what it measures, plainly.

   ## result
   sentences with {placeholders} the module fills, e.g. the score rose to {best}.

   ## notes
   optional; any other `##` section is shown as text after the result.
   ```

   `hypothesis`, `method` and `result` are required; the bench is placed after the method. The body is plain
   paragraphs; `*word*` marks a term. `{name}` becomes a live value, set in the text face with tabular figures.

2. **Write the module**, `src/experiments/name.js`:

   ```js
   import { bench } from '../bench.js';
   import { chart } from '../chart.js';
   import { ticker, num } from '../motion.js';

   export function mount(host, ctx) {
     const b = bench(host);                       // b.specimen, b.plot, b.controls
     const c = chart(b.plot, { x: {...}, y: {...}, label: '...' });
     const clock = ticker((dt) => {                // run, then end on its own (no pause button)
       // ...measure...
       c.set([{ type: 'line', pts, seed: 1 }]);
       ctx.values({ best: num(best) });            // fills {best} in the result
       if (done) return false;
     });
     return { stop() { clock.stop(); c.destroy(); } };   // called when the visitor leaves the page
   }
   ```

   `ctx` has `values(obj)` (fill placeholders; strings) and `announce(text)` (the polite live region).

3. **Build** and check it at desktop and phone width, in both themes, with the keyboard alone.

### Rules for a bench

- **Compute, don't claim.** A result sentence states what was measured, with the numbers the module measured.
  If the run can end badly, say so in the text: that is a result too.
- **Light.** The fog plus at most one more WebGL canvas at a time; prefer `stipple.field` (2D) for specimens. A
  module releases its canvas in `stop()` (`WEBGL_lose_context`).
- **No canvas before its first frame:** canvases start at opacity 0 and get the class `on` once drawn
  (`stipple.field` does this itself).
- **Runs end on their own;** there is no pause button. Ease anything that travels with `Aphesis.MJ`.
- **Touchable and reachable:** every pointer action has a keyboard path (a focusable canvas with Enter/arrows, a
  button, or the slider). Buttons state what happens, lowercase.
- **Nothing solid:** marks are brush strokes or stipple; no borders, fills or boxes. Red (`accent`) is for one
  mark that matters: the thumb, the point of interest.

## The chart module (`src/chart.js`)

```js
const c = chart(host, {
  x: { min, max, ticks: [..], fmt: (v) => '..', label: 'generation' },
  y: { min, max, ticks: [..], fmt, label: 'score' },
  height: 240,                       // CSS px; the width follows the host
  label: 'what the chart shows',     // accessible name of the figure
  step: 1,                           // keyboard step along x (shift: ×10)
  readout: (x) => ({ x, y, text }),  // what the hairline says at x; snap x to your data
  idle: () => 'how to read it',      // the readout when nothing is pointed at
  pick: (x) => {},                   // optional: click or Enter at x
});
c.set(layers); c.axis('y', { max, ticks }); c.refresh(); c.destroy();
```

| layer | drawn as | use |
| --- | --- | --- |
| `{ type: 'area', pts, density, seed, tone }` | stipple, densest at the line, thinning to the base | magnitude under a series |
| `{ type: 'dots', pts, seed, tone }` | a small cluster of 2px cells per point | samples, candidates |
| `{ type: 'dotted', pts, tone }` | single cells every 6px | an expectation, a reference |
| `{ type: 'line', pts, width, seed, tone, step }` | a brush stroke (`step: true` for a staircase) | the series |
| `{ type: 'rule', x \| y, label, seed, tone }` | a hairline brush stroke across the plot | a marker, a threshold |
| `{ type: 'ring', at, seed, tone }` | a small brushed ring | the one point that matters |

Tones are the role tokens: `ink`, `soft` (ink-soft), `accent`, `line`. Axes are hairline brush strokes in `line`;
labels are meta style with tabular figures; there is no grid and nothing is filled. Seeds are fixed, so a chart
is the same drawing every time and does not shimmer while data grows. Identity is never colour alone: say in the
readout or the caption which mark is which (the brush line, the grains, the line of single cells). Pointing at
the plot, or focusing it and pressing the arrow keys, Home or End, moves a hairline and writes the readout under
it (also a polite live region).

## The examples

1. **autopoiesis**: a cellular automaton (radius 2, a 32-entry table, ring of 59) rewrites its own table and keeps
   a rewrite when its score on 64 fixed trials of the density classification task does not fall. Chart: kept
   score (brush), proposed scores (grains), fresh-row score (rule). Specimen: the current rule's space-time, as
   stipple.
2. **the fog itself**: the fog's own hash (cut from `bundle.js` at build time) on a WebGL canvas, a density ramp
   0 → 1, read back cell by cell; lit share vs density over 24 patches at random places in the grid.
3. **the golden angle**: Vogel's sunflower model, 300 seeds; unevenness = coefficient of variation of
   nearest-neighbour distances, swept over 130°–145° and refined around its minimum. The brushed slider places
   the seeds for any angle.
