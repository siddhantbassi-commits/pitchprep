'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDayTime } from '@/lib/format';

interface Meeting {
  id: string; starts_at: string; title: string | null; attendees: { name: string | null; email: string }[];
  is_investor: boolean; investor_name: string | null; firm: string | null; confidence: string | null; brief_id: string | null; status: string;
}
interface State { connected: boolean; feed: { auto_prepare: boolean; last_synced_at: string | null; last_error: string | null } | null; meetings: Meeting[] }

const when = fmtDayTime;

export default function MeetingsPanel() {
  const [s, setS] = useState<State | null>(null);
  const [url, setUrl] = useState('');
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/meetings', { cache: 'no-store' });
    if (r.ok) setS(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function connect(e: React.FormEvent) {
    e.preventDefault(); setBusy('connect'); setError('');
    const r = await fetch('/api/meetings/feed', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, auto }) });
    const j = await r.json();
    if (!r.ok) setError(j.error ?? 'Could not connect.'); else { setUrl(''); if (j.error) setError(j.error); }
    setBusy(''); load();
  }
  async function sample() {
    setBusy('sample'); setError('');
    const r = await fetch('/api/meetings/feed', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sample: true, auto }) });
    const j = await r.json();
    if (!r.ok) setError(j.error ?? 'Could not load the sample calendar.');
    setBusy(''); load();
  }
  async function sync() { setBusy('sync'); setError(''); const r = await fetch('/api/meetings/sync', { method: 'POST' }); const j = await r.json(); if (j.error) setError(j.error); setBusy(''); load(); }
  async function toggle(v: boolean) { await fetch('/api/meetings/feed', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ auto: v }) }); load(); }
  async function disconnect() { if (!confirm('Disconnect your calendar and forget the detected meetings?')) return; await fetch('/api/meetings/feed', { method: 'DELETE' }); load(); }

  if (!s) return <p className="text-muted">Loading…</p>;

  if (!s.connected)
    return (
      <form onSubmit={connect} className="card p-5 sm:p-6 max-w-2xl">
        <h2 className="text-xl font-semibold">Connect your calendar</h2>
        <p className="mt-1 text-muted">PitchPrep finds your investor meetings and prepares each brief ahead of time, so it is waiting when you need it.</p>
        <ol className="mt-3 list-decimal pl-5 text-sm text-muted space-y-1">
          <li>In Google Calendar open <strong>Settings</strong>, pick your calendar, then <strong>Integrate calendar</strong>.</li>
          <li>Copy the <strong>Secret address in iCal format</strong> and paste it below. It is read-only.</li>
        </ol>
        <label htmlFor="ics" className="label mt-4 block">Secret iCal address</label>
        <input id="ics" className="input mt-1" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value={url} onChange={(e) => setUrl(e.target.value)} required autoComplete="off" />
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={auto} onChange={(e) => setAuto(e.target.checked)} /><span>Prepare briefs automatically about 24 hours before each investor meeting</span></label>
        {error && <p role="alert" className="mt-3 text-sm text-red">{error}</p>}
        <button className="btn btn-primary mt-4" disabled={busy === 'connect' || url.length < 10}>{busy === 'connect' ? 'Reading your calendar…' : 'Connect calendar'}</button>
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm text-muted">Just exploring? Use a sample calendar with a few fictional meetings (two investors, a customer and a job candidate) to see detection and automatic briefs work.</p>
          <button type="button" className="btn mt-2" onClick={sample} disabled={busy === 'sample'}>{busy === 'sample' ? 'Loading sample…' : 'Try with a sample calendar'}</button>
        </div>
        <p className="mt-4 text-xs text-muted">Privacy: only meeting titles, times, attendee names and email domains are sent to Gemini, to decide which meetings involve investors. Descriptions, notes and full email addresses are not. Recurring events are ignored. You can disconnect and erase everything at any time.</p>
      </form>
    );

  const inv = s.meetings.filter((m) => m.is_investor || m.status === 'prepared');
  const other = s.meetings.filter((m) => !(m.is_investor || m.status === 'prepared'));
  return (
    <div>
      <div className="card p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="text-sm text-muted">{s.feed?.last_synced_at ? `Last checked ${when(s.feed.last_synced_at)}` : 'Not checked yet'}</div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!s.feed?.auto_prepare} onChange={(e) => toggle(e.target.checked)} />Auto-prepare 24h before</label>
          <button className="btn" onClick={sync} disabled={!!busy}>{busy === 'sync' ? 'Checking…' : 'Check now'}</button>
          <button className="btn text-red" onClick={disconnect}>Disconnect</button>
        </div>
      </div>
      {(error || s.feed?.last_error) && <p role="alert" className="mt-3 text-sm text-red">{error || s.feed?.last_error}</p>}

      <h2 className="mt-8 text-2xl font-semibold">Investor meetings, next 14 days</h2>
      {inv.length === 0 ? <p className="card mt-3 p-5 text-muted">No investor meetings detected. External meetings with investors will appear here after you add them to your calendar.</p> : (
        <div className="mt-3 grid gap-3">{inv.map((m) => <Row key={m.id} m={m} onDone={load} />)}</div>
      )}
      {other.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer font-medium">Other external meetings ({other.length}). Not detected as investors; prepare one manually if we got it wrong.</summary>
          <div className="mt-3 grid gap-3">{other.map((m) => <Row key={m.id} m={m} onDone={load} />)}</div>
        </details>
      )}
    </div>
  );
}

function Row({ m, onDone }: { m: Meeting; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(m.investor_name ?? '');
  const [firm, setFirm] = useState(m.firm ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function prepare() {
    setBusy(true); setErr('');
    const r = await fetch(`/api/meetings/${m.id}/prepare`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, firm }) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? 'Failed'); setBusy(false); return; }
    onDone(); router.push(`/brief/${j.briefId}`);
  }
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{m.title}</p>
        <p className="text-sm text-muted">{when(m.starts_at)}</p>
      </div>
      <p className="text-sm text-muted">With {m.attendees.map((a) => a.name ?? a.email.split('@')[1]).join(', ')}{m.is_investor && m.confidence ? ` · detected as investor (${m.confidence} confidence)` : ''}</p>
      {m.brief_id ? (
        <Link className="btn btn-primary mt-3 inline-flex" href={`/brief/${m.brief_id}`}>Open brief</Link>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className="input" aria-label="Investor name" placeholder="Investor name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" aria-label="Firm" placeholder="Firm" value={firm} onChange={(e) => setFirm(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || name.trim().length < 2 || firm.trim().length < 2} onClick={prepare}>{busy ? 'Starting…' : 'Prepare brief'}</button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-red">{err}</p>}
    </div>
  );
}
