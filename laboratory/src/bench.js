/* the bench: the frame every live piece stands in, so each experiment only writes its own science.

     const b = bench(host);       // b.specimen (left, or on top on a phone), b.plot, b.controls
     const cv = b.canvas('organism', 'aria text');   // a canvas in the specimen, invisible until drawn
     b.caption('...');            // a meta line under the specimen
     b.button('begin again', () => {}, 'tooltip');   // a text control with a brushed underline

   Nothing here has a border or a fill: the parts are grouped by space, and each is a calm zone in the fog. */

const A = window.Aphesis;

export function bench(host) {
  host.innerHTML = '<div class="bench-grid"><div class="specimen" data-zone="36"></div>' +
    '<div class="plot" data-zone="44"></div></div><div class="controls" data-zone="12"></div>';
  const specimen = host.querySelector('.specimen'), plot = host.querySelector('.plot'), controls = host.querySelector('.controls');
  let cap = null, seed = 300;
  return {
    specimen, plot, controls,
    canvas(cls, label) {
      const c = document.createElement('canvas');
      c.className = 'cv ' + (cls || '');
      if (label) { c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); } else c.setAttribute('aria-hidden', 'true');
      specimen.appendChild(c);
      return c;
    },
    caption(text) {
      if (!cap) { cap = document.createElement('p'); cap.className = 'specimen-cap aph-meta num'; specimen.appendChild(cap); }
      cap.textContent = text;
      return cap;
    },
    button(text, fn, tip) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'act aph-label aph-wave'; b.setAttribute('aria-label', text);
      if (tip) b.dataset.tip = tip;
      const name = document.createElement('span'); name.className = 'act-name'; name.textContent = text;
      const u = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      u.setAttribute('aria-hidden', 'true'); u.setAttribute('viewBox', '0 0 100 6'); u.setAttribute('preserveAspectRatio', 'none');
      u.innerHTML = '<path class="t-accent" d="' + A.brush(A.line(2, 3, 98, 3.4, 40), 1.6, ++seed, 0.4, 0.08) + '"/>';
      b.append(name, u);
      A.letters(name);
      b.addEventListener('click', fn);
      controls.appendChild(b);
      return b;
    },
  };
}
