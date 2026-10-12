import { NextResponse } from 'next/server';
import { deleteBrief, getBrief, currentWorkspace, loadDelta, shareToken } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const ws = await currentWorkspace().catch(() => null);
  const row = await getBrief(id, ws, url.searchParams.get('t'));
  if (!row) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  const isOwner = !!ws && ws === row.workspace_id;
  return NextResponse.json({
    delta: await loadDelta(row, isOwner),
    id: row.id, status: row.status, stages: row.stages, result: row.result, error: row.error, investor: { name: row.investor_name, firm: row.firm },
    createdAt: row.created_at, isOwner: !!ws && ws === row.workspace_id, isSeed: row.is_seed, profile: row.profile_snapshot, meetingAt: row.meeting_at,
  });
}

// POST = create or fetch the share link for a brief you own.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  const token = await shareToken(id, ws);
  if (!token) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  return NextResponse.json({ path: `/brief/${id}?t=${token}` });
}

// DELETE = remove one of your own briefs (its claims and sources go with it).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await currentWorkspace();
  if (!(await deleteBrief(id, ws))) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
