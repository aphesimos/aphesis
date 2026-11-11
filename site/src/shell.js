/* aphes.ist: the shell of the one page. One fog, one seal, one eye, one cursor, one tooltip and one passage live for
   the whole visit; the home is the shell itself, and each section is mounted into #aph-host when its route opens and
   unmounted when it closes. Entering or leaving a section is a hash change, never a page load.

   Routes. The home is '' or #home. A section owns its name and everything after it with '/' (or '-' for works):
     #book, #book/<slug>          #laboratory, #laboratory/<slug>      #forum, #forum/<id>[/<n>]
     #works, #works-<id>          #wall                                #descent (the old #experimental redirects)
     #music, #music/folders/…, #music/artists/…, #music/albums/<artist>/<album>
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
setInterval(() => { if (!document.hidden) $('aph-turb').setAttribute('seed', 1 + Math.floor(Math.random() * 997)); }, 125);

/* ---------- the fog: the runtime's, one for the whole page. density 1 and light 1 at home; a section sets its own ---------- */
const fog = A.Fog($('aph-fog'), { density: 0, light: 1 });
let dens = 0, light = 1;
const target = { d: 1, l: 1 };
/* density and light travel to their targets in minimum-jerk segments of 1.8 s: a new target starts a new segment
   from wherever the value is, so nothing in the fog ever changes in one frame */
function mover(v, ms) {
  let from = v, to = v, t = 1, cur = v;
  return { at(target, dt) { if (Math.abs(target - to) > 1e-4) { from = cur; to = target; t = 0; } t = Math.min(1, t + dt * 1000 / ms); cur = from + (to - from) * MJ(t); return cur; } };
}
const densM = mover(0, 1800), lightM = mover(1, 1800);

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
/* the corner keeps clear of a notch and the rounded corners: the safe-area insets, read from a probe that carries them */
function safeArea() { const cs = getComputedStyle($('aph-safe')); return { t: parseFloat(cs.paddingTop) || 0, l: parseFloat(cs.paddingLeft) || 0 }; }
function cornerBox() { const sa = safeArea(); return { x: 18 + sa.l, y: 16 + sa.t, s: 64 }; }
let sealBox = { ...centerBox() }, u = 0;
function placeSeal(c) { sealBox = c; const e = $('aph-seal'); e.style.width = e.style.height = c.s.toFixed(2) + 'px'; e.style.transform = `translate(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px)`; }

/* ---------- the site's texts ----------
   The short lines the owner changes from the desk (the home's line for each section, the ledes, the helper lines,
   the empty states) come from the content service's /v1/texts, which answers only the keys that were changed. The
   page always carries its own strings and keeps them when the service is absent, slow or silent.
   - markup names its key: data-text (the words), data-text-tip (the tooltip), data-text-placeholder;
   - a section's script asks Aphesis.text(key, its own string), through its scoped runtime.
   A section is first mounted only once the texts have answered (or after TEXTS_WAIT), and the texts are written
   into its markup before it enters the page, so no line is ever seen changing. */
const CONTENT_API = /*__CONTENTAPI__*/;
const TEXTS = Object.create(null), TEXTS_WAIT = 1200;
let textsSettled = !CONTENT_API;
const textsQueue = [];
const text = (key, own) => (key in TEXTS ? TEXTS[key] : own);
function applyTexts(root) {
  root.querySelectorAll('[data-text],[data-text-tip],[data-text-placeholder]').forEach((el) => {
    const d = el.dataset;
    if (d.text && d.text in TEXTS && el.textContent !== TEXTS[d.text]) el.textContent = TEXTS[d.text];
    if (d.textTip && d.textTip in TEXTS) d.tip = TEXTS[d.textTip];
    if (d.textPlaceholder && d.textPlaceholder in TEXTS) el.placeholder = TEXTS[d.textPlaceholder];
  });
}
function settleTexts() { if (textsSettled) return; textsSettled = true; textsQueue.splice(0).forEach((f) => f()); }
if (CONTENT_API) {
  const late = setTimeout(settleTexts, TEXTS_WAIT);
  fetch(CONTENT_API + '/v1/texts', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((doc) => {
      const t = doc && doc.texts;
      if (t && typeof t === 'object') for (const k of Object.keys(t)) if (typeof t[k] === 'string' && t[k]) TEXTS[k] = t[k];
      /* the home's lines are tooltips, never on screen until asked for: they take the texts whenever they come */
      applyTexts($('aph-ring'));
    })
    .catch(() => { /* the page's own strings stay */ })
    .finally(() => { clearTimeout(late); settleTexts(); });
}

/* ---------- the inscription ---------- */
const links = [...document.querySelectorAll('#aph-ring a')];
let spin = 0;
/* the names sit on an ellipse around the center, spaced evenly along its length rather than by angle: on a wide
   screen the ellipse is nearly a circle and the two are alike; on a tall, narrow one the names keep their distance
   where the ellipse turns tightly at the top and bottom. Each is pushed out along its own direction until it clears
   the φ, then held inside the screen. Sizes are measured once (again on resize, when the fonts arrive or the ring
   changes between names and icons), and nothing is written when nothing moved: inside a section the ring rests. */
const ARC = new Float64Array(257), GAP = 12;
let sizes = null, placed = '', measured = false;
addEventListener('resize', () => { measured = false; });
if (document.fonts) document.fonts.ready.then(() => { measured = false; });
function glyphBox(c) { return { l: c.x + 0.20 * c.s - GAP, r: c.x + 0.80 * c.s + GAP, t: c.y + 0.124 * c.s - GAP, b: c.y + 0.959 * c.s + GAP }; }
const hit = (g, x, y, w, h) => x + w / 2 > g.l && x - w / 2 < g.r && y + h / 2 > g.t && y - h / 2 < g.b;
function placeInscription() {
  if (!measured) { sizes = links.map((a) => ({ w: a.offsetWidth || 120, h: a.offsetHeight || 40, pw: (a.querySelector('.tx').offsetWidth || 0) })); measured = true; placed = ''; }
  const at = spin + ' ' + innerWidth + ' ' + innerHeight; if (at === placed) return; placed = at;
  const c = centerBox(), cxp = c.x + c.s / 2, cyp = c.y + c.s / 2, R = c.s * 0.62, g = glyphBox(c);
  const n = links.length, wMin = Math.min(...sizes.map((z) => z.w));
  const emPe = innerHeight > innerWidth * 1.15;
  /* the ellipse is as wide as the narrowest name allows; a wider name is held inside the screen on its own */
  const Rx = Math.min(R * 1.18, innerWidth / 2 - 16 - wMin / 2), Ry = Math.min(R * 0.98 * (emPe ? 1.9 : 1), innerHeight / 2 - 70);
  const pt = (t) => [Rx * Math.cos(t), Ry * Math.sin(t)];
  ARC[0] = 0; for (let k = 1; k <= 256; k++) { const p0 = pt((k - 1) / 256 * 2 * Math.PI), p1 = pt(k / 256 * 2 * Math.PI); ARC[k] = ARC[k - 1] + Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); }
  const L = ARC[256], ang = (s) => { s = ((s % L) + L) % L; let lo = 0, hi = 256; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ARC[m] <= s) lo = m; else hi = m; } return (lo + (s - ARC[lo]) / (ARC[hi] - ARC[lo])) / 256 * 2 * Math.PI; };
  const s0 = L * 0.75;   /* the top of the ellipse (angle -90°) */
  links.forEach((a, i) => {
    const t = ang(s0 + L * ((spin / (2 * Math.PI)) + (0.5 + i) / n)), z = sizes[i];
    let ox = Rx * Math.cos(t), oy = Ry * Math.sin(t);
    for (let k = 0; k < 40 && hit(g, cxp + ox, cyp + oy, z.w, z.h); k++) { ox *= 1.04; oy *= 1.04; }
    const x = Math.max(16 + z.w / 2, Math.min(innerWidth - 16 - z.w / 2, cxp + ox)), y = Math.max(16 + z.h / 2, Math.min(innerHeight - 56, cyp + oy));
    const tr = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
    if (a._tr !== tr) { a.style.transform = tr; a._tr = tr; }
    a._x = x; a._y = y;
    /* on a phone the name shows beside its icon, on the side away from the screen's edge */
    const left = x > innerWidth / 2; if (a._left !== left) { a.classList.toggle('left', left); a._left = left; }
  });
}
/* each name carries its section's icon (the design system's, drawn with the brush): beside the name on a wide
   screen, in place of it on a phone. The icon is decorative (the link is named by its words); it stirs with the
   letter wave on hover and focus (.aph-icon) and gathers (.aph-gather) as the section is chosen. */
links.forEach((a) => {
  const name = a.firstChild, w = document.createElement('span'); w.className = 'nm'; w.textContent = name.textContent;
  const tx = document.createElement('span'); tx.className = 'tx'; a.replaceChild(tx, name); tx.appendChild(w); tx.appendChild(a.querySelector('.gl')); A.letters(w);
  const ic = document.createElement('span'); ic.className = 'ico'; ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = A.icon(a.getAttribute('href').slice(1));
  a.insertBefore(ic, tx); a.classList.add('aph-icon');
});
const ring = $('aph-ring');
/* a phone: narrow, or a small touch screen in landscape; there the ring is icons, and a name shows on the first tap */
const phoneQ = matchMedia('(max-width: 600px), (pointer: coarse) and (max-height: 600px)');
function phoneMode() { ring.classList.toggle('phone', phoneQ.matches); if (!phoneQ.matches) unname(); measured = false; }
let named = null;
function ray(a, show) {
  const l = $('aph-ray').querySelector('line');
  if (!show) { l.style.opacity = 0; return; }
  const c = sealBox; l.setAttribute('x1', c.x + c.s / 2); l.setAttribute('y1', c.y + c.s / 2); l.setAttribute('x2', a._x); l.setAttribute('y2', a._y); l.style.opacity = 0.6;
}
function nameIt(a) { if (named && named !== a) named.classList.remove('named', 'on', 'aph-gather'); named = a; a.classList.add('named', 'on'); ring.classList.add('focus'); ray(a, true); }
function unname() { if (!named) return; named.classList.remove('named', 'on', 'aph-gather'); named = null; ring.classList.remove('focus'); ray(null, false); }
links.forEach((a) => {
  const on = () => { if (a._x === undefined || named) return; ring.classList.add('focus'); a.classList.add('on'); ray(a, true); };
  const off = () => { if (named) return; ring.classList.remove('focus'); a.classList.remove('on'); ray(null, false); };
  a.addEventListener('pointerenter', on); a.addEventListener('focus', on); a.addEventListener('pointerleave', off); a.addEventListener('blur', off);
  /* a wide screen: the icon gathers as the press begins, so it is seen before the section comes in */
  a.addEventListener('pointerdown', () => { if (!ring.classList.contains('phone') || named === a) a.classList.add('aph-gather'); });
  /* a phone: the first tap names the icon (it keeps stirring, as a hover would) and shows its name and gloss; the
     second gathers it and enters. A key enters at once. */
  a.addEventListener('click', (e) => {
    if (!ring.classList.contains('phone') || e.detail === 0 || named === a) return;
    e.preventDefault(); nameIt(a);
  });
});
document.addEventListener('pointerdown', (e) => { if (named && !(e.target.closest && e.target.closest('#aph-ring a'))) unname(); }, true);
phoneQ.addEventListener('change', phoneMode);
phoneMode();

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
  $('aph-ptext').lang = f.l; $('aph-passage').dataset.tip = (f.t && f.t !== '—' ? f.t + ' · ' : '') + f.a;
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
/*__FAVICON__*/
const FAVICON = favicons(A, /*__ICONRED__*/);
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
if (A.Sound) { A.Sound.ear($('aph-ear')); $('aph-ear').setAttribute('aria-label', 'sound'); } else $('aph-ear').remove();

/* ================= routes ================= */
/* a hidden section (the gate) has no name in the inscription and no route: the shell opens it on `aph:entrance` */
const NAMES = SECTIONS.filter((s) => !s.hidden).map((s) => s.id);
const HIDDEN = new Set(SECTIONS.filter((s) => s.hidden).map((s) => s.id));
let gateOpen = false;
/* a section's name in the address, where it differs from its branch (experimental is the descent, at #descent) */
const ROUTE = Object.fromEntries(SECTIONS.map((s) => [s.id, s.route || s.id]));
const routeOf = (id) => '#' + ROUTE[id];
const RENAMED = { experimental: 'descent' };   /* old addresses that still lead to the section */
const ARCHIVE_SLUGS = APH_SECTIONS.archive ? APH_SECTIONS.archive.slugs : [];
/* the section a global hash belongs to ('' for the home) */
function sectionOf(hash) {
  const h = decodeURIComponent((hash || '').replace(/^#/, ''));
  if (!h || h === 'home') return '';
  for (const n of NAMES) { const r = ROUTE[n]; if (h === r || h.startsWith(r + '/') || (n === 'works' && h.startsWith('works-'))) return n; }
  for (const [old, now] of Object.entries(RENAMED)) if (h === old || h.startsWith(old + '/')) return NAMES.find((n) => ROUTE[n] === now);
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
/* a section that waits for data from elsewhere (music: its library on R2). Until the data is there and not empty,
   the section shows only `keep` (its title and gloss) in the fog, with no word about it; the section's request
   simply has not answered yet. The shell asks again, more slowly each time, while the section is on screen, and
   the moment the data is there the request answers and the section fills in, with no rebuild. */
const WAITS = {
  music: {
    match: (u) => /\/index\.json(\?|$)/.test(String(u && u.url !== undefined ? u.url : u)),
    ready: (doc) => !!(doc && Array.isArray(doc.tracks) && doc.tracks.length),
    keep: '.m-gloss, .m-title',
  },
};
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
    const set = (k) => { if (!ctx.active || !k) return; if (k.density !== undefined) target.d = k.density; if (k.light !== undefined) target.l = k.light;
      if (k.clear !== undefined || k.clearWidth !== undefined) fog.set({ clear: k.clear, clearWidth: k.clearWidth }); };
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
  /* the site's texts: the owner's version of a line, or the section's own */
  SA.text = text;
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
  }, A.Simulacrum);   /* its statics too: fromBrush, LEGIBLE */
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
  const OVER = { fetch: (i, o) => fe(i, o), Aphesis: SA, document: docP, location: loc, history: hist, addEventListener: winL, removeEventListener: winR,
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
  /* fetch: the section's own, except a request the section waits on (WAITS) */
  const WT = WAITS[name];
  ctx.waiting = !!WT;
  const fe = (input, init) => {
    if (!WT || !WT.match(input)) return W.fetch(input, init);
    return new Promise((resolve) => {
      let n = 0;
      const again = () => sT(attempt, Math.min(120000, 15000 * ++n));
      function attempt() {
        W.fetch(input, init).then((res) => (res.ok ? res.clone().json().then((doc) => {
          if (!WT.ready(doc)) return again();
          ctx.waiting = false; if (cur === ctx) delete host.dataset.wait;
          resolve(res);
        }) : again())).catch(again);
      }
      attempt();
    });
  };
  ctx.args = [winP, winP, winP, docP, loc, hist, winL, winR, rA, cA, sT, cT, sI, cI, mM, RO, MO, IO, fe];
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
  const markup = tplOf(name).content.cloneNode(true);
  applyTexts(markup);
  host.appendChild(markup);
  /* the section's links to its own routes point at the global hash */
  const X = xl(name);
  host.querySelectorAll('a[href^="#"]').forEach((a) => { const h = a.getAttribute('href'); if (h.length > 1) a.setAttribute('href', X.toGlobal(h)); });
  OWNER = ctx;
  if (ctx.waiting) wait(ctx);
  try { APH_SECTIONS[name].run.apply(undefined, ctx.args); } catch (err) { console.error(err); }
  focusIn(ctx);
}
/* waiting: only the section's title and gloss, condensing out of the fog, with the fog calm behind them */
function wait(ctx) {
  host.dataset.wait = '';
  const keep = [...host.querySelectorAll(WAITS[ctx.name].keep)];
  keep.forEach((el) => el.setAttribute('data-aph-keep', ''));
  ctx.zones = keep.map((el) => ({ el, pad: 16 }));
  condense(keep);
}
function condense(els) {
  els.forEach((el) => { el.style.setProperty('opacity', '0'); el.style.setProperty('filter', 'blur(10px)'); el.style.setProperty('translate', '0 14px'); });
  requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((el) => {
    el.style.transition = 'opacity 1.2s cubic-bezier(.2,.7,.2,1), filter 1.2s cubic-bezier(.2,.7,.2,1), translate 1.2s cubic-bezier(.2,.7,.2,1)';
    el.style.removeProperty('opacity'); el.style.removeProperty('filter'); el.style.removeProperty('translate');
    setTimeout(() => el.style.removeProperty('transition'), 1300);
  })));
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
  ctx.leftAt = sectionOf(prevHash) === ctx.name ? prevHash : routeOf(ctx.name);
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
  delete host.dataset.sec; delete host.dataset.wait;
  styleOf(ctx.name).media = 'not all';
  if (!cur) delete ROOT.dataset.sec;
  if (OWNER === ctx) OWNER = null;
  scrollTo(0, 0);
}
/* back from rest: everything put back as it was, then the pieces condense in */
function wake(ctx) {
  cur = ctx; OWNER = ctx;
  show(ctx.name);
  if (ctx.waiting) host.dataset.wait = '';
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
  /* a hidden section follows no address */
  if (HIDDEN.has(ctx.name)) { dispatchEvent(new Event('resize')); focusIn(ctx); return; }
  /* coming back by the section's own name lands where it was left; a sub-route in the address is followed */
  if (location.hash === routeOf(ctx.name) && ctx.leftAt !== location.hash) { try { history.replaceState(null, '', ctx.leftAt); } catch (_) { /* fine */ } }
  const here = location.hash;
  if (redraw) { const back = here; try { history.replaceState(null, '', routeOf(ctx.name)); } catch (_) { /* fine */ } dispatchEvent(new HashChangeEvent('hashchange'));
    try { history.replaceState(null, '', back); } catch (_) { /* fine */ } dispatchEvent(new HashChangeEvent('hashchange')); }
  else if (here !== ctx.leftAt) dispatchEvent(new HashChangeEvent('hashchange'));
  dispatchEvent(new Event('resize'));
  focusIn(ctx);
}
function requestMount(name, delay) { pendingMount = name; clearTimeout(mountTimer); mountTimer = setTimeout(tryMount, delay); }
function tryMount() {
  if (leaving || !pendingMount) return;
  /* a first visit waits for the texts (TEXTS_WAIT at most), so the section enters with its words already set */
  if (!textsSettled && !DORMANT[pendingMount]) { textsQueue.push(tryMount); return; }
  const n = pendingMount; pendingMount = null;
  if (route === n && !cur) enter(n);
}

/* ---------- calm zones behind text: the shell's marks and the mounted section's blocks, twelve at most ----------
   A zone never appears or goes at once: each has a weight that travels to 1 when its block is there and to 0 when it
   is not, over ZONE_MS with minimum jerk, and the zone grows from its centre with it (the fog has no weight per
   zone, so its size carries it). A leaving section's zones shrink away while its text dissolves; an entering
   section's grow in as it condenses; the home's names weigh as much as they are visible. */
const ZONE_MS = 1200, ZW = new Map(), ZB = [];
function rectOf(z) {
  const r = z.el ? z.el.getBoundingClientRect() : z;
  return r && r.width ? { left: r.left, top: r.top, width: r.width, height: r.height, pad: z.pad || 12 } : null;
}
function zones(dt) {
  const want = new Map();   /* key -> [rect, weight wanted] */
  const el = (e, pad, w) => { if (!e) return; const r = e.getBoundingClientRect(); if (r.width) want.set(e, [{ left: r.left, top: r.top, width: r.width, height: r.height, pad }, w]); };
  links.forEach((a) => el(a, 10, route === '' ? +getComputedStyle(a).opacity : 0));
  el($('aph-seal'), 10, route === '' ? 0 : 1);
  el($('aph-passage'), 14, 1); el($('aph-controls'), 8, 1);
  for (const [c, w] of [[cur, 1], [leaving, 0]]) if (c) for (const z of c.zones) { const r = rectOf(z); if (r) want.set(z.el || z, [r, w]); }
  const step = dt * 1000 / ZONE_MS, ease = Math.min(1, dt / 0.35), glide = Math.min(1, dt / 0.2);
  want.forEach(([r, w], k) => { const e = ZW.get(k); if (e) { e.r = r; e.to = w; } else ZW.set(k, { r, to: w, w: 0, sw: r.width, sh: r.height, sx: r.left + r.width / 2, sy: r.top + r.height / 2, slot: false }); });
  /* the fog takes twelve zones: a zone keeps its place until it has shrunk away, and a new one waits for a free
     place, so the set never changes in one frame */
  let used = 0;
  ZW.forEach((e, k) => { if (!want.has(k)) e.to = 0; if (e.slot && e.to <= 0 && e.w <= 0) ZW.delete(k); else if (e.slot) used++; });
  [...ZW.values()].filter((e) => !e.slot && e.to > 0).forEach((e) => { if (used < 12) { e.slot = true; used++; } });
  ZW.forEach((e, k) => {
    if (!e.slot) { if (e.to <= 0) ZW.delete(k); return; }
    e.w = e.w < e.to ? Math.min(e.to, e.w + step) : Math.max(e.to, e.w - step);
    /* a block that changes size or place (its content arrives, the layout reflows) takes its calm zone along gently */
    e.sw += (e.r.width - e.sw) * ease; e.sh += (e.r.height - e.sh) * ease;
    e.sx += (e.r.left + e.r.width / 2 - e.sx) * glide; e.sy += (e.r.top + e.r.height / 2 - e.sy) * glide;
  });
  ZB.length = 0;
  ZW.forEach((e) => {
    const k = MJ(e.w); if (!e.slot || k <= 0) return;
    const cx = e.sx, cy = e.sy, w = e.sw * k, h = e.sh * k;
    ZB.push({ left: cx - w / 2, top: cy - h / 2, width: w, height: h, pad: e.r.pad * k });
  });
  return ZB;
}

/* ---------- moving between the home and the sections ---------- */
/* the clearing: inside a section the fog drifts out of a central band to the sides (1), the descent keeps more of
   it (0.4), the home none (0). The fog eases each change itself, over 1.8 s; a section may set its own (fog.set). */
const CLEAR = { experimental: 0.4 };
let route = null, raf = null;
function tween(dur, fn, fim) { cancelAnimationFrame(raf); let t0 = null; const q = (now) => { if (t0 === null) t0 = now; const k = clamp((now - t0) / Math.max(1, dur)); fn(k); if (k < 1) raf = requestAnimationFrame(q); else fim && fim(); }; raf = requestAnimationFrame(q); }
function goTo(next, first) {
  if (next === route) return;
  const prev = route; route = next;
  const ring = $('aph-ring');
  /* the ambient sound crossfades per screen, where the runtime has it */
  try { if (A.Sound) { const d = next && DORMANT[next]; if (d && d.scene) A.Sound.scene(d.scene[0], d.scene[1]); else A.Sound.scene(next || 'home'); } } catch (err) { console.error(err); }
  $('aph-seal').classList.toggle('in-corner', next !== '');
  fog.set({ clear: next === '' ? 0 : (CLEAR[next] ?? 1) });
  if (cur) leave();
  if (next === '') {
    target.d = 1; target.l = 1;
    clearTimeout(mountTimer); pendingMount = null;
    document.title = 'aphes.ist'; $('aph-announce').textContent = 'home';
    const de = { ...sealBox }, para = centerBox(), u0 = u;
    tween(first ? 1 : 1600, (k) => { const e = MJ(k); placeSeal({ x: lerp(de.x, para.x, e), y: lerp(de.y, para.y, e), s: lerp(de.s, para.s, e) }); u = lerp(u0, 0, k); paint(estadoT(u)); },
      () => {
        unname(); links.forEach((l) => l.classList.remove('aph-gather'));
        ring.classList.add('visible');
        const a = document.activeElement;
        if (prev && (!a || a === document.body)) { const l = links.find((x) => x.getAttribute('href') === routeOf(prev)); if (l) l.focus({ preventScroll: true }); }
      });
  } else {
    const sec = SECTIONS.find((s) => s.id === next); document.title = sec.name ? sec.name + ' · aphes.ist' : 'aphes.ist'; $('aph-announce').textContent = sec.name;
    ring.classList.remove('visible', 'focus'); $('aph-ray').querySelector('line').style.opacity = 0;
    if (prev === '' || prev === null) {
      const de = { ...sealBox }, para = cornerBox(), u0 = u;
      tween(first ? 1 : 1800, (k) => { const e = MJ(k); placeSeal({ x: lerp(de.x, para.x, e), y: lerp(de.y, para.y, e), s: lerp(de.s, para.s, e) }); u = lerp(u0, 1, k); paint(estadoT(u)); });
    }
    requestMount(next, first ? 0 : (prev === '' ? 700 : 0));
  }
}
function readRoute() {
  if (gateOpen) return 'gate';
  const s = sectionOf(location.hash);
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (s === 'archive' && ARCHIVE_SLUGS.includes(h)) { try { history.replaceState(null, '', '#archive/' + h); } catch (_) { /* a sandbox may refuse */ } }
  /* a section's old name (#experimental) is rewritten to its name now (#descent), so old links keep working */
  for (const [old, now] of Object.entries(RENAMED)) if (h === old || h.startsWith(old + '/')) { try { history.replaceState(null, '', '#' + now + h.slice(old.length)); } catch (_) { /* fine */ } }
  return s;
}
let prevHash = location.hash;   /* the address just before a route change: where a leaving section was */
addEventListener('hashchange', (e) => { if (!e.isTrusted && gateOpen) return; gateOpen = false; try { prevHash = new URL(e.oldURL).hash; } catch (_) { prevHash = ''; } goTo(readRoute()); });
/* the gate: any entrance opens it over wherever the visitor is (the ritual, the phrase, the secret route, the descent's
   tenth door), with one history entry, so Back closes it; the seal, its own Escape and a new address close it too */
addEventListener('aph:entrance', () => {
  if (!APH_SECTIONS.gate || gateOpen) return;
  gateOpen = true; prevHash = location.hash;
  try { history.pushState({ aphGate: 1 }, '', location.href); } catch (_) { /* a sandbox may refuse */ }
  goTo('gate');
});
addEventListener('popstate', () => { if (gateOpen && !(history.state && history.state.aphGate)) { gateOpen = false; goTo(readRoute()); } });
addEventListener('aph:gate-close', () => { if (!gateOpen) return; gateOpen = false; goTo(readRoute()); });
/* the seal always leads home, without relying on the hash */
$('aph-seal').addEventListener('click', (e) => { e.preventDefault(); gateOpen = false; if (route === '') return; prevHash = location.hash; try { history.pushState(null, '', '#home'); } catch (_) { /* fine */ } goTo(''); });
/* a section link written as a local hash (made after the mount) is sent to the section's global hash */
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || !cur || e.button) return;
  const a = e.target.closest && e.target.closest('#aph-host a[href^="#"]'); if (!a) return;
  const h = a.getAttribute('href'), g = xl(cur.name).toGlobal(h);
  if (h.length > 1 && g !== h) { e.preventDefault(); location.hash = g; }
});
/* Escape goes up: from a section's own page to its index, from an index to the home (when the section did not use it) */
const INDEX = { works: '#works', archive: '#archive', laboratory: '#laboratory', forum: '#forum', music: '#music' };
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !route || !cur) return;
  const t = e.target, open = !!host.querySelector('[aria-expanded="true"]'), name = cur.name;
  setTimeout(() => {
    if (e.defaultPrevented || open || route !== name) return;
    if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
    const idx = INDEX[name], h = location.hash;
    if (idx && h !== idx && h !== routeOf(name)) location.hash = idx.slice(1); else location.hash = 'home';
  }, 0);
});

/* ---------- the loop: fog, zones, the inscription's slow turn ---------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  dens = densM.at(target.d, dt); light = lightM.at(target.l, dt);
  fog.set({ density: dens, light });
  fog.zones(zones(dt));
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
