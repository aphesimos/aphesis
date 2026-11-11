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

- `lines (id, text, at, exp, owner)` indexed on `(at, id)` (`owner` is 1 for the owner's lines; a wall made before
  the column gets it, at 0, when the object starts), so a listing is already in order (newest first, at most 300);
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

- `Thread`: `meta` and `posts (n, poster, text, created, image, reports, removed, owner)` (`owner`: 1 for the owner's
  posts; a thread made before the column gets it, at 0, the first time it is touched). The only writer of its posts, so
  numbers are given once. Its tables are made by the first post (a lookup of a thread that does not exist leaves
  nothing behind); removing the opening post deletes all of it. At most 500 posts of 2000 characters, so one object
  stays a few MB at worst;
- `Board`: `threads` (the index of every thread, newest activity first, read a page at a time through an index on
  `(bumped, seq)`), `buckets` (token buckets keyed by action and IP hash, swept by an hourly alarm once refilled),
  `reports` (the newest 500 records for the admin) and `schema_version`. Its SQL schema migrates itself when the
  object starts (`MIGRATIONS` in `board.rs`; `v2` is the index for pages, `v3` the `owner` of each thread's opening post), so a deploy needs no wrangler migration
  for it;
- R2 bucket `aphesis-forum-images`, written once per picture under a fresh random name: the original (jpeg, png, webp or gif, at most 4 MB and 40 megapixels, its type
  read from its bytes) and the density map made in the browser (jpeg or png, at most 900 KB, 32 to 960 px: 960 so the small text of a wide
  screenshot still reads; a detailed 960 px map is about 470 KB as a JPEG), under
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

Errors are always JSON `{"error": "..."}` (the forum's also carry a `code`, below). CORS answers only `ALLOWED_ORIGINS`
(`https://aphes.ist,https://www.aphes.ist,https://aphesist.pages.dev`), always with `Vary: Origin`; preflights
(`OPTIONS`, any path) get `204`.

### wall

| method | path | what |
| --- | --- | --- |
| GET | `/messages` | `200 {messages: [{id, text, at, owner}]}`, newest first, at most 300; `Cache-Control: public, max-age=15` |
| POST | `/messages` | JSON `{text, token}` → `201 {message: {id, text, at, owner}}`; with `Authorization: Bearer <ADMIN_TOKEN>`, the owner's line (below) |
| DELETE | `/messages/:id` | admin, `Authorization: Bearer <ADMIN_TOKEN>` → `204`, `401 {error: "unauthorized"}`, `404` |

`POST /messages` refusals: `400` with `empty`, `long` (over 140 characters), `word`, `link` or `bad` (not JSON, or
no string `text`); `429 {error: "rate", retryAfter}` with `Retry-After`; `403 {error: "turnstile"}`;
`503 {error: "unavailable"}` without `HASH_SALT`; `500 {error: "stumbled"}`, with the CORS headers, when anything
breaks on the way (before, the runtime's own error page reached the page as a failed request). Ids are 16 hex
characters. Anything else is `404 {error: "not found"}`.

Vars: `ALLOWED_ORIGINS`, `TTL_DAYS` (30), `BLOCKLIST` (extra words, comma-separated, matched like the built-in ones),
`ALLOW_NO_TURNSTILE` (local only), `TTL_SECONDS` (tests only). Secrets: `TURNSTILE_SECRET`, `HASH_SALT`,
`ADMIN_TOKEN`.

### forum

| method | path | what |
| --- | --- | --- |
| GET | `/api/board` | `{threads: [{id, first, replies, created, bumped, image, owner}], next, density: {long: 960, bytes: 921600}, limits}`, newest activity first, one page, and what a post may carry; `cache-control: public, max-age=5` |
| GET | `/api/threads/:id` | `{id, created, posts: [{n, poster, text, created, owner, image?} or {n, created, removed: true}]}` |
| POST | `/api/threads` | a new thread, multipart: `text`, optional `image` + `density`, `turnstile` → `201 {thread, n: 1}` |
| POST | `/api/threads/:id/posts` | a reply, the same fields; text may be empty with a picture → `201 {thread, n}` |
|  | either, with `Authorization: Bearer <ADMIN_SECRET>` | the owner's post (below) |
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

**The limits.** The board's pages carry what a post may carry, so the page prepares pictures to fit and says the
limits before anyone picks one:
`limits: {request: 6291456, original: {bytes: 4194304, pixels: 40000000}, density: {long: 960, bytes: 921600},
text: {chars: 2000, lines: 60}}`, and `density: {long, bytes}` alone as before. A page that finds no `density` there
(an older Worker) keeps 640 px, the limit before.

`image` is `{density, original, w, h, caption}` with paths relative to the Worker (`image` is `null` on the board when
the opening post has none). Thread ids are 10 characters of `a-z2-9`.

**Refusals** are `{error, code, limit?, retryAfter?}`: `error` in words, as before; `code`, one word that does not
change, for the page to say why in its own voice; `limit`, the limit that was passed; `retryAfter`, the seconds to
wait (also in `Retry-After`, which a page on another origin cannot read).

| status | code | when (`limit`) |
| --- | --- | --- |
| 400 | `text_required` | a new thread, or a reply without a picture, with no words |
| 400 | `text_long`, `text_lines` | over 2000 characters, over 60 lines (2000, 60) |
| 400 | `image_too_large` | the original over 4 MB (4194304) |
| 400 | `image_type` | the original not jpeg, png, webp or gif, read from its bytes |
| 400 | `image_unreadable` | the original empty, or its size unreadable |
| 400 | `image_pixels` | the original over 40 megapixels (40000000) |
| 400 | `map_missing`, `map_too_large`, `map_type`, `map_unreadable`, `map_size`, `map_orphan` | the density map: missing, over 900 KB (921600), not jpeg or png, unreadable, over 960 px or under 32 (960), or sent without its original |
| 400 | `form`, `cursor` | an unreadable form; a malformed board cursor |
| 403 | `origin`, `turnstile`, `not_allowed` | not from the site's origins; the check did not pass (failed, expired or used); a wrong admin key |
| 404 | `thread_gone`, `no_post`, `not_found` | the thread, the post, anything else |
| 409 | `thread_full` | the thread holds 500 posts (500) |
| 413 | `too_large` | the request over 6 MB: the 4 MB original, the 900 KB map and the form (6291456) |
| 429 | `rate` | too fast, with `retryAfter` |
| 500 | `stumbled` | anything that broke on the way |
| 503 | `not_open` | the salts are not set |

Admin calls carry `Authorization: Bearer <ADMIN_SECRET>`.

Vars: `ALLOWED_ORIGINS`, `RATE_POSTS` (4), `RATE_THREADS` (1), `RATE_WINDOW_SECONDS` (120),
`ALLOW_NO_TURNSTILE` (local only). Secrets: `TURNSTILE_SECRET`, `IP_SALT`, `POSTER_SALT`, `ADMIN_SECRET`.

### The owner's posts

The owner writes on the wall and the forum from the desk, and those lines and posts carry `owner: true`, which the
pages draw as the owner's mark (the eye in rubedo and the name *aphesist*) in place of a sigil. Only a request that
carries the Worker's admin secret is the owner's:

1. The desk sends `{text}` to `content-api` (`POST /v1/admin/wall`, `/v1/admin/forum/threads[/:id/posts]`), with the
   owner's session cookie (HttpOnly, SameSite=Strict, set by the gate), the session's `X-CSRF-Token` and the site's
   `Origin`, like every write on the dashboard.
2. The content service passes it on server to server with the admin secret it already holds for moderation
   (`WALL_ADMIN_TOKEN`, `FORUM_ADMIN_SECRET`): no new secret, and the cookie never has to cross to `wall-api` or
   `forum-api`, which cannot see it.
3. The wall and the forum mark the post `owner` only when `Authorization` carries their admin secret, and then skip
   Turnstile and the rate limit (the content service's address is one for every owner post). Any other
   `Authorization` is refused (`401` on the wall, `403` on the forum), not taken as a visitor's post; without it, the
   post is a visitor's, whatever the request says (an `owner` field in the form or the JSON, a header, a cookie).
   The wall's filter applies to the owner too.

The owner's poster token on the forum is made like anyone's, from a fixed word in place of the IP hash: 16 hex, one
per thread, so `the opener` still reads right. `owner` is stored on the line or post (and, on the board, for each
thread's opening post) and returned always, `false` for everyone else.

## The content service

`content/` serves what the archive, the book and works show, and holds the owner's gate. Edits from the dashboard are
live at once: the sections read the public API when it answers and keep their built-in content when it does not.

### Storage

- **D1** (`aphesis-content`, `content/migrations/`): `posts` (slug, title, summary, stage, date, markdown body, notes,
  figures, example, published), `books` (slug, title, author, year, note, quote with its language and English, caption,
  picture, map adjustments, position, example, published), `works` (the fields of section/works `content/works.json`,
  position, published), `texts` (the site's texts the owner changed: key, value, version), and the gate's
  `challenges`, `sessions` and `throttle`. Only hashes are kept there: of the
  pending token, the code, the session and the visitor's address.
- **R2** (`aphesis-content`): density maps under `m/<sha-256 of the bytes, 24 hex>.<png|jpg>` (a key never changes
  what it holds, so they are served with a year of `immutable` cache and `Access-Control-Allow-Origin: *`, which the
  sections' WebGL needs), and the email's φ at `mail/phi.png`.

### The API

Public, read-only, published entries only, CORS for `ALLOWED_ORIGINS`, `cache-control: public, max-age=30`:
`GET /v1/posts`, `/v1/posts/:slug`, `/v1/books`, `/v1/books/:slug`, `/v1/works` (with the section's name and gloss),
`/v1/works/:id`, `GET /media/:key`. Pictures come back as absolute URLs.

**The site's texts** (`content/src/texts.rs`): the short lines the owner can change without a rebuild: the ledes, the helper lines, the empty states. Every key is listed once in `TEXTS`, with its
screen and its default, which is the same string the page carries; the page keeps its own copy and shows it whenever
the API does not answer or has nothing set, so a missing key never breaks a screen. `GET /v1/texts` answers only the
keys the owner set, `{texts: {"music.lede": "..."}, version}`, with `cache-control: public, max-age=15` and an
`ETag` of the version (`If-None-Match` gets `304`). The version is the sum of every key's version, which grows by one
with each save and each reset, so it never comes back to an earlier value. The keys: `meta.title`, `meta.description` (the link preview: the site's Pages middleware writes them into the
served page's `og:` and `twitter:` tags, so a shared link shows them; see the `site` branch), `archive.lede`, `archive.empty`, `archive.stage.<stage>`,
`laboratory.lede`, `laboratory.live`, `wall.placeholder`, `wall.helper`, `wall.sent`, `wall.empty`, `forum.lede`, `forum.empty`,
`forum.placeholder.thread`, `forum.placeholder.reply`, `forum.pictures`, `music.lede`, `music.idle`, `music.empty`.
A new key is one line in `TEXTS` and the same default in the page.

The gate, as in the backlog (`docs/backlog.md` on `main`):

1. `POST /v1/auth/password {password}`: the password is checked against `OWNER_PASSWORD_HASH`, a PBKDF2-SHA256 hash,
   with WebCrypto. On success the Worker mails three Latin words (from `content/src/words.txt`: 2048 words, 3 to 8
   lowercase letters, about 33 bits) to `OWNER_EMAIL`, from `EMAIL_FROM`, through Resend's HTTP API (below), and sets
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

**Sending it**: `POST {MAIL_API}/emails` (Resend, `https://api.resend.com`) with `Authorization: Bearer
{RESEND_API_KEY}` and `{from, to, subject, html, text}`, given up after 8 seconds. If Resend refuses or does not
answer, the words are thrown away and the visitor gets `503 {"error": "unavailable"}`, nothing more; the reason
(Resend's status and message) goes to the Worker's log only. Cloudflare's own `send_email` is not used: it needs
Email Routing on the apex, which would take over `aphes.ist`'s MX (the owner's mail is at Proton), or Workers Paid.
`EMAIL_FROM` is a plain address, `clavis@aphes.ist`: Resend's documentation shows `Name <address>` but says
nothing of names outside ASCII, so `aφesis` is left out until it is tried.

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
| GET | `/v1/admin/texts` | every text the site reads, with `screen`, `label`, `default`, `value`, `overridden`, `version`, and the screens in order |
| GET, PUT | `/v1/admin/texts/:key` | one text; PUT `{value, version?}` sets it (one line, 1 to 400 characters); with `version`, `409` and the current text when it changed meanwhile |
| POST | `/v1/admin/texts/:key/reset` | back to the page's own string |
| POST | `/v1/admin/media` | a density map made in the browser (multipart `file`: jpeg or png, at most 400 KB, 32 to 640 px) → `{key, url, w, h}` |
| GET, DELETE | `/v1/admin/wall`, `/v1/admin/wall/:id` | the wall's lines and their removal, through the wall's admin API |
| GET | `/v1/admin/forum/board[?cursor=<next>]`, `/threads/:id`, `/reports` | the forum's board a page at a time, a thread, the reports |
| DELETE | `/v1/admin/forum/threads/:id/posts/:n` | remove a post (post 1 removes the thread) |
| POST | `/v1/admin/wall`, `/v1/admin/forum/threads`, `/v1/admin/forum/threads/:id/posts` | the owner writes: JSON `{text}` → the wall's or the forum's own answer, the line or post marked `owner` |
| POST | `/v1/admin/export` | the nightly export, now |

Moderation calls the wall and the forum server to server (`WALL_API`, `FORUM_API`) with their admin secrets, which
the content service holds as its own secrets; the pages never see them.

**The nightly export** (`content/src/export.rs`, cron `17 3 * * *`): every entry, drafts too, as the files the section
branches read (`archive/content/<slug>.md`, `book/content/<NN>-<slug>.md`, `works/content/works.json`), committed to
this repository's `content` branch as the owner (`aphesimos`, the noreply address) through GitHub's git data API, only
when something changed. It needs `EXPORT_GITHUB_TOKEN`; without it the cron does nothing.

Vars: `ALLOWED_ORIGINS`, `EMAIL_FROM` (`clavis@aphes.ist`), `MAIL_API` (`https://api.resend.com`),
`SESSION_SECONDS` (7200), `WALL_API`, `FORUM_API`, `EXPORT_REPO`, `EXPORT_BRANCH`, `PUBLIC_URL`. Secrets:
`OWNER_PASSWORD_HASH`, `OWNER_EMAIL`, `AUTH_SALT`, `RESEND_API_KEY`, `WALL_ADMIN_TOKEN`, `FORUM_ADMIN_SECRET`,
`EXPORT_GITHUB_TOKEN`. Without `OWNER_PASSWORD_HASH`, `OWNER_EMAIL`, `AUTH_SALT` or `RESEND_API_KEY` the gate
refuses everything with the same `401` (a missing `OWNER_EMAIL` or `RESEND_API_KEY` is named in the log); the public
API works.

### Tools

```sh
node content/tools/hash-password.mjs            # the OWNER_PASSWORD_HASH line (12 to 32 characters): asks twice, prints pbkdf2-sha256$25000$<salt>$<hash>
node content/tools/seed.mjs --remote            # the one-time import of the section branches into D1 and R2
node content/tools/seed.mjs --local --persist-to DIR    # the same into a local wrangler state
node content/tools/prune-examples.mjs --remote  # the one-shot removal of the seeded examples (--dry-run says what would go)
NODE_PATH=$(npm root -g) node content/tools/make-mail-phi.mjs   # redraw content/assets/mail-phi.png (Playwright)
```

The seed reads `section/archive` (`archive/content/*.md`), `section/book` (`book/content/*.md`), `section/works`
(`works/content/works.json`, `works/maps/`) and the design system's density maps with git (each ref, or
`origin/<ref>`), uploads every picture under its content key, writes every entry as published, and puts the email's
φ in the bucket. An entry marked `example: true` is never imported (the seed names each one it skips), and a branch
with no content imports nothing. Running it again adds nothing twice: an entry already in D1 (same slug or id) is
left as it is, so the owner's edits stay, and each picture lands on its own key again; `--replace` overwrites the
imported entries.

**The seeded examples.** The first seed imported the archive's four example posts and the book's six example
entries, which are gone from the branches now that the site is live. `prune-examples.mjs` removes them from D1 and
their pictures from R2: a row goes only if its slug is one of the examples' (listed in the script) and it is still
marked example, so the owner's entries (at any slug, if not marked example) and every work stay; a picture goes only
if no row left in posts, books or works names it. It prints each removal, and a second run says there is nothing to
remove. From GitHub Actions: Actions → backend → Run workflow → branch `backend`, tick **prune** (or
`gh workflow run backend.yml --repo aphesimos/aphesis --ref backend -f prune=true`); it runs after the deploy, with
the repository's Cloudflare secrets, and its log (the step *Remove the seeded examples*) lists what went.

**From GitHub Actions**, with no clone: Actions → backend → Run workflow → branch `backend`, tick **seed**. The
workflow tests, builds and deploys as usual, then fetches `section/archive`, `section/book`, `section/works` and
`design-system` and runs the seed against the deployed D1 and R2 with the repository's Cloudflare secrets. Or:
`gh workflow run backend.yml --repo aphesimos/aphesis --ref backend -f seed=true`.

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

Locally the gate needs somewhere to post its mail: add `--var MAIL_API:http://127.0.0.1:8799 --var
RESEND_API_KEY:dev` and run anything that prints what it receives on that port, for example
`node -e "require('http').createServer((q,s)=>{q.pipe(process.stdout);s.end('{}')}).listen(8799)"`; the three words
are in the JSON's `text`. (With a real key and no `MAIL_API` it would send through Resend for real.) Serve the page on `localhost` too (not `127.0.0.1`), so the API is the same site and the Secure
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
  of a thread with its pictures, the board limit, per-thread poster tokens and their exact format, that no
  address is ever in storage, and the owner's posts and lines: marked only with the admin secret (a wrong key
  refused, forged flags ignored), without Turnstile or the rate limit, the wall's filter kept.
- **The content service**: unit tests for hashing (RFC 7914 vectors, a vector from Node, the stored line), the words
  (2048, 33 bits, loose reading), the lockout and its backoff, cookies and CSRF, validation of every kind of entry,
  the email (the backlog's rules, and its colours against the design system's tokens), the export's files and the
  texts (every key once, every default a valid value, the answers); end to
  end (`e2e/content.test.mjs`) with a local D1 and R2: the seed (from fixture commits the test makes, one entry of
  each kind marked example, which it skips), the public API and CORS, the gate step by step with
  the mail read from a local stand-in for Resend's API (the request, its key and its JSON, the HTML and text checked),
  Resend failing or never answering (a bare 503, the words void), code expiry, replacement and single use,
  lockout on both steps, CSRF (token, origin), create, edit, preview, publish, rename and delete for each kind, uploads,
  moderation against local wall and forum Workers, the owner's lines and posts from the desk (marked, and refused
  without the session, the token or the origin), and the nightly export against a stand-in for GitHub's API;
  `e2e/prune.test.mjs`: the removal of the seeded examples from a database as the first seed left it, with the
  owner's entries beside them (a dry run, the run, a second run, then the Worker's answers and pictures); and
  `e2e/texts.test.mjs`: the public texts (CORS, cache, `304`), and the dashboard's list, edit, conflict and reset, and the link preview's keys.

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
   | `CONTENT_OWNER_EMAIL` | the owner's address (at Proton), where the gate's words go |
   | `CONTENT_AUTH_SALT` | `openssl rand -hex 32` |
   | `RESEND_API_KEY` | the Resend API key for the gate's mail (below) |
   | `CONTENT_EXPORT_GITHUB_TOKEN` | a fine-grained token for this repository with *Contents: read and write*, for the nightly export |

   The content service also gets `WALL_ADMIN_TOKEN` and `FORUM_ADMIN_SECRET`, for moderation.

   Variable: `BACKEND_CUSTOM_DOMAINS` = `1` once the `aphes.ist` zone is active on Cloudflare. With it each Worker
   answers on its `aphes.ist` subdomain only, and its workers.dev address is switched off, since the account's
   workers.dev name belongs to the account, not to this site. Without it the Workers answer on workers.dev only.

7. **Resend**, for the gate's mail (the free tier is enough). The Resend domain is `aphes.ist`; its records sit on
   `resend._domainkey.aphes.ist` and `send.aphes.ist`, never on the root MX, which stays Proton's.
   1. Create an account at resend.com.
   2. Domains → Add domain → `aphes.ist`.
   3. Resend shows a few DNS records. Add each one in Cloudflare (zone `aphes.ist` → DNS → Records), exactly as shown
      and all **DNS only** (grey cloud, not proxied): the DKIM TXT on `resend._domainkey`, and the MX and SPF TXT on
      `send` (the return path). Never change or add an MX on `aphes.ist` itself: those are Proton's.
   4. Back in Resend, Verify; wait until the domain shows *Verified*.
   5. API Keys → Create API key, permission *Sending access*, domain `aphes.ist` only.
   6. Add it in GitHub as the repository secret `RESEND_API_KEY`. The next backend run pushes it to the Worker.

   The D1 database also needs the API token to have Account → *D1: Edit*.
8. **The first content.** After the first deploy, once: run the backend workflow by hand with **seed** ticked (see
   Tools above), or locally `node backend/content/tools/seed.mjs --remote` (with `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` in the environment, and the section branches fetched).

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
