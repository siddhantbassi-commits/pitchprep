'use client';

import { useState } from 'react';

export default function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  async function go() {
    setState('busy');
    const r = await fetch('/api/nudges/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: token }) });
    setState(r.ok ? 'done' : 'error');
  }
  if (state === 'done') return <p role="status" className="mt-6 font-medium text-brand">You are unsubscribed. No more emails.</p>;
  return (
    <div className="mt-6">
      <button className="btn btn-primary" onClick={go} disabled={state === 'busy' || !token}>{state === 'busy' ? 'Unsubscribing…' : 'Unsubscribe me'}</button>
      {state === 'error' && <p role="alert" className="mt-3 text-sm text-red">This link is not valid or has expired. Switch emails off from the Meetings page instead.</p>}
      {!token && <p role="alert" className="mt-3 text-sm text-red">This unsubscribe link is incomplete. Use the link in your email, or switch emails off from the Meetings page.</p>}
    </div>
  );
}
