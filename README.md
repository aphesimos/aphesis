# design-system

The source of truth for every screen of aphes.is. Published as a browsable reference at
https://claude.ai/artifact/3vKR9ShjBhb3MDv8giaf7i (private until shared); this branch keeps the same files.

- `system/README.md`: the rules (principles, content, color, type, brush, stipple, simulacra, icons, seal, motion, interaction, layout). Read it first.
- `system/tokens.json`: every token, per theme.
- `system/components/bundle.js` and `bundle.css`: the runtime every screen loads (`window.Aphesis`): brush, stipple, icons, seal, Fog, Simulacrum, Typist, tooltip, cursor, letter wave. `index.d.ts` documents the API.
- `system/components/<Name>/`: guidelines and a live preview per component.
- `system/assets/`: the φ, the icons as SVG, the simulacra density maps.
- `system/fonts/`: the current Aphesis Script sample (replaced when the `font` branch delivers the full family).
- `tools/bundle_src.js`: the bundle before the φ path is inlined; `tools/simulacra/`: how the density maps were made.
