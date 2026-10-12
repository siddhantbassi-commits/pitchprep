import { after, NextResponse } from 'next/server';
import { db, logEvent } from '@/lib/db';
import { prepareMeeting, syncCalendar, type MeetingRow } from '@/lib/calendar';
import { runNudges } from '@/lib/nudges';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Called every 30 minutes by GitHub Actions. For workspaces with auto-prepare on, creates briefs for investor
// meetings starting in the next 24 hours. At most 3 per run keeps us inside the function time limit.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const feeds = (await db().from('calendar_feeds').select('workspace_id').eq('auto_prepare', true).limit(50)).data ?? [];
  let prepared = 0;
  const jobs: (() => Promise<void>)[] = [];
  for (const f of feeds) {
    if (prepared >= 3) break;
    const ws = f.workspace_id as string;
    const { meetings } = await syncCalendar(ws);
    const horizon = Date.now() + 24 * 3600_000;
    const due = meetings.filter((m: MeetingRow) => m.is_investor && m.status === 'detected' && m.investor_name && m.firm && Date.parse(m.starts_at) < horizon);
    for (const m of due) {
      if (prepared >= 3) break;
      const { run } = await prepareMeeting(ws, m.id, m.investor_name!, m.firm!);
      jobs.push(run);
      prepared++;
    }
  }
  // Then send whatever email nudges are due (brief ready, refreshed brief before a meeting, follow-up and overdue reminders).
  const n = await runNudges(new Date(), new URL(req.url).origin).catch(() => null);
  if (n) jobs.push(...n.jobs);
  if (jobs.length) after(() => Promise.all(jobs.map((j) => j())).then(() => undefined));
  await logEvent('cron', 'meetings', null, { feeds: feeds.length, prepared, nudges: n ? { sent: n.sent, refreshed: n.refreshed, failed: n.failed, configured: n.configured } : 'error' });
  return NextResponse.json({ feeds: feeds.length, prepared, nudges: n ? { configured: n.configured, workspaces: n.workspaces, sent: n.sent, refreshed: n.refreshed, failed: n.failed } : null });
}
