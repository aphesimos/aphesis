// icons.mjs: the icon set as the runtime draws it, without a browser.
// Loads system/components/bundle.js in a bare VM (a stand-in for the few DOM objects it touches while it loads) and
// prints JSON: { sections, projects, icons: { name: { "0": svg, "1": svg } } } for the names given (default: every
// section and project icon). readme.py calls it; nothing else needs it.
//   node tools/readme/icons.mjs [name ...]
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, '..', '..', 'system', 'components', 'bundle.js'), 'utf8');
const noop = () => {};
const U = new Proxy(function () {}, {
  get(t, k) {
    if (k === Symbol.toPrimitive) return () => '';
    if (k === Symbol.iterator) return [][Symbol.iterator];
    if (k === 'querySelectorAll' || k === 'getElementsByTagName' || k === 'getElementsByClassName') return () => [];
    if (k === 'querySelector' || k === 'getElementById' || k === 'closest') return () => null;
    if (k === 'getImageData') return () => ({ data: [0, 0, 0, 255] });
    if (k === 'matches' || k === 'length') return 0;
    if (k === 'then') return undefined;
    return U;
  },
  apply() { return U; }, construct() { return U; }, set() { return true; },
});
const ctx = {
  document: U, navigator: U, location: U, performance: { now: () => 0 },
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  addEventListener: noop, removeEventListener: noop, requestAnimationFrame: noop, cancelAnimationFrame: noop,
  getComputedStyle: () => ({ getPropertyValue: () => '' }), setTimeout: noop, setInterval: noop, clearTimeout: noop, clearInterval: noop,
  MutationObserver: function () { return U; }, ResizeObserver: function () { return U; }, IntersectionObserver: function () { return U; }, console,
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);
const A = ctx.Aphesis;
const names = process.argv.slice(2).length ? process.argv.slice(2) : [...A.SECTIONS, ...A.PROJECTS];
const icons = {};
for (const n of names) {
  if (!A.ICONS[n]) { console.error('no icon named ' + n); process.exit(1); }
  icons[n] = { 0: A.icon(n, 0), 1: A.icon(n, 1) };
}
process.stdout.write(JSON.stringify({ sections: [...A.SECTIONS], projects: [...A.PROJECTS], icons }));
