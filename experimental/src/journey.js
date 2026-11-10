/* the journey: the door, then one chamber, then the door again, in a fixed order, remembered between visits.

   Every chamber passes through the same sequence, run here so that it is the same for all of them:
     1. the door opens: its night deepens and it dissolves (0.7 s + 1.4 s); the fog thins to the chamber's ground;
     2. the chamber's pictures coalesce out of the fog (Simulacrum show, 2.6 s);
     3. its moment plays: one simple bodily motion, until the chamber says it has ended;
     4. its pictures dissolve (Simulacrum hide, 1.8 s), and their canvases are stopped and removed;
     5. the door re-forms (1.8 s) and the fog returns to the door's ground.
   Each hand-off waits for the animation's callback or a little longer than its duration, whichever comes first,
   so a slow frame can never leave the journey stuck. Everything that travels is eased with minimum jerk.

   A chamber module exports { id, caption, label, create(ctx) }. create() resolves to
   { pictures: [[picture, source], ...], fog?, play(end), loop(dt, now), destroy() }.
   The last chamber (final: true) does not return to an open door: it closes it for good and clears the record,
   so the next visit begins the journey again. */

import { frame, once, REDUCED } from './motion.js';
import { nextStep, saveStep, clearSteps } from './memory.js';

const DOOR_FOG = 0.74, CHAMBER_FOG = 0.3;

export function createJourney({ chambers, ground, door, caption, announce, zones, root: host }) {
  const html = document.documentElement;
  let state = 'door', active = null, def = null, root = null;
  let next = nextStep(chambers.length);

  function mark(s) {
    state = s;
    html.dataset.step = s;
    html.dataset.next = String(next);
    html.dataset.chamber = def ? def.id : '';
  }

  function setCaption(text) {
    caption.classList.remove('on');
    setTimeout(() => { caption.textContent = text; if (text) caption.classList.add('on'); }, REDUCED ? 0 : 400);
  }

  async function open() {
    if (state !== 'door') return;
    def = chambers[next];
    mark('opening');
    ground.to(def.fog === undefined ? CHAMBER_FOG : def.fog, 2000);
    zones(def.final ? 'none' : 'chamber');
    root = document.createElement('div');
    root.className = 'chamber-root';
    const desc = document.createElement('p');
    desc.className = 'sr'; desc.tabIndex = -1; desc.textContent = def.label;
    root.appendChild(desc);
    host.after(root);
    const doorOpened = new Promise((r) => once(2600, (go) => door.open(go), r));
    try {
      active = await def.create({ root, setCaption, door, ground });
    } catch (err) {
      console.error(err);
      root.remove(); root = null; active = null;
      await doorOpened;
      return back(false);
    }
    await doorOpened;
    mark('gathering');
    if (def.caption) setCaption(def.caption);
    announce(def.label);
    desc.focus({ preventScroll: true });
    const pics = active.pictures || [];
    once(pics.length ? 3400 : 0, (go) => {
      if (!pics.length) return go();
      let n = 0;
      pics.forEach(([p, src]) => p.show(src, () => { if (++n === pics.length) go(); }));
    }, () => {
      mark('chamber');
      let ended = false;
      active.play(() => { if (!ended) { ended = true; close(); } });
    });
  }

  function close() {
    if (state !== 'chamber') return;
    mark('closing');
    setCaption('');
    const ch = active, r = root, pics = ch.pictures || [];
    once(pics.length ? 2400 : 0, (go) => {
      if (!pics.length) return go();
      let n = 0;
      pics.forEach(([p]) => p.hide(() => { if (++n === pics.length) go(); }));
    }, () => {
      pics.forEach(([p]) => p.destroy());
      ch.destroy();
      r.remove();
      active = null; root = null;
      back(true);
    });
  }

  function back(advanced) {
    const final = advanced && def && def.final;
    if (final) {
      next = 0; clearSteps(); def = null;
      mark('sealing');
      zones('door');
      ground.to(DOOR_FOG, 2000);
      door.seal(() => mark('sealed'));
      announce('the door is closed.');
      return;
    }
    if (advanced) { next = Math.min(chambers.length - 1, next + 1); saveStep(next); }
    def = null;
    ground.to(DOOR_FOG, 2000);
    zones('door');
    mark('returning');
    door.show(() => mark('door'));
    /* the door can be used as soon as it begins to re-form */
    setTimeout(() => { if (state === 'returning') mark('door'); }, REDUCED ? 0 : 600);
    announce('the door.');
    setTimeout(() => door.el.focus({ preventScroll: true }), REDUCED ? 0 : 600);
  }

  door.el.addEventListener('click', () => {
    if (state === 'door' || state === 'returning') { state = 'door'; open(); }
  });

  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.2, (now - last) / 1000); last = now;   /* a slow device still holds in real time */
    if (active && state === 'chamber') active.loop(dt, now);
    frame(loop);
  })(last);

  mark('door');
  return { get state() { return state; }, get next() { return next; } };
}
