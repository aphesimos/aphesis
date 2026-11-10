# design-system

The source of truth for every screen of aphes.is. Being written now; this branch starts with the brush and
icon generator and will receive the tokens, rules and component references.

- `src/brush-icons.js`: `brush()` turns a centerline into a tapered, hand-wobbled outline; `stipple()` fills a
  region with small deterministic squares. The icons (eye, sol · luna, terminator, threshold) are built from both.
