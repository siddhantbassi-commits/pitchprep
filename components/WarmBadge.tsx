'use client';

import { useMemo } from 'react';
import { useContacts } from '@/lib/useContacts';
import { describeMatch, matchFirm } from '@/lib/warm';

/** "You know N people here": shown only if the founder has loaded her own contacts in this browser. */
export default function WarmBadge({ firm, investor, onAsk }: { firm: string; investor?: string; onAsk?: (who: string) => void }) {
  const { stored } = useContacts();
  const matches = useMemo(() => (stored ? matchFirm(stored.contacts, firm, investor) : []), [stored, firm, investor]);
  if (!matches.length) return null;
  return (
    <details className="mt-2 rounded-lg border border-brand/40 bg-brand-soft px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-brand">You already know {matches.length === 1 ? 'someone' : `${matches.length} people`} here{stored?.sample ? ' (sample contacts)' : ''}</summary>
      <ul className="mt-2 space-y-2">
        {matches.slice(0, 5).map((m) => (
          <li key={m.contact.name + m.contact.company} className="flex flex-wrap items-center justify-between gap-2">
            <span>{describeMatch(m, firm)}</span>
            {onAsk && <button className="text-sm font-medium text-brand underline" onClick={() => onAsk(`${m.contact.name}${m.contact.position ? `, ${m.contact.position} at ${m.contact.company}` : ''}`)}>Ask for an intro</button>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">From the contacts file you loaded in this browser. Check the role is current before you ask.</p>
    </details>
  );
}
