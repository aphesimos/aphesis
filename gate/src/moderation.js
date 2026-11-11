/* moderation: the wall and the forum, through the content service (which calls their admin APIs server to server;
   no admin secret is ever in this page). The wall's lines, each with its removal; the forum's reports first, then
   the board; a thread opens to its posts, each removable (the first post removes the thread).

   The owner writes here too, as aphesist: a line on the wall, a thread, a reply in the open thread. The content
   service passes them on with the wall's and the forum's admin secrets, which is what marks them as the owner's on
   the site (the eye and the name in place of a sigil). In these lists the owner's own lines and posts carry the
   same name, in rubedo, so they are told apart at a glance. */

import { h, act, sure, status, field, text, area } from './ui.js';

const A = window.Aphesis;
const OWNER = 'aphesist';
/* the owner's mark in a list: a still eye and the name (the live eyes are the site's; here a list stays quiet) */
function mark(owner) {
  if (!owner) return null;
  const eye = h('span', { class: 'mod-eye aph-red', 'aria-hidden': 'true' });
  if (A && A.icon) eye.innerHTML = A.icon('eye', 0);
  return h('span', { class: 'mod-owner' }, eye, h('span', { class: 'owner-name aph-display', text: OWNER }), h('span', { class: 'sr', text: ', the owner:' }), ' ');
}
/* the wall's and the forum's refusals, in the desk's words */
const WALL_NO = { empty: 'a line needs words', long: 'at most 140 characters', word: 'the wall refuses a word in it', link: 'no links on the wall', bad: 'no' };
/* Enter sends a one-line field; Ctrl or Cmd + Enter sends a text area */
function onSend(el, f) {
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    if (el.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); f();
  });
}

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

  /* writing as the owner: a line on the wall, a new thread on the forum */
  const wallIn = text('', { maxlength: '140', class: 'aph-ink' });
  const wallSend = async () => {
    const t = wallIn.value.trim();
    if (!t) { wallIn.focus(); return; }
    const r = await api.wallWrite(t);
    if (r.status === 201) { wallIn.value = ''; status(say, 'your line is on the wall'); loadWall(); }
    else status(say, WALL_NO[r.data.error] || r.data.error || 'the wall did not take it', true);
  };
  onSend(wallIn, wallSend);
  const wallWrite = h('div', { class: 'mod-write' }, field('a line on the wall, as ' + OWNER, wallIn, 'at most 140 characters'), act('write', wallSend));
  const threadIn = area('', { maxlength: '2000', rows: '3' });
  const threadSend = async () => {
    const t = threadIn.value.trim();
    if (!t) { threadIn.focus(); return; }
    const r = await api.forumWrite(null, t);
    if (r.status === 201) { threadIn.value = ''; status(say, 'your thread is on the board'); await loadForum(); openThread(r.data.thread); }
    else status(say, r.data.error || 'the forum did not take it', true);
  };
  onSend(threadIn, threadSend);
  const threadWrite = h('div', { class: 'mod-write' }, field('a new thread, as ' + OWNER, threadIn, 'ctrl or cmd + enter posts it'), act('post', threadSend));

  const cols = h('div', { class: 'mod-cols' },
      h('div', {}, h('h2', { class: 'mod-h aph-display aph-ink' }, 'wall ', h('span', { class: 'aph-gloss', lang: 'la', text: 'paries' })), wallWrite, wallEl),
      h('div', {}, h('h2', { class: 'mod-h aph-display aph-ink' }, 'forum ', h('span', { class: 'aph-gloss', lang: 'grc', text: 'ἀγορά' })), threadWrite,
        h('h3', { class: 'aph-label aph-ink', text: 'reports' }), reportsEl, h('h3', { class: 'aph-label aph-ink', text: 'threads' }), boardEl, threadEl));
  const pane = h('section', { class: 'pane mod' }, h('div', { class: 'pane-head' }, act('again', () => load()), say), cols);
  root.append(pane);

  async function loadWall() {
    const r = await api.wall();
    if (r.status !== 200) { wallEl.replaceChildren(h('li', { class: 'aph-meta aph-ink', text: r.data.error || 'the wall did not answer' })); return; }
    const lines = r.data.messages || [];
    wallEl.replaceChildren(...lines.map((m) => h('li', { 'data-id': m.id, class: m.owner === true ? 'owner' : null },
      h('span', { class: 'mod-text aph-ink' }, mark(m.owner === true), m.text), h('span', { class: 'aph-meta aph-ink', text: ago(m.at) }),
      sure('remove', async () => { const x = await api.wallRemove(m.id); if (x.status === 200) { status(say, 'the line is gone'); loadWall(); } else status(say, x.data.error || 'no', true); }))));
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
    } else reportsEl.replaceChildren(h('li', { class: 'aph-meta aph-ink', text: rep.data.error || 'the forum did not answer' }));
    if (board.status === 200) {
      boardEl.replaceChildren();
      page(board.data);
      if (!(board.data.threads || []).length) boardEl.append(h('li', { class: 'aph-meta aph-ink', text: 'no threads.' }));
    }
  }
  /* the board comes a page at a time (the forum keeps every thread); `more` reads the next one */
  function page(data) {
    boardEl.querySelectorAll('.more').forEach((x) => x.remove());
    boardEl.append(...(data.threads || []).map((t) => h('li', { class: t.owner === true ? 'owner' : null },
      h('span', { class: 'mod-text aph-ink' }, mark(t.owner === true), t.first || '(a picture)'), h('span', { class: 'aph-meta aph-ink', text: `${t.replies} ${t.replies === 1 ? 'reply' : 'replies'} · ${ago(t.bumped)}` }),
      act('read', () => openThread(t.id)))));
    if (data.next) boardEl.append(h('li', { class: 'more' }, act('more', async () => { const r = await api.board(data.next); if (r.status === 200) page(r.data); })));
  }
  async function openThread(id, marked) {
    const r = await api.thread(id);
    if (r.status !== 200) { status(say, r.data.error || 'the thread is gone', true); loadForum(); return; }
    /* a reply as the owner, under the thread's posts */
    const replyIn = area('', { maxlength: '2000', rows: '3' });
    const replySend = async () => {
      const t = replyIn.value.trim();
      if (!t) { replyIn.focus(); return; }
      const x = await api.forumWrite(id, t);
      if (x.status === 201) { status(say, 'your reply is in the thread'); openThread(id, x.data.n); loadForum(); }
      else status(say, x.data.error || 'the forum did not take it', true);
    };
    onSend(replyIn, replySend);
    threadEl.replaceChildren(h('h3', { class: 'aph-label aph-ink', text: 'thread ' + id }),
      h('ol', { class: 'mod-list' }, ...r.data.posts.map((p) => h('li', { class: [p.n === marked ? 'marked' : '', !p.removed && p.owner === true ? 'owner' : ''].join(' ').trim() || null, 'data-n': p.n },
        h('span', { class: 'aph-meta aph-ink', text: '#' + p.n }),
        h('span', { class: 'mod-text aph-ink' }, p.removed ? null : mark(p.owner === true), p.removed ? '(removed)' : (p.text || '(a picture)')),
        p.removed ? null : sure(p.n === 1 ? 'remove the thread' : 'remove', async () => {
          const x = await api.forumRemove(id, p.n);
          if (x.status !== 200) { status(say, x.data.error || 'no', true); return; }
          status(say, x.data.thread === 'removed' ? 'the thread is gone' : 'the post is gone');
          if (x.data.thread === 'removed') threadEl.replaceChildren(); else openThread(id);
          loadForum();
        })))),
      h('div', { class: 'mod-write' }, field('a reply, as ' + OWNER, replyIn, 'ctrl or cmd + enter replies'), act('reply', replySend)));
    threadEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  /* the first time, the two columns wait until both have answered and come in whole: filled one by one, the wall's
     lines would push the forum's heading down under the reader's eyes (on a phone the columns stack) */
  let first = true;
  function load() {
    status(say, '');
    const both = Promise.allSettled([loadWall(), loadForum()]);
    if (first) { first = false; cols.hidden = true; both.then(() => { cols.hidden = false; }); }
  }
  return { load };
}
