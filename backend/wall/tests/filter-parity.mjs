// The shared vectors, run against the page's JavaScript filter (the same file the page bundles).
//
//   node filter-parity.mjs [path/to/filter.js]
//
// Without a path, the filter is read from git: $WALL_FILTER_REF, by default
// `origin/section/wall:wall/worker/src/filter.js`, falling back to the local `section/wall` branch.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));

function filterSource() {
  if (process.argv[2]) return readFileSync(process.argv[2], 'utf8');
  const refs = process.env.WALL_FILTER_REF
    ? [process.env.WALL_FILTER_REF]
    : ['origin/section/wall:wall/worker/src/filter.js', 'section/wall:wall/worker/src/filter.js'];
  for (const ref of refs) {
    try { return execFileSync('git', ['-C', here, 'show', ref], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { /* next */ }
  }
  throw new Error('filter.js not found in git (' + refs.join(', ') + '); pass its path');
}

const dir = mkdtempSync(path.join(tmpdir(), 'wall-filter-'));
const file = path.join(dir, 'filter.mjs');
writeFileSync(file, filterSource());
const { check, clean } = await import(pathToFileURL(file).href);
const v = JSON.parse(readFileSync(path.join(here, 'filter-vectors.json'), 'utf8'));

const failed = [];
for (const c of v.check) {
  const got = check(c.text, c.extra);
  if (!isDeepStrictEqual(got, c.expect)) failed.push(`${JSON.stringify(c.text)}: expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(got)}`);
}
for (const c of v.clean) {
  const got = clean(c.text);
  if (got !== c.expect) failed.push(`clean ${JSON.stringify(c.text)}: expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(got)}`);
}
const total = v.check.length + v.clean.length;
if (failed.length) {
  console.error(`${failed.length} of ${total} vectors differ in the JavaScript filter:\n` + failed.join('\n'));
  process.exit(1);
}
console.log(`javascript filter: ${total} vectors pass (${v.check.length} check, ${v.clean.length} clean)`);
