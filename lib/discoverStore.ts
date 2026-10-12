import { db, logEvent, must } from './db';
import { discover, type DiscoveryResult } from './discover';
import { STALE_AFTER_MS } from './store';
import type { FounderProfile, StageState } from './types';

export interface DiscoveryRow { id: string; status: 'running' | 'complete' | 'failed'; focus: string | null; stages: StageState[]; result: DiscoveryResult | null; error: string | null; created_at: string; completed_at: string | null }

const COLS = 'id,status,focus,stages,result,error,created_at,completed_at';

export async function createDiscovery(ws: string, focus: string | null): Promise<string> {
  const row = must(await db().from('discoveries').insert({ workspace_id: ws, focus, status: 'running' }).select('id').single(), 'createDiscovery');
  return row!.id as string;
}

export async function getDiscovery(id: string, ws: string): Promise<DiscoveryRow | null> {
  const r = (await db().from('discoveries').select(COLS).eq('id', id).eq('workspace_id', ws).maybeSingle()).data as DiscoveryRow | null;
  if (r && r.status === 'running' && Date.now() - Date.parse(r.created_at) > STALE_AFTER_MS) { // the function that ran it died
    await db().from('discoveries').update({ status: 'failed', error: 'The search timed out. Please try again.', completed_at: new Date().toISOString() }).eq('id', id);
    return { ...r, status: 'failed', error: 'The search timed out. Please try again.' };
  }
  return r;
}

export async function latestDiscovery(ws: string): Promise<DiscoveryRow | null> {
  const r = (await db().from('discoveries').select(COLS).eq('workspace_id', ws).order('created_at', { ascending: false }).limit(1).maybeSingle()).data as DiscoveryRow | null;
  if (!r) return null;
  return r.status === 'running' ? getDiscovery(r.id, ws) : r;
}

export async function runDiscoveryJob(id: string, profile: FounderProfile, focus: string | null) {
  const started = Date.now();
  try {
    let last = '';
    const result = await discover(profile, {
      focus: focus ?? undefined,
      onStage: async (s) => { const sig = s.map((x) => x.status + (x.detail ?? '')).join('|'); if (sig !== last) { last = sig; await db().from('discoveries').update({ stages: s }).eq('id', id); } },
    });
    await db().from('discoveries').update({ status: 'complete', result, stages: [], cost_usd: result.usage.costUsd, latency_ms: result.stats.latencyMs, completed_at: new Date().toISOString() }).eq('id', id);
    await logEvent('job', 'discovery_done', id, { firms: result.candidates.length, deals: result.stats.dealsKept, ms: result.stats.latencyMs, cost: result.usage.costUsd });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    await db().from('discoveries').update({ status: 'failed', error: msg, completed_at: new Date().toISOString() }).eq('id', id);
    await logEvent('job', 'discovery_failed', id, { error: msg, ms: Date.now() - started });
  }
}
