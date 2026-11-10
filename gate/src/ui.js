/* ui: the dashboard's small parts, in the site's hand. No boxes and no borders: a field is its words on a brushed
   baseline, a button is a label that draws its underline when it is hovered or focused, a choice is a set of
   labels with the chosen one in accent. Everything is lowercase, in the text face; titles are in the script. */

const A = window.Aphesis;
let seed = 500;

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

/* a brushed stroke, stretched to its box */
export function rule(cls = 'rule', width = 1.3) {
  const s = h('span', { class: cls, 'aria-hidden': 'true' });
  s.innerHTML = '<svg viewBox="0 0 240 6" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path fill="currentColor" d="' +
    A.brush(A.line(2, 3.2, 238, 2.8, 80), width, seed++, 0.14, 0.1) + '"/></svg>';
  return s;
}

/* a button: its label, and the underline that draws in */
export function act(label, onclick, attrs = {}) {
  const b = h('button', { type: 'button', class: 'act aph-label', 'data-cursor': '.55', onclick, ...attrs }, h('span', { class: 'act-t', text: label }), rule('uline', 1.4));
  return b;
}
export function setLabel(b, label) { b.querySelector('.act-t').textContent = label; }

/* a destructive button asks once more */
export function sure(label, onclick) {
  let armed = 0;
  const b = act(label, () => {
    if (!armed) { setLabel(b, label + ' · sure?'); b.classList.add('armed'); armed = setTimeout(() => { armed = 0; setLabel(b, label); b.classList.remove('armed'); }, 4000); return; }
    clearTimeout(armed); armed = 0; setLabel(b, label); b.classList.remove('armed'); onclick();
  });
  return b;
}

/* a field: label above, input on a brushed baseline */
export function field(label, input, hint) {
  const id = 'f' + (seed++);
  input.id = id;
  if (input.tagName !== 'SELECT') input.setAttribute('spellcheck', input.dataset.spell ? 'true' : 'false');
  return h('div', { class: 'field' + (input.tagName === 'TEXTAREA' ? ' area' : '') },
    h('label', { class: 'aph-label aph-ink', for: id, text: label }), input, rule('base', 1.2),
    hint ? h('span', { class: 'hint aph-meta aph-ink', text: hint }) : null);
}
export function text(value = '', attrs = {}) { return h('input', { type: 'text', value, autocomplete: 'off', autocapitalize: 'none', class: 'aph-ink', ...attrs }); }
export function area(value = '', attrs = {}) { const t = h('textarea', { class: 'aph-ink', autocapitalize: 'none', ...attrs }); t.value = value; return t; }

/* a choice among a few: labels, the chosen one in accent */
export function choice(name, options, value, onchange) {
  const g = h('div', { class: 'choice', role: 'radiogroup', 'aria-label': name });
  const items = options.map((o) => {
    const b = h('button', { type: 'button', role: 'radio', class: 'opt', 'data-cursor': '.55', 'aria-checked': String(o.value === value), 'data-value': o.value },
      o.icon ? h('span', { class: 'opt-i', 'aria-hidden': 'true' }) : null, h('span', { class: 'aph-gloss', lang: o.lang || null, text: o.label }));
    if (o.icon) b.querySelector('.opt-i').innerHTML = o.icon;
    b.addEventListener('click', () => { set(o.value); onchange && onchange(o.value); });
    return b;
  });
  function set(v) { value = v; items.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === v))); }
  g.append(...items);
  return { el: g, get value() { return value; }, set };
}

export function check(label, on, onchange) {
  const b = h('button', { type: 'button', role: 'switch', class: 'opt switch', 'aria-checked': String(!!on), 'data-cursor': '.55' }, h('span', { class: 'aph-label', text: label }));
  b.addEventListener('click', () => { on = !on; b.setAttribute('aria-checked', String(on)); onchange && onchange(on); });
  return { el: b, get value() { return on; } };
}

export function status(el, msg, bad) {
  el.textContent = msg || '';
  el.classList.toggle('bad', !!bad);
}

export const debounce = (f, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

export function today() { const d = new Date(); return d.toISOString().slice(0, 10); }
export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
