# Backlog

Work that waits on something else. Remove an item when it is done.

- Commit Aphesis Script 2.1 to `design-system` (`system/fonts/`, the Type section of `system/README.md`) and its
  README images, once the work in progress on that branch is committed. The published design system already has it.
- Commit the theme shift (`Aphesis.themeShift`, the `ThemeShift` component folder, README and `index.d.ts` changes)
  to `design-system` from `/tmp/…/scratchpad/ds` once the work in progress on that branch is committed, and have
  every section call it from the eye. The published design system and the home already have it.

## The owner's dashboard and its gate (after the Rust backend)

- **Content service:** `backend/content/`, a Rust Worker with D1. It serves archive posts, book entries and works entries. Archive, book and works load from it, with their built-in content as fallback. Edits are live with no rebuild. A nightly export writes markdown to a `content` branch, committed as the owner.
- **Dashboard:** inside the site, in its style. It writes and edits archive posts (markdown, footnotes, stage, drafts), book entries (picture upload turned into a density map in the browser) and works entries, and moderates the wall and forum (delete, reports). The live preview matches the page exactly.
- **Entrances:** all of them lead to one hidden gate, and a wrong or incomplete attempt does nothing visible.
  - The ritual: click the bottom-right passage three times (its text stutters slightly at each click), then hold the φ for 7 s (it fills with stipple and lets go). It must work on touch.
  - The tenth door: after experimental's ending, a full circle drawn around the sealed door.
  - A phrase typed anywhere (desktop).
  - A secret route (a bookmark).
  - The phrase and the route are chosen by the owner and set as configuration, never committed in clear.
- **The gate, step 1 (password):**
  - The eye icon (the theme switch's eye) sits above a single brushed baseline with no label, and the caret blinks on the line.
  - The eye first draws itself, stroke by stroke, the way the φ draws itself on the home.
  - After that it never stops trembling: its strokes boil like the seal's, redrawn at a low frame rate of about 8 fps with the same feTurbulence seed swap as the φ.
  - Its blinks are frame-by-frame, like a hand-drawn cycle, never a morph or tween. Each state is its own drawing, held for a few low-framerate frames, then cut to the next:
    - open;
    - half-lidded;
    - a closed lid with lashes;
    - an optional squint.
    The blinks come at irregular intervals.
  - **The pupil looks around.** The stippled iris and pupil have their own frame-by-frame states:
    - centre;
    - left and right;
    - up and down;
    - the four diagonals;
    - a narrowed pupil and a dilated one.
    Like the blinks, it cuts between them with no tween, at the low frame rate, in saccades: quick jumps between fixations, then holds of irregular length. It sometimes follows the pointer or the caret's position, glances at the line while the owner types, and once in a while looks straight out. Blinks and gaze are independent tracks, so a blink can land on any gaze state.
  - **Wrong password:** a hard cut to the closed state, and the line trembles.
  - **Right password:** a cut to wide open, held, then the eye dissolves into step 2.
- **The gate, step 2 (email code):**
  - The baseline dissolves and a new one condenses. There are no words at all, none of "check your email".
  - The code is three Latin words, e.g. ignis · lapis · aurum: about 33 bits, valid for 10 minutes, single use.
  - Repeated failures lock the gate for a while.
- **The email:** sent through Cloudflare's send_email binding to the owner's verified address, from aphes.ist.
  - Dark ground, the φ in red as stipple (a hosted PNG), and the three words in a typewriter face (falling back where fonts don't load).
  - No "verification code" or "if you didn't request this". The subject is a gloss, e.g. *clavis*.
- **Auth:**
  - The password is stored only as a hash. The owner generates it with a one-line command, and it goes in as a Worker secret.
  - Hashing must respect the Workers Free CPU limit, so use WebCrypto.
  - The session is a short-lived HttpOnly, Secure, SameSite cookie on the content API's subdomain.
  - There is a lockout after repeated failures.
