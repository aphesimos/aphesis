/* aphes.ist: the shell of the one page. One fog, one seal, one eye, one cursor, one tooltip and one passage live for
   the whole visit; the home is the shell itself, and each section is mounted into #aph-host when its route opens and
   unmounted when it closes. Entering or leaving a section is a hash change, never a page load.

   Routes. The home is '' or #home. A section owns its name and everything after it with '/' (or '-' for works):
     #book, #book/<slug>          #laboratory, #laboratory/<slug>      #forum, #forum/<id>[/<n>]
     #works, #works-<id>          #wall                                #experimental
     #archive, #archive/<slug>    (inside the archive script the post is still #<slug>: the shell translates)
   A bare archive slug (#how-the-fog-is-made, the archive's own links before the merge) is redirected to
   #archive/<slug>. Any other hash is the home.

   Mount and unmount. A section's script runs inside a sandbox: its window, document, location, history, timers,
   animation frames, observers and listeners are the shell's stand-ins, so the shell knows everything it started.
   Its runtime calls go to a scoped Aphesis: Fog hands back the shared fog (zones, set), seal, cursor and tooltip are
   the shell's own, Simulacrum and Typist are tracked. Leaving, the section's text dissolves piece by piece (each
   .aph-ink block and each mark on its own, as the sections enter, so no ancestor is ever faded or filtered) and its
   simulacra dissolve into the fog; then everything it started is stopped, its WebGL contexts are released and its
   markup removed. The next section mounts once the last one is gone, so only one section's stylesheet is ever live. */

/*__ENGINE__*/
const reduz = false;   /* the site always animates, whatever the system setting (owner's decision) */

const A = window.Aphesis;
const APH_SECTIONS = window.__aphSections; delete window.__aphSections;
const $ = (id) => document.getElementById(id);
const SECTIONS = /*__SECTIONSJS__*/;
const ROOT = document.documentElement;
const W = window, D = document;

/* ---------- WebGL contexts: who made each one, so a section's are released with it ---------- */
let OWNER = null;
const GL = [];
const getContext0 = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, o) {
  const c = getContext0.call(this, type, o);
  if (c && /webgl/.test(type) && !c.__aph) { c.__aph = 1; GL.push({ c, owner: OWNER, canvas: this }); }
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
$('aph-eye').addEventListener('click', () => {
  const e = $('aph-eye').getBoundingClientRect(), dark = isDark();
  A.themeShift(() => { ROOT.dataset.theme = dark ? 'light' : 'dark'; themeIcon(); }, { origin: [e.left + e.width / 2, e.top + e.height / 2] });
});

A.cursor();
A.tooltip();

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
const KEEP_CLASSES = ['aph-shifting', 'aph-still', 'aph-has-cursor', 'is-dark'];
function makeSandbox(name) {
  const X = xl(name);
  const ctx = { name, active: true, dead: false, timers: new Set(), intervals: new Set(), rafs: new Set(), listeners: [],
    observers: [], disposers: [], typists: [], cancels: [], sims: [], winProps: new Set(), zones: [], added: [] };
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
  const addL = (t) => function (type, fn, o) { if (!fn || ctx.dead) return; const w = wrap(fn); t.addEventListener(type, w, o); ctx.listeners.push([t, type, w, o]); };
  const remL = (t) => function (type, fn, o) { const w = fn && wrapped.get(fn); if (w) t.removeEventListener(type, w, o); };
  const sT = (fn, ms, ...a) => { if (ctx.dead) return 0; const id = setTimeout(() => { ctx.timers.delete(id); if (!ctx.dead && typeof fn === 'function') fn(...a); }, ms); ctx.timers.add(id); return id; };
  const cT = (id) => { clearTimeout(id); ctx.timers.delete(id); };
  const sI = (fn, ms, ...a) => { if (ctx.dead) return 0; const id = setInterval(() => { if (!ctx.dead) fn(...a); }, ms); ctx.intervals.add(id); return id; };
  const cI = (id) => { clearInterval(id); ctx.intervals.delete(id); };
  const rA = (fn) => { if (ctx.dead) return 0; const id = requestAnimationFrame((t) => { ctx.rafs.delete(id); if (!ctx.dead) fn(t); }); ctx.rafs.add(id); return id; };
  const cA = (id) => { cancelAnimationFrame(id); ctx.rafs.delete(id); };
  const mM = (q) => { const m = W.matchMedia(q); return { get matches() { return m.matches; }, media: m.media,
    addEventListener: addL(m), removeEventListener: remL(m), addListener: (f) => addL(m)('change', f), removeListener: (f) => remL(m)('change', f) }; };
  const obs = (C) => C && class extends C { constructor(cb, ...r) { super((...a) => { if (!ctx.dead) cb(...a); }, ...r); ctx.observers.push(this); } };
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
  /* the runtime adds window and theme listeners of its own when a field is made: record them, to remove them with the section */
  function capture(make) {
    const oA = Object.getOwnPropertyDescriptor(W, 'addEventListener'), oM = W.matchMedia, oMO = W.MutationObserver;
    W.addEventListener = function (t, f, o) { EventTarget.prototype.addEventListener.call(W, t, f, o); ctx.disposers.push(() => EventTarget.prototype.removeEventListener.call(W, t, f, o)); };
    W.matchMedia = function (q) { const m = oM.call(W, q); return { get matches() { return m.matches; }, media: m.media,
      addEventListener(t, f, o) { m.addEventListener(t, f, o); ctx.disposers.push(() => m.removeEventListener(t, f, o)); },
      removeEventListener(t, f, o) { m.removeEventListener(t, f, o); } }; };
    W.MutationObserver = class extends oMO { constructor(cb) { super(cb); const me = this; ctx.disposers.push(() => me.disconnect()); } };
    try { return make(); } finally {
      if (oA) Object.defineProperty(W, 'addEventListener', oA); else delete W.addEventListener;
      W.matchMedia = oM; W.MutationObserver = oMO;
    }
  }
  /* the scoped runtime */
  const SA = Object.create(A);
  SA.Fog = function (canvas, o) {
    const set = (k) => { if (!ctx.active || !k) return; if (k.density !== undefined) target.d = k.density; if (k.light !== undefined) target.l = k.light; };
    set(o || {});
    return {
      zones(list) { if (ctx.active) ctx.zones = (list || []).map((z) => (z instanceof Element ? { el: z } : z)).filter(Boolean); },
      set, stop() {}, start() {},
    };
  };
  SA.seal = () => ({ stop() {} });
  SA.cursor = () => {};
  SA.tooltip = () => {};
  SA.Simulacrum = Object.assign(function (canvas, o) {
    const s = capture(() => A.Simulacrum(canvas, o)); ctx.sims.push(s); return s;
  }, { fromBrush: A.Simulacrum.fromBrush });
  SA.Typist = function (el, caret) { const t = new A.Typist(el, caret); ctx.typists.push(t); return t; };
  SA.tween = (dur, fn, done) => { const c = A.tween(dur, (k) => { if (!ctx.dead) fn(k); }, done && (() => { if (!ctx.dead) done(); })); ctx.cancels.push(c); return c; };
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
    set(t, k, v) { if (!(k in t)) ctx.winProps.add(k); t[k] = v; return true; },
  });
  ctx.args = [winP, winP, winP, docP, loc, hist, winL, winR, rA, cA, sT, cT, sI, cI, mM, RO, MO, IO];
  return ctx;
}

/* ================= mount, leave, unmount ================= */
const host = $('aph-host');
let cur = null, leaving = null, pendingMount = null, mountTimer = 0;
const styleOf = (n) => document.querySelector('style[data-sec="' + n + '"]');
const tplOf = (n) => document.querySelector('template[data-sec="' + n + '"]');
/* nodes added to <html> or <body> while a section is mounted are its own (a note box, a measuring probe) */
const strays = new MutationObserver((list) => { const c = cur || leaving; if (!c) return;
  list.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n !== host && !n.id?.startsWith('aph-') && !n.classList.contains('aph-tip') && !n.classList.contains('aph-cursor')) c.added.push(n); })); });
strays.observe(document.body, { childList: true }); strays.observe(ROOT, { childList: true });

function mount(name) {
  const def = APH_SECTIONS[name]; if (!def) return;
  const ctx = makeSandbox(name);
  ctx.rootClasses = new Set(ROOT.classList);
  ctx.rootData = Object.keys(ROOT.dataset);
  cur = ctx;
  ROOT.dataset.sec = name;
  styleOf(name).media = 'all';
  host.removeAttribute('inert');
  host.dataset.sec = name;
  host.appendChild(tplOf(name).content.cloneNode(true));
  /* the section's links to its own routes point at the global hash */
  const X = xl(name);
  host.querySelectorAll('a[href^="#"]').forEach((a) => { const h = a.getAttribute('href'); if (h.length > 1) a.setAttribute('href', X.toGlobal(h)); });
  OWNER = ctx;
  try { def.run.apply(undefined, ctx.args); } catch (err) { console.error(err); }
  /* keyboard: if the section did not take the focus, its heading does */
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

/* the pieces that dissolve on their own: each .aph-ink block, and each subtree with no .aph-ink inside */
function pieces(el, out) {
  for (const c of el.children) {
    if (c.matches('.aph-ink') || !c.querySelector('.aph-ink')) out.push(c); else pieces(c, out);
  }
  return out;
}
function leave() {
  const ctx = cur; if (!ctx) return;
  cur = null; leaving = ctx; ctx.active = false;
  host.setAttribute('inert', '');
  ctx.sims.forEach((s) => { try { s.hide(); } catch (_) { /* already gone */ } });
  const list = pieces(host, []);
  list.forEach((el) => {
    if (!el.style) return;
    el.style.setProperty('transition', 'opacity .72s cubic-bezier(.2,.7,.2,1), filter .72s cubic-bezier(.2,.7,.2,1), translate .72s cubic-bezier(.2,.7,.2,1)', 'important');
  });
  requestAnimationFrame(() => list.forEach((el) => {
    if (!el.style) return;
    el.style.setProperty('opacity', '0', 'important');
    if (el.tagName !== 'CANVAS') { el.style.setProperty('filter', 'blur(10px)', 'important'); el.style.setProperty('translate', '0 14px', 'important'); }
  }));
  setTimeout(() => { destroy(ctx); if (leaving === ctx) leaving = null; tryMount(); }, 1000);
}
function destroy(ctx) {
  if (ctx.dead) return;
  ctx.dead = true; ctx.active = false;
  ctx.timers.forEach(clearTimeout); ctx.intervals.forEach(clearInterval); ctx.rafs.forEach(cancelAnimationFrame);
  ctx.listeners.forEach(([t, type, w, o]) => t.removeEventListener(type, w, o));
  ctx.observers.forEach((o) => { try { o.disconnect(); } catch (_) { /* fine */ } });
  ctx.disposers.forEach((f) => { try { f(); } catch (_) { /* fine */ } });
  ctx.typists.forEach((t) => t.stop());
  ctx.cancels.forEach((c) => { try { c(); } catch (_) { /* fine */ } });
  ctx.sims.forEach((s) => { try { s.stop(); } catch (_) { /* fine */ } });
  GL.forEach((g) => { if (g.owner === ctx && !g.c.isContextLost()) { const x = g.c.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } });
  for (let i = GL.length - 1; i >= 0; i--) if (GL[i].owner === ctx) GL.splice(i, 1);
  ctx.added.forEach((n) => n.remove());
  ctx.winProps.forEach((k) => { try { delete W[k]; } catch (_) { /* fine */ } });
  [...ROOT.classList].forEach((c) => { if (!ctx.rootClasses.has(c) && !KEEP_CLASSES.includes(c)) ROOT.classList.remove(c); });
  Object.keys(ROOT.dataset).forEach((k) => { if (!ctx.rootData.includes(k) && k !== 'theme' && k !== 'sec') delete ROOT.dataset[k]; });
  host.textContent = ''; delete host.dataset.sec;
  styleOf(ctx.name).media = 'not all';
  if (!cur) delete ROOT.dataset.sec;
  ctx.zones = [];
  if (OWNER === ctx) OWNER = null;
  scrollTo(0, 0);
}
function requestMount(name, delay) { pendingMount = name; clearTimeout(mountTimer); mountTimer = setTimeout(tryMount, delay); }
function tryMount() {
  if (leaving || !pendingMount) return;
  const n = pendingMount; pendingMount = null;
  if (route === n && !cur) mount(n);
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
  try { if (A.Sound && A.Sound.scene) A.Sound.scene(next || 'home'); } catch (err) { console.error(err); }
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
addEventListener('hashchange', () => goTo(readRoute()));
/* the seal always leads home, without relying on the hash */
$('aph-seal').addEventListener('click', (e) => { e.preventDefault(); if (route === '') return; try { history.pushState(null, '', '#home'); } catch (_) { /* fine */ } goTo(''); });
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
if (initial) { placeSeal(cornerBox()); u = 1; paint(estadoT(1)); target.d = 0.62; target.l = 0.4; goTo(initial, true); newPassage(); }
else {
  route = ''; placeSeal(centerBox());
  paint(drawState(0));
  setTimeout(() => { const dur = relPhi.seg / VEL * 1000;
    tween(dur, (k) => paint(drawState(k)), () => { paint({ ...BASE, ...posicao(0, ANC) }); $('aph-ring').classList.add('visible'); }); newPassage(); }, 700);
}
requestAnimationFrame(loop);
