/* eye: the gate's eye. The theme switch's eye (the shell's EYE and Aphesis.ICONS.eye: two brushed lids, a stippled
   iris; closed, one lid and three lashes), drawn large above the line.

   It draws itself first, stroke by stroke, the way the φ draws itself on the home: the upper lid, the lower lid,
   then the iris cell by cell. After that it never stops trembling: on a tick of 125 ms (8 fps) its strokes are
   redrawn from one of three drawings of the same state, each with its own brush seeds, and the feTurbulence seed is
   swapped, as the seal's boil does.

   Nothing in it is ever tweened. Every state is its own drawing, cut to on a tick and held for whole ticks:
     blinks  open, half (the lid lowered, its fold still showing), closed (one lid and three lashes), squint, wide
     gaze    centre, left, right, up, down, the four diagonals, narrow (a small pupil) and dilated (a wide one)
   Blinks and gaze are two tracks that run on their own clocks, so a blink can land on any gaze. The gaze moves in
   saccades: a cut to a new fixation, then a hold of irregular length. It sometimes follows the pointer or the caret,
   glances at the line while the owner types, and once in a while looks straight out. */

const A = window.Aphesis;

export const BLINKS = ['open', 'half', 'closed', 'squint', 'wide'];
export const GAZES = ['centre', 'left', 'right', 'up', 'down', 'up-left', 'up-right', 'down-left', 'down-right', 'narrow', 'dilated'];
export const TICK = 125;
const VARIANTS = 3;
const DIR = {
  centre: [0, 0], left: [-2.3, 0], right: [2.3, 0], up: [0, -1.5], down: [0, 1.5],
  'up-left': [-1.75, -1.15], 'up-right': [1.75, -1.15], 'down-left': [-1.75, 1.15], 'down-right': [1.75, 1.15],
  narrow: [0, 0], dilated: [0, 0],
};
const PUPIL = { narrow: 0.62, dilated: 2.15 };
const IRIS = 3.1, PUPIL_R = 1.25;
/* the icon's widths are for 28 to 64 px; drawn this large the same hand is lighter, about half */
const HAND = 0.52;

/* ---------- the lids of each blink state: centerlines on the 24-unit grid ---------- */
/* an upper lid is the lower half of an ellipse centred below the eye (as the icon's), a lower lid the upper half of
   one centred above; top(x) and bottom(x) are the opening between them, which the iris is cut to */
function upper(cy, ry, r = 9, a0 = -160, a1 = -20) { return { pts: A.arc(12, cy, r, a0, a1, 40, ry), y: (x) => cy - ry * Math.sqrt(Math.max(0, 1 - ((x - 12) / r) ** 2)) }; }
function lower(cy, ry, r = 9, a0 = 20, a1 = 160) { return { pts: A.arc(12, cy, r, a0, a1, 40, ry), y: (x) => cy + ry * Math.sqrt(Math.max(0, 1 - ((x - 12) / r) ** 2)) }; }

const LIDS = {
  open: () => { const u = upper(15.5, 7), l = lower(8.5, 7); return { strokes: [[u.pts, 1.7, 31], [l.pts, 1.7, 33]], top: u.y, bottom: l.y }; },
  wide: () => { const u = upper(15.6, 8.8, 9.4, -162, -18), l = lower(8.4, 7.9, 9.4, 18, 162); return { strokes: [[u.pts, 1.75, 31], [l.pts, 1.7, 33]], top: u.y, bottom: l.y }; },
  half: () => {
    const u = upper(15.5, 4.2), l = lower(8.5, 7), fold = upper(15.5, 7.6, 9.2, -150, -30);
    return { strokes: [[u.pts, 1.85, 35], [l.pts, 1.7, 33], [fold.pts, 1.0, 39, 0.38]], top: u.y, bottom: l.y };
  },
  squint: () => {
    const u = upper(15.5, 5.1), l = lower(8.5, 5.3), fold = upper(15.5, 7.5, 8.6, -148, -32), under = lower(8.5, 7.6, 8.2, 32, 148);
    return { strokes: [[u.pts, 1.8, 43], [l.pts, 1.75, 45], [fold.pts, 1.0, 47, 0.4], [under.pts, 0.9, 49, 0.4]], top: u.y, bottom: l.y };
  },
  /* the icon's closed state: one lid and three lashes */
  closed: () => {
    const s = [[A.arc(12, 8, 9, 25, 155, 40, 6), 1.8, 37]];
    [-0.55, 0, 0.55].forEach((k, i) => { const x = 12 + k * 9.5; s.push([A.line(x, 14.2 - Math.abs(k) * 1.2, x + k * 1.8, 17.2 - Math.abs(k), 10), 1.2, 41 + i, 0.35, 0.05]); });
    return { strokes: s, top: () => 99, bottom: () => -99 };
  },
};

/* ---------- the iris and the pupil of each gaze state, cut to each blink's opening ---------- */
/* square cells, as the icon's iris: a sparse ring of iris and a dense pupil, each cell on its own seed */
function irisCells(blink, gaze, v) {
  const L = LIDS[blink](), [dx, dy] = DIR[gaze], pr = PUPIL[gaze] || PUPIL_R;
  const cx = 12 + dx, cy = 12 + dy, r = A.rng(1000 + BLINKS.indexOf(blink) * 97 + GAZES.indexOf(gaze) * 13 + v * 7919);
  let iris = '', pupil = '';
  const sq = (x, y, s) => 'M' + (x - s / 2).toFixed(2) + ' ' + (y - s / 2).toFixed(2) + 'h' + s.toFixed(2) + 'v' + s.toFixed(2) + 'h' + (-s).toFixed(2) + 'z';
  const open = (x, y) => y > L.top(x) + 0.45 && y < L.bottom(x) - 0.45;
  /* cells on a jittered grid, so they never pile into a solid patch: the pupil dense, the iris a loose ring */
  const STEP = 0.5;
  for (let gy = -IRIS; gy <= IRIS; gy += STEP) for (let gx = -IRIS; gx <= IRIS; gx += STEP) {
    const x = cx + gx + (r() - 0.5) * 0.16, y = cy + gy + (r() - 0.5) * 0.16, d = Math.hypot(gx, gy);
    if (d > IRIS || !open(x, y)) continue;
    if (d < pr) { if (r() < 0.82) pupil += sq(x, y, 0.4 + r() * 0.1); } else if (r() < 0.46 - 0.18 * (d / IRIS)) iris += sq(x, y, 0.3 + r() * 0.12);
  }
  return { iris, pupil };
}

/* every drawing, made once: lids[blink][v], irises[blink][gaze][v] */
function drawings() {
  const lids = {}, irises = {};
  for (const b of BLINKS) {
    const L = LIDS[b]();
    lids[b] = [];
    for (let v = 0; v < VARIANTS; v++) lids[b].push(L.strokes.map(([p, w, s, t, a]) => A.brush(p, w * HAND, s + v * 211, t, a)).join(''));
    irises[b] = {};
    for (const g of GAZES) { irises[b][g] = []; for (let v = 0; v < VARIANTS; v++) irises[b][g].push(irisCells(b, g, v)); }
  }
  return { lids, irises };
}

export function createEye(host) {
  host.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="overflow:visible">' +
    '<filter id="gate-boil" x="-10%" y="-10%" width="120%" height="120%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="1" result="r"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="r" scale="0.22" xChannelSelector="R" yChannelSelector="G"/></filter>' +
    '<g filter="url(#gate-boil)" fill="currentColor"><path class="lids"/><path class="iris"/><path class="pupil"/></g></svg>';
  const svg = host.firstChild, turb = svg.querySelector('feTurbulence');
  const P = { lids: svg.querySelector('.lids'), iris: svg.querySelector('.iris'), pupil: svg.querySelector('.pupil') };
  const D = drawings();
  const rnd = Math.random;
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  /* irregular holds: mostly short, now and then long (a log-normal spread of ticks) */
  const hold = (median, spread) => Math.max(1, Math.round(median * Math.exp((rnd() + rnd() + rnd() - 1.5) * spread)));

  let tick = 0, frame = 0, timer = 0, drawn = false;
  /* the blink track: a queue of [state, ticks]; at rest the eye is open */
  let blinkQ = [], blink = 'open', nextBlink = hold(26, 0.55);
  /* the gaze track */
  let gaze = 'centre', gazeUntil = hold(8, 0.6);
  let pointer = null, pointerAt = -1e9, caret = null, typedAt = -1e9, forced = null;
  const listeners = [];

  function render() {
    const lids = D.lids[blink][frame];
    const ir = D.irises[blink][gaze][frame];
    P.lids.setAttribute('d', lids);
    P.iris.setAttribute('d', ir.iris);
    P.pupil.setAttribute('d', ir.pupil);
    host.dataset.blink = blink; host.dataset.gaze = gaze; host.dataset.frame = String(frame);
    listeners.forEach((f) => f({ blink, gaze, frame, tick }));
  }

  /* the direction of a point from the eye's centre, as one of the gaze states */
  function toward(x, y) {
    const r = host.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = x - cx, dy = y - cy;
    if (Math.hypot(dx, dy) < r.width * 0.32) return 'centre';
    const a = Math.atan2(dy, dx) * 180 / Math.PI;   /* 0 = right, 90 = down */
    const names = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
    return names[((Math.round(a / 45) % 8) + 8) % 8];
  }

  function stepBlink() {
    if (blinkQ.length) {
      blink = blinkQ[0][0];
      if (--blinkQ[0][1] <= 0) blinkQ.shift();
      return;
    }
    blink = 'open';
    if (--nextBlink > 0) return;
    const u = rnd();
    if (u < 0.7) blinkQ = [['half', 1], ['closed', 2], ['half', 1]];
    else if (u < 0.82) blinkQ = [['half', 1], ['closed', 1], ['half', 1], ['open', 2], ['half', 1], ['closed', 2], ['half', 1]];
    else if (u < 0.93) blinkQ = [['squint', hold(12, 0.4)]];
    else blinkQ = [['half', 2], ['closed', 4], ['half', 2]];
    nextBlink = hold(30, 0.6);
    stepBlink();
  }

  function stepGaze() {
    if (forced) { gaze = forced.gaze; if (--forced.ticks <= 0) { forced = null; gazeUntil = 0; } return; }
    if (tick < gazeUntil) return;
    const now = tick, u = rnd();
    let next;
    if (now - typedAt < 10 && u < 0.62) next = caret ? toward(caret[0], caret[1]) : 'down';      /* a glance at the line */
    else if (now - pointerAt < 24 && u < 0.45) next = toward(pointer[0], pointer[1]);           /* the pointer */
    else if (caret && u < 0.52) next = toward(caret[0], caret[1]);                               /* the caret */
    else if (u < 0.62) next = rnd() < 0.8 ? 'centre' : 'dilated';                                 /* straight out */
    else if (u < 0.67) next = 'narrow';
    else next = pick(GAZES.slice(1, 9));
    gaze = next;
    /* a fixation: short while typing or following, longer when it looks out */
    gazeUntil = now + (next === 'centre' || next === 'dilated' ? hold(14, 0.7) : hold(6, 0.75));
  }

  function step() {
    tick++;
    frame = (frame + 1 + Math.floor(rnd() * (VARIANTS - 1))) % VARIANTS;   /* never the same drawing twice in a row */
    turb.setAttribute('seed', String(1 + Math.floor(rnd() * 997)));
    stepBlink();
    stepGaze();
    render();
  }

  /* ---------- drawing itself, continuously, before the tremble begins ---------- */
  function drawIn(done) {
    const open = LIDS.open(), ir = D.irises.open.centre[0];
    const cells = (s) => s.split('M').slice(1).map((c) => 'M' + c);
    const iris = cells(ir.iris), pupil = cells(ir.pupil);
    const DUR = 2100, t0 = performance.now();
    const part = (pts, k) => pts.slice(0, Math.max(2, Math.round(pts.length * k)));
    function f(now) {
      const t = Math.min(1, (now - t0) / DUR);
      const a = A.MJ(Math.min(1, t / 0.42)), b = A.MJ(Math.max(0, Math.min(1, (t - 0.34) / 0.4))), c = Math.max(0, Math.min(1, (t - 0.7) / 0.3));
      let d = a > 0 ? A.brush(part(open.strokes[0][0], a), 1.7 * HAND, 31) : '';
      if (b > 0) d += A.brush(part(open.strokes[1][0], b), 1.7 * HAND, 33);
      P.lids.setAttribute('d', d);
      P.iris.setAttribute('d', iris.slice(0, Math.round(iris.length * c)).join(''));
      P.pupil.setAttribute('d', pupil.slice(0, Math.round(pupil.length * Math.min(1, c * 1.6))).join(''));
      if (t < 1) requestAnimationFrame(f); else done();
    }
    requestAnimationFrame(f);
  }

  const eye = {
    el: host,
    start() {
      host.dataset.blink = 'drawing';
      drawIn(() => { drawn = true; render(); timer = setInterval(step, TICK); });
    },
    stop() { clearInterval(timer); timer = 0; },
    get drawn() { return drawn; },
    get state() { return { blink, gaze, frame, tick }; },
    /* what happened at the line: a hard cut, held for whole ticks */
    hit(kind) {
      if (kind === 'wrong') { blinkQ = [['closed', 9]]; blink = 'closed'; forced = { gaze: 'narrow', ticks: 14 }; nextBlink = hold(30, 0.5); }
      if (kind === 'right') { blinkQ = [['wide', 10]]; blink = 'wide'; forced = { gaze: 'dilated', ticks: 10 }; gaze = 'dilated'; }
      if (drawn) render();
    },
    pointer(x, y) { pointer = [x, y]; pointerAt = tick; },
    caret(x, y) { caret = [x, y]; },
    typed() { typedAt = tick; if (tick >= gazeUntil - 2) gazeUntil = tick; },
    on(f) { listeners.push(f); },
    /* every drawing the eye can show, for checks: the cuts never leave this set */
    drawings: D,
  };
  return eye;
}
