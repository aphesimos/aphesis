# gate

The owner's door and desk. A section of the one page with no name in the inscription and no address: the shell
mounts it when an entrance dispatches `aph:entrance` (see [INTEGRATION.md](INTEGRATION.md)). Behind it, the desk
writes archive posts, book entries and works, and moderates the wall and the forum, through the content service
(`backend/content` on the `backend` branch). Built from the backlog's spec (`docs/backlog.md` on `main`, "The owner's
dashboard and its gate").

## The gate

**Step 1.** The eye, the design system's `Aphesis.Eye` (components/Eye on `design-system`): the theme switch's eye (the shell's `EYE` and `Aphesis.ICONS.eye`: two brushed lids and a
stippled iris; closed, one lid and three lashes), stands above a single brushed baseline. No label, no word. The
typewriter's underscore blinks on the line as the caret; each character of the password lands on it as a grain of
stipple, the design system's masked text (`Aphesis.grain`: 14 px, 4 px apart, shrinking to 7 px only when a long
password would leave the line), the group centred on the line and growing outward from
the middle, the caret at its right end; Enter sends it. Nothing can leave the line: each line holds
as many characters as fit its width at the smallest grains (32 on a 360 px phone, 35 at 390 px, 43 on a desktop;
the words' line about 30), its input takes no more (maxlength, a paste is cut), and a key past the end only makes the line shiver once.

- **It draws itself first**, stroke by stroke, the way the φ draws itself on the home: the upper lid, the lower
  lid, then the iris cell by cell (continuous, 2.1 s).
- **Then it never stops trembling**: on a tick of 125 ms (8 fps) its strokes are redrawn from one of three drawings
  of the same state, each with its own brush seeds, and the feTurbulence seed is swapped, as the seal's boil does.
- **It dominates the gate**: about 44% of the screen's smaller side, on a phone too, drawn at the size it is shown
  (brush widths, boil and stipple cells of about 3 CSS px follow the size; it is drawn again when the size changes).
- **Blinks are frame by frame**: open, half (the upper lid lowered), closed (lid and lashes),
  squint, and wide. Each is its own drawing, cut to on a tick and held for whole ticks; a blink is
  half · closed · closed · half, sometimes doubled, sometimes slow, now and then a held squint, at irregular
  intervals (a log-normal spread around 4 s). Every drawing has one upper lid and nothing beneath it: the three
  paths (lids, iris, pupil) are replaced whole on each cut.
- **The gaze is its own track**: centre, left, right, up, down, the four diagonals, a narrowed pupil and a dilated
  one, each a stipple drawing cut to each blink's opening. It moves in saccades (a cut, then a hold of irregular
  length), sometimes follows the pointer or the caret, glances at the line while the owner types, and once in a
  while looks straight out. Because the tracks are independent, a blink lands on any gaze.
- **Wrong:** a hard cut to the closed lid (with a narrowed pupil after), and the line trembles: a hard offset of a
  few pixels each tick for seven ticks.
- **Right:** a cut to wide open with a dilated pupil, held for a second, then the eye and its line dissolve into
  stipple (a mask of 2 px cells going out a share per tick).

**Step 2.** A new baseline condenses out of the same cells. No word at all. The three Latin words from the mail
(any case, any separator), Enter. Wrong: the line trembles. Right: the line goes back into the fog and the desk
enters.

Every refusal looks the same, on either step, whatever the reason (wrong, expired, spent, locked): the server answers
all of them alike. A session still open (two hours) goes straight to the desk. Escape at the gate closes it.

## The desk

`desk`, with its gloss *scriptorium*, and one line of places: archive · *codex*, book · *liber*, works · *opera*,
moderation · *custodia*, texts · *verba*, and `leave` (which ends the session; the eye draws itself again).

- **archive**: every post, drafts too, with its stage icon, date and state. The editor: title, slug (the address,
  `#archive/<slug>`), summary, stage (the four stage icons), date, example, the markdown body, its notes (`[^id]`
  in the text, their words beside), and figures (a picture becomes a density map in the browser, by the forum's
  rules, and goes up; the body gets its `![caption](simulacrum:name)` line). Beside it, the live preview: the
  archive's own `render.js`, `stage-icon.js`, `marks.js` and `figure.js`, under the archive's own stylesheet
  (scoped to the preview by the build), so the post is drawn exactly as the archive will draw it, figures as
  simulacra. Save, publish or unpublish, delete (it asks once more, in the line).
- **book** and **works**: the same pattern, with the picture turned into a density map in the browser and previewed
  as a simulacrum with the entry's own settings (gain, scatter, erosion, ceiling; for the book also crop, blur,
  contrast and brightness, applied as the book applies them), beside its words. Works also take their links.
- **moderation**: the wall's lines, the forum's reports and threads; a thread opens to its posts; each can be removed
  (the first post removes the thread). The content service calls the wall and the forum server to server; no
  admin secret is in the page. **The owner writes here too**, as *aphesist*: a line on the wall (Enter), a new
  thread, and a reply under the open thread (Ctrl or Cmd + Enter). The content service passes them on with the
  wall's and the forum's admin secrets, which is what marks them as the owner's on the site (the live eye and the
  name in place of a sigil); nothing the page sends could. In the lists the owner's own lines, threads and posts carry
  a still eye and the name as the wordmark writes it, *aφesist*, in the eye's red, before their words ("aphesist, the owner" for assistive technology).
- **texts**: the site's texts, the short lines the owner changes without a rebuild (the home's line for each
  section, the ledes, the helper lines, the empty states), grouped by screen. Each key shows its value now, a field
  to change it (one line; Enter saves), a preview line in the face it is read in, and `reset to default`. Saved
  through the content service (`/v1/admin/texts`); the page reads them on its next load, and keeps its own strings
  whenever the service does not answer. The first group, `link preview` (`meta.title`, `meta.description`), is what
  a shared link to aphes.ist shows in discord, imessage, whatsapp, slack or x: the site's Pages worker writes them
  into the served page's `og:` tags, within five minutes of a save (each app keeps its own copy for a while).
- **On a phone**, one column, with a choice between `write` and `read` for the editor and its preview.

Nothing is solid: fields are words on a brushed baseline, buttons are labels whose brushed underline draws in,
choices put the chosen one in accent. The desk is a scrolling column with no stacking context around its ink.

## Entrances

`src/entrances.js` is loaded by the shell (not by this page); every entrance only dispatches `aph:entrance`:

- **The ritual**: three clicks or taps on the passage in the bottom-right corner, each within 1.6 s (its text
  stutters slightly at each), then, within 12 s, hold the φ for 7 s: it fills with stipple, then lets go. Pointer,
  touch, or Enter held on the focused seal. Without the three clicks the seal is only the seal.
- **A phrase typed anywhere** (desktop), outside fields.
- **A secret route**: `#<route>`, a bookmark; it is taken out of the address bar.
- **The tenth door**: experimental dispatches the same event (`via: 'door'`), on section/experimental.

A wrong or partial attempt does nothing visible. The phrase and the route are never in the page: the build hashes them
(PBKDF2-SHA256, 60,000 iterations, its own salt) from `APHESIS_GATE_PHRASE` and `APHESIS_GATE_ROUTE`; how to set
them for the deploy is in INTEGRATION.md. Placeholders only, here and everywhere.

## Build

```sh
python3 gate/build.py                               # gate/index.html, against no service (the gate refuses everything)
python3 gate/build.py --content-api URL             # against a content service (or APHESIS_CONTENT_API)
python3 gate/build.py --mock                        # a demo answering from memory: password "solve et coagula",
                                                    #   words "ignis lapis aurum" (never deployed)
python3 gate/build.py --fragment OUT                # for the shell
APHESIS_GATE_PHRASE='<phrase>' APHESIS_GATE_ROUTE='<route>' python3 gate/build.py --entrances OUT
```

It reads with git: the design system (tokens, runtime, font), `section/archive` (`render.js`, `stage-icon.js`,
`marks.js`, `figure.js`, `archive.css`), `section/forum` (`density.js`), and for `--mock` the archive, book and works
content. Each ref falls back to `origin/<ref>`. Special Elite is vendored in `vendor/`.

| module | what it does |
| --- | --- |
| `config.js` | what the build decided: the API's address, mock or not |
| `api.js` | the content service with credentials; the CSRF token lives only in its closure |
| `mock.js` | the same answers from memory, for `--mock` only |
| `eye.js` | the gate's use of `Aphesis.Eye`: a refusal is a held cut to closed, the key a held cut to wide |
| `line.js` | the baseline, the caret, the grains or words, the tremble, and the stipple dissolve and condense |
| `ui.js` | the desk's small parts: fields, buttons, choices |
| `ed-archive.js` | posts, with the archive's own preview |
| `ed-entries.js` | book entries and works, with the simulacrum preview |
| `moderation.js` | the wall and the forum |
| `ed-texts.js` | the site's texts: every key by screen, edit, preview, reset |
| `dash.js` | the desk and its places |
| `main.js` | theme, fog, seal, the gate's steps, the desk |
| `entrances.js` | for the shell: the ritual, the phrase, the route |

For checks the page exposes `window.__gate` (the eye's state and every drawing it can show) and the shell page
`window.__aphEntrances` (whether the ritual is armed, which entrances exist).
