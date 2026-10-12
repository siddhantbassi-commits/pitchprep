import { NextResponse } from 'next/server';
import { db, logEvent } from '@/lib/db';
import { Meter } from '@/lib/gemini';
import { runPreMortem, type PreMortem } from '@/lib/premortem';
import { progress, type SessionLite } from '@/lib/progress';
import { allow, currentWorkspace, getBrief, getProfile } from '@/lib/store';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  const row = (await db().from('premortems').select('result').eq('workspace_id', ws).eq('brief_id', id).maybeSingle()).data;
  return NextResponse.json({ premortem: (row?.result as PreMortem | undefined) ?? null });
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  const brief = await getBrief(id, ws, null);
  if (!brief?.result || brief.result.status === 'unverified') return NextResponse.json({ error: 'A pre-mortem needs a verified brief.' }, { status: 404 });
  if (!(await allow(`assist:${ws}`, 20, 3600_000)) || !(await allow('assist-global', 400, 86_400_000))) return NextResponse.json({ error: 'Too many requests for now. Try again later.' }, { status: 429 });
  try {
    const sessions = ((await db().from('mock_sessions').select('id,created_at,difficulty,overall,investor_name,firm,score').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(40)).data ?? []) as SessionLite[];
    const weakSkills = progress(sessions).weak.map((k) => k);
    const meter = new Meter();
    const out = await runPreMortem({ result: brief.result, profile: await getProfile(ws), weakSkills, meter });
    await db().from('premortems').upsert({ workspace_id: ws, brief_id: id, result: out, created_at: out.createdAt });
    await logEvent('assist', 'premortem', id, { reasons: out.reasons.length, dropped: out.dropped, cost: meter.u.costUsd });
    return NextResponse.json({ premortem: out });
  } catch {
    return NextResponse.json({ error: 'That did not come back in time. Please try again.' }, { status: 502 });
  }
}
