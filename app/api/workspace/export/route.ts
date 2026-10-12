import { db } from '@/lib/db';
import { currentWorkspace, getProfile } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Data portability: everything we hold for this browser workspace, as one JSON file.
// The calendar link is deliberately left out (it is a credential); only whether one is connected is reported.
export async function GET() {
  const ws = await currentWorkspace();
  const [profile, briefs, notes, meetings, feed, nudge] = await Promise.all([
    getProfile(ws),
    db().from('briefs').select('id,investor_name,firm,status,created_at,meeting_at,result').eq('workspace_id', ws).eq('is_seed', false).order('created_at', { ascending: false }),
    db().from('investor_notes').select('investor_name,firm,status,notes,next_step,next_step_on,updated_at').eq('workspace_id', ws),
    db().from('meetings').select('title,starts_at,investor_name,firm,status').eq('workspace_id', ws),
    db().from('calendar_feeds').select('auto_prepare,last_synced_at').eq('workspace_id', ws).maybeSingle(),
    db().from('nudge_prefs').select('email,verified_at,enabled,brief_ready,pre_meeting,follow_up,overdue,daily_digest,lead_minutes').eq('workspace_id', ws).maybeSingle(),
  ]);
  const body = {
    exportedAt: new Date().toISOString(),
    note: 'Everything PitchPrep holds for this browser. Delete it any time from My startup.',
    founderProfile: profile,
    briefs: briefs.data ?? [],
    investorNotes: notes.data ?? [],
    meetings: meetings.data ?? [],
    emailNudges: nudge.data ?? null,
    calendar: feed.data ? { connected: true, autoPrepare: feed.data.auto_prepare, lastSyncedAt: feed.data.last_synced_at } : { connected: false },
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="pitchprep-my-data.json"', 'cache-control': 'no-store' },
  });
}
