import type { BriefResult, Claim } from './types';
import { normalize } from './text';

export interface Delta {
  prevId: string;
  prevAt: string;
  newClaims: { id: string; section: string; kind: string; date: string | null; text: string }[];
}

const key = (c: Claim) => [c.section, c.kind, normalize(c.company ?? c.text).slice(0, 48), c.eventDate ?? ''].join('|');

/** Verified claims in the current brief that were not in the previous brief for the same investor. */
export function computeDelta(cur: BriefResult, prev: { id: string; result: BriefResult; created_at: string }): Delta {
  const seen = new Set(prev.result.claims.filter((c) => c.verified).map(key));
  const seenText = new Set(prev.result.claims.filter((c) => c.verified).map((c) => normalize(c.text)));
  const newClaims = cur.claims
    .filter((c) => c.verified && !seen.has(key(c)) && !seenText.has(normalize(c.text)))
    .map((c) => ({ id: c.id, section: c.section, kind: c.kind, date: c.eventDate, text: c.text }));
  return { prevId: prev.id, prevAt: prev.created_at, newClaims };
}
