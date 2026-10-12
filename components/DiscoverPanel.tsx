'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDate } from '@/lib/format';
import { describe, groupByDeal, type Candidate, type DealGroup, type Described, type DiscoveryResult } from '@/lib/discover';
import type { StageState } from '@/lib/types';

interface Row { id: string; status: 'running' | 'complete' | 'failed'; focus: string | null; stages: StageState[]; result: DiscoveryResult | null; error: string | null; created_at: string }
interface Prof { startup: string; oneLiner: string; sector: string; stage: string; geography: string; raise: string }

const STYLE: Record<Described['tone'], string> = { strong: 'bg-brand-soft text-brand border-transparent', good: 'bg-blue-soft text-blue border-transparent', possible: 'bg-amber-soft text-amber border-transparent' };

export default function DiscoverPanel({ profile, initial }: { profile: Prof; initial: Row | null }) {
  const [row, setRow] = useState<Row | null>(initial);
  const [focus, setFocus] = useState(initial?.focus ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const running = row?.status === 'running';

  const poll = useCallback(async (id: string) => {
    const r = await fetch(`/api/discover/${id}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    setRow(j.discovery);
  }, []);

  useEffect(() => {
    if (!running || !row) return;
    timer.current = setInterval(() => { poll(row.id); setNow(Date.now()); }, 2500);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running, row, poll]);

  async function start() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/discover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ focus: focus || undefined }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Something went wrong.');
      setRow({ id: j.id, status: 'running', focus: focus || null, stages: [], result: null, error: null, created_at: new Date().toISOString() });
      setNow(Date.now());
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  const res = row?.status === 'complete' ? row.result : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr] items-start">
      <aside className="card p-5 lg:sticky lg:top-20">
        <p className="label">Searching for</p>
        <p className="mt-1 font-semibold">{profile.startup}</p>
        <p className="mt-1 text-sm text-muted">{profile.oneLiner}</p>
        <dl className="mt-3 space-y-1 text-sm">
          <div><dt className="inline text-muted">Sector: </dt><dd className="inline">{profile.sector}</dd></div>
          <div><dt className="inline text-muted">Stage: </dt><dd className="inline">{profile.stage}</dd></div>
          <div><dt className="inline text-muted">Geography: </dt><dd className="inline">{profile.geography}</dd></div>
          <div><dt className="inline text-muted">Raising: </dt><dd className="inline">{profile.raise}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-muted">Taken from <Link className="underline" href="/settings">My startup</Link>. Edit it there to change the search.</p>
        <label htmlFor="focus" className="label mt-4 block">Anything to focus on? (optional)</label>
        <input id="focus" className="input mt-1" placeholder="e.g. women-led, climate, B2C brands in the UAE" value={focus} maxLength={300} onChange={(e) => setFocus(e.target.value)} />
        <button className="btn btn-primary mt-4 w-full" onClick={start} disabled={busy || running}>{running ? 'Searching…' : res || row?.status === 'failed' ? 'Search again' : 'Find investors'}</button>
        {error && <p role="alert" className="mt-3 text-sm text-red">{error}</p>}
        <p className="mt-3 text-xs text-muted">Takes about a minute. Up to 6 searches a day.</p>
      </aside>

      <section aria-live="polite">
        {!row && <Empty />}
        {running && row && <Progress row={row} elapsed={Math.max(0, Math.round((now - Date.parse(row.created_at)) / 1000))} />}
        {row?.status === 'failed' && (
          <div className="card p-6"><h2 className="text-lg font-semibold">We could not finish that search</h2><p className="mt-1 text-muted">{row.error ?? 'Something went wrong.'} Nothing was saved. Try again.</p></div>
        )}
        {res && <Results res={res} />}
      </section>
    </div>
  );
}

function Empty() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold">How this works</h2>
      <ol className="mt-3 space-y-2 text-sm text-muted list-decimal pl-5">
        <li>We search live news and firm pages for rounds in your category, at your stage and in your region, from the last 200 days.</li>
        <li>We read the sources and pull out who invested in whom. Every deal must carry the exact sentence it came from, a date and a link, or it is dropped.</li>
        <li>Investors are ranked by code, not by the model: recent, in your category and at your stage first.</li>
        <li>Pick one and press <b>Research</b> to get a full pre-meeting brief.</li>
      </ol>
    </div>
  );
}

function Progress({ row, elapsed }: { row: Row; elapsed: number }) {
  const stages = row.stages.length ? row.stages : ([{ key: 'start', label: 'Starting up', status: 'running' }] as StageState[]);
  return (
    <div className="card p-5" role="status">
      <p className="label">Looking for investors</p>
      <ol className="mt-3 space-y-3">
        {stages.map((s) => (
          <li key={s.key} className="flex items-start gap-3">
            <span aria-hidden className={`mt-1 h-3 w-3 rounded-full shrink-0 ${s.status === 'done' ? 'bg-brand' : s.status === 'running' ? 'bg-brand pulse' : s.status === 'failed' ? 'bg-red' : 'bg-line'}`} />
            <div className="min-w-0"><p className={s.status === 'pending' ? 'text-muted' : 'font-medium'}>{s.label}</p>{s.detail && <p className="text-sm text-muted">{s.detail}</p>}</div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-line pt-3 text-sm text-muted">{elapsed}s elapsed. Usually 40 to 90 seconds. You can leave this page; the result will be here when you return.</p>
    </div>
  );
}

function Results({ res }: { res: DiscoveryResult }) {
  const [view, setView] = useState<'deal' | 'investor'>('deal');
  const today = res.asOf.slice(0, 10);
  const groups = useMemo(() => groupByDeal(res.candidates, today), [res, today]);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{res.candidates.length ? `${res.candidates.length} investors across ${groups.length} recent rounds` : 'No investor could be verified'}</h2>
        <p className="text-sm text-muted">Searched {fmtDate(today)} · deals since {fmtDate(res.windowStart)}</p>
      </div>
      {res.notes.map((n) => <p key={n} className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">{n}</p>)}
      {res.candidates.length > 0 && (
        <div className="mt-4 inline-flex rounded-xl border border-line p-1" role="group" aria-label="How to group the results">
          {([['deal', 'By round'], ['investor', 'By investor']] as const).map(([v, label]) => (
            <button key={v} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-brand text-brand-ink' : 'text-muted'}`} aria-pressed={view === v} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
      )}
      {view === 'deal'
        ? <ul className="mt-4 space-y-4">{groups.map((g) => <DealCard key={g.key} g={g} />)}</ul>
        : <ul className="mt-4 space-y-4">{res.candidates.map((c) => <CandidateCard key={c.firm} c={c} today={today} />)}</ul>}
      <p className="mt-6 text-xs text-muted">Ordered by code: {res.stats.dealsKept} deals kept from {res.stats.dealsProposed} the model proposed, {res.stats.sources} sources read. Closest matches (your category and your stage, recently) come first. A match means they recently backed something similar. It is not a prediction that they will back you. Always check a firm&apos;s current mandate before you write.</p>
    </div>
  );
}

/** Person to meet + start a full brief. Shared by both views. */
function ResearchBar({ firm, partner, id }: { firm: string; partner: string | null; id: string }) {
  const router = useRouter();
  const [person, setPerson] = useState(partner ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function research() {
    if (person.trim().length < 2) { setErr('Add the name of the person you will meet. A brief is about one person.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/briefs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: person.trim(), firm }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Something went wrong.');
      router.push(`/brief/${j.id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grow min-w-[12rem]">
          <label htmlFor={`p-${id}`} className="label">Who will you meet at {firm}?</label>
          <input id={`p-${id}`} className="input mt-1" placeholder="Partner's name" value={person} onChange={(e) => setPerson(e.target.value)} maxLength={80} />
        </div>
        <button className="btn btn-primary" onClick={research} disabled={busy}>{busy ? 'Starting…' : 'Research this investor'}</button>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red">{err}</p>}
    </div>
  );
}

function DealCard({ g }: { g: DealGroup }) {
  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{g.company}</h3>
        <p className="text-sm text-muted">{[g.round, g.amount].filter(Boolean).join(', ')}{g.round || g.amount ? ' · ' : ''}{fmtDate(g.date)}{g.dateSource === 'article' ? ' (article date)' : ''}</p>
      </div>
      <p className="mt-1 text-sm text-muted">Sources: {g.sources.map((s, i) => <span key={s.url}>{i ? ', ' : ''}<a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.domain}<span className="sr-only"> (opens in a new tab)</span></a></span>)}</p>
      <p className="label mt-4">{g.investors.length === 1 ? 'Backed by' : `Backed by ${g.investors.length} investors`}</p>
      <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
        {g.investors.map((i) => (
          <li key={i.firm} className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{i.firm}{i.partner && <span className="font-normal text-muted"> · {i.partner}</span>}</p>
              <span className={`chip ${STYLE[i.described.tone]}`}>{i.described.label}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{i.described.why}</p>
            <details className="mt-1 text-sm"><summary className="cursor-pointer underline text-muted">Exact quote</summary><blockquote className="mt-1 border-l-4 border-line pl-3 text-muted">&ldquo;{i.quote}&rdquo;</blockquote></details>
            <details className="mt-2"><summary className="cursor-pointer text-sm font-medium text-brand underline">Research {i.firm}</summary><div className="mt-2"><ResearchBar firm={i.firm} partner={i.partner} id={`${g.key}-${i.firm}`} /></div></details>
          </li>
        ))}
      </ul>
    </li>
  );
}

function CandidateCard({ c, today }: { c: Candidate; today: string }) {
  const [open, setOpen] = useState(false);
  const d = useMemo(() => describe(c, today), [c, today]);
  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{c.firm}</h3>
          {c.partner && <p className="text-sm text-muted">Named on the deal: {c.partner}</p>}
        </div>
        <span className={`chip ${STYLE[d.tone]}`}>{d.label}</span>
      </div>
      <p className="mt-2 text-sm">{d.why}</p>
      <p className="text-sm text-muted">{d.next}</p>
      {c.chequeNote && <p className="mt-2 text-sm"><b>Cheque or focus:</b> {c.chequeNote} {c.chequeQuote && <span className="text-muted">(&ldquo;{c.chequeQuote}&rdquo;)</span>}</p>}
      <ul className="mt-3 space-y-2">
        {c.deals.slice(0, open ? 20 : 2).map((x) => (
          <li key={x.company + x.date} className="rounded-lg border border-line p-3 text-sm">
            <p><b>{x.company}</b>{x.round ? `, ${x.round}` : ''}{x.amount ? `, ${x.amount}` : ''} <span className="text-muted">· {fmtDate(x.date)}{x.dateSource === 'article' ? ' (article date)' : ''}</span></p>
            <blockquote className="mt-1 text-muted">&ldquo;{x.quote}&rdquo;</blockquote>
            <a className="mt-1 inline-block underline" href={x.url} target="_blank" rel="noopener noreferrer">{x.domain}<span className="sr-only"> (opens in a new tab)</span></a>
          </li>
        ))}
      </ul>
      {c.deals.length > 2 && <button className="mt-2 text-sm underline" onClick={() => setOpen(!open)}>{open ? 'Show fewer deals' : `Show all ${c.deals.length} deals`}</button>}
      <div className="mt-4 border-t border-line pt-3"><ResearchBar firm={c.firm} partner={c.partner} id={`c-${c.firm}`} /></div>
    </li>
  );
}
