// Supabase access (service role, server only). Browsers never talk to the database.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

export async function logEvent(source: string, type: string, briefId: string | null, payload: unknown = {}) {
  const r = await db().from('events').insert({ source, type, brief_id: briefId, payload });
  if (r.error) console.error('logEvent failed', r.error.message); // audit logging must never break the pipeline
}
