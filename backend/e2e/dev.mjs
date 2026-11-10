// Runs a Worker under `wrangler dev` (workerd + Miniflare, all local) for the end-to-end tests.
//
// Each Worker is built once with worker-build, then started as often as a test needs, with its own vars and its own
// storage directory, from a copy of its wrangler.toml without the [build] step (so a restart does not rebuild).
//
// Environment: WRANGLER (command, default `npx --yes wrangler@4.153.0`), E2E_NO_BUILD=1 to use an existing build/.
import { spawn, execFileSync } from 'node:child_process';
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

/* start(name, vars) -> { url, state, stop() } */
export async function start(name, vars = {}) {
  const dir = build(name);
  const port = await freePort();
  /* its own inspector port too, so several can run at once */
  const inspector = await freePort();
  const state = mkdtempSync(path.join(tmpdir(), `aphesis-${name}-`));
  const args = [...WRANGLER.slice(1), 'dev', '-c', 'wrangler.e2e.toml', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
    '--persist-to', state, '--show-interactive-dev-session=false', '--log-level', 'warn'];
  for (const [k, v] of Object.entries(vars)) args.push('--var', `${k}:${v}`);
  const child = spawn(WRANGLER[0], args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited:\n${log}`);
    try { await fetch(url + '/'); break; } catch (_) { /* not yet */ }
    if (Date.now() > deadline) { child.kill(); throw new Error(`wrangler dev did not start:\n${log}`); }
    await new Promise((r) => setTimeout(r, 300));
  }
  return {
    url,
    state,
    log: () => log,
    async stop() {
      if (child.exitCode === null) {
        child.kill('SIGINT');
        await new Promise((r) => { child.once('exit', r); setTimeout(r, 5000); });
      }
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
