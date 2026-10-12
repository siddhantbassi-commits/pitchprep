import { NextResponse } from 'next/server';
import { adoptBrief, allow, currentWorkspace } from '@/lib/store';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  if (!(await allow(`adopt:${ws}`, 30, 3600_000))) return NextResponse.json({ error: 'Too many copies. Try again later.' }, { status: 429 });
  const copy = await adoptBrief(id, ws);
  if (!copy) return NextResponse.json({ error: 'Example not found' }, { status: 404 });
  return NextResponse.json({ id: copy });
}
