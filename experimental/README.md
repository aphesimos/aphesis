# descent · κατάβασις

The section that was first called experimental. *Katabasis* is the journey down into the underworld and back: a red
door, and behind it nine chambers walked one at a time, each a picture made of fog and one bodily motion, with no
instructions. The branch keeps its first name (`section/experimental`), and so do this folder and its files
(`experimental/build.py`, `src/experimental.css`, the `#experimental` element): the site's build finds the section by
them. The sound engine's voice is still called `experimental` (`Aphesis.Sound.scene('experimental', {chamber})`).

## Build

```
python3 experimental/build.py                 # experimental/index.html, the section standing alone
python3 experimental/build.py --fragment OUT  # the same page without <!doctype>/<html>/<head>/<body>, for an artifact
```

The build reads the design system from the `design-system` branch with `git show` (tokens, runtime, the font and the
density maps in `system/assets/Simulacra/`), so nothing of it is copied here. Special Elite is vendored in `vendor/`.
In the one-page site, `site/build.py` runs this build on a `git archive` of the branch and keeps the markup,
`src/experimental.css` and the script.

## The journey

`src/journey.js` runs the same sequence for every chamber: the door fills with night, grows and dissolves; the
chamber's pictures coalesce (at most the two simulacra made once in `stage.js`); its motion plays; they dissolve; the
door returns. The next chamber is remembered in this browser (`localStorage['aphesis.experimental.journey'] = {next}`);
a journey left half-way is taken up where it was left.

| | chamber | picture | motion |
| --- | --- | --- | --- |
| 1 | ouroboros | Cagnacci, *Allegory of Human Life*, with a brush-drawn serpent | circle, about five times |
| 2 | hands | Michelangelo, *The Creation of Adam*: the whole panel on wide screens, the hands on phones | hold in the fingers' gap |
| 3 | scholar | Caravaggio, *Saint Jerome Writing* | hold anywhere |
| 4 | tablet | Hermes Trismegistus, Siena pavement | strike six times |
| 5 | fortune | the wheel of fortune, Siena pavement | circle, about four times |
| 6 | veil | Strazza, *The Veiled Virgin*, under a shroud of fog | drag upward |
| 7 | alchemist | Wright of Derby, *The Alchemist* | strike seven times, unhurried |
| 8 | sky | the Flammarion engraving | hold anywhere |
| 9 | ending | nothing: the fog closes in | none |

Every picture starts legible but conjured: the figure reads at once, with its lost points and holes, and the motion
brings it further (the scholar's light gathers, the alchemist's flask lights the room, the tablet rises). The chamber
ground is thin fog (density .2) so the pictures stand clear of it. The hands keep the meeting point of the fingers on
the screen's centre in both crops; the hold target is that gap, and the two fingertips glow faintly in the stipple
there, brighter while held.

## The ending

The last chamber no longer seals the door. Its field of fog closes in over eight seconds and holds for a breath;
then the record is cleared and the visitor is sent home with `location.hash = '#home'`. In the one-page site that is
the shell's own route change: the section dissolves, the seal travels back to the centre, and the section rests. The
pictures are given back just before the address changes, so nothing is woken with them. 1.5 s later (after the shell
has put the section to rest, so in fact once the visitor comes back) the door returns, open, on the first chamber:
the journey can be walked again from the start. Standing alone, the page shows the door again.

Earlier versions could leave a record that marked the journey finished; `memory.js` migrates on load: anything but a
plain `{next}` inside the journey, and the first version's `aphesis.experimental.found`, is cleared.

## The tenth door: `aph:entrance`

On the door screen, at any time, a full circle drawn around the door (the pointer or a finger travelling around its
outline, roughly 360° in either direction, between just outside the doorway and about one and a half doors away) is a
hidden entrance. It does not open the chamber; the section only announces it:

```js
window.dispatchEvent(new CustomEvent('aph:entrance', { detail: { via: 'door' } }));
```

Whoever owns what lies behind it (the owner's dashboard and its gate) listens for that event on `window`. Nothing
visible happens here, on a wrong or partial attempt or on a whole one. The detection (`src/entrance.js`) sums the
signed angle swept around the door's centre, reading coalesced pointer events, and starts over on leaving the ring, a
jump of more than 135°, a pause of more than a second or turning back by more than about 50°. A mouse counts while it
hovers; a finger or pen while it presses. Clicks, taps, Enter and Space still open the door; a press on the door that
travelled, and the click right after the entrance, do not.

## Files

- `src/main.js`: the page: theme, ground, seal, cursor, tooltip, the door and the journey.
- `src/journey.js`, `src/door.js`, `src/stage.js`, `src/gestures.js`, `src/motion.js`, `src/memory.js`, `src/entrance.js`.
- `src/chambers/*.js`: one module per chamber: `{ id, caption, label, create(ctx) }`.
- `src/template.html`, `src/experimental.css`.
