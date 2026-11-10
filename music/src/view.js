/* view: the section itself, mounted on its markup and unmounted without a trace; the player core outlives it.
   An explorer on the left (folders as they are on disk, artists and albums from the tags, a search that filters
   as you type), the deck on the right (the live cover, the track, the seek line, the controls and the queue).
   On a phone everything is one column and the whole section scrolls. Long lists are virtual (vlist.js).

   mountView(root, lib, core, {fog}) -> {unmount(), pieces()}. Under a host that rests a section instead (the
   one-page shell takes its markup out and holds its timers, then puts it all back), the view skips drawing while
   its markup is out of the document and draws everything again when it is back. */

import { glyph, hStroke } from './glyphs.js';
import { thumb, band } from './stipple.js';
import { clock, hours, bytes, khz, depth, plural } from './library.js';
import { createVList } from './vlist.js';

const A = window.Aphesis;
const enc = encodeURIComponent;
const ROW = { wide: 40, narrow: 48 };

export function mountView(root, lib, core, opts = {}) {
  const $ = (s) => root.querySelector(s);
  const pane = $('.m-pane'), list = $('.m-list'), input = $('.m-search input');
  const crumbs = $('.m-crumbs'), here = $('.m-here'), sr = $('.m-sr');
  const deck = $('.m-deck'), canvas = $('.m-cover canvas'), caption = $('.m-caption');
  const seekIn = $('.m-seek input'), seekFill = $('.m-seek .s-fill'), seekBand = $('.m-seek .s-fill-cells');
  const tNow = $('.m-seek .t-now'), tEnd = $('.m-seek .t-end');
  const bPlay = $('.c-play'), bPrev = $('.c-prev'), bNext = $('.c-next'), bShuf = $('.c-shuffle'), bLoss = $('.c-lossless');
  const bRand = $('.c-random'), bLoop = $('.c-loop');
  const LOOP_NAME = { off: 'off', archive: 'archive', queue: 'folder', track: 'track' };
  const LOOP_SAY = { off: 'loop off', archive: 'loop the whole archive', queue: 'loop this folder, album or queue', track: 'loop this track' };
  const bVol = $('.c-vol'), volIn = $('.m-vol input'), volFill = $('.m-vol .s-fill');
  const qList = $('.m-queue ol'), qHead = $('.m-queue .q-head');
  let dead = false, place = null, query = '', items = [], ctxTracks = [], active = -1, raf = 0;
  const offs = [];
  const on = (el, type, fn, o) => { el.addEventListener(type, fn, o); offs.push(() => el.removeEventListener(type, fn, o)); };
  const announce = (t) => { sr.textContent = ''; setTimeout(() => { if (!dead) sr.textContent = t; }, 60); };

  /* ---------- the marks that never change ---------- */
  root.querySelectorAll('[data-glyph]').forEach((el) => { el.innerHTML = glyph(el.dataset.glyph); });
  bPlay.innerHTML = '<span class="g-play">' + glyph('play') + '</span><span class="g-pause">' + glyph('pause') + '</span>';
  bVol.innerHTML = '<span class="g-on">' + glyph('volume', 0) + '</span><span class="g-off">' + glyph('volume', 1) + '</span>';
  root.querySelectorAll('.m-seek .s-line, .m-vol .s-line').forEach((el, i) => { el.innerHTML = hStroke(341 + i, 1.3); });
  root.querySelectorAll('.m-search-line').forEach((el) => { el.innerHTML = hStroke(351, 1.2); });
  const s = lib.stats;
  $('.m-stats').textContent = [plural(s.tracks, 'track'), plural(lib.albumList.length, 'album'), plural(lib.artistList.length, 'artist'),
    hours(s.seconds), bytes(s.bytes)].join(' · ') + (lib.example ? ' · examples: generated tones, not music' : '');
  if (!core.volumeSupported) root.querySelectorAll('.m-vol .c-vol, .m-vol .s-track').forEach((el) => { el.hidden = true; });
  if (!core.flacSupported) { bLoss.disabled = true; bLoss.dataset.tip = 'this browser cannot play flac: the stream it is'; }

  /* ---------- where we are: the route ---------- */
  const narrowMq = matchMedia('(max-width: 899px)');
  const parse = () => {
    const parts = location.hash.replace(/^#/, '').split('/');
    if (parts[0] !== 'music') return { mode: 'folders', rest: [] };
    let rest;
    try { rest = parts.slice(2).filter(Boolean).map(decodeURIComponent); } catch (_) { rest = []; }
    return { mode: ['folders', 'artists', 'albums'].includes(parts[1]) ? parts[1] : 'folders', rest };
  };
  const tr = (i) => lib.tracks[i];
  const folderHref = (n) => '#music/folders' + (n.path.length ? '/' + n.path.map(enc).join('/') : '');
  const albumHref = (al) => '#music/albums/' + enc(al.artist) + '/' + enc(al.title);
  const artistHref = (a) => '#music/artists/' + enc(a.name);

  function build({ mode, rest }) {
    const p = { mode, crumbs: [], items: [], tracks: [], all: [], label: '', head: null, back: null };
    if (mode === 'folders') {
      const n = lib.nodes.get(rest.join('/')) || lib.root;
      p.crumbs = [{ label: '~/music', href: '#music/folders' }];
      let acc = []; for (const part of n.path) { acc = acc.concat(part); p.crumbs.push({ label: part, href: folderHref(lib.nodes.get(acc.join('/'))) }); }
      if (n.parent) { p.items.push({ k: 'up', href: folderHref(n.parent) }); p.back = folderHref(n.parent); }
      n.dirs.forEach((d) => p.items.push({ k: 'dir', ref: d, href: folderHref(d) }));
      n.files.forEach((i) => p.items.push({ k: 'track', ref: tr(i), style: 'file' }));
      p.tracks = n.files.map(tr); p.all = lib.deep(n).map(tr);
      p.label = n.path.length ? n.path[n.path.length - 1] : 'everything';
      p.head = { text: [n.dirs.length ? plural(n.dirs.length, 'folder') : '', n.files.length ? plural(n.files.length, 'file') : '', n.count !== n.files.length ? plural(n.count, 'track') + ' in all' : '', hours(n.seconds)].filter(Boolean).join(' · ') };
      p.key = 'f:' + n.path.join('/');
    } else if (mode === 'artists') {
      const a = rest[0] && lib.artists.get(rest[0]);
      p.crumbs = [{ label: 'artists', href: '#music/artists' }];
      if (a) {
        p.crumbs.push({ label: a.name, href: artistHref(a) });
        p.items.push({ k: 'up', href: '#music/artists' }); p.back = '#music/artists';
        a.albums.forEach((al) => p.items.push({ k: 'album', ref: al, href: albumHref(al) }));
        a.loose.forEach((i) => p.items.push({ k: 'track', ref: tr(i), style: 'title' }));
        p.tracks = a.loose.map(tr); p.all = a.albums.flatMap((al) => al.tracks.map(tr)).concat(p.tracks);
        p.label = a.name;
        p.head = { text: [a.albums.length ? plural(a.albums.length, 'album') : '', plural(a.count, 'track'), hours(a.seconds)].filter(Boolean).join(' · ') };
        p.key = 'a:' + a.name;
      } else {
        lib.artistList.forEach((x) => p.items.push({ k: 'artist', ref: x, href: artistHref(x) }));
        p.all = lib.artistList.flatMap((x) => x.albums.flatMap((al) => al.tracks).concat(x.loose)).map(tr);
        p.label = 'every artist';
        p.head = { text: plural(lib.artistList.length, 'artist') };
        p.key = 'a:';
      }
    } else {
      const al = rest.length > 1 && lib.albums.get(rest[0] + '\u0000' + rest[1]);
      p.crumbs = [{ label: 'albums', href: '#music/albums' }];
      if (al) {
        p.crumbs.push({ label: al.title, href: albumHref(al) });
        p.items.push({ k: 'up', href: '#music/albums' }); p.back = '#music/albums';
        al.tracks.forEach((i) => p.items.push({ k: 'track', ref: tr(i), style: 'album' }));
        p.tracks = al.tracks.map(tr); p.all = p.tracks; p.label = al.title;
        p.head = { cover: al.cover, text: [al.artist + (al.year ? ', ' + al.year : ''), plural(al.tracks.length, 'track'), hours(al.seconds)].join(' · '), artist: al.artist };
        p.key = 'l:' + al.key;
      } else {
        lib.albumList.forEach((x) => p.items.push({ k: 'album', ref: x, href: albumHref(x), withArtist: true }));
        p.all = lib.albumList.flatMap((x) => x.tracks).map(tr); p.label = 'every album';
        p.head = { text: plural(lib.albumList.length, 'album') };
        p.key = 'l:';
      }
    }
    return p;
  }
  function searchPlace(q) {
    const r = lib.search(q);
    const p = { mode: 'search', crumbs: [{ label: 'search', href: null }], items: [], tracks: r.tracks.map(tr), label: 'search: ' + q, back: null, key: 's:' + q };
    r.artists.forEach((a) => p.items.push({ k: 'artist', ref: a, href: artistHref(a) }));
    r.albums.forEach((al) => p.items.push({ k: 'album', ref: al, href: albumHref(al), withArtist: true }));
    r.tracks.forEach((i) => p.items.push({ k: 'track', ref: tr(i), style: 'search' }));
    p.all = p.tracks;
    const n = r.tracks.length + r.albums.length + r.artists.length;
    p.head = { text: n ? [r.artists.length ? plural(r.artists.length, 'artist') : '', r.albums.length ? plural(r.albums.length, 'album') : '', plural(r.tracks.length, 'track')].filter(Boolean).join(' · ') : 'nothing matches' };
    return p;
  }

  /* ---------- rows ---------- */
  const fmt = (t) => t.format || '';
  function cellsFor(it) {
    const t = it.ref;
    if (it.k === 'up') return ['<span class="r-g">' + glyph('up') + '</span><span class="r-n"></span>', ['..', 'up one folder']];
    if (it.k === 'dir') {
      const holds = cur() && cur().path.startsWith(t.path.join('/') + '/');
      return ['<span class="r-g">' + glyph('folder', holds ? 1 : 0) + '</span><span class="r-n"></span>' + group(t.seconds), [t.name, null, (t.dirs.length ? plural(t.dirs.length, 'folder') + ' · ' : '') + plural(t.count, 'track')], holds];
    }
    if (it.k === 'artist') {
      const holds = cur() && (cur().albumArtist || cur().artist || 'unknown artist') === t.name;
      return ['<span class="r-g">' + glyph('artist', holds ? 1 : 0) + '</span><span class="r-n"></span>' + group(t.seconds), [t.name, null, (t.albums.length ? plural(t.albums.length, 'album') + ' · ' : '') + plural(t.count, 'track')], holds];
    }
    if (it.k === 'album') {
      const th = lib.thumbOf(t.cover);
      const holds = cur() && cur().albumKey === t.key;
      return ['<span class="r-g' + (th ? ' r-thumb' : '') + '">' + (th ? thumb(th, 32) : glyph('disc')) + '</span><span class="r-n"></span>' + group(t.seconds),
        [t.title, it.withArtist ? t.artist : null, (t.year ? t.year + ' · ' : '') + plural(t.tracks.length, 'track')], holds];
    }
    const playing = cur() && cur().id === t.id;
    const tech = '<span class="r-t">' + clock(t.duration) + '</span><span class="r-f">' + fmt(t) + '</span><span class="r-d">' + (depth(t) || '·') + '</span><span class="r-r">' + (khz(t.rate) || '·') + '</span>' +
      '<span class="r-x">' + clock(t.duration) + ' · ' + fmt(t) + (t.bits ? ' ' + t.bits + '/' + (t.rate ? (t.rate / 1000).toFixed(t.rate % 1000 ? 1 : 0) : '') : '') + '</span>';
    let name;
    if (it.style === 'file') name = t.name;
    else if (it.style === 'album') name = [(t.track ? String(t.track).padStart(2, '0') + '  ' : '') + t.shown, t.artist && place.head && t.artist !== place.head.artist ? t.artist : null];
    else if (it.style === 'search') name = [t.shown, t.artistName + (t.album ? ' · ' + t.album : '')];
    else name = t.shown;
    return ['<span class="r-g">' + glyph('file', playing ? 1 : 0) + '</span><span class="r-n"></span>' + tech, name, playing];
  }
  /* a folder, an artist or an album: its length under time, nothing under format, depth and rate */
  const group = (sec) => '<span class="r-t">' + clock(sec) + '</span><span class="r-x">' + clock(sec) + '</span>';
  function renderRow(i, el) {
    const it = items[i];
    const [html, name, on] = cellsFor(it);
    el.className = 'row r-' + it.k + (on ? ' on' : '') + (i === active ? ' active' : '') + (on ? '' : ' aph-ink');
    el.id = 'mrow-' + i;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', i === active ? 'true' : 'false');
    el.innerHTML = html;
    const n = el.querySelector('.r-n');
    if (Array.isArray(name)) {
      n.textContent = name[0];
      if (name[1]) { const b = document.createElement('span'); b.className = 'r-by'; b.textContent = ' · ' + name[1]; n.append(b); }
      if (name[2]) { const b = document.createElement('span'); b.className = 'r-sub'; b.textContent = name[2]; n.append(b); }
    }
    else n.textContent = name;
    if (it.k === 'track' && on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
  }
  let vl = null;
  function makeList() {
    if (vl) vl.destroy();
    list.textContent = '';
    const narrow = narrowMq.matches;
    vl = createVList({ scroller: narrow ? root : pane, list, rowH: narrow ? ROW.narrow : ROW.wide, render: renderRow });
    vl.set(items.length, renderRow);
  }

  /* ---------- drawing a place ---------- */
  function show(p, how = {}) {
    const prevKey = place && place.key;
    place = p; items = p.items;
    ctxTracks = p.tracks;
    crumbs.innerHTML = '';
    p.crumbs.forEach((c, i) => {
      if (i) crumbs.append(Object.assign(document.createElement('span'), { className: 'sep', textContent: ' / ' }));
      const last = i === p.crumbs.length - 1;
      const a = document.createElement(c.href && !last ? 'a' : 'span');
      if (c.href && !last) a.href = c.href;
      if (last) a.setAttribute('aria-current', 'location');
      a.textContent = p.mode === 'search' ? 'search: ' + query : c.label;
      crumbs.append(a);
    });
    const thumbB64 = p.head && p.head.cover && lib.thumbOf(p.head.cover);
    here.querySelector('.h-thumb').innerHTML = thumbB64 ? thumb(thumbB64, 64, 5) : '';
    here.querySelector('.h-thumb').hidden = !thumbB64;
    here.querySelector('.h-text').textContent = p.head ? p.head.text : '';
    here.querySelectorAll('button').forEach((b) => { b.disabled = !p.all.length; });
    list.setAttribute('aria-label', p.mode === 'search' ? 'search results' : p.label);
    active = how.active != null ? how.active : (p.items.length ? 0 : -1);
    if (active >= items.length) active = items.length - 1;
    vl.set(items.length, renderRow);
    if (prevKey !== p.key && !how.keepScroll) vl.scrollTo(narrowMq.matches ? Math.min(root.scrollTop, list.offsetTop - 140) : 0);
    if (active >= 0) { list.setAttribute('aria-activedescendant', 'mrow-' + active); if (how.reveal && document.activeElement === list) vl.reveal(active); }
    else list.removeAttribute('aria-activedescendant');
    if (how.enter) entrance(Array.from(vl.rows().values()), 0, 28);
  }
  function route(first) {
    if (dead) return;
    const r = parse();
    const before = place;
    if (query) { query = ''; input.value = ''; }
    const p = build(r);
    let act = null;
    /* going up, the folder we came from is the active row */
    if (before && before.mode === r.mode && before.key.length > p.key.length) {
      act = p.items.findIndex((it) => it.href && before.crumbs.length && it.href === before.crumbs[before.crumbs.length - 1].href);
      if (act < 0) act = null;
    }
    show(p, { active: act, reveal: true, enter: !first });
    root.querySelectorAll('.m-views button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === r.mode ? 'true' : 'false'));
    if (!first) announce(p.mode === 'folders' ? 'folder ' + (p.label === 'everything' ? 'music' : p.label) + ', ' + plural(items.filter((x) => x.k !== 'up').length, 'item') : p.label);
  }
  function setActive(i, reveal = true) {
    if (!items.length) return;
    i = Math.max(0, Math.min(items.length - 1, i));
    const prev = active; active = i;
    const rows = vl.rows();
    if (rows.has(prev)) renderRow(prev, rows.get(prev));
    if (reveal) vl.reveal(i);
    const el = vl.rows().get(i); if (el) { renderRow(i, el); glance(el); }
    list.setAttribute('aria-activedescendant', 'mrow-' + i);
  }
  function activate(i) {
    const it = items[i];
    if (!it) return;
    if (it.href) { location.hash = it.href; return; }
    if (it.k === 'track') {
      const k = ctxTracks.indexOf(it.ref);
      core.playList(ctxTracks, Math.max(0, k), place.label);
    }
  }

  /* ---------- the explorer's controls ---------- */
  on(list, 'click', (e) => {
    const row = e.target.closest('.row'); if (!row) return;
    const i = +row.dataset.i; setActive(i, false); activate(i);
  });
  on(list, 'keydown', (e) => {
    const page = Math.max(1, Math.floor((narrowMq.matches ? innerHeight : pane.clientHeight) / vl.rowH) - 1);
    const k = e.key;
    let handled = true;
    if (k === 'ArrowDown') setActive(active + 1);
    else if (k === 'ArrowUp') { if (active <= 0) input.focus(); else setActive(active - 1); }
    else if (k === 'Home') setActive(0);
    else if (k === 'End') setActive(items.length - 1);
    else if (k === 'PageDown') setActive(active + page);
    else if (k === 'PageUp') setActive(active - page);
    else if (k === 'Enter') activate(active);
    else if (k === ' ') core.toggle();
    else if ((k === 'ArrowLeft' || k === 'Backspace') && place.back) location.hash = place.back;
    else if (k === 'ArrowRight' && items[active] && items[active].href && items[active].k !== 'up') activate(active);
    else if (k === 'ArrowLeft' || k === 'ArrowRight') handled = true;
    else handled = false;
    if (handled) e.preventDefault();
  });
  /* focus alone never scrolls: a pointer pressing a row focuses the list, and a scroll between press and release
     would move the row from under it and lose the click */
  on(list, 'focus', () => { if (active < 0 && items.length) setActive(0, false); });
  on(input, 'input', () => {
    query = input.value.trim();
    if (query) show(searchPlace(query), { keepScroll: false });
    else route(true);
    announce(place.head.text);
  });
  on(input, 'keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); if (input.value) { input.value = ''; query = ''; route(true); } else input.blur(); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); list.focus(); if (items.length) setActive(0); }
  });
  root.querySelectorAll('.m-views button').forEach((b) => on(b, 'click', () => { location.hash = '#music/' + b.dataset.mode; }));
  on(here.querySelector('.h-play'), 'click', () => core.playList(place.all, 0, place.label, { shuffle: false }));
  on(here.querySelector('.h-shuffle'), 'click', () => core.playList(place.all, 0, place.label, { shuffle: true }));

  /* ---------- the deck ---------- */
  on(bPlay, 'click', () => { if (!core.current && ctxTracks.length) core.playList(ctxTracks, 0, place.label); else core.toggle(); });
  on(bPrev, 'click', () => core.prev());
  on(bNext, 'click', () => core.next());
  on(bShuf, 'click', () => core.setShuffle(!core.shuffle));
  on(bRand, 'click', () => core.setRandom(!core.random));
  on(bLoop, 'click', () => { const m = core.cycleLoop(); announce(LOOP_SAY[m]); });
  on(bLoss, 'click', () => core.setLossless(!core.lossless));
  on(bVol, 'click', () => core.toggleMute());
  let seeking = false;
  on(seekIn, 'input', () => { seeking = true; const d = core.duration; drawSeek(seekIn.value / 1000 * d, d); });
  on(seekIn, 'change', () => { seeking = false; core.seek(seekIn.value / 1000 * core.duration); });
  on(seekIn, 'pointerup', () => { seeking = false; });
  on(volIn, 'input', () => core.setVolume(volIn.value / 100));
  on(qList, 'click', (e) => { const li = e.target.closest('[data-q]'); if (li) core.playAt(+li.dataset.q); });

  const cur = () => core.current;
  function drawSeek(t, d) {
    const k = d ? Math.min(1, t / d) : 0;
    seekFill.style.clipPath = 'inset(0 ' + (100 - k * 100).toFixed(2) + '% 0 0)';
    tNow.textContent = clock(t);
    tEnd.textContent = clock(d);
    if (!seeking) seekIn.value = Math.round(k * 1000);
    seekIn.setAttribute('aria-valuetext', clock(t) + ' of ' + clock(d));
  }
  function drawState() {
    deck.classList.toggle('playing', core.playing);
    bPlay.setAttribute('aria-label', core.playing ? 'pause' : 'play');
    bPlay.dataset.tip = core.playing ? 'pause · space' : 'play · space';
    if (core.playing && !raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0;
    if (dead) return;
    if (!seeking) drawSeek(core.time, core.duration);
    if (core.playing) raf = requestAnimationFrame(tick);
  }
  function drawOptions() {
    bShuf.setAttribute('aria-pressed', core.shuffle ? 'true' : 'false');
    bRand.setAttribute('aria-pressed', core.random ? 'true' : 'false');
    const lm = core.loop || 'off';
    bLoop.dataset.mode = lm;
    bLoop.querySelector('.g-loop').innerHTML = glyph('loop', lm === 'track' ? 1 : 0);
    bLoop.querySelector('.l-loop').textContent = 'loop · ' + LOOP_NAME[lm];
    bLoop.setAttribute('aria-label', LOOP_SAY[lm] + ' · press for the next mode');
    /* a mark in accent is not black-and-white ink: it leaves the theme wave's blend while it is red */
    bShuf.classList.toggle('aph-ink', !core.shuffle); bRand.classList.toggle('aph-ink', !core.random); bLoop.classList.toggle('aph-ink', lm === 'off');
    bLoss.setAttribute('aria-pressed', core.lossless ? 'true' : 'false');
    const t = cur();
    if (core.flacSupported) bLoss.dataset.tip = core.lossless ? 'lossless: the original flac · f' : 'lossless: load the original flac · f';
    if (t && core.lossless && !t.lossless) bLoss.dataset.tip = 'this track is lossy at the source: played as it is';
    volIn.value = Math.round((core.muted ? 0 : core.volume) * 100);
    volFill.style.clipPath = 'inset(0 ' + (100 - volIn.value) + '% 0 0)';
    deck.classList.toggle('muted', core.muted || core.volume === 0);
  }
  function drawTrack() {
    const t = cur();
    deck.classList.toggle('idle', !t);
    $('.n-title').textContent = t ? t.shown : 'nothing playing';
    $('.n-by').textContent = t ? t.artistName + (t.album ? ' · ' + t.album : '') : 'choose a track, or play a folder';
    $('.n-tech').textContent = t ? techLine(t) : '';
    caption.textContent = t ? (t.album ? t.album : t.shown) + ' · ' + t.artistName + (t.year ? ', ' + t.year : '') : '';
    cover(t);
    vl && vl.refresh();
    drawQueue();
    drawSeek(core.time, core.duration);
  }
  function techLine(t) {
    if (core.sourceLossless) return [t.format, t.bits ? t.bits + ' bit' : '', khz(t.rate), 'lossless'].filter(Boolean).join(' · ');
    if (!t.lossless && /^(mp3|m4a)$/.test(t.format)) return [t.format, t.bitrate ? t.bitrate + ' kbps' : '', khz(t.rate)].filter(Boolean).join(' · ');
    return 'aac stream · from ' + [t.format, t.bits ? t.bits + ' bit' : '', khz(t.rate)].filter(Boolean).join(' ');
  }
  function drawQueue() {
    const q = core.queue, p = core.pos;
    qHead.textContent = q.length ? 'queue · ' + (core.label ? core.label + ' · ' : '') + (p + 1) + ' of ' + q.length + (core.shuffle ? ' · shuffled' : '') : 'queue · empty';
    qList.innerHTML = '';
    const from = Math.max(0, p), to = Math.min(q.length, from + 40);
    for (let i = from; i < to; i++) {
      const li = document.createElement('li');
      li.className = 'aph-ink' + (i === p ? ' q-on' : '');
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.q = i; b.dataset.cursor = '.55';
      b.textContent = q[i].shown;
      const by = document.createElement('span'); by.className = 'q-by'; by.textContent = ' · ' + q[i].artistName; b.append(by);
      if (i === p) b.setAttribute('aria-current', 'true');
      li.append(b); qList.append(li);
    }
    if (q.length > to) { const li = document.createElement('li'); li.className = 'aph-ink q-more'; li.textContent = plural(q.length - to, 'more track'); qList.append(li); }
  }

  /* ---------- the cover: one live simulacrum, reused for every track ---------- */
  /* the sim's options stay live: the spinning record turns its sound cue off while it swaps frames */
  const simOpts = { ground: false, fit: 'contain', margin: 0.06, scatter: 0.6, erosion: 0.5, ceiling: 0.8, accent: 0.015, gain: 1 };
  const sim = A.Simulacrum(canvas, simOpts);
  let shownCover = undefined, simStarted = false, simShown = false;
  const coverBox = $('.m-cover'), idleSlot = $('.m-idle');
  const maps = new Map();
  function mapCanvas(cid) {
    if (!maps.has(cid)) {
      maps.set(cid, new Promise((resolve) => {
        const u = lib.mapUrl(cid);
        if (!u) { resolve(null); return; }
        const im = new Image();
        if (/^https?:/.test(u)) im.crossOrigin = 'anonymous';
        im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); resolve(c); };
        im.onerror = () => resolve(null);
        im.src = u;
      }));
    }
    return maps.get(cid);
  }

  /* no cover: a ring drawn with the brush, the record no one photographed. While the track plays it turns, a step
     at a time at the boil's rate (8 a second, as the seal trembles), so it stays hand-drawn; it eases to a stop on
     pause. The turning is the simulacrum's source drawn again rotated: what shows is always stipple. */
  const REC = 384, recCv = document.createElement('canvas');
  recCv.width = recCv.height = REC;
  const recX = recCv.getContext('2d');
  const recRing = new Path2D(A.brush(A.arc(12, 12, 8.4, -80, 272, 64), 2.6, 361) + A.brush(A.arc(12, 12, 1.4, 0, 360, 16), 1.6, 363, 0, 0) +
    A.brush(A.line(12, 5.4, 12, 6.9, 6), 1.1, 367, 0.3));
  const recDots = new Path2D(A.stipple((px, py) => { const r = Math.hypot(px - 12, py - 12); return r > 3.2 && r < 6.8; }, 365, 2400, 0.5));
  let recAngle = 0, recSpeed = 0, recSince = 0, recLast = 0;
  function drawRecord() {
    const j = (Math.random() - 0.5) * 0.03, sc = 1 + (Math.random() - 0.5) * 0.012;
    recX.setTransform(1, 0, 0, 1, 0, 0);
    recX.fillStyle = '#000'; recX.fillRect(0, 0, REC, REC);
    recX.translate(REC / 2, REC / 2); recX.rotate(recAngle + j); recX.scale(sc, sc); recX.translate(-REC / 2, -REC / 2);
    recX.scale(REC / 24, REC / 24);
    recX.fillStyle = '#fff'; recX.fill(recRing);
    recX.globalAlpha = 0.45; recX.fill(recDots); recX.globalAlpha = 1;
    return recCv;
  }
  const spin = setInterval(() => {
    /* it turns once the record has coalesced (a swap is a dissolve and a coalesce, about 4 s) */
    if (dead || shownCover !== 'record' || performance.now() - recSince < 4200 || !root.isConnected) return;
    const target = core.playing ? 1 : 0, now = performance.now(), dt = Math.min(0.5, (now - (recLast || now)) / 1000);
    recLast = now;
    recSpeed += (target - recSpeed) * (1 - Math.exp(-dt / 0.45));   /* about a second and a half to stop or start */
    if (recSpeed < 0.02 && !target) { recSpeed = 0; recLast = 0; return; }
    recAngle += recSpeed * 0.95 * dt;                                 /* at full speed, about 55 degrees a second */
    drawRecord();
    simOpts.sound = false; sim.show(recCv); simOpts.sound = true;
  }, 125);

  /* nothing loaded: the design system's eye in the cover's place, as wide as the cover, following the pointer and
     glancing at the row the keyboard is on. It is made when the deck goes idle and destroyed when a track loads; a
     runtime without Aphesis.Eye shows the still ring instead */
  let eye = null;
  function idle(on) {
    const has = typeof A.Eye === 'function';
    coverBox.classList.toggle('idle-eye', on && has);
    if (on && has && !eye) {
      idleSlot.innerHTML = '<div class="m-eye"></div>';
      try { eye = A.Eye(idleSlot.firstChild, { gaze: 'pointer', blink: true }); } catch (err) { console.error(err); eye = null; }
    }
    if (!on && eye) { try { eye.destroy(); } catch (_) { /* fine */ } eye = null; idleSlot.textContent = ''; }
    return has;
  }
  /* the eye glances at the row the keyboard is on, where it can */
  function glance(el) { if (eye && typeof eye.look === 'function' && el) { const r = el.getBoundingClientRect(); try { eye.look(r.left + r.width / 2, r.top + r.height / 2); } catch (_) { /* fine */ } } }

  function cover(t) {
    const key = !t ? 'idle' : (t.cover || 'record');
    if (key === shownCover) return;
    shownCover = key; recSince = performance.now();
    if (key === 'idle' && idle(true)) { if (simShown) { simShown = false; sim.hide(); } return; }
    idle(false);
    const go = (src) => {
      if (dead || shownCover !== key) return;
      simShown = true;
      if (!simStarted) {
        simStarted = true;
        sim.drawn(() => requestAnimationFrame(() => { if (!dead) canvas.classList.add('on'); }));
        sim.show(src);
      } else sim.set(src);
    };
    if (key === 'idle' || key === 'record') go(drawRecord());
    /* a cover carries information: the legible preset, so it reads at a glance and is still conjured stipple */
    else mapCanvas(key).then((c) => go(c ? { src: c, legible: true, erosion: 0.15, scatter: 0.18, ceiling: 0.93 } : drawRecord()));
  }

  /* ---------- listening to the core ---------- */
  /* while the markup is out of the document (a host resting the section) nothing is drawn; back in, all of it is */
  let stale = false;
  function redraw() { stale = false; if (eye) { try { eye.start(); } catch (_) { /* fine */ } } drawTrack(); drawState(); drawOptions(); }
  const off = core.on((type) => {
    if (dead) return 'off';
    if (!root.isConnected) { if (!stale && eye) { try { eye.stop(); } catch (_) { /* fine */ } } stale = true; return undefined; }
    if (stale) { redraw(); return undefined; }
    if (type === 'track') { drawTrack(); drawOptions(); }
    else if (type === 'state') { drawState(); vl.refresh(); }
    else if (type === 'time') { if (!raf && !seeking) drawSeek(core.time, core.duration); }
    else if (type === 'queue') { drawQueue(); }
    else if (type === 'options') { drawOptions(); $('.n-tech').textContent = cur() ? techLine(cur()) : ''; drawQueue(); }
    else if (type === 'fallback') announce('the flac would not play in this browser: playing the stream');
    else if (type === 'error') announce('that track would not load');
    if (type === 'track') { const t = cur(); if (t) announce('playing ' + t.shown + ' by ' + t.artistName); }
    return undefined;
  });

  /* ---------- keys, while the section is here ---------- */
  const typing = (el) => el && (el.isContentEditable || /^(TEXTAREA|SELECT)$/.test(el.tagName) || (el.tagName === 'INPUT' && !/^(range|checkbox|radio|button)$/.test(el.type)));
  on(document, 'keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    const t = e.target, onCtl = t.closest && t.closest('button, a[href]'), onRange = t.type === 'range', inList = t === list;
    const k = e.key;
    let used = true;
    if (k === ' ') { if (onCtl) return; core.toggle(); }
    else if (k === 'k' || k === 'K') core.toggle();
    else if ((k === 'ArrowLeft' || k === 'ArrowRight') && !onRange && !inList) core.seekBy((k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 30 : 5));
    else if (k === 'j' || k === 'J') core.seekBy(-10);
    else if (k === 'l' || k === 'L') core.seekBy(10);
    else if (k === 'n' || k === 'N') core.next();
    else if (k === 'p' || k === 'P') core.prev();
    else if (k === 'm' || k === 'M') core.toggleMute();
    else if (k === '-' || k === '_') core.setVolume(core.volume - 0.1);
    else if (k === '=' || k === '+') core.setVolume(core.volume + 0.1);
    else if (k === 's' || k === 'S') core.setShuffle(!core.shuffle);
    else if (k === 'r' || k === 'R') core.setRandom(!core.random);
    else if (k === 'o' || k === 'O') announce(LOOP_SAY[core.cycleLoop()]);
    else if (k === 'f' || k === 'F') core.setLossless(!core.lossless);
    else if (k === '/') input.focus();
    else if (k === 'Escape' && place && place.back) location.hash = place.back;
    else used = false;
    if (used) e.preventDefault();
  });

  /* ---------- fog: calm behind the explorer and the deck ---------- */
  /* one zone per block (a zone is an ellipse round its rectangle, so a tall deck needs several) */
  /* on a wide screen the deck is a tall column: one zone larger than it, as tall as the screen, keeps the fog calm
     behind all of it and lets it gather again at the margins (as the archive does behind its column) */
  const deckZone = {
    pad: 0,
    get r() { return deck.getBoundingClientRect(); },
    get width() { return narrowMq.matches ? 0 : this.r.width / 0.5; },
    get left() { const r = this.r; return r.left + r.width / 2 - r.width / 0.5 / 2; },
    get height() { return innerHeight / 0.6; },
    get top() { return innerHeight / 2 - innerHeight / 0.6 / 2; },
  };
  /* and the same behind the explorer's column; then each block of text gets its own, so no line sits on dense fog.
     The column zones come first: a host that adds marks of its own keeps the first ones when it runs out */
  const explorer = $('.m-explorer');
  const exZone = {
    pad: 0,
    get r() { return explorer.getBoundingClientRect(); },
    get width() { return this.r.width / 0.7; },
    get left() { const r = this.r; return r.left + r.width / 2 - r.width / 0.7 / 2; },
    get height() { return innerHeight / 0.6; },
    get top() { return innerHeight / 2 - innerHeight / 0.6 / 2; },
  };
  if (opts.fog) opts.fog.zones([exZone, deckZone].concat(['.m-head', '.m-lede', '.m-stats', '.m-cols', '.m-pane', '.m-ctl', '.m-vol', '.m-queue']
    .map((q) => ({ el: $(q), pad: 16 })), opts.zones || []).slice(0, 12));

  /* ---------- entrance: each piece on its own, so no ancestor of the .aph-ink text is ever faded or blurred ---------- */
  function entrance(els, delay = 0, step = 70) {
    els.forEach((el, i) => {
      el.classList.remove('m-on'); el.classList.add('m-e');
      el.style.transitionDelay = (delay + i * step) + 'ms';
    });
    requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((el) => el.classList.add('m-on'))));
    setTimeout(() => els.forEach((el) => { el.style.transitionDelay = ''; }), delay + els.length * step + 1400);
  }

  /* ---------- the band of the seek line follows its width ---------- */
  const ro = new ResizeObserver(() => {
    root.querySelectorAll('.m-seek .s-fill-cells, .m-vol .s-fill-cells').forEach((el, i) => {
      const w = Math.ceil(el.parentNode.getBoundingClientRect().width);
      if (w && +el.dataset.w !== w) { el.dataset.w = w; el.innerHTML = band(w, 8, 371 + i); }
    });
  });
  root.querySelectorAll('.m-seek .s-track, .m-vol .s-track').forEach((el) => ro.observe(el));
  void seekBand;
  const onMq = () => makeList();
  narrowMq.addEventListener('change', onMq);

  on(window, 'hashchange', () => route(false));
  on(window, 'resize', () => { if (stale && root.isConnected) redraw(); });
  makeList();
  route(true);
  drawTrack(); drawState(); drawOptions();
  entrance(Array.from(root.querySelectorAll('.m-in')), 120, 70);
  entrance(Array.from(vl.rows().values()), 700, 22);

  function stop() {
    if (dead) return;
    dead = true;
    offs.forEach((f) => f()); off();
    cancelAnimationFrame(raf); clearInterval(spin);
    if (eye) { try { eye.destroy(); } catch (_) { /* fine */ } eye = null; }
    try { ro.disconnect(); } catch (_) { /* fine */ }
    narrowMq.removeEventListener('change', onMq);
    vl.destroy();
    try { sim.stop(); } catch (_) { /* fine */ }
    const ext = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const lose = ext && ext.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }
  return {
    unmount: stop,
    /* the pieces that dissolve when the section leaves, each on its own */
    pieces: () => Array.from(root.querySelectorAll('.m-in, .m-list .row, .m-cover canvas')),
    get vlist() { return vl; },
    /* for checks: the record's turn, and the eye in the idle slot */
    get record() { return { shown: shownCover === 'record', angle: recAngle, speed: recSpeed }; },
    get eye() { return eye; },
  };
}
