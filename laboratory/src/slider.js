/* a brushed slider: a native range input, invisible, over a drawing of it. The track is a hairline brush stroke in
   `line`, the ends are ticks, the thumb is one upright brush stroke in `accent`. The input does the work (pointer,
   touch, arrow keys, Page Up/Down, Home/End, screen readers); the drawing follows it. Nothing is solid.

     const s = slider(host, { min, max, step, value, name: 'angle', label: 'divergence angle in degrees',
                              fmt: (v) => v.toFixed(3) + '°', input: (v) => {} });
     s.value; s.set(v); */

const A = window.Aphesis;
const NS = 'http://www.w3.org/2000/svg';
const THUMB = 18; // the input's own thumb width in CSS px (laboratory.css), so the drawing lines up with it

export function slider(host, o) {
  const wrap = document.createElement('div');
  wrap.className = 'slider';
  wrap.innerHTML = `<span class="slider-name aph-label"></span><span class="slider-track"><svg aria-hidden="true"><path class="t-line"/><path class="t-accent"/></svg>` +
    `<input type="range" data-cursor=".55"></span><output class="slider-value num"></output>`;
  host.appendChild(wrap);
  const [name, svg, input, out] = [wrap.querySelector('.slider-name'), wrap.querySelector('svg'), wrap.querySelector('input'), wrap.querySelector('output')];
  const [track, thumb] = svg.querySelectorAll('path');
  name.textContent = o.name || '';
  Object.assign(input, { min: o.min, max: o.max, step: o.step || 'any', value: o.value });
  input.setAttribute('aria-label', o.label || o.name || '');
  const fmt = o.fmt || ((v) => String(v));

  function draw() {
    const w = svg.clientWidth, h = svg.clientHeight; if (!w) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const a = THUMB / 2, b = w - THUMB / 2, y = h / 2;
    track.setAttribute('d', A.brush(A.line(a, y, b, y, Math.ceil((b - a) / 3)), 1, 201, 0.04, 0.05) +
      A.brush(A.line(a, y - 5, a, y + 5, 5), 1, 202, 0, 0.04) + A.brush(A.line(b, y - 5, b, y + 5, 5), 1, 203, 0, 0.04));
    const t = (input.value - o.min) / (o.max - o.min), x = a + t * (b - a);
    thumb.setAttribute('d', A.brush(A.line(x + 1.2, y - 11, x - 1.2, y + 11, 16), 2.4, 204, 0.35, 0.06));
    out.textContent = fmt(+input.value);
    input.setAttribute('aria-valuetext', fmt(+input.value));
  }
  input.addEventListener('input', () => { draw(); if (o.input) o.input(+input.value); });
  const ro = new ResizeObserver(draw); ro.observe(svg);
  draw();
  return {
    node: wrap,
    get value() { return +input.value; },
    set(v) { input.value = v; draw(); },
    destroy() { ro.disconnect(); },
  };
}
