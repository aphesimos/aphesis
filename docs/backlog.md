# Backlog

Work that waits on something else. Remove an item when it is done.

## Waiting on the Greek and CJK extension of Aphesis Script (`font`)

- Re-run `tools/readme/make_readme_svgs.py` and copy the images: the home image on `site` draws its Greek glosses
  (ἄδυτον, ἀγορά) only once the font has them.
- Update `design-system/system/fonts/AphesisScript-VF.woff2` and the published design system, then remove the note
  in the Type section of its README.
- Rebuild the home prototype on `site` with the new font: the Greek glosses and Greek passages fall back to a system
  serif until then.
- Draw the passage 色即是空 in Aphesis Script; until then it falls back to a system face.
