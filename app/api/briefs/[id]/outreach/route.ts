import { NextResponse } from 'next/server';
import { z } from 'zod';
import { draftOutreach } from '@/lib/assist';
import { logEvent } from '@/lib/db';
import { Meter } from '@/lib/gemini';
import { allow, currentWorkspace, getBrief, getProfile } from '@/lib/store';

export const maxDuration = 60;
const Body = z.object({ channel: z.enum(['email', 'linkedin']), ask: z.string().trim().max(300).default('') });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  const brief = await getBrief(id, ws, null);
  if (!brief?.result) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'Choose email or LinkedIn.' }, { status: 400 });
  if (!(await allow(`assist:${ws}`, 20, 3600_000)) || !(await allow('assist-global', 400, 86_400_000))) return NextResponse.json({ error: 'Too many drafts for now. Try again later.' }, { status: 429 });
  try {
    const meter = new Meter();
    const d = await draftOutreach({ result: brief.result, profile: await getProfile(ws), channel: b.data.channel, ask: b.data.ask, meter });
    await logEvent('assist', 'outreach', id, { cost: meter.u.costUsd });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'The draft did not come back in time. Please try again.' }, { status: 502 });
  }
}
