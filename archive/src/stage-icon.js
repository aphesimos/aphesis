/* stage (opus): the four-state icon of the archive. A brushed ring on the design system's 24-unit grid, with a
   stipple that rises inside it like the matter in a vessel, one level per alchemical stage:
     nigredo     the black: a heavy sediment at the bottom, barely begun (large, close cells)
     albedo      the white: the vessel half full of fine, sparse cells, taking shape
     citrinitas  the yellow: three quarters full, nearly there
     rubedo      the red: full; the only state drawn in accent
   The level carries the meaning, not the color: every state reads in both themes and without red.
   Written in the runtime's own style (brush + stipple, fixed seeds, currentColor) so it can move into
   Aphesis.ICONS as `stage` with states 0 to 3. See stage-icon.md. */

const A = window.Aphesis;

export const STAGES = ['nigredo', 'albedo', 'citrinitas', 'rubedo'];

/* level: share of the ring's height the stipple fills; size and tries: how heavy its cells are */
const FILL = [
  { level: 0.24, size: 0.72, tries: 1500 },
  { level: 0.5, size: 0.42, tries: 950 },
  { level: 0.76, size: 0.55, tries: 1350 },
  { level: 1, size: 0.55, tries: 1600 },
];
const R_IN = 6.3, TOP = 12 - R_IN, BOT = 12 + R_IN;

/* geometry of a state (index 0 to 3, or its name): {strokes, dots} as SVG path data on the 24-unit grid */
export function stageGeometry(stage) {
  const i = typeof stage === 'number' ? stage : Math.max(0, STAGES.indexOf(stage));
  const f = FILL[i];
  const strokes = A.brush(A.arc(12, 12, 7.6, -95, 268, 64), 1.8, 71 + i);
  /* the surface of the matter is not level: it leans a little, as a hand-filled vessel does */
  const surface = (x) => BOT - f.level * (BOT - TOP) + (f.level < 1 ? 0.55 * Math.sin(x * 1.1 + i * 1.7) : -1);
  const inside = (x, y) => (x - 12) ** 2 + (y - 12) ** 2 < R_IN * R_IN && y > surface(x);
  return { strokes, dots: A.stipple(inside, 81 + i, f.tries, f.size) };
}

const cache = {};
/* inline SVG in currentColor, like Aphesis.icon. Size it with CSS (28 to 64px; 20px at the smallest, in a legend). */
export function stageIcon(stage) {
  const key = String(stage);
  if (!cache[key]) {
    const g = stageGeometry(stage);
    cache[key] = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="overflow:visible">' +
      '<path d="' + g.strokes + '" fill="currentColor"/>' +
      '<path d="' + g.dots + '" fill="currentColor" opacity=".85"/></svg>';
  }
  return cache[key];
}

/* fill every [data-stage] placeholder under root that has not been drawn yet */
export function drawStageIcons(root) {
  root.querySelectorAll('.stage-icon[data-stage]').forEach((el) => {
    if (!el.firstChild) el.innerHTML = stageIcon(el.dataset.stage);
  });
}
