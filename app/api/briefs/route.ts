import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { logEvent } from '@/lib/db';
import { runBriefJob } from '@/lib/job';
import { allow, clientKey, createBrief, currentWorkspace, getProfile, investorKey, listBriefs, recentComplete } from '@/lib/store';

export const maxDuration = 300;

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  firm: z.string().trim().min(2).max(80),
  context: z.string().trim().max(6000).optional(),
  meetingAt: z.string().datetime().optional().nullable(),
  fresh: z.boolean().optional(),
});

export async function GET() {
  const ws = await currentWorkspace();
  return NextResponse.json({ briefs: await listBriefs(ws) });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Please enter the investor name and their firm.' }, { status: 400 });
  const { name, firm, context, meetingAt, fresh } = parsed.data;
  if (/[<>{}\[\]]/.test(name + firm)) return NextResponse.json({ error: 'Names can only contain letters, numbers and basic punctuation.' }, { status: 400 });

  const ws = await currentWorkspace();
  // Reuse a brief generated for the same investor in the last 6 hours: instant, and it protects the search quota.
  if (!fresh && !context) {
    const cached = await recentComplete(ws, investorKey(name, firm), 6 * 3600_000);
    if (cached) return NextResponse.json({ id: cached, cached: true });
  }
  const ip = await clientKey();
  const ok =
    (await allow(`ws:${ws}`, 8, 3600_000)) && (await allow(`ip:${ip}`, 15, 3600_000)) && (await allow('global', 150, 86_400_000));
  if (!ok) {
    await logEvent('api', 'rate_limited', null, { ws });
    return NextResponse.json({ error: 'You have reached the hourly limit for new briefs. Please try again a little later.' }, { status: 429 });
  }

  const profile = await getProfile(ws);
  const id = await createBrief({ ws, name, firm, userContext: context ?? null, meetingAt: meetingAt ?? null, profile });
  after(() => runBriefJob(id, { name, firm, profile, userContext: context }));
  return NextResponse.json({ id, cached: false });
}
