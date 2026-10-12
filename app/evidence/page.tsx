import Link from 'next/link';
import results from '../../docs/eval-results.json';
import { DROP_LABEL } from '@/lib/format';

export const metadata = { title: 'Evidence: PitchPrep', description: 'How PitchPrep is tested: live evaluation on real, fake and adversarial inputs, and an independent spot-check.' };

type R = {
  case: { id: string; kind: 'real' | 'fake' | 'adversarial'; name: string; firm: string; note: string };
  status: string; ms: number; cost: number; searches: number; deals: number; tps: number;
  stats?: { claimsExtracted: number; claimsVerified: number };
  audit?: { quoteMissing: number; noSource: number; dealOutOfWindow: number; undatedDeal: number; badTalkingRefs: number };
  checks?: [string, boolean][]; dropReasons?: string[];
};
const rows = results as unknown as R[];
const REPO = 'https://github.com/siddhantbassi-commits/pitchprep';

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="mt-1 text-3xl font-semibold font-serif">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function Evidence() {
  const real = rows.filter((r) => r.case.kind === 'real' && r.status !== 'error');
  const lat = real.map((r) => r.ms).sort((a, b) => a - b);
  const sum = (k: keyof NonNullable<R['audit']>) => real.reduce((n, r) => n + (r.audit?.[k] ?? 0), 0);
  const extracted = real.reduce((n, r) => n + (r.stats?.claimsExtracted ?? 0), 0);
  const verified = real.reduce((n, r) => n + (r.stats?.claimsVerified ?? 0), 0);
  const adv = rows.filter((r) => r.case.kind !== 'real').flatMap((r) => (r.checks ?? []).map(([name, pass]) => ({ id: r.case.id, name, pass })));
  const dropped = real.flatMap((r) => r.dropReasons ?? []).reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : 0;

  return (
    <div className="max-w-4xl">
      <p className="label">Evidence</p>
      <h1 className="mt-1 text-3xl font-semibold">How we know it is right</h1>
      <p className="mt-2 text-muted">A brief that is wrong about an investor is worse than none. So the system is tested on live data, on inputs designed to break it, and by hand. These numbers come from the evaluation run stored in the repository, not from a mock-up.</p>

      <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Tile label="Real investors tested" value={String(real.length)} sub="Live search, live sources" />
        <Tile label="Median time" value={`${Math.round(median / 1000)}s`} sub={`Slowest ${Math.round((lat[lat.length - 1] ?? 0) / 1000)}s. Target: under 120s`} />
        <Tile label="Quotes missing from source" value={String(sum('quoteMissing'))} sub="Shown claims re-audited independently" />
        <Tile label="Deals outside 90 days shown" value={String(sum('dealOutOfWindow') + sum('undatedDeal'))} sub="Out of window or undated" />
        <Tile label="Claims passing the gate" value={`${extracted ? Math.round((verified / extracted) * 100) : 0}%`} sub={`${verified} of ${extracted}; the rest were dropped`} />
        <Tile label="Fake or adversarial checks" value={`${adv.filter((a) => a.pass).length}/${adv.length}`} sub="Passed" />
        <Tile label="Cost per brief" value={`$${(real.reduce((n, r) => n + r.cost, 0) / Math.max(1, real.length)).toFixed(2)}`} sub="At list price" />
        <Tile label="Talking points citing a bad claim" value={String(sum('badTalkingRefs'))} sub="Each must cite a verified claim" />
      </div>

      <h2 className="mt-10 text-2xl font-semibold">Inputs designed to break it</h2>
      <ul className="card mt-3 divide-y divide-line">
        {rows.filter((r) => r.case.kind !== 'real').map((r) => (
          <li key={r.case.id} className="p-4">
            <p className="font-medium">{r.case.name}, {r.case.firm} <span className="chip ml-1">{r.case.kind}</span></p>
            <p className="text-sm text-muted">{r.case.note}. Outcome: <strong>{r.status}</strong>.</p>
            <ul className="mt-1 text-sm space-y-0.5">{(r.checks ?? []).map(([n, p], i) => <li key={i}><span className={p ? 'text-brand' : 'text-red'}>{p ? 'Passed' : 'FAILED'}</span> <span className="text-muted">{n}</span></li>)}</ul>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">What the gate caught</h2>
      <p className="text-sm text-muted">Claims the model produced that code removed before you saw them, across the real cases.</p>
      <ul className="card mt-3 divide-y divide-line">
        {Object.entries(dropped).sort((a, b) => b[1] - a[1]).map(([k, n]) => <li key={k} className="flex justify-between gap-4 p-3 text-sm"><span>{DROP_LABEL[k] ?? k}</span><span className="tabular-nums">{n}</span></li>)}
        {Object.keys(dropped).length === 0 && <li className="p-3 text-sm text-muted">Nothing was dropped in this run.</li>}
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Per-case results</h2>
      <div className="card mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Evaluation results table, scrollable">
        <table className="w-full text-sm">
          <caption className="sr-only">Evaluation results per case</caption>
          <thead><tr className="text-left text-muted border-b border-line"><th className="p-3">Case</th><th className="p-3">Input</th><th className="p-3">Outcome</th><th className="p-3">Time</th><th className="p-3">Verified / extracted</th><th className="p-3">Deals (90d)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.case.id} className="border-b border-line last:border-0">
                <td className="p-3">{r.case.id}</td><td className="p-3">{r.case.name}, {r.case.firm}</td><td className="p-3">{r.status}</td>
                <td className="p-3">{r.ms ? `${Math.round(r.ms / 1000)}s` : '-'}</td><td className="p-3">{r.stats ? `${r.stats.claimsVerified} / ${r.stats.claimsExtracted}` : '-'}</td><td className="p-3">{r.deals ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-2xl font-semibold">The check that found a real flaw</h2>
      <div className="card mt-3 p-5 text-sm space-y-2">
        <p>After the first evaluation I opened the cited pages myself for 12 sampled claims. Six could be opened. <strong>Four were exactly right. Two carried a detail the source never states</strong> (an investor called an &ldquo;existing backer&rdquo;, a round called &ldquo;Seed&rdquo;), even though their quotes were genuine.</p>
        <p>The quote check could not see that, because the invented detail sat in the claim wording, not the quote. The fix: the fact-checking pass now rewrites any partly supported claim down to what the quote states, and the extractor is told not to add details. Briefs show this as &ldquo;narrowed to the source&rdquo;. Six checked claims cannot give an error rate; they found a failure mode the automated checks missed, which was the point.</p>
        <p>A later read-through found a second flaw no check had been written for: a talking point attributed an unnamed speaker's words to the investor. It now has three layers of defence (extractor, writer, and a code check that is also an evaluation metric).</p>
        <p><a className="underline" href={`${REPO}/blob/main/docs/spot-check.md`} target="_blank" rel="noopener noreferrer">Read the full spot-check</a></p>
      </div>

      <h2 className="mt-10 text-2xl font-semibold">Reproduce it</h2>
      <pre className="card mt-3 overflow-x-auto p-4 text-sm" tabIndex={0} aria-label="Commands to reproduce the evaluation"><code>git clone {REPO}.git{'\n'}cd pitchprep &amp;&amp; npm install{'\n'}npm test        # 69 unit tests: verification gate, dates, quotes, SSRF guard, numbers, encryption, nudge rules{'\n'}npm run eval    # the live evaluation above</code></pre>
      <p className="mt-4 text-sm text-muted">What this does not prove: coverage is not completeness (&ldquo;no deals found&rdquo; means none could be sourced), results vary run to run because live search varies, and a correct quote from a wrong source is still wrong, which is why every claim links to its source. See <Link className="underline" href="/method">How it works</Link>.</p>
    </div>
  );
}
