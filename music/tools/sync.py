#!/usr/bin/env python3
"""Sync the music library to the bucket the site reads: originals, streaming copies, cover maps and index.json.

  python3 sync.py --dry-run                     # what would happen, nothing written or uploaded
  python3 sync.py                               # do it (resumable: run it again after an interruption)
  python3 sync.py --verify                      # compare the uploaded index.json with what is in the bucket

Settings come from flags or environment variables:
  --library PATH    APHESIS_MUSIC_LIBRARY   the library folder on this computer
  --remote R:BUCKET APHESIS_MUSIC_REMOTE    an rclone remote and bucket, e.g. r2:aphesis-music
  --dest PATH       APHESIS_MUSIC_DEST      instead of --remote: a plain directory laid out like the bucket (tests)

What one run does:
  1. walks the library and compares each audio file's size and mtime with the state file;
  2. for each new or changed file: reads its tags (mutagen when installed, ffprobe otherwise) and stream facts
     (ffprobe), takes the embedded cover or a folder.jpg, makes a grayscale density map of it and a 24x24 thumb,
     and transcodes a streaming copy to AAC .m4a (lossy originals a browser plays are streamed as they are);
  3. uploads originals under flac/, streams under stream/, maps under maps/, keeping the folder tree in URL-safe
     names; each file is finished (all its objects uploaded, its state saved) before it counts as done;
  4. writes index.json (the folder tree and the tracks, with metadata and URLs) and uploads it after the files it
     names, so the site never sees half a sync; during a long first run it also checkpoints the index;
  5. removes from the bucket, after the new index is up, whatever left the library or matches exclude.txt.

Needs Python 3.9+, ffmpeg and ffprobe, and rclone (not with --dest). Secrets live in rclone's config or its
environment variables, never here. See README.md next to this file.
"""
import argparse, base64, concurrent.futures as cf, datetime, fnmatch, hashlib, json, os, re, shutil, subprocess
import signal, sys, tempfile, threading, time, unicodedata

try:
    import mutagen  # optional: better tag reading
except ImportError:
    mutagen = None

HERE = os.path.dirname(os.path.abspath(__file__))
HOME = os.path.join(os.path.expanduser('~'), '.aphesis-music')
AUDIO = {'.flac', '.wav', '.aif', '.aiff', '.alac', '.m4a', '.mp3', '.ogg', '.oga', '.opus', '.wv', '.ape'}
LOSSLESS_CODECS = {'flac', 'alac', 'wavpack', 'ape'}
STREAM_AS_IS = {'mp3', 'aac'}                      # lossy codecs every browser (iOS Safari included) plays
FOLDER_ART = ['folder', 'cover', 'front', 'album', 'albumart']
MIME = {'.flac': 'audio/flac', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
        '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.aif': 'audio/aiff', '.aiff': 'audio/aiff', '.jpg': 'image/jpeg',
        '.json': 'application/json', '.wv': 'audio/wavpack', '.ape': 'audio/ape', '.alac': 'audio/mp4'}
INDEX_VERSION = 1
MAP_SIZE = 480      # long side of a density map (the design system asks 480 to 640)
THUMB = 24          # the thumb is THUMB x THUMB grey levels, inlined in the index for list rows

LOG_LOCK = threading.Lock()


def log(*a):
    with LOG_LOCK:
        print(*a, flush=True)


def run(cmd, binary=False, check=True, stdin=None):
    p = subprocess.run(cmd, stdin=stdin, capture_output=True)
    if check and p.returncode:
        raise RuntimeError(f'{os.path.basename(cmd[0])} failed ({p.returncode}): {p.stderr.decode("utf-8", "replace")[-600:]}')
    return p.stdout if binary else p.stdout.decode('utf-8', 'replace')


def short_hash(s, n=8):
    return hashlib.sha1(s.encode('utf-8') if isinstance(s, str) else s).hexdigest()[:n]


# ---------------------------------------------------------------- names
def slug(seg):
    """one path segment as a URL-safe, lowercase ASCII name; names with no Latin letters become a short hash"""
    s = unicodedata.normalize('NFKD', seg).encode('ascii', 'ignore').decode('ascii').lower()
    s = re.sub(r'[^a-z0-9._-]+', '-', s).strip('-.')
    s = re.sub(r'-{2,}', '-', s)[:80].strip('-.')
    return s or 'x-' + short_hash(unicodedata.normalize('NFC', seg), 6)


def key_for(rel, taken):
    """the bucket key (no prefix, no extension) for a library path, unique among `taken` (key -> rel)"""
    parts = rel.split('/')
    stem = os.path.splitext(parts[-1])[0]
    k = '/'.join([slug(p) for p in parts[:-1]] + [slug(stem)])
    if taken.get(k, rel) != rel:
        k = k + '-' + short_hash(rel, 6)
    return k


# ---------------------------------------------------------------- excludes
def load_excludes(path):
    pats = []
    if path and os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#'):
                pats.append(unicodedata.normalize('NFC', line.replace('\\', '/').strip('/')))
    return pats


def excluded(rel, pats):
    low = rel.lower()
    for p in pats:
        pl = p.lower()
        if low == pl or low.startswith(pl + '/') or fnmatch.fnmatchcase(low, pl):
            return True
    return False


# ---------------------------------------------------------------- the library
def walk(lib, settle):
    """library-relative POSIX paths (NFC) of audio files -> (size, mtime); files written in the last `settle`
    seconds are left for the next run (a download or a phone sync may still be writing them)"""
    found, fresh, now = {}, [], time.time()
    for dirpath, dirnames, filenames in os.walk(lib):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith('.') and d.lower() not in ('incomplete', '@eadir'))
        for f in sorted(filenames):
            if f.startswith('.') or os.path.splitext(f)[1].lower() not in AUDIO:
                continue
            full = os.path.join(dirpath, f)
            try:
                st = os.stat(full)
            except OSError:
                continue
            rel = unicodedata.normalize('NFC', os.path.relpath(full, lib).replace(os.sep, '/'))
            if now - st.st_mtime < settle:
                fresh.append(rel)
                continue
            found[rel] = (st.st_size, int(st.st_mtime))
    return found, fresh


def probe(path):
    out = run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path])
    return json.loads(out)


def first_int(v):
    m = re.match(r'\s*(\d+)', str(v or ''))
    return int(m.group(1)) if m else None


def read_tags(path, info):
    tags = {}
    for k, v in (info.get('format', {}).get('tags') or {}).items():
        tags[k.lower()] = v
    for s in info.get('streams', []):
        if s.get('codec_type') == 'audio':
            for k, v in (s.get('tags') or {}).items():
                tags.setdefault(k.lower(), v)
    if mutagen:
        try:
            m = mutagen.File(path, easy=True)
            if m and m.tags:
                for k, v in m.tags.items():
                    tags[k.lower()] = v[0] if isinstance(v, list) and v else v
        except Exception:
            pass
    get = lambda *ks: next((str(tags[k]).strip() for k in ks if tags.get(k)), None)
    year = first_int(get('date', 'year', 'originaldate', 'tdrc', 'tyer'))
    return dict(
        title=get('title'), artist=get('artist'), albumArtist=get('album_artist', 'albumartist', 'album artist'),
        album=get('album'), track=first_int(get('track', 'tracknumber', 'trck')),
        disc=first_int(get('disc', 'discnumber', 'tpos')), year=year if year and 1000 < year < 3000 else None)


def audio_facts(info):
    a = next((s for s in info.get('streams', []) if s.get('codec_type') == 'audio'), None)
    if not a:
        raise RuntimeError('no audio stream')
    codec = a.get('codec_name')
    bits = first_int(a.get('bits_per_raw_sample')) or first_int(a.get('bits_per_sample')) or None
    if codec in LOSSLESS_CODECS or codec.startswith('pcm_'):
        if not bits:
            bits = {'s16': 16, 's16p': 16, 's32': 32, 's32p': 32, 'u8': 8}.get(a.get('sample_fmt'))
    else:
        bits = None
    dur = float(a.get('duration') or info.get('format', {}).get('duration') or 0)
    br = first_int(a.get('bit_rate')) or first_int(info.get('format', {}).get('bit_rate'))
    return dict(codec=codec, lossless=codec in LOSSLESS_CODECS or codec.startswith('pcm_'), rate=first_int(a.get('sample_rate')),
                bits=bits, channels=a.get('channels'), duration=round(dur, 3), bitrate=round(br / 1000) if br else None)


# ---------------------------------------------------------------- covers
def cover_source(path, info):
    """('embedded', path) when the file carries a picture, ('folder', image) for a folder.jpg beside it, or None"""
    if any(s.get('codec_type') == 'video' for s in info.get('streams', [])):
        return ('embedded', path)
    d = os.path.dirname(path)
    try:
        names = os.listdir(d)
    except OSError:
        return None
    imgs = {os.path.splitext(n)[0].lower(): n for n in names if os.path.splitext(n)[1].lower() in ('.jpg', '.jpeg', '.png', '.webp')}
    for base in FOLDER_ART:
        if base in imgs:
            return ('folder', os.path.join(d, imgs[base]))
    return None


def gray_pixels(src):
    """the picture as 8-bit grey at most MAP_SIZE on its long side: (w, h, bytes)"""
    pgm = run(['ffmpeg', '-v', 'error', '-i', src, '-map', '0:v:0', '-frames:v', '1', '-vf',
               f'scale=w={MAP_SIZE}:h={MAP_SIZE}:force_original_aspect_ratio=decrease,format=gray',
               '-f', 'image2pipe', '-vcodec', 'pgm', '-'], binary=True)
    m = re.match(rb'P5\s+(\d+)\s+(\d+)\s+(\d+)\s', pgm)
    if not m:
        raise RuntimeError('cover: no picture')
    w, h = int(m.group(1)), int(m.group(2))
    return w, h, pgm[m.end():m.end() + w * h]


def density_map(w, h, px, gamma=0.8):
    """levels as the design system asks: black point at the 30th percentile, white at the 97.5th, gamma 0.8.
    White means dense, so a cover on a light ground is inverted first: its ground must stay empty."""
    hist = [0] * 256
    for v in px:
        hist[v] += 1
    n = len(px)
    edge = max(1, int(min(w, h) * 0.06))
    border = [px[y * w + x] for y in range(h) for x in (range(w) if y < edge or y >= h - edge else list(range(edge)) + list(range(w - edge, w)))]
    border_mean = sum(border) / max(1, len(border))
    mean = sum(px) / max(1, n)
    if border_mean > 128 and border_mean > mean:
        px = bytes(255 - v for v in px)
        hist = hist[::-1]

    def pct(p):
        acc = 0
        for i, c in enumerate(hist):
            acc += c
            if acc >= n * p:
                return i
        return 255
    lo, hi = pct(0.30), pct(0.975)
    if hi <= lo:
        hi = min(255, lo + 1)
    lut = bytes(int(255 * (min(1.0, max(0.0, (v - lo) / (hi - lo))) ** gamma) + 0.5) for v in range(256))
    return px.translate(lut)


def thumb(w, h, px):
    """THUMB x THUMB box-averaged grey levels of the centre square, base64"""
    s = min(w, h)
    x0, y0 = (w - s) // 2, (h - s) // 2
    out = bytearray()
    for j in range(THUMB):
        ya, yb = y0 + j * s // THUMB, y0 + (j + 1) * s // THUMB
        for i in range(THUMB):
            xa, xb = x0 + i * s // THUMB, x0 + (i + 1) * s // THUMB
            tot = cnt = 0
            for y in range(ya, max(yb, ya + 1)):
                row = y * w
                for x in range(xa, max(xb, xa + 1)):
                    tot += px[row + x]
                    cnt += 1
            out.append(tot // max(1, cnt))
    return base64.b64encode(bytes(out)).decode('ascii')


def write_jpeg(w, h, px, out):
    tmp = out + '.part.jpg'
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-vcodec', 'pgm', '-i', '-', '-q:v', '4', tmp],
                       input=b'P5\n%d %d\n255\n' % (w, h) + px, capture_output=True)
    if p.returncode:
        raise RuntimeError('map: ' + p.stderr.decode('utf-8', 'replace')[-300:])
    os.replace(tmp, out)


# ---------------------------------------------------------------- transcoding
_ENC = None


def aac_encoder():
    """the best AAC encoder this ffmpeg has: AudioToolbox on a Mac, fdk if built in, the native one otherwise"""
    global _ENC
    if _ENC is None:
        encs = run(['ffmpeg', '-hide_banner', '-encoders'])
        _ENC = next((e for e in ('aac_at', 'libfdk_aac') if re.search(r'\s' + e + r'\s', encs)), 'aac')
    return _ENC


def transcode(src, out, facts, bitrate):
    tmp = out + '.part.m4a'
    args = ['ffmpeg', '-v', 'error', '-y', '-i', src, '-map', '0:a:0', '-vn', '-map_metadata', '0', '-c:a', aac_encoder(), '-b:a', bitrate]
    if (facts.get('rate') or 0) > 48000:
        args += ['-ar', '48000']
    if (facts.get('channels') or 2) > 2:
        args += ['-ac', '2']
    run(args + ['-movflags', '+faststart', tmp])
    os.replace(tmp, out)


# ---------------------------------------------------------------- where it goes
class Rclone:
    def __init__(self, remote, extra):
        self.remote = remote.rstrip('/')
        self.extra = extra

    def url(self, key):
        return self.remote + '/' + key

    def put(self, local, key, cache='public, max-age=31536000, immutable'):
        ctype = MIME.get(os.path.splitext(key)[1].lower(), 'application/octet-stream')
        # the file's bytes go in on stdin (rcat), so rclone never reads the local name: on Windows rclone turns
        # full-width characters in names (＼ ｜ ？ ＊ ： and so on, common in titles) into their ASCII forms, and a
        # name holding ＼ then points into a folder that does not exist
        with open(local, 'rb') as f:
            run(['rclone', 'rcat', self.url(key), '--size', str(os.path.getsize(local)),
                 '--header-upload', 'Content-Type: ' + ctype, '--header-upload', 'Cache-Control: ' + cache] + self.extra,
                stdin=f)

    def delete(self, key):
        run(['rclone', 'deletefile', self.url(key)] + self.extra, check=False)

    def list(self):
        out = run(['rclone', 'lsf', '-R', '--files-only', self.remote] + self.extra)
        return set(l for l in out.splitlines() if l)

    def read(self, key):
        return run(['rclone', 'cat', self.url(key)] + self.extra)


class Folder:
    """a plain directory laid out like the bucket: for tests and for looking at a sync before uploading it"""
    def __init__(self, path):
        self.root = os.path.abspath(path)

    def put(self, local, key, cache=None):
        dst = os.path.join(self.root, *key.split('/'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        tmp = dst + '.part'
        shutil.copyfile(local, tmp)
        os.replace(tmp, dst)

    def delete(self, key):
        p = os.path.join(self.root, *key.split('/'))
        if os.path.exists(p):
            os.remove(p)
        d = os.path.dirname(p)
        while d != self.root and os.path.isdir(d) and not os.listdir(d):
            os.rmdir(d)
            d = os.path.dirname(d)

    def list(self):
        out = set()
        for dp, _, fs in os.walk(self.root):
            for f in fs:
                out.add(os.path.relpath(os.path.join(dp, f), self.root).replace(os.sep, '/'))
        return out

    def read(self, key):
        return open(os.path.join(self.root, *key.split('/')), encoding='utf-8').read()


# ---------------------------------------------------------------- state
class State:
    """what is already in the bucket, per library file and per cover; written atomically and often, so a run
    stopped at any point (Ctrl-C, a crash, a sleeping laptop) picks up where it was"""
    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.last = 0
        self.data = {'version': 1, 'files': {}, 'covers': {}}
        if os.path.exists(path):
            self.data = json.load(open(path, encoding='utf-8'))
        self.files, self.covers = self.data['files'], self.data['covers']

    def save(self, force=False):
        with self.lock:
            if not force and time.time() - self.last < 5:
                return
            self.last = time.time()
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            tmp = self.path + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, ensure_ascii=False, separators=(',', ':'))
            os.replace(tmp, self.path)


class RunLock:
    """one sync at a time: a chained run and a scheduled one may start together. The OS drops the lock if the
    process dies, so there is never a stale lock to clean up."""
    def __init__(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.f = open(path, 'a+')

    def acquire(self):
        try:
            if os.name == 'nt':
                import msvcrt
                self.f.seek(0)
                msvcrt.locking(self.f.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            return False


# ---------------------------------------------------------------- the index
def index_doc(state):
    tracks, tree = [], {'name': '', 'dirs': {}, 'files': []}
    rels = sorted((r for r, e in state.files.items() if e.get('done')), key=lambda r: [p.lower() for p in r.split('/')])
    used = set()
    for rel in rels:
        e = state.files[rel]
        i = len(tracks)
        t = {'id': e['id'], 'path': rel, 'name': os.path.splitext(rel.split('/')[-1])[0]}
        t.update({k: e['meta'][k] for k in ('title', 'artist', 'albumArtist', 'album', 'track', 'disc', 'year') if e['meta'].get(k) is not None})
        # untagged files take their names from the library's own structure: artist/album/track
        parts = rel.split('/')
        if not t.get('artist') and not t.get('albumArtist') and len(parts) >= 2:
            t['artist'] = parts[0]
            t['artistFrom'] = 'folder'
        if not t.get('album') and len(parts) >= 3:
            t['album'] = parts[-2]
            t['albumFrom'] = 'folder'
        f = e['facts']
        t.update({'duration': f['duration'], 'format': os.path.splitext(rel)[1].lower().lstrip('.'), 'codec': f['codec'],
                  'lossless': f['lossless'], 'rate': f['rate'], 'bits': f['bits'], 'channels': f['channels'],
                  'bitrate': f['bitrate'], 'size': e['size']})
        v = '?v=' + e['v']
        if e.get('orig'):
            t['orig'] = e['orig'] + v
        t['stream'] = e['stream'] + v
        if e.get('cover') in state.covers:   # a cover another worker is still uploading joins at the next index
            t['cover'] = e['cover']
            used.add(e['cover'])
        tracks.append(t)
        node = tree
        for part in rel.split('/')[:-1]:
            node = node['dirs'].setdefault(part, {'name': part, 'dirs': {}, 'files': []})
        node['files'].append(i)

    def plain(n):
        return {'name': n['name'], 'dirs': [plain(n['dirs'][k]) for k in sorted(n['dirs'], key=str.lower)], 'files': n['files']}
    covers = {c: {'map': state.covers[c]['map'], 'thumb': state.covers[c]['thumb']} for c in sorted(used) if c in state.covers}
    return {'version': INDEX_VERSION, 'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'stats': {'tracks': len(tracks), 'bytes': sum(t['size'] for t in tracks),
                      'seconds': round(sum(t['duration'] for t in tracks))},
            'covers': covers, 'tracks': tracks, 'tree': plain(tree)}


def check_index(doc, objects=None):
    """problems with an index: missing fields, tree and track list out of step, URLs that are not in the bucket"""
    errs = []
    if doc.get('version') != INDEX_VERSION:
        errs.append('version')
    n = len(doc['tracks'])
    seen = []

    def visit(node):
        seen.extend(node['files'])
        for d in node['dirs']:
            visit(d)
    visit(doc['tree'])
    if sorted(seen) != list(range(n)):
        errs.append('tree does not list every track exactly once')
    for t in doc['tracks']:
        for k in ('id', 'path', 'stream', 'duration', 'format'):
            if k not in t:
                errs.append(f'{t.get("path")}: no {k}')
        if t.get('cover') and t['cover'] not in doc['covers']:
            errs.append(f'{t["path"]}: cover {t["cover"]} missing')
        if objects is not None:
            for k in ('orig', 'stream'):
                if t.get(k) and t[k].split('?')[0] not in objects:
                    errs.append(f'{t["path"]}: {k} not in the bucket')
    if objects is not None:
        for c, v in doc['covers'].items():
            if v['map'] not in objects:
                errs.append(f'cover {c}: map not in the bucket')
    return errs


# ---------------------------------------------------------------- one file
class Syncer:
    def __init__(self, a, state, dest):
        self.a, self.state, self.dest = a, state, dest
        self.work = os.path.abspath(a.work)
        self.cover_lock = threading.Lock()

    def process(self, rel, size, mtime):
        a, st = self.a, self.state
        src = os.path.join(a.library, *rel.split('/'))
        info = probe(src)
        facts = audio_facts(info)
        meta = read_tags(src, info)
        with st.lock:
            taken = {e['key']: r for r, e in st.files.items() if 'key' in e}
            old = st.files.get(rel, {})
            key = old.get('key') or key_for(rel, taken)
            st.files[rel] = dict(old, key=key, size=size, mtime=mtime, done=False)
        ext = os.path.splitext(rel)[1].lower()
        uploads = []
        orig = None if a.no_originals else 'flac/' + key + ext
        if orig:
            uploads.append((src, orig))
        if not facts['lossless'] and facts['codec'] in STREAM_AS_IS and ext in ('.mp3', '.m4a'):
            stream = orig or 'stream/' + key + ext
            if not orig:
                uploads.append((src, stream))
            tmp_stream = None
        else:
            stream = 'stream/' + key + '.m4a'
            tmp_stream = os.path.join(self.work, *stream.split('/'))
            os.makedirs(os.path.dirname(tmp_stream), exist_ok=True)
            transcode(src, tmp_stream, facts, a.aac_bitrate)
            uploads.append((tmp_stream, stream))
        cid = self.cover(src, info, uploads)
        for local, k in uploads:
            self.dest.put(local, k)
        if tmp_stream and not a.keep_cache:
            os.remove(tmp_stream)
        with st.lock:
            st.files[rel] = dict(key=key, size=size, mtime=mtime, id=short_hash(rel, 10), v=short_hash(f'{size}:{mtime}', 6),
                                 meta=meta, facts=facts, orig=orig, stream=stream, cover=cid, done=True)
        st.save(force=True)
        return facts

    def cover(self, src, info, uploads):
        found = cover_source(src, info)
        if not found:
            return None
        try:
            w, h, px = gray_pixels(found[1])
        except RuntimeError:
            return None
        cid = short_hash(px, 12)
        with self.cover_lock:
            if cid in self.state.covers or cid in getattr(self, '_pending', set()):
                return cid
            self._pending = getattr(self, '_pending', set()) | {cid}
        dm = density_map(w, h, px)
        local = os.path.join(self.work, 'maps', cid + '.jpg')
        os.makedirs(os.path.dirname(local), exist_ok=True)
        write_jpeg(w, h, dm, local)
        self.dest.put(local, 'maps/' + cid + '.jpg')
        with self.state.lock:
            self.state.covers[cid] = {'map': 'maps/' + cid + '.jpg', 'thumb': thumb(w, h, dm), 'w': w, 'h': h}
        if not self.a.keep_cache:
            os.remove(local)
        return cid


def put_index(dest, state, work, final):
    doc = index_doc(state)
    errs = check_index(doc)
    if errs:
        raise RuntimeError('index is not valid: ' + '; '.join(errs[:5]))
    os.makedirs(work, exist_ok=True)
    p = os.path.join(work, 'index.json')
    with open(p + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(p + '.tmp', p)
    dest.put(p, 'index.json', cache='no-cache')
    log(f'index.json {"uploaded" if final else "checkpoint"}: {doc["stats"]["tracks"]} tracks')
    return doc


def human(n):
    for u in ('B', 'KB', 'MB', 'GB', 'TB'):
        if n < 1024 or u == 'TB':
            return f'{n:.1f} {u}' if u != 'B' else f'{n} B'
        n /= 1024


def main(argv=None):
    p = argparse.ArgumentParser(description='Sync the music library to the bucket aphes.ist reads.', formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--library', default=os.environ.get('APHESIS_MUSIC_LIBRARY'))
    p.add_argument('--remote', default=os.environ.get('APHESIS_MUSIC_REMOTE'), help='rclone remote:bucket')
    p.add_argument('--dest', default=os.environ.get('APHESIS_MUSIC_DEST'), help='a directory instead of a remote')
    p.add_argument('--state', default=os.environ.get('APHESIS_MUSIC_STATE', os.path.join(HOME, 'state.json')))
    p.add_argument('--work', default=os.environ.get('APHESIS_MUSIC_WORK', os.path.join(HOME, 'work')), help='scratch space for streams and maps')
    p.add_argument('--exclude', default=os.path.join(HERE, 'exclude.txt'))
    p.add_argument('--dry-run', action='store_true', help='say what would change; write and upload nothing')
    p.add_argument('--verify', action='store_true', help='check the uploaded index.json against the bucket and stop')
    p.add_argument('--jobs', type=int, default=max(1, min(4, (os.cpu_count() or 2) // 2)))
    p.add_argument('--aac-bitrate', default='256k')
    p.add_argument('--settle', type=int, default=120, help='skip files modified in the last N seconds (default 120)')
    p.add_argument('--limit', type=int, default=0, help='process at most N new or changed files this run')
    p.add_argument('--checkpoint-minutes', type=float, default=20, help='upload a partial index this often during long runs')
    p.add_argument('--no-originals', action='store_true', help='upload streams only (no lossless switch)')
    p.add_argument('--keep-cache', action='store_true', help='keep transcoded streams and maps in --work')
    p.add_argument('--rclone-flag', action='append', default=[], help='extra flag for every rclone call (repeatable)')
    a = p.parse_args(argv)

    if bool(a.remote) == bool(a.dest):
        p.error('give exactly one of --remote (or APHESIS_MUSIC_REMOTE) and --dest')
    dest = Folder(a.dest) if a.dest else Rclone(a.remote, a.rclone_flag)
    for tool in ['ffmpeg', 'ffprobe'] + ([] if a.dest else ['rclone']):
        if not shutil.which(tool):
            sys.exit(f'{tool} is not on PATH')

    if a.verify:
        doc = json.loads(dest.read('index.json'))
        objects = dest.list()
        errs = check_index(doc, objects)
        named = {t[k].split('?')[0] for t in doc['tracks'] for k in ('orig', 'stream') if t.get(k)} | {c['map'] for c in doc['covers'].values()} | {'index.json'}
        orphans = sorted(objects - named)
        print(f'{len(doc["tracks"])} tracks, {len(objects)} objects, {len(errs)} problems, {len(orphans)} objects no track names')
        for e in errs[:40]:
            print('  problem:', e)
        for o in orphans[:40]:
            print('  orphan:', o)
        return 1 if errs else 0

    if not a.library or not os.path.isdir(a.library):
        p.error('--library (or APHESIS_MUSIC_LIBRARY) must be a folder')
    a.library = os.path.abspath(a.library)

    lock = RunLock(a.state + '.lock')
    if not lock.acquire():
        log('another sync is running; nothing to do')
        return 0

    state = State(a.state)
    pats = load_excludes(a.exclude)
    found, fresh = walk(a.library, a.settle)
    skipped = sorted(r for r in found if excluded(r, pats))
    for r in skipped:
        del found[r]
    todo = sorted((r for r, (sz, mt) in found.items()
                   if not (state.files.get(r, {}).get('done') and state.files[r]['size'] == sz and state.files[r]['mtime'] == mt)),
                  key=lambda r: [x.lower() for x in r.split('/')])
    gone = sorted(r for r in state.files if r not in found and r not in fresh)
    new = [r for r in todo if r not in state.files]
    changed = [r for r in todo if r in state.files]

    log(f'library {a.library}: {len(found)} audio files ({len(skipped)} excluded, {len(fresh)} still being written)')
    log(f'  new {len(new)}, changed {len(changed)}, removed {len(gone)}, unchanged {len(found) - len(todo)}')
    if a.dry_run:
        size = sum(found[r][0] for r in todo)
        log(f'  would upload about {human(size)} of originals plus their streams and maps')
        for label, rows in (('new', new), ('changed', changed), ('remove', gone), ('excluded', skipped)):
            for r in rows[:15]:
                log(f'  {label:8} {r}')
            if len(rows) > 15:
                log(f'  {label:8} ... and {len(rows) - 15} more')
        log('dry run: nothing written, nothing uploaded')
        return 0
    if a.limit:
        todo = todo[:a.limit]

    syncer = Syncer(a, state, dest)
    os.makedirs(a.work, exist_ok=True)
    t0 = last_cp = time.time()
    done = failed = 0
    total_bytes = sum(found[r][0] for r in todo)
    sent = 0
    def stop_on_term(*_):
        raise KeyboardInterrupt
    try:
        signal.signal(signal.SIGTERM, stop_on_term)      # launchd, systemd and Task Scheduler stop a run this way
    except (ValueError, AttributeError):
        pass
    pool = cf.ThreadPoolExecutor(max_workers=a.jobs)
    try:
        futs = {pool.submit(syncer.process, r, *found[r]): r for r in todo}
        for fut in cf.as_completed(futs):
            r = futs[fut]
            try:
                fut.result()
                done += 1
                sent += found[r][0]
                el = time.time() - t0
                eta = el / sent * (total_bytes - sent) if sent else 0
                log(f'[{done + failed}/{len(todo)}] {r}  ({human(sent)} of {human(total_bytes)}, about {int(eta // 60)} min left)')
            except Exception as e:
                failed += 1
                log(f'[{done + failed}/{len(todo)}] FAILED {r}: {e}')
            if a.checkpoint_minutes and time.time() - last_cp > a.checkpoint_minutes * 60 and done:
                state.save(force=True)
                put_index(dest, state, a.work, False)
                last_cp = time.time()
    except KeyboardInterrupt:
        log('stopping: finishing the files in progress (Ctrl-C again to stop at once)')
        pool.shutdown(wait=True, cancel_futures=True)
        state.save(force=True)
        log('stopped; the next run continues from here')
        return 130
    pool.shutdown(wait=True)
    state.save(force=True)

    # removals: out of the index first, then out of the bucket
    for r in gone:
        state.files[r]['done'] = False
    doc = put_index(dest, state, a.work, True)
    for r in gone:
        e = state.files.pop(r)
        for k in {e.get('orig'), e.get('stream')} - {None}:
            dest.delete(k)
        log(f'removed {r}')
    referenced = {e.get('cover') for e in state.files.values()}
    for c in [c for c in state.covers if c not in referenced]:
        dest.delete(state.covers.pop(c)['map'])
    # a file that changed its stream name (a lossy original replaced by a lossless one) leaves no strays: nothing
    # keeps the old name, and --verify lists anything the index does not name
    state.save(force=True)
    log(f'done: {done} synced, {failed} failed, {len(gone)} removed, {doc["stats"]["tracks"]} tracks in the index, {int(time.time() - t0)} s')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
