import Link from 'next/link';
import { CONF_LABEL, fmtDateTime, fmtSecs } from '@/lib/format';
import type { Confidence } from '@/lib/types';

export interface ListRow {
  id: string; investor_name: string; firm: string; status: string; confidence: string | null; created_at: string;
  latency_ms: number | null; claims_verified: number | null; sources: number | null;
}

export default function BriefList({ rows, empty }: { rows: ListRow[]; empty: string }) {
  if (!rows.length) return <p className="card p-5 text-muted">{empty}</p>;
  return (
    <ul className="card divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/brief/${r.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-brand-soft/50 rounded-[inherit]">
            <div className="min-w-0">
              <p className="font-medium truncate">{r.investor_name} <span className="text-muted font-normal">· {r.firm}</span></p>
              <p className="text-sm text-muted">{fmtDateTime(r.created_at)}{r.claims_verified != null ? ` · ${r.claims_verified} verified claims from ${r.sources} sources` : ''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-sm">
              {r.latency_ms ? <span className="text-muted hidden sm:inline">{fmtSecs(r.latency_ms)}</span> : null}
              <span className="chip">{r.status === 'running' ? 'In progress' : r.status === 'failed' ? 'Failed' : r.status === 'unverified' ? 'Could not verify' : CONF_LABEL[(r.confidence ?? 'none') as Confidence]}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
