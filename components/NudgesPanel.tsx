'use client';

import { useCallback, useEffect, useState } from 'react';

interface Prefs {
  email: string; verified: boolean; enabled: boolean;
  brief_ready: boolean; pre_meeting: boolean; follow_up: boolean; overdue: boolean; daily_digest: boolean; bump: boolean; weekly: boolean; lead_minutes: number;
}

const TOGGLES: { key: keyof Prefs; label: string; hint: string; preview: string }[] = [
  { key: 'brief_ready', label: 'Brief ready', hint: 'When a brief is prepared for an upcoming meeting.', preview: 'brief_ready' },
  { key: 'pre_meeting', label: 'Before the meeting', hint: 'A refreshed brief with what is new since you last looked, plus the meeting card.', preview: 'pre_meeting' },
  { key: 'follow_up', label: 'Follow-up reminder', hint: 'The morning after a meeting, if no follow-up is logged yet.', preview: 'follow_up' },
  { key: 'overdue', label: 'Overdue next steps', hint: 'One email a morning when next steps in your pipeline have passed their date.', preview: 'overdue' },
  { key: 'daily_digest', label: "Today's meetings", hint: 'One email in the early morning on days with investor meetings.', preview: 'digest' },
  { key: 'bump', label: 'Gentle bump', hint: 'A week after a follow-up with no movement: a short draft you can send. One a day at most.', preview: 'bump' },
  { key: 'weekly', label: 'Monday summary', hint: 'Your week: meetings held and coming, follow-ups to send, overdue steps and how full the round is.', preview: 'weekly' },
];

export default function NudgesPanel({ banner }: { banner?: string }) {
  const [configured, setConfigured] = useState(true);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/nudges', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); setConfigured(j.configured); setPrefs(j.prefs); if (j.prefs) setEmail(j.prefs.email); }
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (banner === 'confirmed') setMsg({ tone: 'ok', text: 'Your email is confirmed. Nudges are on.' });
    if (banner === 'expired') setMsg({ tone: 'err', text: 'That confirmation link has expired or is not valid. Enter your address again to get a new one.' });
  }, [banner]);

  async function post(url: string, body?: unknown, key = url) {
    setBusy(key); setMsg(null);
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    return { ok: r.ok, j };
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await post('/api/nudges', { email }, 'save');
    if (j.prefs) setPrefs(j.prefs);
    if (!ok) return setMsg({ tone: 'err', text: j.error ?? 'Could not save.' });
    if (j.alreadyConfirmed) return setMsg({ tone: 'ok', text: 'That address is already confirmed.' });
    setMsg({ tone: 'ok', text: j.dryRun ? 'Saved. Email sending is not switched on for this server yet, so no confirmation was sent. You can still preview every email below.' : `We sent a confirmation to ${email}. Click the link in it to switch nudges on (check spam if it is not there).` });
    load();
  }

  async function update(patch: Partial<Prefs>) {
    if (!prefs) return;
    setPrefs({ ...prefs, ...patch });
    const r = await fetch('/api/nudges', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
    if (!r.ok) { setMsg({ tone: 'err', text: 'Could not save that change.' }); load(); }
  }

  async function simple(url: string, ok: string) {
    const { ok: good, j } = await post(url, undefined, url);
    setMsg(good ? { tone: 'ok', text: ok } : { tone: 'err', text: j.error ?? 'Could not send.' });
  }

  async function remove() {
    if (!confirm('Remove your email address and stop all emails?')) return;
    await fetch('/api/nudges', { method: 'DELETE' });
    setPrefs(null); setEmail(''); setMsg({ tone: 'ok', text: 'Your address was removed. No more emails.' });
  }

  if (!loaded) return null;
  const MsgView = msg && <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`mt-3 text-sm ${msg.tone === 'err' ? 'text-red' : 'text-brand font-medium'}`}>{msg.text}</p>;

  return (
    <section className="mt-10" aria-labelledby="nudges">
      <h2 id="nudges" className="text-2xl font-semibold">Email nudges</h2>
      <p className="text-sm text-muted">Get the brief where you will actually see it, before you need it. We email only the address you confirm, and never contact investors for you.</p>

      {!configured && (
        <p className="mt-3 rounded-xl border border-line bg-amber-soft px-4 py-3 text-sm text-amber">Email sending is not switched on for this server yet, so nothing will be delivered. You can still set your address and preview exactly what each email looks like.</p>
      )}

      {!prefs && (
        <form onSubmit={saveEmail} className="card mt-3 p-5 sm:p-6 max-w-2xl">
          <label htmlFor="nudge-email" className="label">Your email address</label>
          <input id="nudge-email" type="email" className="input mt-1" placeholder="you@yourstartup.com" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
          <p className="mt-2 text-xs text-muted">We send one confirmation email first. Nothing else is sent until you click the link in it, and every email has an unsubscribe link.</p>
          <button className="btn btn-primary mt-4" disabled={busy === 'save' || email.length < 5}>{busy === 'save' ? 'Sending…' : 'Send confirmation'}</button>
          {MsgView}
        </form>
      )}

      {prefs && (
        <div className="card mt-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{prefs.email}</p>
              <p className="text-sm text-muted">{prefs.verified ? (prefs.enabled ? 'Confirmed. Nudges are on.' : 'Confirmed, but emails are switched off.') : 'Waiting for you to click the confirmation link we sent.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!prefs.verified && <button className="btn" onClick={() => saveEmail(new Event('submit') as unknown as React.FormEvent)} disabled={busy === 'save'}>Resend confirmation</button>}
              <button className="btn" onClick={() => setPrefs(null)}>Change address</button>
            </div>
          </div>

          {prefs.verified && (
            <>
              <label className="mt-4 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={prefs.enabled} onChange={(e) => update({ enabled: e.target.checked })} />Send me nudges</label>
              <fieldset className="mt-4 grid gap-3" disabled={!prefs.enabled}>
                <legend className="label mb-1">What to send</legend>
                {TOGGLES.map((t) => (
                  <div key={t.key} className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!prefs[t.key]} onChange={(e) => update({ [t.key]: e.target.checked } as Partial<Prefs>)} /><span><span className="font-medium">{t.label}</span><br /><span className="text-muted">{t.hint}</span></span></label>
                    <a className="text-sm underline text-muted" href={`/api/nudges/preview?kind=${t.preview}`} target="_blank" rel="noopener noreferrer">Preview</a>
                  </div>
                ))}
                <div className="mt-1">
                  <label className="label" htmlFor="lead">Send the pre-meeting email</label>
                  <select id="lead" className="input mt-1 !w-auto" value={prefs.lead_minutes} onChange={(e) => update({ lead_minutes: Number(e.target.value) })}>
                    {[60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m / 60 === Math.floor(m / 60) ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${m} minutes`} before</option>)}
                  </select>
                </div>
              </fieldset>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <button className="btn" onClick={() => simple('/api/nudges/test', 'Test email sent. Check your inbox.')} disabled={!!busy || !configured}>{busy === '/api/nudges/test' ? 'Sending…' : 'Send a test email'}</button>
                <button className="btn" onClick={() => simple('/api/nudges/signin', 'We emailed you a link. Open it on your phone to sign in there.')} disabled={!!busy || !configured}>{busy === '/api/nudges/signin' ? 'Sending…' : 'Email me a link to open on my phone'}</button>
                <button className="btn text-red" onClick={remove}>Remove my address</button>
              </div>
            </>
          )}
          {MsgView}
          {!prefs.verified && <p className="mt-3 text-xs text-muted">Until you confirm, we send nothing except that one confirmation email.</p>}
        </div>
      )}
      {!prefs?.verified && (
        <div className="card mt-3 max-w-2xl p-5 sm:p-6">
          <p className="font-medium">See what each email looks like</p>
          <p className="text-sm text-muted">No address needed. Each preview is built from your latest brief (or an example) and nothing is sent.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {TOGGLES.map((t) => (
              <li key={t.key} className="flex items-baseline justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                <span>{t.label}</span>
                <a className="underline text-muted" href={`/api/nudges/preview?kind=${t.preview}`} target="_blank" rel="noopener noreferrer">Preview<span className="sr-only"> {t.label} email (opens in a new tab)</span></a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Privacy: your address is stored only to send these emails, is included in &ldquo;Download my data&rdquo; and removed by &ldquo;Delete all my data&rdquo;. Emails show your brief&apos;s content, so use an address only you read. The one-tap link in an email signs in whoever opens it, so do not forward emails.</p>
    </section>
  );
}
