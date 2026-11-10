# wall · paries: the Worker

The wall's backend: one Cloudflare Worker in front of one Durable Object that keeps the lines in order. Written, not
deployed. Names in `wrangler.toml` are placeholders.

## What it does

| route | what |
| --- | --- |
| `GET /messages` | the live lines, newest first: `{ messages: [{ id, text, at }] }` (at most 300) |
| `POST /messages` | `{ text, token }` → `201 { message }`, or `400 { error }` (`empty`, `long`, `word`, `link`, `bad`), `403 { error: 'turnstile' }`, `429 { error: 'rate', retryAfter }` |
| `DELETE /messages/:id` | removal, with `Authorization: Bearer <ADMIN_TOKEN>` → `204`, `401` or `404` |

A post goes through, in order:

1. **Shape.** One line, whitespace collapsed, control and invisible characters dropped, at most 140 characters.
2. **Filter** (`src/filter.js`, shared with the page): words matched after folding case, accents, look-alike
   digits and signs, repeated letters and spelled-apart letters; links and handles refused. Extra words come from the
   `BLOCKLIST` variable, so the list can grow without a deploy of new code.
3. **Rate limit** (`src/ratelimit.js`): per visitor, at most 4 posts in 10 minutes and 20 seconds between two.
   The visitor is a SHA-256 of the address, a secret salt and the day: the raw address is never stored, and the key
   changes every day. Attempts are counted before the challenge, so failed challenges are limited too.
4. **Turnstile**: the token is checked with Cloudflare's `siteverify`. Without `TURNSTILE_SECRET` every post is refused,
   unless `ALLOW_NO_TURNSTILE = "1"` (local development only).
5. **Kept** for `TTL_DAYS` (30 by default). An alarm in the Durable Object deletes expired lines and old rate records.

CORS answers only the origins listed in `ALLOWED_ORIGINS`.

## Deploy

```sh
cd wall/worker
npm i -D wrangler                       # or use a global wrangler
npx wrangler login

# 1. names: edit wrangler.toml
#    name             the Worker's name
#    ALLOWED_ORIGINS  the site's origin(s), e.g. "https://aphes.ist"
#    routes           optional custom domain, e.g. wall-api.aphes.ist

# 2. secrets (never in the file)
npx wrangler secret put TURNSTILE_SECRET   # from the Turnstile widget in the Cloudflare dashboard
npx wrangler secret put HASH_SALT          # any long random string: openssl rand -hex 32
npx wrangler secret put ADMIN_TOKEN        # another long random string, kept by the owner

# 3. ship
npx wrangler deploy
```

The Durable Object class `Wall` is created by the `v1` migration on the first deploy (SQLite-backed, which the free
plan supports).

Then build the page against it, with the Turnstile **site** key (public) of the same widget, whose allowed hostnames
include the site:

```sh
python3 wall/build.py --api https://wall-api.example.com --sitekey 0x4AAAAAAA...
```

## Removing a line

```sh
curl -X DELETE https://wall-api.example.com/messages/<id> -H "Authorization: Bearer $ADMIN_TOKEN"
```

The ids are in `GET /messages`. To keep a word out from now on, add it to `BLOCKLIST` and redeploy the variables
(`npx wrangler deploy`).

## Local

```sh
npx wrangler dev --var ALLOW_NO_TURNSTILE:1 --var HASH_SALT:dev --var ADMIN_TOKEN:dev --var ALLOWED_ORIGINS:http://127.0.0.1:8000
python3 wall/build.py --api http://127.0.0.1:8787
```

## Tests

```sh
npm test      # node --test: the filter, the rate limiter, and the Worker with an in-memory Durable Object
```
