import { NextResponse } from 'next/server';
import { z } from 'zod';
import { allow, currentWorkspace, getNote, investorKey, listPipeline, upsertNote } from '@/lib/store';
import { STATUSES } from '@/lib/tracker';

export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  firm: z.string().trim().min(2).max(80),
  status: z.enum(STATUSES).optional(),
  notes: z.string().max(5000).optional(),
  nextStep: z.string().max(300).optional(),
  nextStepOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function GET(req: Request) {
  const ws = await currentWorkspace();
  const u = new URL(req.url);
  const name = u.searchParams.get('name'), firm = u.searchParams.get('firm');
  if (name && firm) return NextResponse.json({ note: await getNote(ws, investorKey(name, firm)) });
  return NextResponse.json({ items: await listPipeline(ws) });
}

export async function PUT(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'That did not look right. Check the fields and try again.' }, { status: 400 });
  const ws = await currentWorkspace();
  if (!(await allow(`note:${ws}`, 300, 3600_000))) return NextResponse.json({ error: 'Too many edits. Try again shortly.' }, { status: 429 });
  const row = await upsertNote(ws, b.data);
  return NextResponse.json({ ok: true, note: row });
}
