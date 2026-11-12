/* ed-me: the me page (me.aphes.ist), edited from the desk. One scrolling column in three parts: the page's words (the
   texts of the `me` screen, set by ed-texts.js), the works on the page (each work's one line and its status), and
   the awards (a small list of their own). The words and the awards are the content service's (`/v1/admin/texts`,
   `/v1/admin/awards`); a work's line and status ride on the work itself, saved with the existing PUT of the whole
   work, so the work is fetched, merged and put back. The page reads them on its next load. Errors speak in the
   page's own voice, from the server's message. */

import { h, act, sure, field, text, area, status, slugify, setLabel } from './ui.js';
import { createTexts } from './ed-texts.js';

/* the name is read in the script, everything else in the text face */
const face = (key) => (key === 'me.name' ? 'aph-display tx-name' : '');

export function createMe({ api, root, openWork }) {
  const say = h('p', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
  const worksEl = h('ol', { class: 'me-list' });
  const awardsEl = h('ol', { class: 'me-list' });
  const newEl = h('div', { class: 'me-new' });
  const wordsEl = h('div', { class: 'me-words' });
  let awards = [];

  const part = (id, title, note, ...kids) => h('section', { class: 'me-part', 'aria-labelledby': 'me-' + id },
    h('h2', { class: 'mod-h aph-display aph-ink', id: 'me-' + id, text: title }),
    note ? h('p', { class: 'tx-note aph-meta aph-ink', text: note }) : null, ...kids);
  const newAward = act('new award', () => openNew());
  root.append(h('section', { class: 'pane me' },
    h('div', { class: 'pane-head' }, act('reload', () => load()), say),
    part('words', 'words', 'what the page says. one line each; Enter saves. the page reads them on its next load.', wordsEl),
    part('works', 'works on the page',
      'each work’s one line and its status, as the page shows them. the whole work (description, links, picture) is edited in works · opera.', worksEl),
    part('awards', 'awards', 'in the order the page shows them. a draft is not on the page.', h('div', { class: 'pane-head' }, newAward), newEl, awardsEl)));

  const texts = createTexts({ api, root: wordsEl, only: 'me', embed: true, say, face, maxlength: 400 });

  async function load() {
    status(say, '');
    await Promise.all([texts.load(), loadWorks(), loadAwards()]);
  }

  /* ---------- the works' lines ---------- */
  async function loadWorks() {
    const r = await api.list('works');
    if (r.status !== 200) { status(say, r.data.error || "couldn't load the works", true); return; }
    /* the published first, then the drafts, each in position order */
    const ws = [...r.data.works].sort((a, b) => (b.published - a.published) || (a.position - b.position));
    worksEl.replaceChildren(...ws.map(workRow));
    if (!ws.length) worksEl.append(h('li', { class: 'empty aph-meta aph-ink', text: 'no works yet.' }));
  }

  function workRow(w) {
    let line = w.line || '', state = w.status || '';
    const lineIn = area(line, { rows: 3, maxlength: '300', 'data-spell': '1', class: 'aph-ink', 'aria-label': 'its line' });
    const stateIn = text(state, { maxlength: '40', 'data-spell': '1', placeholder: '·' });
    const rowSay = h('span', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
    const save = act('save', () => send());
    const el = h('li', { class: 'me-row', 'data-id': w.id },
      h('p', { class: 'me-name aph-ink' }, w.name, h('span', { class: 'aph-meta aph-ink', text: ' · ' + (w.published ? 'published' : 'draft') })),
      field('its line · up to 300', lineIn), field('its status · up to 40', stateIn),
      h('div', { class: 'tx-acts' }, save, act('open in works', () => openWork(w.id), { 'data-tip': 'the whole work: description, links, picture' }), rowSay));
    const changed = () => lineIn.value.trim() !== line || stateIn.value.trim() !== state;
    function show() { const d = changed(); save.disabled = !d; el.classList.toggle('dirty', d); }
    async function send() {
      if (!changed()) return;
      setLabel(save, 'saving…');
      /* the whole work is put back: fetch it fresh, change the two, drop what the editor drops (the picture's url) */
      const got = await api.get('works', w.id);
      if (got.status !== 200) { setLabel(save, 'save'); status(rowSay, got.data.error || "couldn't read the work", true); return; }
      const next = { ...got.data.work, line: lineIn.value.trim(), status: stateIn.value.trim() };
      delete next.published;
      if (next.map) { next.map = { ...next.map }; delete next.map.url; }
      const r = await api.save('works', w.id, next);
      setLabel(save, 'save');
      if (r.status !== 200) { status(rowSay, r.data.error || 'it did not save', true); return; }
      line = r.data.work.line || ''; state = r.data.work.status || '';
      lineIn.value = line; stateIn.value = state; show(); status(rowSay, 'saved');
    }
    [lineIn, stateIn].forEach((x) => x.addEventListener('input', () => { status(rowSay, ''); show(); }));
    /* one line: Enter saves */
    [lineIn, stateIn].forEach((x) => x.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } }));
    show();
    return el;
  }

  /* ---------- the awards ---------- */
  async function loadAwards() {
    const r = await api.list('awards');
    if (r.status !== 200) { status(say, r.data.error || "couldn't load the awards", true); return; }
    awards = [...r.data.awards].sort((a, b) => a.position - b.position);
    draw();
  }
  function draw() {
    awardsEl.replaceChildren(...awards.map((a, i) => awardRow(a, i)));
    if (!awards.length) awardsEl.append(h('li', { class: 'empty aph-meta aph-ink', text: 'no awards yet.' }));
  }

  /* the order is the positions: moving one rewrites them 1, 2, 3… and puts back only those that changed */
  async function move(i, by) {
    const j = i + by; if (j < 0 || j >= awards.length) return;
    const order = [...awards];
    [order[i], order[j]] = [order[j], order[i]];
    for (let n = 0; n < order.length; n++) {
      const a = order[n];
      if (a.position === n + 1) continue;
      const r = await api.save('awards', a.id, { id: a.id, title: a.title, note: a.note, line: a.line, position: n + 1 });
      if (r.status !== 200) { status(say, r.data.error || "the order didn't change", true); await loadAwards(); return; }
    }
    status(say, 'moved');
    await loadAwards();
  }

  function awardRow(a, i) {
    const title = text(a.title, { maxlength: '160', 'data-spell': '1' });
    const note = text(a.note || '', { maxlength: '120', 'data-spell': '1', placeholder: '·' });
    const line = area(a.line || '', { rows: 3, maxlength: '400', 'data-spell': '1', class: 'aph-ink', 'aria-label': 'its line' });
    const rowSay = h('span', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
    const stateEl = h('span', { class: 'aph-meta aph-ink' });
    const save = act('save', () => send());
    const pubLabel = () => (a.published ? 'unpublish' : 'publish');
    const pub = act(pubLabel(), async () => {
      if (changed() && !(await send())) return;
      const r = await api.publish('awards', a.id, !a.published);
      if (r.status !== 200) { status(rowSay, r.data.error || 'no', true); return; }
      a.published = r.data.award.published; setLabel(pub, pubLabel()); show();
      status(rowSay, a.published ? 'published: it is on the page now' : 'back to a draft');
    });
    const up = act('move up', () => move(i, -1)), down = act('move down', () => move(i, 1));
    up.disabled = i === 0; down.disabled = i === awards.length - 1;
    const el = h('li', { class: 'me-row award', 'data-id': a.id },
      h('p', { class: 'me-name aph-ink' }, String(i + 1) + ' · ', stateEl),
      field('title · up to 160', title), field('note · up to 120', note), field('its line · up to 400', line),
      h('div', { class: 'tx-acts' }, save, pub, up, down,
        sure('delete', async () => {
          const r = await api.remove('awards', a.id);
          if (r.status !== 200) { status(rowSay, r.data.error || 'no', true); return; }
          await loadAwards();
        }), rowSay));
    const val = () => ({ title: title.value.trim(), note: note.value.trim(), line: line.value.trim() });
    const changed = () => { const v = val(); return v.title !== a.title || v.note !== (a.note || '') || v.line !== (a.line || ''); };
    function show() {
      const d = changed(); save.disabled = !d; el.classList.toggle('dirty', d);
      stateEl.textContent = a.title ? (a.published ? 'published' : 'draft') + (d ? ' · not saved' : '') : '';
    }
    async function send() {
      const v = val();
      if (!v.title) { status(rowSay, 'it needs a title', true); return false; }
      setLabel(save, 'saving…');
      const r = await api.save('awards', a.id, { id: a.id, position: a.position, ...v });
      setLabel(save, 'save');
      if (r.status !== 200) { status(rowSay, r.data.error || 'it did not save', true); return false; }
      Object.assign(a, r.data.award); show(); status(rowSay, 'saved');
      return true;
    }
    [title, note, line].forEach((x) => x.addEventListener('input', () => { status(rowSay, ''); show(); }));
    [title, note].forEach((x) => x.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } }));
    show();
    return el;
  }

  /* a new award: its title makes the id (a slug, which the owner may change) */
  function openNew() {
    newAward.disabled = true;
    const title = text('', { maxlength: '160', 'data-spell': '1' });
    const id = text('', { maxlength: '80' });
    const note = text('', { maxlength: '120', 'data-spell': '1', placeholder: '·' });
    const line = area('', { rows: 3, maxlength: '400', 'data-spell': '1', class: 'aph-ink', 'aria-label': 'its line' });
    const nSay = h('span', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
    title.addEventListener('input', () => { if (!id.dataset.touched) id.value = slugify(title.value); });
    id.addEventListener('input', () => { id.dataset.touched = '1'; });
    const close = () => { newEl.replaceChildren(); newAward.disabled = false; };
    async function create() {
      const t = title.value.trim(), slug = id.value.trim();
      if (!t) { status(nSay, 'it needs a title', true); return; }
      if (!slug) { status(nSay, 'it needs an id: the address, in lowercase letters, digits and hyphens', true); return; }
      const next = awards.reduce((m, a) => Math.max(m, a.position), 0) + 1;
      const r = await api.save('awards', slug, { id: slug, title: t, note: note.value.trim(), line: line.value.trim(), position: next });
      if (r.status !== 200 && r.status !== 201) { status(nSay, r.data.error || 'it did not save', true); return; }
      close(); status(say, 'saved: it is a draft until you publish it'); await loadAwards();
    }
    [title, note, id].forEach((x) => x.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); create(); } }));
    newEl.replaceChildren(h('div', { class: 'me-row award' },
      field('title · up to 160', title), field('id · the address', id), field('note · up to 120', note), field('its line · up to 400', line),
      h('div', { class: 'tx-acts' }, act('save', create), act('cancel', close), nSay)));
    title.focus({ preventScroll: true });
  }

  /* the desk reloads a place it comes back to only when nothing in it is unsaved */
  return { load, get current() { return !!root.querySelector('.me-row.dirty, .tx-row.dirty'); } };
}
