/* motion: the section's timing, read from the tokens so CSS and script move together, and a wait that a newer
   step can overrule. Every hand-off between the two views goes through `step`, so a quick second choice simply
   replaces the first and nothing is left half done. */

const ms = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(), n = parseFloat(v);
  return isNaN(n) ? fallback : (/ms$/.test(v) ? n : n * 1000);
};
export const SCENE = () => ms('--duration-scene', 1200);

let current = 0;
/* start a new step: every wait of an older step is dropped */
export function step() { current++; const id = current; return { wait(t, fn) { setTimeout(() => { if (id === current) fn(); }, t); }, live: () => id === current }; }
