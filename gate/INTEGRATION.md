# Integrating the gate into the shell

For whoever owns the one-page shell on `site`. The gate is built like every section (`gate/build.py --fragment`),
but it has no name in the inscription and no route: the shell opens it when an entrance dispatches `aph:entrance`.
Everything below is in [`integration.patch`](integration.patch), made against `site` at `7ad240e` and tested on a
scratch build with the content service, the wall and the forum running locally. Apply it, or make the same changes
by hand where the shell has moved on.

## 1. `site/build.py`

1. **The section, hidden.** One entry at the end of `SECTIONS`:

   ```python
   # the owner's gate and desk: no name in the inscription, no route; the shell opens it on an `aph:entrance` event
   dict(id='gate', name='', gl='', desc='', hidden=True),
   ```

2. **No inscription entry.** The nav skips it: `... for s in SECTIONS if not s.get('hidden')`.
3. **The shell knows it is hidden.** `/*__SECTIONSJS__*/` carries the flag:
   `dict(id=s['id'], name=s['name'], hidden=bool(s.get('hidden')))`.
4. **The entrances.** A function beside `build_section` that runs section/gate's own build for its entrance script,
   on a `git archive` of the branch, as sections are built:

   ```python
   def entrances(ref):
       with tempfile.TemporaryDirectory() as tmp:
           tarfile.open(fileobj=io.BytesIO(git('archive', ref, 'gate', binary=True))).extractall(tmp, filter='data')
           out = os.path.join(tmp, 'entrances.js')
           subprocess.run([sys.executable, os.path.join(tmp, 'gate', 'build.py'), '--entrances', out], check=True,
                          env=dict(os.environ, GIT_DIR=GIT_DIR), cwd=tmp, capture_output=True)
           return open(out, encoding='utf-8').read()
   ```

   and in `build()`: `.replace('/*__ENTRANCES__*/', entrances(refs.get('gate', 'section/gate')))`.
5. **The content service's address**, for archive, book, works and the gate: `--content-api URL` sets
   `APHESIS_CONTENT_API` in the environment before the sections are built (each section's build reads it; the
   environment already passes through `build_section`).

## 2. `site/src/shell.html`

A third script after the shell's, so the entrances find the passage and the seal already in place:

```html
<script>
/*__ENTRANCES__*/
</script>
```

## 3. `site/src/shell.js`

1. **No route for hidden sections.** `NAMES` leaves them out, so `#gate` is the home like any unknown hash:

   ```js
   const NAMES = SECTIONS.filter((s) => !s.hidden).map((s) => s.id);
   const HIDDEN = new Set(SECTIONS.filter((s) => s.hidden).map((s) => s.id));
   let gateOpen = false;
   ```

2. **`readRoute()`** answers `'gate'` while it is open: first line `if (gateOpen) return 'gate';`.
3. **Opening and closing**, next to the `hashchange` listener:

   ```js
   addEventListener('hashchange', (e) => { if (!e.isTrusted && gateOpen) return; gateOpen = false; /* ...as before */ });
   addEventListener('aph:entrance', () => {
     if (!APH_SECTIONS.gate || gateOpen) return;
     gateOpen = true; prevHash = location.hash;
     try { history.pushState({ aphGate: 1 }, '', location.href); } catch (_) { /* a sandbox may refuse */ }
     goTo('gate');
   });
   addEventListener('popstate', () => { if (gateOpen && !(history.state && history.state.aphGate)) { gateOpen = false; goTo(readRoute()); } });
   addEventListener('aph:gate-close', () => { if (!gateOpen) return; gateOpen = false; goTo(readRoute()); });
   ```

   Any `via` opens it: `ritual`, `phrase` and `route` (from the entrance script), `door` (experimental's tenth door,
   on section/experimental). The gate opens over wherever the visitor is and adds one history entry, so Back closes
   it; the seal, Escape (at the gate, which dispatches `aph:gate-close`) and any new address close it too. The
   `!e.isTrusted` guard keeps the shell's own synthetic `hashchange` (dispatched by `wake()` for other sections) from
   closing the gate.
4. **The seal** clears it: `gateOpen = false;` at the start of the seal's click handler.
5. **A nameless title.** In `goTo()`: `document.title = sec.name ? sec.name + ' · aphes.ist' : 'aphes.ist';` (the
   announcement is then empty).
6. **Waking a hidden section** follows no address: at the top of the address part of `wake()`:

   ```js
   if (HIDDEN.has(ctx.name)) { dispatchEvent(new Event('resize')); focusIn(ctx); return; }
   ```

   Without it, `wake()` dispatches a `hashchange` for the gate and the shell closes it again.

Nothing else changes: the gate runs in the same sandbox as every section (scoped `Fog`, `seal`, `cursor`, `tooltip`,
`Simulacrum`, `Sound`), rests and wakes like them, and holds the fog and at most two simulacra (the archive figure's
and the book or work preview's).

## 4. The entrances, as the shell sees them

`entrances.js` (section/gate) only dispatches `aph:entrance`; it needs `#aph-passage`, `#aph-ptext` and `#aph-seal`
as the shell has them.

- **The ritual.** Clicks, taps or Enter/Space on the passage (it gives the passage `tabindex="0"` when it has none:
  the passage has a tooltip, so a keyboard user can now read it too). Its text stutters by a pixel or two on the
  8 fps tick (`left`/`top` on `#aph-ptext`, no transform). After three, for 12 s, `body.aph-ritual` lets the seal's
  box take the pointer at home (the shell sets `pointer-events: none` on the centred seal), and holding the φ for
  7 s fills it with stipple on a canvas (`#aph-fill`, fixed, `z-index: var(--z-seal)`), then lets go. The click
  that ends the hold is swallowed, so it does not also lead home. Holding Enter on the focused seal works the same.
  The script adds a small stylesheet: `-webkit-touch-callout: none` and `user-select: none` on the seal (so a long
  press on a phone raises no menu), and the `.aph-ritual` rule.
- **The phrase** listens to `keydown` on the window, outside fields.
- **The route** checks `location.hash` on load and on `hashchange`, and replaces a match with `#home` before it
  dispatches.

## 5. Build inputs and the deploy

| input | what | where it comes from |
| --- | --- | --- |
| `--content-api URL` (or `APHESIS_CONTENT_API`) | the content service, read by archive, book, works and the gate | `https://content-api.aphes.ist` (a repository variable is enough: it is public) |
| `APHESIS_GATE_PHRASE` | the phrase typed anywhere (at least 8 characters; a few words) | a GitHub secret; never in the repository |
| `APHESIS_GATE_ROUTE` | the secret route, as typed after `#` (at least 8 characters) | a GitHub secret; never in the repository |
| `APHESIS_GATE_SALT` | optional: a fixed salt (32 hex), so rebuilds give the same page | a GitHub secret; random per build when absent |

Only PBKDF2-SHA256 hashes of the phrase and the route reach the page (60,000 iterations, the salt beside them, and
the phrase's length so one hash is computed per key). Without the two variables those two entrances do not exist;
the ritual and the door still do.

Since `site/index.html` is committed and published as it is, the safest deploy builds the page in the workflow from
the secrets, rather than committing a page that carries the hashes. A step for `.github/workflows/deploy.yml`,
before the publish (with `fetch-depth: 0`, so the build can read the section branches):

```yaml
      - name: Build the page with the gate's entrances
        env:
          APHESIS_CONTENT_API: ${{ vars.CONTENT_API }}
          APHESIS_GATE_PHRASE: ${{ secrets.GATE_PHRASE }}
          APHESIS_GATE_ROUTE: ${{ secrets.GATE_ROUTE }}
          APHESIS_GATE_SALT: ${{ secrets.GATE_SALT }}
        run: |
          for b in design-system mark section/book section/experimental section/archive section/laboratory \
                   section/works section/wall section/forum section/gate; do git fetch --depth=1 origin "$b:$b"; done
          python3 site/build.py
```

Locally, the same with the variables exported (placeholders here, never the real ones):

```sh
APHESIS_CONTENT_API=https://content-api.aphes.ist APHESIS_GATE_PHRASE='<the phrase>' APHESIS_GATE_ROUTE='<the route>' \
  python3 site/build.py
```

## 6. The content service and cookies

The desk talks to `content-api.aphes.ist` with credentials; its session cookie is `SameSite=Strict` on that host,
which is the same site as `aphes.ist` and `www.aphes.ist`, so the desk works there. On `aphesist.pages.dev` (another
site) the browser keeps the cookie back and the gate cannot open: use the real domain. The origins are the content
service's `ALLOWED_ORIGINS` (backend/README.md on `backend`).

## 7. The design system

The gate's eye is the design system's `Aphesis.Eye` (`design-system` at `93ca2db` or later). The shell already
takes `bundle.js` from `design-system`, so a build after that commit carries it; nothing else is needed.

## 8. Optional

- A voice for the gate in the design system's `Aphesis.Sound` `VOICES` (`gate`); until then `Sound.scene('gate')`
  falls back to the home's voice.
- `KEEP_CLASSES` needs nothing: the ritual's class is on `<body>`, which the shell does not stash per section.
