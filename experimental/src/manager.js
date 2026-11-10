/* the chamber manager: one chamber at a time, entered from the threshold and left back to it with a dissolve.

   A chamber module exports { id, caption, label, create(ctx) }. create() resolves to
   { layers, texts?, enter(done), leave(done), key(e) -> handled, loop(dt, now, paused), destroy() }.
   ctx gives it a root to put layers and text in, and setCaption(). In the site, create() can sit behind a
   dynamic import so a chamber loads only when it is entered. */

import { frame, isPaused, pulse, REDUCED } from './motion.js';
import { remember } from './memory.js';

export function createManager({ chambers, ground, threshold, gestures, caption, announce, zones }) {
  let active = null, activeDef = null, busy = false, root = null;

  let token = 0;   /* a caption change that arrives after its chamber has gone is dropped */
  function setCaption(text) {
    const t = token;
    caption.classList.remove('on');
    setTimeout(() => { if (t !== token) return; caption.textContent = text; caption.classList.add('on'); }, REDUCED ? 0 : 400);
  }

  async function enter(id) {
    if (busy || active) return;
    const def = chambers[id]; if (!def) return;
    busy = true; activeDef = def;
    gestures.disable();
    threshold.hide();
    threshold.marks(remember(id));
    ground.to(0.3, 1800);
    /* a root that is not a stacking context, so the layers blend straight into the fog */
    root = document.createElement('div');
    root.className = 'chamber-root';
    const desc = document.createElement('p');
    desc.className = 'sr'; desc.tabIndex = -1; desc.setAttribute('role', 'img'); desc.setAttribute('aria-label', def.label);
    root.appendChild(desc);
    document.getElementById('experimental').after(root);
    try {
      active = await def.create({ root, setCaption });
    } catch (err) {
      console.error(err); root.remove(); root = null; busy = false; activeDef = null; return back();
    }
    setCaption(def.caption);
    announce(def.caption);
    zones([caption].concat(active.texts || []));
    desc.focus({ preventScroll: true });
    /* entered while paused: let the picture gather, then hold it still */
    if (isPaused()) pulse(3400);
    active.enter(() => { busy = false; });
    setTimeout(() => { busy = false; }, 3200);
  }

  function leave() {
    if (!active || leaving) return;
    leaving = true; token++;
    const ch = active, r = root;
    caption.classList.remove('on');
    if (isPaused()) pulse(2400);
    let once = false;
    const finish = (fn) => () => { if (once) return; once = true; fn(); };
    const doneLeaving = finish(() => {
      ch.layers.forEach((l) => l.classList.remove('on'));
      setTimeout(() => {
        ch.destroy(); ch.layers.forEach((l) => l.remove()); r.remove();
        if (!active) caption.textContent = '';
        leaving = false;
      }, REDUCED ? 0 : 1200);
      active = null; activeDef = null; root = null; busy = false;
      back();
    });
    ch.leave(doneLeaving);
    setTimeout(doneLeaving, REDUCED ? 50 : 2600);   /* the dissolve takes 1.8 s; never wait on it longer */
  }
  let leaving = false;

  function back() {
    ground.to(0.62, 1800);
    threshold.show();
    zones([]);
    gestures.enable();
    announce('experimental, the threshold');
    setTimeout(() => document.getElementById('h-experimental').focus({ preventScroll: true }), REDUCED ? 0 : 600);
  }

  addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); leave(); return; }
    if (active.key(e)) e.preventDefault();
  });

  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (active) active.loop(dt, now, isPaused());
    else threshold.update(gestures.progress(now), dt);
    frame(loop);
  })(last);

  return { enter, leave, get active() { return activeDef && activeDef.id; } };
}
