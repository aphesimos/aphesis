/* crypto: hashes and ids. Raw IP addresses are used once, here, to make a salted hash, and never stored or logged.
   - ipHash: SHA-256 of a secret salt and the address; the key for rate limits.
   - posterToken: SHA-256 of another secret salt, the thread and the IP hash, cut to 16 hex characters. It is the same
     for one person all through one thread and different in every other thread, so sigils cannot follow anyone
     across the board, and it cannot be turned back into an address. */

const enc = new TextEncoder();

export async function sha256hex(s) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return Array.from(d, (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function ipHash(ip, salt) {
  return (await sha256hex((salt || '') + '|ip|' + (ip || 'unknown'))).slice(0, 32);
}

export async function posterToken(salt, thread, ipH) {
  return (await sha256hex((salt || '') + '|poster|' + thread + '|' + ipH)).slice(0, 16);
}

const B32 = 'abcdefghijkmnpqrstuvwxyz23456789';
export function randomId(n = 10) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => B32[x & 31]).join('');
}

/* compare two secrets without leaking where they differ */
export function sameSecret(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
