// All persistence and access rules for the app. Server only.

import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { db, must } from './db';
import { DEMO_PROFILE } from './demoProfile';
import { WORKSPACE_COOKIE, verifyWorkspace } from './workspace';
import { overallConfidence } from './verify';
import { computeDelta, type Delta } from './delta';
import type { BriefResult, FounderProfile, StageState } from './types';
import type { ListRow } from '@/components/BriefList';
import { FounderProfile as ProfileSchema } from './types';

export interface BriefRow {
  id: string;
  workspace_id: string;
  investor_name: string;
  firm: string;
  status: 'running' | 'complete' | 'partial' | 'unverified' | 'failed';
  stages: StageState[];
  result: BriefResult | null;
  error: string | null;
  user_context: string | null;
  meeting_at: string | null;
  profile_snapshot: FounderProfile | null;
  parent_brief_id: string | null;
  share_token: string | null;
  is_seed: boolean;
  latency_ms: number | null;
  cost_usd: number | null;
  confidence: string | null;
  created_at: string;
  completed_at: string | null;
}

export const STALE_AFTER_MS = 210_000; // a job still "running" after this died with its function

export async function currentWorkspace(): Promise<string> {
  const id = await verifyWorkspace((await cookies()).get(WORKSPACE_COOKIE)?.value);
  if (!id) throw new Error('no workspace cookie');
  await ensureWorkspace(id);
  return id;
}

export async function ensureWorkspace(id: string) {
  const r = await db().from('workspaces').upsert({ id, last_seen_at: new Date().toISOString() }, { onConflict: 'id' });
  if (r.error) throw new Error(`ensureWorkspace: ${r.error.message}`);
}

export function investorKey(name: string, firm: string): string {
  return `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${firm.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

export async function getProfile(ws: string): Promise<FounderProfile> {
  const r = await db().from('founder_profiles').select('profile').eq('workspace_id', ws).maybeSingle();
  const parsed = ProfileSchema.safeParse(r.data?.profile);
  return parsed.success ? parsed.data : DEMO_PROFILE;
}

export async function saveProfile(ws: string, profile: FounderProfile) {
  must(await db().from('founder_profiles').upsert({ workspace_id: ws, profile, updated_at: new Date().toISOString() }), 'saveProfile');
}

/** Fixed-window rate limiter. Returns true if the call is allowed. */
export async function allow(key: string, limit: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const r = await db().rpc('bump_rate', { p_key: key, p_window: windowStart });
  if (r.error) {
    console.error('rate limit check failed, allowing', r.error.message);
    return true; // fail open so a limiter fault never blocks the user
  }
  return (r.data as number) <= limit;
}

export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  return createHash('sha256').update(`pp:${ip}`).digest('hex').slice(0, 24); // hashed: we never store raw IPs
}

export async function createBrief(a: {
  ws: string; name: string; firm: string; userContext?: string | null; meetingAt?: string | null;
  profile: FounderProfile; parentId?: string | null; isSeed?: boolean;
}): Promise<string> {
  const row = must(
    await db().from('briefs').insert({
      workspace_id: a.ws, investor_name: a.name, firm: a.firm, investor_key: investorKey(a.name, a.firm),
      status: 'running', user_context: a.userContext ?? null, meeting_at: a.meetingAt ?? null, profile_snapshot: a.profile,
      parent_brief_id: a.parentId ?? null, is_seed: a.isSeed ?? false,
    }).select('id').single(),
    'createBrief',
  );
  return row!.id as string;
}

export async function setStages(id: string, stages: StageState[]) {
  await db().from('briefs').update({ stages }).eq('id', id);
}

export async function saveResult(id: string, r: BriefResult) {
  const overall = overallConfidence(r);
  must(
    await db().from('briefs').update({
      status: r.status, result: r, latency_ms: r.stats.latencyMs, cost_usd: r.usage.costUsd,
      tokens_in: r.usage.promptTokens, tokens_out: r.usage.outputTokens + r.usage.thoughtTokens, grounded_queries: r.usage.groundedQueries,
      claims_verified: r.stats.claimsVerified, claims_dropped: r.stats.claimsDropped, sources: r.stats.sources,
      confidence: overall, completed_at: new Date().toISOString(),
    }).eq('id', id),
    'saveResult',
  );
  if (r.claims.length) {
    await db().from('claims').insert(
      r.claims.map((c) => ({
        brief_id: id, claim_id: c.id, section: c.section, kind: c.kind, text: c.text, event_date: c.eventDate, verified: c.verified,
        drop_reason: c.dropReason, judge: c.judge, evidence_ids: c.evidenceIds, quote: c.quote, severity: c.severity,
      })),
    );
  }
  if (r.evidence.length) {
    await db().from('evidence').insert(
      r.evidence.map((e) => ({
        brief_id: id, evidence_id: e.id, url: e.url, domain: e.domain, title: e.title, published_at: e.publishedAt, tier: e.tier,
        full_fetch: e.fullFetch, origin: e.origin,
      })),
    );
  }
}

export async function failBrief(id: string, message: string) {
  await db().from('briefs').update({ status: 'failed', error: message.slice(0, 400), completed_at: new Date().toISOString() }).eq('id', id);
}

/** Who may see a brief: its owner, anyone for seeded examples, or anyone holding its share token. */
export async function getBrief(id: string, ws: string | null, token?: string | null): Promise<BriefRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const r = await db().from('briefs').select('*').eq('id', id).maybeSingle();
  const row = r.data as BriefRow | null;
  if (!row) return null;
  const allowed = row.is_seed || (ws && row.workspace_id === ws) || (token && row.share_token && token === row.share_token);
  if (!allowed) return null;
  if (row.status === 'running' && Date.now() - Date.parse(row.created_at) > STALE_AFTER_MS) {
    await failBrief(id, 'This brief took too long and was stopped. Please try again.');
    return { ...row, status: 'failed', error: 'This brief took too long and was stopped. Please try again.' };
  }
  return row;
}

export const LIST_COLS = 'id,investor_name,firm,status,confidence,created_at,latency_ms,is_seed,claims_verified,sources';

export async function listBriefs(ws: string, limit = 50) {
  return (must(await db().from('briefs').select(LIST_COLS).eq('workspace_id', ws).eq('is_seed', false).order('created_at', { ascending: false }).limit(limit), 'listBriefs') ?? []) as ListRow[];
}

export async function listSeedBriefs() {
  return (must(await db().from('briefs').select(LIST_COLS).eq('is_seed', true).in('status', ['complete', 'partial']).order('created_at', { ascending: false }).limit(12), 'listSeeds') ?? []) as ListRow[];
}

export async function recentComplete(ws: string, key: string, withinMs: number): Promise<string | null> {
  const since = new Date(Date.now() - withinMs).toISOString();
  const r = await db().from('briefs').select('id').eq('workspace_id', ws).eq('investor_key', key).in('status', ['complete', 'partial']).gte('created_at', since).order('created_at', { ascending: false }).limit(1);
  return r.data?.[0]?.id ?? null;
}

export async function latestPrevious(ws: string, key: string, excludeId: string) {
  const r = await db().from('briefs').select('id,result,created_at').eq('workspace_id', ws).eq('investor_key', key).in('status', ['complete', 'partial']).neq('id', excludeId).order('created_at', { ascending: false }).limit(1);
  return (r.data?.[0] as { id: string; result: BriefResult; created_at: string } | undefined) ?? null;
}

export async function shareToken(id: string, ws: string): Promise<string | null> {
  const r = await db().from('briefs').select('share_token').eq('id', id).eq('workspace_id', ws).maybeSingle();
  if (!r.data) return null;
  if (r.data.share_token) return r.data.share_token as string;
  const token = randomBytes(12).toString('hex');
  must(await db().from('briefs').update({ share_token: token }).eq('id', id).eq('workspace_id', ws), 'shareToken');
  return token;
}

export async function deleteWorkspace(ws: string) {
  must(await db().from('workspaces').delete().eq('id', ws), 'deleteWorkspace'); // cascades to profile, briefs, claims, evidence, feedback
}

/** "What changed since your last brief" for a finished brief you own, or null. */
export async function loadDelta(row: BriefRow, isOwner: boolean): Promise<Delta | null> {
  if (!isOwner || !row.result || (row.status !== 'complete' && row.status !== 'partial')) return null;
  const prev = await latestPrevious(row.workspace_id, investorKey(row.investor_name, row.firm), row.id).catch(() => null);
  if (!prev?.result || Date.parse(prev.created_at) >= Date.parse(row.created_at)) return null;
  return computeDelta(row.result, prev);
}

// ---------------------------------------------------------------- pipeline

import type { Fit, Status } from './tracker';

export interface NoteRow {
  investor_key: string; investor_name: string; firm: string; status: Status; notes: string; next_step: string; next_step_on: string | null; updated_at: string;
}

export async function getNote(ws: string, key: string): Promise<NoteRow | null> {
  const r = await db().from('investor_notes').select('*').eq('workspace_id', ws).eq('investor_key', key).maybeSingle();
  return (r.data as NoteRow | null) ?? null;
}

export async function upsertNote(ws: string, a: { name: string; firm: string; status?: Status; notes?: string; nextStep?: string; nextStepOn?: string | null }) {
  const key = investorKey(a.name, a.firm);
  const existing = await getNote(ws, key);
  const row = {
    workspace_id: ws, investor_key: key, investor_name: a.name, firm: a.firm,
    status: a.status ?? existing?.status ?? 'researching',
    notes: a.notes ?? existing?.notes ?? '',
    next_step: a.nextStep ?? existing?.next_step ?? '',
    next_step_on: a.nextStepOn === undefined ? existing?.next_step_on ?? null : a.nextStepOn,
    updated_at: new Date().toISOString(),
  };
  must(await db().from('investor_notes').upsert(row), 'upsertNote');
  return row;
}

export interface PipelineItem {
  key: string; name: string; firm: string; briefId: string; briefAt: string; briefStatus: string; confidence: string | null;
  status: Status; notes: string; nextStep: string; nextStepOn: string | null; fit: Fit | null; lastDeal: { date: string; text: string } | null;
}

/** Latest brief per investor in this workspace, joined with the founder's own status and notes. */
export async function listPipeline(ws: string): Promise<PipelineItem[]> {
  const rows = (must(
    await db().from('briefs').select('id,investor_key,investor_name,firm,status,confidence,created_at,fit:result->synthesis->fit')
      .eq('workspace_id', ws).eq('is_seed', false).in('status', ['complete', 'partial', 'unverified']).order('created_at', { ascending: false }).limit(300),
    'pipeline briefs',
  ) ?? []) as unknown as { id: string; investor_key: string; investor_name: string; firm: string; status: string; confidence: string | null; created_at: string; fit: Fit | null }[];
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.investor_key)) latest.set(r.investor_key, r);
  if (!latest.size) return [];
  const notes = new Map(((await db().from('investor_notes').select('*').eq('workspace_id', ws)).data ?? []).map((n) => [n.investor_key as string, n as NoteRow]));
  const ids = [...latest.values()].map((r) => r.id);
  const claims = ((await db().from('claims').select('brief_id,text,event_date').in('brief_id', ids).eq('section', 'deals').eq('verified', true).not('event_date', 'is', null).order('event_date', { ascending: false })).data ?? []) as { brief_id: string; text: string; event_date: string }[];
  const deal = new Map<string, { date: string; text: string }>();
  for (const c of claims) if (!deal.has(c.brief_id)) deal.set(c.brief_id, { date: c.event_date, text: c.text });
  return [...latest.values()].map((r) => {
    const n = notes.get(r.investor_key);
    return {
      key: r.investor_key, name: r.investor_name, firm: r.firm, briefId: r.id, briefAt: r.created_at, briefStatus: r.status, confidence: r.confidence,
      status: n?.status ?? 'researching', notes: n?.notes ?? '', nextStep: n?.next_step ?? '', nextStepOn: n?.next_step_on ?? null, fit: r.fit, lastDeal: deal.get(r.id) ?? null,
    };
  });
}

export async function deleteBrief(id: string, ws: string): Promise<boolean> {
  const r = await db().from('briefs').delete().eq('id', id).eq('workspace_id', ws).select('id');
  return !!r.data?.length;
}

/** Copies a public example brief into the viewer's own workspace so they can track it, take notes and draft follow-ups. */
export async function adoptBrief(id: string, ws: string): Promise<string | null> {
  const src = (await db().from('briefs').select('*').eq('id', id).eq('is_seed', true).maybeSingle()).data as (BriefRow & { investor_key: string }) | null;
  if (!src?.result) return null;
  const copy = must(
    await db().from('briefs').insert({
      workspace_id: ws, investor_name: src.investor_name, firm: src.firm, investor_key: src.investor_key, status: src.status, result: src.result,
      profile_snapshot: src.profile_snapshot, parent_brief_id: src.id, is_seed: false, latency_ms: src.latency_ms, cost_usd: 0, confidence: src.confidence,
      claims_verified: (src as any).claims_verified, claims_dropped: (src as any).claims_dropped, sources: (src as any).sources, completed_at: src.completed_at,
    }).select('id').single(),
    'adopt',
  );
  const newId = copy!.id as string;
  const claims = (await db().from('claims').select('claim_id,section,kind,text,event_date,verified,drop_reason,judge,evidence_ids,quote,severity').eq('brief_id', id)).data ?? [];
  if (claims.length) await db().from('claims').insert(claims.map((c) => ({ ...c, brief_id: newId })));
  const ev = (await db().from('evidence').select('evidence_id,url,domain,title,published_at,tier,full_fetch,origin').eq('brief_id', id)).data ?? [];
  if (ev.length) await db().from('evidence').insert(ev.map((e) => ({ ...e, brief_id: newId })));
  return newId;
}
