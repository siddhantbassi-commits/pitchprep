import Link from 'next/link';
import BriefForm from '@/components/BriefForm';
import BriefList from '@/components/BriefList';
import { DEMO_PROFILE } from '@/lib/demoProfile';
import { currentWorkspace, getProfile, listBriefs, listSeedBriefs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const ws = await currentWorkspace().catch(() => null);
  const [mine, examples, profile] = await Promise.all([ws ? listBriefs(ws, 5).catch(() => []) : [], listSeedBriefs().catch(() => []), ws ? getProfile(ws).catch(() => DEMO_PROFILE) : DEMO_PROFILE]);
  const sample = profile.startup === DEMO_PROFILE.startup;
  return (
    <div>
      <section className="max-w-3xl">
        <p className="label">Pre-meeting investor brief</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-semibold leading-tight">Know who you are sitting across from. In about a minute.</h1>
        <p className="mt-4 text-lg text-muted">Enter an investor and their firm. PitchPrep reads the live web, quotes its sources, fact-checks every claim, and hands you recent deals, their stated thesis, what to watch for, and three talking points for your startup.</p>
      </section>
      <section className="mt-8 max-w-3xl">
        {sample && (
          <p className="mb-3 rounded-xl border border-line bg-blue-soft px-4 py-3 text-sm text-blue">
            Briefs are tailored to a sample founder, <strong>{DEMO_PROFILE.founderName} of {DEMO_PROFILE.startup}</strong>, so you can try everything straight away. <Link className="underline font-medium" href="/settings">Use your own startup</Link> for briefs that are yours.
          </p>
        )}
        <BriefForm />
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3" aria-label="Why you can trust it">
        {[
          ['Every claim has a source', 'Each line links to the article it came from, with the exact quote and the date.'],
          ['Nothing unverified gets through', 'Quotes are matched against the page text. Old deals and undated claims are held back, and we show you what was left out.'],
          ['Public, professional only', 'No LinkedIn scraping, nothing personal. You can paste a post yourself and it is labelled as yours.'],
        ].map(([t, d]) => (
          <div key={t} className="card p-5"><h2 className="text-lg font-semibold">{t}</h2><p className="mt-1 text-sm text-muted">{d}</p></div>
        ))}
      </section>

      {mine.length > 0 && (
        <section className="mt-12"><h2 className="text-2xl font-semibold mb-3">Your recent briefs</h2><BriefList rows={mine} empty="" /></section>
      )}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Example briefs</h2>
        <p className="text-sm text-muted mb-3">Real briefs generated from live public sources, written for a fictional D2C founder.</p>
        <BriefList rows={examples} empty="Examples will appear here once generated." />
      </section>
    </div>
  );
}
