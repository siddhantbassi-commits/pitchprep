import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, logEvent } from '@/lib/db';
import { Meter } from '@/lib/gemini';
import { nextQuestion, QUESTIONS, scoreSession } from '@/lib/mock';
import { allow, currentWorkspace, getBrief, getProfile } from '@/lib/store';

export const maxDuration = 90;
export const dynamic = 'force-dynamic';

const Turn = z.object({ role: z.enum(['investor', 'founder']), text: z.string().trim().min(1).max(2500) });
const Body = z.object({ action: z.enum(['turn', 'score']), difficulty: z.enum(['friendly', 'tough']), turns: z.array(Turn).max(QUESTIONS * 2) });

// Past practice rounds for this investor, newest first.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  const rows = (await db().from('mock_sessions').select('id,difficulty,overall,created_at').eq('workspace_id', ws).eq('brief_id', id).order('created_at', { ascending: false }).limit(8)).data ?? [];
  return NextResponse.json({ sessions: rows });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  const brief = await getBrief(id, ws, null);
  if (!brief?.result || brief.result.status === 'unverified') return NextResponse.json({ error: 'A mock meeting needs a verified brief.' }, { status: 404 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'That did not look right. Reload and try again.' }, { status: 400 });
  const { action, difficulty, turns } = b.data;
  if (!(await allow(`mock:${ws}`, 60, 3600_000)) || !(await allow('mock-global', 1500, 86_400_000))) return NextResponse.json({ error: 'Too many practice rounds for now. Try again later.' }, { status: 429 });

  const founderTurns = turns.filter((t) => t.role === 'founder').length;
  const investorTurns = turns.filter((t) => t.role === 'investor').length;
  try {
    const meter = new Meter();
    const profile = await getProfile(ws);
    if (action === 'turn') {
      const alternating = turns.every((t, i) => t.role === (i % 2 === 0 ? 'investor' : 'founder'));
      if (!alternating || (turns.length && turns[turns.length - 1].role !== 'founder') || investorTurns >= QUESTIONS) return NextResponse.json({ error: 'That did not look right. Reload and try again.' }, { status: 400 });
      const question = await nextQuestion({ result: brief.result, profile, difficulty, turns, meter });
      return NextResponse.json({ question });
    }
    const answeredOnly = turns.length && turns[turns.length - 1].role === 'investor' ? turns.slice(0, -1) : turns; // an unanswered last question is not scored
    if (founderTurns < 3) return NextResponse.json({ error: 'Answer at least three questions to get a scorecard.' }, { status: 400 });
    const card = await scoreSession({ result: brief.result, profile, difficulty, turns: answeredOnly, meter });
    await db().from('mock_sessions').insert({ workspace_id: ws, brief_id: id, investor_name: brief.investor_name, firm: brief.firm, difficulty, turns: answeredOnly, score: card, overall: card.overall });
    await logEvent('assist', 'mock_scored', id, { overall: card.overall, cost: meter.u.costUsd });
    return NextResponse.json({ card });
  } catch {
    return NextResponse.json({ error: 'That did not come back in time. Please try again.' }, { status: 502 });
  }
}
