import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { logEvent } from '@/lib/db';
import { createDiscovery, latestDiscovery, runDiscoveryJob } from '@/lib/discoverStore';
import { allow, clientKey, currentWorkspace, getProfile } from '@/lib/store';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const Body = z.object({ focus: z.string().trim().max(300).optional() });

export async function GET() {
  const ws = await currentWorkspace();
  return NextResponse.json({ discovery: await latestDiscovery(ws) });
}

export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => ({})));
  if (!b.success) return NextResponse.json({ error: 'The focus note is too long.' }, { status: 400 });
  const ws = await currentWorkspace();
  const running = await latestDiscovery(ws);
  if (running?.status === 'running') return NextResponse.json({ id: running.id, resumed: true });
  const ip = await clientKey();
  const ok = (await allow(`disc:${ws}`, 6, 86_400_000)) && (await allow(`discip:${ip}`, 10, 86_400_000)) && (await allow('discglobal', 80, 86_400_000));
  if (!ok) { await logEvent('api', 'rate_limited', null, { ws, what: 'discover' }); return NextResponse.json({ error: 'You have reached the daily limit for investor searches. Please try again tomorrow.' }, { status: 429 }); }
  const profile = await getProfile(ws);
  const focus = b.data.focus || null;
  const id = await createDiscovery(ws, focus);
  after(() => runDiscoveryJob(id, profile, focus));
  return NextResponse.json({ id });
}
