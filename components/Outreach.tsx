'use client';

import { useState } from 'react';

/** A first message to an investor the founder has not met yet, built from verified facts only. A draft: she edits and sends it herself. */
export default function Outreach({ briefId, investor }: { briefId: string; investor: string }) {
  const [channel, setChannel] = useState<'email' | 'linkedin'>('email');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<{ subject: string; body: string; checks: string[] } | null>(null);
  const [copied, setCopied] = useState('');

  async function make() {
    setBusy(true); setErr('');
    const r = await fetch(`/api/briefs/${briefId}/outreach`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel, ask }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? 'Something went wrong.'); else setDraft(j);
    setBusy(false);
  }
  async function copy() {
    if (!draft) return;
    try { await navigator.clipboard.writeText(channel === 'email' && draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body); setCopied('Copied'); } catch { setCopied('Select the text and copy it manually'); }
    setTimeout(() => setCopied(''), 2500);
  }

  return (
    <details className="card mt-10 p-5 no-print">
      <summary className="cursor-pointer text-lg font-semibold">Haven&apos;t met {investor} yet? Draft an intro message</summary>
      <p className="mt-2 text-sm text-muted">Built only from the verified facts above and your startup profile, with one accurate hook and one small ask. You edit it and send it yourself.</p>
      <fieldset className="mt-3 flex items-center gap-4 text-sm"><legend className="sr-only">Channel</legend>
        {(['email', 'linkedin'] as const).map((c) => <label key={c} className="flex items-center gap-1.5"><input type="radio" name="ch" checked={channel === c} onChange={() => { setChannel(c); setDraft(null); }} />{c === 'email' ? 'Email' : 'LinkedIn note'}</label>)}
      </fieldset>
      <label className="label mt-3 block" htmlFor="ask">Your ask (optional)</label>
      <input id="ask" className="input mt-1" maxLength={300} placeholder="e.g. a 20-minute intro call next week; mention that Rohan Mehta suggested I write" value={ask} onChange={(e) => setAsk(e.target.value)} />
      <button className="btn btn-primary mt-3" onClick={make} disabled={busy}>{busy ? 'Drafting…' : draft ? 'Redraft' : 'Draft message'}</button>
      {err && <p role="alert" className="mt-3 text-sm text-red">{err}</p>}
      {draft && (
        <div className="mt-4 border-t border-line pt-4">
          {draft.checks.length > 0 && <ul className="mb-3 rounded-lg bg-amber-soft p-3 text-sm text-amber space-y-1">{draft.checks.map((c, i) => <li key={i}>{c}</li>)}</ul>}
          {channel === 'email' && (<><label className="label" htmlFor="osub">Subject</label><input id="osub" className="input mt-1" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></>)}
          <label className="label mt-3 block" htmlFor="obody">{channel === 'email' ? 'Email' : 'Connection note'}</label>
          <textarea id="obody" className="input mt-1" rows={channel === 'email' ? 8 : 4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="btn" onClick={copy}>Copy</button>
            {channel === 'email' && <a className="btn" href={`mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}>Open in my email app</a>}
            {copied && <span role="status" className="text-sm text-brand font-medium">{copied}</span>}
          </div>
        </div>
      )}
    </details>
  );
}
