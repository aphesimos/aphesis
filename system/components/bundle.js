/* @ds-bundle: {"format":4,"namespace":"Aphesis","components":[{"name":"Seal"},{"name":"Brush"},{"name":"Icons"},{"name":"Fog"},{"name":"Simulacrum"},{"name":"Typist"},{"name":"Tooltip"},{"name":"Cursor"},{"name":"LetterWave"},{"name":"ThemeShift"},{"name":"Sound"}]} */
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
  var PHI = { viewBox: '69 -6 385 533', d: 'M249.62 521.76C248.36 521.24 247.86 520.12 247.49 516.93C246.94 512.14 245.95 505.72 245.10 501.38C244.62 498.91 244.11 495.71 243.98 494.26C243.85 492.81 243.45 489.49 243.08 486.88C242.16 480.21 242.03 478.63 241.77 469.88C241.64 465.61 241.41 460.83 241.26 459.25C240.55 451.79 240.92 427.05 241.87 418.43C242.47 413.06 242.43 403.10 241.80 399.12C240.83 393.02 240.88 379.73 241.91 370.25C242.33 366.40 242.38 359.33 242.03 354.67C241.76 351.05 241.68 350.97 237.16 349.86C232.75 348.78 227.52 348.00 224.65 348.00C211.59 348.00 194.21 342.73 174.50 332.80C166.47 328.76 162.60 326.27 155.82 320.82C154.49 319.75 152.12 317.84 150.54 316.58C144.03 311.35 131.73 299.34 125.63 292.24C124.39 290.80 122.72 288.89 121.91 288.00C117.78 283.43 110.64 273.94 107.13 268.38C106.61 267.55 105.27 265.64 104.14 264.12C99.55 257.98 91.18 244.36 87.69 237.38C84.17 230.32 82.60 223.54 81.50 210.62C80.58 199.72 79.74 195.01 77.51 188.12C75.52 182.00 75.01 179.84 73.46 171.00C73.24 169.75 73.13 166.79 73.13 162.12C73.13 155.55 73.17 154.88 73.84 151.12C75.18 143.51 77.13 137.32 79.75 132.38C81.92 128.27 90.62 110.76 91.00 109.75C91.53 108.31 102.10 87.07 103.63 84.38C104.41 83.00 106.29 79.57 107.80 76.75C116.63 60.36 124.58 48.79 135.67 36.22C139.57 31.80 144.98 26.71 151.96 20.91C153.01 20.03 156.95 17.17 161.25 14.15C170.71 7.52 178.46 4.09 189.60 1.63C200.84 -0.86 210.83 -0.42 223.35 3.13C225.54 3.74 227.48 4.25 227.67 4.25C228.38 4.25 231.16 5.31 232.04 5.91C234.14 7.35 234.34 10.20 232.46 11.91C231.17 13.09 226.67 14.97 217.15 18.30C206.25 22.11 200.24 26.35 190.14 37.38C187.14 40.65 185.45 42.69 179.88 49.77C177.23 53.13 171.79 58.78 168.76 61.32C167.59 62.30 165.50 64.23 164.12 65.61C155.71 74.06 149.56 89.27 145.63 111.37C145.01 114.86 144.23 119.21 143.90 121.05C143.56 122.88 143.16 125.39 143.01 126.62C142.85 127.86 142.62 129.32 142.50 129.88C141.95 132.36 140.00 144.14 139.74 146.50C139.59 147.94 139.36 149.65 139.24 150.29C138.32 155.15 137.82 174.75 138.46 180.50C138.91 184.47 140.65 194.70 141.30 197.12C141.59 198.22 142.60 201.20 143.54 203.73C145.49 208.98 145.99 210.68 147.13 215.75C147.57 217.74 148.34 220.89 148.84 222.75C149.34 224.61 150.03 227.64 150.37 229.49C152.17 239.05 156.73 251.79 159.70 255.58C161.77 258.23 166.17 264.74 168.47 268.56C170.86 272.54 180.44 285.33 183.50 288.63C184.53 289.74 186.39 291.82 187.62 293.24C188.86 294.67 190.78 296.86 191.89 298.11C193.00 299.35 194.71 301.34 195.68 302.53C199.28 306.88 206.95 313.32 210.75 315.18C212.06 315.82 213.69 316.68 214.38 317.09C223.11 322.24 238.96 327.49 241.08 325.94C241.57 325.58 241.85 324.03 242.23 319.62C242.37 317.98 242.68 314.99 242.92 313.00C243.47 308.40 243.54 288.59 243.03 281.00C242.38 271.21 242.27 269.80 241.85 265.62C240.90 256.22 241.31 230.70 242.51 223.62C242.65 222.80 242.87 219.99 242.99 217.38C243.12 214.76 243.36 211.37 243.53 209.84C243.84 207.09 243.72 203.89 243.00 196.12C242.89 194.89 242.78 192.00 242.77 189.71C242.76 187.42 242.59 184.05 242.39 182.21C241.72 175.97 240.67 159.91 240.25 149.50C240.00 143.15 240.26 128.52 240.75 121.50C240.89 119.51 241.06 116.97 241.14 115.88C241.21 114.78 241.43 112.86 241.63 111.62C241.82 110.39 242.10 107.41 242.24 105.00C242.38 102.59 242.61 99.11 242.74 97.25C242.87 95.39 243.04 90.33 243.13 86.00C243.21 81.67 243.38 77.00 243.51 75.62C243.64 74.25 243.87 71.91 244.01 70.42C245.35 56.17 250.01 44.73 259.14 33.23C267.53 22.66 286.11 7.41 297.37 1.85L301.12 -0.00L311.04 -0.00C317.54 -0.00 321.21 0.09 321.67 0.27C323.82 1.09 332.25 3.01 335.25 3.35C339.76 3.87 352.37 6.42 358.88 8.13C366.84 10.22 376.97 14.61 381.24 17.82C386.39 21.69 390.97 27.35 393.94 33.50C395.19 36.10 398.18 41.40 400.61 45.35C401.46 46.74 402.79 49.00 403.56 50.38C405.00 52.95 407.78 57.27 411.14 62.16C412.19 63.69 413.34 65.44 413.70 66.04C414.06 66.63 415.66 68.92 417.26 71.12C418.85 73.33 420.94 76.39 421.89 77.94C424.29 81.84 430.72 92.21 434.14 97.68C436.99 102.24 442.41 112.87 444.13 117.26C445.57 120.94 446.75 125.20 447.75 130.38C449.56 139.65 449.61 140.13 450.25 151.50C450.50 155.79 450.44 157.30 449.73 166.09C448.84 177.20 443.17 203.31 438.24 219.00C437.70 220.72 436.71 224.38 436.03 227.12C432.92 239.82 430.51 248.01 429.51 249.38C429.40 249.51 428.05 251.99 426.50 254.88C424.95 257.76 423.10 261.02 422.39 262.12C419.35 266.80 411.58 276.87 407.25 281.73C403.24 286.23 398.38 293.01 395.10 298.67C391.95 304.10 390.47 306.13 384.98 312.50C377.28 321.45 368.57 328.27 356.00 335.17C350.34 338.28 339.10 341.71 333.20 342.12C324.54 342.73 319.28 343.60 307.50 346.38C301.94 347.69 294.30 349.23 289.00 350.11C284.68 350.83 284.58 350.86 284.12 351.77C283.73 352.51 281.83 361.20 281.16 365.25C278.76 379.77 278.71 397.39 281.02 409.50C281.29 410.94 281.69 413.76 281.89 415.75C282.09 417.74 282.38 420.50 282.52 421.88C283.02 426.45 282.31 442.06 281.38 447.19C281.18 448.33 280.90 451.37 280.76 453.94C280.24 463.70 278.21 471.83 272.30 487.75C269.55 495.17 268.19 497.88 264.61 503.00C262.53 505.99 258.08 513.35 256.71 516.07C254.58 520.33 251.72 522.62 249.62 521.76ZM290.84 324.52C301.48 321.03 304.01 320.41 308.88 320.12C318.88 319.53 326.43 317.41 337.38 312.13C347.19 307.40 356.89 299.05 366.85 286.76C371.47 281.05 373.12 278.73 374.50 276.00C374.94 275.12 375.89 273.44 376.61 272.27C381.55 264.20 384.64 255.54 385.63 247.00C385.72 246.24 386.17 243.38 386.63 240.62C387.08 237.88 387.53 235.00 387.62 234.24C387.70 233.48 388.23 231.06 388.79 228.86C390.34 222.76 391.37 217.33 391.76 213.17C391.89 211.77 392.10 210.17 392.24 209.62C392.57 208.21 392.98 203.09 393.26 196.62C393.40 193.60 393.61 189.94 393.74 188.50C393.97 185.94 394.38 180.04 395.13 168.38C395.73 159.28 395.59 154.77 394.50 146.88C393.33 138.45 391.78 133.27 388.13 125.62C387.21 123.70 386.14 121.34 385.75 120.38C385.36 119.41 384.68 117.96 384.23 117.16C383.79 116.35 382.90 114.49 382.26 113.02C381.62 111.56 380.61 109.64 380.01 108.77C377.73 105.40 374.03 96.17 372.24 89.37C369.17 77.68 365.73 72.91 352.22 61.66C349.52 59.41 346.49 56.61 344.97 54.96C338.13 47.50 336.80 46.83 326.27 45.52C307.57 43.18 299.08 45.01 294.15 52.47C292.75 54.59 288.43 63.22 287.46 65.85C286.10 69.54 285.24 74.21 284.37 82.62C283.80 88.25 283.29 92.36 282.89 94.70C282.68 95.90 282.34 98.56 282.13 100.62C281.92 102.69 281.50 105.89 281.21 107.75C280.24 113.87 280.81 130.35 282.39 141.89C282.59 143.40 282.87 148.35 283.00 152.89C283.13 157.42 283.36 162.90 283.51 165.07C283.85 169.99 283.21 184.48 282.38 190.50C282.18 191.94 281.84 194.87 281.63 197.00C281.41 199.13 281.02 202.45 280.76 204.38C280.50 206.30 280.22 208.72 280.12 209.75C280.03 210.78 279.81 212.69 279.63 214.00C279.22 216.88 279.12 247.18 279.50 251.75C279.63 253.33 279.85 259.63 279.99 265.75C280.13 271.87 280.42 279.07 280.62 281.75C280.82 284.43 281.11 289.77 281.26 293.62C281.41 297.48 281.69 302.03 281.88 303.75C282.07 305.47 282.29 307.77 282.37 308.88C282.45 309.98 282.62 312.00 282.76 313.38C282.89 314.75 283.17 317.73 283.38 320.00C283.83 324.88 283.92 325.39 284.41 325.88C284.96 326.43 285.11 326.40 290.84 324.52Z' };
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
    /* a picture coalescing or dissolving is heard as a soft swell (o.sound: false keeps it silent) */
    function cue(k) { if (o.sound !== false) Sound.event(k); }
    function to(target, dur, done) { if (cancel) cancel(); var k0 = k; if (REDUCED) { k = target; done && done(); return; } cancel = tween(dur, function (e) { k = lerp(k0, target, e); }, done); }
    var api = {
      /* coalesce out of the fog (2.6 s); with a source, swap it in first */
      show: function (src, done) { cue('coalesce'); if (src) load(src, function () { to(1, 2600, done); }); else to(1, 2600, done); },
      /* dissolve back into the fog (1.8 s) */
      hide: function (done) { cue('dissolve'); to(0, 1800, done); },
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
    still(); apply(); Sound.event('shift');
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


  /* ================= SOUND ================= */
  /* Aphesis.Sound: the ambient sound of the site, synthesized in Web Audio with no files. One family of timbre for
     every screen: low sine and triangle partials in slowly detuned pairs (they beat), a bed of filtered noise, and
     sparse soft harmonics that bloom and fade. Each screen is a VOICE (root, mode, density, texture) played by one of
     two fixed sets of nodes, so a change of route is a crossfade from one set to the other and the sound never stops.
     Nothing is created per note or per frame: every oscillator runs from the start and only gains and frequencies
     move. Its slow movements are oscillators at the fog's drift rate times powers of φ, so like the fog it never
     repeats. It sits under attention: a quiet master through a gentle compressor and a limiter, nothing high. */
  var SOUND_KEY = 'aphesis.sound', PHI_R = 1.6180339887;
  /* the slow movements: the fog drifts at .013 and its layers at powers of φ; so do the voices' sways */
  var SWAY = [0, 1, 2, 3, 4].map(function (k) { return 0.013 * Math.pow(PHI_R, k); });
  /* a voice. drone: three pairs [ratio to root, detune between the two in cents, gain]; pair 0 is triangle, 1 and 2
     sine. tone: lowpass cutoff and its sway. noise: [gain, band centre, Q, breath 0..1, sweep in Hz]. glint: sparse
     harmonics [mean seconds apart, semitones of the mode, octave as a multiple of the root, gain, attack, release].
     tick and throb: pulses [period s, gain, frequency or ratio, chance of a skipped beat]. send: share in the room. */
  function V(o) {
    return { root: o.root, drone: o.drone, tone: o.tone, sway: o.sway || o.tone * 0.32, q: o.q || 0.5, noise: o.noise,
      glint: o.glint || null, tick: o.tick || null, throb: o.throb || null, send: o.send === undefined ? 0.3 : o.send,
      width: o.width === undefined ? 0.3 : o.width, level: o.level || 1 };
  }
  var VOICES = {
    /* the φ: an open fifth on D with no third, in the dorian's pentatonic, the fog's own breath */
    home: V({ root: 73.42, drone: [[1, 4.5, 0.3], [1.5, 3, 0.15], [2, 6, 0.09]], tone: 900, noise: [0.05, 420, 0.9, 0.4, 120],
      glint: [5.5, [0, 2, 7, 9, 12, 14], 4, 0.05, 1.4, 5], send: 0.35 }),
    /* the codex: warm F major, a major third and a twelfth, paper breathing in the noise */
    book: V({ root: 87.31, drone: [[1, 3, 0.27], [1.25, 2.5, 0.12], [3, 4, 0.06]], tone: 1100, noise: [0.045, 900, 1.1, 0.3, 200],
      glint: [6.5, [0, 4, 7, 11, 12, 16], 4, 0.045, 1, 4.5], send: 0.3 }),
    /* the adyton: phrygian C#, a minor second beating against the root, a slow heart; darker chamber by chamber */
    experimental: V({ root: 69.3, drone: [[1, 7, 0.32], [16 / 15, 3, 0.09], [Math.SQRT2, 5, 0.05]], tone: 540, noise: [0.06, 260, 1.2, 0.5, 90],
      glint: [9, [0, 1, 6, 7, 12, 13], 2, 0.05, 2.2, 7], throb: [2.2, 0.04, 1], send: 0.45, level: 1.3 }),
    /* the archive: deep A aeolian, still and far, long sparse harmonics */
    archive: V({ root: 55, drone: [[1, 2.5, 0.36], [2, 2, 0.14], [3, 1.5, 0.05]], tone: 640, noise: [0.035, 340, 0.8, 0.3, 80],
      glint: [11, [0, 3, 7, 10, 12], 4, 0.04, 1.8, 7], send: 0.5, level: 1.15 }),
    /* the officina: dry G, little beating and little room, a clock ticking and a slow pulse */
    laboratory: V({ root: 98, drone: [[1, 1.5, 0.2], [2, 0.8, 0.12], [3, 0.5, 0.07]], tone: 1400, sway: 200, noise: [0.015, 1200, 2.5, 0.1, 100],
      glint: [7, [0, 2, 4, 6, 8, 10], 8, 0.02, 0.25, 2.2], tick: [0.72, 0.05, 1050, 0.18], throb: [2.88, 0.06, 2], send: 0.08, width: 0.12, level: 0.85 }),
    /* the opera: E lydian, finished and open, fifths and a major tenth */
    works: V({ root: 82.41, drone: [[1, 4, 0.27], [1.5, 3, 0.13], [2.5, 3, 0.07]], tone: 1250, noise: [0.04, 600, 0.9, 0.3, 150],
      glint: [5, [0, 4, 6, 7, 11, 14], 4, 0.045, 1, 4.5], send: 0.3 }),
    /* the wall: B flat, a thin drone and a lot of wind, breath in gusts */
    wall: V({ root: 58.27, drone: [[1, 5, 0.2], [2, 6, 0.08], [3, 4, 0.04]], tone: 760, noise: [0.12, 520, 0.7, 0.85, 380],
      glint: [13, [0, 5, 7, 12], 4, 0.03, 2.5, 6], send: 0.4, width: 0.45 }),
    /* the agora: F# dorian, rough beating like many voices, a murmur in the noise, more frequent small harmonics */
    forum: V({ root: 92.5, drone: [[1, 9, 0.25], [1.2, 7, 0.1], [1.5, 8, 0.08]], tone: 980, noise: [0.07, 700, 1.4, 0.55, 220],
      glint: [3.6, [0, 2, 3, 7, 9, 10, 12], 4, 0.03, 0.8, 3], send: 0.25 }),
    /* music: the home's root, almost nothing, so a track can play over it (it also ducks while one plays) */
    music: V({ root: 73.42, drone: [[1, 3, 0.12], [2, 2, 0.03], [3, 2, 0]], tone: 600, noise: [0.02, 400, 0.8, 0.2, 80], send: 0.3 })
  };
  /* the nine chambers of experimental, in their order; 0 is the door */
  var CHAMBERS = ['door', 'ouroboros', 'hands', 'scholar', 'tablet', 'fortune', 'veil', 'alchemist', 'sky', 'ending'];
  var CH_RATIO = [Math.SQRT2, 1.5, 4 / 3, 16 / 15, Math.SQRT2, 1.2, 1.4983, 1.0595, Math.SQRT2, 16 / 15];
  var CH_V = [];
  function chamberVoice(c) {
    if (CH_V[c]) return CH_V[c];
    var b = VOICES.experimental, k = c / 9, end = c === 9, v = JSON.parse(JSON.stringify(b));
    v.root = b.root * Math.pow(2, -(end ? 5 : 2.4 * k) / 12);
    v.drone[0][1] = 7 + 6 * k; v.drone[1][2] = 0.09 + 0.04 * k; v.drone[2][0] = CH_RATIO[c]; v.drone[2][1] = 5 + 4 * k;
    v.tone = b.tone * (1 - 0.5 * k) * (end ? 0.8 : 1); v.sway = v.tone * 0.3;
    v.noise[0] = b.noise[0] * (1 + 0.7 * k); v.noise[1] = b.noise[1] * (1 - 0.3 * k);
    v.throb = c === 0 ? null : [2.6 - 0.8 * k, 0.03 + 0.06 * k, 1];
    v.glint[0] = b.glint[0] * (1 + k); if (c >= 5) v.glint[1] = [0, 1, 6, 12, 13]; if (end) { v.glint[1] = [0, 1, 6]; v.glint[3] = 0.035; }
    v.send = 0.45 + 0.15 * k;
    return (CH_V[c] = v);
  }
  function voiceOf(name, o) {
    if (name === 'experimental' && o && o.chamber !== undefined) {
      var c = typeof o.chamber === 'string' ? CHAMBERS.indexOf(o.chamber) : +o.chamber;
      if (c >= 0 && c <= 9) return chamberVoice(Math.round(c));
    }
    return VOICES[name] || VOICES.home;
  }

  /* a gain or frequency that is only ever moved by setTargetAtTime from the value it holds now, worked out here, so
     a mute, a duck or a crossfade can interrupt another at any moment without a step (and without cancelAndHold,
     which not every browser has) */
  function Lane(ctx, param, v) { this.c = ctx; this.p = param; this.s = [{ t0: 0, v0: v, v1: v, tau: 0 }]; param.value = v; }
  Lane.prototype.at = function (t) {
    var s = this.s[0]; for (var i = this.s.length - 1; i >= 0; i--) if (this.s[i].t0 <= t) { s = this.s[i]; break; }
    return !s.tau || t <= s.t0 ? (s.tau ? s.v0 : s.v1) : s.v1 + (s.v0 - s.v1) * Math.exp(-(t - s.t0) / s.tau);
  };
  Lane.prototype.target = function () { return this.s[this.s.length - 1].v1; };
  Lane.prototype._push = function (v, sec, t) {
    var cur = this.at(t), tau = Math.max(0.003, sec / 4); this.p.setTargetAtTime(v, t, tau);
    this.s = this.s.filter(function (x) { return x.t0 < t; }).slice(-3); this.s.push({ t0: t, v0: cur, v1: v, tau: tau });
  };
  /* go(value, seconds, at): from what it holds at `at` (now by default), settle on value in about `seconds` */
  Lane.prototype.go = function (v, sec, t) {
    t = t === undefined ? this.c.currentTime : t; var cur = this.at(t);
    this.p.cancelScheduledValues(t); this.p.setValueAtTime(cur, t); this._push(v, sec, t);
  };
  /* then(value, seconds, at): a later move, after the one under way */
  Lane.prototype.then = function (v, sec, t) { this._push(v, sec, t); };

  function noiseBuffer(ctx) {
    /* pinkish noise (Kellet's filter), 6.18 s, looped */
    var n = Math.floor(ctx.sampleRate * 6.18), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = rng(1618), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (var i = 0; i < n; i++) { var w = r() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    /* the loop seam: cross the last 50 ms into the first */
    var m = Math.floor(ctx.sampleRate * 0.05); for (i = 0; i < m; i++) { var u = i / m; d[n - m + i] = d[n - m + i] * (1 - u) + d[i] * u; }
    return b;
  }
  function roomBuffer(ctx) {
    /* the room: 2.8 s of decaying noise, darkened as it decays, a little different in each ear */
    var sr = ctx.sampleRate, n = Math.floor(sr * 2.8), b = ctx.createBuffer(2, n, sr);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), r = rng(31 + c * 7), lp = 0;
      for (var i = 0; i < n; i++) { var t = i / sr, a = Math.exp(-t * 2.3) * Math.min(1, t / 0.02), k = 0.5 * Math.exp(-t * 1.2) + 0.04; lp += (r() * 2 - 1 - lp) * k; d[i] = lp * a * 0.5; } }
    return b;
  }

  /* the engine: the whole fixed graph on one context (live, or offline for analysis) */
  function SoundEngine(ctx) {
    var E = this, c = ctx, now = function () { return c.currentTime; };
    E.ctx = c;
    function G(v) { var g = c.createGain(); g.gain.value = v === undefined ? 1 : v; return g; }
    /* sources start together once the context runs (a suspended context in Chrome complains about every start) */
    var srcs = E.srcs = [];
    function O(type, f) { var o = c.createOscillator(); o.type = type; o.frequency.value = f; srcs.push(o); return o; }
    function F(type, f, q) { var b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q === undefined ? 0.7 : q; return b; }
    var noise = c.createBufferSource(); noise.buffer = noiseBuffer(c); noise.loop = true; srcs.push(noise);
    /* master: bus -> pointer tone -> pointer pan -> duck -> visibility -> mute -> start (two in series: a slow creep)
       -> compressor -> limiter -> level -> out */
    E.bus = G(1);
    E.tone = F('lowpass', 2600, 0.5);
    E.pan = c.createStereoPanner ? c.createStereoPanner() : G(1);
    E.duckG = G(1); E.visG = G(1); E.muteG = G(1); E.s1 = G(0); E.s2 = G(0);
    var comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 2; comp.attack.value = 0.08; comp.release.value = 0.6;
    var lim = c.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.3;
    var hush = F('highshelf', 3500, 0); hush.gain.value = -9;
    E.out = G(0.12);
    E.an = c.createAnalyser(); E.an.fftSize = 1024;
    [E.bus, E.tone, E.pan, E.duckG, E.visG, E.muteG, E.s1, E.s2, hush, comp, lim, E.out].reduce(function (a, b) { a.connect(b); return b; });
    E.out.connect(c.destination); E.out.connect(E.an);
    E.duck = new Lane(c, E.duckG.gain, 1); E.vis = new Lane(c, E.visG.gain, 1); E.mute = new Lane(c, E.muteG.gain, 1);
    E.st1 = new Lane(c, E.s1.gain, 0); E.st2 = new Lane(c, E.s2.gain, 0);
    E.toneL = new Lane(c, E.tone.frequency, 2600); E.panL = E.pan.pan ? new Lane(c, E.pan.pan, 0) : null;
    /* the room, shared */
    var room = c.createConvolver(); room.buffer = roomBuffer(c); var wet = G(0.9); room.connect(wet); wet.connect(E.bus);
    /* the slow movements, shared: oscillators at the fog's rates, never touched again */
    var lfo = SWAY.map(function (f) { return O('sine', f); });
    function depth(src, param, d) { var g = G(d); src.connect(g); g.connect(param); return g; }
    /* the two players */
    function slot() {
      var S = { out: G(0), send: G(0), osc: [], og: [], gl: [], glg: [], busy: [0, 0, 0], v: null, next: 0, nextTick: 0, nextThrob: 0 };
      S.lane = new Lane(c, S.out.gain, 0);
      S.lp = F('lowpass', 900, 0.5); S.sp = c.createStereoPanner ? c.createStereoPanner() : G(1);
      S.lp.connect(S.sp); S.sp.connect(S.out);
      for (var i = 0; i < 6; i++) { var o = O(i < 2 ? 'triangle' : 'sine', 110), g = G(0); o.connect(g); g.connect(S.lp); S.osc.push(o); S.og.push(g); }
      S.nbp = F('bandpass', 400, 1); S.ng = G(0); noise.connect(S.nbp); S.nbp.connect(S.ng); S.ng.connect(S.sp);
      for (i = 0; i < 3; i++) { var go = O('sine', 300), gg = G(0); go.connect(gg); gg.connect(S.sp); S.gl.push(go); S.glg.push(gg); }
      S.th = O('sine', 70); S.thg = G(0); S.th.connect(S.thg); S.thg.connect(S.lp);
      S.tbp = F('bandpass', 1000, 6); S.tg = G(0); noise.connect(S.tbp); S.tbp.connect(S.tg); S.tg.connect(S.sp);
      /* sways: cutoff, breath of the noise, sweep of its band, width, and the drift of each pair's beating */
      S.dCut = depth(lfo[1], S.lp.frequency, 0); S.dBreath = depth(lfo[4], S.ng.gain, 0); S.dSweep = depth(lfo[2], S.nbp.frequency, 0);
      S.dPan = S.sp.pan ? depth(lfo[3], S.sp.pan, 0) : null; S.dDet = depth(lfo[0], S.osc[1].detune, 3);
      depth(lfo[2], S.osc[3].detune, 2.5); depth(lfo[3], S.osc[5].detune, 2);
      S.out.connect(E.bus); S.out.connect(S.send); S.send.connect(room);
      /* lanes for everything a voice sets */
      S.L = { cut: new Lane(c, S.lp.frequency, 900), q: new Lane(c, S.lp.Q, 0.5), ng: new Lane(c, S.ng.gain, 0), nf: new Lane(c, S.nbp.frequency, 400), nq: new Lane(c, S.nbp.Q, 1),
        send: new Lane(c, S.send.gain, 0), dCut: new Lane(c, S.dCut.gain, 0), dBreath: new Lane(c, S.dBreath.gain, 0), dSweep: new Lane(c, S.dSweep.gain, 0),
        dPan: S.dPan ? new Lane(c, S.dPan.gain, 0) : null, f: [], det: [], g: [] };
      for (i = 0; i < 6; i++) { S.L.f.push(new Lane(c, S.osc[i].frequency, 110)); S.L.det.push(new Lane(c, S.osc[i].detune, 0)); S.L.g.push(new Lane(c, S.og[i].gain, 0)); }
      S.L.th = new Lane(c, S.th.frequency, 70); S.L.tf = new Lane(c, S.tbp.frequency, 1000);
      return S;
    }
    E.slots = [slot(), slot()];
    /* the event voice: a pair of sines and a band of noise, retuned for each event */
    var ev = { a: O('sine', 150), b: O('sine', 150), ag: G(0), nbp: F('bandpass', 400, 1.2), ng: G(0), lp: F('lowpass', 1800, 0.5), send: G(0.5) };
    ev.a.connect(ev.ag); ev.b.connect(ev.ag); ev.ag.connect(ev.lp); noise.connect(ev.nbp); ev.nbp.connect(ev.ng); ev.ng.connect(ev.lp);
    ev.lp.connect(E.bus); ev.lp.connect(ev.send); ev.send.connect(room);
    ev.L = { fa: new Lane(c, ev.a.frequency, 150), fb: new Lane(c, ev.b.frequency, 150), ag: new Lane(c, ev.ag.gain, 0), ng: new Lane(c, ev.ng.gain, 0), nf: new Lane(c, ev.nbp.frequency, 400) };
    E.ev = ev;
    E.active = 0; E.voice = null; E.name = null;
  }
  SoundEngine.prototype.ignite = function () { if (this.lit) return; this.lit = true; this.srcs.forEach(function (o) { o.start(); }); };
  /* put voice v on slot S; glide when it is sounding, jump when it is silent */
  SoundEngine.prototype.tune = function (S, v, t) {
    var sounding = S.lane.at(t) > 0.002, sec = sounding ? 3 : 0.02, L = S.L, i;
    for (i = 0; i < 3; i++) {
      var p = v.drone[i], f = v.root * p[0], g = p[2] * v.level;
      L.f[2 * i].go(f, sec, t); L.f[2 * i + 1].go(f, sec, t);
      L.det[2 * i].go(-p[1] / 2, sec, t); L.det[2 * i + 1].go(p[1] / 2, sec, t);
      var bal = i === 0 ? 0.4 : 1.4; L.g[2 * i].go(g * bal, sec, t); L.g[2 * i + 1].go(g * bal, sec, t);
    }
    L.cut.go(v.tone * 1.3, sec, t); L.q.go(v.q, sec, t); L.dCut.go(v.sway, sec, t);
    var nz = v.noise[0] * v.level * 1.8; L.ng.go(nz, sec, t); L.nf.go(v.noise[1], sec, t); L.nq.go(v.noise[2], sec, t);
    L.dBreath.go(nz * v.noise[3] * 0.9, sec, t); L.dSweep.go(v.noise[4], sec, t);
    if (L.dPan) L.dPan.go(v.width, sec, t);
    L.send.go(v.send, sec, t);
    L.th.go(v.throb ? v.root * v.throb[2] : v.root, sec, t); if (v.tick) L.tf.go(v.tick[2], sec, t);
    /* harmonics and pulses already planned for the old voice are let go */
    if (S.v && S.v !== v) for (i = 0; i < 3; i++) { if (S.busy[i] > t) { S.glg[i].gain.cancelScheduledValues(t); S.glg[i].gain.setTargetAtTime(0, t, 0.25); S.busy[i] = t + 2; } }
    S.v = v; S.next = t + 0.5 + Math.random() * (v.glint ? v.glint[0] : 1); S.nextTick = t + 0.3; S.nextThrob = t + 0.8;
  };
  /* scene: crossfade to voice v over sec seconds */
  SoundEngine.prototype.scene = function (v, sec, t) {
    t = t === undefined ? this.ctx.currentTime : t;
    var A = this.slots[this.active], B = this.slots[1 - this.active];
    if (A.v === v) { A.lane.go(1, sec, t); B.lane.go(0, sec, t); return; }
    if (A.lane.at(t) < 0.002 && !A.v) { this.tune(A, v, t); A.lane.go(1, Math.max(0.05, sec), t); return; }
    this.tune(B, v, t);
    B.lane.go(1, sec * 0.9, t); A.lane.go(0, sec, t);
    this.active = 1 - this.active;
  };
  /* plan the sparse harmonics and pulses a little ahead of time (called every quarter of a second) */
  SoundEngine.prototype.tick = function (ahead) {
    var t = this.ctx.currentTime, h = t + (ahead || 1.2);
    this.slots.forEach(function (S) {
      var v = S.v; if (!v || S.lane.target() < 0.01) return;
      var gl = v.glint;
      while (gl && S.next < h) {
        var at = Math.max(S.next, t + 0.02), j = -1;
        for (var i = 0; i < 3; i++) if (S.busy[i] <= at) { j = i; break; }
        if (j >= 0) {
          var deg = gl[1][Math.floor(Math.random() * gl[1].length)], f = v.root * gl[2] * Math.pow(2, deg / 12), pk = gl[3] * 2.4 * (0.55 + 0.45 * Math.random()) * v.level;
          var att = gl[4] * (0.7 + 0.6 * Math.random()), hold = att * 0.6, rel = gl[5] * (0.7 + 0.6 * Math.random()), g = S.glg[j].gain;
          S.gl[j].frequency.setValueAtTime(f, at); S.gl[j].detune.setValueAtTime((Math.random() - 0.5) * 8, at);
          g.setTargetAtTime(pk, at, att / 3); g.setTargetAtTime(0, at + att + hold, rel / 4);
          S.busy[j] = at + att + hold + rel * 1.7;
        }
        S.next = at + gl[0] * (0.35 + 1.3 * Math.random());
      }
      var tk = v.tick;
      while (tk && S.nextTick < h) {
        var a2 = Math.max(S.nextTick, t + 0.02);
        if (Math.random() > tk[3]) { var p2 = tk[1] * (0.6 + 0.4 * Math.random()) * v.level; S.tg.gain.setTargetAtTime(p2, a2, 0.0015); S.tg.gain.setTargetAtTime(0, a2 + 0.006, 0.022); }
        S.nextTick = a2 + tk[0] * (0.97 + 0.06 * Math.random());
      }
      var th = v.throb;
      while (th && S.nextThrob < h) {
        var a3 = Math.max(S.nextThrob, t + 0.02), p3 = th[1] * v.level;
        S.thg.gain.setTargetAtTime(p3, a3, 0.05); S.thg.gain.setTargetAtTime(0, a3 + 0.12, 0.16);
        S.thg.gain.setTargetAtTime(p3 * 0.6, a3 + 0.34, 0.05); S.thg.gain.setTargetAtTime(0, a3 + 0.44, 0.22);
        S.nextThrob = a3 + th[0] * (0.95 + 0.1 * Math.random());
      }
    });
  };
  /* events: swells and impacts on the event voice, in the key of the voice that is playing */
  var EVENTS = {
    /* [sine pair: ratio a, ratio b, gain, attack, release, glide-to ratio], [noise: gain, band from, band to, attack, release] */
    swell: [[2, 3, 0.05, 1.6, 3.2], [0.05, 220, 700, 1.6, 3]],
    door: [[2, 3, 0.06, 1.8, 3.6, 1.5], [0.07, 180, 900, 2, 3.4]],
    coalesce: [[4, 6, 0.035, 1.3, 3.4], [0.025, 500, 900, 1.2, 2.6]],
    dissolve: [[3, 4, 0.025, 0.6, 2.4, 2], [0.04, 900, 260, 0.5, 2.2]],
    impact: [[2, 2.01, 0.12, 0.012, 1.4, 0.5], [0.05, 300, 140, 0.01, 0.9]],
    turn: [null, [0.05, 1200, 600, 0.05, 0.45]],
    shift: [[6, 8, 0.02, 2.4, 4], [0.02, 700, 1400, 2.4, 3.5]],
    passage: [[1.5, 2, 0.03, 1.4, 3], [0.03, 300, 600, 1.4, 2.6]]
  };
  SoundEngine.prototype.event = function (kind, t) {
    var e = EVENTS[kind] || EVENTS.swell, ev = this.ev, L = ev.L, v = this.slots[this.active].v || VOICES.home, r = v.root;
    t = t === undefined ? this.ctx.currentTime : t;
    var o = e[0], n = e[1];
    if (o) {
      L.fa.go(r * o[0], 0.03, t); L.fb.go(r * o[1], 0.03, t);
      if (o[5]) { L.fa.then(r * o[5], o[3] + o[4], t + 0.05); L.fb.then(r * o[5] * o[1] / o[0], o[3] + o[4], t + 0.05); }
      L.ag.go(o[2], o[3], t); L.ag.then(0, o[4], t + o[3]);
    }
    if (n) {
      L.nf.go(n[1], 0.03, t); L.nf.then(n[2], n[3] + n[4] * 0.6, t + 0.04);
      L.ng.go(n[0], n[3], t); L.ng.then(0, n[4], t + n[3]);
    }
  };
  SoundEngine.prototype.level = function () {
    var a = this.an, d = this._buf || (this._buf = new Float32Array(a.fftSize)); a.getFloatTimeDomainData(d);
    var s = 0, p = 0; for (var i = 0; i < d.length; i++) { s += d[i] * d[i]; p = Math.max(p, Math.abs(d[i])); } return { rms: Math.sqrt(s / d.length), peak: p };
  };

  /* the live sound: autoplay, the first gesture, mute, visibility, the pointer, the ear */
  var Sound = (function () {
    var AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    var E = null, started = false, want = { name: 'home', o: null }, timer = 0, sleepT = 0, armed = false, ears = [], fadeMs = 7000, lastPtr = 0, media = 0;
    function stored() { try { return localStorage.getItem(SOUND_KEY) === 'off'; } catch (e) { return false; } }
    var muted = stored();
    function store() { try { localStorage.setItem(SOUND_KEY, muted ? 'off' : 'on'); } catch (e) {} }
    function running() { return E && E.ctx.state === 'running'; }
    function ensure() {
      if (E || !AC) return E;
      /* heard on iPhone: a playback session plays through the silent switch (the owner's decision); iOS pauses other
         apps' audio while it plays */
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      var ctx; try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return null; } }
      E = new SoundEngine(ctx);
      E.scene(voiceOf(want.name, want.o), 0.05, ctx.currentTime); E.name = want.name;
      ctx.addEventListener ? ctx.addEventListener('statechange', onState) : (ctx.onstatechange = onState);
      timer = setInterval(function () { if (running()) E.tick(); }, 250);
      return E;
    }
    /* the context is running: the first time, creep in (the φ draws itself meanwhile) */
    function onState() {
      if (!running()) return;
      disarm(); E.ignite(); E.tick();
      if (!started) { started = true; var t = E.ctx.currentTime, s = fadeMs / 1000; E.st1.go(1, s * 4 / 3, t); E.st2.go(1, s * 4 / 3, t); }
    }
    function resume() {
      if (!E) return;
      try { var p = E.ctx.resume(); if (p && p.then) p.then(onState, function () {}); } catch (e) {}
      setTimeout(onState, 300);
    }
    /* the first gesture of any kind wakes it; no prompt, nothing to click on purpose */
    function gesture() {
      if (muted || !E) return disarm();
      /* iOS unlocks on a sound started inside the gesture: a silent one */
      try { var b = E.ctx.createBufferSource(); b.buffer = E.ctx.createBuffer(1, 1, E.ctx.sampleRate); b.connect(E.ctx.destination); b.start(0); } catch (e) {}
      resume(); if (!document.hidden) awake(true);
    }
    var GESTURES = ['pointerdown', 'keydown', 'touchend', 'click', 'mousedown'];
    function arm() { if (armed) return; armed = true; GESTURES.forEach(function (k) { addEventListener(k, gesture, { capture: true, passive: true }); }); }
    function disarm() { if (!armed) return; armed = false; GESTURES.forEach(function (k) { removeEventListener(k, gesture, { capture: true, passive: true }); }); }
    /* hidden pages and muted ones fade out, then the context sleeps; shown again, it wakes and fades back in */
    function awake(on) {
      if (!E) return; clearTimeout(sleepT);
      if (on) { E.vis.go(1, 2.4); if (E.ctx.state !== 'running') { resume(); if (E.ctx.state !== 'running') arm(); } }
      else { E.vis.go(0, 1.6); sleepT = setTimeout(function () { if (E && (document.hidden || muted)) try { E.ctx.suspend(); } catch (e) {} }, 2200); }
    }
    function onVis() { if (!E || muted) return; awake(!document.hidden); }
    function onPointer(e) {
      if (!E || !running()) return; var n = performance.now(); if (n - lastPtr < 80) return; lastPtr = n;
      var x = e.clientX / Math.max(1, innerWidth), y = e.clientY / Math.max(1, innerHeight);
      /* toward the top a little brighter, the sound leaning a little toward the pointer */
      E.toneL.go(1900 + 1500 * (1 - y), 0.9); if (E.panL) E.panL.go((x - 0.5) * 0.24, 0.9);
    }
    /* a track playing anywhere in the page (an <audio> or <video>) ducks the ambience almost to silence */
    function onMedia(e) {
      if (!e.target || !/^(AUDIO|VIDEO)$/.test(e.target.tagName) || e.target.muted) return;
      media = Math.max(0, media + (e.type === 'play' ? 1 : -1)); api.duck(media ? 0.05 : 1, media ? 1500 : 3000);
    }
    var hooked = false;
    function hook() {
      if (hooked || typeof document === 'undefined') return; hooked = true;
      document.addEventListener('visibilitychange', onVis);
      addEventListener('pointermove', onPointer, { passive: true });
      ['play', 'pause', 'ended'].forEach(function (k) { document.addEventListener(k, onMedia, true); });
    }
    function paintEars() { ears.forEach(function (b) { earState(b, !muted); }); }
    var api = {
      /* start({fade, scene, chamber}): call once at load. Muted visitors stay silent and nothing is created. */
      start: function (o) {
        o = o || {}; if (o.fade) fadeMs = o.fade; if (o.scene) { want.name = o.scene; want.o = o; }
        hook(); if (muted || !AC) return api;
        if (!ensure()) return api;
        if (document.hidden) { arm(); return api; }
        resume(); if (!running()) arm();
        return api;
      },
      /* scene(name, {transition, chamber}): crossfade to a screen's voice (3.6 s by default) */
      scene: function (name, o) {
        o = o || {}; want.name = name || 'home'; want.o = o;
        if (E) { E.scene(voiceOf(want.name, o), Math.max(0.05, (o.transition === undefined ? cssMs('--duration-voice', 3600) : o.transition) / 1000)); if (o.transition !== 0 && running() && E.name !== want.name) E.event('passage'); E.name = want.name; }
        return api;
      },
      /* event(kind): a swell or an impact: swell, door, coalesce, dissolve, impact, turn, shift, passage */
      event: function (kind) { if (running() && !muted) E.event(kind); return api; },
      /* duck(level, ms): lower everything to level (0..1) over ms; duck(1) restores */
      duck: function (level, ms) { if (E) E.duck.go(clamp(level === undefined ? 0.2 : level), (ms || 1500) / 1000); return api; },
      /* mute(true|false): a slow fade (1.2 s), remembered for the next visit */
      mute: function (m) {
        m = m === undefined ? !muted : !!m; muted = m; store(); paintEars();
        var hush = cssMs('--duration-hush', 1200) / 1000;
        if (m) { if (E) { E.mute.go(0, hush); disarm(); clearTimeout(sleepT); sleepT = setTimeout(function () { if (E && muted) try { E.ctx.suspend(); } catch (e) {} }, 1800); } }
        else {
          hook(); var first = !E; if (!ensure()) return api;
          clearTimeout(sleepT);
          if (first) { fadeMs = hush * 1000; E.mute.go(1, 0.05); } else E.mute.go(1, hush);
          E.vis.go(1, 0.3); gesture();
        }
        return api;
      },
      get muted() { return muted; },
      get state() { return E ? E.ctx.state : 'none'; },
      get context() { return E ? E.ctx : null; },
      /* level(): {rms, peak} of what is playing now, for a meter */
      level: function () { return running() ? E.level() : { rms: 0, peak: 0 }; },
      /* ear(el): mount the ear in a button (or a new button inside el) */
      ear: function (el) { var b = mountEar(el); ears.push(b); earState(b, !muted, true); b.addEventListener('click', function () { api.mute(!muted); }); breathe(); return b; },
      voices: Object.keys(VOICES), chambers: CHAMBERS.slice(),
      /* render(seconds, {scene, chamber, timeline, sampleRate}): the same engine on an OfflineAudioContext, for
         analysis. timeline: [{at, scene, chamber, transition} | {at, event} | {at, mute} | {at, duck, ms}]. */
      render: function (sec, o) {
        o = o || {}; var sr = o.sampleRate || 48000, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, ctx = new OAC(2, Math.ceil(sr * sec), sr), e = new SoundEngine(ctx); e.ignite(); e.ignite();
        e.st1.go(1, 0.01, 0); e.st2.go(1, 0.01, 0); e.scene(voiceOf(o.scene || 'home', o), 0.05, 0); e.tick();
        var tl = (o.timeline || []).slice().sort(function (a, b) { return a.at - b.at; }), step = Math.round(0.25 * sr / 128) * 128 / sr;
        for (var t = step; t < sec - step; t += step) (function (t) {
          ctx.suspend(t).then(function () {
            while (tl.length && tl[0].at <= t + 1e-6) { var a = tl.shift();
              if (a.scene) e.scene(voiceOf(a.scene, a), (a.transition === undefined ? 3600 : a.transition) / 1000);
              if (a.event) e.event(a.event);
              if (a.mute !== undefined) e.mute.go(a.mute ? 0 : 1, 1.2);
              if (a.duck !== undefined) e.duck.go(a.duck, (a.ms || 1500) / 1000);
            }
            e.tick(); ctx.resume();
          });
        })(t);
        return ctx.startRendering();
      }
    };
    /* the ear's stipple breathes with the level while it sounds */
    var breathing = false;
    function breathe() {
      if (breathing) return; breathing = true; var n = 0;
      (function f() {
        requestAnimationFrame(f); if (++n % 4 || !ears.length) return;
        var l = running() && !muted ? clamp(E.level().rms * 18) : 0;
        ears.forEach(function (b) { b.style.setProperty('--aph-lvl', l.toFixed(2)); });
      })();
    }
    return api;
  })();

  /* the ear: an ear drawn by the brush, with three arcs of stipple arriving at it. Listening, the arcs are there;
     muted, they disperse and fall, and one stroke crosses the ear. */
  function bez(a, b, c2, d, n) { n = n || 24; var p = []; for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t; p.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c2[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c2[1] + t * t * t * d[1]]); } return p; }
  function annulus(cx, cy, r0, r1, a) { return function (x, y) { var dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), t = Math.abs(Math.atan2(dy, dx)) * 180 / Math.PI; return r > r0 && r < r1 && t < a; }; }
  var EAR = (function () {
    var helix = [].concat(arc(9.6, 9.2, 4.6, 168, 395, 40), bez([13.37, 11.84], [12.9, 14.6], [11.7, 15.4], [11.2, 17.7], 16).slice(1), bez([11.2, 17.7], [10.8, 19.7], [8.7, 20.3], [7.8, 18.7], 14).slice(1));
    var anti = [].concat(arc(9.9, 9.7, 2.2, 200, 345, 20), bez([12.03, 9.13], [12.3, 11.4], [10.5, 12.1], [10.1, 14.0], 14).slice(1));
    var ear = brush(helix, 1.75, 71, 0.2) + brush(anti, 1.1, 73, 0.35, 0.05) + brush(bez([6.7, 12.3], [7.7, 12.4], [8.0, 13.5], [7.3, 14.6], 10), 1.05, 75, 0.4, 0.05);
    var c = [9.6, 12.6];
    return {
      ear: ear,
      slash: brush(line(4.2, 4.6, 20.2, 20.4, 32), 1.5, 79, 0.36, 0.06),
      waves: [stipple(annulus(c[0], c[1], 7, 7.9, 38), 81, 940, 0.8), stipple(annulus(c[0], c[1], 9.3, 10.2, 32), 83, 1000, 0.78), stipple(annulus(c[0], c[1], 11.6, 12.5, 26), 85, 1050, 0.74)],
      loose: stipple(function (x, y) { return x > 15 && x < 23 && y > 17.5 && y < 22.5; }, 87, 160, 0.62)
    };
  })();
  ICONS.ear = function (st) { return st ? { strokes: EAR.ear + EAR.slash, dots: EAR.loose } : { strokes: EAR.ear, dots: EAR.waves.join('') }; };
  /* note: state 0 is listening, 1 muted (as the eye: 0 open, 1 closed) */
  function mountEar(el) {
    var b = el && el.tagName === 'BUTTON' ? el : document.createElement('button');
    if (b !== el && el) el.appendChild(b);
    b.type = 'button'; b.classList.add('aph-ear'); b.setAttribute('aria-label', 'sound on/off'); b.dataset.cursor = b.dataset.cursor || '.55';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="ear" d="' + EAR.ear + '"/><path class="slash" d="' + EAR.slash + '"/>' +
      EAR.waves.map(function (d, i) { var sq = d.split('M').slice(1), ev = '', od = ''; sq.forEach(function (q, j) { if (j % 2) od += 'M' + q; else ev += 'M' + q; });
        return '<g class="w w' + (i + 1) + '"><path d="' + ev + '"/><path d="' + od + '"/></g>'; }).join('') + '<g class="loose"><path d="' + EAR.loose + '"/></g></svg>';
    return b;
  }
  function earState(b, on, now) {
    if (now) { b.classList.add('aph-still-ear'); requestAnimationFrame(function () { requestAnimationFrame(function () { b.classList.remove('aph-still-ear'); }); }); }
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.dataset.tip = on ? 'listening · close the ear' : 'silent · open the ear';
  }

  window.Aphesis = {
    reducedMotion: REDUCED, MJ: MJ, cellPx: cellPx, lerp: lerp, clamp: clamp, tween: tween, rng: rng, cssColor: cssColor,
    brush: brush, arc: arc, line: line, stipple: stipple, inC: inC,
    icon: icon, ICONS: ICONS, PHI: PHI, seal: seal,
    Fog: Fog, Simulacrum: Simulacrum, Typist: Typist, tooltip: tooltip, cursor: cursor, letters: letters, themeShift: themeShift, Sound: Sound
  };
})();
