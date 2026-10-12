'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const EXAMPLES = [
  { name: 'Kirsten Green', firm: 'Forerunner Ventures' },
  { name: 'Rajan Anandan', firm: 'Peak XV Partners' },
  { name: 'Garry Tan', firm: 'Y Combinator' },
  { name: 'Kunal Bahl', firm: 'Titan Capital' },
];

export default function BriefForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [firm, setFirm] = useState('');
  const [context, setContext] = useState('');
  const [meeting, setMeeting] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Press / anywhere to start typing an investor's name.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); nameRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/briefs', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, firm, context: context || undefined, meetingAt: meeting ? new Date(meeting).toISOString() : undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Something went wrong.');
      router.push(`/brief/${j.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6" aria-describedby={error ? 'form-error' : undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">Investor name</label>
          <input id="name" ref={nameRef} className="input mt-1" placeholder="e.g. Kirsten Green" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="firm" className="label">Firm</label>
          <input id="firm" className="input mt-1" placeholder="e.g. Forerunner Ventures" value={firm} onChange={(e) => setFirm(e.target.value)} required minLength={2} maxLength={80} autoComplete="off" />
        </div>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted hover:text-ink">Add context (optional): meeting time, or paste a post or bio</summary>
        <div className="mt-3 grid gap-3">
          <div>
            <label htmlFor="meeting" className="label">Meeting time</label>
            <input id="meeting" type="datetime-local" className="input mt-1 sm:max-w-xs" value={meeting} onChange={(e) => setMeeting(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ctx" className="label">Paste something they wrote</label>
            <textarea id="ctx" className="input mt-1" rows={4} maxLength={6000} placeholder="A LinkedIn post, blog excerpt or bio. It is treated as a source you supplied and labelled as yours. We never scrape LinkedIn." value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
        </div>
      </details>
      {error && <p id="form-error" role="alert" className="mt-3 text-sm text-red">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={busy || name.trim().length < 2 || firm.trim().length < 2}>{busy ? 'Starting…' : 'Generate brief'}</button>
        <span className="text-sm text-muted">Ready in about a minute. Tip: press <kbd className="rounded border border-line bg-surface px-1.5 text-xs">/</kbd> to start typing.</span>
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <p className="label">Try one</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((x) => (
            <button type="button" key={x.name} className="chip hover:border-brand hover:text-ink cursor-pointer" onClick={() => { setName(x.name); setFirm(x.firm); }}>{x.name}, {x.firm}</button>
          ))}
        </div>
      </div>
    </form>
  );
}
