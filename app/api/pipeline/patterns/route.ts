import { NextResponse } from 'next/server';
import { db, logEvent } from '@/lib/db';
import { Meter } from '@/lib/gemini';
import { findPatterns } from '@/lib/patterns';
import { allow, currentWorkspace, getProfile } from '@/lib/store';

export const maxDuration = 60;

export async function POST() {
  const ws = await currentWorkspace();
  if (!(await allow(`assist:${ws}`, 20, 3600_000)) || !(await allow('assist-global', 400, 86_400_000))) return NextResponse.json({ error: 'Too many requests for now. Try again later.' }, { status: 429 });
  const rows = ((await db().from('investor_notes').select('investor_name,firm,notes').eq('workspace_id', ws)).data ?? []) as { investor_name: string; firm: string; notes: string }[];
  try {
    const meter = new Meter();
    const r = await findPatterns(rows.map((n) => ({ name: n.investor_name, firm: n.firm, notes: n.notes })), await getProfile(ws), meter);
    await logEvent('assist', 'patterns', null, { cost: meter.u.costUsd, themes: r.themes.length });
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ error: 'That did not come back in time. Please try again.' }, { status: 502 });
  }
}
