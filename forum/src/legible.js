/* legible: how the forum's pictures are rendered. Forum pictures carry information (a face, a screenshot, a page),
   so they are not hermetic simulacra: they stay stipple and still coalesce out of the fog, but they read at a glance.
   The middle the owner asked for: recognisable faces, text and composition; cells visible as cells; a little erosion
   and a few lost points. Most of the gain comes from the map (density.js), not from stripping the stipple.

   The live viewer uses the design system's preset as it is: Simulacrum(canvas, {legible: true}), whose defaults are
   Aphesis.Simulacrum.LEGIBLE (erosion .15, scatter .18, ceiling .93, cells of 1.25px). The still simulacra in thumb.js
   follow the same shader terms (legible branch: the fog's modulation .94 + .12d, threshold 12% hash, cells at .84),
   so a thumbnail and its opened picture look like one thing.

   HERMETIC is the system's default look and CLEAN is past the line (no lost points, no holes, full areas, ordered
   threshold): both are kept only for comparisons. */

const A = window.Aphesis;
const PRESET = Object.assign({ erosion: 0.15, scatter: 0.18, ceiling: 0.93, cell: 1.25 }, (A.Simulacrum && A.Simulacrum.LEGIBLE) || {});

export const HERMETIC = { scatter: 0.5, erosion: 0.45, ceiling: 0.8, gain: 1, cell: 2, threshold: 0.35, fogMod: 0.36, curve: 1.15, feather: 0.07, alpha: 0.72, prepare: false };
export const MIDDLE = { scatter: PRESET.scatter, erosion: PRESET.erosion, ceiling: PRESET.ceiling, gain: 1, cell: PRESET.cell,
  threshold: 0.12, fogMod: 0.12, curve: 1.15, feather: 0.025, alpha: 0.84, prepare: true };
export const CLEAN = { scatter: 0, erosion: 0, ceiling: 1, gain: 1, cell: 1, threshold: 0, fogMod: 0, curve: 1, feather: 0, alpha: 0.9, prepare: true };

/* the options for the live Aphesis.Simulacrum: the system's preset */
export function liveOptions() { return { legible: true }; }

/* the options for a still (thumb.js) */
export function stillOptions() { return Object.assign({}, MIDDLE); }
