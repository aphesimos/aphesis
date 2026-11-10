# forum worker

The server behind **forum · *ἀγορά***: a Cloudflare Worker with a Durable Object per thread (`Thread`) and one for
the board (`Board`: the index, the rate-limit buckets, the reports), R2 for pictures, Turnstile, and removal behind
an admin secret. It is written, tested and not deployed: the Rust Workers on the `backend` branch replace it, with the same API.

## What it keeps, and what it never keeps

- **Posts**: number, poster token, text, time, and for a picture the two R2 keys and the map's size.
- **Poster token**: `SHA-256(POSTER_SALT | thread | ipHash)`, 16 hex characters. The same for one person all through
  a thread, different in every other thread, impossible to turn back into an address. The page draws the sigil from it.
- **IP hash**: `SHA-256(IP_SALT | address)`, used as the rate-limit key and nothing else. A bucket is forgotten once it
  has refilled (an hourly alarm sweeps them). Raw addresses are never stored, logged or sent to Turnstile.
- **Pictures**: the original (jpeg, png, webp or gif, ≤ 4 MB, type read from its bytes) and the density map the
  browser made from it (jpeg or png, ≤ 400 KB, ≤ 640 px on the long side). Served with `nosniff`, a sandboxing CSP
  and a year of cache.

## The API

All paths are under the Worker's URL. JSON in and out, except posting, which is `multipart/form-data`.

| method | path | what |
| --- | --- | --- |
| GET | `/api/board` | `{threads: [{id, first, replies, created, bumped, image?}], next}`, one page, newest activity first |
| GET | `/api/threads/:id` | `{id, created, posts: [{n, poster, text, created, image?} or {n, created, removed}]}` |
| POST | `/api/threads` | a new thread. Fields: `text`, optional `image` + `density` (+ `w`, `h`), `turnstile` |
| POST | `/api/threads/:id/posts` | a reply, the same fields; text may be empty when there is a picture |
| POST | `/api/threads/:id/posts/:n/report` | report a post |
| GET | `/api/images/t/:id/:file` | a picture from R2 |
| GET | `/api/admin/reports` | the reports, newest first (admin) |
| DELETE | `/api/threads/:id/posts/:n` | remove a post; removing post 1 removes the thread and its pictures (admin) |

The board keeps every thread and is read a page at a time: `GET /api/board?cursor=<next>&limit=<n>` (40 unless
given, at most 100). `next` is the cursor of the page after (`"<bumped>-<seq>"`), `null` on the last page; a page
starts strictly below where the one before ended, so a thread answered meanwhile moves to the top and is not shown
twice. A malformed cursor is `400 {error: "bad cursor"}`.

`image` in responses is `{density, original, w, h, caption}` with paths relative to the Worker. Errors are
`{error: "words"}` with 400 (bad input), 403 (origin, Turnstile or admin), 404, 409 (thread full, 500 posts),
413 (over 5 MB) or 429 (rate limit, with `Retry-After`).

Admin calls carry `Authorization: Bearer <ADMIN_SECRET>`:

```sh
curl -H "Authorization: Bearer $ADMIN_SECRET" https://forum.example.workers.dev/api/admin/reports
curl -X DELETE -H "Authorization: Bearer $ADMIN_SECRET" https://forum.example.workers.dev/api/threads/abcdefghjk/posts/3
```

## Limits (vars in `wrangler.toml`)

- `RATE_POSTS` replies and `RATE_THREADS` new threads per `RATE_WINDOW_SECONDS`, per IP hash (token buckets: a short
  burst, then one more each window / limit); 10 reports per window.
- None on the board itself: it is permanent. No thread, post or picture is deleted on its own; only the admin's
  `DELETE` removes anything, and reports only count.
- `ALLOWED_ORIGINS`: the site origins CORS answers; a POST from any other origin is refused.

## Deploying

```sh
cd forum/worker
npm install                                  # wrangler
npx wrangler login
npx wrangler r2 bucket create aphesis-forum-images   # then keep bucket_name in wrangler.toml in step
npx wrangler secret put IP_SALT              # long random strings, e.g. `openssl rand -hex 32`
npx wrangler secret put POSTER_SALT
npx wrangler secret put ADMIN_SECRET
npx wrangler secret put TURNSTILE_SECRET     # from the Turnstile widget made for the site's hostname
npx wrangler deploy
```

Then point the page at it: in `forum/src/template.html` (or the site's layout) set

```html
<meta name="forum-api" content="https://aphesis-forum.<account>.workers.dev">
<meta name="forum-turnstile" content="<turnstile site key>">
```

and rebuild (`python3 forum/build.py`). With `forum-api` empty the page runs on its local mock. Without
`TURNSTILE_SECRET` the Worker skips the check, which is only for local development (`npx wrangler dev`). Changing a
salt changes every poster token (and so every sigil) and resets the rate limits; keep them.

## Tests

```sh
cd forum/worker && npm test     # node --test, no dependencies
```

They cover the sigil's determinism (with the design system's real brush, read from its branch), the rate limiter,
upload validation (types from bytes, sizes from headers, text cleaning), and the Worker end to end with in-memory
Durable Objects and R2: posting, poster tokens per thread, rate limits, uploads, reports, removal, CORS, Turnstile.
