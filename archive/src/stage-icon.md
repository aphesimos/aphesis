The stage (*opus*): how far a piece of writing has come, from draft to finished. A brushed ring with a stipple that rises inside it like the matter in a vessel, in four states named for the stages of the work.

| state | name | the fill | color |
| --- | --- | --- | --- |
| 0 | *nigredo* (the black) | a heavy sediment at the bottom, about a quarter: large, close cells. barely begun | `ink-soft` |
| 1 | *albedo* (the white) | half full, fine sparse cells. taking shape | `ink-soft` |
| 2 | *citrinitas* (the yellow) | three quarters full. nearly there | `ink-soft` |
| 3 | *rubedo* (the red) | full | `accent`: the only red state |

- **Draw** with `stageIcon(stage)` from `archive/src/stage-icon.js` (a stage name or 0 to 3). It returns inline SVG in `currentColor` on the 24-unit grid, like `Aphesis.icon`; `stageGeometry(stage)` returns `{strokes, dots}` path data.
- **Geometry.** The ring is `Aphesis.brush(Aphesis.arc(12, 12, 7.6, -95, 268, 64), 1.8, 71 + state)`, the terminator's ring with its own seed. The fill is `Aphesis.stipple` inside a radius of 6.3, below a surface at 24, 50, 76 and 100% of the ring's height that leans by a sine of 0.55 units (no lean when full). Cell sizes .72, .42, .55, .55 over 1500, 950, 1350 and 1600 tries; seeds 81 to 84. All seeds are fixed, so the icon is the same on every visit.
- **Use** beside an archive title (28px), in a post's header (28px), and in a legend of the four stages (20px, the one size below the system's 28 to 64px range; it sits next to its name, never alone).
- The level carries the meaning, not the color: each state reads in both themes and without red. Pair it with the stage name as text (a gloss in Aphesis Script) or an `aria-label`; the icon itself is `aria-hidden`.
- **To add it to the design system:** move `stageGeometry` into `ICONS` as `stage: function (st) { ... }` with states 0 to 3 (the bundle's icons take a state argument already), document it in `components/Icons/README.md`, and export the four SVG files with the light-theme ink for places without the script.
