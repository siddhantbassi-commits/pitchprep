import type { Claim, Evidence } from '@/lib/types';
import { needsDoubleCheck } from '@/lib/verify';

/** The few claims worth a second look before the founder says them aloud, with the plain reason each one is on the list. */
export default function VerifyList({ claims, evidence }: { claims: Claim[]; evidence: Evidence[] }) {
  const list = needsDoubleCheck(claims, evidence, 3);
  if (!list.length) return null;
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return (
    <section className="mt-6 rounded-2xl border border-line bg-amber-soft p-5" aria-labelledby="dc">
      <h2 id="dc" className="text-lg font-semibold text-amber">Double-check before you say these</h2>
      <p className="text-sm text-amber">Everything here passed our checks, but these are the least certain. Open the source before you rely on them.</p>
      <ul className="mt-3 space-y-3">
        {list.map(({ claim, reasons }) => {
          const src = claim.evidenceIds.map((id) => byId.get(id)).find((e) => e?.url.startsWith('http'));
          return (
            <li key={claim.id} className="text-sm">
              <a href={`#${claim.id}`} className="font-medium underline">{claim.text}</a>
              <p className="mt-0.5 text-amber">{reasons.join('. ')}.{src && <> <a className="underline" href={src.url} target="_blank" rel="noopener noreferrer">Open source ({src.domain})</a></>}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
