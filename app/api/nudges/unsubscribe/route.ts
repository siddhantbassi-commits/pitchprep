import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

// Works for the Unsubscribe button in mail apps (a one-click POST with the token in the URL) and for the button on our own page.
export async function POST(req: Request) {
  const url = new URL(req.url);
  let t = url.searchParams.get('t');
  if (!t) { const j = await req.json().catch(() => null); t = typeof j?.t === 'string' ? j.t : null; }
  const tok = t ? verifyToken<{ ws: string }>(t, 'unsub') : null;
  if (!tok) return NextResponse.json({ error: 'This unsubscribe link is not valid.' }, { status: 400 });
  await db().from('nudge_prefs').update({ enabled: false }).eq('workspace_id', tok.ws);
  return NextResponse.json({ ok: true });
}
