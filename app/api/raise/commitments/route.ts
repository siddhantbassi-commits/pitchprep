import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CSTATUSES } from '@/lib/raise';
import { deleteCommitment, listCommitments, upsertCommitment } from '@/lib/raiseStore';
import { allow, currentWorkspace, investorKey } from '@/lib/store';

export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().trim().min(2).max(80), firm: z.string().trim().max(80).default(''),
  amount: z.number().finite().min(0).max(1e13), status: z.enum(CSTATUSES as [string, ...string[]]), is_lead: z.boolean().default(false),
});

export async function GET() {
  return NextResponse.json({ commitments: await listCommitments(await currentWorkspace()) });
}

export async function PUT(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'Check the investor name, amount and status.' }, { status: 400 });
  const ws = await currentWorkspace();
  if (!(await allow(`raise:${ws}`, 400, 3600_000))) return NextResponse.json({ error: 'Too many edits. Try again shortly.' }, { status: 429 });
  await upsertCommitment(ws, { ...b.data, status: b.data.status as never });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  await deleteCommitment(await currentWorkspace(), key);
  return NextResponse.json({ ok: true, key, normalised: investorKey(key, '') });
}
