/* ed-archive: archive posts. The list of every post, drafts too; the editor (slug, title, summary, stage, date,
   example, the markdown body, its notes and its figures); and the live preview beside it, drawn by the archive's own
   modules (render.js, stage-icon.js, marks.js, figure.js, read from section/archive at build) under the archive's own
   stylesheet, so the preview is the post as the archive will show it. */

import { h, act, sure, field, text, area, choice, check, status, debounce, today, slugify, rule, setLabel } from './ui.js';
import { convert, postHtml, STAGES, STAGE_TIPS, dateText } from './archive/render.js';
import { drawStageIcons, stageIcon } from './archive/stage-icon.js';
import { drawMarks, markInk } from './archive/marks.js';
import { createFigures } from './archive/figure.js';
import { ARCHIVE_CSS } from './archive/css.js';
import { toDensity, checkFile, ACCEPT } from './forum/density.js';

export function createArchiveEditor({ api, root, onDirty }) {
  let posts = [], cur = null, figures = null;
  const listEl = h('ol', { class: 'entries', 'aria-label': 'posts' });
  const say = h('p', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
  const head = h('div', { class: 'pane-head' }, act('new post', () => open(null)), say);
  const listView = h('section', { class: 'pane list' }, head, listEl);
  /* the archive's own stylesheet, scoped to the preview; it leaves with the desk */
  root.append(h('style', { text: ARCHIVE_CSS }), listView);

  async function load() {
    const r = await api.list('posts');
    if (r.status !== 200) { status(say, r.data.error || 'the posts did not come', true); return; }
    posts = r.data.posts;
    listEl.replaceChildren(...posts.map((p) => h('li', { class: 'entry' },
      h('button', { type: 'button', class: 'entry-link', 'data-cursor': '.55', onclick: () => open(p.slug), 'data-slug': p.slug },
        h('span', { class: 'stage', 'aria-hidden': 'true' }),
        h('span', { class: 'entry-name aph-ink', text: p.title }),
        h('span', { class: 'entry-meta aph-meta aph-ink', text: dateText(p.date) + ' · ' + (p.published ? 'published' : 'draft') })))));
    listEl.querySelectorAll('.stage').forEach((el, i) => { el.innerHTML = stageIcon(posts[i].stage); el.dataset.stage = posts[i].stage; });
    if (!posts.length) listEl.append(h('li', { class: 'empty aph-meta aph-ink', text: 'no posts yet.' }));
  }

  function open(slug) {
    const p = slug ? structuredClone(posts.find((x) => x.slug === slug)) : { slug: '', title: '', summary: '', stage: 'nigredo', date: today(), body: '', notes: [], figures: [], example: false, published: false };
    listView.hidden = true;
    cur = editor(p, !slug);
    root.append(cur.el);
    cur.el.querySelector('input').focus({ preventScroll: true });
  }
  function close() {
    if (figures) figures.leave();
    if (cur) cur.el.remove();
    cur = null;
    listView.hidden = false;
    load();
  }

  function editor(p, fresh) {
    let saved = fresh ? '' : p.slug;
    const say = h('p', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
    const f = {
      slug: text(p.slug, { pattern: '[a-z0-9-]+', inputmode: 'url' }),
      title: text(p.title, { 'data-spell': '1' }),
      summary: text(p.summary, { 'data-spell': '1' }),
      date: text(p.date, { inputmode: 'numeric', placeholder: 'yyyy-mm-dd' }),
      body: area(p.body, { rows: 18, 'data-spell': '1' }),
    };
    if (fresh) f.title.addEventListener('input', () => { if (!f.slug.dataset.touched) f.slug.value = slugify(f.title.value); });
    f.slug.addEventListener('input', () => { f.slug.dataset.touched = '1'; });
    const stage = choice('stage', STAGES.map((s) => ({ value: s, label: s, lang: 'la', icon: stageIcon(s) })), p.stage, () => refresh());
    stage.el.querySelectorAll('.opt').forEach((b) => { b.dataset.tip = STAGE_TIPS[b.dataset.value]; });
    const example = check('example', p.example, () => refresh());
    /* notes: [^id] in the body, their text here */
    const notesEl = h('ol', { class: 'notes-ed' });
    function noteRow(n = { id: '', text: '' }) {
      const id = text(n.id, { class: 'note-id aph-ink', 'aria-label': 'the note’s mark, as [^mark] in the text' });
      const t = text(n.text, { class: 'note-t aph-ink', 'aria-label': 'the note', 'data-spell': '1' });
      const li = h('li', {}, h('span', { class: 'aph-meta', 'aria-hidden': 'true', text: '[^' }), id, h('span', { class: 'aph-meta', 'aria-hidden': 'true', text: ']' }), t,
        act('remove', () => { li.remove(); refresh(); }));
      [id, t].forEach((x) => x.addEventListener('input', refresh));
      return li;
    }
    p.notes.forEach((n) => notesEl.append(noteRow(n)));
    /* figures: a picture becomes a density map here, in the browser, by the forum's rules, then goes up */
    const figsEl = h('ol', { class: 'figs-ed' });
    let figs = p.figures.map((x) => ({ ...x }));
    function drawFigs() {
      figsEl.replaceChildren(...figs.map((g, i) => h('li', {},
        h('span', { class: 'aph-ink', text: `![caption](simulacrum:${g.name})` }),
        h('span', { class: 'aph-meta aph-ink', text: `${g.w} × ${g.h}` }),
        act('remove', () => { figs.splice(i, 1); drawFigs(); refresh(); }))));
    }
    drawFigs();
    const figName = text('', { placeholder: 'name', 'aria-label': 'the figure’s name, as simulacrum:name in the text', class: 'aph-ink' });
    const figFile = h('input', { type: 'file', accept: ACCEPT.join(','), class: 'file', 'aria-label': 'a picture for the figure' });
    figFile.addEventListener('change', async () => {
      const file = figFile.files[0]; figFile.value = '';
      const name = slugify(figName.value) || 'figure-' + (figs.length + 1);
      const bad = checkFile(file);
      if (bad) { status(say, bad, true); return; }
      status(say, 'making the density map…');
      try {
        const d = await toDensity(file);
        const r = await api.upload(d.blob);
        if (r.status !== 201) { status(say, r.data.error || 'the picture did not go', true); return; }
        figs = figs.filter((x) => x.name !== name).concat([{ name, key: r.data.key, w: r.data.w, h: r.data.h, url: r.data.url }]);
        drawFigs();
        if (!f.body.value.includes(`simulacrum:${name})`)) f.body.value += `\n\n![caption · artist, year](simulacrum:${name})\n`;
        figName.value = '';
        status(say, 'the picture is up: ' + name);
        refresh();
      } catch (_) { status(say, 'this picture could not be read', true); }
    });

    const pubLabel = () => (p.published ? 'unpublish' : 'publish');
    const pub = act(pubLabel(), async () => {
      if (!saved) { status(say, 'save it first', true); return; }
      if (dirty) await save();
      const r = await api.publish('posts', saved, !p.published);
      if (r.status !== 200) { status(say, r.data.error || 'no', true); return; }
      p.published = r.data.post.published; pub.querySelector('.act-t').textContent = pubLabel(); state();
      status(say, p.published ? 'published: it is on the site now' : 'back to a draft');
    });
    const stateEl = h('span', { class: 'aph-meta aph-ink state' });
    const state = () => { stateEl.textContent = (saved ? (p.published ? 'published' : 'draft') : 'not saved yet') + (dirty ? ' · changed' : ''); };
    let dirty = false;

    function entry() {
      const notes = [...notesEl.children].map((li) => ({ id: li.querySelector('.note-id').value.trim(), text: li.querySelector('.note-t').value.trim() })).filter((n) => n.id || n.text);
      return { slug: f.slug.value.trim(), title: f.title.value.trim(), summary: f.summary.value.trim(), stage: stage.value, date: f.date.value.trim(),
        body: f.body.value, notes, figures: figs.map(({ name, key, w, h: hh }) => ({ name, key, w, h: hh })), example: example.value };
    }
    async function save() {
      const e = entry();
      const r = await api.save('posts', saved || e.slug, e);
      if (r.status !== 200 && r.status !== 201) { status(say, r.data.error || 'it did not save', true); return false; }
      saved = r.data.post.slug; p.published = r.data.post.published; dirty = false; state(); onDirty && onDirty(false);
      status(say, 'saved');
      return true;
    }

    /* the preview: the archive's own markup and marks, redrawn as the text changes */
    const prev = h('div', { class: 'gp-archive' });
    const errs = h('p', { class: 'say bad aph-meta aph-ink', role: 'status' });
    const refresh = debounce(() => {
      const e = entry();
      dirty = true; state(); onDirty && onDirty(true);
      const known = figs.map((x) => x.name);
      const rendered = convert(e.slug || 'draft', e.body, e.notes, figs.map((g) => ({ name: g.name, url: g.url })), known);
      const at = prev.parentNode ? prev.parentNode.scrollTop : 0;
      prev.innerHTML = postHtml({ ...e, slug: e.slug || 'draft', title: e.title || 'untitled', summary: e.summary || '', date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : today() }, rendered);
      const art = prev.firstChild; art.hidden = false;
      art.querySelectorAll('a.back').forEach((a) => { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.tabIndex = -1; });
      drawStageIcons(prev); drawMarks(prev); markInk(prev);
      if (!figures) figures = createFigures();
      figures.leave(); figures.enter(art);
      if (prev.parentNode) prev.parentNode.scrollTop = at;
      errs.textContent = rendered.errors.join(' · ');
    }, 220);
    Object.values(f).forEach((x) => x.addEventListener('input', refresh));

    /* leaving with changes asks once more, in the line itself */
    let leaving = 0;
    const back = act('all posts', () => {
      if (dirty && !leaving) { setLabel(back, 'leave unsaved?'); leaving = setTimeout(() => { leaving = 0; setLabel(back, 'all posts'); }, 4000); return; }
      clearTimeout(leaving); close();
    });
    const mode = choice('view', [{ value: 'write', label: 'write' }, { value: 'read', label: 'read' }], 'write', (v) => { el.dataset.mode = v; });
    const el = h('section', { class: 'pane editor', 'data-mode': 'write', 'aria-label': 'a post' },
      h('div', { class: 'pane-head' },
        back, stateEl, h('span', { class: 'spacer' }), mode.el),
      h('div', { class: 'split' },
        h('div', { class: 'write' },
          field('title', f.title), field('slug · the address', f.slug, '#archive/<slug>'), field('summary', f.summary),
          h('div', { class: 'field' }, h('span', { class: 'aph-label aph-ink', text: 'stage' }), stage.el),
          field('date', f.date), h('div', { class: 'field' }, example.el),
          field('the text · markdown', f.body, '## heading · *a latin word* · **strong** · > quote · [^note] · ![caption](simulacrum:name)'),
          h('div', { class: 'field' }, h('span', { class: 'aph-label aph-ink', text: 'notes' }), notesEl, act('add a note', () => { notesEl.append(noteRow()); refresh(); })),
          h('div', { class: 'field' }, h('span', { class: 'aph-label aph-ink', text: 'figures' }), figsEl,
            h('div', { class: 'fig-new' }, figName, h('label', { class: 'act aph-label file-act', 'data-cursor': '.55' }, h('span', { class: 'act-t', text: 'a picture' }), figFile, rule('uline', 1.4)))),
          h('div', { class: 'acts' }, act('save', save), pub, sure('delete', async () => {
            if (!saved) { close(); return; }
            const r = await api.remove('posts', saved);
            if (r.status !== 200) { status(say, r.data.error || 'no', true); return; }
            close();
          })),
          say, errs),
        h('div', { class: 'read', 'aria-label': 'the preview' }, prev)));
    state();
    refresh();
    setTimeout(() => { dirty = false; state(); }, 300);
    return { el, save, entry };
  }

  load();
  return { load, open, close, get current() { return cur; } };
}
