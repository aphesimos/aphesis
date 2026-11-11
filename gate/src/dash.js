/* dash: the owner's desk, behind the gate. A title and its gloss, one line of places (archive, book, works,
   moderation, texts) and the way out; each place is made the first time it is opened and kept after. */

import { h, act } from './ui.js';
import { createArchiveEditor } from './ed-archive.js';
import { createEntriesEditor } from './ed-entries.js';
import { createModeration } from './moderation.js';
import { createTexts } from './ed-texts.js';

const PLACES = [
  { id: 'archive', name: 'archive', gl: 'codex', lang: 'la' },
  { id: 'books', name: 'book', gl: 'liber', lang: 'la' },
  { id: 'works', name: 'works', gl: 'opera', lang: 'la' },
  { id: 'moderation', name: 'moderation', gl: 'custodia', lang: 'la' },
  { id: 'texts', name: 'texts', gl: 'verba', lang: 'la' },
];

export function createDash({ api, root, onLeave }) {
  const panes = {}, made = {};
  const nav = h('nav', { class: 'places', 'aria-label': 'the desk' });
  const body = h('div', { class: 'desk-body' });
  const leave = act('leave', async () => { await api.logout(); onLeave(); }, { class: 'act aph-label leave', 'data-tip': 'sign out' });
  const tabs = PLACES.map((p) => {
    const b = h('button', { type: 'button', class: 'place', role: 'tab', 'aria-selected': 'false', 'data-cursor': '.55', 'data-place': p.id, onclick: () => show(p.id) },
      h('span', { class: 'aph-label', text: p.name }), h('span', { class: 'aph-gloss', lang: p.lang, text: p.gl }));
    return b;
  });
  nav.append(...tabs, leave);
  root.replaceChildren(
    h('header', { class: 'desk-head aph-ink' },
      h('p', { class: 'gloss-title aph-gloss', lang: 'la', text: 'scriptorium' }),
      h('h1', { class: 'title aph-display', tabindex: '-1', text: 'desk' })),
    nav, body);

  function show(id) {
    /* a place opens at the top of the desk, its title and the places in view, clear of the seal's corner */
    const scroller = root.closest('#desk'); if (scroller) scroller.scrollTop = 0;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.place === id)));
    Object.entries(panes).forEach(([k, el]) => { el.hidden = k !== id; });
    if (!made[id]) {
      const el = h('div', { class: 'place-body', 'data-place': id, role: 'tabpanel' });
      body.append(el);
      panes[id] = el;
      if (id === 'archive') made[id] = createArchiveEditor({ api, root: el });
      else if (id === 'moderation') made[id] = createModeration({ api, root: el });
      else if (id === 'texts') made[id] = createTexts({ api, root: el });
      else made[id] = createEntriesEditor({ api, root: el, kind: id });
      if (id === 'moderation' || id === 'texts') made[id].load();
    } else if (made[id].load && !(made[id].current)) made[id].load();
    root.dataset.place = id;
  }
  show('archive');
  return { show, panes, made };
}
