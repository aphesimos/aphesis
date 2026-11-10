# Plan

1. **Structure** (done as a prototype): home, navigation, continuous transitions. Lives on `site`.
2. **Design system** (first version done; https://claude.ai/artifact/3vKR9ShjBhb3MDv8giaf7i): colors, type, icons, cursor, tooltip, typist, motion, brush and stipple rules,
   stipple images. Lives on `design-system`.
3. **Font**: Aphesis Script, full lowercase family with alternates and kerning, every mark drawn with the brush.
   Lives on `font`.
4. **Sections**, one screen at a time, each following the design system:
   - **book** · *liber*: authors, works and what shaped the author, leafed through like a codex.
   - **descent** · *κατάβασις* (first called experimental, branch `section/experimental`): a door and nine chambers, a journey down and back; symbols, motion, stipple images, no explanation.
   - **archive** · *codex*: the blog, from draft (nigredo) to finished (rubedo).
   - **laboratory** · *officina*: measured experiments.
   - **works** · *opera*: finished projects.
   - **wall** · *paries*: anonymous messages floating in the fog.
   - **forum** · *ἀγορά*: a basic anonymous imageboard.
5. **Scope** of each section: [`docs/sections.md`](sections.md).
6. **Later**: further sections from the research survey, to be scoped once the above exist.

## Open items

- Pause control for long animations (WCAG 2.2.2): clicking the passage could pause all motion.
- Rename the Portuguese identifiers in the brush engine when it moves into `mark`.

Waiting items are tracked in [`docs/backlog.md`](backlog.md).
