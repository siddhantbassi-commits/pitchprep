// A workspace is one browser's private area: a random id in an HMAC-signed cookie. No login wall for the first run;
// the same id can later be attached to an email (magic link) so history follows the person across devices.

const COOKIE = 'pp_ws';

function secret(): string {
  return process.env.WORKSPACE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const WORKSPACE_COOKIE = COOKIE;

export async function signWorkspace(id: string): Promise<string> {
  return `${id}.${await hmac(id)}`;
}

export async function verifyWorkspace(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const [id, sig] = value.split('.');
  if (!id || !sig || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return (await hmac(id)) === sig ? id : null;
}
