/* drift: the lines in the fog. A few at a time, each at its own depth: near lines are larger, clearer and drift a
   little faster; far ones are small, faint and soft. Each condenses out of the fog (a blur that clears, a gentle
   rise), drifts for a while and thins back into it. Hovering or focusing a line holds it still and brings it
   forward; letting go lets it drift on.

   createDrift(list, { rect, describe }) -> { set(messages), push(message), zones(), resize() }
   rect() gives the field the lines may use, in viewport pixels: { left, top, width, height }.
   describe(message) -> { tip, label } for the tooltip and the accessible name.

   The owner's lines (`owner: true`, which only the server gives: the owner writes from the desk, and the content
   service passes it on with the wall's admin token) carry the owner's mark above the words: a small live
   Aphesis.Eye in rubedo and the name, aphesist, in Aphesis Script, at the line's depth. The eyes are `shared`: one
   tick for the page, still while off screen, gone with their line. */

import { clamp } from './motion.js';

const A = window.Aphesis;
const IN = 2600;   /* condense */
const OUT = 1800;  /* thin out */
const GAP = 18;                  /* the clearing kept between two lines, px */
export const OWNER = 'aphesist';

export function createDrift(list, { rect, describe }) {
  let pool = [], queue = [], items = [], field = rect(), last = performance.now(), nextSpawn = 0, seed = 1;
  const rnd = () => Math.random();

  const phone = () => field.width < 560;
  const target = () => clamp(Math.round((field.width * field.height) / (phone() ? 52000 : 82000)), 3, phone() ? 6 : 9);

  /* depth z: 0 near, 1 far */
  function look(z) {
    const near = phone() ? 16 : 19, far = phone() ? 11.5 : 12.5;
    return { size: near - (near - far) * z, alpha: 0.96 - 0.5 * z, blur: z < 0.3 ? 0 : (z - 0.3) * 1.8 };
  }

  function nextMessage() {
    const shown = new Set(items.map((it) => it.msg.id));
    for (let tries = 0; tries < 2; tries++) {
      while (queue.length) {
        const m = queue.shift();
        if (!shown.has(m.id) && pool.includes(m)) return m;
      }
      /* a new round: shuffled, so the order never settles into a loop */
      queue = pool.slice().sort(() => rnd() - 0.5);
    }
    return null;
  }

  function overlaps(box) {
    return items.some((it) => {
      if (it.gone) return false;
      const b = it.sweep;
      return box.left < b.left + b.width + GAP && b.left < box.left + box.width + GAP &&
        box.top < b.top + b.height + GAP && b.top < box.top + box.height + GAP;
    });
  }

  function spawn(msg, opts = {}) {
    const el = document.createElement('li');
    const inner = document.createElement('span');
    el.className = 'line';
    inner.className = 'line-text aph-on-fog';
    inner.textContent = msg.text;
    const owner = msg.owner === true;
    let eye = null;
    if (owner) {
      el.classList.add('owner');
      const mark = document.createElement('span');
      mark.className = 'line-owner aph-on-fog';
      mark.setAttribute('aria-hidden', 'true');
      mark.innerHTML = '<span class="owner-eye aph-red"></span><span class="owner-name aph-display">' + OWNER + '</span>';
      el.appendChild(mark);
      eye = mark.firstChild;
    }
    el.appendChild(inner);
    el.tabIndex = 0;
    const d = describe(msg);
    if (d.tip) el.dataset.tip = d.tip;
    if (d.label) el.setAttribute('aria-label', d.label);
    if (msg.mine) el.classList.add('mine');

    const z = opts.z !== undefined ? opts.z : Math.pow(rnd(), 0.8);
    const lk = look(z);
    el.style.setProperty('--size', lk.size.toFixed(2) + 'px');
    el.style.setProperty('--alpha', lk.alpha.toFixed(3));
    el.style.setProperty('--blur', lk.blur.toFixed(2) + 'px');
    el.style.setProperty('--lift', (19 / lk.size).toFixed(3));
    /* the owner's eye, twice the words' size wide (near 38px, far 25px), alive on the shared tick */
    if (eye) {
      const px = Math.round(lk.size * 2);
      eye.style.width = px + 'px';
      if (A && typeof A.Eye === 'function') A.Eye(eye, { size: px, shared: true, drawIn: false, gaze: 'auto', blink: true });
      else if (A && A.icon) eye.innerHTML = A.icon('eye', 0);
    }
    el.style.maxWidth = Math.min(field.width * 0.88, phone() ? 330 : 470) + 'px';
    el.style.opacity = '0';
    list.appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;

    const hold = (opts.hold || (13000 + rnd() * 9000));
    const life = (IN + hold + OUT) / 1000;
    const speed = (5 + rnd() * 6) * (1.15 - z * 0.6); /* px per second, near lines a little faster */
    const dir = rnd() < 0.5 ? -1 : 1;
    /* the whole path stays inside the field: a wide line on a narrow screen drifts less */
    const room = Math.max(0, field.width - w) / life;
    const vx = Math.min(speed, room) * dir, vy = -(1 + rnd() * 1.5);
    const travelX = vx * life, travelY = vy * life - 16;

    /* a place where the whole of its path stays clear of the others */
    let pos = null;
    for (let i = 0; i < 24 && !pos; i++) {
      const spanX = Math.max(0, field.width - w - Math.abs(travelX));
      const spanY = Math.max(0, field.height - h - Math.abs(travelY));
      let x = field.left + (travelX < 0 ? -travelX : 0) + rnd() * spanX;
      let y = field.top + 14 + (travelY < 0 ? -travelY : 0) + rnd() * spanY;
      if (opts.near && i < 12) { /* a new line: near the middle, low in the field, close to where it was written */
        x = field.left + (field.width - w) / 2 + (rnd() - 0.5) * Math.min(160, spanX);
        y = field.top + field.height - h - 18 - rnd() * field.height * 0.3 - Math.max(0, -travelY);
      }
      const sweep = {
        left: Math.min(x, x + travelX), top: Math.min(y, y + travelY),
        width: w + Math.abs(travelX), height: h + Math.abs(travelY),
      };
      if (!overlaps(sweep) || (opts.near && i === 23)) pos = { x, y, sweep };
    }
    if (!pos) { el.remove(); return null; }

    const it = {
      msg, el, w, h, z, x0: pos.x, y0: pos.y, vx, vy, hold, age: 0, phase: rnd() * 6.28, sweep: pos.sweep,
      held: 0, hover: false, focus: false, gone: false, s: seed++,
    };
    const hold_ = () => { it.held = it.hover || it.focus; el.classList.toggle('fwd', !!it.held); };
    el.addEventListener('pointerenter', () => { it.hover = true; hold_(); });
    el.addEventListener('pointerleave', () => { it.hover = false; hold_(); });
    el.addEventListener('focus', () => { it.focus = true; hold_(); });
    el.addEventListener('blur', () => { it.focus = false; hold_(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') el.blur(); });
    items.push(it);
    place(it);
    return it;
  }

  function place(it) {
    const t = it.age / 1000;
    const kin = A.MJ(clamp(it.age / IN, 0, 1));
    const kout = A.MJ(clamp((it.age - IN - it.hold) / OUT, 0, 1));
    const p = kin * (1 - kout);
    const bob = Math.sin(t * 0.35 + it.phase) * 3;
    const x = it.x0 + it.vx * t;
    const y = it.y0 + it.vy * t + bob + (1 - kin) * 14 - kout * 10;
    const blur = (1 - kin) * 9 + kout * 7;
    it.p = p; it.x = x; it.y = y;
    it.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    it.el.style.opacity = it.held ? Math.max(p, 1).toFixed(3) : p.toFixed(3);
    it.el.style.filter = blur > 0.05 && !it.held ? `blur(${blur.toFixed(2)}px)` : '';
    it.el.classList.toggle('faint', p < 0.35 && !it.held);
  }

  function frame(now) {
    const dt = Math.min(400, now - last); last = now; /* a hidden tab resumes where it was */
    for (const it of items) {
      if (!it.held) it.age += dt;
      place(it);
      if (it.age >= IN + it.hold + OUT) it.gone = true;
    }
    items = items.filter((it) => {
      if (!it.gone) return true;
      if (document.activeElement === it.el) { it.gone = false; it.age = IN; return true; }
      it.el.remove();
      return false;
    });
    const live = items.length;
    if (pool.length && now >= nextSpawn && live < Math.min(target(), pool.length)) {
      const m = nextMessage();
      if (m) spawn(m);
      nextSpawn = now + (live < 2 ? 700 : 1900 + rnd() * 1600);
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame((t) => { last = t; nextSpawn = t + 300; frame(t); });

  return {
    /* the visitor's own lines come first, the rest in a shuffled round */
    set(messages) {
      pool = messages.slice();
      queue = pool.filter((m) => m.mine).concat(pool.filter((m) => !m.mine).sort(() => rnd() - 0.5));
    },
    /* a line just written: first in, near, held a little longer */
    push(msg) {
      pool = [msg].concat(pool.filter((m) => m.id !== msg.id));
      /* make room if the field is full: the faintest far line thins out early */
      if (items.length >= target()) {
        const far = items.filter((it) => !it.held).sort((a, b) => b.z - a.z)[0];
        if (far) far.age = Math.max(far.age, IN + far.hold);
      }
      const it = spawn(msg, { near: true, z: 0.04, hold: 26000 });
      if (!it) queue.unshift(msg);
      return it;
    },
    /* calm clearings in the fog behind the lines, growing as each condenses */
    zones() {
      /* a clearing scales with the line's presence, from nothing, so a faint line never leaves an empty hole */
      return items.map((it) => {
        const p = it.held ? 1 : it.p || 0;
        return { it, k: p * p * (1 - it.z * 0.45) };
      }).filter((o) => o.k > 0.06).sort((a, b) => a.it.z - b.it.z).map(({ it, k }) => {
        const w = it.w * k, h = it.h * k;
        return { left: it.x + (it.w - w) / 2, top: it.y + (it.h - h) / 2, width: w, height: h, pad: 2 + 12 * k };
      });
    },
    resize() {
      field = rect();
      items.forEach((it) => {
        if (it.x0 + it.w > field.left + field.width + 40 || it.y0 + it.h > field.top + field.height + 40) {
          it.age = Math.max(it.age, IN + it.hold);
        }
      });
    },
    get count() { return items.length; },
  };
}
