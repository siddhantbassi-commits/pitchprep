// Encrypts secrets we must store (the user's private calendar link is a bearer credential to their calendar).
// AES-256-GCM with a key derived from WORKSPACE_SECRET. Values written before encryption existed still read back.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

function key(): Buffer {
  const secret = process.env.WORKSPACE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('WORKSPACE_SECRET is not set');
  return createHash('sha256').update(`pitchprep:secrets:${secret}`).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `${PREFIX}${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function open(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // legacy plain value
  const [iv, tag, enc] = stored.slice(PREFIX.length).split('.');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
}

export const isSealed = (s: string) => s.startsWith(PREFIX);
