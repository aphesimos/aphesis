/* ratelimit: a token bucket per key. The key is an action and an IP hash ("post:3fa9…"), never an address.
   A bucket holds `limit` tokens and refills at limit / window, so a person can post a few times in a row and then
   one more each window / limit. Pure: the Board object keeps the buckets in its storage and calls take(). */

/* bucket: {tokens, at} or undefined (a full bucket). Returns {allowed, bucket, retryAfter (seconds)}. */
export function take(bucket, now, { limit, windowMs }) {
  const rate = limit / windowMs;
  let tokens = bucket ? Math.min(limit, bucket.tokens + (now - bucket.at) * rate) : limit;
  if (tokens >= 1 - 1e-9) {
    tokens = Math.max(0, tokens);
    tokens -= 1;
    return { allowed: true, bucket: { tokens, at: now }, retryAfter: 0 };
  }
  return { allowed: false, bucket: { tokens, at: now }, retryAfter: Math.ceil((1 - tokens) / rate / 1000) };
}

/* a bucket that has refilled completely is the same as no bucket: it can be forgotten */
export function isFull(bucket, now, { limit, windowMs }) {
  return !bucket || bucket.tokens + (now - bucket.at) * (limit / windowMs) >= limit;
}
