/* .aph-ink marks the containers of plain text (no seal, no red, no ground of their own): while the eye's wave
   runs, the runtime blends them by difference so the text reads over the old ground and the new. The bench's
   specimen, plot and controls carry red and stay out of it.

   the two screens of the laboratory: the index, an inscription of experiments, and one experiment as a page.

   An experiment page reads its content file (EXPERIMENTS, from content/*.md): the gloss over the title, then the
   sections of its body in order. `hypothesis` and `method` are text; the bench (the live piece) stands after the
   method; `result` holds {placeholders} that the experiment's module fills with what it measures, live. Any other
   section (`notes`, say) follows the result as text. */

const A = window.Aphesis;
/* the site's texts: the owner's version of a line where the site has one (the shell's Aphesis.text), else this one */
const T = (key, own) => (A.text ? A.text(key, own) : own);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const no = (e) => String(e.order).padStart(2, '0');
const lang = (s) => (/[Ͱ-Ͽἀ-῿]/.test(s) ? 'grc' : 'la');

export function indexView(list) {
  const items = list.map((e) => `
    <li><a class="entry aph-wave" href="#laboratory/${esc(e.slug)}" data-zone="14">
      <span class="entry-no aph-meta num">no. ${no(e)}${e.example ? ' · example' : ''}</span>
      <span class="entry-name aph-label">${esc(e.title)}</span>
      <span class="entry-gloss aph-gloss" lang="${lang(e.gloss)}">${esc(e.gloss)}</span>
      <span class="entry-sum aph-meta">${esc(e.summary)}</span>
    </a></li>`).join('');
  return `
  <header class="head aph-ink" data-zone="20">
    <p class="gloss-title aph-gloss" lang="la">officina</p>
    <h1 class="title aph-display">laboratory</h1>
    <p class="lede">${esc(T('laboratory.lede', 'measured experiments. each one states what i expect, says how i measure it, runs here in your browser, and reports what it found, whatever it finds.'))}</p>
  </header>
  <nav class="aph-ink" aria-label="experiments"><ol class="inscription">${items}</ol></nav>`;
}

const HEAD = { hypothesis: 'hypothesis', method: 'method', result: 'result' };

export function experimentView(e, list) {
  const i = list.indexOf(e), prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  const sec = (s) => `
    <section class="part part-${esc(s.name)} aph-ink" aria-labelledby="h-${esc(s.name)}">
      <h2 class="heading aph-display" id="h-${esc(s.name)}">${esc(HEAD[s.name] || s.name)}</h2>
      ${s.paras.map((p) => `<p data-zone="14">${p}</p>`).join('')}
    </section>`;
  const parts = e.sections.map((s) => {
    const html = sec(s);
    return s.name === 'method' ? html + `
    <section class="part part-bench" aria-labelledby="h-bench">
      <h2 class="heading aph-display aph-ink" id="h-bench">the bench</h2>
      <div class="bench"></div>
    </section>` : html;
  }).join('');
  return `
  <article class="exp">
    <a class="back aph-label aph-wave aph-ink" href="#laboratory" data-zone="10"><span class="back-name">laboratory · officina</span></a>
    <header class="head aph-ink" data-zone="20">
      <p class="gloss-title aph-gloss" lang="${lang(e.gloss)}">${esc(e.gloss)}</p>
      <h1 class="title aph-display">${esc(e.title)}</h1>
      <p class="aph-meta num">no. ${no(e)}${e.example ? ' · example' : ''} · ${esc(T('laboratory.live', 'measured live in this browser'))}</p>
    </header>
    ${parts}
    <nav class="turn aph-ink" aria-label="other experiments">
      <a class="aph-wave" href="#laboratory/${esc(prev.slug)}" data-zone="10"><span class="aph-meta">before</span> <span class="turn-name aph-label">${esc(prev.title)}</span></a>
      <a class="aph-wave" href="#laboratory/${esc(next.slug)}" data-zone="10"><span class="aph-meta">after</span> <span class="turn-name aph-label">${esc(next.title)}</span></a>
    </nav>
  </article>`;
}

/* the letter wave on every name a person can choose */
export function wave(root) {
  root.querySelectorAll('.entry-name, .back-name, .turn-name').forEach((n) => A.letters(n));
}

/* fill a page's {placeholders}; a value that changes arrives softly */
export function filler(root) {
  const spots = {};
  root.querySelectorAll('[data-v]').forEach((s) => { (spots[s.dataset.v] = spots[s.dataset.v] || []).push(s); });
  return (values) => {
    for (const k in values) (spots[k] || []).forEach((s) => {
      if (s.textContent === values[k]) return;
      s.textContent = values[k];
      /* a soft arrival, at most once a second, so a counter that runs does not stay blurred */
      const now = performance.now();
      if (now - (s._t || 0) < 1000) return;
      s._t = now; s.classList.remove('fresh'); void s.offsetWidth; s.classList.add('fresh');
    });
  };
}
