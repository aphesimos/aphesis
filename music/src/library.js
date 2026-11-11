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

/* the library as plain data, from the parsed index: every track named, the folder tree, artists and albums
   gathered from the tags, each list in its order. It reads nothing outside itself, so it runs as it is in a worker
   (loadLibrary), and on the main thread where no worker can be made. The tracks are the index's own objects,
   filled in (the document is the library's alone). */
export function computeLibrary(doc) {
  const coll = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  const byName = (a, b) => coll.compare(a, b);
  const sortKey = (s) => s.replace(/^the\s+/i, '');
  /* untagged files take their names from the library's structure (artist/album/track), so an index written before
     sync.py filled these in still reads right */
  const tracks = doc.tracks;
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i], parts = (t.path || '').split('/');
    if (!t.artist && !t.albumArtist && parts.length >= 2) t.artist = parts[0];
    if (!t.album && parts.length >= 3) t.album = parts[parts.length - 2];
    t.i = i;
    t.artistName = t.artist || t.albumArtist || 'unknown artist';
    t.shown = t.title || t.name;
  }
  const covers = doc.covers || {};

  /* ---------- folders: one flat list, the root first; a node names its parent and children by index ---------- */
  const nodes = [];
  function node(name, parent, path) { nodes.push({ name, parent, path, dirs: [], files: [], count: 0, seconds: 0 }); return nodes.length - 1; }
  node('', -1, []);
  if (doc.tree) {
    (function fill(src, n) {
      nodes[n].files = src.files.slice();
      for (const d of src.dirs) { const c = node(d.name, n, nodes[n].path.concat(d.name)); nodes[n].dirs.push(c); fill(d, c); }
    })(doc.tree, 0);
  } else {
    tracks.forEach((t) => {
      let n = 0;
      for (const part of t.path.split('/').slice(0, -1)) {
        let c = nodes[n].dirs.find((d) => nodes[d].name === part);
        if (c === undefined) { c = node(part, n, nodes[n].path.concat(part)); nodes[n].dirs.push(c); }
        n = c;
      }
      nodes[n].files.push(t.i);
    });
  }
  (function total(i) {
    const n = nodes[i];
    n.dirs.sort((a, b) => byName(nodes[a].name, nodes[b].name));
    n.files.sort((a, b) => byName(tracks[a].name, tracks[b].name));
    n.count = n.files.length; n.seconds = n.files.reduce((s, j) => s + (tracks[j].duration || 0), 0);
    for (const d of n.dirs) { total(d); n.count += nodes[d].count; n.seconds += nodes[d].seconds; }
  })(0);

  /* ---------- artists and albums, from the tags ---------- */
  const artists = new Map(), albums = new Map();
  for (const t of tracks) {
    const an = t.albumArtist || t.artist || 'unknown artist';
    let a = artists.get(an);
    if (!a) { a = { name: an, albums: [], loose: [], count: 0, seconds: 0 }; artists.set(an, a); }
    a.count++; a.seconds += t.duration || 0;
    if (t.album) {
      const key = an + '\u0000' + t.album;
      let al = albums.get(key);
      if (!al) { al = { key, title: t.album, artist: an, year: null, cover: null, tracks: [], seconds: 0 }; albums.set(key, al); a.albums.push(al); }
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
  /* an artist's albums by their place in the album list */
  const at = new Map(albumList.map((al, j) => [al, j]));
  artistList.forEach((a) => { a.albums = a.albums.map((al) => at.get(al)); });

  return {
    tracks, nodes, albums: albumList, artists: artistList, covers, base: doc.base, generated: doc.generated,
    stats: { tracks: tracks.length, seconds: tracks.reduce((s, t) => s + (t.duration || 0), 0), bytes: tracks.reduce((s, t) => s + (t.size || 0), 0) },
  };
}

/* the library the explorer reads, made from that data (cheap: it only links what is already worked out) */
function assemble(d, resolve, example) {
  const tracks = d.tracks, covers = d.covers || {};
  const ns = d.nodes.map((n) => ({ kind: 'dir', name: n.name, parent: null, path: n.path, dirs: [], files: n.files, count: n.count, seconds: n.seconds }));
  d.nodes.forEach((n, i) => { ns[i].parent = n.parent >= 0 ? ns[n.parent] : null; ns[i].dirs = n.dirs.map((j) => ns[j]); });
  const root = ns[0], nodes = new Map(ns.map((n) => [n.path.join('/'), n]));
  /* every track below a folder, in folder order: what "play" on a folder plays */
  function deep(n, out = []) { out.push(...n.files); n.dirs.forEach((c) => deep(c, out)); return out; }
  const albumList = d.albums.map((a) => ({ kind: 'album', key: a.key, title: a.title, artist: a.artist, year: a.year, cover: a.cover, tracks: a.tracks, seconds: a.seconds }));
  const artistList = d.artists.map((a) => ({ kind: 'artist', name: a.name, albums: a.albums.map((j) => albumList[j]), loose: a.loose, count: a.count, seconds: a.seconds }));
  const artists = new Map(artistList.map((a) => [a.name, a])), albums = new Map(albumList.map((a) => [a.key, a]));
  const trackOrder = (x, y) => {
    const a = tracks[x], b = tracks[y];
    return (a.disc || 1) - (b.disc || 1) || (a.track || 1e4) - (b.track || 1e4) || byName(a.name, b.name);
  };

  /* ---------- search: every word must appear somewhere in title, artist, album or path ---------- */
  /* (what a track is searched by is put together the first time anything is searched) */
  let hay = null;
  function search(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return { albums: [], artists: [], tracks: [] };
    if (!hay) hay = tracks.map((t) => [t.title, t.artist, t.albumArtist, t.album, t.path].filter(Boolean).join(' \u0001 ').toLowerCase());
    const hit = (s) => words.every((w) => s.includes(w));
    const ts = [];
    for (let i = 0; i < tracks.length; i++) if (hit(hay[i])) ts.push(i);
    ts.sort((x, y) => byName(sortKey(tracks[x].artistName), sortKey(tracks[y].artistName)) || byName(tracks[x].album || '', tracks[y].album || '') || trackOrder(x, y));
    return {
      artists: artistList.filter((a) => hit(a.name.toLowerCase())).slice(0, 50),
      albums: albumList.filter((al) => hit((al.title + ' ' + al.artist).toLowerCase())).slice(0, 200),
      tracks: ts,
    };
  }

  return {
    tracks, covers, root, nodes, deep, artists, albums, artistList, albumList, search, example, stats: d.stats,
    url: (u) => (u ? resolve(u) : null),
    mapUrl: (cid) => (cid && covers[cid] ? resolve(covers[cid].map) : null),
    thumbOf: (cid) => (cid && covers[cid] ? covers[cid].thumb : null),
    generated: d.generated,
  };
}

export function buildLibrary({ doc, resolve, example }) { return assemble(computeLibrary(doc), resolve, example); }

/* the library, with the index fetched, decoded, parsed and worked out in a worker, so none of it holds the page up:
   the main thread only receives the result, the tracks in parts (each part a short task between frames), and links
   it. Inside the one-page shell the index is asked for through the section's fetch (the shell holds the section
   back until the library is there and not empty) and its bytes are handed to the worker; alone, the worker fetches
   it. Where no worker can be made, or it fails, the same work runs here. */
const PART = 400;
export async function loadLibrary() {
  if (MOCK) return buildLibrary(await loadIndex());
  const url = new URL(INDEX_URL, location.href).href;
  const inShell = !!document.getElementById('aph-host');
  const here = async () => {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('index ' + res.status);
    const doc = await res.json();
    const base = new URL(doc.base || './', url);
    return buildLibrary({ doc, resolve: (u) => new URL(u, base).href, example: false });
  };
  let w = null, src = null;
  try {
    src = URL.createObjectURL(new Blob(['"use strict";\n' + computeLibrary.toString() + '\n(' + libraryWorker.toString() + ')(' + PART + ');'], { type: 'text/javascript' }));
    w = new Worker(src);
  } catch (_) { if (src) URL.revokeObjectURL(src); return here(); }
  const end = () => { w.terminate(); URL.revokeObjectURL(src); };
  let buf = null;
  if (inShell) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) { end(); throw new Error('index ' + res.status); }
    buf = await res.arrayBuffer();
  }
  const d = await new Promise((resolve, reject) => {
    const tracks = [];
    w.onmessage = (e) => {
      const m = e.data;
      if (m.t === 'tracks') { for (let i = 0; i < m.list.length; i++) tracks[m.from + i] = m.list[i]; return; }
      end();
      if (m.t === 'rest') { m.data.tracks = tracks; resolve(m.data); } else reject(new Error(m.message));
    };
    /* a worker that could not start or broke down: the work runs here instead */
    w.onerror = (e) => { e.preventDefault(); end(); resolve(null); };
    if (buf) w.postMessage({ buf }, [buf]); else w.postMessage({ url });
  });
  if (!d) return here();
  const base = new URL(d.base || './', url);
  return assemble(d, (u) => new URL(u, base).href, false);
}
/* the worker's own script (with computeLibrary before it): it fetches the index where it was not given its bytes,
   works the library out and sends it back, the tracks first in parts */
function libraryWorker(PART) {
  self.onmessage = async (e) => {
    try {
      let buf = e.data.buf;
      if (!buf) { const r = await fetch(e.data.url, { cache: 'no-cache' }); if (!r.ok) throw new Error('index ' + r.status); buf = await r.arrayBuffer(); }
      const d = computeLibrary(JSON.parse(new TextDecoder().decode(buf)));
      for (let i = 0; i < d.tracks.length; i += PART) postMessage({ t: 'tracks', from: i, list: d.tracks.slice(i, i + PART) });
      d.tracks = null;
      postMessage({ t: 'rest', data: d });
    } catch (err) { postMessage({ t: 'error', message: String((err && err.message) || err) }); }
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
/* one number format for every count: n.toLocaleString('en') builds a new formatter on each call (the same text) */
const NUM = new Intl.NumberFormat('en');
export const plural = (n, w) => NUM.format(n) + ' ' + w + (n === 1 ? '' : 's');
