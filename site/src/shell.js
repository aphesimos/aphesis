/* aphes.ist: the shell of the one page. One fog, one seal, one eye, one cursor, one tooltip and one passage live for
   the whole visit; the home is the shell itself, and each section is mounted into #aph-host when its route opens and
   unmounted when it closes. Entering or leaving a section is a hash change, never a page load.

   Routes. The home is '' or #home. A section owns its name and everything after it with '/' (or '-' for works):
     #book, #book/<slug>          #laboratory, #laboratory/<slug>      #forum, #forum/<id>[/<n>]
     #works, #works-<id>          #wall                                #experimental
     #archive, #archive/<slug>    (inside the archive script the post is still #<slug>: the shell translates)
   A bare archive slug (#how-the-fog-is-made, the archive's own links before the merge) is redirected to
   #archive/<slug>. Any other hash is the home.

   Mount, rest and wake. A section's script runs once, inside a sandbox: its window, document, location, history,
   timers, animation frames, observers and listeners are the shell's stand-ins, so the shell knows everything it
   started. Its runtime calls go to a scoped Aphesis: Fog hands back the shared fog (zones, set), seal, cursor and
   tooltip are the shell's own, Simulacrum and Sound are guarded. Leaving, the section's text dissolves piece by
   piece (each .aph-ink block and each mark on its own, as the sections enter, so no ancestor is ever faded or
   filtered) and its simulacra dissolve into the fog; then it rests: its timers and frames are held, its listeners
   and observers taken off, its WebGL contexts given back and its markup set aside. Coming back wakes it where it was
   left. The next section enters once the last one rests, so only one section's stylesheet is ever live. */

/*__ENGINE__*/
const reduz = false;   /* the site always animates, whatever the system setting (owner's decision) */

const A = window.Aphesis;
const APH_SECTIONS = window.__aphSections; delete window.__aphSections;
const $ = (id) => document.getElementById(id);
const SECTIONS = /*__SECTIONSJS__*/;
const ROOT = document.documentElement;
const W = window, D = document;

/* ---------- WebGL contexts: who made each one, so a section's are released with it ---------- */
let OWNER = null, RUNTIME = false;   /* RUNTIME: a context the runtime makes, which rebuilds itself when it is given back */
const GL = [];
const getContext0 = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, o) {
  const c = getContext0.call(this, type, o);
  if (c && /webgl/.test(type) && !c.__aph) { c.__aph = 1; GL.push({ c, owner: OWNER, canvas: this, runtime: RUNTIME }); }
  return c;
};
const glAlive = () => GL.filter((g) => !g.c.isContextLost()).length;

/* ---------- stroke boil ---------- */
setInterval(() => $('aph-turb').setAttribute('seed', 1 + Math.floor(Math.random() * 997)), 125);

/* ---------- the fog: the runtime's, one for the whole page. density 1 and light 1 at home; a section sets its own ---------- */
const fog = A.Fog($('aph-fog'), { density: 0, light: 1 });
let dens = 0, light = 1;
const target = { d: 1, l: 1 };

/* ---------- the seal: φ is drawn; entering a section, it closes into Φ and moves to the corner ---------- */
const ANC = 'isolada';
const A1 = 0.618, B0 = 0.382;
function estadoT(u) { const te = lerp(T259, TFIN, MJ(u / A1)), p2 = MJ((u - B0) / (1 - B0)); return { te, r: 'onda', p2, sl: DELTA * p2, hs: NS_ - 1, ponta: 'atravessa', ...posicao(p2, ANC) }; }
const eixoPhi = eixoHaste.concat(eixoAnel(KFIM, 0)), relPhi = relogioCaneta(eixoPhi);
const VEL = 800;
function paint(st) { $('aph-ink').setAttribute('d', caminho(geometria(st))); }
function drawState(k) {
  const x = sDoTempo(relPhi, MJ(k)); const pos = posicao(0, ANC);
  if (x <= NS_ - 1) return { ...BASE, ...pos, te: TS - LT - 1, hs: x };
  const kk = x - (NS_ - 1), arc = relPhi.s[Math.floor(x)] - relPhi.s[NS_ - 1];
  return { ...BASE, ...pos, te: TH(0) + kk * ST, hs: NS_ - 1, penHaste: arc };
}
function centerBox() { const m = Math.min(innerWidth, innerHeight); const s = Math.min(m * (innerWidth < 640 ? 0.5 : 0.62), 620); return { x: innerWidth / 2 - s / 2, y: innerHeight / 2 - s / 2, s }; }
function cornerBox() { return { x: 18, y: 16, s: 64 }; }
let sealBox = { ...centerBox() }, u = 0;
function placeSeal(c) { sealBox = c; const e = $('aph-seal'); e.style.width = e.style.height = c.s.toFixed(2) + 'px'; e.style.transform = `translate(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px)`; }

/* ---------- the inscription ---------- */
const links = [...document.querySelectorAll('#aph-ring a')];
let spin = 0;
function placeInscription() {
  const c = centerBox(), cxp = c.x + c.s / 2, cyp = c.y + c.s / 2, R = c.s * 0.62;
  const n = links.length, wMax = Math.max(...links.map((a) => a.offsetWidth || 120));
  const emPe = innerHeight > innerWidth * 1.15;
  const Rx = Math.min(R * 1.18, innerWidth / 2 - 16 - wMax / 2), Ry = Math.min(R * 0.98 * (emPe ? 1.45 : 1), innerHeight / 2 - 70);
  links.forEach((a, i) => {
    const ang = spin - Math.PI / 2 + Math.PI / n + i * 2 * Math.PI / n;
    const x = cxp + Rx * Math.cos(ang), y = cyp + Ry * Math.sin(ang);
    a.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`; a._x = x; a._y = y;
  });
}
links.forEach((a) => { const name = a.firstChild; const w = document.createElement('span'); w.textContent = name.textContent; a.replaceChild(w, name); A.letters(w); });
links.forEach((a) => {
  const on = () => { if (a._x === undefined) return; $('aph-ring').classList.add('focus'); a.classList.add('on'); const l = $('aph-ray').querySelector('line'); const c = sealBox;
    l.setAttribute('x1', c.x + c.s / 2); l.setAttribute('y1', c.y + c.s / 2); l.setAttribute('x2', a._x); l.setAttribute('y2', a._y); l.style.opacity = 0.6; };
  const off = () => { $('aph-ring').classList.remove('focus'); a.classList.remove('on'); $('aph-ray').querySelector('line').style.opacity = 0; };
  a.addEventListener('pointerenter', on); a.addEventListener('focus', on); a.addEventListener('pointerleave', off); a.addEventListener('blur', off);
});

/* ---------- the passage: typed like a person would (the only typing on the site that is not a tooltip) ---------- */
const Typist = (function () {
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const NEAR = {}; ROWS.forEach((r, y) => [...r].forEach((c, x) => { const n = [];
    [[y, x - 1], [y, x + 1], [y - 1, x], [y - 1, x + 1], [y + 1, x], [y + 1, x - 1]].forEach(([yy, xx]) => { if (ROWS[yy] && ROWS[yy][xx]) n.push(ROWS[yy][xx]); }); NEAR[c] = n; }));
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const isLetter = (c) => /\p{L}/u.test(c);
  function wrongKey(c, pool) {
    const lo = c.toLowerCase();
    if (NEAR[lo]) { const n = NEAR[lo][Math.floor(Math.random() * NEAR[lo].length)]; return c === lo ? n : n.toUpperCase(); }
    const p = pool.filter((x) => isLetter(x) && x !== c); return p.length ? p[Math.floor(Math.random() * p.length)] : c;
  }
  function plan(text, pace) {
    const ch = [...text], ops = [], pool = ch; let rethought = false;
    const key = (c, prev) => { let d = pace * Math.exp(gauss() * 0.32);
      if (prev === ' ' || prev === undefined) d *= 1.3; if (c !== c.toLowerCase()) d += pace * 0.6;
      if (/[,;:]/.test(prev)) d += 140 + Math.random() * 180; if (/[.!?]/.test(prev)) d += 260 + Math.random() * 300;
      if (Math.random() < 0.03) d += 200 + Math.random() * 380;
      return d; };
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i], prev = ch[i - 1];
      if (!rethought && c === ' ' && i > ch.length / 3 && i < ch.length - 3 && Math.random() < 0.22) {
        rethought = true; let j = i - 1; while (j >= 0 && ch[j] !== ' ') j--; const word = ch.slice(j + 1, i);
        ops.push(['wait', '', 520 + Math.random() * 420]);
        word.forEach((_, k) => ops.push(['del', '', k === 0 ? 160 : 55 + Math.random() * 35]));
        ops.push(['wait', '', 260 + Math.random() * 300]);
        word.forEach((w, k) => ops.push(['add', w, key(w, k ? word[k - 1] : ' ') * 0.9]));
      }
      if (i > 0 && isLetter(c) && Math.random() < 0.045) {
        const extra = Math.random() < 0.55 ? Math.min(1 + Math.floor(Math.random() * 2), ch.length - 1 - i) : 0;
        ops.push(['add', wrongKey(c, pool), key(c, prev)]);
        for (let k = 1; k <= extra; k++) ops.push(['add', ch[i + k], key(ch[i + k], ch[i + k - 1]) * 0.85]);
        ops.push(['wait', '', 180 + Math.random() * 320]);
        for (let k = 0; k <= extra; k++) ops.push(['del', '', k === 0 ? 120 : 50 + Math.random() * 30]);
        ops.push(['add', c, pace * (1.1 + Math.random() * 0.5)]);
        for (let k = 1; k <= extra; k++) ops.push(['add', ch[i + k], key(ch[i + k], ch[i + k - 1])]);
        i += extra; continue;
      }
      ops.push(['add', c, key(c, prev)]);
    }
    return ops;
  }
  return class {
    constructor(el, caret) { this.el = el; this.caret = caret; this.t = null; this.buf = []; }
    stop() { clearTimeout(this.t); }
    _show() { this.el.textContent = this.buf.join(''); }
    type(text, done) {
      this.stop(); const ca = this.caret; this.buf = []; this._show(); ca.classList.remove('gone');
      const ops = plan(text, 44 + Math.random() * 26); let i = 0;
      ca.classList.add('blink');
      const step = () => {
        if (i >= ops.length) { ca.classList.add('blink'); done && done(); return; }
        const [a, c, d] = ops[i++];
        this.t = setTimeout(() => {
          if (a === 'add') this.buf.push(c); else if (a === 'del') this.buf.pop();
          if (a !== 'wait') { this._show(); ca.classList.remove('blink'); } else ca.classList.add('blink');
          step(); }, d);
      };
      this.t = setTimeout(() => { ca.classList.remove('blink'); step(); }, 900 + Math.random() * 700);
    }
    erase(done) {
      this.stop(); const ca = this.caret; let taps = 3 + Math.floor(Math.random() * 4), d = 150;
      const step = () => {
        if (!this.buf.length) { ca.classList.add('blink'); done && done(); return; }
        ca.classList.remove('blink');
        if (taps > 0) { this.buf.pop(); taps--; this._show(); d = Math.max(55, d * 0.78); this.t = setTimeout(step, d * Math.exp(gauss() * 0.15)); return; }
        while (this.buf.length && this.buf[this.buf.length - 1] === ' ') this.buf.pop();
        while (this.buf.length && this.buf[this.buf.length - 1] !== ' ') this.buf.pop();
        this._show(); this.t = setTimeout(step, 170 + Math.random() * 120);
      };
      this.t = setTimeout(step, 0);
    }
  };
})();
const PASSAGES = /*__PASSAGES__*/;
const typist = new Typist($('aph-ptext'), document.querySelector('#aph-passage .caret'));
let pIdx = -1, pLoop = null;
function pick() { let i; do { i = Math.floor(Math.random() * PASSAGES.length); } while (PASSAGES.length > 1 && i === pIdx); pIdx = i; return PASSAGES[i]; }
function newPassage() {
  clearTimeout(pLoop);
  const f = pick();
  $('aph-ptext').lang = f.l; $('aph-passage').dataset.tip = (f.t && f.t !== '—' ? f.t + '  — ' : '') + f.a;
  $('aph-psr').textContent = f.o + (f.t && f.t !== '—' ? ' (' + f.t + ')' : '') + ', ' + f.a;
  typist.type(f.o, () => {
    pLoop = setTimeout(() => typist.erase(() => { pLoop = setTimeout(newPassage, 900 + Math.random() * 900); }), 6500 + Math.random() * 3500);
  });
}

/* ---------- the eye: open in light, closed in dark; the switch is a blink, and the theme spreads as a wave from it ---------- */
const EYE = {
  open: A.brush(A.arc(12, 15.5, 9, -160, -20, 40, 7), 1.7, 31) + A.brush(A.arc(12, 8.5, 9, 20, 160, 40, 7), 1.7, 33),
  iris: A.stipple(A.inC(12, 12, 3.1), 36, 260, 0.95),
  closed: (() => { let d = A.brush(A.arc(12, 8, 9, 25, 155, 40, 6), 1.8, 37);
    [-0.55, 0, 0.55].forEach((k, i) => { const x = 12 + k * 9.5; d += A.brush(A.line(x, 14.2 + Math.abs(k) * -1.2, x + k * 1.8, 17.2 + Math.abs(k) * -1, 10), 1.2, 41 + i, 0.35, 0.05); }); return d; })(),
};
$('aph-iopen').setAttribute('d', EYE.open); $('aph-iris').setAttribute('d', EYE.iris); $('aph-iclosed').setAttribute('d', EYE.closed);
const sysDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (ROOT.dataset.theme ? ROOT.dataset.theme === 'dark' : sysDark.matches);
function themeIcon() {
  const dark = isDark(), O = $('aph-iopen'), I = $('aph-iris'), C = $('aph-iclosed');
  O.style.opacity = dark ? 0 : 1; O.style.transform = dark ? 'scaleY(.08)' : 'none';
  I.style.opacity = dark ? 0 : 1; I.style.transform = dark ? 'scaleY(.05)' : 'none';
  C.style.opacity = dark ? 1 : 0; C.style.transform = dark ? 'none' : 'scaleY(.2) translateY(-6px)';
  ROOT.classList.toggle('is-dark', dark);
  $('aph-eye').dataset.tip = dark ? 'closed · open the eye' : 'open · close the eye';
  $('aph-eye').setAttribute('aria-pressed', String(dark));
}
themeIcon(); sysDark.addEventListener('change', themeIcon);
/* the tab's icon: the eye, open while the page is seen, closed while it is not (hidden, or the window left).
   The same brush and stipple as the eye in the corner, with a heavier hand for 16 and 32 px: thicker strokes and an
   iris of a few large cells. Rubedo, the dark theme's where the browser is dark, on a transparent ground. */
const FAVICON = (() => {
  const red = /*__ICONRED__*/;
  const open = A.brush(A.arc(12, 15.6, 10, -158, -22, 40, 7.6), 2.1, 31) + A.brush(A.arc(12, 8.4, 10, 22, 158, 40, 7.6), 2.1, 33) +
    A.stipple(A.inC(12, 12, 2.9), 17, 150, 1.45);
  let closed = A.brush(A.arc(12, 8, 10, 25, 155, 40, 6.4), 2.3, 37);
  [-0.55, 0, 0.55].forEach((k, i) => { const x = 12 + k * 10.4; closed += A.brush(A.line(x, 14.4 - Math.abs(k) * 1.2, x + k * 2.2, 18.8 - Math.abs(k), 10), 1.7, 41 + i, 0.4, 0.05); });
  const svg = (d) => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 22 22"><style>path{fill:' + red.light +
    '}@media (prefers-color-scheme:dark){path{fill:' + red.dark + '}}</style><path d="' + d + '"/></svg>');
  return { open: svg(open), closed: svg(closed) };
})();
function favicon(seen) { const l = $('aph-favicon'), h = seen ? FAVICON.open : FAVICON.closed; if (l.getAttribute('href') !== h) l.setAttribute('href', h); }
favicon(!document.hidden);
document.addEventListener('visibilitychange', () => favicon(!document.hidden));
addEventListener('blur', () => favicon(false));
addEventListener('focus', () => favicon(!document.hidden));
$('aph-eye').addEventListener('click', () => {
  const e = $('aph-eye').getBoundingClientRect(), dark = isDark();
  A.themeShift(() => { ROOT.dataset.theme = dark ? 'light' : 'dark'; themeIcon(); }, { origin: [e.left + e.width / 2, e.top + e.height / 2] });
});

A.cursor();
A.tooltip();
/* the ear, beside the eye: it silences the sound and opens it again */
if (A.Sound) A.Sound.ear($('aph-ear')); else $('aph-ear').remove();

/* ================= routes ================= */
const NAMES = SECTIONS.map((s) => s.id);
const ARCHIVE_SLUGS = APH_SECTIONS.archive ? APH_SECTIONS.archive.slugs : [];
/* the section a global hash belongs to ('' for the home) */
function sectionOf(hash) {
  const h = decodeURIComponent((hash || '').replace(/^#/, ''));
  if (!h || h === 'home') return '';
  for (const n of NAMES) if (h === n || h.startsWith(n + '/') || (n === 'works' && h.startsWith('works-'))) return n;
  if (ARCHIVE_SLUGS.includes(h)) return 'archive';
  return '';
}
/* a section's own hashes as its script knows them, and back */
const norm = (h) => '#' + String(h == null ? '' : h).replace(/^#/, '');
const XLATE = {
  archive: {
    toLocal(g) { const h = norm(g); return h.startsWith('#archive/') ? '#' + h.slice(9) : h; },
    toGlobal(l) { const h = norm(l); if (h === '#') return '#archive'; return (h === '#archive' || h === '#home' || h.startsWith('#archive/')) ? h : '#archive/' + h.slice(1); },
  },
};
const IDENT = { toLocal: (g) => norm(g) === '#' ? '' : norm(g), toGlobal: (l) => norm(l) };
const xl = (name) => XLATE[name] || IDENT;

/* ================= the sandbox ================= */
/* A section's script runs once, on its first visit. Leaving, it goes dormant: its markup and anything it added to
   the page are detached, its timers and animation frames are held (with the time they had left), its listeners
   and observers are taken off, its simulacra stop and their WebGL contexts are given back to the browser. Coming
   back, all of it is put back as it was, so the section is where it was left: the same leaf, post, scroll. */
const KEEP_CLASSES = ['aph-shifting', 'aph-still', 'aph-has-cursor', 'is-dark'];
function makeSandbox(name) {
  const X = xl(name);
  const ctx = { name, active: true, dormant: false, timers: new Map(), intervals: new Map(), rafs: new Map(), listeners: [],
    observers: [], sims: [], zones: [], added: [] };
  let seq = 0;
  const wrapped = new WeakMap();
  function wrap(fn) {
    let w = wrapped.get(fn);
    if (!w) {
      w = function (e) {
        if (!ctx.active) return;
        if (e && (e.type === 'hashchange' || e.type === 'popstate') && sectionOf(location.hash) !== name) return;
        return typeof fn === 'function' ? fn.call(this, e) : fn.handleEvent(e);
      };
      wrapped.set(fn, w);
    }
    return w;
  }
  const same = (a, b) => !!(a && typeof a === 'object' ? a.capture : a) === !!(b && typeof b === 'object' ? b.capture : b);
  const addL = (t) => function (type, fn, o) {
    if (!fn) return; const w = wrap(fn);
    if (ctx.listeners.some((l) => l[0] === t && l[1] === type && l[2] === w && same(l[3], o))) return;
    ctx.listeners.push([t, type, w, o]); if (!ctx.dormant) t.addEventListener(type, w, o);
  };
  const remL = (t) => function (type, fn, o) {
    const w = fn && wrapped.get(fn); if (!w) return;
    t.removeEventListener(type, w, o);
    ctx.listeners = ctx.listeners.filter((l) => !(l[0] === t && l[1] === type && l[2] === w && same(l[3], o)));
  };
  /* timers keep their own ids, so a dormant section's pending timers can be held and set again later */
  function arm(e, ms) { e.due = performance.now() + ms; e.real = setTimeout(() => { ctx.timers.delete(e.id); if (typeof e.fn === 'function') e.fn(...e.a); }, ms); }
  const sT = (fn, ms, ...a) => { const e = { id: ++seq, fn, a, real: 0, due: 0, left: Math.max(0, +ms || 0) }; ctx.timers.set(e.id, e); if (!ctx.dormant) arm(e, e.left); return e.id; };
  const cT = (id) => { const e = ctx.timers.get(id); if (e) { clearTimeout(e.real); ctx.timers.delete(id); } };
  const sI = (fn, ms, ...a) => { const e = { id: ++seq, fn, a, ms, real: 0 }; ctx.intervals.set(e.id, e); if (!ctx.dormant) e.real = setInterval(() => fn(...a), ms); return e.id; };
  const cI = (id) => { const e = ctx.intervals.get(id); if (e) { clearInterval(e.real); ctx.intervals.delete(id); } };
  function frame(e) { e.real = requestAnimationFrame((t) => { ctx.rafs.delete(e.id); e.fn(t); }); }
  const rA = (fn) => { const e = { id: ++seq, fn, real: 0 }; ctx.rafs.set(e.id, e); if (!ctx.dormant) frame(e); return e.id; };
  const cA = (id) => { const e = ctx.rafs.get(id); if (e) { cancelAnimationFrame(e.real); ctx.rafs.delete(id); } };
  const mM = (q) => { const m = W.matchMedia(q); return { get matches() { return m.matches; }, media: m.media,
    addEventListener: addL(m), removeEventListener: remL(m), addListener: (f) => addL(m)('change', f), removeListener: (f) => remL(m)('change', f) }; };
  /* observers remember what they watch, so they can be disconnected while dormant and watch it again on return */
  const obs = (C) => C && class extends C {
    constructor(cb, ...r) { super((...a) => { if (!ctx.dormant) cb(...a); }, ...r); this.__base = C; this.__w = []; ctx.observers.push(this); }
    observe(t, o) { this.__w.push([t, o]); if (!ctx.dormant) super.observe(t, o); }
    unobserve(t) { this.__w = this.__w.filter((x) => x[0] !== t); super.unobserve(t); }
    disconnect() { this.__w = []; super.disconnect(); }
  };
  const RO = obs(W.ResizeObserver), MO = obs(W.MutationObserver), IO = obs(W.IntersectionObserver);
  const fix = (u) => (typeof u === 'string' && u.startsWith('#')) ? X.toGlobal(u) : u;
  const L = W.location, H = W.history;
  const loc = {
    get hash() { return X.toLocal(L.hash); }, set hash(v) { if (ctx.active) L.hash = X.toGlobal(v); },
    get href() { return L.href.replace(/#.*$/, '') + X.toLocal(L.hash); }, set href(v) { if (ctx.active) L.href = fix(v); },
    get origin() { return L.origin; }, get protocol() { return L.protocol; }, get host() { return L.host; }, get hostname() { return L.hostname; },
    get port() { return L.port; }, get pathname() { return L.pathname; }, get search() { return L.search; },
    assign(v) { if (ctx.active) L.assign(fix(v)); }, replace(v) { if (ctx.active) L.replace(fix(v)); }, reload() {}, toString() { return this.href; },
  };
  const hist = {
    pushState(s, t, v) { if (ctx.active) H.pushState(s, t, v == null ? v : fix(String(v))); },
    replaceState(s, t, v) { if (ctx.active) H.replaceState(s, t, v == null ? v : fix(String(v))); },
    back() { if (ctx.active) H.back(); }, forward() { if (ctx.active) H.forward(); }, go(n) { if (ctx.active) H.go(n); },
    get state() { return H.state; }, get length() { return H.length; },
    get scrollRestoration() { return H.scrollRestoration; }, set scrollRestoration(v) { H.scrollRestoration = v; },
  };
  /* the scoped runtime */
  const SA = Object.create(A);
  SA.Fog = function (canvas, o) {
    const set = (k) => { if (!ctx.active || !k) return; if (k.density !== undefined) target.d = k.density; if (k.light !== undefined) target.l = k.light; };
    set(o || {});
    return {
      zones(list) { if (ctx.active) ctx.zones = (list || []).map((z) => (z instanceof Element ? { el: z } : z)).filter(Boolean); },
      set, stop() {}, start() {}, destroy() {},
    };
  };
  SA.seal = () => ({ stop() {} });
  /* the sound: a section may change its own voice (experimental, per chamber) and mark moments, only while it is on
     screen; its last voice is kept, so coming back to it sounds where it was left */
  if (A.Sound) {
    SA.Sound = Object.create(A.Sound);
    SA.Sound.scene = (n, o) => { if (!ctx.active) return; ctx.scene = [n, o]; return A.Sound.scene(n, o); };
    SA.Sound.event = (k) => { if (ctx.active) return A.Sound.event(k); };
  }
  SA.cursor = () => {};
  SA.tooltip = () => {};
  /* a simulacrum, with what it was doing: running or rested, gathered or dissolved */
  SA.Simulacrum = Object.assign(function (canvas, o) {
    RUNTIME = true; let s; try { s = A.Simulacrum(canvas, o); } finally { RUNTIME = false; }
    const st = { s, running: true, want: !!(o && o.source) };
    ctx.sims.push(st);
    return {
      show(src, d) { st.want = true; s.show(src, d); }, hide(d) { st.want = false; s.hide(d); }, set(src, d) { st.want = true; s.set(src, d); },
      stop() { st.running = false; s.stop(); }, start() { st.running = true; s.start(); }, drawn: (cb) => s.drawn(cb),
      destroy() { st.running = false; st.want = false; s.destroy(); },
    };
  }, { fromBrush: A.Simulacrum.fromBrush });
  /* window and document as the section sees them */
  const bound = new Map();
  const bindTo = (t, k, v) => { let b = bound.get(k); if (!b || b.v !== v) { b = { v, f: v.bind(t) }; bound.set(k, b); } return b.f; };
  const docL = addL(D), docR = remL(D), winL = addL(W), winR = remL(W);
  const docP = new Proxy(D, {
    get(t, k) {
      if (k === 'addEventListener') return docL; if (k === 'removeEventListener') return docR;
      if (k === 'location') return loc; if (k === 'defaultView') return winP;
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? bindTo(t, 'd:' + String(k), v) : v;
    },
    set(t, k, v) { return Reflect.set(t, k, v); },
  });
  const OVER = { Aphesis: SA, document: docP, location: loc, history: hist, addEventListener: winL, removeEventListener: winR,
    requestAnimationFrame: rA, cancelAnimationFrame: cA, setTimeout: sT, clearTimeout: cT, setInterval: sI, clearInterval: cI,
    matchMedia: mM, ResizeObserver: RO, MutationObserver: MO, IntersectionObserver: IO };
  const winP = new Proxy(W, {
    get(t, k) {
      if (k === 'window' || k === 'self' || k === 'globalThis' || k === 'parent' || k === 'top') return winP;
      if (Object.prototype.hasOwnProperty.call(OVER, k)) return OVER[k];
      const d = Object.getOwnPropertyDescriptor(t, k);
      if (d && !d.configurable && !d.writable && 'value' in d) return d.value;
      const v = Reflect.get(t, k);
      return (typeof v === 'function' && typeof k === 'string' && !/^[A-Z]/.test(k)) ? bindTo(t, 'w:' + k, v) : v;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  ctx.args = [winP, winP, winP, docP, loc, hist, winL, winR, rA, cA, sT, cT, sI, cI, mM, RO, MO, IO];
  /* hold everything the section started, and put it back */
  ctx.hold = function () {
    ctx.dormant = true;
    const now = performance.now();
    ctx.timers.forEach((e) => { clearTimeout(e.real); e.left = Math.max(0, e.due - now); });
    ctx.intervals.forEach((e) => clearInterval(e.real));
    ctx.rafs.forEach((e) => cancelAnimationFrame(e.real));
    ctx.listeners.forEach(([t, type, w, o]) => t.removeEventListener(type, w, o));
    ctx.observers.forEach((o) => o.__base.prototype.disconnect.call(o));
  };
  ctx.release = function () {
    ctx.dormant = false;
    ctx.listeners.forEach(([t, type, w, o]) => t.addEventListener(type, w, o));
    ctx.observers.forEach((o) => o.__w.forEach(([t, opt]) => o.__base.prototype.observe.call(o, t, opt)));
    ctx.timers.forEach((e) => arm(e, e.left));
    ctx.intervals.forEach((e) => { e.real = setInterval(() => e.fn(...e.a), e.ms); });
    ctx.rafs.forEach(frame);
  };
  return ctx;
}

/* ================= mount, leave, return ================= */
const host = $('aph-host');
const DORMANT = {};          /* name -> a section that has been visited and is resting */
let cur = null, leaving = null, pendingMount = null, mountTimer = 0;
const styleOf = (n) => document.querySelector('style[data-sec="' + n + '"]');
const tplOf = (n) => document.querySelector('template[data-sec="' + n + '"]');
/* nodes added to <html> or <body> while a section is mounted are its own (a note box, a measuring probe) */
const strays = new MutationObserver((list) => { const c = cur || leaving; if (!c) return;
  list.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n !== host && !n.id?.startsWith('aph-') && !n.classList.contains('aph-tip') && !n.classList.contains('aph-cursor')) c.added.push([n, m.target]); })); });
strays.observe(document.body, { childList: true }); strays.observe(ROOT, { childList: true });

function focusIn(ctx) {
  const fromRing = $('aph-ring').contains(document.activeElement);
  setTimeout(() => {
    if (cur !== ctx || !fromRing) return;
    const a = document.activeElement;
    if (a && a !== document.body && !$('aph-ring').contains(a)) return;
    const usable = (el) => !el.closest('[inert],[hidden],[aria-hidden="true"]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    let h = [...host.querySelectorAll('h1[tabindex],h2[tabindex],main[tabindex]')].find(usable);
    if (!h) { h = [...host.querySelectorAll('h1')].find(usable); if (h) { h.tabIndex = -1; h.style.outline = 'none'; } }
    if (h) h.focus({ preventScroll: true });
  }, 1400);
}
function show(name) {
  ROOT.dataset.sec = name;
  styleOf(name).media = 'all';
  host.removeAttribute('inert');
  host.dataset.sec = name;
}
function enter(name) {
  if (DORMANT[name]) { wake(DORMANT[name]); return; }
  const def = APH_SECTIONS[name]; if (!def) return;
  const ctx = makeSandbox(name);
  ctx.rootClasses = new Set(ROOT.classList);
  ctx.rootData = Object.keys(ROOT.dataset);
  cur = ctx; DORMANT[name] = ctx;
  show(name);
  host.appendChild(tplOf(name).content.cloneNode(true));
  /* the section's links to its own routes point at the global hash */
  const X = xl(name);
  host.querySelectorAll('a[href^="#"]').forEach((a) => { const h = a.getAttribute('href'); if (h.length > 1) a.setAttribute('href', X.toGlobal(h)); });
  OWNER = ctx;
  try { APH_SECTIONS[name].run.apply(undefined, ctx.args); } catch (err) { console.error(err); }
  focusIn(ctx);
}

/* the pieces that dissolve on their own: each .aph-ink block, and each subtree with no .aph-ink inside */
const EASE = 'cubic-bezier(.2,.7,.2,1)', PROPS = ['transition', 'opacity', 'filter', 'translate'];
function pieces(el, out) {
  for (const c of el.children) {
    if (c.matches('.aph-ink') || !c.querySelector('.aph-ink')) out.push(c); else pieces(c, out);
  }
  return out;
}
function leave() {
  const ctx = cur; if (!ctx) return;
  cur = null; leaving = ctx; ctx.active = false;
  ctx.leftAt = sectionOf(prevHash) === ctx.name ? prevHash : '#' + ctx.name;
  host.setAttribute('inert', '');
  ctx.sims.forEach((st) => { st.wasShown = st.want; st.wasRunning = st.running; try { st.s.hide(); } catch (_) { /* gone */ } });
  ctx.pieces = pieces(host, []).map((el) => ({ el, was: PROPS.map((p) => [el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]) }));
  const dur = '.72s ' + EASE;
  ctx.pieces.forEach(({ el }) => el.style.setProperty('transition', `opacity ${dur}, filter ${dur}, translate ${dur}`, 'important'));
  requestAnimationFrame(() => ctx.pieces.forEach(({ el }) => {
    el.style.setProperty('opacity', '0', 'important');
    if (el.tagName !== 'CANVAS') { el.style.setProperty('filter', 'blur(10px)', 'important'); el.style.setProperty('translate', '0 14px', 'important'); }
  }));
  setTimeout(() => { rest(ctx); if (leaving === ctx) leaving = null; tryMount(); }, 1000);
}
/* dormant: nothing of the section runs, draws or shows; it keeps its state */
function rest(ctx) {
  if (ctx.dormant) return;
  ctx.hold();
  ctx.sims.forEach((st) => st.s.stop());
  GL.forEach((g) => { if (g.owner === ctx && !g.c.isContextLost()) { g.ext = g.c.getExtension('WEBGL_lose_context'); if (g.ext) { g.ext.loseContext(); g.held = true; } } });
  /* scroll positions are lost when the markup leaves the page: keep them */
  ctx.scrolls = [...host.querySelectorAll('*')].filter((el) => el.scrollTop || el.scrollLeft).map((el) => [el, el.scrollTop, el.scrollLeft]);
  ctx.pageScroll = [scrollX, scrollY];
  ctx.title = document.title;
  ctx.frag = document.createDocumentFragment();
  while (host.firstChild) ctx.frag.appendChild(host.firstChild);
  ctx.added.forEach(([n]) => n.remove());
  ctx.rootSaved = { classes: [...ROOT.classList].filter((c) => !ctx.rootClasses.has(c) && !KEEP_CLASSES.includes(c)), data: {} };
  ctx.rootSaved.classes.forEach((c) => ROOT.classList.remove(c));
  Object.keys(ROOT.dataset).forEach((k) => { if (!ctx.rootData.includes(k) && k !== 'theme' && k !== 'sec') { ctx.rootSaved.data[k] = ROOT.dataset[k]; delete ROOT.dataset[k]; } });
  delete host.dataset.sec;
  styleOf(ctx.name).media = 'not all';
  if (!cur) delete ROOT.dataset.sec;
  if (OWNER === ctx) OWNER = null;
  scrollTo(0, 0);
}
/* back from rest: everything put back as it was, then the pieces condense in */
function wake(ctx) {
  cur = ctx; OWNER = ctx;
  show(ctx.name);
  ctx.rootSaved.classes.forEach((c) => ROOT.classList.add(c));
  Object.entries(ctx.rootSaved.data).forEach(([k, v]) => { ROOT.dataset[k] = v; });
  host.appendChild(ctx.frag); ctx.frag = null;
  ctx.added.forEach(([n, p]) => p.appendChild(n));
  ctx.scrolls.forEach(([el, t, l]) => { el.scrollTop = t; el.scrollLeft = l; });
  scrollTo(ctx.pageScroll[0], ctx.pageScroll[1]);
  if (ctx.title) document.title = ctx.title;
  ctx.release();
  ctx.active = true;
  /* WebGL: the runtime's fields rebuild themselves when their context comes back; a context the section drew on
     by itself does not, so that section is routed to where it was again and redraws */
  let redraw = false;
  GL.forEach((g) => { if (g.owner === ctx && g.held) { g.held = false; if (g.c.canvas && g.c.canvas.isConnected) { g.ext.restoreContext(); if (!g.runtime) redraw = true; } } });
  ctx.sims.forEach((st) => { if (st.wasRunning || st.wasShown) st.s.start(); if (st.wasShown) st.s.show(); });
  requestAnimationFrame(() => {
    ctx.pieces.forEach(({ el, was }) => PROPS.slice(1).forEach((p, i) => { const [v, pr] = was[i + 1]; if (v) el.style.setProperty(p, v, pr); else el.style.removeProperty(p); }));
    setTimeout(() => { if (cur !== ctx) return; ctx.pieces.forEach(({ el, was }) => { const [v, pr] = was[0]; if (v) el.style.setProperty('transition', v, pr); else el.style.removeProperty('transition'); }); }, 900);
  });
  /* a different sub-route in the address than the one left: the section follows it */
  /* coming back by the section's own name lands where it was left; a sub-route in the address is followed */
  if (location.hash === '#' + ctx.name && ctx.leftAt !== location.hash) { try { history.replaceState(null, '', ctx.leftAt); } catch (_) { /* fine */ } }
  const here = location.hash;
  if (redraw) { const back = here; try { history.replaceState(null, '', '#' + ctx.name); } catch (_) { /* fine */ } dispatchEvent(new HashChangeEvent('hashchange'));
    try { history.replaceState(null, '', back); } catch (_) { /* fine */ } dispatchEvent(new HashChangeEvent('hashchange')); }
  else if (here !== ctx.leftAt) dispatchEvent(new HashChangeEvent('hashchange'));
  dispatchEvent(new Event('resize'));
  focusIn(ctx);
}
function requestMount(name, delay) { pendingMount = name; clearTimeout(mountTimer); mountTimer = setTimeout(tryMount, delay); }
function tryMount() {
  if (leaving || !pendingMount) return;
  const n = pendingMount; pendingMount = null;
  if (route === n && !cur) enter(n);
}

/* ---------- calm zones behind text: the shell's marks and the mounted section's blocks, twelve at most ---------- */
const ZB = [];
function rectOf(z) {
  const r = z.el ? z.el.getBoundingClientRect() : z;
  return r && r.width ? { left: r.left, top: r.top, width: r.width, height: r.height, pad: z.pad || 12 } : null;
}
function zones() {
  ZB.length = 0;
  const add = (el, pad) => { if (!el) return; const r = el.getBoundingClientRect(); if (!r.width || +getComputedStyle(el).opacity < 0.05) return; ZB.push({ left: r.left, top: r.top, width: r.width, height: r.height, pad }); };
  if (route === '') links.forEach((a) => add(a, 10)); else add($('aph-seal'), 10);
  add($('aph-passage'), 14); add($('aph-controls'), 8);
  const c = cur || leaving;
  if (c) for (const z of c.zones) { if (ZB.length >= 12) break; const r = rectOf(z); if (r) ZB.push(r); }
  return ZB.slice(0, 12);
}

/* ---------- moving between the home and the sections ---------- */
let route = null, raf = null;
function tween(dur, fn, fim) { cancelAnimationFrame(raf); let t0 = null; const q = (now) => { if (t0 === null) t0 = now; const k = clamp((now - t0) / Math.max(1, dur)); fn(k); if (k < 1) raf = requestAnimationFrame(q); else fim && fim(); }; raf = requestAnimationFrame(q); }
function goTo(next, first) {
  if (next === route) return;
  const prev = route; route = next;
  const ring = $('aph-ring');
  /* the ambient sound crossfades per screen, where the runtime has it */
  try { if (A.Sound) { const d = next && DORMANT[next]; if (d && d.scene) A.Sound.scene(d.scene[0], d.scene[1]); else A.Sound.scene(next || 'home'); } } catch (err) { console.error(err); }
  $('aph-seal').classList.toggle('in-corner', next !== '');
  if (cur) leave();
  if (next === '') {
    target.d = 1; target.l = 1;
    clearTimeout(mountTimer); pendingMount = null;
    document.title = 'aphes.ist'; $('aph-announce').textContent = 'home';
    const de = { ...sealBox }, para = centerBox(), u0 = u;
    tween(first ? 1 : 1600, (k) => { const e = MJ(k); placeSeal({ x: lerp(de.x, para.x, e), y: lerp(de.y, para.y, e), s: lerp(de.s, para.s, e) }); u = lerp(u0, 0, k); paint(estadoT(u)); },
      () => {
        ring.classList.add('visible');
        const a = document.activeElement;
        if (prev && (!a || a === document.body)) { const l = links.find((x) => x.getAttribute('href') === '#' + prev); if (l) l.focus({ preventScroll: true }); }
      });
  } else {
    const sec = SECTIONS.find((s) => s.id === next); document.title = sec.name + ' · aphes.ist'; $('aph-announce').textContent = sec.name;
    ring.classList.remove('visible', 'focus'); $('aph-ray').querySelector('line').style.opacity = 0;
    if (prev === '' || prev === null) {
      const de = { ...sealBox }, para = cornerBox(), u0 = u;
      tween(first ? 1 : 1800, (k) => { const e = MJ(k); placeSeal({ x: lerp(de.x, para.x, e), y: lerp(de.y, para.y, e), s: lerp(de.s, para.s, e) }); u = lerp(u0, 1, k); paint(estadoT(u)); });
    }
    requestMount(next, first ? 0 : (prev === '' ? 700 : 0));
  }
}
function readRoute() {
  const s = sectionOf(location.hash);
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (s === 'archive' && ARCHIVE_SLUGS.includes(h)) { try { history.replaceState(null, '', '#archive/' + h); } catch (_) { /* a sandbox may refuse */ } }
  return s;
}
let prevHash = location.hash;   /* the address just before a route change: where a leaving section was */
addEventListener('hashchange', (e) => { try { prevHash = new URL(e.oldURL).hash; } catch (_) { prevHash = ''; } goTo(readRoute()); });
/* the seal always leads home, without relying on the hash */
$('aph-seal').addEventListener('click', (e) => { e.preventDefault(); if (route === '') return; prevHash = location.hash; try { history.pushState(null, '', '#home'); } catch (_) { /* fine */ } goTo(''); });
/* a section link written as a local hash (made after the mount) is sent to the section's global hash */
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || !cur || e.button) return;
  const a = e.target.closest && e.target.closest('#aph-host a[href^="#"]'); if (!a) return;
  const h = a.getAttribute('href'), g = xl(cur.name).toGlobal(h);
  if (h.length > 1 && g !== h) { e.preventDefault(); location.hash = g; }
});
/* Escape goes up: from a section's own page to its index, from an index to the home (when the section did not use it) */
const INDEX = { works: '#works', archive: '#archive', laboratory: '#laboratory', forum: '#forum' };
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !route || !cur) return;
  const t = e.target, open = !!host.querySelector('[aria-expanded="true"]'), name = cur.name;
  setTimeout(() => {
    if (e.defaultPrevented || open || route !== name) return;
    if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
    const idx = INDEX[name], h = location.hash;
    if (idx && h !== idx && h !== '#' + name) location.hash = idx.slice(1); else location.hash = 'home';
  }, 0);
});

/* ---------- the loop: fog, zones, the inscription's slow turn ---------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  dens += (target.d - dens) * Math.min(1, dt * 1.5);
  light += (target.l - light) * Math.min(1, dt * 1.5);
  fog.set({ density: dens, light });
  fog.zones(zones());
  if (route === '' && !$('aph-ring').classList.contains('focus')) spin += dt * 0.012;
  placeInscription();
  requestAnimationFrame(loop);
}

/* for checks: the route and the WebGL contexts alive */
Object.defineProperty(window, 'aphesis', { value: Object.freeze({ get route() { return route; }, get mounted() { return cur && cur.name; }, gl: glAlive }) });

/* ---------- opening ---------- */
addEventListener('resize', () => { if (route === '') placeSeal(centerBox()); else placeSeal(cornerBox()); });
const initial = readRoute();
/* the sound creeps in under the φ as it is drawn (or starts on the first gesture, where the browser waits for one) */
try { if (A.Sound) A.Sound.start({ fade: Math.round(relPhi.seg / VEL * 1000) + 700, scene: initial || 'home' }); } catch (err) { console.error(err); }
if (initial) { placeSeal(cornerBox()); u = 1; paint(estadoT(1)); target.d = 0.62; target.l = 0.4; goTo(initial, true); newPassage(); }
else {
  route = ''; placeSeal(centerBox());
  paint(drawState(0));
  setTimeout(() => { const dur = relPhi.seg / VEL * 1000;
    tween(dur, (k) => paint(drawState(k)), () => { paint({ ...BASE, ...posicao(0, ANC) }); $('aph-ring').classList.add('visible'); }); newPassage(); }, 700);
}
requestAnimationFrame(loop);
