/* ed-entries: book entries and works, one editor for both. The list, the fields, the picture (turned into a density
   map in the browser by the forum's rules, then uploaded), and the preview: the picture as a simulacrum with the
   entry's own settings and adjustments, beside its words set as the section sets them. One Simulacrum canvas serves
   every preview, so the dashboard holds the fog and at most two simulacra (this one and the archive's figure). */

import { h, act, sure, field, text, area, check, status, debounce, slugify, rule, setLabel } from './ui.js';
import { toDensity, checkFile, ACCEPT } from './forum/density.js';

const A = window.Aphesis;
let sim = null, simCanvas = null;
function simulacrum() {
  if (!sim) {
    simCanvas = h('canvas', { class: 'sim-canvas', 'aria-hidden': 'true' });
    sim = A.Simulacrum(simCanvas, { ground: false, fit: 'contain', margin: 0.06, scatter: 0.6, erosion: 0.5, ceiling: 0.8, accent: 0.03 });
  }
  return { sim, canvas: simCanvas };
}

/* the book's own preparation of a map: crop, blur, brightness, contrast (book/src/main.js, prepare) */
function prepare(img, e) {
  if (!e.crop && !e.blur && !e.contrast && !e.brightness) {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return c;
  }
  const [x, y, w, hh] = e.crop || [0, 0, img.naturalWidth, img.naturalHeight];
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(hh));
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const f = (e.blur ? 'blur(' + e.blur + 'px) ' : '') + (e.brightness ? 'brightness(' + e.brightness + ') ' : '') + (e.contrast ? 'contrast(' + e.contrast + ')' : '');
  if (f) g.filter = f.trim();
  g.drawImage(img, x, y, w, hh, 0, 0, c.width, c.height);
  return c;
}
const images = new Map();
function image(url) {
  if (!images.has(url)) images.set(url, new Promise((resolve) => { const im = new Image(); if (!url.startsWith('data:')) im.crossOrigin = 'anonymous'; im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = url; }));
  return images.get(url);
}

/* ---------- what differs between a book entry and a work ---------- */
const KINDS = {
  books: {
    one: 'book', key: 'slug', noun: 'entry', title: (e) => e.title, meta: (e) => e.author + ' · ' + e.year,
    blank: (n) => ({ slug: '', title: '', author: '', year: '', note: [], quote: '', quote_lang: '', quote_en: '', caption: '', picture: null, adjust: {}, position: n + 1, example: false }),
    pictureOf: (e) => e.picture, settingsOf: (e) => e.adjust || {},
    numbers: [['gain', 'gain'], ['scatter', 'scatter'], ['erosion', 'erosion'], ['ceiling', 'ceiling'], ['blur', 'blur · px'], ['contrast', 'contrast'], ['brightness', 'brightness']],
    fields: [['title', 'title', 1], ['slug', 'slug · the address', 0, '#book/<slug>'], ['author', 'author', 1], ['year', 'year', 0], ['caption', 'caption · work · artist, date', 1],
      ['note', 'the note · paragraphs, a blank line between them', 1, '60 to 200 words read best', 'area'], ['quote', 'quote · in its own language', 1, '', 'area'],
      ['quote_lang', 'its language · la, grc, de…', 0], ['quote_en', 'the english · in the tooltip', 1]],
  },
  works: {
    one: 'work', key: 'id', noun: 'work', title: (e) => e.name, meta: (e) => e.gloss + ' · ' + e.year,
    blank: (n) => ({ id: '', name: '', gloss: '', gloss_tip: '', year: '', role: '', description: '', links: [], map: null, sources: {}, flags: {}, position: n + 1 }),
    pictureOf: (e) => e.map, settingsOf: (e) => (e.map && e.map.settings) || {},
    numbers: [['scatter', 'scatter'], ['erosion', 'erosion'], ['ceiling', 'ceiling'], ['gain', 'gain']],
    fields: [['name', 'name', 1], ['id', 'id · the address', 0, '#works-<id>'], ['gloss', 'gloss · a latin or greek word', 0], ['gloss_tip', 'the gloss · its english', 1],
      ['year', 'year', 0], ['role', 'role · what I did', 1], ['description', 'description · 40 to 90 words', 1, '', 'area']],
  },
};

export function createEntriesEditor({ api, root, kind }) {
  const K = KINDS[kind];
  let items = [], cur = null;
  const listEl = h('ol', { class: 'entries', 'aria-label': kind });
  const say = h('p', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
  const listView = h('section', { class: 'pane list' }, h('div', { class: 'pane-head' }, act('new ' + K.noun, () => open(null)), say), listEl);
  root.append(listView);

  async function load() {
    const r = await api.list(kind);
    if (r.status !== 200) { status(say, r.data.error || 'they did not come', true); return; }
    items = r.data[kind];
    listEl.replaceChildren(...items.map((e) => h('li', { class: 'entry' },
      h('button', { type: 'button', class: 'entry-link', 'data-cursor': '.55', onclick: () => open(e[K.key]), 'data-slug': e[K.key] },
        h('span', { class: 'entry-name aph-ink', text: K.title(e) }),
        h('span', { class: 'entry-meta aph-meta aph-ink', text: K.meta(e) + ' · ' + (e.published ? 'published' : 'draft') })))));
    if (!items.length) listEl.append(h('li', { class: 'empty aph-meta aph-ink', text: 'nothing yet.' }));
  }
  function open(id) {
    const e = id ? structuredClone(items.find((x) => x[K.key] === id)) : K.blank(items.length);
    listView.hidden = true;
    cur = editor(e, !id);
    root.append(cur.el);
    cur.el.querySelector('input').focus({ preventScroll: true });
  }
  function close() {
    if (sim) sim.hide();
    if (cur) cur.el.remove();
    cur = null; listView.hidden = false; load();
  }

  function editor(e, fresh) {
    let saved = fresh ? '' : e[K.key], dirty = false;
    let pic = K.pictureOf(e) ? { ...K.pictureOf(e) } : null;
    const say = h('p', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
    const f = {};
    const fieldEls = K.fields.map(([k, label, spell, hint, type]) => {
      let v = e[k] ?? '';
      if (k === 'note' && Array.isArray(v)) v = v.join('\n\n');
      f[k] = type === 'area' ? area(String(v), { rows: k === 'quote' ? 3 : 8, 'data-spell': spell ? '1' : null }) : text(String(v), { 'data-spell': spell ? '1' : null });
      return field(label, f[k], hint);
    });
    const titleKey = K.fields[0][0];
    if (fresh) f[titleKey].addEventListener('input', () => { if (!f[K.key].dataset.touched) f[K.key].value = slugify(f[titleKey].value); });
    f[K.key].addEventListener('input', () => { f[K.key].dataset.touched = '1'; });
    const position = text(String(e.position ?? 0), { inputmode: 'numeric' });
    const settings = K.settingsOf(e);
    const nums = {};
    const numEls = K.numbers.map(([k, label]) => { nums[k] = text(settings[k] === undefined ? '' : String(settings[k]), { inputmode: 'decimal', placeholder: '·' }); return field(label, nums[k]); });
    let crop = null;
    if (kind === 'books') { crop = text(settings.crop ? settings.crop.join(' ') : '', { placeholder: 'x y width height', inputmode: 'decimal' }); numEls.push(field('crop · in map pixels', crop)); }
    const example = kind === 'books' ? check('example', e.example, () => refresh()) : null;
    const mapCaption = kind === 'works' ? text((e.map && e.map.caption) || '', { 'data-spell': '1' }) : null;
    /* links, for a work */
    const linksEl = h('ol', { class: 'links-ed' });
    function linkRow(l = { label: '', href: '' }) {
      const a = text(l.label, { class: 'link-l aph-ink', 'aria-label': 'the link’s words' });
      const b = text(l.href, { class: 'link-h aph-ink', 'aria-label': 'its address', inputmode: 'url' });
      const li = h('li', {}, a, b, act('remove', () => { li.remove(); refresh(); }));
      [a, b].forEach((x) => x.addEventListener('input', () => refresh()));
      return li;
    }
    if (kind === 'works') (e.links || []).forEach((l) => linksEl.append(linkRow(l)));

    const file = h('input', { type: 'file', accept: ACCEPT.join(','), class: 'file', 'aria-label': 'a picture' });
    const picMeta = h('span', { class: 'aph-meta aph-ink' });
    const showPic = () => { picMeta.textContent = pic ? `density map · ${pic.w} × ${pic.h}` : 'no picture yet'; };
    showPic();
    file.addEventListener('change', async () => {
      const fl = file.files[0]; file.value = '';
      const bad = checkFile(fl);
      if (bad) { status(say, bad, true); return; }
      status(say, 'making the density map…');
      try {
        const d = await toDensity(fl);
        const r = await api.upload(d.blob);
        if (r.status !== 201) { status(say, r.data.error || 'the picture did not go', true); return; }
        pic = { key: r.data.key, w: r.data.w, h: r.data.h, url: r.data.url };
        showPic(); status(say, 'the picture is up'); refresh();
      } catch (_) { status(say, 'this picture could not be read', true); }
    });

    function num(v) { const s = String(v).trim(); return s === '' ? undefined : Number(s); }
    function entry() {
      const o = {};
      K.fields.forEach(([k]) => { o[k] = f[k].value.trim(); });
      o.position = parseInt(position.value, 10) || 0;
      const st = {};
      K.numbers.forEach(([k]) => { const n = num(nums[k].value); if (n !== undefined && Number.isFinite(n)) st[k] = n; });
      if (kind === 'books') {
        if (crop && crop.value.trim()) st.crop = crop.value.trim().split(/[\s,]+/).map(Number);
        o.adjust = st; o.picture = pic && { key: pic.key, w: pic.w, h: pic.h }; o.example = example.value;
      } else {
        o.map = pic && { key: pic.key, w: pic.w, h: pic.h, caption: mapCaption.value.trim(), settings: st };
        o.links = [...linksEl.children].map((li) => ({ label: li.querySelector('.link-l').value.trim(), href: li.querySelector('.link-h').value.trim() })).filter((l) => l.label || l.href);
        o.sources = e.sources || {}; o.flags = e.flags || {};
      }
      return o;
    }
    async function save() {
      const o = entry();
      const r = await api.save(kind, saved || o[K.key], o);
      if (r.status !== 200 && r.status !== 201) { status(say, r.data.error || 'it did not save', true); return false; }
      const back = r.data[K.one]; saved = back[K.key]; e.published = back.published; dirty = false; state(); status(say, 'saved');
      return true;
    }
    const pubLabel = () => (e.published ? 'unpublish' : 'publish');
    const pub = act(pubLabel(), async () => {
      if (!saved) { status(say, 'save it first', true); return; }
      if (dirty && !(await save())) return;
      const r = await api.publish(kind, saved, !e.published);
      if (r.status !== 200) { status(say, r.data.error || 'no', true); return; }
      e.published = r.data[K.one].published; setLabel(pub, pubLabel()); state();
      status(say, e.published ? 'published: it is on the site now' : 'back to a draft');
    });
    const stateEl = h('span', { class: 'aph-meta aph-ink state' });
    const state = () => { stateEl.textContent = (saved ? (e.published ? 'published' : 'draft') : 'not saved yet') + (dirty ? ' · changed' : ''); };

    /* the preview: the simulacrum with the entry's settings, its words as the section sets them */
    const stage = h('div', { class: 'gp-sim', 'aria-hidden': 'true' });
    const words = h('div', { class: 'gp-words' });
    let shownSrc = null, token = 0;
    const refresh = debounce(async () => {
      const o = entry();
      dirty = true; state();
      if (kind === 'books') {
        const note = o.note.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        const q = o.quote ? h('blockquote', { class: 'gp-quote aph-ink' }, h('p', { lang: o.quote_lang || null, 'data-tip': o.quote_en || null, text: o.quote })) : null;
        words.replaceChildren(
          h('p', { class: 'gp-cap aph-meta aph-ink', text: o.caption }),
          h('h2', { class: 'gp-title aph-display aph-ink', text: o.title || 'untitled' }),
          h('p', { class: 'aph-meta aph-ink', text: [o.author, o.year].filter(Boolean).join(' · ') }),
          ...note.map((t) => h('p', { class: 'gp-note aph-ink', text: t })), q);
      } else {
        words.replaceChildren(
          h('p', { class: 'aph-gloss aph-ink', 'data-tip': o.gloss_tip || null, text: o.gloss }),
          h('h2', { class: 'gp-title aph-display aph-ink', text: o.name || 'untitled' }),
          h('p', { class: 'gp-note aph-ink', text: o.description }),
          h('p', { class: 'aph-meta aph-ink', text: [o.year, o.role].filter(Boolean).join(' · ') }),
          h('ul', { class: 'gp-links' }, ...o.links.map((l) => h('li', { class: 'aph-label aph-ink', text: l.label }))),
          o.map && o.map.caption ? h('p', { class: 'gp-cap aph-meta aph-ink', text: o.map.caption }) : null);
      }
      const t = ++token;
      if (!pic || !pic.url) { if (sim) sim.hide(); return; }
      const im = await image(pic.url);
      if (!im || t !== token) return;
      const { sim: s, canvas } = simulacrum();
      if (canvas.parentNode !== stage) stage.append(canvas);
      const st = kind === 'books' ? o.adjust : o.map.settings;
      const src = { src: prepare(im, st) };
      ['gain', 'scatter', 'erosion', 'ceiling'].forEach((k) => { if (st[k] !== undefined) src[k] = st[k]; });
      if (shownSrc) s.set(src); else s.show(src);
      shownSrc = src;
    }, 320);
    [...Object.values(f), ...Object.values(nums), position, crop, mapCaption].filter(Boolean).forEach((x) => x.addEventListener('input', refresh));

    let leaving = 0;
    const back = act('all ' + kind, () => {
      if (dirty && !leaving) { setLabel(back, 'leave unsaved?'); leaving = setTimeout(() => { leaving = 0; setLabel(back, 'all ' + kind); }, 4000); return; }
      clearTimeout(leaving); close();
    });
    const el = h('section', { class: 'pane editor', 'data-mode': 'write', 'aria-label': 'a ' + K.noun },
      h('div', { class: 'pane-head' }, back, stateEl),
      h('div', { class: 'split' },
        h('div', { class: 'write' },
          ...fieldEls,
          kind === 'works' ? field('caption · what the picture is', mapCaption) : null,
          kind === 'works' ? h('div', { class: 'field' }, h('span', { class: 'aph-label aph-ink', text: 'links' }), linksEl, act('add a link', () => { linksEl.append(linkRow()); refresh(); })) : null,
          h('div', { class: 'field' }, h('span', { class: 'aph-label aph-ink', text: 'picture' }), picMeta,
            h('label', { class: 'act aph-label file-act', 'data-cursor': '.55' }, h('span', { class: 'act-t', text: pic ? 'another picture' : 'a picture' }), file, rule('uline', 1.4))),
          h('div', { class: 'nums' }, ...numEls),
          field('place in the order', position),
          example ? h('div', { class: 'field' }, example.el) : null,
          h('div', { class: 'acts' }, act('save', save), pub, sure('delete', async () => {
            if (!saved) { close(); return; }
            const r = await api.remove(kind, saved);
            if (r.status !== 200) { status(say, r.data.error || 'no', true); return; }
            close();
          })),
          say),
        h('div', { class: 'read', 'aria-label': 'the preview' }, stage, words)));
    state();
    refresh();
    setTimeout(() => { dirty = false; state(); }, 400);
    return { el, save, entry };
  }

  load();
  return { load, open, close, get current() { return cur; } };
}
