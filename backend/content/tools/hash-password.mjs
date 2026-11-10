#!/usr/bin/env node
// The owner's password, as the one line the content Worker keeps in its OWNER_PASSWORD_HASH secret:
//
//   node backend/content/tools/hash-password.mjs                 asks twice, without echo, and prints the line
//   printf %s "$PASSWORD" | node backend/content/tools/hash-password.mjs --stdin     reads it from a pipe
//   ... --iterations 25000                                       (10,000 to 60,000; 25,000 by default)
//
// 12 to 32 characters: the gate's line on a phone holds no more. The line is pbkdf2-sha256$<iterations>$<salt>$<hash>: PBKDF2-SHA256 with a fresh 16-byte salt, the same
// derivation the Worker runs with WebCrypto. The password itself is never printed or written anywhere.
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const at = args.indexOf('--iterations');
const iterations = at >= 0 ? Number(args[at + 1]) : 25000;
if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 60000) {
  console.error('--iterations is a whole number from 10000 to 60000 (the Worker refuses others)');
  process.exit(2);
}

function hidden(prompt) {
  return new Promise((resolve) => {
    const { stdin, stderr } = process;
    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let s = '';
    const on = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', on); stderr.write('\n'); resolve(s); return; }
        if (c === '\u0003') { stderr.write('\n'); process.exit(130); }
        if (c === '\u007f' || c === '\b') s = s.slice(0, -1); else s += c;
      }
    };
    stdin.on('data', on);
  });
}

async function read() {
  if (args.includes('--stdin') || !process.stdin.isTTY) {
    let s = '';
    for await (const chunk of process.stdin) s += chunk;
    return s.replace(/\r?\n$/, '');
  }
  const a = await hidden('password: ');
  const b = await hidden('again: ');
  if (a !== b) { console.error('the two do not match'); process.exit(1); }
  return a;
}

const password = await read();
/* the gate's line holds 34 characters on the narrowest phones (360 px) and refuses more, so a longer password could
   never be typed there */
const MAX = 32;
if (password.length < 12) { console.error('use at least 12 characters (a few unrelated words is best)'); process.exit(1); }
if ([...password].length > MAX) { console.error(`use at most ${MAX} characters: the gate's line on a phone holds no more`); process.exit(1); }
const salt = randomBytes(16);
const hash = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, iterations, 32, 'sha256');
console.log(`pbkdf2-sha256$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`);
