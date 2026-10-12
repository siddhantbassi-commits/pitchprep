import { NextResponse } from 'next/server';
import { db, logEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Supabase free projects pause when idle; this touches the database so it never does. Scheduled by GitHub Actions.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  await logEvent('cron', 'keepalive', null, {});
  const r = await db().from('briefs').select('id', { head: true, count: 'exact' });
  return NextResponse.json({ ok: !r.error });
}
