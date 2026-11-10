/* autopoiesis: a machine that rewrites its own rule and keeps a rewrite only when it does at least as well.

   The organism is a one-dimensional cellular automaton: a ring of 59 cells, each 0 or 1, where every cell's next
   state is read from a 32-entry rule table indexed by itself and its two neighbours on each side (radius 2).
   Its task is the classic density classification task: from any first row, end with every cell 1 if the first row
   held more 1s than 0s, and every cell 0 otherwise. No cell can see the whole ring, so the rule must carry the
   decision across it.

   The benchmark is 64 first rows drawn once per lineage (each with its own share of 1s, uniform on [0, 1]); a row is
   decided right only if the whole ring is uniform and correct after 118 steps. Each generation the machine flips
   one to three entries of its own table, runs the benchmark, and keeps the rewrite when its score is not lower
   (a strict rise counts as an improvement; an equal score is a neutral step, which lets it drift across plateaus).
   Overfitting is checked on 256 fresh rows it never trains on. This is a miniature of the Darwin–Gödel Machine's
   loop: propose a change to yourself, measure it, keep what measures better. */

import { bench } from '../bench.js';
import { field } from '../stipple.js';
import { chart } from '../chart.js';
import { ticker, num, pct } from '../motion.js';

const A = window.Aphesis;
const W = 59, R = 2, BITS = 32, T = 2 * W, K = 64, FRESH = 256, GENS = 300, ROWS = 80, EVERY = 0.05;

/* a first row; its share of 1s is drawn from [lo, hi] (the benchmark uses all of [0, 1]) */
function firstRow(r, lo = 0, hi = 1) {
  const d = lo + (hi - lo) * r(), a = new Uint8Array(W); let s = 0;
  for (let x = 0; x < W; x++) { a[x] = r() < d ? 1 : 0; s += a[x]; }
  return { row: a, majority: s * 2 > W ? 1 : 0, ones: s / W };
}

/* one step of the ring under a rule (radius 2, wrapping) */
function step(rule, row, out) {
  let k = 0;
  for (let d = -R; d <= R; d++) k = (k << 1) | row[(d + W) % W];
  for (let x = 0; x < W; x++) { out[x] = rule[k]; k = ((k << 1) | row[(x + R + 1) % W]) & (BITS - 1); }
}

/* what the rule decides from a first row after T steps: 1, 0, or -1 (the ring is not uniform) */
function decide(rule, row, a, b) {
  a.set(row);
  for (let t = 0; t < T; t++) { step(rule, a, b); const s = a; a = b; b = s; }
  let s = 0; for (let x = 0; x < W; x++) s += a[x];
  return s === W ? 1 : s === 0 ? 0 : -1;
}

function score(rule, set, a, b) {
  let ok = 0;
  for (const f of set) if (decide(rule, f.row, a, b) === f.majority) ok++;
  return ok / set.length;
}

const hex = (rule) => { let s = ''; for (let i = 0; i < BITS; i += 4) s += ((rule[i] << 3) | (rule[i + 1] << 2) | (rule[i + 2] << 1) | rule[i + 3]).toString(16); return s; };

export function mount(host, ctx) {
  const b = bench(host);
  const cv = b.canvas('organism', 'the current rule run from one first row: time goes down, one row per step');
  const org = field(cv);
  const ch = chart(b.plot, {
    x: { min: 0, max: GENS, ticks: [0, 100, 200, 300], label: 'generation' },
    y: { min: 0, max: 1, ticks: [0, 0.5, 1], fmt: (v) => v.toFixed(1), label: 'score on the 64 trials' },
    height: 240,
    label: 'score of the kept rule and of every proposed rewrite, by generation',
    step: 1,
    readout: (x) => {
      const g = Math.max(0, Math.min(hist.length - 1, Math.round(x)));
      if (!hist.length) return null;
      const h = hist[g];
      return { x: g, y: h.best, text: `generation ${g} · kept ${num(h.best)} · proposed ${num(h.tried)}` };
    },
    idle: () => 'kept: the brush line · proposed: the grains · point or use the arrow keys to read it',
  });

  let r, tests, fresh, rule, best, hist, kept, neutral, lastUp, freshScore, display, clock, acc;
  const bufA = new Uint8Array(W), bufB = new Uint8Array(W);

  function paintOrganism() {
    const rows = [display.row.slice()];
    let a = display.row.slice(), n = new Uint8Array(W);
    for (let t = 1; t < ROWS; t++) { step(rule, a, n); rows.push(n.slice()); const s = a; a = n; n = s; }
    org.paint((CW, CH, D) => {
      for (let y = 0; y < CH; y++) {
        const row = rows[Math.min(ROWS - 1, Math.floor(y / CH * ROWS))];
        for (let x = 0; x < CW; x++) D[y * CW + x] = row[Math.min(W - 1, Math.floor(x / CW * W))] ? 0.8 : 0.03;
      }
    });
    const got = decide(rule, display.row, bufA, bufB);
    const said = got === -1 ? 'undecided' : `all ${got}s, ${got === display.majority ? 'right' : 'wrong'}`;
    b.caption(`rule ${hex(rule)} · first row ${pct(display.ones, 0)} ones · after ${T} steps: ${said}`);
  }

  function plot() {
    const pts = hist.map((h, g) => [g, h.best]);
    const layers = [
      { type: 'area', pts: pts.flatMap((p, i) => (i ? [[p[0], pts[i - 1][1]], p] : [p])), density: 0.42, seed: 3, tone: 'soft' },
      { type: 'dots', pts: hist.map((h, g) => [g, h.tried]), tone: 'soft', seed: 4 },
      { type: 'line', pts, step: true, width: 2, seed: 5, tone: 'ink' },
    ];
    if (freshScore !== null) layers.push({ type: 'rule', y: freshScore, tone: 'soft', label: `fresh rows ${num(freshScore, 2)}`, seed: 6 });
    if (lastUp) layers.push({ type: 'ring', at: [lastUp, hist[lastUp].best], tone: 'accent', seed: 7 });
    ch.set(layers);
    ch.refresh();
  }

  function report() {
    const g = hist.length - 1;
    ctx.values({
      gen: String(g), tried: String(g), kept: String(kept), neutral: String(neutral),
      first: num(hist[0].best), best: num(best), fresh: freshScore === null ? '·' : pct(freshScore), rule: hex(rule),
      state: g >= GENS ? 'the run has ended' : 'the run is still going',
    });
  }

  function generation() {
    const c = rule.slice(), flips = 1 + Math.floor(r() * 3);
    for (let i = 0; i < flips; i++) c[Math.floor(r() * BITS)] ^= 1;
    const s = score(c, tests, bufA, bufB);
    if (s > best) { kept++; lastUp = hist.length; }
    else if (s === best) neutral++;
    if (s >= best) {
      const changed = s > best; rule = c; best = s;
      if (changed) { freshScore = score(rule, fresh, bufA, bufB); paintOrganism(); }
    }
    hist.push({ best, tried: s });
  }

  function lineage() {
    if (clock) clock.stop();
    r = A.rng((Math.random() * 4294967295) >>> 0);
    tests = Array.from({ length: K }, () => firstRow(r));
    fresh = Array.from({ length: FRESH }, () => firstRow(r));
    rule = new Uint8Array(BITS); for (let i = 0; i < BITS; i++) rule[i] = r() < 0.5 ? 1 : 0;
    best = score(rule, tests, bufA, bufB);
    hist = [{ best, tried: best }]; kept = 0; neutral = 0; lastUp = 0; acc = 0;
    freshScore = score(rule, fresh, bufA, bufB);
    display = firstRow(r, 0.38, 0.62);
    paintOrganism(); plot(); report();
    ctx.announce('a new lineage begins from a random rule');
    clock = ticker((dt) => {
      acc += dt;
      let n = 0;
      while (acc >= EVERY && hist.length <= GENS && n < 4) { acc -= EVERY; generation(); n++; }
      if (n) { plot(); report(); }
      if (hist.length > GENS) { ctx.announce(`the run ended: score ${num(best)} on the trials, ${pct(freshScore)} on fresh rows`); return false; }
    });
  }

  /* touching the organism gives it a new first row: the same rule, read again */
  const reseed = () => { display = firstRow(A.rng((Math.random() * 4294967295) >>> 0), 0.38, 0.62); paintOrganism(); };
  cv.tabIndex = 0; cv.dataset.cursor = '1'; cv.dataset.tip = 'touch · a new first row';
  cv.addEventListener('click', reseed);
  cv.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reseed(); } });
  b.button('give it a new first row', reseed, 'the same rule, read from another row');
  b.button('begin a new lineage', lineage, 'a random rule, a new benchmark');

  lineage();
  return { stop() { if (clock) clock.stop(); org.destroy(); ch.destroy(); } };
}
