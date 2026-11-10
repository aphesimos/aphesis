# music · *phonotheca*

What I listen to, as it sits on my disk: about 35 GB, mostly FLAC, mostly niche music from SoundCloud. Browse it
like a file explorer and listen with the player built in. The gloss is *phonotheca*, a library of sounds, as
*bibliotheca* is a library of books.

- **The explorer.** Folders as they are on disk, or artists and albums gathered from the tags; a search that
  filters as you type (every word must appear in the title, artist, album or path). Rows read like a quiet
  terminal listing in Special Elite: name, time, format, bit depth, sample rate. Folders, files and artists are
  brushed glyphs with stipple on the 24-unit grid (`src/glyphs.js`); albums show their cover as a still stipple
  thumb (`src/stipple.js`). Lists are virtual (`src/vlist.js`): 20,000 tracks keep about forty rows in the page.
- **The deck.** The cover as a live simulacrum (one canvas for the whole section, a dissolve between albums), the
  track, a seek line (a brushed stroke with the time already played in stipple), previous · play · next, shuffle,
  the **lossless** switch, volume and the queue. Playing a track queues the folder, album or search results it is
  in, from that track; *play* and *shuffle* above the list queue the whole place (a folder with everything under
  it, an artist, an album).
- **The cover.** Album covers carry information, so they use the design system's legible preset
  (`{legible: true}`): recognisable at a glance, still stipple that coalesces out of the fog. A track with no cover
  shows a record drawn with the brush, which turns while the track plays (redrawn at the boil's 8 frames a second,
  so it trembles as the seal does) and eases to a stop on pause. With nothing loaded, the design system's eye
  (`Aphesis.Eye`) sits in the cover's place, following the pointer and glancing at the row the keyboard is on; it
  is destroyed when a track loads and made again when the deck goes idle.
- **Shuffle, random, loop.** *Shuffle* plays the current queue (a folder, an album, search results) in another
  order. *Random* is a radio over the whole archive: a random track each time, never one of the last 50 (about
  half the library when it is small); previous goes back through what played. *Loop* cycles off → archive (the
  whole library in order, then from the start) → folder (this folder, album or queue) → track → off, shown by a
  brushed glyph and a label (`loop · folder`). Random with loop track repeats the track; random with any other
  loop is just random. Next and previous, on screen, by key and from the lock screen, follow the modes, and the
  modes are remembered.
- **Lossless.** The switch loads the original FLAC instead of the AAC stream, at the same moment of the track. It
  is off where `canPlayType('audio/flac')` says no; a lossy original says so and plays as it is; an original that
  fails to load falls back to the stream and says so.
- **Phones.** Media Session metadata and handlers: the lock screen and headphone keys play, pause, skip and seek;
  the artwork is the cover in stipple, drawn on a canvas. Volume is hidden where the browser ignores it (iOS).
- **Continuity.** The music keeps playing when the visitor leaves the section: see below.
- **Remembering.** The track, the moment, the queue, the volume and the switches are kept in this browser's
  `localStorage`, so a return resumes (paused) where it was. Nothing else is stored.

Everything is lowercase in the chrome; track, artist and album names stay as tagged.

Published with the example library at https://claude.ai/artifact/KkkqUmsu2JtYC6u8aUhKJN (private until shared).

## Keys

While the section is open, and never while typing in the search field:

| key | does |
| --- | --- |
| space, `k` | play · pause (space presses the focused button when one has focus) |
| ← → | seek 5 s (shift: 30 s); in the list, ← goes up a folder and → opens one |
| `j` `l` | seek 10 s back · forward |
| `n` `p` | next · previous (previous restarts the track after 3 s) |
| `-` `=` · `m` | volume down · up · mute |
| `s` · `r` · `o` | shuffle · random · the next loop mode |
| `f` | lossless |
| `/` | search; Escape clears it, ↓ or Enter goes to the results |
| ↑ ↓ Home End PageUp PageDown, Enter | move in the list and open or play the row |
| Escape | up a folder (or out of a search); at the top it is the site's |

The list is one focus stop (`role="listbox"` with `aria-activedescendant`), so a virtual list never loses focus to
a row that scrolled away. The now-playing line's play mark and title are buttons and links of their own.

## Continuity: a section that unmounts and a player that stays

The site is becoming one continuous page whose routes change without reloads, so the section is built as a module
that mounts and unmounts, and the player as a core that outlives it.

- **`mountView(root, lib, core, {fog})`** (`src/view.js`) draws the explorer and the deck into the section's markup
  and returns `{unmount(), pieces()}`. Unmounting stops its loops, observers and listeners, releases the
  simulacrum's WebGL context and lets go of the core. While its markup is out of the document (a host resting the
  section rather than unmounting it) it draws nothing, and it draws everything again when the markup is back.
- **`getPlayer(lib)`** (`src/player.js`) returns the one player core, creating it the first time. It holds the
  `<audio>` element (never in the section's markup), the queue, shuffle and lossless, Media Session, the ducking,
  and the **now-playing line** `#aph-np`, a node of its own in `<body>` with its stylesheet in `<head>`. The core
  keeps itself on that node (`#aph-np.__aphPlayer`), where the next mount finds it. It uses no window timers,
  frames, observers or listeners, only its own elements' events, so a host that cancels everything a section
  started cannot stop it.
- **The line** sits top-right, the one corner the site leaves free: the seal is top-left, the eye and the ear
  bottom-left, the passage bottom-right. On phones and touch screens its play mark and title are 44px targets,
  clear of the seal and the safe areas. Play · pause, the title and artist (a link to the track's
  folder), the time, and a stippled progress. It hides while the section is mounted
  (`:root[data-sec="music"]`, which the shell already sets), since the deck shows the same.
- **This page** is its own small host: `#music…` (or no hash) mounts the section, any other route (the seal's
  `#home`) dissolves it piece by piece and shows a stand-in for the rest of the site, while the music plays on.
  `window.AphesisMusic` exposes `mount`, `unmount`, `player`, `view` and `library` for a host and for checks.
- **In the one-page shell** (`site/src/shell.js` on `site`, in progress): the section's script runs once in the
  shell's sandbox; leaving, the shell rests it (holds its timers and frames, takes off its listeners, gives back its
  WebGL contexts, sets its markup aside) and wakes it where it was on return. The core is untouched by either: its
  audio element and its line live outside the section's markup (the line's `aph-` id keeps the shell's stray-node
  sweep off it), and nothing it relies on is a timer or listener the sandbox holds. Checked with a build of the
  shell that includes this section: playback carries on from the music to the home and on to the archive, the line
  pauses and plays there, its title leads back, and the deck wakes showing the track that played meanwhile. Two
  small additions would help: add `music: '#music'` to the shell's `INDEX` (Escape from an album goes to the
  section's top), and put `music` with the gloss *phonotheca* on the inscription.

Routes: `#music` (folders at the top), `#music/folders/<folder>/<folder>`, `#music/artists`,
`#music/artists/<artist>`, `#music/albums`, `#music/albums/<artist>/<album>`, each segment URL-encoded.

## Ambient sound

When a track starts, the core calls `(Aphesis.Sound && Aphesis.Sound.duck(0.05, 1500))`; when playback stops
(paused, or the queue ran out) it calls `Aphesis.Sound.duck(1, 1500)` the same guarded way. Moving to the next
track does not restore it in between. Everything works without `Aphesis.Sound`.

**The ear mutes the music too.** The core reads `Aphesis.Sound.muted` when it is made (a visitor who comes back
muted gets the music silenced from the first note) and listens on the page's window for the runtime's `aph:sound`
event (`{detail: {muted}}`). Closing the ear fades the track to silence over `duration-hush` and opening it fades
it back; the track keeps playing underneath, so it resumes in place. The player's own volume and mute are
separate: what you hear is the slider times the ear. Where a page cannot set the volume (iOS), the ear can only
cut. The listener and the fade use the page's own window (the audio element's), never the section's sandboxed
timers, so they work on every route.

## Building

```sh
python3 music/build.py                                             # music/index.html with the example library
python3 music/build.py --index https://music.aphes.ist/index.json  # the real library, from R2
python3 music/build.py --index URL --fragment OUT                  # also the page without doctype/html/head/body
```

`build.py` reads `tokens.json`, `bundle.css`, `bundle.js` and the Aphesis Script font from the `design-system`
branch with `git show`, generates `tokens.css`, and writes one self-contained page. Special Elite is vendored in
`vendor/` (Apache License 2.0). The modules in `src/` are plain ES modules, concatenated in dependency order:

| module | what it does |
| --- | --- |
| `assets.js` | written by the build: the now-playing stylesheet, the index URL or the example library |
| `glyphs.js` | folder, file, artist, up, disc, play, pause, previous, next, shuffle, volume; a brushed stroke |
| `stipple.js` | cover thumbs as 2px cells (ceiling, erosion, lost points), the seek band, the lock-screen artwork |
| `library.js` | the index: folders, artists, albums, search; URLs; durations and sizes in words |
| `vlist.js` | the virtual list (rows placed with `top`, never a transform) |
| `player.js` | the core that outlives the section, and its line (`np.css`) |
| `view.js` | the explorer and the deck: mount, unmount |
| `main.js` | theme, fog (density .62, light .4), seal, cursor, tooltip; the host for this page |

**The example library** (`mock/out`) is not music: fifteen tracks of plucked sine tones written by
`tools/make_mock.py`, with invented artists and titles, tagged and given generated covers (lit masses on a dark
ground), then run through the real `tools/sync.py` into a folder laid out like the bucket. To make it again:

```sh
python3 music/tools/make_mock.py /tmp/mock-lib
python3 music/tools/sync.py --library /tmp/mock-lib --dest music/mock/out --state /tmp/mock-state.json \
  --work /tmp/mock-work --settle 0 --aac-bitrate 96k --exclude /dev/null
```

The real library: see [`tools/README.md`](tools/README.md) for the bucket, the domain, CORS, rclone, the first
sync and the schedule.

## Design notes

- Two faces: Aphesis Script (slant −12) for the title and the gloss; Special Elite for everything else, names
  with capitals included.
- Nothing solid: glyphs are brush strokes with stipple; the seek and volume lines are a brushed stroke with a
  stippled band; thumbs and the live cover are cells. Red only for the play mark and the row playing.
- Text containers are `.aph-ink`, never the ones holding red or their own cells: rows carry it except the one
  playing; the now-playing line is itself the ink element. No ancestor of that text is positioned with a z-index,
  masked, filtered or faded: the list's pane only scrolls, rows sit at `top`, and the entrance and the leaving run
  on each piece.
- WebGL: the fog and the one cover canvas, two of the three allowed.
- The fog stays calm behind each block of the explorer and the deck, and, on a wide screen, behind the whole deck
  column (one zone larger than it, as the archive does behind its column): ten zones, plus the corners.
