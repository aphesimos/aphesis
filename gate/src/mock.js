/* mock: the content service in memory, for the demo page and for working on the dashboard without a backend. Only in
   a page built with --mock. The same answers as the real API (see backend/README.md on the backend branch), with
   the archive, book and works content the page was built from, and a few wall lines and forum threads.

   The demo's keys are not secrets: the password is "solve et coagula" and the words are "ignis lapis aurum". */

import { MOCK } from './mockdata.js';

const DEMO_PASSWORD = 'solve et coagula';
const DEMO_WORDS = 'ignis lapis aurum';

export function createMockApi() {
  const db = {
    posts: MOCK.posts.map((p) => ({ ...p, published: true })),
    books: MOCK.books.map((b) => ({ ...b, published: true })),
    works: MOCK.works.map((w) => ({ ...w, published: true })),
  };
  let wall = [
    { id: 'a1b2c3d4e5f60718', text: 'the fog was kind today', at: Date.now() - 3600e3 },
    { id: 'b1b2c3d4e5f60718', text: 'buy cheap pills here', at: Date.now() - 7200e3 },
    { id: 'c1b2c3d4e5f60718', text: 'solve et coagula, again', at: Date.now() - 86400e3 },
  ];
  const threads = {
    k3m9p2x7aa: { id: 'k3m9p2x7aa', created: Date.now() - 5e6, posts: [
      { n: 1, poster: '3f9a2c1d7e6b5a40', text: 'what is the oldest thing you still read?', created: Date.now() - 5e6 },
      { n: 2, poster: '8e1d4c7b2a9f3e60', text: '>>1 the emerald tablet, in a bad translation', created: Date.now() - 4e6 },
      { n: 3, poster: 'aa11bb22cc33dd44', text: 'click here for free gold', created: Date.now() - 3e6 },
    ] },
    q8w2e4r6tt: { id: 'q8w2e4r6tt', created: Date.now() - 9e6, posts: [
      { n: 1, poster: '1234abcd5678ef90', text: 'the fog at night looks like weather', created: Date.now() - 9e6 },
    ] },
  };
  /* a few of the site's texts (the real list is the content service's, backend/content/src/texts.rs) */
  const texts = [
    ['home.sections.music.description', 'home', 'music: its line on the home', 'my music folder. mostly lossless.'],
    ['music.lede', 'music', 'lede', 'my music folder. mostly lossless.'],
    ['wall.placeholder', 'wall', 'the empty line', 'write a line'],
    ['forum.empty', 'forum', 'the board with no threads', 'no threads yet.'],
  ].map(([key, screen, label, d]) => ({ key, screen, label, default: d, value: d, overridden: false, version: 0, updated: null }));
  let reports = [{ thread: 'k3m9p2x7aa', n: 3, count: 2, at: Date.now() - 2e6 }];
  let session = false, pending = false, tries = 0, fails = 0, lockedUntil = 0;
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 180 + Math.random() * 220));
  const ok = (data, status = 200) => wait({ status, data });
  const no = (status = 401) => wait({ status, data: { error: 'no' } });
  const key = (k) => (k === 'works' ? 'id' : 'slug');
  const fail = () => { fails++; if (fails > 4) lockedUntil = Date.now() + 60e3 * 2 ** (fails - 5); };
  const locked = () => Date.now() < lockedUntil;

  return {
    async session() { return (await wait(session)); },
    async password(pw) { const right = pw === DEMO_PASSWORD && !locked(); if (!right) { if (!locked()) fail(); return wait(false); } pending = true; tries = 0; return wait(true); },
    async code(c) {
      const typed = String(c).toLowerCase().split(/[^a-z]+/).filter(Boolean).join(' ');
      const right = pending && tries < 5 && typed === DEMO_WORDS && !locked();
      if (!right) { tries++; if (!locked()) fail(); return wait(false); }
      pending = false; session = true; fails = 0; return wait(true);
    },
    async logout() { session = false; return wait(); },
    list(kind) { if (!session) return no(); return ok({ [kind]: db[kind].map((x) => structuredClone(x)) }); },
    get(kind, id) { if (!session) return no(); const x = db[kind].find((e) => e[key(kind)] === id); return x ? ok({ [kind.slice(0, -1)]: structuredClone(x) }) : no(404); },
    save(kind, id, entry) {
      if (!session) return no();
      const k = key(kind), i = db[kind].findIndex((e) => e[k] === id);
      if (!entry[k] || !/^[a-z0-9-]+$/.test(entry[k])) return ok({ error: 'the slug is the address: lowercase letters, digits and hyphens' }, 400);
      if (kind === 'posts' && !['nigredo', 'albedo', 'citrinitas', 'rubedo'].includes(entry.stage)) return ok({ error: 'stage is nigredo, albedo, citrinitas or rubedo' }, 400);
      if (entry[k] !== id && db[kind].some((e) => e[k] === entry[k])) return ok({ error: 'that address is taken' }, 409);
      const withUrls = structuredClone(entry);
      const url = (p) => (p && p.key && MEDIA[p.key]) ? { ...p, url: MEDIA[p.key] } : p;
      if (withUrls.figures) withUrls.figures = withUrls.figures.map(url);
      if (withUrls.picture) withUrls.picture = url(withUrls.picture);
      if (withUrls.map) withUrls.map = url(withUrls.map);
      if (kind === 'books' && typeof withUrls.note === 'string') withUrls.note = withUrls.note.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      if (i < 0) { db[kind].push({ ...withUrls, published: false }); return ok({ [kind.slice(0, -1)]: structuredClone(db[kind][db[kind].length - 1]) }, 201); }
      db[kind][i] = { ...withUrls, published: db[kind][i].published };
      return ok({ [kind.slice(0, -1)]: structuredClone(db[kind][i]) });
    },
    remove(kind, id) { if (!session) return no(); const k = key(kind), n = db[kind].length; db[kind] = db[kind].filter((e) => e[k] !== id); return n === db[kind].length ? no(404) : ok({ ok: true }); },
    publish(kind, id, on) { if (!session) return no(); const x = db[kind].find((e) => e[key(kind)] === id); if (!x) return no(404); x.published = !!on; return ok({ [kind.slice(0, -1)]: structuredClone(x) }); },
    async upload(blob) {
      if (!session) return no();
      const url = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
      const im = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = url; });
      const k = 'm/' + Array.from({ length: 24 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('') + '.jpg';
      MEDIA[k] = url;
      return ok({ key: k, url, w: im.naturalWidth, h: im.naturalHeight }, 201);
    },
    wall() { if (!session) return no(); return ok({ messages: wall.slice() }); },
    wallRemove(id) { if (!session) return no(); wall = wall.filter((m) => m.id !== id); return ok({ ok: true }); },
    board() {
      if (!session) return no();
      return ok({ next: null, threads: Object.values(threads).map((t) => ({ id: t.id, first: t.posts[0].text, replies: t.posts.length - 1, created: t.created, bumped: t.posts[t.posts.length - 1].created, image: null })) });
    },
    thread(id) { if (!session) return no(); return threads[id] ? ok(structuredClone(threads[id])) : no(404); },
    reports() { if (!session) return no(); return ok({ reports: reports.slice() }); },
    texts() { if (!session) return no(); return ok({ screens: ['home', 'archive', 'laboratory', 'wall', 'forum', 'music'], texts: structuredClone(texts) }); },
    textSave(k, value, version) {
      if (!session) return no();
      const t = texts.find((x) => x.key === k); if (!t) return no(404);
      if (version !== undefined && version !== t.version) return ok({ error: 'changed meanwhile', text: structuredClone(t) }, 409);
      Object.assign(t, { value: String(value).trim(), overridden: true, version: t.version + 1, updated: Date.now() });
      return ok({ text: structuredClone(t) });
    },
    textReset(k) {
      if (!session) return no();
      const t = texts.find((x) => x.key === k); if (!t) return no(404);
      Object.assign(t, { value: t.default, overridden: false, version: t.version + 1, updated: Date.now() });
      return ok({ text: structuredClone(t) });
    },
    forumRemove(t, n) {
      if (!session) return no();
      const th = threads[t]; if (!th) return no(404);
      reports = reports.filter((r) => !(r.thread === t && r.n === n));
      if (n === 1) { delete threads[t]; return ok({ ok: true, thread: 'removed' }); }
      const p = th.posts.find((x) => x.n === n); if (p) { delete p.text; delete p.poster; p.removed = true; }
      return ok({ ok: true, thread: 'kept' });
    },
  };
}

const MEDIA = MOCK.media || {};
