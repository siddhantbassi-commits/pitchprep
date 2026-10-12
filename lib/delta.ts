import type { BriefResult, Claim } from './types';
import { normalize } from './text';

export interface Delta {
  prevId: string;
  prevAt: string;
  /** Events dated after the previous brief was made: genuinely new in the world. */
  newSince: { id: string; section: string; kind: string; date: string | null; text: string }[];
  /** Found this time but not last time. Live search varies, so these may be old facts that simply did not surface before. */
  alsoSurfaced: { id: string; section: string; kind: string; date: string | null; text: string }[];
}

const key = (c: Claim) => [c.section, c.kind, normalize(c.company ?? c.text).slice(0, 48), c.eventDate ?? ''].join('|');

/** Verified claims in the current brief that were not in the previous brief for the same investor. */
export function computeDelta(cur: BriefResult, prev: { id: string; result: BriefResult; created_at: string }): Delta {
  const seen = new Set(prev.result.claims.filter((c) => c.verified).map(key));
  const seenText = new Set(prev.result.claims.filter((c) => c.verified).map((c) => normalize(c.text)));
  const prevDay = prev.created_at.slice(0, 10);
  const fresh = cur.claims
    .filter((c) => c.verified && !seen.has(key(c)) && !seenText.has(normalize(c.text)))
    .map((c) => ({ id: c.id, section: c.section, kind: c.kind, date: c.eventDate, text: c.text }));
  const isNew = (c: { date: string | null; section: string }) => !!c.date && c.date > prevDay && c.section !== 'thesis';
  return { prevId: prev.id, prevAt: prev.created_at, newSince: fresh.filter(isNew), alsoSurfaced: fresh.filter((c) => !isNew(c)) };
}
