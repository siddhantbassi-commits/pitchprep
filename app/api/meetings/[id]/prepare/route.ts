import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { prepareMeeting } from '@/lib/calendar';
import { allow, clientKey, currentWorkspace } from '@/lib/store';

export const maxDuration = 300;

const Body = z.object({ name: z.string().trim().min(2).max(80), firm: z.string().trim().min(2).max(80) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Enter the investor name and firm.' }, { status: 400 });
  const ws = await currentWorkspace();
  const ip = await clientKey();
  if (!((await allow(`ws:${ws}`, 8, 3600_000)) && (await allow(`ip:${ip}`, 15, 3600_000)) && (await allow('global', 150, 86_400_000))))
    return NextResponse.json({ error: 'You have reached the hourly limit for new briefs.' }, { status: 429 });
  try {
    const { briefId, run } = await prepareMeeting(ws, id, body.data.name, body.data.firm);
    after(run);
    return NextResponse.json({ briefId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
