import { db } from './db';

export interface Stats {
  days: number;
  briefs: number;
  finished: number;
  failed: number;
  successRate: number | null;
  p50: number | null;
  p95: number | null;
  under120: number | null;
  avgCost: number | null;
  totalCost: number;
  avgVerified: number | null;
  passRate: number | null;
  avgSources: number | null;
  latencyBuckets: { label: string; n: number }[];
  perDay: { day: string; n: number }[];
  dropReasons: { reason: string; n: number }[];
  statusMix: Record<string, number>;
  confidenceMix: Record<string, number>;
  feedback: Record<string, number>;
  hoursSaved: number;
}

const pct = (a: number[], p: number) => (a.length ? a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : null);

export async function getStats(days = 30): Promise<Stats> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [b, c, f] = await Promise.all([
    db().from('briefs').select('id,status,latency_ms,cost_usd,claims_verified,claims_dropped,sources,confidence,created_at').gte('created_at', since).limit(5000),
    db().from('claims').select('drop_reason,verified,briefs!inner(created_at)').gte('briefs.created_at', since).limit(30000),
    db().from('feedback').select('verdict').gte('created_at', since).limit(5000),
  ]);
  const rows = b.data ?? [];
  const done = rows.filter((r) => r.status !== 'running');
  const timed = done.filter((r) => r.latency_ms != null && r.status !== 'failed');
  const lat = timed.map((r) => r.latency_ms as number).sort((x, y) => x - y);
  const verified = done.reduce((n, r) => n + (r.claims_verified ?? 0), 0);
  const dropped = done.reduce((n, r) => n + (r.claims_dropped ?? 0), 0);
  const withCost = done.filter((r) => r.cost_usd != null);
  const totalCost = withCost.reduce((n, r) => n + Number(r.cost_usd), 0);
  const buckets = [['under 30s', 0, 30], ['30 to 60s', 30, 60], ['60 to 90s', 60, 90], ['90 to 120s', 90, 120], ['over 120s', 120, 1e9]] as const;
  const count = <T extends string>(xs: (T | null | undefined)[]) => xs.reduce<Record<string, number>>((m, x) => { if (x) m[x] = (m[x] ?? 0) + 1; return m; }, {});
  const perDayMap = count(rows.map((r) => r.created_at.slice(0, 10)));
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day: d, n: perDayMap[d] ?? 0 };
  });
  const reasons = count((c.data ?? []).filter((x) => !x.verified).map((x) => x.drop_reason));
  const good = done.filter((r) => r.status === 'complete' || r.status === 'partial' || r.status === 'unverified').length;
  return {
    days,
    briefs: rows.length,
    finished: done.length,
    failed: done.filter((r) => r.status === 'failed').length,
    successRate: done.length ? good / done.length : null,
    p50: pct(lat, 50),
    p95: pct(lat, 95),
    under120: lat.length ? lat.filter((x) => x < 120_000).length / lat.length : null,
    avgCost: withCost.length ? totalCost / withCost.length : null,
    totalCost,
    avgVerified: done.length ? verified / done.length : null,
    passRate: verified + dropped ? verified / (verified + dropped) : null,
    avgSources: done.length ? done.reduce((n, r) => n + (r.sources ?? 0), 0) / done.length : null,
    latencyBuckets: buckets.map(([label, lo, hi]) => ({ label, n: lat.filter((x) => x >= lo * 1000 && x < hi * 1000).length })),
    perDay,
    dropReasons: Object.entries(reasons).map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n),
    statusMix: count(rows.map((r) => r.status)),
    confidenceMix: count(done.map((r) => r.confidence)),
    feedback: count((f.data ?? []).map((x) => x.verdict)),
    hoursSaved: (done.filter((r) => r.status === 'complete').length * 44) / 60, // vs the 45 minutes of manual prep in the brief
  };
}
