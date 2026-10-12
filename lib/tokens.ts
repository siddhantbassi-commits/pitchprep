// Signed, expiring tokens for links in emails: confirm an address, unsubscribe, open the app on another device.
// HMAC-SHA256 over a small JSON payload. No database lookup needed to verify, and tampering or expiry is rejected.

import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const s = process.env.WORKSPACE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('WORKSPACE_SECRET is not set');
  return `pitchprep:tokens:${s}`;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signToken(purpose: string, data: Record<string, unknown>, ttlSeconds: number, now = Date.now()): string {
  const body = b64(JSON.stringify({ p: purpose, exp: Math.floor(now / 1000) + ttlSeconds, ...data }));
  const sig = b64(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

/** Returns the payload only if the signature is valid, the purpose matches and the token has not expired. */
export function verifyToken<T extends Record<string, unknown>>(token: string, purpose: string, now = Date.now()): (T & { p: string; exp: number }) | null {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', secret()).update(body).digest();
  let got: Buffer;
  try { got = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.p !== purpose || typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null;
    return payload;
  } catch { return null; }
}

/** Only same-site relative paths may be used as a redirect target, so a token can never bounce a user to another site. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(next) ? next : '/';
}
