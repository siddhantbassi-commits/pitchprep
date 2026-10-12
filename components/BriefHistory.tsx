'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONF_LABEL, fmtDateTime, fmtSecs } from '@/lib/format';
import type { Confidence } from '@/lib/types';
import type { ListRow } from './BriefList';

export default function BriefHistory({ rows }: { rows: ListRow[] }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState(rows);
  const [err, setErr] = useState('');
  const router = useRouter();
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return t ? items.filter((r) => `${r.investor_name} ${r.firm}`.toLowerCase().includes(t)) : items; }, [items, q]);

  async function remove(r: ListRow) {
    if (!confirm(`Delete the brief on ${r.investor_name}?`)) return;
    const res = await fetch(`/api/briefs/${r.id}`, { method: 'DELETE' });
    if (res.ok) { setItems((x) => x.filter((y) => y.id !== r.id)); router.refresh(); } else setErr('Could not delete that brief.');
  }

  if (!items.length) return <p className="card p-5 text-muted">No briefs yet. <Link className="underline" href="/">Generate your first one</Link>.</p>;
  return (
    <div>
      <label className="sr-only" htmlFor="hq">Search your briefs</label>
      <input id="hq" className="input sm:max-w-sm" placeholder="Search by investor or firm" value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <p role="alert" className="mt-2 text-sm text-red">{err}</p>}
      <ul className="card mt-4 divide-y divide-line">
        {shown.length === 0 && <li className="p-5 text-muted">No briefs match &ldquo;{q}&rdquo;.</li>}
        {shown.map((r) => (
          <li key={r.id} className="flex items-center gap-2 pr-3">
            <Link href={`/brief/${r.id}`} className="flex flex-1 min-w-0 items-center justify-between gap-4 p-4 hover:bg-brand-soft/50 rounded-[inherit]">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.investor_name} <span className="text-muted font-normal">· {r.firm}</span></p>
                <p className="text-sm text-muted">{fmtDateTime(r.created_at)}{r.claims_verified != null ? ` · ${r.claims_verified} verified claims from ${r.sources} sources` : ''}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-sm">
                {r.latency_ms ? <span className="text-muted hidden sm:inline">{fmtSecs(r.latency_ms)}</span> : null}
                <span className="chip">{r.status === 'running' ? 'In progress' : r.status === 'failed' ? 'Failed' : r.status === 'unverified' ? 'Could not verify' : CONF_LABEL[(r.confidence ?? 'none') as Confidence]}</span>
              </div>
            </Link>
            <button className="text-sm text-muted hover:text-red underline shrink-0" onClick={() => remove(r)} aria-label={`Delete brief on ${r.investor_name}`}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
