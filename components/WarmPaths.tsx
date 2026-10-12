'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { clearContacts, matchFirm, parseConnections, SAMPLE_CONTACTS, saveContacts, describeMatch } from '@/lib/warm';
import { useContacts } from '@/lib/useContacts';

interface Target { name: string; firm: string; briefId: string }
const MAX_BYTES = 6_000_000;

/** Upload your own LinkedIn connections export (or try samples). It is read in this browser and never uploaded. */
export default function WarmPaths({ targets }: { targets: Target[] }) {
  const { stored, ready } = useContacts();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => (stored ? targets.map((t) => ({ t, matches: matchFirm(stored.contacts, t.firm, t.name) })) : []), [stored, targets]);
  const hits = rows.filter((r) => r.matches.length);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = '';
    setMsg(''); setErr('');
    if (!f) return;
    if (f.size > MAX_BYTES) return setErr('That file is larger than 6 MB. A LinkedIn connections export is normally well under 1 MB; check you chose Connections.csv.');
    const { contacts, skipped } = parseConnections(await f.text());
    if (!contacts.length) return setErr('That does not look like a LinkedIn connections export. It should be Connections.csv, with columns such as First Name, Last Name, Company and Position.');
    if (!saveContacts({ savedAt: new Date().toISOString(), sample: false, contacts })) return setErr('This browser would not let us keep the contacts (storage is blocked or full). Nothing was saved.');
    setMsg(`Loaded ${contacts.length} contacts${skipped ? ` (${skipped} rows without a company were skipped)` : ''}. Email addresses were discarded.`);
  }
  function sample() { setMsg('Loaded sample contacts. They are fictional.'); setErr(''); saveContacts({ savedAt: new Date().toISOString(), sample: true, contacts: SAMPLE_CONTACTS }); }
  function clear() { clearContacts(); setMsg('Contacts removed from this browser.'); setErr(''); }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="warm">
      <h2 id="warm" className="text-xl font-semibold">People you already know</h2>
      <p className="mt-1 text-sm text-muted max-w-3xl">A warm introduction beats a cold email. Load your own LinkedIn connections file and PitchPrep shows who you already know at the firms in your pipeline. The file is read in this browser and <b>never uploaded</b>; only names, companies and roles are kept here, and email addresses are discarded. No scraping, nothing leaves your device.</p>

      {ready && !stored && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={() => input.current?.click()}>Choose Connections.csv</button>
            <button className="btn" onClick={sample}>Try with sample contacts</button>
            <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} aria-label="Choose your LinkedIn Connections.csv file" />
          </div>
          <details className="mt-3 text-sm text-muted"><summary className="cursor-pointer underline">How do I get the file?</summary>
            <p className="mt-1">On LinkedIn open Settings, then Data privacy, then Get a copy of your data. Choose Connections and request the archive; LinkedIn emails a download link, usually within minutes. Unzip it and pick Connections.csv here.</p>
          </details>
        </div>
      )}

      {stored && (
        <div className="mt-4">
          <p className="text-sm"><b>{stored.contacts.length}</b> contacts{stored.sample ? ' (sample, fictional)' : ''} loaded in this browser. <button className="underline text-muted" onClick={clear}>Remove them</button></p>
          {hits.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No one in your contacts works at the firms in your pipeline yet. {targets.length === 0 ? 'Add investors to your pipeline first (research one from Discover).' : 'New investors you add are checked automatically.'}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {hits.map(({ t, matches }) => (
                <li key={t.briefId} className="rounded-xl border border-line p-4">
                  <p className="font-medium">{t.name} · {t.firm}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {matches.slice(0, 4).map((m) => (
                      <li key={m.contact.name + m.contact.company} className="flex flex-wrap items-center justify-between gap-2">
                        <span>{describeMatch(m, t.firm)}</span>
                        <Link className="font-medium text-brand underline" href={`/brief/${t.briefId}?intro=${encodeURIComponent(`${m.contact.name}${m.contact.position ? `, ${m.contact.position} at ${m.contact.company}` : ''}`)}#intro`}>Ask for an intro</Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {rows.length > hits.length && hits.length > 0 && <p className="mt-3 text-xs text-muted">No contacts found at {rows.length - hits.length} other firm{rows.length - hits.length > 1 ? 's' : ''} in your pipeline.</p>}
          <p className="mt-3 text-xs text-muted">Matches are by firm name, so check the role is current and the company is the right one before you ask.</p>
        </div>
      )}
      {msg && <p role="status" className="mt-3 text-sm text-brand font-medium">{msg}</p>}
      {err && <p role="alert" className="mt-3 text-sm text-red">{err}</p>}
    </section>
  );
}
