'use client';

import { useMemo } from 'react';
import { fmtDate } from '@/lib/format';
import { progress, type SessionLite } from '@/lib/progress';

/** Overall score per mock round as a small line chart, the four dimensions as bars, and plain-language insights. */
export default function PracticeProgress({ sessions, compact = false }: { sessions: SessionLite[]; compact?: boolean }) {
  const p = useMemo(() => progress(sessions), [sessions]);
  if (p.rounds === 0) return null;
  const W = 520, H = 130, PAD = 24;
  const x = (i: number) => (p.points.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (p.points.length - 1));
  const y = (v: number) => H - PAD - (v / 100) * (H - 2 * PAD);
  const line = p.points.map((pt, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pt.overall).toFixed(1)}`).join(' ');
  const summary = `Mock meeting scores across ${p.rounds} round${p.rounds === 1 ? '' : 's'}: ${p.points.map((pt) => pt.overall).join(', ')} out of 100.`;
  return (
    <div className={compact ? '' : 'card p-5 sm:p-6'}>
      {!compact && <h2 className="text-xl font-semibold">Your practice progress</h2>}
      <ul className="mt-2 space-y-1 text-sm">{p.insights.map((t) => <li key={t}>{t}</li>)}</ul>
      <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
        <figure>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="w-full h-auto">
            {[0, 50, 100].map((g) => (
              <g key={g}><line x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="1" /><text x={2} y={y(g) + 4} fontSize="11" fill="var(--muted)">{g}</text></g>
            ))}
            {p.points.length > 1 && <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.5" />}
            {p.points.map((pt, i) => (
              <g key={pt.id}><circle cx={x(i)} cy={y(pt.overall)} r="5" fill="var(--brand)" /><text x={x(i)} y={y(pt.overall) - 10} fontSize="12" textAnchor="middle" fill="var(--ink)">{pt.overall}</text></g>
            ))}
          </svg>
          <figcaption className="text-xs text-muted">Overall score out of 100, oldest round on the left.</figcaption>
          <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer underline">Show as a list</summary>
            <ul className="mt-1">{p.points.map((pt) => <li key={pt.id}>{fmtDate(pt.at.slice(0, 10))} · {pt.investor} · {pt.difficulty} · {pt.overall}/100</li>)}</ul>
          </details>
        </figure>
        <div>
          <p className="label">Average by skill (out of 5)</p>
          <ul className="mt-2 space-y-2">
            {p.dims.map((d) => (
              <li key={d.key} className="text-sm">
                <div className="flex justify-between"><span>{d.label}</span><span className="text-muted">{d.average}{p.rounds > 1 ? ` · ${d.first} to ${d.last}` : ''}</span></div>
                <div className="mt-1 h-2 rounded-full bg-line" aria-hidden><div className="h-2 rounded-full bg-brand" style={{ width: `${(d.average / 5) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
