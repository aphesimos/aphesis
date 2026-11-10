/* Thread: one Durable Object per thread. It holds the thread's posts in order and is the only writer of them, so
   numbers are given out one at a time and never twice. Storage: "meta" {id, created, bumped, count} and one key
   per post, "p:000001" onwards. The Worker talks to it with small JSON requests on internal paths. */

const MAX_POSTS = 500;
const key = (n) => 'p:' + String(n).padStart(6, '0');
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });

/* what the public sees of a post: no report counts, image keys turned into URLs */
export function publicPost(p) {
  if (p.removed) return { n: p.n, created: p.created, removed: true };
  const out = { n: p.n, poster: p.poster, text: p.text, created: p.created };
  if (p.image) {
    out.image = {
      density: '/api/images/' + p.image.density, original: '/api/images/' + p.image.original,
      w: p.image.w, h: p.image.h, caption: 'a picture, posted here',
    };
  }
  return out;
}

export class Thread {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.storage = ctx.storage; }

  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json() : null;
    const meta = await this.storage.get('meta');
    switch (url.pathname) {
      case '/get': {
        if (!meta) return json({ error: 'this thread is gone' }, 404);
        const posts = [...(await this.storage.list({ prefix: 'p:' })).values()];
        return json({ id: meta.id, created: meta.created, posts: posts.map(publicPost) });
      }
      case '/create': {
        if (meta) return json({ error: 'exists' }, 409);
        const post = Object.assign({}, body.post, { n: 1 });
        await this.storage.put({ meta: { id: body.id, created: post.created, bumped: post.created, count: 1 }, [key(1)]: post });
        return json({ n: 1 });
      }
      case '/post': {
        if (!meta) return json({ error: 'this thread is gone' }, 404);
        if (meta.count >= MAX_POSTS) return json({ error: 'this thread is full' }, 409);
        const n = meta.count + 1;
        const post = Object.assign({}, body.post, { n });
        await this.storage.put({ meta: Object.assign({}, meta, { count: n, bumped: post.created }), [key(n)]: post });
        const first = await this.storage.get(key(1));
        return json({ n, summary: { first: first && !first.removed ? first.text : '', firstImage: first && !first.removed ? first.image || null : null, replies: n - 1 } });
      }
      case '/report': {
        const p = meta && await this.storage.get(key(body.n));
        if (!p || p.removed) return json({ error: 'no such post' }, 404);
        p.reports = (p.reports || 0) + 1;
        await this.storage.put(key(body.n), p);
        return json({ reports: p.reports });
      }
      case '/remove': {
        const p = meta && await this.storage.get(key(body.n));
        if (!p) return json({ error: 'no such post' }, 404);
        const keys = p.image ? [p.image.density, p.image.original] : [];
        if (body.n === 1) {
          /* the opening post takes the thread with it */
          const all = await this.storage.list({ prefix: 'p:' });
          for (const q of all.values()) if (q.image) keys.push(q.image.density, q.image.original);
          await this.storage.deleteAll();
          return json({ gone: true, keys: [...new Set(keys)] });
        }
        await this.storage.put(key(body.n), { n: p.n, created: p.created, removed: true });
        return json({ gone: false, keys });
      }
      case '/purge': {
        const keys = [];
        const all = await this.storage.list({ prefix: 'p:' });
        for (const q of all.values()) if (q.image) keys.push(q.image.density, q.image.original);
        await this.storage.deleteAll();
        return json({ keys });
      }
      default:
        return json({ error: 'not found' }, 404);
    }
  }
}
