import Link from 'next/link';
import { readiness } from '@/lib/readiness';
import type { FounderProfile } from '@/lib/types';

/** Which of the numbers investors always ask for are missing from the profile, each with why and a way to say it. */
export default function ReadinessCard({ profile, compact = false }: { profile: FounderProfile; compact?: boolean }) {
  const r = readiness(profile);
  const missing = r.checks.filter((c) => !c.pass);
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="ready">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ready" className="text-xl font-semibold">Pitch readiness</h2>
        <span className={`chip ${missing.length === 0 ? 'bg-brand-soft text-brand border-transparent' : 'bg-amber-soft text-amber border-transparent'}`}>{r.passed} of {r.total} numbers on record</span>
      </div>
      <p className="mt-1 text-sm text-muted">The figures investors almost always ask for, checked against your startup profile. This checks that a number is stated, not that it is strong.</p>
      {missing.length === 0 ? <p className="mt-3 text-sm font-medium text-brand">Everything investors usually ask for is on your profile.</p> : (
        <ul className="mt-3 space-y-3">
          {(compact ? missing.slice(0, 3) : missing).map((c) => (
            <li key={c.id} className="text-sm"><p className="font-medium">Missing: {c.label}</p><p className="text-muted">{c.why} You might say: &ldquo;{c.say}&rdquo;</p></li>
          ))}
        </ul>
      )}
      {compact && missing.length > 3 && <p className="mt-2 text-sm text-muted">and {missing.length - 3} more.</p>}
      <p className="mt-3 text-sm"><Link className="underline" href="/settings">Add them to your startup profile</Link>, and every talking point, rehearsal and email checks against them.</p>
    </section>
  );
}
