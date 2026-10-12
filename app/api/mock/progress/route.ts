import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentWorkspace } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Every scored mock round in this workspace, newest first, for the progress chart.
export async function GET() {
  const ws = await currentWorkspace();
  const rows = (await db().from('mock_sessions').select('id,created_at,difficulty,overall,investor_name,firm,score').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(40)).data ?? [];
  return NextResponse.json({ sessions: rows });
}
