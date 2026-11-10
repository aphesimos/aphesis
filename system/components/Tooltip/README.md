The site's own tooltip: waits 420 ms, appears beside the pointer and types its text quickly.

- **Provide** `data-tip="..."` on any element. Call `Aphesis.tooltip()` once per document.
- **Use** for translations of passages and glosses, icon names, and short explanations of a control.
- **Don't** use the `title` attribute anywhere. A tooltip never holds the only copy of information a person needs: pair it with an `aria-label`.
