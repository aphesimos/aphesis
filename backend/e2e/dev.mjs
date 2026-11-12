// Runs a Worker under `wrangler dev` (workerd + Miniflare, all local) for the end-to-end tests.
//
// Each Worker is built once with worker-build, then started as often as a test needs, with its own vars and its own
// storage directory, from a copy of its wrangler.toml without the [build] step (so a restart does not rebuild).
//
// A Worker with D1 gets its migrations applied (and anything else) through `prepare`, before it starts.
//
// Environment: WRANGLER (command, default `npx --yes wrangler@4.153.0`), E2E_NO_BUILD=1 to use an existing build/.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
const WRANGLER = (process.env.WRANGLER || 'npx --yes wrangler@4.153.0').split(' ');
const built = new Set();

function build(name) {
  const dir = path.join(root, name);
  if (built.has(name)) return dir;
  if (process.env.E2E_NO_BUILD !== '1' || !existsSync(path.join(dir, 'build', 'index.js'))) {
    execFileSync('worker-build', ['--release'], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
  }
  /* the same config, minus the build step */
  const toml = readFileSync(path.join(dir, 'wrangler.toml'), 'utf8').replace(/^\[build\][\s\S]*?(?=^\[)/m, '');
  writeFileSync(path.join(dir, 'wrangler.e2e.toml'), toml);
  built.add(name);
  return dir;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

/* signal the whole process group: npx, wrangler and workerd */
function kill(child, sig) {
  try { process.kill(-child.pid, sig); } catch (_) { try { child.kill(sig); } catch (_) { /* gone */ } }
}

/* run wrangler in a Worker's folder with its e2e config (migrations, seeding) */
export function wrangler(name, args) {
  const dir = build(name);
  const r = spawnSync(WRANGLER[0], [...WRANGLER.slice(1), ...args, '-c', 'wrangler.e2e.toml'], { cwd: dir, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  if (r.status !== 0) throw new Error(`wrangler ${args.join(' ')}:\n${r.stdout}${r.stderr}`);
  return r.stdout;
}

/* start(name, vars, { prepare(state), logLevel }) -> { url, state, stop() }
   prepare runs before the Worker starts, with its storage directory (D1 migrations, a seed) */
export async function start(name, vars = {}, { prepare, logLevel = 'warn' } = {}) {
  const dir = build(name);
  const port = await freePort();
  /* its own inspector port too, so several can run at once */
  const inspector = await freePort();
  const state = mkdtempSync(path.join(tmpdir(), `aphesis-${name}-`));
  if (prepare) await prepare(state, dir);
  const args = [...WRANGLER.slice(1), 'dev', '-c', 'wrangler.e2e.toml', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
    '--persist-to', state, '--show-interactive-dev-session=false', '--log-level', logLevel];
  for (const [k, v] of Object.entries(vars)) args.push('--var', `${k}:${v}`);
  /* its own process group, so stop() reaches wrangler and workerd under npx, not only npx itself */
  const child = spawn(WRANGLER[0], args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, NO_COLOR: '1', WRANGLER_SEND_METRICS: 'false' } });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited (code ${child.exitCode}, signal ${child.signalCode}):\n${log}`);
    /* each probe gives up after 2 s, so a port that accepts but never answers cannot hold the loop past the deadline */
    try { await fetch(url + '/', { signal: AbortSignal.timeout(2000) }); break; } catch (_) { /* not yet */ }
    if (Date.now() > deadline) { kill(child, 'SIGKILL'); throw new Error(`wrangler dev did not start:\n${log}`); }
    await new Promise((r) => setTimeout(r, 300));
  }
  return {
    url,
    state,
    log: () => log,
    async stop() {
      if (child.exitCode === null) {
        kill(child, 'SIGINT');
        await new Promise((r) => { child.once('exit', r); setTimeout(r, 5000); });
      }
      /* whatever is left of the group (workerd) goes for good */
      kill(child, 'SIGKILL');
      child.stdout.destroy(); child.stderr.destroy();
      rmSync(state, { recursive: true, force: true });
    },
  };
}

/* the SQLite files Miniflare keeps for a Durable Object class */
export function objectFiles(state) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out.push(p);
    }
  };
  walk(state);
  return out;
}

/* every byte Miniflare stored, as one latin1 string, to look for things that must never be there */
export function dump(state) {
  return objectFiles(state).map((f) => readFileSync(f).toString('latin1')).join('\n');
}

/* run a query on each Durable Object database of the state directory and concatenate the rows */
export async function query(state, sql) {
  const { DatabaseSync } = await import('node:sqlite');
  const rows = [];
  for (const f of objectFiles(state).filter((p) => p.endsWith('.sqlite'))) {
    const db = new DatabaseSync(f, { readOnly: true });
    try { rows.push(...db.prepare(sql).all()); } catch (_) { /* a database without that table */ } finally { db.close(); }
  }
  return rows;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* a commit made of the given files ({path: text or bytes}), written into the repository's objects but on no branch,
   for a tool that reads a section branch with git (the content seed: ARCHIVE_REF, BOOK_REF, WORKS_REF, DS_REF): the
   tests bring their own content instead of depending on what the branches carry */
export function fixtureCommit(files) {
  const env = { ...process.env, GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@localhost', GIT_COMMITTER_NAME: 'fixture',
    GIT_COMMITTER_EMAIL: 'fixture@localhost', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' };
  const git = (args, input) => execFileSync('git', ['-C', root, ...args], { input, encoding: 'utf8', env }).trim();
  const tree = {};
  for (const [p, data] of Object.entries(files)) {
    const parts = p.split('/');
    let t = tree;
    for (const d of parts.slice(0, -1)) t = t[d] ||= {};
    t[parts[parts.length - 1]] = git(['hash-object', '-w', '--stdin'], data);
  }
  const mktree = (t) => git(['mktree'], Object.entries(t).map(([n, v]) => (typeof v === 'string' ? `100644 blob ${v}\t${n}` : `040000 tree ${mktree(v)}\t${n}`)).join('\n') + '\n');
  return git(['commit-tree', mktree(tree), '-m', 'a fixture for the end-to-end tests']);
}

/* a real PNG of w × h, grey, its pixels drawn from `seed` (so two pictures of the same size still differ) */
export function png(w, h, seed = 0) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c >>> 1 ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = (x * y + seed) & 255;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* the head of a JPEG of w × h: start of image, a baseline frame header, end of image; enough for a reader of sizes */
export function jpeg(w, h) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0, 0, 0, 0, 0x01, 0x01, 0x11, 0x00]);
  sof.writeUInt16BE(h, 5); sof.writeUInt16BE(w, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

/* the works the seed imports in the tests, in the shape of section/works' works/content/works.json, with their maps:
   two works, then one marked example, which the seed must skip */
export function worksFixture() {
  const work = (id, name, map, more = {}) => ({ id, name, gloss: `${id} gloss`, gloss_tip: `${id} gloss · a tip`, year: '2026', role: 'author',
    description: `${name}, a work the tests bring.`, links: [{ label: 'the repository', href: `https://example.com/${id}` }],
    map: { file: map, caption: `${name} · a caption`, settings: { scatter: 0.8, gain: 1.0 } },
    sources: { description: 'the tests' }, flags: { needs_owner_review: false }, ...more });
  const works = {
    section: { name: 'works', gloss: 'opera', gloss_tip: 'opera · works' },
    works: [work('heild', 'heild', 'heild.png'), work('aphesis', 'aφesis', 'aphesis.png'), work('a-shown-work', 'a shown work', 'shown.png', { example: true })],
  };
  return fixtureCommit({
    'works/content/works.json': JSON.stringify(works, null, 2) + '\n',
    'works/maps/heild.png': png(48, 32, 1),
    'works/maps/aphesis.png': png(40, 40, 2),
    'works/maps/shown.png': png(16, 16, 3),
  });
}

/* the design system's Simulacra the archive and book fixtures name */
export function simulacraFixture() {
  return fixtureCommit({
    'system/assets/Simulacra/jerome.jpg': jpeg(640, 480),
    'system/assets/Simulacra/trismegistus.png': png(64, 64, 4),
    'system/assets/Simulacra/faust.jpg': jpeg(480, 600),
  });
}
