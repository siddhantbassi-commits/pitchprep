import { NextResponse } from 'next/server';
import { syncCalendar } from '@/lib/calendar';
import { allow, currentWorkspace } from '@/lib/store';

export const maxDuration = 60;

export async function POST() {
  const ws = await currentWorkspace();
  if (!(await allow(`cal:${ws}`, 20, 3600_000))) return NextResponse.json({ error: 'Too many calendar syncs. Try again later.' }, { status: 429 });
  const r = await syncCalendar(ws);
  return NextResponse.json({ meetings: r.meetings, error: r.error ?? null });
}
