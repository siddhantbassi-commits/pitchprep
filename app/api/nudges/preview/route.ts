import { db } from '@/lib/db';
import { renderEmail, type NudgeKind } from '@/lib/emailTemplates';
import { contentFromBrief } from '@/lib/nudges';
import { currentWorkspace, getProfile } from '@/lib/store';
import type { BriefResult } from '@/lib/types';

export const dynamic = 'force-dynamic';
const KINDS: NudgeKind[] = ['brief_ready', 'pre_meeting', 'follow_up', 'overdue', 'digest', 'confirm', 'signin', 'test'];

// Shows exactly what an email looks like, built from the founder's latest real brief (or an example), without sending anything.
export async function GET(req: Request) {
  const kind = (new URL(req.url).searchParams.get('kind') ?? 'pre_meeting') as NudgeKind;
  if (!KINDS.includes(kind)) return new Response('Unknown email type', { status: 400 });
  const ws = await currentWorkspace();
  let row = (await db().from('briefs').select('result,created_at').eq('workspace_id', ws).eq('is_seed', false).in('status', ['complete', 'partial']).order('created_at', { ascending: false }).limit(1)).data?.[0];
  if (!row) row = (await db().from('briefs').select('result,created_at').eq('is_seed', true).in('status', ['complete', 'partial']).order('created_at', { ascending: false }).limit(1)).data?.[0];
  const r = row?.result as BriefResult | undefined;
  const base = r ? contentFromBrief(r, row!.created_at) : {};
  const soon = new Date(Date.now() + 2 * 3600_000).toISOString();
  const mail = renderEmail({
    kind, founderName: (await getProfile(ws)).founderName, ...base, meetingAt: soon,
    newSince: kind === 'pre_meeting' ? ['(In a real email: events dated after your last brief appear here.)'] : undefined,
    overdue: [{ investor: r?.investor.name ?? 'An investor', nextStep: 'Send the cohort retention data', due: '2026-10-10' }],
    today: [{ investor: r?.investor.name ?? 'An investor', firm: r?.investor.firm ?? '', time: '11:00 IST', briefReady: true }],
    followUpFor: r?.investor.name, openUrl: '#', unsubscribeUrl: '#', confirmUrl: '#',
  });
  return new Response(mail.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", 'cache-control': 'no-store' } });
}
