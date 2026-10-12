import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reviewAnswer } from '@/lib/assist';
import { Meter } from '@/lib/gemini';
import { logEvent } from '@/lib/db';
import { allow, currentWorkspace, getBrief, getProfile } from '@/lib/store';

export const maxDuration = 60;
const Body = z.object({ question: z.string().trim().min(5).max(400), prep: z.string().max(600).default(''), answer: z.string().trim().min(20).max(2500) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  const brief = await getBrief(id, ws, null);
  if (!brief?.result) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'Write a few sentences as if you were answering out loud.' }, { status: 400 });
  if (!(await allow(`assist:${ws}`, 20, 3600_000)) || !(await allow('assist-global', 400, 86_400_000))) return NextResponse.json({ error: 'Too many reviews for now. Try again later.' }, { status: 429 });
  try {
    const meter = new Meter();
    const r = brief.result;
    const out = await reviewAnswer({ question: b.data.question, prep: b.data.prep, answer: b.data.answer, investorLine: `${r.investor.name}, ${r.investor.firm}. Fit read: ${r.synthesis ? `stage ${r.synthesis.fit.stage}, sector ${r.synthesis.fit.sector}, cheque ${r.synthesis.fit.cheque}` : 'unknown'}`, profile: await getProfile(ws), meter });
    await logEvent('assist', 'rehearse', id, { cost: meter.u.costUsd });
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: 'The review did not come back in time. Please try again.' }, { status: 502 });
  }
}
