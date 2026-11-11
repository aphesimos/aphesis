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
