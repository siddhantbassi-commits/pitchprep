'use client';

import { useEffect, useState } from 'react';

/** How old the research is, and a nudge to refresh when a meeting is close. Computed after load so server and browser always agree. */
export default function FreshnessChip({ asOf, meetingAt, onRefresh }: { asOf: string; meetingAt: string | null; onRefresh: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, []);
  if (now == null) return null;
  const hours = Math.max(0, (now - Date.parse(asOf)) / 3_600_000);
  const toMeeting = meetingAt ? (Date.parse(meetingAt) - now) / 3_600_000 : null;
  const age = hours < 1 ? 'less than an hour ago' : hours < 48 ? `${Math.round(hours)} hours ago` : `${Math.round(hours / 24)} days ago`;
  const stale = hours > 72 || (toMeeting != null && toMeeting > 0 && toMeeting < 48 && hours > 12);
  return (
    <p className={`no-print mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border px-3 py-1 text-xs ${stale ? 'border-transparent bg-amber-soft text-amber' : 'border-line bg-surface text-muted'}`}>
      <span aria-hidden>{stale ? '●' : '○'}</span>
      Researched {age}.{stale && ' Public news moves fast.'}
      {stale && <button className="font-semibold underline" onClick={onRefresh}>Refresh before you rely on it</button>}
    </p>
  );
}
