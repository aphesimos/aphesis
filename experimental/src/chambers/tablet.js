/* the emerald tablet.
   Hermes Trismegistus from the pavement of Siena. The tablet's lines are typed and erased in Latin, in order,
   with the English in the tooltip. Where it promises the glory of the whole world, a few red cells appear. */

import { MAPS } from '../assets.js';
import { image, layer, simulacrum } from '../stage.js';
import { inscribe } from '../inscribe.js';

const LINES = [
  { text: 'verum, sine mendacio, certum et verissimum', en: 'true, without falsehood, certain and most true' },
  { text: 'quod est inferius est sicut quod est superius, et quod est superius est sicut quod est inferius, ad perpetranda miracula rei unius', en: 'what is below is like what is above, and what is above is like what is below, to work the miracles of the one thing' },
  { text: 'et sicut res omnes fuerunt ab uno, meditatione unius, sic omnes res natae fuerunt ab hac una re, adaptatione', en: 'and as all things came from the one, by the thought of the one, so all things were born of this one thing, by adaptation' },
  { text: 'pater eius est sol, mater eius luna', en: 'its father is the sun, its mother the moon' },
  { text: 'portavit illud ventus in ventre suo, nutrix eius terra est', en: 'the wind carried it in its belly; its nurse is the earth' },
  { text: 'separabis terram ab igne, subtile ab spisso, suaviter, cum magno ingenio', en: 'you shall separate the earth from the fire, the subtle from the gross, gently, with great skill' },
  { text: 'ascendit a terra in coelum, iterumque descendit in terram', en: 'it rises from the earth to heaven, and comes down again to the earth' },
  { text: 'sic habebis gloriam totius mundi', en: 'so you will have the glory of the whole world', glory: true },
  { text: 'ideo fugiet a te omnis obscuritas', en: 'and so all darkness will flee from you' },
];

export const tablet = {
  id: 'tablet',
  caption: 'hermes trismegistus · Siena Cathedral pavement, 1488',
  label: 'a robed figure on a stone pavement; the lines of the emerald tablet are typed beside him.',
  async create(ctx) {
    const img = await image(MAPS.trismegistus);
    const portrait = innerHeight > innerWidth * 1.1;
    const l = layer(ctx.root);
    const sim = simulacrum(l, { margin: portrait ? 0.02 : 0.08, accent: 0.01 });
    let glory = false;
    const text = inscribe(ctx.root, {
      cls: 'tablet-text', lang: 'la', lines: LINES, hold: 5200,
      onLine: (line) => { glory = !!line.glory; },
    });
    let started = false;
    return {
      layers: [l],
      texts: [text.el],
      enter(done) {
        l.classList.add('on');
        sim.show(img, done);
        setTimeout(() => { text.start(); started = true; }, 1400);
      },
      leave(done) { text.stop(); sim.hide(done); },
      key() { return false; },
      loop(dt, now, paused) {
        if (paused || !started) return;
        const target = glory ? 0.01 + 0.04 * text.progress() : 0.01;
        sim.o.accent += (target - sim.o.accent) * Math.min(1, dt * 1.5);
      },
      destroy() { text.destroy(); sim.stop(); },
    };
  },
};
