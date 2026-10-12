'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { METRIC_LABEL, SAMPLE_DECK, type DeckReport } from '@/lib/deckCore';

const MAX = 3_900_000;
const TONE = { conflict: 'border-red/40 bg-amber-soft', unverified: 'border-line', match: 'border-line' } as const;

/** Upload a pitch deck (or paste its text) and see every figure compared with your profile, plus what investors ask for that the deck never says. */
export default function DeckCheck() {
  const [mode, setMode] = useState<'pdf' | 'text'>('pdf');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rep, setRep] = useState<{ report: DeckReport; transcript: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null; setErr('');
    if (f && f.size > MAX) { setFile(null); return setErr('That PDF is larger than 3.9 MB. Export a smaller version, or paste the deck text instead.'); }
    setFile(f);
  }
  async function run() {
    setBusy(true); setErr(''); setRep(null);
    const fd = new FormData();
    if (mode === 'pdf' && file) fd.set('file', file); else fd.set('text', text);
    try {
      const r = await fetch('/api/deck', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Something went wrong.');
      setRep(j);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  const ready = mode === 'pdf' ? !!file : text.trim().length >= 40;
  const r = rep?.report;

  return (
    <section id="deck" className="card p-5 sm:p-6" aria-labelledby="deck-h">
      <h2 id="deck-h" className="text-xl font-semibold">Check my pitch deck</h2>
      <p className="mt-1 text-sm text-muted max-w-3xl">Investors notice when a number on slide 3 disagrees with slide 9, or with what you told them last week. Upload your deck and every figure it states is compared with your startup profile and with the rest of the deck. You also see which of the numbers investors ask for the deck never mentions. Your deck is read in memory and <b>not stored</b>.</p>

      <div className="mt-4 inline-flex rounded-xl border border-line p-1" role="group" aria-label="How to provide the deck">
        {([['pdf', 'Upload a PDF'], ['text', 'Paste the text']] as const).map(([v, l]) => (
          <button key={v} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === v ? 'bg-brand text-brand-ink' : 'text-muted'}`} aria-pressed={mode === v} onClick={() => setMode(v)}>{l}</button>
        ))}
      </div>

      {mode === 'pdf' ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn" onClick={() => input.current?.click()}>{file ? 'Choose a different PDF' : 'Choose your deck (PDF, up to 3.9 MB)'}</button>
          {file && <span className="text-sm text-muted">{file.name} · {(file.size / 1e6).toFixed(1)} MB</span>}
          <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={pick} aria-label="Choose your pitch deck as a PDF" />
        </div>
      ) : (
        <div className="mt-3">
          <label htmlFor="deck-text" className="label">Deck text, slide by slide</label>
          <textarea id="deck-text" className="input mt-1" rows={8} maxLength={40000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the text of your slides here." />
          <button className="mt-2 text-sm underline text-muted" onClick={() => setText(SAMPLE_DECK)}>Use a sample deck (contains two deliberate mismatches)</button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={run} disabled={busy || !ready}>{busy ? 'Reading your deck…' : 'Check my deck'}</button>
        {busy && <span className="text-sm text-muted" role="status">Usually 20 to 40 seconds.</span>}
        {err && <span role="alert" className="text-sm text-red">{err}</span>}
      </div>

      {r && (
        <div className="mt-6" aria-live="polite">
          <p className="text-lg font-semibold">
            {r.counts.conflict === 0 && r.inconsistencies.length === 0 ? 'No figure in your deck contradicts your profile.' : `${r.counts.conflict + r.inconsistencies.length} thing${r.counts.conflict + r.inconsistencies.length > 1 ? 's' : ''} to fix before an investor sees this.`}
          </p>
          <p className="text-sm text-muted">{r.checked.length} figures found{r.slides ? ` across ${r.slides} slides` : ''}: {r.counts.match} match your profile, {r.counts.conflict} conflict, {r.counts.unverified} could not be checked.</p>
          {r.notes.map((n) => <p key={n} className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">{n}</p>)}

          {r.inconsistencies.length > 0 && (
            <div className="mt-4"><p className="label">The deck disagrees with itself</p>
              <ul className="mt-2 space-y-2">{r.inconsistencies.map((c) => <li key={c.metric} className="rounded-xl border border-red/40 bg-amber-soft p-3 text-sm"><b>{c.label}</b> is given as {c.values.map((v) => `${v.value}${v.slide ? ` (slide ${v.slide})` : ''}`).join(' and ')}. Pick one.</li>)}</ul>
            </div>
          )}

          {r.checked.length > 0 && (
            <div className="mt-4"><p className="label">Every figure, checked</p>
              <ul className="mt-2 space-y-2">
                {r.checked.map((c, i) => (
                  <li key={i} className={`rounded-xl border p-3 text-sm ${TONE[c.status]}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p><b>{METRIC_LABEL[c.metric]}</b>: {c.value}{c.slide ? <span className="text-muted"> · slide {c.slide}</span> : null}</p>
                      <span className={`chip ${c.status === 'conflict' ? 'bg-amber-soft text-amber border-transparent' : c.status === 'match' ? 'bg-brand-soft text-brand border-transparent' : ''}`}>{c.status === 'conflict' ? 'Conflicts with profile' : c.status === 'match' ? 'Matches' : 'Not checked'}</span>
                    </div>
                    <p className="mt-1 text-muted">{c.note}</p>
                    <p className="mt-1 text-muted border-l-4 border-line pl-3">&ldquo;{c.quote}&rdquo;</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.missing.length > 0 && (
            <div className="mt-4"><p className="label">Numbers investors ask for that the deck never mentions</p>
              <ul className="mt-2 space-y-2">{r.missing.map((m) => <li key={m.id} className="rounded-xl border border-line p-3 text-sm"><b>{m.label}</b><br /><span className="text-muted">{m.why} You might say: &ldquo;{m.say}&rdquo;</span></li>)}</ul>
            </div>
          )}
          <details className="mt-4 text-sm"><summary className="cursor-pointer underline text-muted">What we read from your deck</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-3 text-xs" tabIndex={0}>{rep!.transcript}</pre></details>
          <p className="mt-3 text-xs text-muted">If a deck figure is right and your profile is out of date, update <Link className="underline" href="/settings">My startup</Link> and check again. Figures in different currencies or periods can look like conflicts; the check cannot tell.</p>
        </div>
      )}
    </section>
  );
}
