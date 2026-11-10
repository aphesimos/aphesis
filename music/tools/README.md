# music · tools

How the library on my computer gets to the site. There is no server: the files live in a Cloudflare R2 bucket
behind a public domain, and one script on this computer keeps the bucket in step with the library.

- `sync.py`: walks the library, transcodes what is new, uploads it, writes `index.json`, takes down what left.
- `exclude.txt`: one line per track or folder to keep off the site.
- `make_mock.py`: the example library of generated tones the section ships with (no real music).

Everything secret (R2 keys) lives in rclone's config or in environment variables. Nothing in this folder holds a
key, and nothing below is a real value: replace every `<placeholder>`.

## What ends up in the bucket

```
index.json                                  the folder tree and every track: tags, duration, format, URLs
flac/<artist>/<album>/<track>.flac          the originals, as they are (lossy originals keep their extension)
stream/<artist>/<album>/<track>.m4a         AAC at 256 kbps for every browser, iOS Safari included
maps/<cover id>.jpg                         a grayscale density map of each cover, for the stipple renderer
```

Paths keep the library's folders, in URL-safe lowercase names (`Salt Hours (2021)` becomes `salt-hours-2021`;
names with no Latin letters become a short hash). The names shown on the site come from the tags and the real
file names in `index.json`, not from these keys. URLs in the index carry `?v=<hash of size and mtime>`, so a file
that changes gets a new URL and the long cache on everything but `index.json` never serves an old copy.

**Cost.** About 35 GB of FLAC plus about 9 GB of streams (a 256 kbps stream is roughly a quarter of a FLAC) is
about 44 GB. R2 charges $0.015 per GB-month after the first 10 GB, so about $0.50 a month; uploads and reads stay
inside the free monthly operations for a library this size, and R2 has no egress fees. Call it $0.50 to $0.70 a
month.

## Setting it up, once

### 1. Install the tools

- Python 3.9 or newer, `ffmpeg` (with `ffprobe`) and `rclone`.
  - macOS: `brew install python ffmpeg rclone`
  - Windows: `winget install Python.Python.3.12 Gyan.FFmpeg Rclone.Rclone`
  - Linux: `sudo apt install python3 ffmpeg rclone` (or your distribution's equivalent)
- Optional: `pip install mutagen` reads tags more reliably than ffprobe; the script uses it when it is there.

### 2. Create the bucket

In the Cloudflare dashboard: **R2 → Create bucket**, name it `<bucket>` (for example `aphesis-music`), location
automatic. Leave public access off for the `r2.dev` URL: the custom domain is the public way in.

### 3. Give it a public domain

**R2 → `<bucket>` → Settings → Custom Domains → Connect Domain**, and enter a subdomain of the site's zone, for
example `music.aphes.ist`. Cloudflare adds the DNS record. Range requests work through it, so seeking in a track
works. Audio and maps are cached at the edge; `index.json` is uploaded with `Cache-Control: no-cache`.

### 4. Allow the site to read it (CORS)

**R2 → `<bucket>` → Settings → CORS Policy → Edit**, and paste:

```json
[
  {
    "AllowedOrigins": ["https://aphes.ist"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

The site fetches `index.json` and reads the density maps into a canvas, which both need CORS. Add
`"http://localhost:8080"` (or whatever you preview on) to `AllowedOrigins` while testing locally.

### 5. An API token and an rclone remote

**R2 → Manage R2 API Tokens → Create API Token**: permission *Object Read & Write*, limited to `<bucket>`. Copy
the access key id, the secret access key and your account id. Then:

```sh
rclone config create r2 s3 provider=Cloudflare \
  access_key_id=<ACCESS_KEY_ID> secret_access_key=<SECRET_ACCESS_KEY> \
  endpoint=https://<ACCOUNT_ID>.r2.cloudflarestorage.com acl=private no_check_bucket=true
rclone lsd r2:            # should list <bucket>
```

That writes the keys to rclone's own config (`rclone config file` says where), outside this repository. To keep
them out of any file at all, rclone also reads them from the environment instead:
`RCLONE_CONFIG_R2_TYPE=s3`, `RCLONE_CONFIG_R2_PROVIDER=Cloudflare`, `RCLONE_CONFIG_R2_ACCESS_KEY_ID=…`,
`RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=…`, `RCLONE_CONFIG_R2_ENDPOINT=…`, `RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true`.

### 6. Tell the script where things are

```sh
export APHESIS_MUSIC_LIBRARY="<path to the library>"     # e.g. ~/Music/soulseek
export APHESIS_MUSIC_REMOTE="r2:<bucket>"
```

(On Windows: `setx APHESIS_MUSIC_LIBRARY "D:\Music\soulseek"` and `setx APHESIS_MUSIC_REMOTE "r2:<bucket>"`,
then open a new terminal.) The flags `--library` and `--remote` do the same for one run.

### 7. The first sync

```sh
python3 music/tools/sync.py --dry-run      # counts, a sample of what is new, how much will go up; writes nothing
python3 music/tools/sync.py --limit 20     # a first handful, to check the site with real files
python3 music/tools/sync.py                # everything; leave it running
python3 music/tools/sync.py --verify       # the bucket holds exactly what index.json names
```

The first full run uploads all 35 GB and transcodes every track, so it takes hours. It is safe to stop at any
point (Ctrl-C, closing the laptop, a crash): each file is finished and recorded before it counts, and the next run
picks up where this one stopped. During a long run it uploads a partial `index.json` every 20 minutes, listing only
what is already up, so the site fills in as it goes. `--jobs N` transcodes N files at once (default: half the
cores, at most 4).

Then build the site against the real index: `python3 music/build.py --index https://music.aphes.ist/index.json`.

## Every day after that

Run it whenever the library changes. It only touches what changed (by size and modification time, recorded in
`~/.aphesis-music/state.json`), so a run with nothing new takes a second. Files written in the last two minutes
are left for the next run, since Soulseek or the phone sync may still be writing them (`--settle`). If two runs
start together, the second sees the first and exits.

- **Something new or changed** in the library: it goes up on the next run.
- **Something deleted** from the library: the next run takes it out of `index.json`, then deletes its files from
  the bucket.
- **Take one track down** without deleting it: add its path, as it is inside the library, to `exclude.txt`:
  `Some Artist/Some Album/03 a track.flac`. A folder or a pattern works too (`*/demos/*`). Delete the line to put
  it back.

### Chained after the phone sync

If the phone sync is a command or a script, add one line after it, so the site follows every change:

```sh
<your phone sync command> && python3 /path/to/aphesis/music/tools/sync.py >> ~/.aphesis-music/sync.log 2>&1
```

If it is an app with a "run after sync" hook, point the hook at the same line. Otherwise schedule it:

### On a schedule

**macOS (launchd).** Save as `~/Library/LaunchAgents/ist.aphes.music.plist`, then
`launchctl load ~/Library/LaunchAgents/ist.aphes.music.plist`. It runs every hour while you are logged in.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>ist.aphes.music</string>
  <key>ProgramArguments</key><array>
    <string>/usr/bin/env</string><string>python3</string><string>/path/to/aphesis/music/tools/sync.py</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>APHESIS_MUSIC_LIBRARY</key><string>/Users/you/Music/soulseek</string>
    <key>APHESIS_MUSIC_REMOTE</key><string>r2:aphesis-music</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>/Users/you/.aphesis-music/sync.log</string>
  <key>StandardErrorPath</key><string>/Users/you/.aphesis-music/sync.log</string>
</dict></plist>
```

(If the library is in `~/Music` or `~/Documents`, give `python3` Full Disk Access in System Settings → Privacy.)

**Windows (Task Scheduler).** In a terminal, after the `setx` lines above:

```bat
schtasks /Create /SC HOURLY /TN "aphesis music" /TR "py -3 C:\path\to\aphesis\music\tools\sync.py"
```

Or in Task Scheduler: Create Task → Triggers: daily, repeat every hour → Actions: `py`, arguments
`-3 C:\path\to\aphesis\music\tools\sync.py` → Settings: "Do not start a new instance".

**Linux (cron or systemd).** A crontab line (`crontab -e`):

```
17 * * * * APHESIS_MUSIC_LIBRARY=/home/you/music APHESIS_MUSIC_REMOTE=r2:aphesis-music /usr/bin/python3 /path/to/aphesis/music/tools/sync.py >> /home/you/.aphesis-music/sync.log 2>&1
```

Or a user timer: `~/.config/systemd/user/aphesis-music.service`

```ini
[Service]
Type=oneshot
Environment=APHESIS_MUSIC_LIBRARY=/home/you/music
Environment=APHESIS_MUSIC_REMOTE=r2:aphesis-music
ExecStart=/usr/bin/python3 /path/to/aphesis/music/tools/sync.py
```

and `~/.config/systemd/user/aphesis-music.timer`

```ini
[Timer]
OnCalendar=hourly
Persistent=true
[Install]
WantedBy=timers.target
```

then `systemctl --user enable --now aphesis-music.timer`.

## All the flags

| flag | default | what it does |
| --- | --- | --- |
| `--library PATH` | `$APHESIS_MUSIC_LIBRARY` | the library folder |
| `--remote R:BUCKET` | `$APHESIS_MUSIC_REMOTE` | the rclone remote and bucket |
| `--dest PATH` | `$APHESIS_MUSIC_DEST` | a plain folder laid out like the bucket, instead of a remote (tests, a look before uploading) |
| `--dry-run` | | say what would change; write and upload nothing |
| `--verify` | | compare the uploaded `index.json` with the bucket's listing: missing files, files nothing names |
| `--limit N` | all | process at most N new or changed files this run |
| `--jobs N` | half the cores, ≤ 4 | files transcoded and uploaded at once |
| `--aac-bitrate` | `256k` | the streams' bitrate |
| `--settle S` | `120` | leave files modified in the last S seconds for the next run |
| `--checkpoint-minutes M` | `20` | upload a partial index this often during long runs (0: never) |
| `--no-originals` | | upload streams only (the site's lossless switch then has nothing to load) |
| `--keep-cache` | | keep the transcoded streams and maps in the work folder |
| `--state`, `--work`, `--exclude` | `~/.aphesis-music/…`, `exclude.txt` here | where the state, the scratch files and the exclude list live |
| `--rclone-flag F` | | an extra flag for every rclone call, repeatable (e.g. `--rclone-flag=--bwlimit=4M`) |

## index.json

```json
{
  "version": 1, "generated": "2026-11-10T18:00:00Z",
  "stats": {"tracks": 6210, "bytes": 37580963840, "seconds": 1580000},
  "covers": {"0bf49b5599b6": {"map": "maps/0bf49b5599b6.jpg", "thumb": "<base64 of 24x24 grey levels>"}},
  "tracks": [{
    "id": "ac4f9c8084", "path": "Halde Wren/Low Window EP/01 low window.flac", "name": "01 low window",
    "title": "low window", "artist": "Halde Wren", "albumArtist": "Halde Wren", "album": "Low Window",
    "track": 1, "disc": 1, "year": 2019, "duration": 3.0, "format": "flac", "codec": "flac", "lossless": true,
    "rate": 48000, "bits": 24, "channels": 2, "bitrate": 517, "size": 193772,
    "orig": "flac/halde-wren/low-window-ep/01-low-window.flac?v=491147",
    "stream": "stream/halde-wren/low-window-ep/01-low-window.m4a?v=491147", "cover": "0bf49b5599b6"
  }],
  "tree": {"name": "", "dirs": [{"name": "Halde Wren", "dirs": [], "files": [0]}], "files": []}
}
```

URLs are relative to `index.json` (or to a `base` field, if one is added). `tree` lists each track once, by its
position in `tracks`. Missing tags are simply absent. Density maps follow the design system's rules for simulacra:
grayscale, 480px on the long side, white = dense, black point at the 30th percentile, white at the 97.5th, gamma
0.8; a cover on a light ground is inverted first, so its ground stays empty.
