/* folios in lowercase roman numerals, as a codex numbers its leaves */

const R = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
  [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];

export function roman(n) {
  let s = '';
  for (const [v, r] of R) while (n >= v) { s += r; n -= v; }
  return s;
}
