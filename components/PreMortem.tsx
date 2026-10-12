'use client';

import { useEffect, useState } from 'react';
import type { PreMortem as PM } from '@/lib/premortem';
import { DIM_LABEL, type DimKey } from '@/lib/progress';

const BASIS: Record<string, string> = { investor: 'Rests on a verified fact about them', founder: 'Rests on your own profile', practice: 'Rests on your mock-meeting results' };

/** "Why might they pass?" Every reason is tied to a verified claim, a line of her profile, or her own practice results. */
export default function PreMortem({ briefId, investor }: { briefId: string; investor: string }) {
  const [pm, setPm] = useState<PM | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { fetch(`/api/briefs/${briefId}/premortem`, { cache: 'no-store' }).then((r) => r.json()).then((j) => setPm(j.premortem ?? null)).catch(() => {}); }, [briefId]);

  async function run() {
    setBusy(true); setErr('');
    const r = await fetch(`/api/briefs/${briefId}/premortem`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? 'Something went wrong.'); else setPm(j.premortem);
    setBusy(false);
  }
  const skill = (s: string | null) => (s ? (DIM_LABEL[s.toLowerCase() as DimKey] ?? s) : '');

  return (
    <section className="mt-8 no-print" aria-labelledby="pm">
      <h2 id="pm" className="text-2xl font-semibold">Why might {investor} pass?</h2>
      <div className="card mt-3 p-5">
        {!pm && <p className="text-sm text-muted max-w-2xl">Imagine it is three months from now and they said no. This lists the most plausible reasons, each tied to a verified fact about them, a line of your own profile, or where your mock meetings were weakest, and what to prepare for each. It is a way to prepare, not a prediction.</p>}
        {pm && (
          <ol className="space-y-4">
            {pm.reasons.map((r, i) => (
              <li key={i} className="rounded-xl border border-line p-4">
                <p className="font-medium">{i + 1}. {r.reason}</p>
                <p className="mt-1 text-xs text-muted">{BASIS[r.basis]}{r.practiceSkill ? `: ${skill(r.practiceSkill)}` : ''}</p>
                {r.evidence.map((e) => <p key={e} className="mt-2 border-l-4 border-line pl-3 text-sm text-muted">{e}</p>)}
                {r.profileQuote && <p className="mt-2 border-l-4 border-line pl-3 text-sm text-muted">Your profile says: &ldquo;{r.profileQuote}&rdquo;</p>}
                <p className="mt-2 text-sm"><b>Prepare:</b> {r.prep}</p>
              </li>
            ))}
            {pm.reasons.length === 0 && <li className="text-sm text-muted">Nothing could be tied to a verified fact, so nothing is shown rather than guess. Try again after more of your profile is filled in.</li>}
          </ol>
        )}
        {pm && pm.checks.map((c) => <p key={c} className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">{c}</p>)}
        {pm && pm.dropped > 0 && <p className="mt-3 text-xs text-muted">{pm.dropped} suggested reason{pm.dropped > 1 ? 's were' : ' was'} dropped because it could not be tied to a verified fact, your profile or your practice results.</p>}
        {pm && pm.weakSkills.length === 0 && <p className="mt-2 text-xs text-muted">Practise a few mock meetings and this will also use the skills you are weakest at.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? 'Thinking it through…' : pm ? 'Run it again' : 'Run a pre-mortem'}</button>
          {err && <span role="alert" className="text-sm text-red">{err}</span>}
        </div>
      </div>
    </section>
  );
}
