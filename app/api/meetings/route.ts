import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listMeetings } from '@/lib/calendar';
import { currentWorkspace } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ws = await currentWorkspace();
  const feed = (await db().from('calendar_feeds').select('auto_prepare,last_synced_at,last_error').eq('workspace_id', ws).maybeSingle()).data;
  return NextResponse.json({ connected: !!feed, feed, meetings: feed ? await listMeetings(ws) : [] });
}
