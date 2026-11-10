/* ratelimit: a sliding window per visitor, as plain data so it can live in Durable Object storage and be tested
   without one. A record is { hits: [t, ...] }: the times (ms) of recent accepted attempts, oldest first.

   take(record, now, rule) -> { ok, record, retryAfter }   counts one attempt if it fits
   rule: { limit, windowMs, gapMs }  at most `limit` attempts in `windowMs`, and at least `gapMs` between two. */

export const RULE = { limit: 4, windowMs: 10 * 60 * 1000, gapMs: 20 * 1000 };

export function take(record, now, rule = RULE) {
  const hits = ((record && record.hits) || []).filter((t) => typeof t === 'number' && now - t < rule.windowMs && t <= now);
  const last = hits.length ? hits[hits.length - 1] : -Infinity;
  if (rule.gapMs && now - last < rule.gapMs) {
    return { ok: false, record: { hits }, retryAfter: Math.ceil((last + rule.gapMs - now) / 1000) };
  }
  if (hits.length >= rule.limit) {
    return { ok: false, record: { hits }, retryAfter: Math.ceil((hits[0] + rule.windowMs - now) / 1000) };
  }
  hits.push(now);
  return { ok: true, record: { hits }, retryAfter: 0 };
}

/* when a record can be forgotten */
export function expiresAt(record, rule = RULE) {
  const hits = (record && record.hits) || [];
  return hits.length ? hits[hits.length - 1] + rule.windowMs : 0;
}

/* a visitor's key: SHA-256 of the address with a secret salt and the day, so it cannot be reversed or followed
   from one day to the next. The address itself is never stored. */
export async function visitorKey(ip, salt, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${salt}|${day}|${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}
