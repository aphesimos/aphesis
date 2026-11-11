/* entrances: the hidden ways to the gate, for the shell. Each one only dispatches
     window.dispatchEvent(new CustomEvent('aph:entrance', { detail: { via } }))
   which the shell answers by opening the gate (experimental's tenth door dispatches the same event, with via 'door').
   A wrong or partial attempt does nothing visible.

   - The ritual (via 'ritual'): three clicks or taps on the passage in the bottom-right corner (Enter or Space when it
     has the focus), each within 1.6 s of the last; its text stutters slightly at each, a hard cut of a pixel or two
     on the 8 fps tick, as a typist's hand slips. Within the next 12 s, hold the φ for 7 s (a pointer, a finger, or
     Enter held while the seal has the focus): a circle of stipple in the seal's own red, cells of 2 CSS pixels,
     grows from the seal on the tick until the whole screen is one red mist of its colour; the gate opens beneath it,
     and once it is in place the red goes the way the first ritual's did, in lines of dashes that thin out.
     Without the three clicks first, the seal is only the seal. Let go early and the cells fall back the way they
     rose, quicker and eased with minimum jerk, to nothing; holding again on the way down fills on from there.
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
    if (on) disarm = setTimeout(() => { if (!holding && !reversing) arm(false); }, armedUntil - performance.now());
  }
  const style = D.createElement('style');
  /* at home the seal takes no pointer; while the ritual is armed its whole box does, and only then */
  style.textContent = '#aph-seal{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;touch-action:manipulation}' +
    '.aph-ritual #aph-seal{pointer-events:auto}' +
    '#aph-ptext{position:relative}' +
    '#aph-fill{position:fixed;left:0;top:0;pointer-events:none;z-index:calc(var(--z-nav) + 1);image-rendering:pixelated}' +
    /* over the paint the cursor is the ground: the difference of the red would read cyan */
    '.aph-painting .aph-cursor{mix-blend-mode:normal;background:var(--bg)}';
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

  /* the hold: a circle of red stipple grows from the seal's centre over the whole screen, on one fixed canvas the
     size of the viewport (one canvas pixel per 2 CSS px cell, scaled up pixelated, so a phone draws a few tens of
     thousands of cells), above the inscription and below the tooltip and the cursor, taking no pointer. Every cell
     is the seal's own red, the --seal token as the browser renders it, so the φ melts into the field and the whole
     screen becomes one red mist of its colour; only the front, frayed, still reads as stipple.

     At the end of the hold the screen is all red and the gate opens beneath it: the shell clears the home, the
     inscription and the φ under the red and sets the gate in place. Once the gate is mounted and the seal has come
     to rest in its corner, the red goes as the first ritual's did: over 5 ticks a share of the cells goes at a
     time, chosen by the cell's index hashed (i * 2654435761 mod 997), which cuts the red into lines of dashes that
     thin out and are gone. */
  const HOLD = 7000, LET_GO = 5, C = 2, WAIT = 5000;
  /* level: how far the fill has risen, 0 to 1. It rises linearly while held; let go early, it falls back from where
     it was over 0.6 of the time it took to rise, eased with minimum jerk, the last cells to light the first to go */
  const BACK = 0.6;
  const MJ = (W.Aphesis && W.Aphesis.MJ) || ((t) => { t = Math.max(0, Math.min(1, t)); return t * t * t * (10 - 15 * t + 6 * t * t); });
  let holding = false, done = false, reversing = false, level = 0, last = 0, back = null, timer = 0, canvas = null, cells = null, swallowClick = false;
  let img = null, px = null, ctx2d = null, red = 0;
  /* after the hold: waiting for the gate beneath, then the red's exit */
  let doneAt = 0, lifting = false, still = 0, lastBox = '';
  /* the seal's red as one opaque packed pixel (the token is oklch: the browser resolves it) */
  function sealRGBA() {
    const c = D.createElement('canvas'); c.width = c.height = 1;
    /* a CPU canvas: reading a pixel back from a GPU one stalls the page for whole seconds on some devices */
    const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = getComputedStyle(D.documentElement).getPropertyValue('--seal').trim() || '#ab0d19';
    g.fillRect(0, 0, 1, 1);
    const [r, gg, b2] = g.getImageData(0, 0, 1, 1).data;
    return new Uint32Array(new Uint8ClampedArray([r, gg, b2, 255]).buffer)[0];
  }
  function start(e) {
    if (holding || done || !seal) return;
    /* a press while it falls back fills on from where it is */
    if (reversing) { if (e) e.preventDefault(); reversing = false; back = null; holding = true; last = performance.now(); return; }
    if (!armed()) return;
    if (e) e.preventDefault();
    holding = true; done = false; lifting = false; level = 0; last = performance.now();
    const w = Math.ceil(innerWidth / C), h = Math.ceil(innerHeight / C);
    canvas = D.createElement('canvas'); canvas.id = 'aph-fill'; canvas.width = w; canvas.height = h;
    canvas.style.cssText = 'left:0;top:0;width:' + w * C + 'px;height:' + h * C + 'px';
    canvas.setAttribute('aria-hidden', 'true');
    D.body.appendChild(canvas);
    /* a CPU canvas: a whole viewport of cells is redrawn each tick with putImageData, which a GPU canvas turns into
       a readback and an upload, a stall of seconds where the GPU is slow or emulated */
    ctx2d = canvas.getContext('2d', { willReadFrequently: true });
    img = ctx2d.createImageData(w, h);
    px = new Uint32Array(img.data.buffer);
    red = sealRGBA();
    D.body.classList.add('aph-painting');
    /* each cell lights when the circle reaches it: its distance from the seal's centre over the distance to the
       farthest corner, with a little scatter, so the front is frayed and behind it every cell is lit */
    const r = seal.getBoundingClientRect();
    const cx = (r.left + r.width / 2) / C, cy = (r.top + r.height / 2) / C;
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
    cells = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells[y * w + x] = Math.hypot(x - cx, y - cy) / far * 0.9 + Math.random() * 0.1;
    clearInterval(timer); timer = setInterval(frame, TICK);
    frame();
  }
  /* share: the cells whose moment has come; out: the share of them already gone, by the hashed index */
  function paint(share, out) {
    px.fill(0);
    for (let i = 0; i < cells.length; i++) if (cells[i] <= share && !(out && (i * 2654435761 % 997) / 997 < out)) px[i] = red;
    ctx2d.putImageData(img, 0, 0);
  }
  /* the gate is in place beneath the red: the shell has mounted it and the seal has stopped moving (two ticks
     still), or, whatever happens beneath, after WAIT */
  function settled() {
    const r = seal.getBoundingClientRect(), b = [r.left, r.top, r.width].map(Math.round).join();
    still = b === lastBox ? still + 1 : 0; lastBox = b;
    return (W.aphesis && W.aphesis.mounted === 'gate' && still >= 2) || performance.now() - doneAt > WAIT;
  }
  let letGo = 0;
  function frame() {
    if (!canvas) return;
    if (done) {
      if (!lifting) { if (!settled()) return; lifting = true; letGo = 0; }
      letGo++;
      paint(1, letGo / LET_GO);
      if (letGo >= LET_GO) end();
      return;
    }
    const now = performance.now();
    if (reversing) {
      level = back.from * (1 - MJ((now - back.t0) / back.dur));
      if (level <= 0.002 || now - back.t0 >= back.dur) { end(); return; }
    } else level = Math.min(1, level + (now - last) / HOLD);
    last = now;
    paint(level, 0);
    if (level >= 1 && !reversing) {
      /* every cell lit: the screen is red, and the gate opens beneath it */
      done = true; doneAt = now; still = 0; lastBox = ''; armedUntil = 0; arm(false); swallowClick = true; open('ritual');
    }
  }
  function end() { clearInterval(timer); timer = 0; holding = false; done = false; lifting = false; reversing = false; back = null; level = 0; if (!armed()) arm(false); if (canvas) canvas.remove(); canvas = null; cells = null; img = null; px = null; ctx2d = null; D.body.classList.remove('aph-painting'); }
  /* let go before the end: the fill falls back rather than vanishing */
  function cancel() {
    if (!holding || done) return;
    holding = false; reversing = true;
    back = { from: level, t0: performance.now(), dur: Math.max(250, level * HOLD * BACK) };
  }
  if (seal) {
    seal.addEventListener('pointerdown', (e) => { if ((armed() || reversing) && e.button === 0) { start(e); try { seal.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } } });
    /* a finger or pointer that wanders off the seal lets go */
    seal.addEventListener('pointermove', (e) => {
      if (!holding) return;
      const r = seal.getBoundingClientRect(), m = Math.max(16, r.width * 0.1);
      if (e.clientX < r.left - m || e.clientX > r.right + m || e.clientY < r.top - m || e.clientY > r.bottom + m) cancel();
    });
    seal.addEventListener('pointerup', cancel);
    seal.addEventListener('pointercancel', cancel);
    seal.addEventListener('lostpointercapture', cancel);
    seal.addEventListener('contextmenu', (e) => { if (holding || reversing || armed()) e.preventDefault(); });
    seal.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (armed() || reversing)) { e.preventDefault(); if (!e.repeat) start(); } else if (e.key === 'Enter' && holding) e.preventDefault(); });
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
