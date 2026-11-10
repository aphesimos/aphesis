/* hash: small deterministic string hashes for drawing, not for security.
   The same string gives the same numbers in every browser and in node (the worker's tests use this module too).
   Secrets and poster tokens are made on the server with SHA-256; this only turns a token into marks. */

/* FNV-1a over the string's code points, finished with murmur3's avalanche, so neighbouring tokens spread apart */
export function hash32(str, seed = 0) {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/* a reader over 128 bits drawn from the string: take(n) returns the next n bits (n <= 16) as an integer.
   Four independent 32-bit words, each from its own seed; bits are taken from the low end of each word in turn. */
export function bitReader(str) {
  const words = [0, 1, 2, 3].map((i) => hash32(str, Math.imul(i + 1, 0x9e3779b9)));
  let w = 0, used = 0;
  return {
    take(n) {
      let out = 0;
      for (let i = 0; i < n; i++) {
        if (used === 32) { w = (w + 1) % 4; used = 0; }
        out |= ((words[w] >>> used) & 1) << i;
        used++;
      }
      return out >>> 0;
    },
  };
}

/* a short hex name for a string, for keys and labels */
export function hex(str, len = 8) {
  let s = '';
  for (let i = 0; s.length < len; i++) s += hash32(str, i * 7919).toString(16).padStart(8, '0');
  return s.slice(0, len);
}
