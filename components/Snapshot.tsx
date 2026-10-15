import { Columns, Donut, PercentBars } from './charts';
import { SprigIcon } from './MilletArt';
import { hasSnapshot, snapshot } from '@/lib/snapshot';
import type { FounderProfile } from '@/lib/types';

/** The figures already in the startup profile, drawn as charts. Reads the profile only; nothing is estimated except the labelled "implied" bar. */
export default function Snapshot({ profile, here = false }: { profile: FounderProfile; here?: boolean }) {
  const s = snapshot(profile);
  if (!hasSnapshot(s)) return null;
  const top = s.mix ? [...s.mix].sort((a, b) => b.value - a.value)[0] : null;
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="glance">
      <div className="flex items-center gap-2"><SprigIcon /><h2 id="glance" className="text-xl font-semibold">{profile.startup} at a glance</h2></div>
      <p className="mt-1 text-sm text-muted">Drawn from the figures in the startup profile. {here ? 'Change the details below and these charts follow.' : <>Edit <a className="underline" href="/settings">My startup</a> and these charts follow.</>}</p>
      <div className="mt-5 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {s.mix && (
          <figure>
            <figcaption className="label mb-2">Where revenue comes from</figcaption>
            <Donut slices={s.mix} ariaLabel={`Revenue by channel: ${s.mix.map((m) => `${m.value} percent ${m.label}`).join(', ')}`} centre={top ? { big: `${top.value}%`, small: 'largest share' } : undefined} />
          </figure>
        )}
        {s.growth && (
          <figure>
            <figcaption className="label mb-2">Revenue run-rate, Rs crore</figcaption>
            <Columns items={s.growth.map((g) => ({ label: g.label, value: g.value, hatched: g.implied }))} unit="" badge={s.growthNote ?? undefined} ariaLabel={`Revenue run-rate: ${s.growth.map((g) => `${g.label} ${g.value} crore${g.implied ? ' (implied)' : ''}`).join(', ')}`} />
            <p className="mt-1 text-xs text-muted">The hatched bar is worked out from the two figures in your profile (run-rate divided by the growth multiple), not stated.</p>
          </figure>
        )}
        {s.ratios.length >= 2 && (
          <figure className="md:col-span-2 lg:col-span-1">
            <figcaption className="label mb-2">Margins and repeat behaviour</figcaption>
            <PercentBars rows={s.ratios} ariaLabel="Key percentages from the profile" />
          </figure>
        )}
      </div>
    </section>
  );
}
