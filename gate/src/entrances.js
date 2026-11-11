/* entrances: the hidden ways to the gate, for the shell. Each one only dispatches
     window.dispatchEvent(new CustomEvent('aph:entrance', { detail: { via } }))
   which the shell answers by opening the gate (experimental's tenth door dispatches the same event, with via 'door').
   A wrong or partial attempt does nothing visible.

   - The ritual (via 'ritual'): three clicks or taps on the passage in the bottom-right corner (Enter or Space when it
     has the focus), each within 1.6 s of the last; its text stutters slightly at each, a hard cut of a pixel or two
     on the 8 fps tick, as a typist's hand slips. Within the next 12 s, hold the φ for 7 s (a pointer, a finger, or
     Enter held while the seal has the focus): it fills with stipple, cells of 2 CSS pixels in the seal's red that
     rise inside the φ's own strokes and a thin halo around them on the tick, then lets go, and the gate opens.
     Without the three clicks first, the seal is only the seal. Let go early and the cells are gone at once.
   - A phrase typed anywhere (via 'phrase'): on a page with a keyboard, outside any field, the last characters typed
     are compared with the phrase's hash.
   - A secret route (via 'route'): the address's hash, compared with its hash on load and on every change; it is
     taken out of the address bar before the gate opens.

   The phrase and the route are never in the page: the build hashes them (PBKDF2-SHA256, a salt of its own, 60,000
   iterations) from APHESIS_GATE_PHRASE and APHESIS_GATE_ROUTE. Both are compared lowercased, spaces collapsed. The
   phrase's length is kept, so one hash is computed per key. Without them those two entrances do not exist. */

(function () {
  'use strict';
  const H = /*__ENTRANCES__*/null;
  const W = window, D = document, TICK = 125;
  const open = (via) => W.dispatchEvent(new CustomEvent('aph:entrance', { detail: { via } }));
  const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  const bytes = (hex) => new Uint8Array(hex.match(/../g).map((b) => parseInt(b, 16)));
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  async function hash(text) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(text), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(H.salt), iterations: H.iterations }, key, 256));
  }
  const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

  /* ---------- the ritual ---------- */
  const passage = D.getElementById('aph-passage'), ptext = D.getElementById('aph-ptext'), seal = D.getElementById('aph-seal');
  let clicks = [], armedUntil = 0;
  const armed = () => performance.now() < armedUntil;
  let disarm = 0;
  function arm(on) {
    clearTimeout(disarm);
    D.body.classList.toggle('aph-ritual', on);   /* on <body>: the shell keeps <html>'s classes per section */
    if (on) disarm = setTimeout(() => { if (!holding) arm(false); }, armedUntil - performance.now());
  }
  const style = D.createElement('style');
  /* at home the seal takes no pointer; while the ritual is armed its whole box does, and only then */
  style.textContent = '#aph-seal{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:manipulation}' +
    '.aph-ritual #aph-seal{pointer-events:auto}' +
    '#aph-ptext{position:relative}' +
    '#aph-fill{position:fixed;left:0;top:0;pointer-events:none;z-index:var(--z-seal);image-rendering:pixelated}';
  D.head.appendChild(style);

  /* a stutter: two or three hard offsets on the tick, then back; nothing slides */
  let stutterT = 0;
  function stutter() {
    if (!ptext) return;
    clearInterval(stutterT);
    const steps = [[1, 0], [-1, 1], [2, 0], [0, 0]].slice(Math.random() < 0.5 ? 1 : 0);
    let i = 0;
    const f = () => { const [x, y] = steps[i++] || [0, 0]; ptext.style.left = x + 'px'; ptext.style.top = y + 'px'; if (i >= steps.length) clearInterval(stutterT); };
    f(); stutterT = setInterval(f, TICK);
  }
  function knock() {
    const now = performance.now();
    if (clicks.length && now - clicks[clicks.length - 1] > 1600) clicks = [];
    clicks.push(now);
    stutter();
    if (clicks.length >= 3) { clicks = []; armedUntil = now + 12000; arm(true); }
  }
  if (passage) {
    if (!passage.hasAttribute('tabindex')) passage.tabIndex = 0;
    passage.addEventListener('click', knock);
    passage.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); knock(); } });
  }

  /* the hold: a canvas over the seal, one canvas pixel per cell */
  const HOLD = 7000, LET_GO = 5;
  let holding = false, done = false, t0 = 0, timer = 0, canvas = null, cells = null, swallowClick = false;
  function sealColor() { return getComputedStyle(D.documentElement).getPropertyValue('--seal').trim() || '#ab0d19'; }
  function start(e) {
    if (holding || !armed() || !seal) return;
    if (e) e.preventDefault();
    holding = true; done = false; t0 = performance.now();
    /* the φ fills with stipple: its own drawing (the seal's ink path, as it stands) is the density field, softened
       into a thin halo, on a square canvas around the seal's centre that holds the whole fill, one canvas pixel per
       2 CSS px cell. Nothing reaches past the halo, so the inscription around the seal stays clear. */
    const r = seal.getBoundingClientRect(), side = Math.max(r.width, r.height);
    const pad = Math.max(8, side * 0.06), C = 2;
    const n = Math.ceil((side + 2 * pad) / C), half = (n * C) / 2;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    canvas = D.createElement('canvas'); canvas.id = 'aph-fill'; canvas.width = canvas.height = n;
    canvas.style.left = (cx - half) + 'px'; canvas.style.top = (cy - half) + 'px';
    canvas.style.width = canvas.style.height = n * C + 'px';
    canvas.setAttribute('aria-hidden', 'true');
    D.body.appendChild(canvas);
    const field = D.createElement('canvas'); field.width = field.height = n;
    const f = field.getContext('2d', { willReadFrequently: true });
    const svg = seal.querySelector('svg'), ink = seal.querySelector('path');
    const vb = svg && svg.viewBox && svg.viewBox.baseVal;
    if (ink && vb && vb.width) {
      /* the svg fills the seal's box: map its viewBox onto the box, in cells */
      const k = Math.min(r.width / vb.width, r.height / vb.height) / C;
      const ox = (r.left - (cx - half)) / C + (r.width / C - vb.width * k) / 2, oy = (r.top - (cy - half)) / C + (r.height / C - vb.height * k) / 2;
      const P = new Path2D(ink.getAttribute('d') || '');
      f.setTransform(k, 0, 0, k, ox - vb.x * k, oy - vb.y * k);
      f.fillStyle = '#fff';
      f.filter = 'blur(' + Math.max(1.5, pad / C / 2.2).toFixed(1) + 'px)'; f.fill(P);   /* the halo */
      f.filter = 'none'; f.fill(P);                                                       /* the φ itself */
    }
    const dens = f.getImageData(0, 0, n, n).data;
    /* each cell lights at its own moment: the φ's own cells first, the halo's late and only some, never all */
    cells = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const v = dens[i * 4 + 3] / 255;
      cells[i] = v < 0.06 ? 9 : (1 - v) * 0.75 + Math.random() * 0.32 + (Math.random() < 0.1 ? 9 : 0);
    }
    clearInterval(timer); timer = setInterval(frame, TICK);
    frame();
  }
  function paint(share, gone) {
    const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = sealColor();
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] > share) continue;
      if (gone && (i * 2654435761 % 997) / 997 < gone) continue;
      g.fillRect(i % w, (i / w) | 0, 1, 1);
    }
  }
  let letGo = 0;
  function frame() {
    if (!canvas) return;
    if (done) {
      letGo++;
      paint(1, letGo / LET_GO);
      if (letGo >= LET_GO) { end(); open('ritual'); }
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / HOLD);
    paint(k * 1.05, 0);
    if (k >= 1) { done = true; letGo = 0; armedUntil = 0; arm(false); swallowClick = true; }
  }
  function end() { clearInterval(timer); timer = 0; holding = false; if (!armed()) arm(false); if (canvas) canvas.remove(); canvas = null; cells = null; }
  function cancel() { if (holding && !done) end(); }
  if (seal) {
    seal.addEventListener('pointerdown', (e) => { if (armed() && e.button === 0) { start(e); try { seal.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } } });
    seal.addEventListener('pointerup', cancel);
    seal.addEventListener('pointercancel', cancel);
    seal.addEventListener('lostpointercapture', cancel);
    seal.addEventListener('contextmenu', (e) => { if (holding || armed()) e.preventDefault(); });
    seal.addEventListener('keydown', (e) => { if (e.key === 'Enter' && armed()) { e.preventDefault(); if (!e.repeat) start(); } else if (e.key === 'Enter' && holding) e.preventDefault(); });
    seal.addEventListener('keyup', (e) => { if (e.key === 'Enter') cancel(); });
    seal.addEventListener('blur', cancel);
    /* the click that ends a hold does not also lead home, nor land on what the seal left beneath the pointer */
    /* a press that did not start on the seal clears it, in case the hold ended with no click at all (a finger) */
    W.addEventListener('pointerdown', (e) => { if (!seal.contains(e.target)) swallowClick = false; }, true);
    W.addEventListener('click', (e) => { if (swallowClick || (holding && seal.contains(e.target))) { swallowClick = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  }

  /* ---------- the phrase ---------- */
  if (H && H.phrase) {
    let buf = '', busy = false, again = false;
    const check = async () => {
      if (busy) { again = true; return; }
      busy = true;
      do {
        again = false;
        const tail = norm(buf).slice(-H.phrase.len);
        if (tail.length === H.phrase.len && same(await hash(tail), H.phrase.hash)) { buf = ''; open('phrase'); }
      } while (again);
      busy = false;
    };
    W.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
      if (e.key.length === 1) buf += e.key; else if (e.key === 'Backspace') buf = buf.slice(0, -1); else return;
      buf = buf.slice(-96);
      check();
    });
  }

  /* ---------- the route ---------- */
  if (H && H.route) {
    const look = async () => {
      let h = '';
      try { h = norm(decodeURIComponent(location.hash.replace(/^#/, ''))); } catch (_) { return; }
      if (h.length < 4 || h.length > 200) return;
      if (!same(await hash(h), H.route)) return;
      try { history.replaceState(null, '', location.pathname + location.search + '#home'); } catch (_) { /* fine */ }
      open('route');
    };
    W.addEventListener('hashchange', look);
    setTimeout(look, 0);
  }

  /* for checks: whether the ritual is armed, and which entrances this page has */
  Object.defineProperty(W, '__aphEntrances', { value: Object.freeze({ get armed() { return armed(); }, phrase: !!(H && H.phrase), route: !!(H && H.route) }) });
})();
