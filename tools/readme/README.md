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
- the density maps from `design-system` (`system/assets/Simulacra/`).

```bash
python3 tools/readme/make_readme_svgs.py --tokens <tokens.json> --aphesis <AphesisScript-VF.ttf> --elite <SpecialElite.ttf> --maps <Simulacra/> --out assets/readme
```

Then copy each branch's images into that branch's `assets/readme/`. Greek glosses are left out while the font lacks
the glyphs; the script says which. Run it again when the Greek extension lands.
