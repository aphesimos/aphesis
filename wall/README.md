# wall · *paries*

Anonymous lines drifting in the fog. A visitor reads them, holds one still, and leaves one of their own.

## The screen

- **The ground** is the section fog (density .62, light .4), hidden until its first frame. The seal holds the top-left
  corner and leads home; the eye switches the theme from the bottom-left; the passage corner stays free.
- **The title** `wall` in Aphesis Script, its gloss *paries* above it, on the axis at the top.
- **The lines** drift between the title and the line to write in: a few at a time (3 to 9, by the size of the
  screen), single lines in Special Elite where they fit, balanced over two or three when they do not. Each has a depth:
  near lines are larger, clearer and drift a little faster; far ones are small, faint and soft. A line condenses out of
  the fog (a blur that clears and a gentle rise, minimum-jerk), drifts for 13 to 22 seconds and thins back. The fog
  calms behind each line as it condenses, so text never sits on dots.
- **Hold one:** hovering or focusing a line stops it and brings it forward (clear, full ink, a step larger).
  Escape lets a focused line go. Lines are in the tab order after the line to write in.
- **Write one:** one line, at most 140 characters, in a field with no box: a brushed baseline (red while focused) and
  the typewriter's own underscore as the caret. Enter or `send` sends it. The page checks the filter first and answers
  a refused word quietly under the baseline; the server decides. Once taken, the line lifts off the baseline and blurs
  into the fog, and condenses again among the others, near and held longer.
- **When a line does not go:** the line stays where it was written, and the voice under the baseline (a live region,
  in the accent) says why until the line is touched or sent again: a filtered word, a link, too long (140 characters),
  too fast (with the seconds to wait), the check failed or ran out of time, the wall out of reach, the wall's own
  stumble, or not open yet. `try again` follows when sending the same line again may work (the check, the network, a
  stumble). The Turnstile widget is drawn again whenever it has been lost (Turnstile forgets a widget whose box leaves
  the page, as it does each time the site puts the section aside), and its answer is renewed after every try.
- **The quiet:** while the wall holds no line, the middle of the field holds the gloss *silentium* ("silence" in its
  tooltip) and one line, "the wall is quiet. the first line is yours.", on a calm zone; it fades as the first line
  condenses.
- **The owner's lines:** a line the server marks `owner` carries the owner's mark above its words, at the line's
  depth: a small live `Aphesis.Eye` in rubedo, the gate's eye drawn as a mark (the runtime's `mark` preset; 2.4 times the words' size wide: 46px near, 30px far), trembling, blinking
  and glancing on its own, and the name as the wordmark writes it, *aφesist* (the font's upright φ, with a t), in the eye's
  own red (`accent`); for assistive technology,
  "aphesist, the owner: ...". It drifts, condenses, is held and thins like any line. Only the owner's desk can write
  one (the content service passes it on with the wall's admin token; see `backend/README.md`, *The owner's posts*),
  and nothing a visitor sends can claim it. The eyes are `shared`: one tick for the page, still while off screen.
- **No names, replies or likes**, but for the owner's mark.

## Data

`src/api.js` talks to the Worker at a configurable base URL (`build.py --api`, which writes
`<meta name="aphesis:wall-api">`; or `window.APHESIS_WALL_API`). Turnstile renders only when a site key is configured
(`--sitekey`), loads when someone starts to write, and stays invisible unless Cloudflare has to ask.

Without an API the page is a **local preview**, for working on the section: it starts empty, as a new wall does
(the same quiet), and holds only the visitor's own lines, kept in this browser's local storage. The preview says so
under the line and in the field's tooltip. It runs the same filter and a gentle limit (one line every 20 seconds).

The backend is in [`worker/`](worker/README.md): a Cloudflare Worker and a Durable Object, with the filter, the rate
limit per IP hash, Turnstile, expiry after 30 days and an admin removal endpoint.

## Files

- `build.py` builds `index.html`, one self-contained page: tokens, runtime and the Aphesis Script font read from the
  `design-system` branch with `git show`; Special Elite vendored in `vendor/` (Apache 2.0).
  `--fragment OUT` writes the page without the document shell; `--api` and `--sitekey` wire it to a live wall.
- `src/`: `main.js` (shell, theme, calm zones), `drift.js` (the lines), `composer.js` (the line to write in),
  `api.js` (data), `motion.js`, `wall.css`, `template.html`. `filter.js` is taken from
  `worker/src/filter.js`, so page and server share one filter.
- `worker/`: the backend and its tests (`npm test`).

```sh
python3 wall/build.py
python3 wall/build.py --fragment /tmp/wall.html
```
