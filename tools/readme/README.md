# README images

`make_readme_svgs.py` draws every animated SVG used by the READMEs of this repository, in both themes, from the design
system's own sources. GitHub shows them as images: SMIL and CSS animation run, scripts do not, so the two faces are
embedded as subsets of only the characters each image uses.

Inputs:
- `tokens.json` from `design-system` (`system/tokens.json`);
- `marks.json` (here): the brush icons and the φ, exported from `system/components/bundle.js` with
  `node -e "global.window={};global.matchMedia=()=>({matches:false,addEventListener(){}});require('./bundle.js');const A=window.Aphesis;const o={phi:A.PHI};[['eye0','eye',0],['eye1','eye',1],['sol','sol',0],['luna','luna',0],['term0','terminator',0],['term1','terminator',1],['thr0','threshold',0],['thr1','threshold',1]].forEach(([k,n,s])=>o[k]=A.ICONS[n](s));require('fs').writeFileSync('marks.json',JSON.stringify(o))"`;
- `AphesisScript-VF.ttf` from `font` (`dist/variable/`);
- Special Elite (Apache 2.0) from Google Fonts;
- the density maps from `design-system` (`system/assets/Simulacra/`);
- `engine_frames.json` (here): the φ as the brush engine draws it on the home, one outline per frame. The hero and the
  `mark` image play these frames back, so the README shows exactly the site's gesture: the stem rising from its tip at
  the bottom, then the ring swept around to the free end. To record it again from a checkout of `mark`:
  `node tools/readme/engine_frames.js <mark>/engine 30 && python3 tools/readme/simplify_frames.py 0.7`, then add
  `"bbox": [173, 45, 829, 955]` (the φ's box in engine units) to the result.

```bash
python3 tools/readme/make_readme_svgs.py --tokens <tokens.json> --aphesis <AphesisScript-VF.ttf> --elite <SpecialElite.ttf> --maps <Simulacra/> --out assets/readme
```

Then copy each branch's images into that branch's `assets/readme/`. Greek glosses are left out while the font lacks
the glyphs; the script says which. Run it again when the Greek extension lands.

## Checking every frame

A single screenshot only shows one moment. Before committing, pause each image at several moments and look at them:

```bash
(cd assets/readme && python3 -m http.server 8767) &
node tools/readme/qa_frames.js hero-dark,hero-light,mark-dark   # writes qa/<name>-<seconds>.png
```

`qa_frames.js` pauses both timelines (SMIL with `setCurrentTime`, CSS with the Web Animations API) at 0.4, 1.2, 2.2,
3.6, 6, 9 and 12.4 seconds.
