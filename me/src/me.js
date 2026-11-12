/* me.aphes.ist: the motion, on a page that is already complete. The text is in the document; this script only
   plays the entrance, reveals the sections as they come into view, runs the fog and the one simulacrum that goes live in a work's preview, and (when
   the build has a content API) refreshes the text. Plain JavaScript on the design system's runtime (window.Aphesis). */
(function () {
  'use strict';
  var A = window.Aphesis;
  if (!A) return;                 /* the runtime failed: the safety timeout in the head lifts every hidden state */
  window.__meAlive = true;

  var CFG = window.__ME || {};
  var root = document.documentElement;
  var REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MO = root.classList.contains('mo');
  var INTRO = root.classList.contains('intro');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var NS = 'http://www.w3.org/2000/svg';
  var sysDark = matchMedia('(prefers-color-scheme: dark)');
  var fog = null, sim = null, hidden = document.hidden;

  /* ---------------------------------------------------------------- timers */
  var timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearLater() { timers.forEach(clearTimeout); timers = []; }

  /* ---------------------------------------------------------------- brushed underlines */
  function seedOf(word) { var h = 2166136261; for (var i = 0; i < word.length; i++) { h ^= word.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }
  function underline(el) {
    var svg = el.querySelector(':scope > svg');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
      ['ur', 'uh'].forEach(function (c) { var p = document.createElementNS(NS, 'path'); p.setAttribute('class', c); svg.appendChild(p); });
      el.appendChild(svg);
    }
    var w = Math.max(12, el.getBoundingClientRect().width), seed = seedOf(el.textContent || 'x');
    svg.setAttribute('width', w.toFixed(1)); svg.setAttribute('height', '8'); svg.setAttribute('viewBox', '0 0 ' + w.toFixed(1) + ' 8');
    var r = A.rng(seed), sag = 0.6 + r() * 0.8;
    var pts = A.line(-2, 4.4, w + 3, 3.6, Math.max(16, Math.round(w / 5))).map(function (p) { return [p[0], p[1] + Math.sin(Math.PI * (p[0] / w)) * sag]; });
    var d = A.brush(pts, 1.3, seed, 0.38, 0.12);
    $$('path', svg).forEach(function (p) { p.setAttribute('d', d); });
  }
  function underlines() { $$('a.ul, button.ul').forEach(function (el) { if (el.offsetParent !== null || getComputedStyle(el).position === 'fixed') underline(el); }); root.classList.add('ul-on'); }

  /* ---------------------------------------------------------------- the eye */
  var eye = $('#eye');
  eye.querySelector('.open').innerHTML = A.icon('eye', 0);
  eye.querySelector('.closed').innerHTML = A.icon('eye', 1);
  function isDark() { return root.dataset.theme ? root.dataset.theme === 'dark' : sysDark.matches; }
  function eyeState() { eye.dataset.tip = isDark() ? 'closed · open the eye' : 'open · close the eye'; eye.setAttribute('aria-pressed', String(isDark())); }
  eyeState();
  sysDark.addEventListener('change', eyeState);
  eye.addEventListener('click', function () {
    var b = eye.getBoundingClientRect();
    var apply = function () {
      var next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('aphesis.me.theme', next); } catch (e) {}
      eyeState();
    };
    /* themeShift always animates; for a reader who asked for less motion the theme switches at once */
    if (REDUCED) apply(); else A.themeShift(apply, { origin: [b.left + b.width / 2, b.top + b.height / 2] });
  });

  A.seal($('#seal'));
  A.cursor();
  A.tooltip();

  /* ---------------------------------------------------------------- the header: the veil shows once the page has moved; the parts lift letter by letter */
  var scrolled = function () { root.classList.toggle('scrolled', (window.pageYOffset || 0) > 8); };
  addEventListener('scroll', scrolled, { passive: true }); scrolled();
  $$('.top-nav a').forEach(function (a) { A.letters(a); });

  /* ---------------------------------------------------------------- section icons and headings */
  $$('.si').forEach(function (el) { el.innerHTML = A.icon(el.dataset.icon, REDUCED ? 1 : 0); });
  $$('.sh h2').forEach(function (h) { A.letters(h); });

  /* ---------------------------------------------------------------- sections reveal */
  var shown = {};
  function reveal(sec) {
    if (!sec || shown[sec.id]) return;
    shown[sec.id] = true;
    sec.classList.add('in');
    var ic = $('.si', sec);
    if (ic && !REDUCED) later(function () { ic.classList.add('aph-gather'); }, 250);
  }
  $$('.sec').forEach(function (sec) { $$('.rv', sec).forEach(function (el, i) { el.style.setProperty('--d', Math.min(i, 9) * 70 + 'ms'); }); });
  function revealVisible() { $$('.sec').forEach(function (sec) { var r = sec.getBoundingClientRect(); if (r.top < innerHeight * 0.92 && r.bottom > 0) reveal(sec); }); }
  if (MO && 'IntersectionObserver' in window) {
    var revIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || root.classList.contains('intro')) return;
        if (e.intersectionRatio >= 0.15 || e.intersectionRect.height > innerHeight * 0.3) { reveal(e.target); revIO.unobserve(e.target); }
      });
    }, { threshold: [0, 0.15, 0.3], rootMargin: '0px 0px -5% 0px' });
    $$('.sec').forEach(function (s) { revIO.observe(s); });
  } else {
    $$('.sec').forEach(reveal);
  }

  /* ---------------------------------------------------------------- fog zones */
  var zoneRaf = 0, zoneAt = 0;
  function zones() {
    zoneRaf = 0; zoneAt = performance.now();
    if (!fog) return;
    var list = [];
    $$('[data-zone]').forEach(function (el) {
      if (list.length >= 12) return;
      var r = el.getBoundingClientRect();
      if (r.bottom > -20 && r.top < innerHeight + 20 && r.width) list.push({ el: el, pad: 16 });
    });
    fog.zones(list);
  }
  function zonesSoon() { if (zoneRaf) return; var wait = Math.max(0, 100 - (performance.now() - zoneAt)); zoneRaf = requestAnimationFrame(function () { if (wait) later(zones, wait); else zones(); }); }
  addEventListener('scroll', zonesSoon, { passive: true });

  /* ---------------------------------------------------------------- the works: a project icon, and the link's preview made of fog */
  /* heild's own mark, the HE of its wordmark: the outline path of heild's design system (design-system/logos/favicon-he.svg,
     viewBox -26 -77 541 541), drawn our way: stipple in accent filling the path, on the 24-unit grid, with the same
     stir and gather as the project icons. */
  var HE_D = 'M54.5 163.805H231V14.3047H483.5V61.3047H285.5V163.305H459.5V210.805H285.5V324.805H489V371.805H231V210.805H54.5V371.805H0V14.3047H54.5V163.805Z';
  function heildIcon() {
    var x = document.createElement('canvas').getContext('2d'), p = new Path2D(HE_D), k = 541 / 24;
    x.lineWidth = 18; x.lineJoin = 'miter';
    var d = A.stipple(function (px, py) { var X = -26 + px * k, Y = -77 + py * k; return x.isPointInPath(p, X, Y) || x.isPointInStroke(p, X, Y); }, 7, 1500, 0.62, 24), a = '', b = '';
    d.split('M').slice(1).forEach(function (q, j) { if (j % 2) b += 'M' + q; else a += 'M' + q; });
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="overflow:visible"><g class="aph-st" opacity=".85" style="transform-origin:12px 12px"><path d="' + a + '" fill="currentColor"/><path d="' + b + '" fill="currentColor"/></g></svg>';
  }
  $$('.wi').forEach(function (el) {
    var n = el.dataset.icon;
    if (n === 'phi') return;                  /* aphes.ist: the φ itself, as built, red and still */
    try { el.innerHTML = n === 'heild' ? heildIcon() : A.icon(n, 0); } catch (e) {}
  });

  /* ONE simulacrum canvas (legible, over the fog) moves into the row that is live and coalesces that row's map while the
     row's static stipple fades out; it dissolves back on leave. Reduced motion: the static stipple only, no canvas. */
  var maps = CFG.maps || {}, liveId = null, canvas = null, hoverT = 0;
  var hoverMode = matchMedia('(hover: hover) and (pointer: fine)');
  var rowOf = function (id) { return $('.works .work[data-id="' + id + '"]'); };
  function setGather(row, on) { var w = $('.wi', row); if (w) w.classList.toggle('aph-gather', on); }
  function ensureSim(box) {
    if (sim || REDUCED || !A.Simulacrum) return;
    canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); box.appendChild(canvas);
    sim = A.Simulacrum(canvas, { legible: true, ground: false, fit: 'cover', accent: 0.03 });
    if (!liveId || hidden) sim.stop();
  }
  function goLive(id) {
    if (REDUCED || liveId === id) return;
    var row = rowOf(id), m = maps[id]; if (!row || !m) return;
    var box = $('.pvbox', row);
    if (liveId) { var old = rowOf(liveId); old.classList.remove('live'); setGather(old, false); }
    liveId = id;
    if (!sim) ensureSim(box); else { canvas.classList.remove('on'); box.appendChild(canvas); }
    if (!sim) { liveId = null; return; }
    row.classList.add('live'); setGather(row, true);
    if (!hidden) sim.start();
    sim.show(Object.assign({ src: m.src }, m.settings || {}));
    sim.drawn(function () { if (liveId === id) canvas.classList.add('on'); });
  }
  function endLive(id) {
    if (liveId !== id || !sim) return;
    var row = rowOf(id); row.classList.remove('live'); setGather(row, false);
    liveId = null;
    sim.hide(function () { if (liveId === null) { canvas.classList.remove('on'); sim.stop(); } });
  }
  if (!REDUCED) {
    $$('.works .work').forEach(function (li) {
      var id = li.dataset.id;
      var enter = function () { if (!hoverMode.matches) return; clearTimeout(hoverT); hoverT = setTimeout(function () { goLive(id); }, 100); };
      var leave = function (e) { if (!hoverMode.matches || (e && e.relatedTarget && li.contains(e.relatedTarget))) return; clearTimeout(hoverT); hoverT = setTimeout(function () { endLive(id); }, 150); };
      li.addEventListener('mouseenter', enter); li.addEventListener('focusin', enter);
      li.addEventListener('mouseleave', leave); li.addEventListener('focusout', leave);
    });
    if ('IntersectionObserver' in window) {
      /* touch screens: the row whose preview crosses the middle of the screen goes live */
      var midIO = new IntersectionObserver(function (es) {
        if (hoverMode.matches) return;
        es.forEach(function (e) { var id = e.target.closest('.work').dataset.id; if (e.isIntersecting) goLive(id); else endLive(id); });
      }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      $$('.works .pvbox').forEach(function (b) { midIO.observe(b); });
      /* the canvas is made when the works are within a viewport of the screen, so the first hover is not a pause */
      var nearIO = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { ensureSim($('.works .pvbox')); nearIO.disconnect(); } }, { rootMargin: '100% 0px 100% 0px' });
      nearIO.observe($('#work'));
    }
  }

  /* ---------------------------------------------------------------- fog and the contact zone */
  function startFog() {
    if (fog) return;
    fog = A.Fog($('#fog'), { density: 0.62, light: 0.4, clear: 1 });
    root.classList.add('lab-fog-on');
    $('#fog').classList.add('on');
    zones();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { fog.set({ clear: es[0].intersectionRatio >= 0.5 ? 0.6 : 1 }); }, { threshold: [0, 0.5] }).observe($('#contact'));
    }
  }
  document.addEventListener('visibilitychange', function () {
    hidden = document.hidden;
    if (fog) { if (hidden) fog.stop(); else fog.start(); }
    if (sim) { if (hidden || !liveId) sim.stop(); else sim.start(); }
  });

  /* ---------------------------------------------------------------- text helpers (used by the entrance and the refresh) */
  var hero = { gloss: $('#nomen'), name: $('#name'), meta: $('.hero .meta'), lede: $('.hero .lede'), bio: $('.hero .lede + p') };
  var typed = $('.typed', hero.meta), srMeta = $('.sr', hero.meta), caret = $('.aph-caret', hero.meta);
  var metaText = typed.textContent, started = {}, typist = null, metaDone = false;

  function words(p, text) {
    p.textContent = '';
    var out = [];
    String(text).split(/(\s+)/).forEach(function (tok) {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { p.appendChild(document.createTextNode(tok)); return; }
      var s = document.createElement('span'); s.className = 'wd'; s.textContent = tok; p.appendChild(s); out.push(s);
    });
    return out;
  }
  function streamTimes(ws, step) {
    var t = 0;
    return ws.map(function (s) { var at = t; var w = s.textContent; t += step + (/[,;:]$/.test(w) ? 90 : /[.!?]$/.test(w) ? 160 : 0); return at; });
  }
  function stream(key, p, at, step) {
    started[key] = true;
    var ws = words(p, p.dataset.text || p.textContent);
    p.classList.add('rdy');
    var times = streamTimes(ws, step);
    ws.forEach(function (s, i) { later(function () { s.classList.add('on'); }, times[i]); });
    return times.length ? times[times.length - 1] + 400 : 0;
  }
  function nameLetters(text) {
    var nm = $('.nm', hero.name); nm.textContent = '';
    String(text).split(' ').forEach(function (w, wi) {
      if (wi) nm.appendChild(document.createTextNode(' '));
      var ws = document.createElement('span'); ws.className = 'w';
      Array.from(w).forEach(function (c) { var l = document.createElement('span'); l.className = 'nl'; l.textContent = c; ws.appendChild(l); });
      nm.appendChild(ws);
    });
    $('.sr', hero.name).textContent = text;
  }

  /* ---------------------------------------------------------------- the entrance */
  var intro = { done: !INTRO, raf: 0 };
  var fly = $('#fly'), flyPath = $('#fly-frames path'), flySeal = $('#fly-seal');
  var F = CFG.frames, flyBox = null, flyPos = null, drawn = false, sealed = false;

  function showSealed() {
    if (sealed) return; sealed = true;
    A.seal(flySeal); fly.classList.add('sealed');
  }
  function drawPhi() {
    var slot = $('.phi-slot'), r = slot.getBoundingClientRect();
    flyBox = { w: r.width, h: r.height };
    fly.style.width = r.width + 'px'; fly.style.height = r.height + 'px';
    flyPos = { x: r.left, y: r.top, s: 1 };
    fly.style.transform = 'translate3d(' + r.left + 'px,' + r.top + 'px,0)';
    fly.classList.add('on');
    var n = F.frames.length, ms = F.dur * 1000 / 1.6, t0 = performance.now(), last = -1;
    (function tick(now) {
      var k = Math.max(0, Math.min(1, (now - t0) / ms)), i = Math.min(n - 1, Math.floor(k * n));
      if (i !== last) { flyPath.setAttribute('d', F.frames[i]); last = i; }
      if (k >= 1) { drawn = true; showSealed(); return; }
      intro.raf = requestAnimationFrame(tick);
    })(t0);
  }
  function travel() {
    if (!flyBox) { root.classList.remove('sealwait'); return; }
    var dst = $('#seal').getBoundingClientRect();
    var x0 = flyPos.x, y0 = flyPos.y, s1 = dst.width / flyBox.w, x1 = dst.left, y1 = dst.top, t0 = performance.now(), ms = 1600;
    (function tick(now) {
      var k = Math.max(0, Math.min(1, (now - t0) / ms)), e = A.MJ(k), s = 1 + (s1 - 1) * e;
      fly.style.transform = 'translate3d(' + (x0 + (x1 - x0) * e) + 'px,' + (y0 + (y1 - y0) * e) + 'px,0) scale(' + s + ')';
      if (k < 1) { requestAnimationFrame(tick); return; }
      root.classList.remove('sealwait');       /* the corner seal takes over */
      fly.classList.add('gone');
      setTimeout(function () { fly.classList.remove('on'); }, 450);
    })(t0);
  }
  function endIntro() {
    if (intro.done) return;
    intro.done = true;
    clearLater(); cancelAnimationFrame(intro.raf);
    removeEventListener('wheel', endIntro); removeEventListener('touchmove', endIntro); removeEventListener('keydown', endIntro);
    removeEventListener('scroll', endIntro); removeEventListener('pointerdown', endIntro);
    if (typist) typist.stop();
    typed.textContent = metaText; caret.classList.remove('blink'); caret.classList.add('gone');
    if (!started.lede) { words(hero.lede, hero.lede.dataset.text || hero.lede.textContent); hero.lede.classList.add('rdy'); }
    if (!started.bio) { words(hero.bio, hero.bio.dataset.text || hero.bio.textContent); hero.bio.classList.add('rdy'); }
    $$('.hi, .nl, .wd').forEach(function (el) { el.classList.add('on'); });
    $('#skip').classList.remove('up');
    root.classList.remove('intro');
    if (drawn || !flyBox) { if (flyBox) showSealed(); } else { flyPath.setAttribute('d', F.frames[F.frames.length - 1]); showSealed(); }
    revealVisible();
    zonesSoon();
    travel();
    hero.meta.style.minHeight = '';
  }
  function startIntro() {
    hero.meta.style.minHeight = hero.meta.offsetHeight + 'px';
    typed.textContent = '';
    var nl = $$('.nl');
    $('#skip').addEventListener('click', endIntro);
    ['wheel', 'touchmove', 'keydown', 'scroll', 'pointerdown'].forEach(function (ev) { addEventListener(ev, endIntro, { passive: true }); });
    later(drawPhi, 200);
    later(function () { $('#skip').classList.add('up'); }, 600);
    later(function () { hero.gloss.classList.add('on'); }, 1200);
    later(function () { nl.forEach(function (l, i) { later(function () { l.classList.add('on'); }, i * 45); }); }, 1250);
    later(function () {
      caret.classList.remove('gone'); caret.classList.add('blink');
      typist = new A.Typist(typed, caret);
      typist.type(metaText, function () { metaDone = true; later(function () { caret.classList.remove('blink'); caret.classList.add('gone'); }, 900); });
    }, 900);
    var ledeEnd = 0;
    later(function () { ledeEnd = stream('lede', hero.lede, 0, 20); }, 2000);
    later(function () { var e = stream('bio', hero.bio, 0, 20); later(function () { when(); }, e); }, 2600);
    /* the intro ends once the words are in and the line is typed; never later than 5.4 s */
    function when() { if (metaDone) endIntro(); else later(when, 150); }
    later(endIntro, 4600);
  }

  /* ---------------------------------------------------------------- the content refresh (inert without a content API) */
  function md(t) {
    var out = '', last = 0, re = /\[([^\]]+)\]\(([^)\s]+)\)/g, m;
    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    while ((m = re.exec(t))) { out += esc(t.slice(last, m.index)) + '<a class="ul" href="' + esc(m[2]) + '">' + esc(m[1]) + '</a>'; last = m.index + m[0].length; }
    return out + esc(t.slice(last));
  }
  function swapText(el, v) { if (el.textContent !== v) el.textContent = v; }
  function applyText(key, v) {
    if (v == null) return;
    if (typeof v !== 'string') return;
    var el = $('[data-key="' + key + '"]');
    if (key === 'me.email' || key === 'me.github') { $$('.foot [data-key="' + key + '"]').forEach(function (f) { if (key === 'me.email') { f.textContent = v; f.href = 'mailto:' + v; } else f.href = v; }); }
    if (!el) return;
    if (key === 'me.name') { nameLetters(v); if (intro.done) $$('.nl').forEach(function (l) { l.classList.add('on'); }); document.title = v; }
    else if (key === 'me.meta') {
      metaText = v; swapText(srMeta, v);
      if (intro.done || metaDone) typed.textContent = v; else if (typist) { typist.stop(); typed.textContent = v; metaDone = true; }
    }
    else if (key === 'me.lede' || key === 'me.bio') {
      var p = key === 'me.lede' ? hero.lede : hero.bio, k = key === 'me.lede' ? 'lede' : 'bio';
      if (started[k] || intro.done) { p.textContent = v; p.classList.add('rdy'); } else p.dataset.text = v;
    }
    else if (key === 'me.page') { el.innerHTML = md(v); underlines(); }
    else if (key === 'me.email') { $$('[data-key="me.email"]').forEach(function (f) { f.textContent = v; f.href = 'mailto:' + v; }); underlines(); }
    else if (key === 'me.github') { $$('[data-key="me.github"]').forEach(function (f) { f.href = v; if (!f.closest('.foot')) f.textContent = v.replace(/^https?:\/\//, ''); }); underlines(); }
    else if (/^me\.education\.\d+$/.test(key)) {
      /* `title · note`, split at the first ` · `; the note may hold more of them (FIAP · 2023–2026) */
      var i = v.indexOf(' · '), title = i < 0 ? v : v.slice(0, i), note = i < 0 ? '' : v.slice(i + 3);
      swapText($('.iname', el), title);
      var tg = $('.tag', el);
      if (note && !tg) { tg = document.createElement('span'); tg.className = 'aph-meta tag'; el.appendChild(tg); }
      if (tg) { if (note) swapText(tg, note); else tg.remove(); }
    }
    else swapText(el, v);
  }
  function textsMap(d) {
    var m = {}, src = d && (d.texts || d);
    var val = function (v) { return v && typeof v === 'object' && !Array.isArray(v) && ('value' in v || 'text' in v) ? (v.value != null ? v.value : v.text) : v; };
    if (Array.isArray(src)) src.forEach(function (t) { if (t && t.key) m[t.key] = val(t); });
    else if (src && typeof src === 'object') Object.keys(src).forEach(function (k) { m[k] = val(src[k]); });
    return m;
  }
  function getJSON(path) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = setTimeout(function () { ctl && ctl.abort(); }, 2500);
    return fetch(CFG.api + path, { signal: ctl && ctl.signal, credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) { clearTimeout(t); return d; });
  }
  function refresh() {
    if (!CFG.api) return;
    getJSON('/v1/texts').then(function (d) {
      if (!d) return;
      var m = textsMap(d);
      Object.keys(m).forEach(function (k) { if (k.indexOf('me.') === 0) { try { applyText(k, m[k]); } catch (e) {} } });
      zonesSoon();
    });
    getJSON('/v1/works').then(function (d) {
      if (!d || !Array.isArray(d.works)) return;
      d.works.forEach(function (w) {
        var li = w && $('.works .work[data-id="' + w.id + '"]'); if (!li) return;
        if (typeof w.line === 'string' && w.line) swapText($('[data-line]', li), w.line);
        /* the status is the tag beside the name; an empty one takes the tag away. The work's own map (the works
           section's picture) is not used here: the page's pictures are previews of each work's page, made at build */
        if (typeof w.status === 'string') {
          var head = $('.whead', li), tag = $('.tag', head);
          if (w.status && !tag) { tag = document.createElement('span'); tag.className = 'aph-meta tag'; head.appendChild(tag); }
          if (tag) { if (w.status) tag.textContent = w.status; else tag.remove(); }
        }
      });
    });
    getJSON('/v1/awards').then(function (d) {
      if (!d || !Array.isArray(d.awards) || !d.awards.length) return;
      var ul = $('#award-list'), secIn = $('#awards').classList.contains('in');
      ul.innerHTML = '';
      d.awards.forEach(function (a) {
        if (!a || !a.title) return;
        var li = document.createElement('li'); li.className = 'rv aph-ink'; li.setAttribute('data-zone', '');
        var n = document.createElement('span'); n.className = 'iname'; n.textContent = a.title; li.appendChild(n);
        if (a.note) { var t = document.createElement('span'); t.className = 'aph-meta tag'; t.textContent = a.note; li.appendChild(t); }
        if (a.line) { var p = document.createElement('p'); p.textContent = a.line; li.appendChild(p); }
        ul.appendChild(li);
        if (secIn || !MO) li.classList.add('in');
      });
      zonesSoon();
    });
  }

  /* ---------------------------------------------------------------- go */
  var rs = 0;
  addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(function () { underlines(); zonesSoon(); }, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { underlines(); });
  underlines();
  refresh();

  if (!MO) {
    /* reduced motion, or no motion: everything is where it belongs at once */
    requestAnimationFrame(function () { requestAnimationFrame(function () { startFog(); }); });
  } else {
    if (!INTRO) { $$('.hi, .nl').forEach(function (el) { el.classList.add('on'); }); endIntroNow(); }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        startFog();
        if (INTRO) startIntro(); else revealVisible();
      });
    });
  }
  /* mo without an intro (the page was opened scrolled, or with a hash): the hero is simply there */
  function endIntroNow() {
    root.classList.remove('sealwait');
    words(hero.lede, hero.lede.dataset.text || hero.lede.textContent); hero.lede.classList.add('rdy');
    words(hero.bio, hero.bio.dataset.text || hero.bio.textContent); hero.bio.classList.add('rdy');
    $$('.wd').forEach(function (w) { w.classList.add('on'); });
    started.lede = started.bio = true; metaDone = true;
    caret.classList.add('gone');
  }
})();
