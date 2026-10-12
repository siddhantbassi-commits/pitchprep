import { NextResponse } from 'next/server';
import { FounderProfile } from '@/lib/types';
import { currentWorkspace, getProfile, saveProfile } from '@/lib/store';

export async function GET() {
  const ws = await currentWorkspace();
  return NextResponse.json({ profile: await getProfile(ws) });
}

export async function PUT(req: Request) {
  const body = FounderProfile.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Please fill in every field.' }, { status: 400 });
  const clip = (s: string) => s.slice(0, 1200);
  const p = Object.fromEntries(Object.entries(body.data).map(([k, v]) => [k, clip(String(v))])) as typeof body.data;
  const ws = await currentWorkspace();
  await saveProfile(ws, p);
  return NextResponse.json({ ok: true });
}
