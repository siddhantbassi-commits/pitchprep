import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { allow, currentWorkspace, getBrief } from '@/lib/store';

const Body = z.object({ claimId: z.string().max(12).nullable().optional(), verdict: z.enum(['wrong', 'outdated', 'helpful']), comment: z.string().max(500).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  const brief = await getBrief(id, ws, null);
  if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });
  if (!(await allow(`fb:${ws}`, 60, 3600_000))) return NextResponse.json({ error: 'Too many reports' }, { status: 429 });
  await db().from('feedback').insert({ brief_id: id, claim_id: body.data.claimId ?? null, verdict: body.data.verdict, comment: body.data.comment ?? null });
  return NextResponse.json({ ok: true });
}
