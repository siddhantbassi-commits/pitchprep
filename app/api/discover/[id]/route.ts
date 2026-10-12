import { NextResponse } from 'next/server';
import { getDiscovery } from '@/lib/discoverStore';
import { currentWorkspace } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const ws = await currentWorkspace();
  const row = await getDiscovery(id, ws);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ discovery: row });
}
