/* moderation: the wall and the forum, through the content service (which calls their admin APIs server to server;
   no admin secret is ever in this page). The wall's lines, each with its removal; the forum's reports first, then
   the board; a thread opens to its posts, each removable (the first post removes the thread). */

import { h, act, sure, status } from './ui.js';

const ago = (ms) => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' days ago';
};

export function createModeration({ api, root }) {
  const say = h('p', { class: 'say aph-meta aph-ink', role: 'status', 'aria-live': 'polite' });
  const wallEl = h('ol', { class: 'mod-list', 'aria-label': 'lines on the wall' });
  const reportsEl = h('ol', { class: 'mod-list', 'aria-label': 'reports' });
  const boardEl = h('ol', { class: 'mod-list', 'aria-label': 'threads' });
  const threadEl = h('div', { class: 'mod-thread' });
  const pane = h('section', { class: 'pane mod' },
    h('div', { class: 'pane-head' }, act('reload', () => load()), say),
    h('div', { class: 'mod-cols' },
      h('div', {}, h('h2', { class: 'mod-h aph-display aph-ink' }, 'wall ', h('span', { class: 'aph-gloss', lang: 'la', text: 'paries' })), wallEl),
      h('div', {}, h('h2', { class: 'mod-h aph-display aph-ink' }, 'forum ', h('span', { class: 'aph-gloss', lang: 'grc', text: 'ἀγορά' })),
        h('h3', { class: 'aph-label aph-ink', text: 'reports' }), reportsEl, h('h3', { class: 'aph-label aph-ink', text: 'threads' }), boardEl, threadEl)));
  root.append(pane);

  async function loadWall() {
    const r = await api.wall();
    if (r.status !== 200) { wallEl.replaceChildren(h('li', { class: 'aph-meta aph-ink', text: r.data.error || "the wall didn't answer" })); return; }
    const lines = r.data.messages || [];
    wallEl.replaceChildren(...lines.map((m) => h('li', { 'data-id': m.id },
      h('span', { class: 'mod-text aph-ink', text: m.text }), h('span', { class: 'aph-meta aph-ink', text: ago(m.at) }),
      sure('remove', async () => { const x = await api.wallRemove(m.id); if (x.status === 200) { status(say, 'line removed'); loadWall(); } else status(say, x.data.error || "that didn't work", true); }))));
    if (!lines.length) wallEl.append(h('li', { class: 'aph-meta aph-ink', text: 'the wall is empty.' }));
  }
  async function loadForum() {
    const [rep, board] = await Promise.all([api.reports(), api.board()]);
    if (rep.status === 200) {
      const list = rep.data.reports || [];
      reportsEl.replaceChildren(...list.map((x) => h('li', {},
        h('span', { class: 'aph-ink', text: `thread ${x.thread} · post ${x.n}` }), h('span', { class: 'aph-meta aph-ink', text: `${x.count} ${x.count === 1 ? 'report' : 'reports'} · ${ago(x.at)}` }),
        act('read', () => openThread(x.thread, x.n)))));
      if (!list.length) reportsEl.append(h('li', { class: 'aph-meta aph-ink', text: 'no reports.' }));
    } else reportsEl.replaceChildren(h('li', { class: 'aph-meta aph-ink', text: rep.data.error || "the forum didn't answer" }));
    if (board.status === 200) {
      boardEl.replaceChildren();
      page(board.data);
      if (!(board.data.threads || []).length) boardEl.append(h('li', { class: 'aph-meta aph-ink', text: 'no threads.' }));
    }
  }
  /* the board comes a page at a time (the forum keeps every thread); `more` reads the next one */
  function page(data) {
    boardEl.querySelectorAll('.more').forEach((x) => x.remove());
    boardEl.append(...(data.threads || []).map((t) => h('li', {},
      h('span', { class: 'mod-text aph-ink', text: t.first || '(a picture)' }), h('span', { class: 'aph-meta aph-ink', text: `${t.replies} ${t.replies === 1 ? 'reply' : 'replies'} · ${ago(t.bumped)}` }),
      act('read', () => openThread(t.id)))));
    if (data.next) boardEl.append(h('li', { class: 'more' }, act('more', async () => { const r = await api.board(data.next); if (r.status === 200) page(r.data); })));
  }
  async function openThread(id, mark) {
    const r = await api.thread(id);
    if (r.status !== 200) { status(say, r.data.error || 'that thread is gone', true); loadForum(); return; }
    threadEl.replaceChildren(h('h3', { class: 'aph-label aph-ink', text: 'thread ' + id }),
      h('ol', { class: 'mod-list' }, ...r.data.posts.map((p) => h('li', { class: p.n === mark ? 'marked' : null, 'data-n': p.n },
        h('span', { class: 'aph-meta aph-ink', text: '#' + p.n }),
        h('span', { class: 'mod-text aph-ink', text: p.removed ? '(removed)' : (p.text || '(a picture)') }),
        p.removed ? null : sure(p.n === 1 ? 'remove the thread' : 'remove', async () => {
          const x = await api.forumRemove(id, p.n);
          if (x.status !== 200) { status(say, x.data.error || "that didn't work", true); return; }
          status(say, x.data.thread === 'removed' ? 'thread removed' : 'post removed');
          if (x.data.thread === 'removed') threadEl.replaceChildren(); else openThread(id);
          loadForum();
        })))));
    threadEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function load() { status(say, ''); loadWall(); loadForum(); }
  return { load };
}
