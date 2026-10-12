import { demoIcs } from '@/lib/demoCalendar';

export const dynamic = 'force-dynamic';

// A generated sample calendar (fictional meetings, always in the coming days) for trying the Meetings feature.
export function GET() {
  return new Response(demoIcs(), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
}
