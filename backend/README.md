# backend

The servers behind aphes.ist: two Cloudflare Workers written in Rust, and their deploy.

- **wall** (`wall-api.aphes.ist`): the lines drifting on the wall · *paries*.
- **forum** (`forum-api.aphes.ist`): the anonymous board, forum · *ἀγορά*.

They replace the JavaScript Workers that live with their pages (`section/wall`: `wall/worker/`, `section/forum`:
`forum/worker/`) and keep their HTTP API exactly: routes, JSON shapes, status codes, error words, headers, CORS and
limits. The pages work against them unchanged.

## Architecture

```
backend/
  Cargo.toml          the workspace, every dependency pinned to an exact version
  services.json       the Workers the deploy ships (one entry each)
  common/             what the Workers share
  wall/               the wall's Worker and its Durable Object
  forum/              the forum's Worker, its two Durable Object classes and R2
  e2e/                end-to-end tests: each Worker under `wrangler dev`, driven over HTTP
  scripts/deploy.mjs  one Worker to Cloudflare: config, R2 buckets, deploy, secrets
```

Each Worker is a Rust crate built with [workers-rs](https://github.com/cloudflare/workers-rs) (`worker` 0.8.7) to
WebAssembly by `worker-build` 0.8.7, with its own `wrangler.toml`.

**common** (`aphesis-common`): CORS for a list of origins (with an option for credentials, for a service that uses
cookies), the JSON error shape, SHA-256 and hex, comparing secrets in equal time (`Bearer` header rules), Turnstile's
`siteverify`, rate limits as plain data (a sliding window with a gap, usable as a lockout, and a token bucket), the
UTC day, and Durable Object plumbing (internal JSON calls, alarms at an absolute time). Everything that does not touch
the runtime is plain Rust and tested natively.

**wall**: one Worker in front of one Durable Object (`Wall`, one instance named `wall`), SQLite-backed:

- `lines (id, text, at, exp)` indexed on `(at, id)`, so a listing is already in order (newest first, at most 300);
- `rates (visitor, hits, exp)`: the sliding window per visitor. The visitor is `SHA-256(HASH_SALT|day|address)`
  cut to 32 hex: the raw address is never stored and the key changes every day;
- an alarm at the earliest expiry deletes expired lines and forgotten rate records, then sets itself for the next.

A post goes through shape, the filter, the rate limit (counted before the challenge, so failed challenges count too:
4 posts in 10 minutes, 20 s between two), Turnstile, then is kept for `TTL_DAYS` (30).

The filter (`wall/src/filter.rs`) is a port of the page's `filter.js`, which the page still runs before sending
(the page bundles `wall/worker/src/filter.js` from `section/wall`; that file stays as it is). Parity is proved by
shared vectors, `wall/tests/filter-vectors.json`: the JavaScript tests' cases plus cases that probe the edges
(Unicode folding, spelled-apart letters, link boundaries, whitespace), each with the exact result. `cargo test`
runs them against Rust; `node wall/tests/filter-parity.mjs` runs them against the JavaScript.

**forum**: one Worker, a Durable Object per thread (`Thread`) and one for the board (`Board`), both SQLite-backed,
and R2 for pictures:

- `Thread`: `meta` and `posts (n, poster, text, created, image, reports, removed)`. The only writer of its posts, so
  numbers are given once. Its tables are made by the first post (a lookup of a thread that does not exist leaves
  nothing behind); removing the opening post deletes all of it;
- `Board`: `threads` (the index, newest activity first, at most `BOARD_LIMIT`; the oldest fall off and are deleted
  with their pictures), `buckets` (token buckets keyed by action and IP hash, swept by an hourly alarm once
  refilled) and `reports`;
- R2 bucket `aphesis-forum-images`: the original (jpeg, png, webp or gif, at most 4 MB and 40 megapixels, its type
  read from its bytes) and the density map made in the browser (jpeg or png, at most 400 KB, 32 to 640 px), under
  `t/<thread>/<id>.<ext>` and `t/<thread>/<id>.density.<ext>`. Served with `nosniff`, `default-src 'none'; sandbox`
  and a year of cache.

The IP hash is `SHA-256(IP_SALT|ip|address)` cut to 32 hex, used for rate limits only. The poster token is
`SHA-256(POSTER_SALT|poster|thread|ipHash)` cut to 16 hex: the same for one person all through a thread, different
in every other thread. The page draws the sigil from it, so this format never changes.

### Where the Rust differs from the JavaScript

Nothing a working page can see. The differences are where the JavaScript was unsafe:

- **Forum without Turnstile.** The JavaScript skipped the check whenever `TURNSTILE_SECRET` was absent. Here it is
  skipped only when `ALLOW_NO_TURNSTILE = "1"` is also set (local development), so a deploy without the secret refuses
  posts (`403`) instead of taking them unchecked. The wall already worked this way.
- **Forum without salts.** Without `IP_SALT` or `POSTER_SALT`, posts and reports get `503 {"error": "the board is not
  open yet"}` (the JavaScript hashed with an empty salt, which a list of every IPv4 address reverses). The wall
  already answered `503 {"error": "unavailable"}` without `HASH_SALT`.
- **A PNG cut inside its header** is refused as unreadable; the JavaScript read the missing byte as NaN and let such
  a density map through.
- **Errors in posting** answer `500 {"error": "the board stumbled"}` with CORS headers; in the JavaScript they escaped
  the handler and reached the runtime's error page.
- **Tests only:** the wall reads `TTL_SECONDS`, which overrides `TTL_DAYS`, so the end-to-end tests can watch a line
  expire and the alarm sweep it. Never set it in production.

### What workers-rs could not do, and the interop used instead

- `crypto.getRandomValues` has no wrapper: `common/src/hash.rs` calls it through `js_sys` (ids for lines, threads and
  pictures).
- `Storage::set_alarm` reads a bare integer as an offset from now; alarms at an absolute time go through a
  `js_sys::Date` (`common/src/durable.rs`).

Everything else is native workers-rs: Durable Objects with the SQL API, alarms, R2, multipart forms, `fetch` to
Turnstile. SHA-256 is plain Rust (`sha2`), so hashing is synchronous and testable without the runtime.

## The API

Errors are always JSON `{"error": "..."}`. CORS answers only `ALLOWED_ORIGINS`
(`https://aphes.ist,https://www.aphes.ist,https://aphesist.pages.dev`), always with `Vary: Origin`; preflights
(`OPTIONS`, any path) get `204`.

### wall

| method | path | what |
| --- | --- | --- |
| GET | `/messages` | `200 {messages: [{id, text, at}]}`, newest first, at most 300; `Cache-Control: public, max-age=15` |
| POST | `/messages` | JSON `{text, token}` → `201 {message: {id, text, at}}` |
| DELETE | `/messages/:id` | admin, `Authorization: Bearer <ADMIN_TOKEN>` → `204`, `401 {error: "unauthorized"}`, `404` |

`POST /messages` refusals: `400` with `empty`, `long` (over 140 characters), `word`, `link` or `bad` (not JSON, or
no string `text`); `429 {error: "rate", retryAfter}` with `Retry-After`; `403 {error: "turnstile"}`;
`503 {error: "unavailable"}` without `HASH_SALT`. Ids are 16 hex characters. Anything else is `404 {error: "not found"}`.

Vars: `ALLOWED_ORIGINS`, `TTL_DAYS` (30), `BLOCKLIST` (extra words, comma-separated, matched like the built-in ones),
`ALLOW_NO_TURNSTILE` (local only), `TTL_SECONDS` (tests only). Secrets: `TURNSTILE_SECRET`, `HASH_SALT`,
`ADMIN_TOKEN`.

### forum

| method | path | what |
| --- | --- | --- |
| GET | `/api/board` | `{threads: [{id, first, replies, created, bumped, image}]}`, newest activity first; `cache-control: public, max-age=5` |
| GET | `/api/threads/:id` | `{id, created, posts: [{n, poster, text, created, image?} or {n, created, removed: true}]}` |
| POST | `/api/threads` | a new thread, multipart: `text`, optional `image` + `density`, `turnstile` → `201 {thread, n: 1}` |
| POST | `/api/threads/:id/posts` | a reply, the same fields; text may be empty with a picture → `201 {thread, n}` |
| POST | `/api/threads/:id/posts/:n/report` | report a post → `{ok: true}` (10 per window per IP hash) |
| GET | `/api/images/t/:id/:file` | a picture from R2 |
| GET | `/api/admin/reports` | admin → `{reports: [{thread, n, count, at}]}`, newest first |
| DELETE | `/api/threads/:id/posts/:n` | admin → `{ok: true, thread: "kept" or "removed"}`; post 1 removes the thread and its pictures |

`image` is `{density, original, w, h, caption}` with paths relative to the Worker (`image` is `null` on the board when
the opening post has none). Thread ids are 10 characters of `a-z2-9`. Status codes: `400` bad input (the error says
what: `a post needs words`, `at most 2000 characters`, `at most 60 lines`, `only jpeg, png, webp or gif`, `the density
map has the wrong size`, ...), `403` (`not from this site`, `the check did not pass`, `not allowed`), `404`, `409`
(`this thread is full`, 500 posts), `413 too large` (over 5 MB), `429` with `Retry-After`, `503` without salts. Admin
calls carry `Authorization: Bearer <ADMIN_SECRET>`.

Vars: `ALLOWED_ORIGINS`, `RATE_POSTS` (4), `RATE_THREADS` (1), `RATE_WINDOW_SECONDS` (120), `BOARD_LIMIT` (120),
`ALLOW_NO_TURNSTILE` (local only). Secrets: `TURNSTILE_SECRET`, `IP_SALT`, `POSTER_SALT`, `ADMIN_SECRET`.

## Local development

Once:

```sh
rustup target add wasm32-unknown-unknown
cargo install worker-build@0.8.7 --locked
```

Then each Worker runs on Miniflare, with local Durable Objects and R2, no account needed:

```sh
cd backend/wall
npx --yes wrangler@4.153.0 dev --var ALLOW_NO_TURNSTILE:1 --var HASH_SALT:dev --var ADMIN_TOKEN:dev \
  --var ALLOWED_ORIGINS:http://127.0.0.1:8000

cd backend/forum
npx --yes wrangler@4.153.0 dev --port 8788 --var ALLOW_NO_TURNSTILE:1 --var IP_SALT:dev --var POSTER_SALT:dev \
  --var ADMIN_SECRET:dev --var ALLOWED_ORIGINS:http://127.0.0.1:8000
```

`wrangler dev` runs `worker-build --release` first. `ALLOW_NO_TURNSTILE` is for local runs only: it is never in
`wrangler.toml` and never set by the deploy.

## Tests

```sh
cd backend
cargo test --workspace                 # unit tests and the filter vectors in Rust
node wall/tests/filter-parity.mjs      # the same vectors against the page's filter.js (read from section/wall)
node --test e2e/*.test.mjs             # both Workers under wrangler dev, over HTTP
```

- **Unit** (`cargo test`): the JavaScript tests ported one by one (filter, both rate limiters, upload validation,
  visitor keys, poster tokens, checked against values computed by the JavaScript), plus CORS, secrets, paths,
  dates.
- **Parity**: `wall/tests/filter-vectors.json` against both filters. `filter-parity.mjs` takes a path to a
  `filter.js` as its argument, or a git ref in `WALL_FILTER_REF`.
- **End to end** (`e2e/`): each Worker is built once, then started under `wrangler dev` as often as a test needs,
  with its own vars and storage (`WRANGLER` picks the wrangler command, `E2E_NO_BUILD=1` reuses `build/`). They
  cover what the JavaScript Worker tests covered and more: posting and ordering, filter refusals, 429s with
  `Retry-After`, Turnstile refusal (no secret, Cloudflare's always-failing test secret) and success (its
  always-passing test secret), CORS, admin removal, the TTL with its alarm (the SQLite row disappears), uploads
  checked, stored in R2 and served with their headers, refused uploads leaving nothing behind, 413, reports, removal
  of a thread with its pictures, the board limit, per-thread poster tokens and their exact format, and that no
  address is ever in storage.

## One-time setup

1. **Turnstile.** In the Cloudflare dashboard, Turnstile → add a widget for the hostnames `aphes.ist`,
   `www.aphes.ist` and `aphesist.pages.dev`. Its **site key** is public and goes in the pages; its **secret key** is
   the `TURNSTILE_SECRET` secret. One widget serves both pages.
2. **R2.** Enable R2 on the account (dashboard → R2; the free tier needs it switched on once). The workflow creates
   the bucket `aphesis-forum-images` if it is missing.
3. **workers.dev.** The account needs a workers.dev subdomain (dashboard → Workers & Pages; it is offered the first
   time). Durable Objects on SQLite storage are on the free plan; the classes are made by the `v1` migrations on the
   first deploy.
4. **API token.** The `CLOUDFLARE_API_TOKEN` already used for Pages needs, in addition: Account → *Workers Scripts:
   Edit* and *Workers R2 Storage: Edit*; for the custom domains, Zone `aphes.ist` → *Workers Routes: Edit* and
   *DNS: Edit*.
5. **Random salts and tokens**, each one fresh:

   ```sh
   openssl rand -hex 32
   ```

6. **GitHub** (Settings → Secrets and variables → Actions). Secrets:

   | secret | what |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | already there for the site |
   | `TURNSTILE_SECRET` | the widget's secret key (both Workers) |
   | `WALL_HASH_SALT` | `openssl rand -hex 32` |
   | `WALL_ADMIN_TOKEN` | `openssl rand -hex 32`, kept by the owner for moderation |
   | `FORUM_IP_SALT` | `openssl rand -hex 32` |
   | `FORUM_POSTER_SALT` | `openssl rand -hex 32` |
   | `FORUM_ADMIN_SECRET` | `openssl rand -hex 32`, kept by the owner for moderation |

   Variable: `BACKEND_CUSTOM_DOMAINS` = `1` once the `aphes.ist` zone is active on Cloudflare. With it each Worker
   answers on its `aphes.ist` subdomain only, and its workers.dev address is switched off, since the account's
   workers.dev name belongs to the account, not to this site. Without it the Workers answer on workers.dev only.

Keep the salts once set: changing `FORUM_POSTER_SALT` changes every poster token, and so every sigil;
changing a salt also resets the rate limits.

## Deploy

`.github/workflows/backend.yml` runs on every push to `backend` that touches `backend/**` or the workflow, and by
hand (workflow_dispatch):

1. **test**: `cargo test`, the filter parity against the page's `filter.js`, and the end-to-end tests;
2. **build**: each Worker with `worker-build --release`, its size checked against the free plan's 3 MB
   (compressed) and bundled with `wrangler deploy --dry-run`;
3. **deploy**: for each Worker, `scripts/deploy.mjs`: the R2 buckets it needs (created when missing),
   `wrangler deploy` (wrangler 4.153.0, the same as the site), then its secrets with `wrangler secret bulk`. A secret
   whose repository secret is empty or missing is skipped and named in the log; no value is ever printed. The
   resulting URLs are printed and written to the run's summary.

The services are listed in `services.json` (name, custom domain, R2 buckets, and which repository secret feeds which
Worker secret); the workflow reads its matrix from there, so a new Worker is a new crate in the workspace and one
entry in that file.

**What a first deploy does.** The bucket is created, both Workers are uploaded and their Durable Object classes made
by their `v1` migrations, and their URLs printed: with `BACKEND_CUSTOM_DOMAINS = 1`, `https://wall-api.aphes.ist` and
`https://forum-api.aphes.ist`, whose DNS records Cloudflare makes; without it, the workers.dev URLs
(`https://aphesis-wall.<subdomain>.workers.dev`, `https://aphesis-forum.<subdomain>.workers.dev`). Then the secrets
that are set are pushed. A deploy with some secrets still empty still succeeds, and the Workers stay closed for
posting until they are set and the workflow is run again: without `TURNSTILE_SECRET` every post is refused (`403`),
without the wall's `HASH_SALT` it answers `503`, without the forum's salts `503`; reading works (empty lists), and
moderation needs its admin secret.

## Moderation

The admin secrets are the only keys; keep them out of the pages. Placeholders below: `$WALL_ADMIN_TOKEN`,
`$FORUM_ADMIN_SECRET`, and the APIs' URLs.

```sh
# the wall: find the line's id, then remove it
curl https://wall-api.aphes.ist/messages
curl -X DELETE https://wall-api.aphes.ist/messages/<id> -H "Authorization: Bearer $WALL_ADMIN_TOKEN"

# the forum: read the reports, then remove a post (post 1 removes the whole thread and its pictures)
curl https://forum-api.aphes.ist/api/admin/reports -H "Authorization: Bearer $FORUM_ADMIN_SECRET"
curl -X DELETE https://forum-api.aphes.ist/api/threads/<thread>/posts/<n> -H "Authorization: Bearer $FORUM_ADMIN_SECRET"
```

To keep a word off the wall from now on, add it to `BLOCKLIST` in `wall/wrangler.toml` and push: the page's own
check does not know it, the Worker does. The same calls work server to server, for a dashboard.

## Pointing the pages at the APIs

The pages are not changed here; this is what they need, with the URLs the deploy printed (the custom domains once
they are on) and the Turnstile **site** key.

- **wall** (branch `section/wall`): build the page against the API,

  ```sh
  python3 wall/build.py --api https://wall-api.aphes.ist --sitekey <turnstile site key>
  ```

  which writes `<meta name="aphesis:wall-api">` and `<meta name="aphesis:turnstile">` into the page. Without `--api` the page runs its
  local preview.
- **forum** (branch `section/forum`): set the two meta tags in `forum/src/template.html` (or the site's layout) and
  rebuild with `python3 forum/build.py`:

  ```html
  <meta name="forum-api" content="https://forum-api.aphes.ist">
  <meta name="forum-turnstile" content="<turnstile site key>">
  ```

  With `forum-api` empty the page runs on its local mock.
- **the site** (branch `site`) is where the sections are merged and deployed to Pages; the same `--api`, `--sitekey`
  and meta tags apply there once the wall and the forum are merged into it. Its origins are the ones in
  `ALLOWED_ORIGINS`; a new origin (a preview domain, say) has to be added there too.
