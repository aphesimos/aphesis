/* turnstile: Cloudflare's check that a person, not a script, is posting. Verified on the server with the secret;
   the address is not sent along. Without a TURNSTILE_SECRET binding the check is off (local development). */

const VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, secret, fetchImpl = fetch) {
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false };
  try {
    const body = new FormData();
    body.append('secret', secret);
    body.append('response', String(token).slice(0, 2048));
    const r = await fetchImpl(VERIFY, { method: 'POST', body });
    const j = await r.json();
    return { ok: !!j.success };
  } catch (_) {
    return { ok: false };
  }
}
