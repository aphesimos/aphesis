The sound of aphes.ist: one ambient, generative voice per screen, synthesized in Web Audio with no audio files, and the ear that silences it.

- **Start** it once at load: `Aphesis.Sound.start({ fade: 7000 })`. On the home, start it as the φ begins to draw, with `fade` about the length of the drawing, so the sound creeps in underneath it. A visitor who muted it on an earlier visit stays muted, and nothing is created.
- **Mount the ear** next to the eye in the bottom-left corner: `Aphesis.Sound.ear(button)`. It takes a `<button>`, or creates one inside the element it is given. It sets `aria-label="sound on/off"`, `aria-pressed` (true while listening), `data-tip` (`listening · close the ear` / `silent · open the ear`) and `data-cursor=".55"`. Being a real button, Enter and Space toggle it.
- **Change the voice** on every route change: `Aphesis.Sound.scene(name, { transition, chamber })`. The voices are `home`, `book`, `experimental`, `archive`, `laboratory`, `works`, `wall`, `forum` and `music`. The page never reloads, so neither does the sound: the new voice crossfades in over `transition` ms (3600 by default, `duration-voice`) on a second fixed set of nodes, with a soft swell (`passage`). In experimental, pass `chamber` as a number (0 the door, 1 to 9) or as an id (`door`, `ouroboros`, `hands`, `scholar`, `tablet`, `fortune`, `veil`, `alchemist`, `sky`, `ending`).
- **Mark moments** with `Aphesis.Sound.event(kind)`: `door` (a door opens), `coalesce` and `dissolve` (a picture arrives or leaves), `impact`, `turn` (a leaf of the book), `shift` (the eye's theme change), `swell` and `passage`. Every event is played in the key of the voice that is sounding. `Simulacrum` calls `coalesce` and `dissolve` on its own (pass `sound: false` to keep one silent), and `themeShift` calls `shift`.
- **Duck** under something that must be heard: `Aphesis.Sound.duck(0.05, 1500)` lowers everything over 1.5 s, and `duck(1)` brings it back. Any `<audio>` or `<video>` that plays in the page ducks the ambience to 0.05 by itself, and it returns when the media pauses or ends. A player built on its own Web Audio graph calls `duck` itself. In the `music` section, the voice is already almost silent.
- **Mute** with `Aphesis.Sound.mute(true | false)` (or no argument, to toggle), and read it from `Aphesis.Sound.muted`. The fade takes 1.2 s (`duration-hush`) and is never a cut. The choice is kept in `localStorage` (`aphesis.sound`), with every access wrapped in try/catch.

## Autoplay

1. `start()` creates the context and asks it to `resume()`. Where the browser allows it (Chrome, for a site the visitor has played media on), it runs at once and fades in over `fade`.
2. Otherwise it stays suspended, and the first gesture of any kind wakes it and fades it in: `pointerdown`, `mousedown`, `keydown`, `touchend` or `click`, anywhere, the inscription's links included. There is no prompt and no "click to enable".
3. When the page is hidden, the sound fades out over about 1.6 s and the context sleeps. When it is shown again, the context wakes and fades back in over about 2.4 s. If the browser will not wake it without a gesture, the next gesture does.
4. Muted, the sound fades out and the context sleeps, and no gesture wakes it. A muted visitor's first click on the ear creates the context, inside that click.

## Mobile Safari

- The context unlocks inside `touchend`, `click` and `pointerdown`, and a silent one-sample buffer is played inside the gesture, which older iOS versions need.
- **The silent switch silences it.** Where Safari supports `navigator.audioSession`, the session type is set to `ambient`, so the ringer switch mutes the sound and it mixes with any other audio on the phone instead of stopping it. Where Safari does not support it, Web Audio still follows the switch. This is deliberate: the sound is ambience, never a reason for a phone to make noise in a silent room.
- iOS suspends or interrupts the context when the tab goes to the background or a call comes in. On return, the sound tries to resume; if iOS refuses, the next touch resumes it.

## The voices

All voices are one family: a triangle pair and two sine pairs, each pair detuned so that it beats; a bed of pink noise through a swaying band; sparse soft harmonics drawn from the voice's mode; and a shared room (a 2.8 s convolution). Their slow movements (cutoff, breath, band, width, the drift of the beating) are oscillators at the fog's drift rate, .013 Hz, times φ⁰ to φ⁴. Because those rates are incommensurate, the sound never repeats. The pointer brightens the sound a little toward the top of the screen and leans it toward the pointer's side.

| voice | root · mode | texture |
|---|---|---|
| home | D · open fifth, dorian pentatonic | the fog's breath, harmonics every 5–6 s |
| book | F · major, a third and a twelfth | warm, a papery noise; `turn` for leaves |
| experimental | C♯ · phrygian, a minor second beating | a slow heart; each chamber lower, rougher and darker, the ending a fourth down and darkest |
| archive | A · aeolian | deep and far, long sparse harmonics, much room |
| laboratory | G · whole tone | dry: little beating, little room, a clock ticking and a slow pulse |
| works | E · lydian | open fifths and a major tenth, harmonics often |
| wall | B♭ · suspended | thin drone, a lot of wind breathing in gusts |
| forum | F♯ · dorian | rough beating like many voices, a murmur, frequent small harmonics |
| music | D · drone only | almost nothing, so a track can play over it |

## Limits

- **Level:** a voice sits around −30 dBFS RMS with peaks near −20 dBFS, through a gentle compressor, a limiter at −4 dBFS and a high shelf at −9 dB from 3.5 kHz. Nothing reaches 4 kHz.
- **Nodes:** a fixed graph of about 100 nodes, built once: two voice players, one event voice, five slow oscillators, the room and the master. No node is created per note or per frame. The only per-frame work is the ear's breathing (a level read every fourth frame), and it stops while the sound is muted or hidden.
- **Analysis:** `Aphesis.Sound.render(seconds, { scene, chamber, timeline })` renders the same engine on an `OfflineAudioContext`, for checking levels, spectra and transitions without listening. The sound lab (`preview.html`) plays every voice and event, with a level meter drawn in stipple.
