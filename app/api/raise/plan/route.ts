import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlan, savePlan } from '@/lib/raiseStore';
import { allow, currentWorkspace } from '@/lib/store';

export const dynamic = 'force-dynamic';

const money = z.number().finite().min(0).max(1e13).nullable();
const Body = z.object({
  currency: z.enum(['USD', 'INR']), target: z.number().finite().min(0).max(1e13), pre_money: money, min_close: money,
  close_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), founder_pct: z.number().finite().min(0).max(100).nullable(), monthly_burn: money,
});

export async function GET() {
  return NextResponse.json({ plan: await getPlan(await currentWorkspace()) });
}

export async function PUT(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'Check the numbers and try again.' }, { status: 400 });
  const ws = await currentWorkspace();
  if (!(await allow(`raise:${ws}`, 400, 3600_000))) return NextResponse.json({ error: 'Too many edits. Try again shortly.' }, { status: 429 });
  await savePlan(ws, b.data);
  return NextResponse.json({ ok: true });
}
