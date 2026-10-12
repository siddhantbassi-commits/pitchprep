import { DROP_LABEL } from '@/lib/format';
import { getStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard: PitchPrep' };

const secs = (ms: number | null) => (ms == null ? '-' : `${(ms / 1000).toFixed(0)}s`);
const pct = (x: number | null) => (x == null ? '-' : `${Math.round(x * 100)}%`);

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="mt-1 text-3xl font-semibold font-serif">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

function Bars({ rows, max, fmt }: { rows: { label: string; n: number }[]; max?: number; fmt?: (n: number) => string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="text-muted truncate" title={r.label}>{r.label}</span>
          <span className="h-3 rounded bg-line overflow-hidden"><span className="block h-full bg-brand" style={{ width: `${(r.n / m) * 100}%` }} /></span>
          <span className="text-right tabular-nums">{fmt ? fmt(r.n) : r.n}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function Dashboard() {
  const s = await getStats(30).catch(() => null);
  if (!s) return <p className="text-muted">The dashboard could not reach the database.</p>;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="text-muted mb-6">Live from the database, last {s.days} days. Includes the cost of the tool doing the work.</p>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Tile label="Briefs generated" value={String(s.briefs)} sub={`${s.finished} finished, ${s.failed} failed`} />
        <Tile label="Median time" value={secs(s.p50)} sub={`95th percentile ${secs(s.p95)}`} />
        <Tile label="Under 2 minutes" value={pct(s.under120)} sub="Target from the brief: 100%" />
        <Tile label="Cost per brief" value={s.avgCost == null ? '-' : `$${s.avgCost.toFixed(3)}`} sub={`$${s.totalCost.toFixed(2)} total at list price`} />
        <Tile label="Claims passing verification" value={pct(s.passRate)} sub={`${s.avgVerified?.toFixed(1) ?? '-'} verified claims per brief`} />
        <Tile label="Sources per brief" value={s.avgSources?.toFixed(1) ?? '-'} sub="Each one opened and read" />
        <Tile label="Completion rate" value={pct(s.successRate)} sub="Briefs that ended with a result" />
        <Tile label="Prep time saved" value={`${s.hoursSaved.toFixed(1)}h`} sub="vs 45 minutes of manual prep each" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5"><h2 className="text-lg font-semibold mb-3">Time to brief</h2><Bars rows={s.latencyBuckets.map((b) => ({ label: b.label, n: b.n }))} /></section>
        <section className="card p-5"><h2 className="text-lg font-semibold mb-3">Briefs per day (14 days)</h2><Bars rows={s.perDay.map((d) => ({ label: d.day.slice(5), n: d.n }))} /></section>
        <section className="card p-5">
          <h2 className="text-lg font-semibold">What the gate left out</h2>
          <p className="text-xs text-muted mb-3">Candidate claims removed before you see them, and why.</p>
          {s.dropReasons.length ? <Bars rows={s.dropReasons.map((d) => ({ label: DROP_LABEL[d.reason] ?? d.reason, n: d.n }))} /> : <p className="text-sm text-muted">Nothing dropped yet.</p>}
        </section>
        <section className="card p-5">
          <h2 className="text-lg font-semibold mb-3">Outcomes and feedback</h2>
          <Bars rows={[...Object.entries(s.statusMix).map(([k, n]) => ({ label: `Status: ${k}`, n })), ...Object.entries(s.confidenceMix).map(([k, n]) => ({ label: `Confidence: ${k}`, n })), ...Object.entries(s.feedback).map(([k, n]) => ({ label: `Feedback: ${k}`, n }))]} />
        </section>
      </div>
    </div>
  );
}
