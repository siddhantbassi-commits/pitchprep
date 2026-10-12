'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { PipelineItem } from '@/lib/store';
import { STATUSES, STATUS_LABEL, fitLabel, fitScore, type Status } from '@/lib/tracker';
import { fmtDate } from '@/lib/format';

type Sort = 'fit' | 'next' | 'recent';
interface Theme { theme: string; prepare: string; investors: string[]; evidence: { investor: string; snippet: string }[] }

export default function PipelineBoard({ initial }: { initial: PipelineItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [sort, setSort] = useState<Sort>('fit');
  const [q, setQ] = useState('');
  const [openNotes, setOpenNotes] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [pat, setPat] = useState<{ themes: Theme[]; used: number } | null>(null);
  const [patBusy, setPatBusy] = useState(false);
  const withNotes = items.filter((i) => i.notes.trim().length >= 40).length;

  async function findPatterns() {
    setPatBusy(true); setErr('');
    const r = await fetch('/api/pipeline/patterns', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? 'Could not analyse your notes.'); else setPat(j);
    setPatBusy(false);
  }

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, items.filter((i) => i.status === s).length])) as Record<Status, number>, [items]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = items.filter((i) => (filter === 'all' || i.status === filter) && (!t || `${i.name} ${i.firm}`.toLowerCase().includes(t)));
    const fs = (i: PipelineItem) => fitScore(i.fit) ?? -99;
    return [...list].sort((a, b) => sort === 'fit' ? fs(b) - fs(a) : sort === 'next' ? (a.nextStepOn ?? '9999').localeCompare(b.nextStepOn ?? '9999') : b.briefAt.localeCompare(a.briefAt));
  }, [items, filter, sort, q]);

  async function update(i: PipelineItem, patch: Partial<Pick<PipelineItem, 'status' | 'notes' | 'nextStep' | 'nextStepOn'>>) {
    setErr('');
    const next = { ...i, ...patch };
    setItems((all) => all.map((x) => (x.key === i.key ? next : x)));
    const r = await fetch('/api/pipeline', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: i.name, firm: i.firm, status: next.status, notes: next.notes, nextStep: next.nextStep, nextStepOn: next.nextStepOn }) });
    if (!r.ok) { setErr('Could not save that change. It will revert on refresh.'); }
  }

  if (!items.length)
    return (
      <div className="card p-8 text-center max-w-xl">
        <h2 className="text-xl font-semibold">Your pipeline is empty</h2>
        <p className="mt-2 text-muted">Every investor you research appears here, ranked by how well they fit your startup, with your status, notes and next step.</p>
        <Link href="/" className="btn btn-primary mt-5 inline-flex">Research your first investor</Link>
      </div>
    );

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <section className="card mb-6 p-5" aria-labelledby="pat">
        <h2 id="pat" className="text-lg font-semibold">What investors keep raising with you</h2>
        <p className="text-sm text-muted">Finds concerns that come up with two or more investors in your own meeting notes, so you can fix the answer once. Every theme is backed by a quote from your notes.</p>
        {withNotes < 2 ? <p className="mt-2 text-sm text-muted">Add meeting notes for at least two investors (a few lines each) to unlock this. You have {withNotes}.</p> : (
          <button className="btn mt-3" onClick={findPatterns} disabled={patBusy}>{patBusy ? 'Reading your notes…' : pat ? 'Analyse again' : 'Find patterns in my notes'}</button>
        )}
        {pat && pat.themes.length === 0 && <p className="mt-3 text-sm text-muted">No concern came up with two investors yet, across {pat.used} sets of notes. That is useful too.</p>}
        {pat && pat.themes.length > 0 && (
          <ul className="mt-4 space-y-4">
            {pat.themes.map((t) => (
              <li key={t.theme} className="border-t border-line pt-3">
                <p className="font-medium">{t.theme} <span className="chip ml-1">{t.investors.length} of {pat.used} investors</span></p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted">{t.evidence.map((e, i) => <li key={i}><strong className="text-ink font-medium">{e.investor}:</strong> &ldquo;{e.snippet}&rdquo;</li>)}</ul>
                <p className="mt-1 text-sm"><span className="font-medium">Prepare:</span> {t.prepare}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        <button className={`chip cursor-pointer ${filter === 'all' ? 'bg-brand-soft text-brand border-transparent' : ''}`} onClick={() => setFilter('all')} aria-pressed={filter === 'all'}>All {items.length}</button>
        {STATUSES.map((s) => (
          <button key={s} className={`chip cursor-pointer ${filter === s ? 'bg-brand-soft text-brand border-transparent' : ''}`} onClick={() => setFilter(s)} aria-pressed={filter === s}>{STATUS_LABEL[s]} {counts[s]}</button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="pq">Search investors</label>
        <input id="pq" className="input sm:max-w-xs" placeholder="Search name or firm" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="text-sm text-muted flex items-center gap-2">Sort by
          <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="fit">Best fit</option><option value="next">Next step date</option><option value="recent">Most recent brief</option>
          </select>
        </label>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red">{err}</p>}

      <ul className="mt-5 grid gap-4">
        {shown.length === 0 && <li className="card p-5 text-muted">No investors match that filter.</li>}
        {shown.map((i) => {
          const score = fitScore(i.fit);
          const overdue = i.nextStepOn && i.nextStepOn < today && i.status !== 'passed';
          return (
            <li key={i.key} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/brief/${i.briefId}`} className="text-xl font-semibold font-serif hover:underline">{i.name}</Link>
                  <p className="text-muted">{i.firm}</p>
                </div>
                <div className="text-right">
                  <span className={`chip ${score == null ? '' : score >= 4 ? 'bg-brand-soft text-brand border-transparent' : score >= 2 ? 'bg-blue-soft text-blue border-transparent' : score < 0 ? 'bg-red-soft text-red border-transparent' : ''}`}>{fitLabel(score)}</span>
                  {i.fit && <p className="mt-1 text-xs text-muted">stage {i.fit.stage} · sector {i.fit.sector} · cheque {i.fit.cheque}</p>}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">{i.lastDeal ? `Latest deal: ${i.lastDeal.text} (${fmtDate(i.lastDeal.date)})` : 'No dated deal in the last 90 days.'} Brief from {fmtDate(i.briefAt)}.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[13rem_1fr_10rem]">
                <div>
                  <label className="label" htmlFor={`s-${i.key}`}>Status</label>
                  <select id={`s-${i.key}`} className="input mt-1" value={i.status} onChange={(e) => update(i, { status: e.target.value as Status })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`n-${i.key}`}>Next step</label>
                  <input id={`n-${i.key}`} className="input mt-1" defaultValue={i.nextStep} maxLength={300} onBlur={(e) => e.target.value !== i.nextStep && update(i, { nextStep: e.target.value })} placeholder="What happens next?" />
                </div>
                <div>
                  <label className="label" htmlFor={`d-${i.key}`}>By{overdue ? ' (overdue)' : ''}</label>
                  <input id={`d-${i.key}`} type="date" className={`input mt-1 ${overdue ? '!border-red' : ''}`} value={i.nextStepOn ?? ''} onChange={(e) => update(i, { nextStepOn: e.target.value || null })} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <Link href={`/brief/${i.briefId}`} className="btn">Open brief</Link>
                <button className="btn" onClick={() => setOpenNotes(openNotes === i.key ? null : i.key)} aria-expanded={openNotes === i.key}>{i.notes ? 'Notes' : 'Add notes'}</button>
                {i.notes && openNotes !== i.key && <span className="text-muted truncate max-w-md">{i.notes}</span>}
              </div>
              {openNotes === i.key && (
                <div className="mt-3">
                  <label className="sr-only" htmlFor={`nt-${i.key}`}>Notes for {i.name}</label>
                  <textarea id={`nt-${i.key}`} className="input" rows={4} maxLength={5000} defaultValue={i.notes} onBlur={(e) => e.target.value !== i.notes && update(i, { notes: e.target.value })} placeholder="Saved when you click away." />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
