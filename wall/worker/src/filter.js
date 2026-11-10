/* filter: what the wall keeps out. One module for both sides: the Worker runs it before storing a line, the page
   runs it before sending, so a visitor hears "no" at once and the server still decides.

   clean(text)  -> the line as it will be kept: one line, spaces collapsed, trimmed, control characters gone.
   check(text, extra) -> { ok: true, text } or { ok: false, reason: 'empty' | 'long' | 'word' | 'link' }.
   `extra` is an optional list of further words (the Worker reads it from the BLOCKLIST variable).

   Words are matched after normalising: lowercase, accents stripped, common look-alike digits and signs mapped to
   letters (0 -> o, 1 -> i, 3 -> e, 4 -> a, 5 -> s, 7 -> t, @ -> a, $ -> s), repeated letters folded, and letters
   spelled apart with spaces or dots joined again ("s.h.i.t" -> "shit"). Each word is matched as a whole token or at
   the start of one, so "class" or "scunthorpe" pass. */

export const MAX_LENGTH = 140;

/* stems matched at the start of a token; kept short and plain on purpose. extend with BLOCKLIST, not here */
const WORDS = [
  'fuck', 'shit', 'cunt', 'cock', 'dick', 'pussy', 'bitch', 'bastard', 'asshole', 'arsehole', 'wank', 'twat',
  'whore', 'slut', 'porn', 'rape', 'rapist', 'nazi', 'hitler',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'kike', 'spic', 'chink', 'tranny', 'paki',
  'killyourself', 'kys',
];
/* stems that are also the start of harmless words: these must be the whole token */
const WHOLE = new Set(['cock', 'dick', 'fag', 'spic', 'paki', 'kys', 'rape', 'porn', 'twat', 'nazi']);

/* harmless words that start like a stem */
const ALLOW = new Set(['shitake', 'shiitake', 'cockatoo', 'cockatiel', 'cockle', 'cockles', 'cockpit', 'cocktail', 'cocktails',
  'bitchute', 'spice', 'spicy', 'pakistan', 'pakistani', 'rapeseed']);

const LOOK = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b' };

export function clean(text) {
  return String(text == null ? '' : text)
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fold(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[0134578@$!|+]/g, (c) => LOOK[c] || c);
}

/* the tokens a line is read as: its words, the words with repeated letters folded, and runs of single letters
   joined ("f u c k", "s.h.i.t") */
function tokens(text) {
  const f = fold(text);
  const words = f.split(/[^a-z]+/).filter(Boolean);
  const out = new Set();
  words.forEach((w) => { out.add(w); out.add(w.replace(/(.)\1+/g, '$1')); });
  const parts = f.split(/[\s.\-_*,:;'"~^`/\\]+/).filter(Boolean);
  let run = '';
  for (const p of parts.concat([''])) {
    if (/^[a-z]$/.test(p)) { run += p; continue; }
    if (run.length > 2) { out.add(run); out.add(run.replace(/(.)\1+/g, '$1')); }
    run = '';
  }
  /* two-word phrases written together or apart */
  for (let i = 0; i + 1 < words.length; i++) out.add(words[i] + words[i + 1]);
  return out;
}

function hits(tok, word) {
  return WHOLE.has(word) ? tok === word : tok.startsWith(word);
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|io|ru|xyz|info|biz|top|link|click|me|co|app|gg|ly)\b|@[a-z0-9_]{3,}\b|\bt\.me\b|discord\.gg)/i;

export function check(text, extra = []) {
  const t = clean(text);
  if (!t) return { ok: false, reason: 'empty' };
  if (Array.from(t).length > MAX_LENGTH) return { ok: false, reason: 'long' };
  if (LINK.test(t)) return { ok: false, reason: 'link' };
  const list = WORDS.concat((extra || []).map((w) => fold(String(w)).replace(/[^a-z]/g, '')).filter((w) => w.length > 1));
  for (const tok of tokens(t)) {
    if (ALLOW.has(tok)) continue;
    for (const w of list) if (hits(tok, w)) return { ok: false, reason: 'word' };
  }
  return { ok: true, text: t };
}
