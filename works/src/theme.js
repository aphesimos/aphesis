/* theme: the system's setting until the eye says otherwise. Open eye = light, closed eye = dark. */

const A = window.Aphesis;
const root = document.documentElement;
const sysDark = matchMedia('(prefers-color-scheme: dark)');
export const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : sysDark.matches);

export function createEye(button) {
  button.querySelector('.eye.open').innerHTML = A.icon('eye', 0);
  button.querySelector('.eye.closed').innerHTML = A.icon('eye', 1);
  const state = () => {
    root.classList.toggle('is-dark', isDark());
    button.dataset.tip = isDark() ? 'closed · open the eye' : 'open · close the eye';
    button.setAttribute('aria-pressed', String(isDark()));
  };
  state();
  sysDark.addEventListener('change', state);
  /* the switch spreads as a stipple wave from the eye (Aphesis.themeShift); without it, it switches at once.
     The canvases read the new colours on their own when the theme changes. */
  button.addEventListener('click', () => {
    const b = button.getBoundingClientRect();
    const apply = () => { root.dataset.theme = isDark() ? 'light' : 'dark'; state(); };
    (A.themeShift || ((f) => f()))(apply, { origin: [b.left + b.width / 2, b.top + b.height / 2] });
  });
}
