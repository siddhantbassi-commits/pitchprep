import { NextResponse } from 'next/server';
import { sendSimple } from '@/lib/nudges';
import { currentWorkspace } from '@/lib/store';

export const maxDuration = 30;

// "Email me a link to open PitchPrep on my phone": a one-tap sign-in for another device, sent to the confirmed address only.
export async function POST(req: Request) {
  const ws = await currentWorkspace();
  const r = await sendSimple(ws, 'signin', new URL(req.url).origin);
  if (r.dryRun) return NextResponse.json({ ok: false, dryRun: true, error: 'Email sending is not switched on for this server yet.' }, { status: 503 });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error ?? 'Could not send.' }, { status: r.limited ? 429 : 400 });
  return NextResponse.json({ ok: true });
}
