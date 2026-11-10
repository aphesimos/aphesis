/* @ds-bundle: {"format":4,"namespace":"Aphesis","components":[{"name":"Seal"},{"name":"Brush"},{"name":"Icons"},{"name":"Fog"},{"name":"Simulacrum"},{"name":"Typist"},{"name":"Tooltip"},{"name":"Cursor"},{"name":"LetterWave"},{"name":"ThemeShift"}]} */
/* aphes.ist design system runtime. Plain JavaScript, no framework: every screen of the site loads this one script.
   Everything visible is made of two marks: the BRUSH (a centerline with a width profile, tapered, with unsure edges)
   and the STIPPLE (small square cells that light up where a density field passes a fixed threshold). Nothing is solid. */
(function () {
  'use strict';
  /* the site always animates, whatever the system's reduce-motion setting: the motion is the work (owner's decision) */
  var REDUCED = false;
  var FINE = typeof matchMedia === 'function' && matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------- math ---------- */
  function clamp(x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, x)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* minimum-jerk easing: the curve a relaxed hand follows between two points. The only easing for things that travel. */
  function MJ(t) { t = clamp(t); return t * t * t * (10 - 15 * t + 6 * t * t); }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function gauss() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  /* tween(dur, fn(k 0..1), done): time advances at most 100 ms a frame, so a stalled frame pauses a tween instead of
     making it jump; at 10 frames a second or more it runs in real time */
  function tween(dur, fn, done) {
    var last = null, t = 0, id = 0;
    function q(now) { if (last !== null) t += Math.min(100, Math.max(0, now - last)); last = now; var k = clamp(t / Math.max(1, dur)); fn(k); if (k < 1) id = requestAnimationFrame(q); else if (done) done(); }
    id = requestAnimationFrame(q); return function () { cancelAnimationFrame(id); };
  }

  /* ---------- tokens read back from CSS (canvas-based graphics take the theme's colors) ---------- */
  var probe = null;
  function cssColor(name, el) {
    if (!probe) probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    var s = getComputedStyle(el || document.documentElement).getPropertyValue(name).trim() || '#000';
    probe.clearRect(0, 0, 1, 1); probe.fillStyle = '#000'; probe.fillStyle = s; probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255];
  }
  /* calls fn when the theme changes (system setting or data-theme); returns a function that stops listening */
  function onTheme(fn) {
    var mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    if (mq) mq.addEventListener('change', fn);
    var mo = new MutationObserver(fn); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return function () { if (mq) mq.removeEventListener('change', fn); mo.disconnect(); };
  }

  /* ================= BRUSH ================= */
  /* brush(points, width, seed, taper, wobble) -> SVG path data.
     points: the centerline, densely sampled (use arc() and line()). width: the stroke at its fullest.
     taper: the share of the length that swells in at the start and thins out at the end (0 = blunt).
     wobble: how unsure the hand is; each edge drifts on its own, so the two sides never mirror. */
  function brush(pts, w, seed, taper, amp) {
    taper = taper === undefined ? 0.22 : taper; amp = amp === undefined ? 0.08 : amp;
    var r = rng(seed || 1), n = pts.length, L = [], R = [], ph = [r() * 6, r() * 6, r() * 6];
    for (var i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      var u = i / (n - 1), k = 1;
      if (taper > 0 && u < taper) k = Math.sin(u / taper * Math.PI / 2);
      if (taper > 0 && u > 1 - taper) k = Math.min(k, Math.sin((1 - u) / taper * Math.PI / 2));
      var wob = 1 + amp * (Math.sin(u * 9 + ph[0]) + 0.5 * Math.sin(u * 23 + ph[1]));
      var wl = w * k * wob * (1 + 0.06 * Math.sin(u * 31 + ph[2])), wr = w * k * wob * (1 - 0.05 * Math.sin(u * 27 + ph[1]));
      L.push([pts[i][0] - ty * wl / 2, pts[i][1] + tx * wl / 2]); R.push([pts[i][0] + ty * wr / 2, pts[i][1] - tx * wr / 2]);
    }
    var f = function (v) { return v.toFixed(2); }, d = 'M' + f(L[0][0]) + ' ' + f(L[0][1]);
    for (i = 1; i < n; i++) d += 'L' + f(L[i][0]) + ' ' + f(L[i][1]);
    for (i = n - 1; i >= 0; i--) d += 'L' + f(R[i][0]) + ' ' + f(R[i][1]);
    return d + 'Z';
  }
  function arc(cx, cy, r, a0, a1, n, ry) { n = n || 64; var p = []; for (var i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; p.push([cx + r * Math.cos(a), cy + (ry || r) * Math.sin(a)]); } return p; }
  function line(x0, y0, x1, y1, n) { n = n || 24; var p = []; for (var i = 0; i <= n; i++) { var t = i / n; p.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); } return p; }
  /* stipple(test, seed, count, size, box) -> SVG path data of small squares inside a region.
     test(x, y): inside or not. box: the square [0, box] the cells are scattered over (24 for icons). */
  function stipple(test, seed, count, size, box) {
    size = size || 0.42; box = box || 24; var r = rng(seed), d = '';
    for (var i = 0; i < count; i++) {
      var x = r() * box, y = r() * box;
      if (test(x, y)) { var s = size * (0.7 + r() * 0.6); d += 'M' + (x - s / 2).toFixed(2) + ' ' + (y - s / 2).toFixed(2) + 'h' + s.toFixed(2) + 'v' + s.toFixed(2) + 'h' + (-s).toFixed(2) + 'z'; }
    }
    return d;
  }
  function inC(cx, cy, r) { return function (x, y) { return (x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r; }; }

  /* ================= ICONS ================= */
  /* 24-unit grid, brush strokes in currentColor, stipple as fill. Each icon has two states where it means something. */
  var ICONS = {
    eye: function (st) {
      if (!st) return { strokes: brush(arc(12, 15.5, 9, -160, -20, 40, 7), 1.7, 31) + brush(arc(12, 8.5, 9, 20, 160, 40, 7), 1.7, 33), dots: stipple(inC(12, 12, 3.1), 36, 260, 0.95) };
      var d = brush(arc(12, 8, 9, 25, 155, 40, 6), 1.8, 37);
      [-0.55, 0, 0.55].forEach(function (k, i) { var x = 12 + k * 9.5; d += brush(line(x, 14.2 - Math.abs(k) * 1.2, x + k * 1.8, 17.2 - Math.abs(k), 10), 1.2, 41 + i, 0.35, 0.05); });
      return { strokes: d, dots: '' };
    },
    sol: function () { return { strokes: brush(arc(12, 12, 7.4, -80, 272), 1.9, 3) + brush(arc(12, 12, 1.05, 0, 360, 16), 1.6, 9, 0, 0), dots: '' }; },
    luna: function () {
      return { strokes: brush(arc(12, 12, 7.4, -80, 272), 1.9, 3) + brush(arc(15.2, 10.6, 6.2, -105, 155), 1.7, 11),
        dots: stipple(function (x, y) { return inC(12, 12, 7)(x, y) && !inC(15.2, 10.6, 6.4)(x, y); }, 5, 900) };
    },
    terminator: function (st) {
      var half = st ? function (x) { return x > 12; } : function (x) { return x < 12; };
      return { strokes: brush(arc(12, 12, 7.6, -95, 268), 1.8, 21), dots: stipple(function (x, y) { return inC(12, 12, 6.4)(x, y) && half(x); }, 8, 1400) };
    },
    threshold: function (st) {
      var d = brush([].concat(line(6.5, 21, 6.5, 10.5, 12), arc(12, 10.5, 5.5, 180, 360, 24).slice(1), line(17.5, 10.5, 17.5, 21, 12).slice(1)), 1.8, 61, 0.12) + brush(line(4.5, 21.2, 19.5, 21.2, 16), 1.5, 63, 0.2);
      return { strokes: d, dots: st ? stipple(function (x, y) { return (y > 10.5 && x > 7.6 && x < 16.4 && y < 20.4) || (inC(12, 10.5, 4.4)(x, y) && y <= 10.5); }, 66, 1600) : '' };
    }
  };
  /* icon(name, state) -> inline SVG markup. Size it with CSS; color it with `color`. */
  function icon(name, st) {
    var g = ICONS[name](st || 0);
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="overflow:visible"><path d="' + g.strokes + '" fill="currentColor"/>' + (g.dots ? '<path d="' + g.dots + '" fill="currentColor" opacity=".85"/>' : '') + '</svg>';
  }

  /* ================= SEAL ================= */
  /* the φ as drawn by hand. The live drawing (φ -> Φ) lives in the brush engine on the `mark` branch;
     this is the still mark with its boil: a turbulence that is reseeded 8 times a second, so the ink never sits still. */
  var PHI = { viewBox: '69 -6 385 533', d: '__PHI_D__' };
  var sealN = 0;
  function seal(el, opts) {
    opts = opts || {}; var id = 'aphesis-boil-' + (++sealN), boil = opts.boil !== false && !REDUCED;
    el.innerHTML = '<svg viewBox="' + PHI.viewBox + '" aria-hidden="true" style="width:100%;height:100%;display:block;overflow:visible">' +
      '<filter id="' + id + '" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.030" numOctaves="1" seed="1"/>' +
      '<feDisplacementMap in="SourceGraphic" scale="' + (boil ? 7 : 0) + '" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<path d="' + PHI.d + '" fill="currentColor" fill-rule="evenodd" filter="url(#' + id + ')"/></svg>';
    var turb = el.querySelector('feTurbulence'), t = boil ? setInterval(function () { turb.setAttribute('seed', 1 + Math.floor(Math.random() * 997)); }, 125) : 0;
    return { stop: function () { clearInterval(t); } };
  }

  /* ================= STIPPLE FIELDS (WebGL) ================= */
  var NOISE = 'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}' +
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}' +
    'float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return s;}' +
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}' +
    /* the fog: three layers of fractal noise rotated by the golden angle, drifting at speeds in the ratio φ */
    'float fog(vec2 uv,float T){float d=0.;for(int i=0;i<3;i++){float fi=float(i);vec2 q=rot(fi*2.39996)*uv*(1.6*pow(1.618,fi))+vec2(T*.013*pow(1.618,fi),-T*.008*pow(1.618,fi));' +
    'vec2 w=vec2(fb(q+vec2(0.,T*.01)),fb(q+vec2(5.2,1.3)));d+=fb(q+1.7*w)/(1.+fi*.6);}return d/1.9;}';
  /* a WebGL field on a canvas: compiles the shader, keeps its uniform locations and survives losing its context.
     When the browser takes the context away (too many contexts, a GPU reset, a phone sent to the background) the
     field stops drawing; when it gives it back, the program and textures are rebuilt (init) and drawing resumes. */
  function glField(cv, fs, names, init) {
    var gl = cv.getContext('webgl', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    var P = { gl: gl, U: {}, lost: false, restored: null };
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS) && !gl.isContextLost()) console.error(gl.getShaderInfoLog(o)); return o; }
    function build() {
      var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
      names.forEach(function (k) { P.U[k] = gl.getUniformLocation(pr, k); });
      gl.viewport(0, 0, cv.width, cv.height);
      if (init) init(gl);
    }
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); P.lost = true; });
    cv.addEventListener('webglcontextrestored', function () { if (P.released) return; build(); P.lost = false; if (P.restored) P.restored(); });
    build();
    /* give the context back to the browser for good (destroy) */
    P.release = function () { P.released = true; P.lost = true; var x = gl.getExtension('WEBGL_lose_context'); if (x && !gl.isContextLost()) x.loseContext(); };
    return P;
  }
  /* CSS pixels per stipple cell on this screen: `cell` CSS pixels rounded to whole device pixels, so every cell covers
     the same whole number of device pixels at any devicePixelRatio and stays a crisp square. Size a stipple canvas,
     and move it, in multiples of this. */
  function cellPx(cell) { var d = window.devicePixelRatio || 1; return Math.max(1, Math.round((cell || 2) * d)) / d; }
  /* one canvas pixel per stipple cell: the canvas is sized to the cell grid and the browser scales it up with hard
     edges, so a cell stays a crisp square and the shader runs once per cell instead of once per screen pixel.
     Returns k, canvas pixels per CSS pixel, to convert pointer and zone positions. */
  function fit(cv, gl, cell) {
    var r = cv.getBoundingClientRect(), c = cellPx(cell), w = Math.max(1, Math.round(r.width / c)), h = Math.max(1, Math.round(r.height / c));
    if (cv.style.imageRendering !== 'pixelated') cv.style.imageRendering = 'pixelated';
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
    return w / Math.max(1, r.width);
  }
  /* the eye's theme shift (themeShift) drives the same switch as a wave instead: each cell turns when the wave from
     the origin reaches it, loosened by a hash and the fog's noise so the front is grainy and uneven. SO: the origin in
     canvas pixels, z = 1 while a wave runs; SF: the distance to the farthest corner. */
  var SWITCH_GLSL = 'uniform vec3 SO;uniform float SF;' +
    'float sw(vec2 cel,vec2 uv,float X){if(SO.z>.5)return step(.76*length(cel+.5-SO.xy)/SF+.14*h(cel+vec2(17.3,5.1))+.1*n(cel/23.+5.1),X);' +
    'return step(smoothstep(.32,.68,fb(uv*1.7+vec2(3.7,9.1)))*.86+h(cel+vec2(17.3,5.1))*.14,X);}';
  function waveUniforms(gl, U, cv, k, c) {
    var w = c.wave; if (!w) { gl.uniform3f(U.SO, 0, 0, 0); gl.uniform1f(U.SF, 1); return; }
    var r = cv.getBoundingClientRect(), cpx = cv.width / Math.max(1, r.width);
    gl.uniform3f(U.SO, (w.o[0] - r.left) * cpx, cv.height - (w.o[1] - r.top) * cpx, 1); gl.uniform1f(U.SF, Math.max(1, w.far * cpx));
  }
  /* the theme's colours for a canvas, read the moment the theme changes. The change is a stipple dissolve over
     duration-theme, eased with minimum jerk: the new colours spread through the old in soft patches of the fog's own
     noise, cell by cell at their grainy edges, so no frame passes through a flat middle grey where cells and ground
     are the same colour, none turns to static, and every canvas on the page changes in step. Returns now -> {a: old colours, b: new colours, x: share of cells switched}. */
  function palette(el, names) {
    function read() { return names.map(function (n) { return cssColor(n, el); }); }
    function ms() { var v = getComputedStyle(document.documentElement).getPropertyValue('--duration-theme').trim(); var n = parseFloat(v); return isNaN(n) ? 800 : (/ms$/.test(v) ? n : n * 1000); }
    var to = read(), from = to, t0 = -1, dur = 800, x = 1, wave = false;
    function same(a, b) { return a.every(function (c, i) { return c.every(function (v, j) { return Math.abs(v - b[i][j]) < 1e-3; }); }); }
    function retarget() { var next = read(); if (same(next, to)) return; from = x < 0.5 ? from : to; to = next; t0 = performance.now(); dur = ms(); x = 0; wave = !!SHIFT; }
    var later = 0, off = onTheme(function () { retarget(); clearTimeout(later); later = setTimeout(retarget, 120); });
    function colors(now) {
      if (t0 >= 0 && wave) { if (SHIFT) x = SHIFT.p; else { t0 = -1; from = to; x = 1; wave = false; } }
      else if (t0 >= 0) { var k = REDUCED ? 1 : clamp((now - t0) / Math.max(1, dur)); x = MJ(k); if (k >= 1) { t0 = -1; from = to; x = 1; } }
      return { a: from, b: to, x: x, wave: wave && SHIFT ? SHIFT : null };
    }
    /* colors.off(): stop following the theme */
    colors.off = function () { off(); clearTimeout(later); };
    return colors;
  }
  /* the frame loop of a field: stop() halts it, start() resumes it, drawn(cb) calls back once the next frame is on
     the canvas (a canvas should stay invisible until then) */
  function loop(draw) {
    var raf = 0, waiting = [];
    function frame(now) { raf = requestAnimationFrame(frame); if (draw(now) !== false && waiting.length) { var w = waiting; waiting = []; w.forEach(function (f) { f(); }); } }
    return {
      start: function () { if (!raf) raf = requestAnimationFrame(frame); },
      stop: function () { cancelAnimationFrame(raf); raf = 0; },
      drawn: function (cb) { waiting.push(cb); },
      get running() { return !!raf; }
    };
  }

  /* ---------- Fog ----------
     Fog(canvas, {density, light, cell}) -> {zones(rects), set({density, light}), stop(), start()}
     the stippled ground of every screen. density 0..1 (home 1, inside a section .62); light: the soft rise of dots
     around the pointer (home 1, section .4). zones: up to 12 calm rectangles behind text (elements or DOMRects). */
  function Fog(cv, o) {
    o = o || {}; var P = glField(cv, 'precision highp float;uniform vec2 R;uniform float T,D,C,S,X;uniform vec3 F,N,F2,N2;uniform vec2 P;uniform vec4 Z[12];' + NOISE + SWITCH_GLSL +
      'void main(){vec2 cel=floor(gl_FragCoord.xy/S);vec2 uv=(cel*S-R*.5)/min(R.x,R.y);float d=fog(uv,T);' +
      'float vin=smoothstep(1.45,.35,length(uv*vec2(.9,1.)))*.85+.15;vec2 pp=(P-R*.5)/min(R.x,R.y);float luz=exp(-dot(uv-pp,uv-pp)*7.)*.35;' +
      'float m=smoothstep(.44,.74,d);float dens=(m*.8+.012)*vin*D+luz*vin*C*m;' +
      'for(int i=0;i<12;i++){vec4 z=Z[i];if(z.z>0.){vec2 q=abs(gl_FragCoord.xy-z.xy)/z.zw;dens*=1.-.8*(1.-smoothstep(.45,1.05,length(q)));}}' +
      /* a theme change spreads through the fog in soft patches with grainy edges */
      'float s=sw(cel,uv,X);vec3 Fc=mix(F,F2,s),Nc=mix(N,N2,s);' +
      'gl_FragColor=vec4(mix(Fc,Nc,step(h(cel),dens)*.55),1.);}', ['R', 'T', 'D', 'C', 'S', 'X', 'F', 'N', 'F2', 'N2', 'P', 'Z', 'SO', 'SF']);
    if (!P) return { zones: function () {}, set: function () {}, stop: function () {}, start: function () {}, destroy: function () {} };
    var gl = P.gl, U = P.U, colors = palette(cv, ['--bg', '--fog']);
    var ptr = null, sm = null, t = 0, last = performance.now(), zEls = [], ZB = new Float32Array(48);
    var dens = o.density === undefined ? 1 : o.density, light = o.light === undefined ? 1 : o.light, dpr = 1;
    function onMove(e) { var r = cv.getBoundingClientRect(); ptr = [e.clientX - r.left, e.clientY - r.top]; }
    window.addEventListener('pointermove', onMove);
    var L = loop(function (now) {
      var dt = Math.min(0.05, Math.max(0, now - last) / 1000); last = now; if (!REDUCED) t += dt;
      if (P.lost) return false;
      dpr = fit(cv, gl, o.cell || 2);
      var R = cv.getBoundingClientRect(); if (!ptr) ptr = [R.width / 2, R.height / 2]; if (!sm) sm = ptr.slice();
      sm[0] += (ptr[0] - sm[0]) * Math.min(1, dt * 3); sm[1] += (ptr[1] - sm[1]) * Math.min(1, dt * 3);
      ZB.fill(0); var i = 0;
      zEls.forEach(function (z) { if (i >= 12) return; var r = z.el ? z.el.getBoundingClientRect() : z; if (!r.width) return; var pad = z.pad || 12;
        ZB.set([(r.left - R.left + r.width / 2) * dpr, cv.height - (r.top - R.top + r.height / 2) * dpr, (r.width / 2 + pad) * dpr, (r.height / 2 + pad) * dpr], i * 4); i++; });
      var c = colors(now);
      gl.uniform4fv(U.Z, ZB); gl.uniform2f(U.R, cv.width, cv.height); gl.uniform1f(U.T, t); gl.uniform1f(U.S, 1);
      gl.uniform3fv(U.F, c.a[0]); gl.uniform3fv(U.N, c.a[1]); gl.uniform3fv(U.F2, c.b[0]); gl.uniform3fv(U.N2, c.b[1]); gl.uniform1f(U.X, c.x); waveUniforms(gl, U, cv, dpr, c); gl.uniform2f(U.P, sm[0] * dpr, cv.height - sm[1] * dpr); gl.uniform1f(U.D, dens); gl.uniform1f(U.C, light);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    L.start();
    return {
      zones: function (list) { zEls = (list || []).map(function (z) { return z instanceof Element ? { el: z } : z; }); },
      set: function (k) { if (k.density !== undefined) dens = k.density; if (k.light !== undefined) light = k.light; },
      stop: L.stop, start: function () { if (P.released) return; last = performance.now(); L.start(); },
      /* destroy(): stop for good: the loop, the pointer and theme listeners, and the WebGL context */
      destroy: function () { L.stop(); window.removeEventListener('pointermove', onMove); colors.off(); P.release(); }
    };
  }

  /* ---------- Simulacrum ----------
     a picture that exists only as fog: an image becomes a density field, and the same square cells as the fog
     light up where it is dense. It coalesces out of the fog and dissolves back into it.
     Simulacrum(canvas, {source, fit:'contain'|'cover', gain, scatter, erosion, ceiling, cell, accent, margin, ground})
       -> {show(src?, done), hide(done), set(src, done), stop(), start(), drawn(cb)}
     scatter (default .5): lost points drifting loose around the figure. erosion (.45): fog-shaped holes inside it.
     ceiling (.8): the most any area can fill. A picture with none of these looks printed, not conjured.
     ground (true): the canvas paints the page's ground under its cells. ground: false leaves everything but the cells
     transparent, so the picture lies over the fog with no blend mode, and an undrawn canvas shows nothing.
     A source can carry its own settings: {src, gain, scatter, erosion, ceiling}. The options object stays live:
     gain, scatter, erosion, ceiling, accent, margin and fit are read from it on every frame.
     One canvas can show one picture after another: hide(), then show(next). stop() rests it while it is hidden,
     start() wakes it, drawn(cb) says when its next frame is on screen.
     source: an image URL, an <img>/<canvas>, or Simulacrum.fromBrush(draw, w, h).
     The density map is grayscale: white = full, black = empty. Prepare engravings inverted, so their lines become light. */
  function Simulacrum(cv, o) {
    o = o || {};
    var tex = null, tex2 = null, last = performance.now(), ptr = [-1e4, -1e4], cancel = null, lastImg = null, IA = [1, 1], k = 0, t = Math.random() * 50;
    function texture(x, unit) {
      var q = x.createTexture(); x.activeTexture(unit); x.bindTexture(x.TEXTURE_2D, q);
      x.texParameteri(x.TEXTURE_2D, x.TEXTURE_MIN_FILTER, x.LINEAR); x.texParameteri(x.TEXTURE_2D, x.TEXTURE_MAG_FILTER, x.LINEAR);
      x.texParameteri(x.TEXTURE_2D, x.TEXTURE_WRAP_S, x.CLAMP_TO_EDGE); x.texParameteri(x.TEXTURE_2D, x.TEXTURE_WRAP_T, x.CLAMP_TO_EDGE);
      x.texImage2D(x.TEXTURE_2D, 0, x.LUMINANCE, 1, 1, 0, x.LUMINANCE, x.UNSIGNED_BYTE, new Uint8Array([0]));
      return q;
    }
    var P = glField(cv, 'precision highp float;uniform vec2 R,P;uniform float T,S,K,G,M,A,FIT,SC,ER,CE,GR,X;uniform vec3 F,N,AC,F2,N2,AC2;uniform vec2 IA;uniform sampler2D I,I2;' + NOISE + SWITCH_GLSL +
      'void main(){vec2 cel=floor(gl_FragCoord.xy/S);vec2 c=cel*S+S*.5;vec2 uv=(c-R*.5)/min(R.x,R.y);' +
      'float d=fog(uv*.8,T);' +
      /* fit the image in the canvas */
      'vec2 box=R*(1.-M);float sc=FIT>.5?max(box.x/IA.x,box.y/IA.y):min(box.x/IA.x,box.y/IA.y);vec2 sz=IA*sc;' +
      /* the picture breathes: before it settles its cells are pushed around by the fog */
      'vec2 jit=(vec2(fb(uv*3.+T*.05),fb(uv*3.+7.3-T*.04))-.5)*(1.-K)*.18*min(R.x,R.y);' +
      'vec2 iu=(c+jit-(R-sz)*.5)/sz;iu.y=1.-iu.y;float inside=step(0.,iu.x)*step(iu.x,1.)*step(0.,iu.y)*step(iu.y,1.);' +
      'vec2 e=min(iu,1.-iu);float feather=smoothstep(0.,.07,min(e.x,e.y));' +
      'float img=pow(texture2D(I,clamp(iu,0.,1.)).r,1.15)*inside*feather;' +
      'vec2 pp=(P-R*.5)/min(R.x,R.y);float luz=exp(-dot(uv-pp,uv-pp)*9.);' +
      'float kk=clamp(K+luz*.35*K,0.,1.);' +
      'float mist=smoothstep(.44,.78,d)*.5;' +
      /* never picture-perfect: erosion opens fog-shaped holes in the figure, the ceiling keeps even the lightest
         areas from going solid, and scatter lets some of the picture drift loose as lost points around it */
      'float er=smoothstep(.28,.78,fb(uv*4.2+vec2(T*.012,-T*.009)+3.1));' +
      'float pic=img*G*(.82+.36*d)*mix(1.,.3+.7*er,ER)*CE;' +
      /* the glow: a heavily blurred copy of the picture, padded by half its size on every side, so lost points
         thin out from the figure into the fog instead of stopping at its edge */
      'vec2 gu=(iu-.5)/2.+.5;gu.y=gu.y;float glow=texture2D(I2,clamp(gu,0.,1.)).r;' +
      'float stray=SC*(pow(glow,.8)*(.45+.8*d)*.75+.02*smoothstep(.36,.8,d))*clamp(1.-img*1.6,0.,1.);' +
      'float dens=mix(mist,pic+stray+mist*.12,kk);' +
      /* threshold: interleaved gradient noise (even, blue-ish) mixed with a hash (organic), so tones read as tones */
      'float ign=fract(52.9829189*fract(dot(cel,vec2(.06711056,.00583715))));float lit=step(mix(ign,h(cel),.35),dens);' +
      'float red=step(h(cel+31.7),A*img*kk);' +
      /* a theme change spreads in the same patches as the fog's */
      'float s=sw(cel,uv,X);vec3 Fc=mix(F,F2,s),Nc=mix(N,N2,s),Ac=mix(AC,AC2,s);' +
      'vec3 col=mix(Nc,Ac,red);gl_FragColor=GR>.5?vec4(mix(Fc,col,lit*.72),1.):vec4(col,lit*.72);}',
      ['R', 'P', 'T', 'S', 'K', 'G', 'M', 'A', 'FIT', 'SC', 'ER', 'CE', 'GR', 'X', 'F', 'N', 'AC', 'F2', 'N2', 'AC2', 'IA', 'I', 'I2', 'SO', 'SF'],
      function (x) { tex = texture(x, x.TEXTURE0); tex2 = texture(x, x.TEXTURE1); x.activeTexture(x.TEXTURE0); if (lastImg) upload(lastImg); });
    var noop = function () {};
    if (!P) return { show: function (s, d) { d && d(); }, hide: function (d) { d && d(); }, set: function (s, d) { d && d(); }, stop: noop, start: noop, drawn: function (cb) { cb(); }, destroy: noop };
    var gl = P.gl, U = P.U, colors = palette(cv, ['--bg', '--fog', '--accent']);
    function onMove(e) { var r = cv.getBoundingClientRect(); ptr = [e.clientX - r.left, e.clientY - r.top]; }
    window.addEventListener('pointermove', onMove);
    function upload(img) {
      lastImg = img;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img); IA = [img.naturalWidth || img.width, img.naturalHeight || img.height];
      /* glow texture: the picture at half size in the middle of a canvas twice as large, blurred wide */
      var g = document.createElement('canvas'), W = 192, H = Math.max(8, Math.round(192 * IA[1] / IA[0])); g.width = W; g.height = H; var x = g.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.filter = 'blur(' + Math.round(W * 0.045) + 'px)'; x.drawImage(img, W / 4, H / 4, W / 2, H / 2); x.drawImage(g, 0, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, g); gl.activeTexture(gl.TEXTURE0);
    }
    var cur = {};   /* per-source overrides: {src, gain, scatter, erosion, ceiling} */
    function opt(k, d) { return cur[k] !== undefined ? cur[k] : (o[k] !== undefined ? o[k] : d); }
    function load(src, cb) {
      if (src && src.src) { cur = src; src = src.src; } else cur = {};
      if (typeof src !== 'string') { if (!P.lost) upload(src); else lastImg = src; cb && cb(); return; }
      var im = new Image(); if (/^https?:/.test(src) && src.indexOf(location.origin) !== 0) im.crossOrigin = 'anonymous'; im.onload = function () { if (!P.lost) upload(im); else lastImg = im; cb && cb(); }; im.src = src;
    }
    var L = loop(function (now) {
      var dt = Math.min(0.05, Math.max(0, now - last) / 1000); last = now; if (!REDUCED) t += dt;
      if (P.lost) return false;
      var dpr = fit(cv, gl, o.cell || 2), c = colors(now);
      gl.uniform2f(U.R, cv.width, cv.height); gl.uniform2f(U.P, ptr[0] * dpr, cv.height - ptr[1] * dpr); gl.uniform1f(U.T, t);
      gl.uniform1f(U.S, 1); gl.uniform1f(U.K, MJ(k)); gl.uniform1f(U.G, opt('gain', 1)); gl.uniform1f(U.SC, opt('scatter', 0.5)); gl.uniform1f(U.ER, opt('erosion', 0.45)); gl.uniform1f(U.CE, opt('ceiling', 0.8)); gl.uniform1f(U.M, o.margin === undefined ? 0.08 : o.margin);
      gl.uniform1f(U.A, o.accent || 0); gl.uniform1f(U.FIT, o.fit === 'cover' ? 1 : 0); gl.uniform1f(U.GR, o.ground === false ? 0 : 1); gl.uniform3fv(U.F, c.a[0]); gl.uniform3fv(U.N, c.a[1]); gl.uniform3fv(U.AC, c.a[2]); gl.uniform3fv(U.F2, c.b[0]); gl.uniform3fv(U.N2, c.b[1]); gl.uniform3fv(U.AC2, c.b[2]); gl.uniform1f(U.X, c.x); waveUniforms(gl, U, cv, dpr, c);
      gl.uniform2f(U.IA, IA[0], IA[1]); gl.uniform1i(U.I, 0); gl.uniform1i(U.I2, 1);
      if (o.ground === false) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    L.start();
    function to(target, dur, done) { if (cancel) cancel(); var k0 = k; if (REDUCED) { k = target; done && done(); return; } cancel = tween(dur, function (e) { k = lerp(k0, target, e); }, done); }
    var api = {
      /* coalesce out of the fog (2.6 s); with a source, swap it in first */
      show: function (src, done) { if (src) load(src, function () { to(1, 2600, done); }); else to(1, 2600, done); },
      /* dissolve back into the fog (1.8 s) */
      hide: function (done) { to(0, 1800, done); },
      /* dissolve, swap, coalesce */
      set: function (src, done) { to(0, 1500, function () { load(src, function () { to(1, 2600, done); }); }); },
      stop: function () { L.stop(); if (cancel) cancel(); cancel = null; },
      /* destroy(): stop for good: the loop, any tween, the pointer and theme listeners, and the WebGL context */
      destroy: function () { api.stop(); window.removeEventListener('pointermove', onMove); colors.off(); P.release(); },
      start: function () { if (P.released) return; last = performance.now(); L.start(); },
      drawn: L.drawn
    };
    if (o.source) api.show(o.source);
    return api;
  }
  /* a density map drawn with the brush: draw(ctx, w, h) paints white on black; returns a canvas to pass as source */
  Simulacrum.fromBrush = function (draw, w, h) {
    var c = document.createElement('canvas'); c.width = w || 512; c.height = h || 512; var x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; draw(x, c.width, c.height);
    return c;
  };

  /* ================= TYPIST ================= */
  /* types a line the way a person does. rhythm: each keystroke varies around a base pace (log-normal), slower at the
     start of a word, on capitals and after punctuation. errors: now and then a neighbouring key, noticed a letter or two
     later, deleted and retyped. once in a while it rethinks a whole word. erasing: a few taps that speed up, then whole
     words at a time, like a held delete key. The caret is solid while typing and blinks when idle. */
  var ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'], NEAR = {};
  ROWS.forEach(function (r, y) { r.split('').forEach(function (c, x) { var nb = []; [[y, x - 1], [y, x + 1], [y - 1, x], [y - 1, x + 1], [y + 1, x], [y + 1, x - 1]].forEach(function (p) { if (ROWS[p[0]] && ROWS[p[0]][p[1]]) nb.push(ROWS[p[0]][p[1]]); }); NEAR[c] = nb; }); });
  function isLetter(c) { return /\p{L}/u.test(c); }
  function wrongKey(c, pool) { var lo = c.toLowerCase(); if (NEAR[lo]) { var nk = NEAR[lo][Math.floor(Math.random() * NEAR[lo].length)]; return c === lo ? nk : nk.toUpperCase(); } var p = pool.filter(function (x) { return isLetter(x) && x !== c; }); return p.length ? p[Math.floor(Math.random() * p.length)] : c; }
  function plan(text, pace) {
    var ch = Array.from(text), ops = [], rethought = false;
    function key(c, prev) { var d = pace * Math.exp(gauss() * 0.32); if (prev === ' ' || prev === undefined) d *= 1.3; if (c !== c.toLowerCase()) d += pace * 0.6; if (/[,;:]/.test(prev)) d += 140 + Math.random() * 180; if (/[.!?]/.test(prev)) d += 260 + Math.random() * 300; if (Math.random() < 0.03) d += 200 + Math.random() * 380; return d; }
    for (var i = 0; i < ch.length; i++) {
      var c = ch[i], prev = ch[i - 1];
      if (!rethought && c === ' ' && i > ch.length / 3 && i < ch.length - 3 && Math.random() < 0.22) {
        rethought = true; var j = i - 1; while (j >= 0 && ch[j] !== ' ') j--; var word = ch.slice(j + 1, i);
        ops.push(['wait', '', 520 + Math.random() * 420]); word.forEach(function (_, q) { ops.push(['del', '', q === 0 ? 160 : 55 + Math.random() * 35]); });
        ops.push(['wait', '', 260 + Math.random() * 300]); word.forEach(function (w, q) { ops.push(['add', w, key(w, q ? word[q - 1] : ' ') * 0.9]); });
      }
      if (i > 0 && isLetter(c) && Math.random() < 0.045) {
        var extra = Math.random() < 0.55 ? Math.min(1 + Math.floor(Math.random() * 2), ch.length - 1 - i) : 0;
        ops.push(['add', wrongKey(c, ch), key(c, prev)]); for (var q = 1; q <= extra; q++) ops.push(['add', ch[i + q], key(ch[i + q], ch[i + q - 1]) * 0.85]);
        ops.push(['wait', '', 180 + Math.random() * 320]); for (q = 0; q <= extra; q++) ops.push(['del', '', q === 0 ? 120 : 50 + Math.random() * 30]);
        ops.push(['add', c, pace * (1.1 + Math.random() * 0.5)]); for (q = 1; q <= extra; q++) ops.push(['add', ch[i + q], key(ch[i + q], ch[i + q - 1])]);
        i += extra; continue;
      }
      ops.push(['add', c, key(c, prev)]);
    }
    return ops;
  }
  function Typist(el, caret) { this.el = el; this.caret = caret; this.t = null; this.buf = []; }
  Typist.prototype.stop = function () { clearTimeout(this.t); };
  Typist.prototype._show = function () { this.el.textContent = this.buf.join(''); };
  Typist.prototype.type = function (text, done) {
    var self = this, ca = this.caret; this.stop(); this.buf = []; this._show();
    if (REDUCED) { this.buf = Array.from(text); this._show(); done && done(); return; }
    var ops = plan(text, 44 + Math.random() * 26), i = 0; ca && ca.classList.add('blink');
    function step() {
      if (i >= ops.length) { ca && ca.classList.add('blink'); done && done(); return; }
      var op = ops[i++];
      self.t = setTimeout(function () { if (op[0] === 'add') self.buf.push(op[1]); else if (op[0] === 'del') self.buf.pop();
        if (op[0] !== 'wait') { self._show(); ca && ca.classList.remove('blink'); } else ca && ca.classList.add('blink'); step(); }, op[2]);
    }
    this.t = setTimeout(function () { ca && ca.classList.remove('blink'); step(); }, 900 + Math.random() * 700);
  };
  Typist.prototype.erase = function (done) {
    var self = this, ca = this.caret, taps = 3 + Math.floor(Math.random() * 4), d = 150; this.stop();
    function step() {
      if (!self.buf.length) { ca && ca.classList.add('blink'); done && done(); return; }
      ca && ca.classList.remove('blink');
      if (taps > 0) { self.buf.pop(); taps--; self._show(); d = Math.max(55, d * 0.78); self.t = setTimeout(step, d * Math.exp(gauss() * 0.15)); return; }
      while (self.buf.length && self.buf[self.buf.length - 1] === ' ') self.buf.pop();
      while (self.buf.length && self.buf[self.buf.length - 1] !== ' ') self.buf.pop();
      self._show(); self.t = setTimeout(step, 170 + Math.random() * 120);
    }
    this.t = setTimeout(step, 0);
  };
  /* loop(lines, hold): type a random line, rest, erase, type another; forever */
  Typist.prototype.loop = function (lines, hold, onLine) {
    var self = this, last = -1; hold = hold || 6500;
    function next() { var i; do { i = Math.floor(Math.random() * lines.length); } while (lines.length > 1 && i === last); last = i; onLine && onLine(lines[i], i);
      var txt = typeof lines[i] === 'string' ? lines[i] : lines[i].text;
      self.type(txt, function () { if (REDUCED) return; self.t = setTimeout(function () { self.erase(function () { self.t = setTimeout(next, 900 + Math.random() * 900); }); }, hold + Math.random() * 3500); }); }
    next();
  };

  /* ================= TOOLTIP ================= */
  /* any element with data-tip. waits 420 ms, appears beside the pointer, types its text quickly. never the browser's title. */
  var tipEl = null;
  function tooltip(root) {
    if (tipEl) return; root = root || document.body;
    tipEl = document.createElement('div'); tipEl.className = 'aph-tip'; tipEl.setAttribute('aria-hidden', 'true'); root.appendChild(tipEl);
    var target = null, wait = null, typing = null, mx = 0, my = 0;
    function place() { var r = tipEl.getBoundingClientRect(), pad = 16, x = mx + 18, y = my + 20; if (x + r.width > innerWidth - pad) x = mx - 18 - r.width; if (y + r.height > innerHeight - pad) y = my - 20 - r.height; tipEl.style.left = Math.max(pad, x) + 'px'; tipEl.style.top = Math.max(pad, y) + 'px'; }
    function show(t) { clearTimeout(typing); var txt = t.dataset.tip || ''; tipEl.textContent = ''; tipEl.classList.add('on'); place();
      if (REDUCED) { tipEl.textContent = txt; place(); return; }
      var i = 0, ch = Array.from(txt); (function step() { tipEl.textContent = ch.slice(0, ++i).join(''); place(); if (i < ch.length) typing = setTimeout(step, 12 + Math.random() * 16); })(); }
    function hide() { clearTimeout(wait); clearTimeout(typing); tipEl.classList.remove('on'); target = null; }
    addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; var t = e.target.closest && e.target.closest('[data-tip]');
      if (t !== target) { hide(); if (t) { target = t; wait = setTimeout(function () { show(t); }, 420); } } else if (tipEl.classList.contains('on')) place(); });
    addEventListener('pointerdown', hide); addEventListener('blur', hide);
  }

  /* ================= CURSOR ================= */
  /* a disc in difference blend: always the negative of what it covers. small at rest (.2), it opens over anything you
     can act on (1), tightens on press (x.78). Only on fine pointers; elsewhere the system cursor stays. */
  var curEl = null;
  function cursor(root) {
    if (curEl || !FINE) return; root = root || document.body;
    curEl = document.createElement('div'); curEl.className = 'aph-cursor'; curEl.setAttribute('aria-hidden', 'true'); root.appendChild(curEl);
    document.documentElement.classList.add('aph-has-cursor');
    var x = -100, y = -100, tx = -100, ty = -100, s = 0.2, ts = 0.2, down = false, last = performance.now();
    addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; curEl.classList.add('on'); var t = e.target.closest && e.target.closest('a,button,[data-cursor]'); ts = t ? (+(t.dataset.cursor || 1)) : 0.2; });
    document.addEventListener('pointerleave', function () { curEl.classList.remove('on'); });
    addEventListener('pointerdown', function () { down = true; }); addEventListener('pointerup', function () { down = false; });
    (function step(now) { var dt = Math.min(0.05, (now - last) / 1000); last = now; var k = REDUCED ? 1 : Math.min(1, dt * 22), ks = REDUCED ? 1 : Math.min(1, dt * 10);
      x += (tx - x) * k; y += (ty - y) * k; s += ((down ? ts * 0.78 : ts) - s) * ks;
      curEl.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')'; requestAnimationFrame(step); })(last);
  }

  /* ================= THEME SHIFT ================= */
  /* themeShift(apply, {origin, duration, done}): the theme changes in the ground only, and the page never stops.
     apply() switches the theme at once (e.g. sets data-theme). Every stipple field (Fog, Simulacrum) then lets the
     change seep outward from the origin (the eye) cell by cell, while its fog keeps drifting: a cell simply takes the
     new theme's colours when the wave reaches it. Nothing is laid over the page, nothing hides, nothing pauses:
     links, buttons and routes keep working while it runs.
     Black-and-white text follows the ground pixel by pixel: while the wave runs, every element marked .aph-ink blends
     by difference with white ink, which reads as the negative of whatever cell lies under it, so it is the right ink
     over old cells and new ones alike. When the wave has covered the screen the blend is lifted; nothing visibly
     changes. A call while a wave is running is ignored (returns false). */
  var SHIFT = null;
  function themeShift(apply, o) {
    o = o || {};
    if (SHIFT) return false;
    var root = document.documentElement, before = root.getAttribute('data-theme');
    var dark = before ? before === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var softA = cssColor('--ink-soft'), lineA = cssColor('--line');
    var org = o.origin || [24, innerHeight - 24], W = innerWidth, H = innerHeight;
    var far = Math.max(Math.hypot(org[0], org[1]), Math.hypot(W - org[0], org[1]), Math.hypot(org[0], H - org[1]), Math.hypot(W - org[0], H - org[1]));
    SHIFT = { o: org, far: far, p: 0 };
    /* colour transitions would smear the switch into and out of difference: hold them off for two frames at each end */
    function still() { root.classList.add('aph-still'); requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('aph-still'); }); }); }
    still(); apply();
    var softB = cssColor('--ink-soft'), lineB = cssColor('--line');
    /* a grey under difference shows as itself on a dark ground and as its negative on a light one:
       take the grey that reads as each theme's own grey on its own ground */
    function grey(a, b) { var dk = dark ? a : b, lt = dark ? b : a; return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round((dk[i] + 1 - lt[i]) / 2 * 255); }).join(',') + ')'; }
    root.style.setProperty('--shift-soft', grey(softA, softB)); root.style.setProperty('--shift-line', grey(lineA, lineB));
    root.classList.add('aph-shifting');
    var dur = o.duration || cssMs('--duration-shift', 5200), t = 0, last = null;
    /* time advances at most 100 ms a frame, like tween(): a stalled frame pauses the wave instead of jumping it */
    function tick(now) {
      if (last !== null) t += Math.min(100, Math.max(0, now - last)); last = now;
      var k = clamp(t / dur); SHIFT.p = MJ(k);
      if (k < 1) { requestAnimationFrame(tick); return; }
      still(); root.classList.remove('aph-shifting'); SHIFT = null; if (o.done) o.done();
    }
    requestAnimationFrame(tick);
    return true;
  }
  function cssMs(name, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(), n = parseFloat(v); return isNaN(n) ? d : (/ms$/.test(v) ? n : n * 1000); }

  /* ================= LETTER WAVE ================= */
  /* split a short label into letters so a hover can lift them one after another (CSS: .aph-wave). */
  function letters(el) {
    if (!el || el.dataset.split) return; var txt = el.textContent; el.dataset.split = 1; el.setAttribute('aria-label', txt); el.textContent = '';
    Array.from(txt).forEach(function (c, i) { var s = document.createElement('span'); s.className = 'ltr'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--i', i); s.textContent = c === ' ' ? ' ' : c; el.appendChild(s); });
  }

  window.Aphesis = {
    reducedMotion: REDUCED, MJ: MJ, cellPx: cellPx, lerp: lerp, clamp: clamp, tween: tween, rng: rng, cssColor: cssColor,
    brush: brush, arc: arc, line: line, stipple: stipple, inC: inC,
    icon: icon, ICONS: ICONS, PHI: PHI, seal: seal,
    Fog: Fog, Simulacrum: Simulacrum, Typist: Typist, tooltip: tooltip, cursor: cursor, letters: letters, themeShift: themeShift
  };
})();
