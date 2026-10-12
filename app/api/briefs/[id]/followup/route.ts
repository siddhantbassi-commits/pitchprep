import { NextResponse } from 'next/server';
import { z } from 'zod';
import { draftFollowup } from '@/lib/assist';
import { Meter } from '@/lib/gemini';
import { logEvent } from '@/lib/db';
import { allow, currentWorkspace, getBrief, getProfile } from '@/lib/store';

export const maxDuration = 60;
const Body = z.object({ discussed: z.string().trim().min(10).max(4000), tone: z.enum(['warm', 'concise']).default('warm') });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  const brief = await getBrief(id, ws, null);
  if (!brief?.result) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'Add a few words about what you discussed so the draft is specific.' }, { status: 400 });
  if (!(await allow(`assist:${ws}`, 20, 3600_000)) || !(await allow('assist-global', 400, 86_400_000))) return NextResponse.json({ error: 'Too many drafts for now. Try again later.' }, { status: 429 });
  try {
    const meter = new Meter();
    const draft = await draftFollowup({ result: brief.result, profile: await getProfile(ws), discussed: b.data.discussed, tone: b.data.tone, meter });
    await logEvent('assist', 'followup', id, { cost: meter.u.costUsd });
    return NextResponse.json({ ...draft });
  } catch (e) {
    return NextResponse.json({ error: 'The draft did not come back in time. Please try again.' }, { status: 502 });
  }
}
