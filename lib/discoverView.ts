// Presentation helpers for Discover. Pure and free of server imports, so the browser can use them.
import { daysBetween } from './text';
import type { Candidate, Deal } from './discover';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(partners|capital|ventures|venture|fund|funds|management|group|investments|the|and|llp|llc|inc)\b/g, ' ').replace(/\s+/g, ' ').trim();


export type MatchLabel = 'Active in your space' | 'Closest match' | 'Right category' | 'Right stage' | 'Adjacent';
export interface Described { label: MatchLabel; tone: 'strong' | 'good' | 'possible'; why: string; next: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''} ${date.slice(0, 4)}`;
const ago = (date: string, today: string) => {
  const d = Math.max(0, daysBetween(date, today));
  if (d < 7) return 'this week';
  if (d < 14) return 'last week';
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
};
const dealName = (d: { company: string; round: string | null }) => `${d.company.replace(/\s*\([^)]*\)/, '').trim()}${d.round ? ` (${d.round})` : ''}`;
const fit = (d: { sectorMatch: boolean; stageMatch: boolean }) => `${d.sectorMatch ? 'your category' : 'a different category'}, ${d.stageMatch ? 'your stage' : 'a different stage'}`;

/** A distinct label and one plain sentence for an investor, from their verified deals only. `today` is the search date. */
export function describe(c: Candidate, today: string): Described {
  const recent = (d: Deal) => daysBetween(d.date, today) <= 90;
  const sorted = [...c.deals].sort((a, b) => b.date.localeCompare(a.date));
  const best = [...c.deals].sort((a, b) => Number(b.sectorMatch && b.stageMatch) - Number(a.sectorMatch && a.stageMatch) || Number(b.sectorMatch) - Number(a.sectorMatch) || b.date.localeCompare(a.date))[0];
  const inSector = c.deals.filter((d) => d.sectorMatch);
  let label: MatchLabel; let tone: Described['tone'];
  if (inSector.length >= 2) { label = 'Active in your space'; tone = 'strong'; }
  else if (c.deals.some((d) => d.sectorMatch && d.stageMatch && recent(d))) { label = 'Closest match'; tone = 'strong'; }
  else if (inSector.length) { label = 'Right category'; tone = 'good'; }
  else if (c.deals.some((d) => d.stageMatch)) { label = 'Right stage'; tone = 'good'; }
  else { label = 'Adjacent'; tone = 'possible'; }
  const why = inSector.length >= 2
    ? `${inSector.length} deals in your category since ${monthYear(sorted[sorted.length - 1].date)}, most recently ${dealName(sorted[0])} ${ago(sorted[0].date, today)}.`
    : `Backed ${dealName(best)} ${ago(best.date, today)}: ${fit(best)}.`;
  const next = c.partner ? `Research ${c.partner}, named on the deal.` : `Find out who led ${dealName(best).replace(/ \(.*/, '')} at ${c.firm}, then research them.`;
  return { label, tone, why, next };
}

export interface DealGroup {
  key: string; company: string; round: string | null; amount: string | null; date: string; dateSource: 'stated' | 'article';
  sectorMatch: boolean; stageMatch: boolean;
  investors: { firm: string; partner: string | null; quote: string; url: string; domain: string; described: Described }[];
  sources: { url: string; domain: string }[];
}

/** One card per funding round, with every verified investor on it, instead of the same round repeated under each firm. */
export function groupByDeal(candidates: Candidate[], today: string): DealGroup[] {
  const groups = new Map<string, DealGroup>();
  for (const c of candidates) {
    const described = describe(c, today);
    for (const d of c.deals) {
      const key = norm(d.company.replace(/\([^)]*\)/g, ''));
      let g = groups.get(key);
      if (!g) { g = { key, company: d.company.replace(/\s*\([^)]*\)/, '').trim(), round: d.round, amount: d.amount, date: d.date, dateSource: d.dateSource, sectorMatch: d.sectorMatch, stageMatch: d.stageMatch, investors: [], sources: [] }; groups.set(key, g); }
      g.round ??= d.round; g.amount ??= d.amount;
      if (d.dateSource === 'stated' && (g.dateSource !== 'stated' || d.date > g.date)) { g.date = d.date; g.dateSource = 'stated'; }
      else if (g.dateSource !== 'stated' && d.date > g.date) g.date = d.date;
      g.sectorMatch = g.sectorMatch || d.sectorMatch; g.stageMatch = g.stageMatch || d.stageMatch;
      if (!g.investors.some((i) => norm(i.firm) === norm(c.firm))) g.investors.push({ firm: c.firm, partner: c.partner, quote: d.quote, url: d.url, domain: d.domain, described });
      if (!g.sources.some((x) => x.url === d.url)) g.sources.push({ url: d.url, domain: d.domain });
    }
  }
  const closeness = (g: DealGroup) => (g.sectorMatch && g.stageMatch ? 3 : g.sectorMatch ? 2 : g.stageMatch ? 1 : 0);
  return [...groups.values()].sort((a, b) => closeness(b) - closeness(a) || b.date.localeCompare(a.date) || b.investors.length - a.investors.length);
}
