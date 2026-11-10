/* player: the core that outlives the section. One <audio> element, the queue, shuffle, the lossless switch, Media
   Session (lock screen and headphone keys), the ducking of the ambient sound, and the now-playing line top-right.

   Outliving an unmount. When the section is unmounted (the visitor goes home, or to another section) the page
   keeps the core: the audio element is never in the section's markup, the line is a node of its own (#aph-np,
   an aph- id the shell leaves alone) with its stylesheet in <head>, and the core keeps itself on that node
   (#aph-np.__aphPlayer), where the next mount finds it. The core never uses the window's timers, frames,
   observers or listeners: only the audio element's events and its own nodes' listeners, which a host stopping
   everything a section started cannot reach. So it keeps playing, and the line keeps working, with no section
   mounted at all. */

import { NP_CSS } from './assets.js';
import { glyph, hStroke } from './glyphs.js';
import { artwork, band } from './stipple.js';
import { clock } from './library.js';

const STORE = 'aphesis-music';
const MIMES = { flac: 'audio/flac', wav: 'audio/wav', aif: 'audio/aiff', aiff: 'audio/aiff', ogg: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4', wv: '', ape: '' };

export function getPlayer(lib) {
  const line = document.getElementById('aph-np');
  if (line && line.__aphPlayer) return line.__aphPlayer;
  return createPlayer(lib);
}

function createPlayer(lib) {
  /* ---------- the line and its stylesheet ---------- */
  if (!document.getElementById('aph-np-style')) {
    const st = document.createElement('style');
    st.id = 'aph-np-style';
    st.textContent = NP_CSS;
    document.head.appendChild(st);
  }
  const line = document.createElement('div');
  line.id = 'aph-np';
  line.className = 'aph-ink';
  line.setAttribute('role', 'region');
  line.setAttribute('aria-label', 'now playing');
  line.innerHTML =
    '<button type="button" class="np-play" aria-label="play" data-tip="play · pause" data-cursor=".55">' +
    '<span class="g-play">' + glyph('play') + '</span><span class="g-pause">' + glyph('pause') + '</span></button>' +
    '<a class="np-name" href="#music"></a><span class="np-time">0:00</span>' +
    '<span class="np-bar" aria-hidden="true">' + hStroke(331, 1.2) + '<span class="np-fill">' + band(480, 4, 17) + '</span></span>';
  document.body.appendChild(line);
  const npName = line.querySelector('.np-name'), npTime = line.querySelector('.np-time'), npFill = line.querySelector('.np-fill');
  const npPlay = line.querySelector('.np-play');

  /* ---------- state ---------- */
  const audio = new Audio();
  audio.preload = 'auto';
  let base = [], queue = [], pos = -1, label = '', shuffle = false, lossless = false, srcLossless = false;
  let ducked = false, errors = 0, saved = 0, pendingSeek = null, wantPlay = false;
  const fails = new Set(), listeners = new Set();
  const flacSupported = !!audio.canPlayType('audio/flac');
  const volumeSupported = (() => { const a = new Audio(); try { a.volume = 0.5; } catch (_) { return false; } return a.volume === 0.5; })();
  const ms = typeof navigator !== 'undefined' && navigator.mediaSession ? navigator.mediaSession : null;

  const cur = () => (pos >= 0 ? queue[pos] : null);
  function emit(type) {
    for (const fn of [...listeners]) {
      let r;
      try { r = fn(type); } catch (err) { console.error(err); }
      if (r === 'off') listeners.delete(fn);
    }
  }
  function canLossless(t) {
    if (!t || !t.lossless || !t.orig || fails.has(t.id)) return false;
    const m = MIMES[t.format];
    return !!(m && audio.canPlayType(m));
  }

  /* ---------- the ambient sound steps back while a track plays ---------- */
  function duck(on) {
    if (ducked === on) return;
    ducked = on;
    try {
      const A = window.Aphesis;
      if (on) (A && A.Sound && A.Sound.duck(0.05, 1500));
      else (A && A.Sound && A.Sound.duck(1, 1500));
    } catch (err) { console.error(err); }
  }

  /* ---------- loading a track ---------- */
  function load(play, at) {
    const t = cur();
    if (!t) return;
    srcLossless = lossless && canLossless(t);
    const url = lib.url(srcLossless ? t.orig : t.stream);
    pendingSeek = at || null;
    wantPlay = play;
    if (!url) { onError(); return; }
    audio.src = url;
    audio.load();
    if (play) start();
    metadata();
    emit('track');
    store(true);
  }
  function start() {
    const p = audio.play();
    if (p && p.catch) p.catch((err) => { if (err && err.name !== 'AbortError') { wantPlay = false; emit('state'); } });
  }
  function onError() {
    const t = cur();
    if (!t) return;
    if (srcLossless) {           /* the original would not play here: the stream, from the same moment */
      fails.add(t.id);
      const at = audio.currentTime || pendingSeek || 0;
      emit('fallback');
      load(wantPlay || !audio.paused, at);
      return;
    }
    errors++;
    emit('error');
    if (errors <= queue.length && pos < queue.length - 1) { pos++; load(true); }
    else { wantPlay = false; duck(false); emit('state'); }
  }

  audio.addEventListener('loadedmetadata', () => {
    if (pendingSeek) { try { audio.currentTime = Math.min(pendingSeek, Math.max(0, audio.duration - 0.25)); } catch (_) { /* not seekable yet */ } pendingSeek = null; }
    position(); emit('time');
  });
  audio.addEventListener('playing', () => { errors = 0; duck(true); emit('state'); position(); });
  audio.addEventListener('play', () => { wantPlay = true; emit('state'); });
  audio.addEventListener('pause', () => {
    if (audio.ended) return;     /* the end of a track: 'ended' decides */
    wantPlay = false; duck(false); emit('state'); position(); store(true);
  });
  audio.addEventListener('ended', () => {
    if (pos < queue.length - 1) { pos++; load(true); }
    else { wantPlay = false; duck(false); emit('state'); store(true); }
  });
  audio.addEventListener('timeupdate', () => { emit('time'); store(false); });
  audio.addEventListener('seeked', () => { position(); emit('time'); });
  audio.addEventListener('volumechange', () => emit('options'));
  audio.addEventListener('error', () => { if (audio.getAttribute('src')) onError(); });

  /* ---------- Media Session: the lock screen, headphones and keyboards' media keys ---------- */
  let art = null;
  function metadata() {
    const t = cur();
    if (!ms || !t || typeof MediaMetadata === 'undefined') return;
    const md = { title: t.shown, artist: t.artistName, album: t.album || '' };
    try { ms.metadata = new MediaMetadata(md); } catch (_) { return; }
    const thumb = lib.thumbOf(t.cover);
    if (!thumb) return;
    const cs = getComputedStyle(document.documentElement);
    artwork(thumb, '#1c1a1a', cs.getPropertyValue('--n-150').trim() || '#e8e4e3').then((u) => {
      if (!u || cur() !== t) return;
      if (art) URL.revokeObjectURL(art);
      art = u;
      try { ms.metadata = new MediaMetadata(Object.assign(md, { artwork: [{ src: u, sizes: '384x384', type: 'image/png' }] })); } catch (_) { /* fine */ }
    });
  }
  function position() {
    if (!ms) return;
    try { ms.playbackState = audio.paused ? 'paused' : 'playing'; } catch (_) { /* fine */ }
    if (ms.setPositionState && isFinite(audio.duration) && audio.duration > 0) {
      try { ms.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: audio.playbackRate || 1 }); } catch (_) { /* fine */ }
    }
  }
  if (ms) {
    const h = {
      play: () => api.play(), pause: () => api.pause(), stop: () => { api.pause(); api.seek(0); },
      previoustrack: () => api.prev(), nexttrack: () => api.next(),
      seekbackward: (d) => api.seekBy(-((d && d.seekOffset) || 10)), seekforward: (d) => api.seekBy((d && d.seekOffset) || 10),
      seekto: (d) => { if (d && d.seekTime != null) api.seek(d.seekTime); },
    };
    for (const k in h) { try { ms.setActionHandler(k, h[k]); } catch (_) { /* not supported here */ } }
  }

  /* ---------- remembering where the visitor was (this browser only) ---------- */
  function store(now) {
    if (!now && Date.now() - saved < 10000) return;
    saved = Date.now();
    const t = cur();
    try {
      localStorage.setItem(STORE, JSON.stringify({
        id: t && t.id, t: audio.currentTime || 0, vol: audio.volume, muted: audio.muted, lossless, shuffle, label,
        q: queue.slice(0, 2000).map((x) => x.id),
      }));
    } catch (_) { /* storage may be refused */ }
  }

  /* ---------- the line ---------- */
  function drawLine(type) {
    const t = cur();
    line.classList.toggle('on', !!t);
    line.classList.toggle('playing', wantPlay);
    npPlay.setAttribute('aria-label', wantPlay ? 'pause' : 'play');
    if (!t) return;
    if (type === 'track' || type === 'init') {
      npName.innerHTML = '';
      npName.append(t.shown);
      const by = document.createElement('span'); by.className = 'np-by'; by.textContent = ' · ' + t.artistName; npName.append(by);
      npName.setAttribute('href', '#music/folders/' + t.path.split('/').slice(0, -1).map(encodeURIComponent).join('/'));
      npName.setAttribute('aria-label', 'now playing: ' + t.shown + ' by ' + t.artistName + ' · open its folder');
    }
    const d = audio.duration || t.duration || 0;
    npTime.textContent = clock(audio.currentTime) + ' / ' + clock(d);
    npFill.style.clipPath = 'inset(0 ' + (100 - (d ? audio.currentTime / d * 100 : 0)).toFixed(2) + '% 0 0)';
  }
  listeners.add((type) => { drawLine(type); });
  npPlay.addEventListener('click', () => api.toggle());

  /* ---------- the core ---------- */
  function reshuffle() {
    const t = cur();
    if (shuffle) {
      const rest = base.filter((x) => x !== t);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      queue = t ? [t].concat(rest) : rest; pos = t ? 0 : -1;
    } else { queue = base.slice(); pos = t ? queue.indexOf(t) : -1; }
  }
  const api = {
    audio, flacSupported, volumeSupported,
    get queue() { return queue; }, get pos() { return pos; }, get current() { return cur(); }, get label() { return label; },
    get playing() { return wantPlay; }, get lossless() { return lossless; }, get shuffle() { return shuffle; },
    get sourceLossless() { return srcLossless; }, get time() { return audio.currentTime || 0; },
    get duration() { const t = cur(); return audio.duration || (t && t.duration) || 0; },
    canLossless,
    /* play a list of tracks (a folder, an album, search results) from one of them */
    playList(list, start = 0, name = '', opts = {}) {
      if (!list.length) return;
      base = list.slice(); label = name;
      if (opts.shuffle !== undefined) shuffle = opts.shuffle;
      queue = base.slice(); pos = Math.max(0, Math.min(start, queue.length - 1));
      if (shuffle) {
        if (opts.shuffle) pos = Math.floor(Math.random() * queue.length);
        reshuffle();
      }
      errors = 0;
      load(true);
      emit('queue'); emit('options');
    },
    playAt(i) { if (i >= 0 && i < queue.length) { pos = i; load(true); emit('queue'); } },
    play() { if (!cur()) return; if (!audio.getAttribute('src')) load(true); else start(); },
    pause() { audio.pause(); },
    toggle() { if (wantPlay && !audio.paused) audio.pause(); else api.play(); },
    next() { if (pos < queue.length - 1) { pos++; load(wantPlay || !audio.paused); emit('queue'); } },
    prev() {
      if (audio.currentTime > 3 || pos <= 0) { api.seek(0); return; }
      pos--; load(wantPlay || !audio.paused); emit('queue');
    },
    seek(s) {
      const d = api.duration;
      if (!d) return;
      try { audio.currentTime = Math.max(0, Math.min(d - 0.05, s)); } catch (_) { pendingSeek = s; }
      emit('time');
    },
    seekBy(ds) { api.seek((audio.currentTime || 0) + ds); },
    get volume() { return audio.volume; }, get muted() { return audio.muted; },
    setVolume(v) { audio.volume = Math.max(0, Math.min(1, v)); if (audio.volume > 0) audio.muted = false; store(true); },
    toggleMute() { audio.muted = !audio.muted; store(true); },
    setShuffle(b) { shuffle = !!b; reshuffle(); emit('queue'); emit('options'); store(true); },
    /* the lossless switch: load the original instead of the stream, from the same moment */
    setLossless(b) {
      lossless = !!b && flacSupported;
      const t = cur();
      emit('options'); store(true);
      if (t && (lossless && canLossless(t)) !== srcLossless) load(wantPlay && !audio.paused, audio.currentTime);
    },
    /* listen: fn(type) for 'track', 'state', 'time', 'queue', 'options', 'error', 'fallback'; return 'off' to stop */
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  line.__aphPlayer = api;

  /* ---------- where the visitor left off ---------- */
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s) {
      if (typeof s.vol === 'number') audio.volume = s.vol;
      audio.muted = !!s.muted;
      lossless = !!s.lossless && flacSupported; shuffle = !!s.shuffle; label = s.label || '';
      const byId = new Map(lib.tracks.map((t) => [t.id, t]));
      const q = (s.q || []).map((id) => byId.get(id)).filter(Boolean);
      const t = byId.get(s.id);
      if (t && q.length) {
        base = q.slice(); queue = q; pos = queue.indexOf(t);
        srcLossless = lossless && canLossless(t);
        audio.src = lib.url(srcLossless ? t.orig : t.stream) || '';
        pendingSeek = s.t || null;
        metadata();
      }
    }
  } catch (_) { /* nothing to restore */ }
  drawLine('init');
  return api;
}
