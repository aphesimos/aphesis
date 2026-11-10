/* library: index.json (written by tools/sync.py) as the explorer reads it.
   The folder tree as it is on disk, artists and albums gathered from the tags, and a search over everything.
   URLs in the index are relative to the index itself (or to its `base`); the bundled example library resolves
   them to object URLs made from the data inlined by the build. */

import { MOCK, INDEX_URL } from './assets.js';

const coll = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const byName = (a, b) => coll.compare(a, b);
const sortKey = (s) => s.replace(/^the\s+/i, '');

/* the index and a resolver for its URLs */
export async function loadIndex() {
  if (MOCK) {
    const urls = new Map();
    const resolve = (u) => {
      const k = u.split('?')[0];
      if (!urls.has(k)) {
        const data = MOCK.files[k];
        if (!data) return null;
        const bin = atob(data.b64), buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        urls.set(k, URL.createObjectURL(new Blob([buf], { type: data.type })));
      }
      return urls.get(k);
    };
    return { doc: MOCK.index, resolve, example: true };
  }
  const res = await fetch(INDEX_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error('index ' + res.status);
  const doc = await res.json();
  const base = new URL(doc.base || './', new URL(INDEX_URL, location.href));
  return { doc, resolve: (u) => new URL(u, base).href, example: false };
}

export function buildLibrary({ doc, resolve, example }) {
  const tracks = doc.tracks.map((t, i) => Object.assign({}, t, {
    i,
    artistName: t.artist || t.albumArtist || 'unknown artist',
    shown: t.title || t.name,
    hay: [t.title, t.artist, t.albumArtist, t.album, t.path].filter(Boolean).join(' \u0001 ').toLowerCase(),
  }));
  const covers = doc.covers || {};

  /* ---------- folders ---------- */
  const nodes = new Map();
  function node(name, parent, path) {
    const n = { kind: 'dir', name, parent, path, dirs: [], files: [], count: 0, seconds: 0 };
    nodes.set(path.join('/'), n);
    return n;
  }
  const root = node('', null, []);
  if (doc.tree) {
    (function fill(src, n) {
      n.files = src.files.slice();
      for (const d of src.dirs) { const c = node(d.name, n, n.path.concat(d.name)); n.dirs.push(c); fill(d, c); }
    })(doc.tree, root);
  } else {
    tracks.forEach((t) => {
      let n = root;
      for (const part of t.path.split('/').slice(0, -1)) {
        let c = n.dirs.find((d) => d.name === part);
        if (!c) { c = node(part, n, n.path.concat(part)); n.dirs.push(c); }
        n = c;
      }
      n.files.push(t.i);
    });
  }
  (function total(n) {
    n.dirs.sort((a, b) => byName(a.name, b.name));
    n.files.sort((a, b) => byName(tracks[a].name, tracks[b].name));
    n.count = n.files.length; n.seconds = n.files.reduce((s, i) => s + (tracks[i].duration || 0), 0);
    for (const d of n.dirs) { total(d); n.count += d.count; n.seconds += d.seconds; }
  })(root);
  /* every track below a folder, in folder order: what "play" on a folder plays */
  function deep(n, out = []) { out.push(...n.files); n.dirs.forEach((d) => deep(d, out)); return out; }

  /* ---------- artists and albums, from the tags ---------- */
  const artists = new Map(), albums = new Map();
  for (const t of tracks) {
    const an = t.albumArtist || t.artist || 'unknown artist';
    let a = artists.get(an);
    if (!a) { a = { kind: 'artist', name: an, albums: [], loose: [], count: 0, seconds: 0 }; artists.set(an, a); }
    a.count++; a.seconds += t.duration || 0;
    if (t.album) {
      const key = an + '\u0000' + t.album;
      let al = albums.get(key);
      if (!al) { al = { kind: 'album', key, title: t.album, artist: an, year: null, cover: null, tracks: [], seconds: 0 }; albums.set(key, al); a.albums.push(al); }
      al.tracks.push(t.i); al.seconds += t.duration || 0;
      if (t.year) al.year = Math.max(al.year || 0, t.year);
      if (!al.cover && t.cover && covers[t.cover]) al.cover = t.cover;
      t.albumKey = key;
    } else a.loose.push(t.i);
  }
  const trackOrder = (x, y) => {
    const a = tracks[x], b = tracks[y];
    return (a.disc || 1) - (b.disc || 1) || (a.track || 1e4) - (b.track || 1e4) || byName(a.name, b.name);
  };
  for (const al of albums.values()) al.tracks.sort(trackOrder);
  const artistList = [...artists.values()].sort((a, b) => byName(sortKey(a.name), sortKey(b.name)));
  for (const a of artistList) {
    a.albums.sort((x, y) => (x.year || 9999) - (y.year || 9999) || byName(x.title, y.title));
    a.loose.sort((x, y) => byName(tracks[x].shown, tracks[y].shown));
  }
  const albumList = [...albums.values()].sort((a, b) => byName(sortKey(a.artist), sortKey(b.artist)) || (a.year || 9999) - (b.year || 9999) || byName(a.title, b.title));

  /* ---------- search: every word must appear somewhere in title, artist, album or path ---------- */
  function search(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return { albums: [], artists: [], tracks: [] };
    const hit = (s) => words.every((w) => s.includes(w));
    const ts = [];
    for (const t of tracks) if (hit(t.hay)) ts.push(t.i);
    ts.sort((x, y) => byName(sortKey(tracks[x].artistName), sortKey(tracks[y].artistName)) || byName(tracks[x].album || '', tracks[y].album || '') || trackOrder(x, y));
    return {
      artists: artistList.filter((a) => hit(a.name.toLowerCase())).slice(0, 50),
      albums: albumList.filter((al) => hit((al.title + ' ' + al.artist).toLowerCase())).slice(0, 200),
      tracks: ts,
    };
  }

  return {
    tracks, covers, root, nodes, deep, artists, albums, artistList, albumList, search, example,
    stats: { tracks: tracks.length, seconds: tracks.reduce((s, t) => s + (t.duration || 0), 0), bytes: tracks.reduce((s, t) => s + (t.size || 0), 0) },
    url: (u) => (u ? resolve(u) : null),
    mapUrl: (cid) => (cid && covers[cid] ? resolve(covers[cid].map) : null),
    thumbOf: (cid) => (cid && covers[cid] ? covers[cid].thumb : null),
    generated: doc.generated,
  };
}

/* ---------- words ---------- */
export function clock(s) {
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0');
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x;
}
export function hours(s) {
  if (s >= 5400) return Math.round(s / 3600) + ' hours';
  if (s >= 120) return Math.round(s / 60) + ' minutes';
  return Math.round(s) + ' seconds';
}
export function bytes(n) {
  const u = ['b', 'kb', 'mb', 'gb', 'tb'];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
}
export const khz = (r) => (r ? (r % 1000 ? (r / 1000).toFixed(1) : r / 1000) + ' khz' : '');
export const depth = (t) => (t.bits ? t.bits + ' bit' : t.bitrate ? t.bitrate + ' kbps' : '');
export const plural = (n, w) => n.toLocaleString('en') + ' ' + w + (n === 1 ? '' : 's');
