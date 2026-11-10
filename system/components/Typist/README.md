Types text the way a person does: rhythm, typos noticed and fixed, a rethought word, and an erase that speeds up like a held delete key.

- **Provide** a text element and an optional caret element (`<span class="aph-caret">`). `new Aphesis.Typist(el, caret)` has `type(text, done)`, `erase(done)`, `loop(lines, hold, onLine)` and `stop()`. Lines may be strings or `{text, ...}`.
- **Use** for the passage in the bottom-right corner, chamber inscriptions, forum and wall posts as they arrive.
- Put the full text in a visually hidden element for screen readers; the typed element is `aria-hidden`.
- Reduced motion shows the text whole.
