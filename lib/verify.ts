// The verification gate. Code, not the LLM, decides what survives. Everything here is unit-tested.

import type { Claim, Confidence, Evidence, RawClaim, Section } from './types';
import { SECTIONS } from './types';
import { addDays, daysBetween, normalize, parseDate, quoteInText } from './text';

export interface GateInput {
  claims: RawClaim[];
  evidence: Evidence[];
  name: string;
  firm: string;
  today: string; // YYYY-MM-DD
  windowDays?: number;
}

const DEAL_KINDS = new Set(['investment', 'exit', 'milestone']);

export function mentionsSubject(text: string, name: string, firm: string): boolean {
  const t = normalize(text);
  const last = normalize(name).split(' ').filter(Boolean).slice(-1)[0] ?? '';
  const firmCore = normalize(firm).replace(/\b(partners|capital|ventures|venture|fund|management|group|llc|llp|inc|the)\b/g, '').replace(/\s+/g, ' ').trim();
  return (last.length >= 3 && t.includes(last)) || (firmCore.length >= 3 && t.includes(firmCore)) || t.includes(normalize(name));
}

/** Pure, deterministic checks. The semantic judge (an LLM) runs afterwards on the survivors. */
export function gate(input: GateInput): { claims: Claim[]; olderDealsOmitted: number } {
  const windowDays = input.windowDays ?? 90;
  const windowStart = addDays(input.today, -windowDays);
  const byId = new Map(input.evidence.map((e) => [e.id, e]));
  let olderDealsOmitted = 0;

  const out: Claim[] = input.claims.map((raw, i) => {
    const c: Claim = { ...raw, id: `C${i + 1}`, verified: false, dropReason: null, dateSource: 'none', judge: 'not_run' };
    const drop = (reason: string): Claim => ({ ...c, verified: false, dropReason: reason });

    const cited = c.evidenceIds.map((id) => byId.get(id)).filter((e): e is Evidence => !!e);
    if (!cited.length) return drop('no_valid_evidence');
    if (!c.quote || normalize(c.quote).length < 12) return drop('no_quote');
    if (!cited.some((e) => quoteInText(c.quote, e.text))) return drop('quote_not_found_in_source');
    if (!cited.some((e) => mentionsSubject(e.text, input.name, input.firm))) return drop('source_not_about_subject');

    // A stated view must name its speaker: the investor or their firm. Otherwise an unnamed voice would be passed off as theirs.
    if (c.section === 'thesis' && c.kind === 'statement' && !mentionsSubject(c.text, input.name, input.firm)) return drop('unattributed_statement');

    // Date logic. The model's date is accepted only if it parses; otherwise fall back to the article's own date.
    const claimDate = parseDate(c.eventDate);
    const articleDate = cited.map((e) => e.publishedAt).filter((d): d is string => !!d).sort().slice(-1)[0] ?? null;
    const date = claimDate ?? articleDate;
    c.eventDate = date;
    c.dateSource = claimDate ? 'claim' : articleDate ? 'article' : 'none';

    if (date && date > addDays(input.today, 1)) return drop('date_in_future');

    if (c.section === 'deals' && DEAL_KINDS.has(c.kind)) {
      if (!date) return drop('deal_without_date');
      if (date < windowStart) {
        olderDealsOmitted++;
        return drop('outside_90_day_window');
      }
    } else if (date && daysBetween(date, input.today) > 730) {
      return drop('stale_over_24_months');
    }
    return { ...c, verified: true };
  });

  // De-duplicate: same section + kind + company + date.
  const seen = new Set<string>();
  for (const c of out) {
    if (!c.verified) continue;
    const key = [c.section, c.kind, normalize(c.company ?? c.text).slice(0, 40), c.eventDate ?? ''].join('|');
    if (seen.has(key)) { c.verified = false; c.dropReason = 'duplicate'; } else seen.add(key);
  }
  return { claims: out, olderDealsOmitted };
}

export function sectionConfidence(claims: Claim[], evidence: Evidence[]): Record<Section, Confidence> {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const res = {} as Record<Section, Confidence>;
  for (const s of SECTIONS) {
    const ok = claims.filter((c) => c.verified && c.section === s);
    if (!ok.length) { res[s] = 'none'; continue; }
    const ev = new Set(ok.flatMap((c) => c.evidenceIds).map((id) => byId.get(id)).filter((e): e is Evidence => !!e));
    const domains = new Set([...ev].map((e) => e.domain));
    const best = Math.min(...[...ev].map((e) => e.tier), 3);
    const full = [...ev].some((e) => e.fullFetch);
    if (domains.size >= 2 && best <= 2 && full) res[s] = 'high';
    else if (domains.size >= 2 || (best <= 2 && full)) res[s] = 'medium';
    else res[s] = 'low';
  }
  return res;
}

/** One overall label for a brief, from its four section confidences. */
export function overallConfidence(r: { status: string; sectionConfidence: Record<Section, Confidence> }): Confidence {
  if (r.status === 'unverified') return 'none';
  const order: Confidence[] = ['none', 'low', 'medium', 'high'];
  const avg = SECTIONS.reduce((n, s) => n + order.indexOf(r.sectionConfidence[s]), 0) / SECTIONS.length;
  return order[Math.round(avg)];
}

const VAGUE = /\b(a speaker|someone|the quote|the quoted|the text|the article|the source states|the evidence)\b|^(they|he|she|it|this|these)\b/i;

/** A claim must stand alone and name its subject. Vague references to "the quote" or a bare pronoun are not acceptable on screen. */
export function isVague(text: string): boolean {
  return VAGUE.test(text.trim());
}
