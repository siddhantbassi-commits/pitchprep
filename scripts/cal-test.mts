// Local integration test for calendar detection (no URL fetch): npm run cal-test -- path/to/file.ics [workspace-uuid]
import { readFileSync } from 'node:fs';
import { db, must } from '../lib/db';
import { ingestIcs } from '../lib/calendar';

const ws = process.argv[3] ?? '00000000-0000-4000-8000-0000000000ca';
must(await db().from('workspaces').upsert({ id: ws }, { onConflict: 'id' }), 'ws');
must(await db().from('calendar_feeds').upsert({ workspace_id: ws, ical_url: 'https://example.com/test.ics', auto_prepare: false }), 'feed');
await db().from('meetings').delete().eq('workspace_id', ws);
const { meetings } = await ingestIcs(ws, readFileSync(process.argv[2], 'utf8'));
for (const m of meetings) console.log(`${m.is_investor ? 'INVESTOR ' : 'other    '} [${m.confidence}] ${m.title} -> name=${m.investor_name} firm=${m.firm}`);
