// Ships one Worker of backend/services.json, from its existing build/ (made by worker-build).
//
//   node scripts/deploy.mjs <service>             deploy, create missing R2 buckets and D1 databases (and apply
//                                                 their migrations), push secrets
//   node scripts/deploy.mjs <service> --dry-run   bundle only, and report the upload size (no account needed)
//
// Environment:
//   WRANGLER                 the wrangler command (default `npx --yes wrangler@4.153.0`)
//   BACKEND_CUSTOM_DOMAINS   "1" serves the service on its custom domain only; otherwise on workers.dev only
//   SECRETS_JSON             the repository secrets as JSON (`${{ toJSON(secrets) }}`); empty ones are skipped
//   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID   for wrangler
//
// Secret values are written only to a private temporary file for `wrangler secret bulk`, and never printed.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [name, flag] = process.argv.slice(2);
const dryRun = flag === '--dry-run';
const { services } = JSON.parse(readFileSync(path.join(root, 'services.json'), 'utf8'));
const svc = services.find((s) => s.name === name);
if (!svc) { console.error(`unknown service "${name}"; known: ${services.map((s) => s.name).join(', ')}`); process.exit(2); }
const dir = path.join(root, svc.name);
const WRANGLER = (process.env.WRANGLER || 'npx --yes wrangler@4.153.0').split(' ');
const LIMIT = 3 * 1024 * 1024; /* the Workers Free plan: 3 MB compressed */

function wrangler(args, { input, quiet } = {}) {
  const r = spawnSync(WRANGLER[0], [...WRANGLER.slice(1), ...args], { cwd: dir, encoding: 'utf8', input, env: { ...process.env, NO_COLOR: '1' } });
  const out = (r.stdout || '') + (r.stderr || '');
  if (!quiet) process.stdout.write(out);
  return { ok: r.status === 0, out };
}
function summary(text) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
}

/* 1. the config to ship: wrangler.toml without its [build] step (the build is already made), and the custom domain
      when it is switched on (a top-level key, so it goes before the first table) */
const domains = process.env.BACKEND_CUSTOM_DOMAINS === '1';
let toml = readFileSync(path.join(dir, 'wrangler.toml'), 'utf8').replace(/^\[build\][\s\S]*?(?=^\[)/m, '');
if (domains && svc.domain) {
  const at = toml.search(/^\[/m);
  toml = toml.slice(0, at) + `routes = [{ pattern = "${svc.domain}", custom_domain = true }]\n\n` + toml.slice(at);
  /* with its own domain, the Worker is not also served on the account's workers.dev subdomain: that name belongs
     to the account, not to this site, and nothing needs the second address */
  toml = toml.replace(/^workers_dev\s*=\s*true\s*$/m, 'workers_dev = false');
}
const config = 'wrangler.deploy.toml';
writeFileSync(path.join(dir, config), toml);
/* D1: the database's id goes into the shipped config (wrangler.toml keeps a placeholder) */
function setDatabaseId(name, id) {
  toml = toml.replace(new RegExp(`(database_name = "${name}"\\s*\\n(?:#[^\\n]*\\n)*database_id = )"[^"]*"`), `$1"${id}"`);
  writeFileSync(path.join(dir, config), toml);
}

/* 2. the size of what is uploaded */
const files = readdirSync(path.join(dir, 'build'), { recursive: true }).map((f) => path.join(dir, 'build', f))
  .filter((f) => statSync(f).isFile() && /\.(js|mjs|wasm)$/.test(f) && !f.includes(`${path.sep}.tmp${path.sep}`));
const raw = files.reduce((n, f) => n + statSync(f).size, 0);
const gz = files.reduce((n, f) => n + gzipSync(readFileSync(f), { level: 9 }).length, 0);
summary(`${svc.name}: ${(raw / 1024).toFixed(0)} KiB, ${(gz / 1024).toFixed(0)} KiB gzipped (limit ${LIMIT / 1024} KiB)`);
if (gz > LIMIT) { console.error(`${svc.name} is over the free plan's limit`); process.exit(1); }

if (dryRun) {
  const out = mkdtempSync(path.join(tmpdir(), `${svc.name}-dist-`));
  const r = wrangler(['deploy', '-c', config, '--dry-run', '--outdir', out]);
  rmSync(out, { recursive: true, force: true });
  process.exit(r.ok ? 0 : 1);
}

/* 3. buckets, created when missing */
for (const bucket of svc.r2 || []) {
  const list = wrangler(['r2', 'bucket', 'list'], { quiet: true });
  if (!list.ok) { console.error(list.out); console.error('could not list R2 buckets: is R2 enabled on the account?'); process.exit(1); }
  if (new RegExp(`\\b${bucket}\\b`).test(list.out)) { console.log(`r2 bucket ${bucket}: exists`); continue; }
  const made = wrangler(['r2', 'bucket', 'create', bucket]);
  if (!made.ok) process.exit(1);
}

/* 3b. D1 databases, created when missing, their ids in the config */
for (const db of svc.d1 || []) {
  const list = wrangler(['d1', 'list', '--json'], { quiet: true });
  if (!list.ok) { console.error(list.out); console.error('could not list D1 databases'); process.exit(1); }
  let found = (JSON.parse(list.out.slice(list.out.indexOf('['))) || []).find((d) => d.name === db.name);
  if (!found) {
    const made = wrangler(['d1', 'create', db.name]);
    if (!made.ok) process.exit(1);
    const again = wrangler(['d1', 'list', '--json'], { quiet: true });
    found = JSON.parse(again.out.slice(again.out.indexOf('['))).find((d) => d.name === db.name);
  } else console.log(`d1 database ${db.name}: exists`);
  setDatabaseId(db.name, found.uuid);
  const mig = wrangler(['d1', 'migrations', 'apply', db.name, '--remote', '-c', config]);
  if (!mig.ok) process.exit(1);
}

/* 4. the Worker */
const dep = wrangler(['deploy', '-c', config]);
if (!dep.ok) process.exit(1);
const urls = [...new Set([
  ...(dep.out.match(/https:\/\/[^\s]+\.workers\.dev/g) || []),
  ...(dep.out.match(/[a-z0-9.-]+\.[a-z]+ \(custom domain\)/g) || []).map((d) => 'https://' + d.replace(' (custom domain)', '')),
])];
summary(`${svc.name} deployed: ${urls.length ? urls.join(', ') : '(see the log above for its URL)'}`);

/* 5. secrets: the non-empty ones, pushed together */
let all = {};
try { all = JSON.parse(process.env.SECRETS_JSON || '{}'); } catch (_) { /* none */ }
const push = {}, skipped = [];
for (const [workerName, repoName] of Object.entries(svc.secrets || {})) {
  const v = all[repoName];
  if (typeof v === 'string' && v !== '') push[workerName] = v; else skipped.push(`${workerName} (${repoName})`);
}
if (Object.keys(push).length) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'secrets-'));
  const file = path.join(tmp, 'secrets.json');
  writeFileSync(file, JSON.stringify(push), { mode: 0o600 });
  try {
    const r = wrangler(['secret', 'bulk', file, '-c', config], { quiet: true });
    /* wrangler prints names, not values; keep only its own lines about success or failure */
    console.log(r.out.split('\n').filter((l) => /secret|success|error|fail/i.test(l)).join('\n'));
    if (!r.ok) process.exit(1);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  summary(`${svc.name} secrets set: ${Object.keys(push).join(', ')}`);
}
if (skipped.length) summary(`${svc.name} secrets skipped (empty or missing): ${skipped.join(', ')}`);
