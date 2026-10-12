'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'pp_start_dismissed';
const STEPS = [
  { n: 1, title: 'Tell us about your startup', body: 'Every talking point and practice question is built from it. Prefer a look around first? A sample founder is already filled in.', href: '/settings', cta: 'Open My startup' },
  { n: 2, title: 'Find who to talk to', body: 'Not sure who to pitch? Discover lists investors who recently backed startups like yours, each deal with its exact quote. Or enter an investor below.', href: '/discover', cta: 'Open Discover' },
  { n: 3, title: 'Prepare, practise, track', body: 'Get the sourced brief, rehearse with a mock investor, and follow the round on Raise. Calendar and email nudges keep it moving.', href: '/raise', cta: 'Open Raise' },
];

/** A short orientation for first-time visitors. Dismissible, remembered in this browser only. */
export default function StartHere() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => { try { if (localStorage.getItem(KEY)) setHidden(true); } catch { /* storage blocked: just show it */ } }, []);
  if (hidden) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };
  return (
    <section className="no-print mt-8 card p-5 sm:p-6" aria-labelledby="start-here">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="start-here" className="text-xl font-semibold">Start here</h2>
        <button className="text-sm text-muted underline" onClick={dismiss}>Got it, hide this</button>
      </div>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-xl border border-line p-4">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-brand-ink font-semibold">{s.n}</span>
              <h3 className="font-semibold leading-snug">{s.title}</h3>
            </div>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
            <Link className="mt-3 inline-block text-sm font-medium text-brand underline" href={s.href}>{s.cta}</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
