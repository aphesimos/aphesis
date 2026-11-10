/* mock: the board as it stands in the preview, with no server. Four example threads (marked as examples) and
   whatever is posted here, kept in this browser only (localStorage, wrapped: blocked storage keeps it for the visit).
   It answers the same calls as the server client in api.js, with the same shapes. */

import { MAPS } from './assets.js';
import { load, save } from './store.js';
import { hex } from './hash.js';

const KEY = 'aphesis.forum.preview.v1';
const H = 3600e3;

const SEARCH = (q) => 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(q);
const PIC = {
  trismegistus: { density: MAPS.trismegistus, caption: 'hermes trismegistus · Siena Cathedral pavement, 1488', original: SEARCH('Hermes Trismegistus Siena Cathedral pavement') },
  jerome: { density: MAPS.jerome, caption: 'saint jerome writing · Caravaggio, 1605–06', original: SEARCH('Saint Jerome Writing Caravaggio') },
  cagnacci: { density: MAPS.cagnacci, caption: 'allegory of human life · Guido Cagnacci, c. 1650', original: SEARCH('Guido Cagnacci Allegory of Human Life') },
  alchemist: { density: MAPS.alchemist, caption: 'the alchemist · Joseph Wright of Derby, 1771', original: SEARCH('The Alchemist Discovering Phosphorus Wright of Derby') },
  magdalen: { density: MAPS.magdalen, caption: 'the penitent magdalen · Georges de La Tour, c. 1640', original: SEARCH('Magdalene with the Smoking Flame La Tour') },
};

/* [poster, hours ago, text, picture?] */
const EXAMPLES = [
  { id: 'tabula', posts: [
    ['ex-a1', 74, 'what is below is like what is above. i keep reading the emerald tablet as a method, not a claim: look at the small thing closely enough and the large thing shows its shape.\nam i reading too much into a few lines of latin?', 'trismegistus'],
    ['ex-b2', 70, '>>1\nnot too much. "quod est inferius est sicut quod est superius" was copied for centuries because it works as a habit of attention. whether it is true of the heavens is another question.'],
    ['ex-c3', 51, '>>2\n>a habit of attention\nthis. the same move as reading a whole person from the way they hold a cup.'],
    ['ex-a1', 30, '>>3\nor reading a city from one street at five in the morning.'],
    ['ex-d4', 9, 'jerome would say: translate it yourself before you trust anyone\'s english. the latin is short enough to carry in a pocket.', 'jerome'],
    ['ex-b2', 2, '>>4 >>5\nboth. carry it, and walk the street.'],
  ] },
  { id: 'nebula', posts: [
    ['ex-e5', 28, 'why does every screen here begin as fog? i think it is honest. nothing arrives finished; you watch it gather.'],
    ['ex-f6', 22, '>>1\nfog is also a kind of privacy. you see the shape of a thing, never the thing.'],
    ['ex-g7', 15, '>>2\nwhich is why there are no names on this board, i suppose.'],
    ['ex-e5', 9, '>>3\n>no names\nonly sigils. mine is the mark beside this post, the same all through the thread.'],
  ] },
  { id: 'ouroboros', posts: [
    ['ex-h8', 122, 'the ouroboros eats its tail. but who started the meal? every drawing of it has a head that is already chewing.', 'cagnacci'],
    ['ex-i9', 100, '>>1\nthat is the point: there is no first bite. one is the all, and the all has no beginning to point at.'],
    ['ex-j10', 61, '>>1\nin cagnacci\'s allegory it sits above her head like a crown. the end of a life drawn as a ring, not a line.'],
    ['ex-h8', 26, '>>2 >>3\nso the meal never started and never ends. i can live with that.'],
  ] },
  { id: 'solve', posts: [
    ['ex-k11', 170, 'solve et coagula, in practice: what did you dissolve this year, and what set again afterwards?', 'alchemist'],
    ['ex-l12', 140, '>>1\na job i had stopped believing in. what set again was a morning i never planned: tea, a window, an hour with no screen.'],
    ['ex-m13', 98, '>>1\nan old certainty. i keep a candle on the desk now, mostly to remember that light eats what it shows.', 'magdalen'],
  ] },
];

function examples(now) {
  return EXAMPLES.map((t) => {
    const posts = t.posts.map(([poster, h, text, pic], i) => ({
      n: i + 1, poster, text, created: now - h * H, image: pic ? Object.assign({}, PIC[pic]) : null,
    }));
    return { id: t.id, example: true, created: posts[0].created, posts };
  });
}

/* ---------- what this browser posted ---------- */
let state = null;
function local() {
  if (!state) {
    const v = load(KEY, null);
    state = v && typeof v === 'object' ? v : {};
    state.threads = state.threads || {};      /* id -> thread posted here */
    state.replies = state.replies || {};      /* example id -> replies posted here */
    state.reports = state.reports || [];
    if (!state.device) state.device = hex(Math.random() + ':' + Date.now(), 16);
  }
  return state;
}
let persisted = true;
const keep = () => { persisted = save(KEY, state); };
const originals = new Map();   /* originals too large to keep, for this visit only */

function all(now) {
  const s = local();
  const ex = examples(now).map((t) => {
    const extra = (s.replies[t.id] || []).map((p, i) => Object.assign({}, p, { n: t.posts.length + i + 1 }));
    return Object.assign(t, { posts: t.posts.concat(extra) });
  });
  return ex.concat(Object.values(s.threads));
}

const wait = (v) => new Promise((resolve) => setTimeout(() => resolve(v), 80));

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
}

export function createMock() {
  return {
    preview: true,
    turnstile: '',
    get persisted() { return persisted; },
    board() {
      const now = Date.now();
      const threads = all(now).map((t) => {
        const live = t.posts.filter((p) => !p.removed);
        const op = t.posts[0];
        return {
          id: t.id, example: !!t.example, created: t.created,
          bumped: Math.max(...live.map((p) => p.created)),
          replies: live.length - 1, first: op.text, image: op.image || null,
        };
      }).sort((a, b) => b.bumped - a.bumped);
      return wait({ threads });
    },
    thread(id) {
      const t = all(Date.now()).find((x) => x.id === id);
      if (!t) return Promise.reject(Object.assign(new Error('this thread is gone'), { status: 404 }));
      const reported = local().reports;
      t.posts.forEach((p) => {
        if (p.image && p.image.originalKey) p.image.original = originals.get(p.image.originalKey) || null;
        p.reported = reported.includes(t.id + '/' + p.n);
      });
      return wait(t);
    },
    async post({ thread, text, image }) {
      const s = local(), now = Date.now();
      const id = thread || hex('t:' + s.device + now, 10);
      const post = { poster: hex(s.device + ':' + id, 12), text, created: now, image: null };
      if (image) {
        post.image = { density: image.density.url, caption: 'a picture, posted here', w: image.density.width, h: image.density.height };
        if (image.original.size <= 600 * 1024) post.image.original = await readAsDataURL(image.original);
        else {
          const k = hex(id + now, 12);
          originals.set(k, URL.createObjectURL(image.original));
          post.image.originalKey = k;
        }
      }
      let n = 1;
      if (!thread) {
        s.threads[id] = { id, created: now, posts: [Object.assign({ n: 1 }, post)] };
      } else if (s.threads[thread]) {
        n = s.threads[thread].posts.length + 1;
        s.threads[thread].posts.push(Object.assign({ n }, post));
      } else {
        const ex = EXAMPLES.find((t) => t.id === thread);
        if (!ex) throw Object.assign(new Error('this thread is gone'), { status: 404 });
        s.replies[thread] = (s.replies[thread] || []).concat([post]);
        n = ex.posts.length + s.replies[thread].length;
      }
      keep();
      if (!persisted && post.image && post.image.original && post.image.original.length > 200000) {
        /* storage full: drop the original from storage, keep it for the visit */
        const k = hex(id + now + 'o', 12); originals.set(k, post.image.original);
        delete post.image.original; post.image.originalKey = k; keep();
      }
      return wait({ thread: id, n });
    },
    report(thread, n) {
      const s = local(), k = thread + '/' + n;
      if (!s.reports.includes(k)) { s.reports.push(k); keep(); }
      return wait({ ok: true });
    },
  };
}
