/* ed-texts: the site's texts, the short lines the owner changes without a rebuild (the home's line for each section,
   the ledes, the helper lines, the empty states). Every key the site reads, grouped by screen, with its value now,
   a field to change it, and a preview line in the face it is read in. Save sends it through the content service;
   reset takes it back to the page's own string. The page reads them on its next load (backend/content: texts). */

import { h, act, field, area, status, setLabel } from './ui.js';

export function createTexts({ api, root }) {
  const say = h('p', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
  const listEl = h('div', { class: 'tx-list' });
  root.append(h('section', { class: 'pane texts' }, h('div', { class: 'pane-head' }, act('reload', () => load()), say), listEl));

  async function load() {
    status(say, '');
    const r = await api.texts();
    if (r.status !== 200) { status(say, r.data.error || "couldn't load the texts", true); return; }
    const by = {};
    for (const t of r.data.texts || []) (by[t.screen] = by[t.screen] || []).push(t);
    const screens = (r.data.screens || Object.keys(by)).filter((s) => by[s]);
    listEl.replaceChildren(...screens.map((s) => h('section', { class: 'tx-screen', 'aria-labelledby': 'tx-' + s },
      h('h2', { class: 'mod-h aph-display aph-ink', id: 'tx-' + s, text: s }),
      ...by[s].map(row))));
    if (!screens.length) listEl.append(h('p', { class: 'empty aph-meta aph-ink', text: 'no texts.' }));
  }

  /* one text: its field, a preview line, save and reset */
  function row(t) {
    const input = area(t.value, { rows: 2, maxlength: '400', 'data-spell': '1', class: 'aph-ink' });
    const hint = h('span', { class: 'hint aph-meta aph-ink' });
    const fieldEl = field(t.label, input);
    fieldEl.append(hint);
    const preview = h('p', { class: 'tx-preview aph-ink', 'aria-label': 'preview' });
    const rowSay = h('span', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
    const save = act('save', () => send());
    const reset = act('reset to default', () => back());
    const el = h('div', { class: 'tx-row', 'data-key': t.key }, fieldEl, preview, h('div', { class: 'tx-acts' }, save, reset, rowSay));

    const now = () => input.value.replace(/\s+/g, ' ').trim();
    function show() {
      const v = now(), dirty = v !== t.value;
      preview.textContent = v || t.default;
      hint.textContent = t.key + ' · ' + (dirty ? 'not saved' : t.overridden ? 'changed' : 'the default') +
        (t.overridden || (dirty && v !== t.default) ? ' · default: ' + t.default : '');
      save.disabled = !dirty || !v;
      reset.disabled = !t.overridden && v === t.default;
      el.classList.toggle('dirty', dirty);
    }
    function take(next) { Object.assign(t, next); input.value = t.value; show(); }
    async function send() {
      const v = now(); if (!v || v === t.value) return;
      setLabel(save, 'saving…');
      const r = await api.textSave(t.key, v, t.version);
      setLabel(save, 'save');
      if (r.status === 409 && r.data.text) { take(r.data.text); status(rowSay, 'changed elsewhere: this is the saved text now', true); return; }
      if (r.status !== 200) { status(rowSay, r.data.error || 'not saved', true); return; }
      take(r.data.text); status(rowSay, 'saved');
    }
    async function back() {
      const r = await api.textReset(t.key);
      if (r.status !== 200) { status(rowSay, r.data.error || "that didn't work", true); return; }
      take(r.data.text); status(rowSay, 'back to the default');
    }
    input.addEventListener('input', () => { status(rowSay, ''); show(); });
    /* one line: Enter saves */
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    show();
    return el;
  }

  return { load };
}
