import { db } from '@/lib/db';
import { renderEmail, type NudgeKind } from '@/lib/emailTemplates';
import { contentFromBrief } from '@/lib/nudges';
import { currentWorkspace, getProfile } from '@/lib/store';
import type { BriefResult } from '@/lib/types';

export const dynamic = 'force-dynamic';
const KINDS: NudgeKind[] = ['brief_ready', 'pre_meeting', 'follow_up', 'overdue', 'digest', 'bump', 'weekly', 'confirm', 'signin', 'test'];

// Shows exactly what an email looks like, built from the founder's latest real brief (or an example), without sending anything.
export async function GET(req: Request) {
  const kind = (new URL(req.url).searchParams.get('kind') ?? 'pre_meeting') as NudgeKind;
  if (!KINDS.includes(kind)) return new Response('Unknown email type', { status: 400 });
  const ws = await currentWorkspace();
  let row = (await db().from('briefs').select('id,result,created_at').eq('workspace_id', ws).eq('is_seed', false).in('status', ['complete', 'partial']).order('created_at', { ascending: false }).limit(1)).data?.[0];
  if (!row) row = (await db().from('briefs').select('id,result,created_at').eq('is_seed', true).in('status', ['complete', 'partial']).order('created_at', { ascending: false }).limit(1)).data?.[0];
  const r = row?.result as BriefResult | undefined;
  const base = r ? contentFromBrief(r, row!.created_at) : {};
  // Previews link to real pages in this browser so every button works; real emails carry a signed one-tap link instead.
  const origin = new URL(req.url).origin;
  const briefId = (row as { id?: string } | undefined)?.id;
  const target = kind === 'follow_up' && briefId ? `${origin}/brief/${briefId}#after` : kind === 'overdue' || kind === 'bump' ? `${origin}/pipeline` : kind === 'weekly' ? `${origin}/raise` : briefId && kind === 'pre_meeting' ? `${origin}/brief/${briefId}#card` : briefId && kind === 'brief_ready' ? `${origin}/brief/${briefId}` : `${origin}/meetings`;
  const soon = new Date(Date.now() + 2 * 3600_000).toISOString();
  const mail = renderEmail({
    kind, founderName: (await getProfile(ws)).founderName, ...base, meetingAt: soon,
    newSince: kind === 'pre_meeting' ? ['(In a real email: events dated after your last brief appear here.)'] : undefined,
    overdue: [{ investor: r?.investor.name ?? 'An investor', nextStep: 'Send the cohort retention data', due: '2026-10-10' }],
    today: [{ investor: r?.investor.name ?? 'An investor', firm: r?.investor.firm ?? '', time: '11:00 IST', briefReady: true }],
    bump: { investor: r?.investor.name ?? 'An investor', firm: r?.investor.firm ?? 'Their firm', days: 8, draft: { subject: 'Quick update from Sattva Kitchen', body: `Hi ${(r?.investor.name ?? 'there').split(' ')[0]},\n\nA quick note since I sent over the cohort data last week. (In a real email this is drafted from your own notes and verified facts about the investor, never invented.)\n\nHappy to answer anything, and no problem at all if the timing is not right.\n\nBest,\n${(await getProfile(ws)).founderName}` } },
    weekly: { held: [`${r?.investor.name ?? 'An investor'} (${r?.investor.firm ?? 'Their firm'})`], upcoming: [`${r?.investor.name ?? 'An investor'}, 11:00 IST on 20 Oct`], pendingFollowUps: ['(Investors you have met but not yet followed up with appear here.)'], overdue: ['A next step that passed its date appears here.'], pipeline: '2 researching, 1 meeting booked, 1 met', raise: 'Your committed amount against your target appears here once you set up your round on the Raise page' },
    followUpFor: r?.investor.name, openUrl: target, unsubscribeUrl: `${origin}/meetings#nudges`, confirmUrl: `${origin}/meetings`,
  });
  return new Response(mail.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", 'cache-control': 'no-store' } });
}
