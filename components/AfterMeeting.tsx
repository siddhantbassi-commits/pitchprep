'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { STATUSES, STATUS_LABEL, type Status } from '@/lib/tracker';

interface Note { status: Status; notes: string; next_step: string; next_step_on: string | null }
const EMPTY: Note = { status: 'researching', notes: '', next_step: '', next_step_on: null };

/** Notes, pipeline status and a follow-up email drafter for one investor. Everything saves as you type. */
export default function AfterMeeting({ briefId, name, firm }: { briefId: string; name: string; firm: string }) {
  const [note, setNote] = useState<Note>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/pipeline?name=${encodeURIComponent(name)}&firm=${encodeURIComponent(firm)}`, { cache: 'no-store' })
      .then((r) => r.json()).then((j) => { if (live) { if (j.note) setNote({ status: j.note.status, notes: j.note.notes, next_step: j.note.next_step, next_step_on: j.note.next_step_on }); setLoaded(true); } })
      .catch(() => live && setLoaded(true));
    return () => { live = false; };
  }, [name, firm]);

  const save = useCallback((n: Note) => {
    if (timer.current) clearTimeout(timer.current);
    setSaving('saving');
    timer.current = setTimeout(async () => {
      const r = await fetch('/api/pipeline', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, firm, status: n.status, notes: n.notes, nextStep: n.next_step, nextStepOn: n.next_step_on }) });
      setSaving(r.ok ? 'saved' : 'error');
    }, 600);
  }, [name, firm]);

  const change = (patch: Partial<Note>) => { const n = { ...note, ...patch }; setNote(n); save(n); };

  return (
    <section className="mt-10 no-print" aria-labelledby="after">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="after" className="text-2xl font-semibold">After the meeting</h2>
        <span role="status" className="text-sm text-muted">{saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Could not save. Check your connection.' : 'Saves as you type'}</span>
      </div>
      <p className="text-sm text-muted">Your private notes and pipeline status for {name}. Visible only in this browser.</p>
      <div className="card mt-3 p-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[14rem_1fr_11rem]">
          <div>
            <label className="label" htmlFor="status">Pipeline status</label>
            <select id="status" className="input mt-1" value={note.status} disabled={!loaded} onChange={(e) => change({ status: e.target.value as Status })}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="next">Next step</label>
            <input id="next" className="input mt-1" maxLength={300} placeholder="e.g. Send the cohort retention data" value={note.next_step} disabled={!loaded} onChange={(e) => change({ next_step: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="nexton">By</label>
            <input id="nexton" type="date" className="input mt-1" value={note.next_step_on ?? ''} disabled={!loaded} onChange={(e) => change({ next_step_on: e.target.value || null })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="notes">Meeting notes</label>
          <textarea id="notes" className="input mt-1" rows={5} maxLength={5000} disabled={!loaded} placeholder="What they asked, what they liked, what worried them, what you promised." value={note.notes} onChange={(e) => change({ notes: e.target.value })} />
        </div>
      </div>
      <FollowUp briefId={briefId} notes={note.notes} onSent={() => change({ status: note.status === 'researching' || note.status === 'booked' || note.status === 'met' ? 'followed_up' : note.status })} />
    </section>
  );
}

function FollowUp({ briefId, notes, onSent }: { briefId: string; notes: string; onSent: () => void }) {
  const [discussed, setDiscussed] = useState('');
  const [tone, setTone] = useState<'warm' | 'concise'>('warm');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<{ subject: string; body: string; checks: string[] } | null>(null);
  const [copied, setCopied] = useState('');

  async function make() {
    setBusy(true); setErr(''); setCopied('');
    const text = (discussed.trim() || notes.trim());
    const r = await fetch(`/api/briefs/${briefId}/followup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ discussed: text, tone }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? 'Something went wrong.'); else setDraft(j);
    setBusy(false);
  }
  async function copy() {
    if (!draft) return;
    try { await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`); setCopied('Copied'); } catch { setCopied('Select the text and copy it manually'); }
    setTimeout(() => setCopied(''), 2500);
  }

  return (
    <div className="card mt-4 p-5">
      <h3 className="text-lg font-semibold">Draft a follow-up email</h3>
      <p className="text-sm text-muted">Written from your notes and the verified facts only. You read it, edit it and send it; nothing is sent for you.</p>
      <label className="label mt-3 block" htmlFor="discussed">What did you discuss?</label>
      <textarea id="discussed" className="input mt-1" rows={3} maxLength={4000} placeholder={notes.trim() ? 'Leave empty to use your meeting notes above, or write a few lines here.' : 'A few lines: what they asked, what you agreed to send.'} value={discussed} onChange={(e) => setDiscussed(e.target.value)} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <fieldset className="flex items-center gap-3 text-sm"><legend className="sr-only">Tone</legend>
          {(['warm', 'concise'] as const).map((t) => <label key={t} className="flex items-center gap-1.5"><input type="radio" name="tone" checked={tone === t} onChange={() => setTone(t)} />{t === 'warm' ? 'Warm' : 'Concise'}</label>)}
        </fieldset>
        <button className="btn btn-primary" onClick={make} disabled={busy || (discussed.trim().length < 10 && notes.trim().length < 10)}>{busy ? 'Drafting…' : draft ? 'Redraft' : 'Draft email'}</button>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red">{err}</p>}
      {draft && (
        <div className="mt-4 border-t border-line pt-4">
          {draft.checks.length > 0 && (
            <ul className="mb-3 rounded-lg bg-amber-soft p-3 text-sm text-amber space-y-1">{draft.checks.map((c, i) => <li key={i}>{c}</li>)}</ul>
          )}
          <label className="label" htmlFor="subj">Subject</label>
          <input id="subj" className="input mt-1" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          <label className="label mt-3 block" htmlFor="body">Email</label>
          <textarea id="body" className="input mt-1" rows={10} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="btn" onClick={copy}>Copy email</button>
            <a className="btn" href={`mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`} onClick={onSent}>Open in my email app</a>
            {copied && <span role="status" className="text-sm text-brand font-medium">{copied}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
