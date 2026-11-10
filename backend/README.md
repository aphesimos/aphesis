# backend

The servers behind aphes.ist: three Cloudflare Workers written in Rust, and their deploy.

- **wall** (`wall-api.aphes.ist`): the lines drifting on the wall · *paries*.
- **forum** (`forum-api.aphes.ist`): the anonymous board, forum · *ἀγορά*.
- **content** (`content-api.aphes.ist`): archive posts, book entries and works entries, their pictures, and the
  owner's gate and dashboard. See [the content service](#the-content-service) below.

The wall and the forum replace the JavaScript Workers that live with their pages (`section/wall`: `wall/worker/`, `section/forum`:
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
  content/            the content service: D1 (migrations/), R2, the gate, the dashboard's API, tools/
  e2e/                end-to-end tests: each Worker under `wrangler dev`, driven over HTTP
  scripts/deploy.mjs  one Worker to Cloudflare: config, R2 buckets, deploy, secrets
```

Each Worker is a Rust crate built with [workers-rs](https://github.com/cloudflare/workers-rs) (`worker` 0.8.7) to
WebAssembly by `worker-build` 0.8.7, with its own `wrangler.toml`.

**common** (`aphesis-common`): reading a picture's type and size from its bytes (shared by the forum and the content service), CORS for a list of origins (with an option for credentials, for a service that uses
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
  nothing behind); removing the opening post deletes all of it. At most 500 posts of 2000 characters, so one object
  stays a few MB at worst;
- `Board`: `threads` (the index of every thread, newest activity first, read a page at a time through an index on
  `(bumped, seq)`), `buckets` (token buckets keyed by action and IP hash, swept by an hourly alarm once refilled),
  `reports` (the newest 500 records for the admin) and `schema_version`. Its SQL schema migrates itself when the
  object starts (`MIGRATIONS` in `board.rs`; `v2` is the index for pages), so a deploy needs no wrangler migration
  for it;
- R2 bucket `aphesis-forum-images`, written once per picture under a fresh random name: the original (jpeg, png, webp or gif, at most 4 MB and 40 megapixels, its type
  read from its bytes) and the density map made in the browser (jpeg or png, at most 400 KB, 32 to 640 px), under
  `t/<thread>/<id>.<ext>` and `t/<thread>/<id>.density.<ext>`. Served with `nosniff`, `default-src 'none'; sandbox`
  and a year of cache (`immutable`).

**The forum is permanent.** Nothing is deleted on its own: no limit on the board, no expiry, no sweep of threads,
posts or pictures. The only removal is the admin's `DELETE /api/threads/:id/posts/:n` (post 1 takes the thread and
its pictures with it). Reports only count and keep their newest 500 records; the board's alarm only forgets refilled
rate-limit buckets. (The one other delete is of pictures just uploaded for a post that was then refused, which were
never part of the forum.)

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
| GET | `/api/board` | `{threads: [{id, first, replies, created, bumped, image}], next}`, newest activity first, one page; `cache-control: public, max-age=5` |
| GET | `/api/threads/:id` | `{id, created, posts: [{n, poster, text, created, image?} or {n, created, removed: true}]}` |
| POST | `/api/threads` | a new thread, multipart: `text`, optional `image` + `density`, `turnstile` → `201 {thread, n: 1}` |
| POST | `/api/threads/:id/posts` | a reply, the same fields; text may be empty with a picture → `201 {thread, n}` |
| POST | `/api/threads/:id/posts/:n/report` | report a post → `{ok: true}` (10 per window per IP hash) |
| GET | `/api/images/t/:id/:file` | a picture from R2 |
| GET | `/api/admin/reports` | admin → `{reports: [{thread, n, count, at}]}`, newest first |
| DELETE | `/api/threads/:id/posts/:n` | admin → `{ok: true, thread: "kept" or "removed"}`; post 1 removes the thread and its pictures |

**Pages of the board.** `GET /api/board?cursor=<next>&limit=<n>`: without `cursor`, the first page; with the `next`
a page gave, the page after it; `next` is `null` on the last page. `limit` is 40 unless given, at most 100. The
order is `bumped` (the last post's time), then `seq` (which grows with every new thread or reply and is never given
twice), both newest first, and the cursor is the page's last thread as `"<bumped>-<seq>"`, so a page always starts
strictly below where the previous one ended (a thread answered meanwhile moves to the top and is not shown twice). A
malformed cursor is `400 {error: "bad cursor"}`. A client that reads only `threads`
(the page before pages) gets the first 40, as before.

`image` is `{density, original, w, h, caption}` with paths relative to the Worker (`image` is `null` on the board when
the opening post has none). Thread ids are 10 characters of `a-z2-9`. Status codes: `400` bad input (the error says
what: `a post needs words`, `at most 2000 characters`, `at most 60 lines`, `only jpeg, png, webp or gif`, `the density
map has the wrong size`, ...), `403` (`not from this site`, `the check did not pass`, `not allowed`), `404`, `409`
(`this thread is full`, 500 posts), `413 too large` (over 5 MB), `429` with `Retry-After`, `503` without salts. Admin
calls carry `Authorization: Bearer <ADMIN_SECRET>`.

Vars: `ALLOWED_ORIGINS`, `RATE_POSTS` (4), `RATE_THREADS` (1), `RATE_WINDOW_SECONDS` (120),
`ALLOW_NO_TURNSTILE` (local only). Secrets: `TURNSTILE_SECRET`, `IP_SALT`, `POSTER_SALT`, `ADMIN_SECRET`.

## The content service

`content/` serves what the archive, the book and works show, and holds the owner's gate. Edits from the dashboard are
live at once: the sections read the public API when it answers and keep their built-in content when it does not.

### Storage

- **D1** (`aphesis-content`, `content/migrations/`): `posts` (slug, title, summary, stage, date, markdown body, notes,
  figures, example, published), `books` (slug, title, author, year, note, quote with its language and English, caption,
  picture, map adjustments, position, example, published), `works` (the fields of section/works `content/works.json`,
  position, published), and the gate's `challenges`, `sessions` and `throttle`. Only hashes are kept there: of the
  pending token, the code, the session and the visitor's address.
- **R2** (`aphesis-content`): density maps under `m/<sha-256 of the bytes, 24 hex>.<png|jpg>` (a key never changes
  what it holds, so they are served with a year of `immutable` cache and `Access-Control-Allow-Origin: *`, which the
  sections' WebGL needs), and the email's φ at `mail/phi.png`.

### The API

Public, read-only, published entries only, CORS for `ALLOWED_ORIGINS`, `cache-control: public, max-age=30`:
`GET /v1/posts`, `/v1/posts/:slug`, `/v1/books`, `/v1/books/:slug`, `/v1/works` (with the section's name and gloss),
`/v1/works/:id`, `GET /media/:key`. Pictures come back as absolute URLs.

The gate, as in the backlog (`docs/backlog.md` on `main`):

1. `POST /v1/auth/password {password}`: the password is checked against `OWNER_PASSWORD_HASH`, a PBKDF2-SHA256 hash,
   with WebCrypto. On success the Worker mails three Latin words (from `content/src/words.txt`: 2048 words, 3 to 8
   lowercase letters, about 33 bits) to `OWNER_EMAIL`, from `EMAIL_FROM`, through the `send_email` binding, and sets
   `aph_pending` (HttpOnly, Secure, SameSite=Strict, `Path=/v1/auth`, 10 minutes). A new password step replaces any
   earlier code.
2. `POST /v1/auth/code {code}`: the words in any case with any separators, within 10 minutes, five tries, single
   use. On success: `aph_session` (HttpOnly, Secure, SameSite=Strict, `Path=/`, `SESSION_SECONDS`, two hours) and
   `{csrf, expires}`.
3. `GET /v1/auth/session` answers `{open: true, csrf, expires}` while the session lasts and `{open: false}` otherwise;
   `POST /v1/auth/logout` ends it.

Every wrong answer on either step, and every answer while locked, is the same `401 {"error": "no"}`. Failures are
counted per visitor (`SHA-256(AUTH_SALT|visitor|address)`) and for everyone: a visitor has 4 free failures, then
each one locks for 1, 2, 4... minutes up to 6 hours (forgotten after a quiet day); everyone together has 30, then
5 minutes doubling up to an hour. While locked even the right password is refused and no mail goes out.

**The email** (`content/src/mail.rs`): subject *clavis*; HTML on the dark ground (the dark theme's `bg`) with the φ
in rubedo as stipple (`mail/phi.png`, made by `content/tools/make-mail-phi.mjs` from the design system's φ) and the
three words in the typewriter face (`'Special Elite', 'Courier New', Courier, 'Lucida Console', monospace`); a
plain-text part with the same words. No "verification code", nothing to explain it.

**Hashing and the CPU limit.** Measured under workerd on a 2.1 GHz Xeon, PBKDF2-SHA256 costs about 0.17 ms per
thousand iterations (10,000: 1.9 ms; 25,000: 4.4 ms; 50,000: 8.3 ms; 100,000: 17.9 ms). The Workers Free plan allows
10 ms of CPU a request, so the default is **25,000** iterations and the Worker refuses a stored hash above 60,000.

The dashboard (`/v1/admin/...`) needs the session cookie; every request that changes something also needs an
`Origin` in `ALLOWED_ORIGINS` and `X-CSRF-Token` equal to the session's token (a custom header, so it also needs a
CORS preflight, which only the site's origins pass):

| method | path | what |
| --- | --- | --- |
| GET | `/v1/admin/{posts,books,works}` | every entry, drafts too, with `published` |
| GET | `/v1/admin/{posts,books,works}/:id` | one entry as the public API will answer it: the preview of a draft |
| PUT | `/v1/admin/{posts,books,works}/:id` | create (`201`) or update (`200`); another id in the body renames (`409` if taken) |
| DELETE | `/v1/admin/{posts,books,works}/:id` | remove |
| POST | `/v1/admin/{posts,books,works}/:id/publish`, `/unpublish` | show it on the site, or take it back to a draft |
| POST | `/v1/admin/media` | a density map made in the browser (multipart `file`: jpeg or png, at most 400 KB, 32 to 640 px) → `{key, url, w, h}` |
| GET, DELETE | `/v1/admin/wall`, `/v1/admin/wall/:id` | the wall's lines and their removal, through the wall's admin API |
| GET | `/v1/admin/forum/board[?cursor=<next>]`, `/threads/:id`, `/reports` | the forum's board a page at a time, a thread, the reports |
| DELETE | `/v1/admin/forum/threads/:id/posts/:n` | remove a post (post 1 removes the thread) |
| POST | `/v1/admin/export` | the nightly export, now |

Moderation calls the wall and the forum server to server (`WALL_API`, `FORUM_API`) with their admin secrets, which
the content service holds as its own secrets; the pages never see them.

**The nightly export** (`content/src/export.rs`, cron `17 3 * * *`): every entry, drafts too, as the files the section
branches read (`archive/content/<slug>.md`, `book/content/<NN>-<slug>.md`, `works/content/works.json`), committed to
this repository's `content` branch as the owner (`aphesimos`, the noreply address) through GitHub's git data API, only
when something changed. It needs `EXPORT_GITHUB_TOKEN`; without it the cron does nothing.

Vars: `ALLOWED_ORIGINS`, `EMAIL_FROM` (`clavis@aphes.ist`), `SESSION_SECONDS` (7200), `WALL_API`, `FORUM_API`,
`EXPORT_REPO`, `EXPORT_BRANCH`, `PUBLIC_URL`. Secrets: `OWNER_PASSWORD_HASH`, `OWNER_EMAIL`, `AUTH_SALT`,
`WALL_ADMIN_TOKEN`, `FORUM_ADMIN_SECRET`, `EXPORT_GITHUB_TOKEN`. Without `OWNER_PASSWORD_HASH`, `OWNER_EMAIL` or
`AUTH_SALT` the gate refuses everything (the public API works).

### Tools

```sh
node content/tools/hash-password.mjs            # the OWNER_PASSWORD_HASH line: asks twice, prints pbkdf2-sha256$25000$<salt>$<hash>
node content/tools/seed.mjs --remote            # the one-time import of the section branches into D1 and R2
node content/tools/seed.mjs --local --persist-to DIR    # the same into a local wrangler state
NODE_PATH=$(npm root -g) node content/tools/make-mail-phi.mjs   # redraw content/assets/mail-phi.png (Playwright)
```

The seed reads `section/archive` (`archive/content/*.md`), `section/book` (`book/content/*.md`), `section/works`
(`works/content/works.json`, `works/maps/`) and the design system's density maps with git (each ref, or
`origin/<ref>`), uploads every picture under its content key, writes every entry as published, and puts the email's
φ in the bucket. Running it again replaces those entries and nothing else.

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

The content service needs its D1 tables first, and the seed for something to show:

```sh
cd backend/content
npx --yes wrangler@4.153.0 d1 migrations apply aphesis-content --local
node tools/seed.mjs --local
npx --yes wrangler@4.153.0 dev --port 8790 --var ALLOWED_ORIGINS:http://localhost:8000 --var AUTH_SALT:dev \
  --var OWNER_EMAIL:owner@example.com --var "OWNER_PASSWORD_HASH:$(printf %s 'a local password' | node tools/hash-password.mjs --stdin)" \
  --var WALL_API:http://127.0.0.1:8787 --var FORUM_API:http://127.0.0.1:8788 --var WALL_ADMIN_TOKEN:dev --var FORUM_ADMIN_SECRET:dev
```

Locally the `send_email` binding writes each mail to a `.eml` file under `.wrangler/tmp/` and logs its path; the three
words are in it. Serve the page on `localhost` too (not `127.0.0.1`), so the API is the same site and the Secure
cookies are kept.

`wrangler dev` runs `worker-build --release` first. `ALLOW_NO_TURNSTILE` is for local runs only: it is never in
`wrangler.toml` and never set by the deploy.

## Tests

```sh
cd backend
cargo test --workspace                 # unit tests and the filter vectors in Rust
node wall/tests/filter-parity.mjs      # the same vectors against the page's filter.js (read from section/wall)
node --test e2e/*.test.mjs             # the Workers under wrangler dev, over HTTP
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
- **The content service**: unit tests for hashing (RFC 7914 vectors, a vector from Node, the stored line), the words
  (2048, 33 bits, loose reading), the lockout and its backoff, cookies and CSRF, validation of every kind of entry,
  the email (the backlog's rules, and its colours against the design system's tokens) and the export's files; end to
  end (`e2e/content.test.mjs`) with a local D1 and R2: the seed, the public API and CORS, the gate step by step with
  the mail read from the local `send_email` binding (its HTML checked), code expiry, replacement and single use,
  lockout on both steps, CSRF (token, origin), create, edit, preview, publish, rename and delete for each kind, uploads,
  moderation against local wall and forum Workers, and the nightly export against a stand-in for GitHub's API.

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
   | `CONTENT_OWNER_PASSWORD_HASH` | the line printed by `node backend/content/tools/hash-password.mjs` |
   | `CONTENT_OWNER_EMAIL` | the owner's address, verified in Email Routing (below) |
   | `CONTENT_AUTH_SALT` | `openssl rand -hex 32` |
   | `CONTENT_EXPORT_GITHUB_TOKEN` | a fine-grained token for this repository with *Contents: read and write*, for the nightly export |

   The content service also gets `WALL_ADMIN_TOKEN` and `FORUM_ADMIN_SECRET`, for moderation.

   Variable: `BACKEND_CUSTOM_DOMAINS` = `1` once the `aphes.ist` zone is active on Cloudflare. With it each Worker
   answers on its `aphes.ist` subdomain only, and its workers.dev address is switched off, since the account's
   workers.dev name belongs to the account, not to this site. Without it the Workers answer on workers.dev only.

7. **Email Routing**, for the gate's mail. In the Cloudflare dashboard, zone `aphes.ist` → Email → Email Routing →
   enable it (Cloudflare adds its MX and SPF records), then Destination addresses → add the owner's address and open
   the link Cloudflare mails to it, so it shows *Verified*. The `send_email` binding only delivers to verified
   destinations, and `EMAIL_FROM` (`clavis@aphes.ist`) must be on the zone. The API token also needs Account →
   *D1: Edit*.
8. **The first content.** After the first deploy, once: `node backend/content/tools/seed.mjs --remote` (with
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment, and the section branches fetched).

Keep the salts once set: changing `FORUM_POSTER_SALT` changes every poster token, and so every sigil;
changing a salt also resets the rate limits.

## Deploy

`.github/workflows/backend.yml` runs on every push to `backend` that touches `backend/**` or the workflow, and by
hand (workflow_dispatch):

1. **test**: `cargo test`, the filter parity against the page's `filter.js`, and the end-to-end tests;
2. **build**: each Worker with `worker-build --release`, its size checked against the free plan's 3 MB
   (compressed) and bundled with `wrangler deploy --dry-run`;
3. **deploy**: for each Worker, `scripts/deploy.mjs`: the R2 buckets and D1 databases it needs (created when missing;
   a database's id is written into the shipped config and its migrations applied),
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
