"""Make a small example library: short generated tones, tagged like real files, with cover art.

  python3 music/tools/make_mock.py OUT          # writes OUT/<artist>/<album>/<track>.flac and friends

Nothing here is real music. Every track is a few seconds of plucked sine tones written by this script, every
artist and title is invented, and every file carries the comment "example: a generated tone". The covers are lit
masses on a dark ground drawn with ffmpeg's geq filter, the kind of picture a simulacrum reads well.

The section's bundled mock is this library run through sync.py into music/mock/out (see music/README.md); the
same library is what the sync tests run against. Needs ffmpeg.
"""
import math, os, struct, subprocess, sys, tempfile, wave

RATE = 44100

# artist, album folder, album tag, year, cover, how the cover is stored, bits, rate, tracks: (file name, title, notes)
LIBRARY = [
    ('Halde Wren', 'Salt Hours (2021)', 'Salt Hours', 2021, 'sphere', 'embedded-jpg', 16, 44100, [
        ('01 Tide Room', 'Tide Room', [57, 64, 69, 72]),
        ('02 Ferry Lights', 'Ferry Lights', [55, 62, 67, 71, 74]),
        ('03 Brine', 'Brine', [52, 59, 64, 67]),
        ('04 Salt Hours', 'Salt Hours', [50, 57, 62, 66, 69]),
    ]),
    ('Halde Wren', 'Low Window EP', 'Low Window', 2019, 'crescent', 'folder-jpg', 24, 48000, [
        ('01 low window', 'low window', [60, 63, 67, 70]),
        ('02 sill', 'sill', [58, 62, 65, 69]),
        ('03 condensation', 'condensation', [56, 60, 63, 67, 72]),
    ]),
    ('Mirefield', 'Mirefield - Glass Orchard', 'Glass Orchard', 2023, 'ring', 'embedded-png', 16, 44100, [
        ('1-01 orchard', 'orchard', [62, 66, 69, 73], 1),
        ('1-02 glass', 'glass', [64, 67, 71, 74], 1),
        ('2-01 windfall', 'windfall', [59, 62, 66, 69], 2),
        ('2-02 cider house', 'cider house', [57, 61, 64, 68, 71], 2),
    ]),
]
LOOSE = [  # soundcloud rips: no album, mixed formats
    ('soundcloud', 'ossein - untitled draft.flac', 'Ossein', 'untitled draft', None, 'shaft', 24, 96000, [48, 55, 60, 63]),
    ('soundcloud', 'vanta coast - rain loop 3.flac', 'Vanta Coast', 'rain loop 3', None, None, 16, 44100, [65, 69, 72, 76]),
    ('soundcloud/unsorted', 'kiln choir - halo.m4a', 'Kiln Choir', 'halo', None, 'sphere2', None, 44100, [53, 60, 65, 69]),
    ('soundcloud/unsorted', 'kiln choir - ember.mp3', 'Kiln Choir', 'ember', None, None, None, 44100, [51, 58, 63, 67]),
]

# lit masses on a black ground: geq expressions over a 500px square
COVERS = {
    'sphere': "255*pow(max(0,1-hypot(X-W*0.44,Y-H*0.47)/(W*0.31)),0.7)*(0.55+0.45*(1-hypot(X-W*0.36,Y-H*0.38)/W))",
    'crescent': "255*max(0,min(1,(1-hypot(X-W*0.5,Y-H*0.5)/(W*0.34))*6))*max(0,min(1,(hypot(X-W*0.62,Y-H*0.42)/(W*0.3)-1)*5))*(0.6+0.4*Y/H)",
    'ring': "255*exp(-pow((hypot(X-W*0.5,Y-H*0.52)-W*0.26)/(W*0.045),2))*(0.5+0.5*(X/W))",
    'shaft': "255*exp(-pow((X-W*0.5-(Y-H*0.5)*0.25)/(W*0.09),2))*pow(Y/H,0.6)",
    'sphere2': "255*pow(max(0,1-hypot(X-W*0.58,Y-H*0.55)/(W*0.25)),0.9)",
}


def tone(notes, seconds, seed):
    """plucked sine tones, one after another, ringing over each other, with a quiet fifth below"""
    n = int(RATE * seconds)
    out = [0.0] * n
    step = seconds / (len(notes) + 1.5)
    for i, m in enumerate(notes):
        f = 440 * 2 ** ((m - 69) / 12)
        start = int(RATE * (0.15 + i * step))
        for j in range(start, n):
            t = (j - start) / RATE
            env = math.exp(-t * 2.2) * min(1, t * 200)
            if env < 1e-4:
                break
            out[j] += 0.28 * env * (math.sin(2 * math.pi * f * t) + 0.25 * math.sin(4 * math.pi * f * t + seed))
    drone = 440 * 2 ** ((notes[0] - 12 - 69) / 12)
    for j in range(n):
        t = j / RATE
        out[j] += 0.05 * math.sin(2 * math.pi * drone * t) * min(1, t * 2, (seconds - t) * 2)
    peak = max(abs(x) for x in out) or 1
    return [x / peak * 0.7 for x in out]


def write_wav(path, samples):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(x * 32767)) for x in samples))


def ff(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def cover(path, name):
    ff('-f', 'lavfi', '-i', 'color=c=black:s=500x500:d=1', '-vf', f"format=gray,geq=lum='{COVERS[name]}'",
       '-frames:v', '1', path)


def encode(wav, out, tags, bits, rate, art=None):
    args = ['-i', wav]
    if art:
        args += ['-i', art, '-map', '0:a', '-map', '1:v', '-disposition:v', 'attached_pic', '-c:v', 'copy',
                 '-metadata:s:v', 'comment=Cover (front)']
    ext = os.path.splitext(out)[1]
    if ext == '.flac':
        args += ['-c:a', 'flac', '-ar', str(rate), '-sample_fmt', 's32' if bits == 24 else 's16']
        if bits == 24:
            args += ['-bits_per_raw_sample', '24']
    elif ext == '.m4a':
        args += ['-c:a', 'aac', '-b:a', '96k']
    elif ext == '.mp3':
        args += ['-c:a', 'libmp3lame', '-b:a', '96k', '-id3v2_version', '3']
    for k, v in tags.items():
        args += ['-metadata', f'{k}={v}']
    ff(*args, out)


def main(root):
    os.makedirs(root, exist_ok=True)
    seed = 1
    with tempfile.TemporaryDirectory() as tmp:
        for name in COVERS:
            cover(os.path.join(tmp, name + '.jpg'), name)
            cover(os.path.join(tmp, name + '.png'), name)
        for artist, folder, album, year, cv, how, bits, rate, tracks in LIBRARY:
            d = os.path.join(root, artist, folder)
            os.makedirs(d, exist_ok=True)
            if how == 'folder-jpg':
                ff('-i', os.path.join(tmp, cv + '.jpg'), os.path.join(d, 'folder.jpg'))
            art = os.path.join(tmp, cv + ('.png' if how == 'embedded-png' else '.jpg')) if how.startswith('embedded') else None
            for t in tracks:
                fname, title, notes = t[0], t[1], t[2]
                disc = t[3] if len(t) > 3 else 1
                num = int(fname.split(' ')[0].split('-')[-1])
                wav = os.path.join(tmp, f'{seed}.wav')
                write_wav(wav, tone(notes, 3.0 if bits == 24 else 4.5 + (seed % 3) * 0.75, seed))
                tags = dict(title=title, artist=artist, album_artist=artist, album=album, track=f'{num}/{len(tracks)}',
                            disc=str(disc), date=str(year), comment='example: a generated tone')
                encode(wav, os.path.join(d, fname + '.flac'), tags, bits, rate, art)
                seed += 1
        for folder, fname, artist, title, album, cv, bits, rate, notes in LOOSE:
            d = os.path.join(root, folder)
            os.makedirs(d, exist_ok=True)
            wav = os.path.join(tmp, f'{seed}.wav')
            write_wav(wav, tone(notes, 2.5 if rate > 48000 else 5.0, seed))
            tags = dict(title=title, artist=artist, date='2024', comment='example: a generated tone')
            art = os.path.join(tmp, cv + '.jpg') if cv else None
            encode(wav, os.path.join(d, fname), tags, bits, rate, art)
            seed += 1
    print(root, seed - 1, 'tracks')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
