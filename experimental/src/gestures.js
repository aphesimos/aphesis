/* gestures at the threshold. None is announced; each has a pointer, a touch and a keyboard path.

   circle   the pointer (or a finger) winds once around the threshold      arrow keys turned round in order
   hold     a press held still, or the pointer resting on the threshold    Enter or Space held on the threshold
   write    a quick scribble back and forth, like a line being written     a word typed, then Enter
   wait     nothing at all, for half a minute                              the same
   Typing a chamber's own word opens it too. */


export const WORDS = {
  ouroboros: ['ouroboros', 'serpent'],
  hands: ['adam', 'manus', 'hands'],
  scholar: ['lege', 'jerome', 'verbum'],
  tablet: ['hermes', 'tabula', 'smaragdina', 'emerald'],
};

const TAU = Math.PI * 2;
const HOLD_MS = 1600, REST_MS = 3200, REST_START = 700, WAIT_MS = 30000, WAIT_SHOW = 14000;
const ARROWS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

export function createGestures({ center, isFound, onEnter, onKnock, onEcho }) {
  let on = false;
  const st = {
    wind: 0, lastA: null, lastWind: 0,                     // circle
    holdT: 0, holdX: 0, holdY: 0, holdKey: false,          // hold
    restX: -1e4, restY: -1e4, restT: 0,                    // hover still on the threshold
    buf: '', bufT: 0,                                      // typing
    revs: [], dirX: 0, travel: 0, sumX: 0, sumY: 0,        // scribble
    lastInput: performance.now(), arrow: -1, arrowDir: 0,  // waiting, arrows
  };

  const input = () => { st.lastInput = performance.now(); };
  const enter = (id) => { if (!on) return; reset(); onEnter(id); };
  function reset() {
    st.wind = 0; st.lastA = null; st.holdT = 0; st.holdKey = false; st.restT = 0;
    st.buf = ''; st.revs = []; st.arrow = -1; onEcho('');
  }
  const goal = () => (isFound('ouroboros') ? 0.85 : 1) * TAU;

  /* ---- circle ---- */
  function wind(x, y) {
    const [cx, cy] = center(), dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), far = 0.5 * Math.min(innerWidth, innerHeight);
    if (r < 26 || r > Math.max(far, 160)) { st.lastA = null; return; }
    const a = Math.atan2(dy, dx);
    if (st.lastA !== null) {
      let da = a - st.lastA; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      if (st.wind && Math.sign(da) !== Math.sign(st.wind) && Math.abs(st.wind) > 0.6) st.wind = 0;
      st.wind += da; st.lastWind = performance.now();
      if (Math.abs(st.wind) >= goal()) enter('ouroboros');
    }
    st.lastA = a;
  }

  /* ---- scribble ---- */
  function scribble(dx, dy, now) {
    st.sumX += Math.abs(dx); st.sumY += Math.abs(dy);
    const d = Math.sign(dx);
    if (d && d !== st.dirX) {
      if (st.travel > 14) st.revs.push(now);
      st.dirX = d; st.travel = 0;
    }
    st.travel += Math.abs(dx);
    st.revs = st.revs.filter((t) => now - t < 2400);
    if (st.revs.length >= 5 && st.sumX > 2.5 * st.sumY) enter('scholar');
    st.sumX *= 0.96; st.sumY *= 0.96;
  }

  let px = null, py = null, pt = 0;
  addEventListener('pointermove', (e) => {
    input(); if (!on) return;
    const now = performance.now();
    if (now - pt > 250) px = py = null;   /* a hand that paused starts a new stroke */
    pt = now;
    if (e.pointerType === 'mouse' || st.holdT || e.buttons) {
      wind(e.clientX, e.clientY);
      if (px !== null) scribble(e.clientX - px, e.clientY - py, now);
    }
    px = e.clientX; py = e.clientY;
    if (st.holdT && Math.hypot(e.clientX - st.holdX, e.clientY - st.holdY) > 12) st.holdT = 0;
    if (Math.hypot(e.clientX - st.restX, e.clientY - st.restY) > 4) { st.restX = e.clientX; st.restY = e.clientY; st.restT = now; }
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    input(); if (!on) return;
    px = e.clientX; py = e.clientY; st.lastA = null;
    const t = e.target.closest && e.target.closest('a, button');
    if (t && t.id !== 'limen') return;
    st.holdT = performance.now(); st.holdX = e.clientX; st.holdY = e.clientY;
  });
  const release = () => { st.holdT = 0; px = py = null; };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  addEventListener('contextmenu', (e) => { if (on) e.preventDefault(); });

  /* ---- keys ---- */
  addEventListener('keydown', (e) => {
    input(); if (!on || e.ctrlKey || e.metaKey || e.altKey) return;
    const onLimen = document.activeElement && document.activeElement.id === 'limen';
    if (onLimen && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (!e.repeat && !st.holdKey) { st.holdKey = true; st.holdT = performance.now(); }
      return;
    }
    if (e.key in ARROWS) {
      e.preventDefault();
      const k = ARROWS[e.key], dir = st.arrow < 0 ? 0 : ((k - st.arrow + 4) % 4 === 1 ? 1 : (k - st.arrow + 4) % 4 === 3 ? -1 : 2);
      if (dir === 1 || dir === -1) {
        if (st.arrowDir && dir !== st.arrowDir) st.wind = 0;
        st.arrowDir = dir; st.wind += dir * TAU / 4; st.lastWind = performance.now();
      } else if (dir === 2) { st.wind = 0; st.arrowDir = 0; }
      st.arrow = k;
      if (Math.abs(st.wind) >= goal() - 1e-6) enter('ouroboros');
      return;
    }
    if (e.key === 'Backspace') { st.buf = st.buf.slice(0, -1); st.bufT = performance.now(); onEcho(st.buf); return; }
    if (e.key === 'Enter') {
      if (st.buf.length >= 3) enter(match(st.buf) || 'scholar');
      return;
    }
    if (e.key.length === 1 && /\p{L}/u.test(e.key)) {
      st.buf = (st.buf + e.key.toLowerCase()).slice(-24); st.bufT = performance.now(); onEcho(st.buf);
      const id = match(st.buf, true);
      if (id) setTimeout(() => enter(id), 380);
    }
  });
  addEventListener('keyup', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && st.holdKey) { st.holdKey = false; st.holdT = 0; }
  });
  function match(buf, suffix) {
    for (const id in WORDS) for (const w of WORDS[id]) if (suffix ? buf.endsWith(w) : buf === w) return id;
    return null;
  }

  /* ---- progress, read every frame by the threshold ---- */
  function progress(now) {
    if (!on) return { wind: 0, fill: 0 };
    if (st.wind && now - st.lastWind > 900) st.wind *= Math.exp(-(now - st.lastWind - 900) / 900 * 0.12);
    if (Math.abs(st.wind) < 0.02) st.wind = 0;
    if (st.buf && now - st.bufT > 3200) { st.buf = ''; onEcho(''); }
    let hold = 0;
    if (st.holdT) { hold = (now - st.holdT) / HOLD_MS; if (hold >= 1) { enter('hands'); return { wind: 0, fill: 0 }; } }
    let rest = 0;
    const [cx, cy] = center();
    if (Math.hypot(st.restX - cx, st.restY - cy) < 64 && st.restT && !st.holdT) {
      rest = (now - st.restT - REST_START) / REST_MS;
      if (rest >= 1) { enter('hands'); return { wind: 0, fill: 0 }; }
    }
    /* waiting counts even while motion is paused: stillness is the gesture */
    const idle = now - st.lastInput, wait = (idle - WAIT_SHOW) / (WAIT_MS - WAIT_SHOW);
    if (idle >= WAIT_MS && document.visibilityState === 'visible') { enter('tablet'); return { wind: 0, fill: 0 }; }
    return { wind: st.wind / goal(), fill: Math.max(0, Math.min(1, Math.max(hold, rest, wait))) };
  }

  document.addEventListener('visibilitychange', input);

  return {
    enable() { reset(); on = true; input(); },
    disable() { on = false; reset(); },
    knock() { onKnock && onKnock(); },
    progress,
  };
}
