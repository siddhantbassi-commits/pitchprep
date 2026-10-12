'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FounderProfile } from '@/lib/types';

const FIELDS: { key: keyof FounderProfile; label: string; hint: string; rows?: number }[] = [
  { key: 'founderName', label: 'Your name', hint: '' },
  { key: 'startup', label: 'Startup', hint: '' },
  { key: 'oneLiner', label: 'One-liner', hint: 'What it is and who it is for', rows: 2 },
  { key: 'sector', label: 'Sector', hint: 'As an investor would categorise it' },
  { key: 'stage', label: 'Stage', hint: 'Round, age, team size', rows: 2 },
  { key: 'raise', label: 'The raise', hint: 'Amount and what the money is for', rows: 2 },
  { key: 'geography', label: 'Geography', hint: 'Where you sell and operate', rows: 2 },
  { key: 'traction', label: 'Traction', hint: 'Revenue, growth, margins, retention. Real numbers make better talking points.', rows: 4 },
  { key: 'differentiators', label: 'What is different', hint: 'Why you win', rows: 3 },
];

export default function ProfileForm({ initial }: { initial: FounderProfile }) {
  const [p, setP] = useState(initial);
  const [msg, setMsg] = useState('');
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) });
    setMsg(r.ok ? 'Saved. New briefs will use this profile.' : (await r.json()).error ?? 'Could not save.');
  }

  async function wipe() {
    if (!confirm('Delete your profile and every brief, source and note saved in this browser? This cannot be undone.')) return;
    await fetch('/api/workspace', { method: 'DELETE' });
    router.push('/');
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={save} className="card p-5 sm:p-6 grid gap-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="label">{f.label}</label>
            {f.rows ? (
              <textarea id={f.key} className="input mt-1" rows={f.rows} value={p[f.key]} maxLength={1200} onChange={(e) => setP({ ...p, [f.key]: e.target.value })} required />
            ) : (
              <input id={f.key} className="input mt-1" value={p[f.key]} maxLength={200} onChange={(e) => setP({ ...p, [f.key]: e.target.value })} required />
            )}
            {f.hint && <p className="text-xs text-muted mt-1">{f.hint}</p>}
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button className="btn btn-primary">Save profile</button>
          {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
        </div>
      </form>
      <div className="card p-5 mt-6">
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className="text-sm text-muted mt-1">This profile is sent to Gemini (paid tier, where content is not used to improve Google products) only to write your talking points. Investor facts never use it. You can erase everything at any time.</p>
        <button onClick={wipe} className="btn mt-3 text-red">Delete all my data</button>
      </div>
    </div>
  );
}
