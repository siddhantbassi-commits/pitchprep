// Pure half of the deck consistency check (safe to import in the browser). The model only READS the deck (transcribes it, then lists the figures it states, each with the exact
// sentence). Code does every comparison: figures against the founder's profile, figures against each other, and which of the
// eleven numbers investors ask for the deck never mentions. The deck is processed in memory and not stored.

import { z } from 'zod';
import { readinessFromText, type Check } from './readiness';
import { quoteInText, significantNumbers } from './text';
import type { FounderProfile } from './types';

export const METRICS = ['revenue', 'growth', 'gross_margin', 'contribution_margin', 'retention', 'cac', 'aov', 'burn', 'raise_amount', 'valuation', 'team_size'] as const;
export type Metric = (typeof METRICS)[number];
export const METRIC_LABEL: Record<Metric, string> = { revenue: 'Revenue / run-rate', growth: 'Growth', gross_margin: 'Gross margin', contribution_margin: 'Contribution margin', retention: 'Repeat / retention', cac: 'Customer acquisition cost', aov: 'Average order value', burn: 'Burn / runway', raise_amount: 'Amount being raised', valuation: 'Valuation', team_size: 'Team size' };

const KEYWORDS: Record<Metric, RegExp> = {
  revenue: /(revenue|run-?rate|\barr\b|\bgmv\b|\bsales\b)/i,
  growth: /(growth|\bgrew\b|year on year|\byoy\b|\bmom\b|\d(\.\d+)?x\b)/i,
  gross_margin: /gross margin/i,
  contribution_margin: /(contribution margin|\bcm[123]\b)/i,
  retention: /(repeat|re-?order|retention|churn)/i,
  cac: /(\bcac\b|acquisition cost)/i,
  aov: /(\baov\b|average order|order value)/i,
  burn: /(\bburn\b|runway)/i,
  raise_amount: /(raising|\braise\b|round size)/i,
  valuation: /(valuation|pre-money|post-money)/i,
  team_size: /(\bteam\b|employees|people|headcount)/i,
};

// Figures that should appear once in a deck. Growth is left out of the internal check because "3x a year" and "40% a month" can both be true.
const SINGLE_VALUED: Metric[] = ['revenue', 'gross_margin', 'contribution_margin', 'retention', 'cac', 'aov', 'burn', 'raise_amount', 'valuation', 'team_size'];

// ------------------------------------------------------------------------------------------------ extraction (model reads, code verifies)

export const RawItems = z.object({
  items: z.array(z.object({
    metric: z.enum(METRICS),
    label: z.string().describe('Short label as the deck words it, for example "Gross margin"'),
    value: z.string().describe('The figure as written, for example "Rs 14 crore" or "58%"'),
    number: z.number().describe('The main number without units: 14 for "Rs 14 crore", 4 for "$4M", 58 for "58%", 3.1 for "3.1x"'),
    timeframe: z.enum(['current', 'past', 'projection']).describe('current = the latest actual figure; past = an earlier period; projection = a forecast or target'),
    slide: z.number().int().nullable(),
    quote: z.string().describe('Verbatim span (max 160 characters) from the transcript that contains the figure'),
  })),
});
export type Item = z.infer<typeof RawItems>['items'][number];

/** Drops any item whose quote is not in the transcript or whose number is not in its own quote. Pure. */
export function verifyItems(raw: z.infer<typeof RawItems>, transcript: string): { items: Item[]; dropped: number } {
  const items: Item[] = []; let dropped = 0;
  for (const it of raw.items) {
    const inQuote = new Set(significantNumbers(it.quote));
    if (!quoteInText(it.quote, transcript) || !inQuote.has(String(parseFloat(String(it.number))))) { dropped++; continue; }
    items.push(it);
  }
  return { items, dropped };
}

// ------------------------------------------------------------------------------------------------ comparison (code only)

/** Numbers the profile states about a metric: the clauses mentioning the metric's keywords. Pure. */
export function profileFigures(profile: FounderProfile, metric: Metric): string[] {
  const text = Object.values(profile).join('\n');
  const clauses = text.split(/(?:(?<!\d)\.(?!\d)|[;\n:]|(?<!\d),(?!\d))/);
  const out = new Set<string>();
  for (const c of clauses) if (KEYWORDS[metric].test(c)) for (const n of significantNumbers(c)) out.add(n);
  return [...out];
}

const same = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(b) * 0.005, 0.0001);

export type Status = 'match' | 'conflict' | 'unverified';
export interface Checked extends Item { status: Status; profileValues: string[]; note: string }

/** A raise amount or valuation is always compared, whatever the model called its timeframe: it is the ask, not a forecast. */
const frame = (it: Item) => (it.metric === 'raise_amount' || it.metric === 'valuation' ? 'current' : it.timeframe);

export function compare(items: Item[], profile: FounderProfile): Checked[] {
  return items.map((it) => {
    if (frame(it) !== 'current') return { ...it, status: 'unverified' as Status, profileValues: [], note: it.timeframe === 'projection' ? 'A forecast or target, so it is not compared with your current figures.' : 'An earlier period, so it is not compared with your current figures.' };
    const vals = profileFigures(profile, it.metric);
    if (!vals.length) return { ...it, status: 'unverified' as Status, profileValues: [], note: 'Your startup profile does not state this figure, so it cannot be checked. If it is right, add it to My startup.' };
    if (vals.some((v) => same(Number(v), it.number))) return { ...it, status: 'match' as Status, profileValues: vals, note: 'Matches your profile.' };
    return { ...it, status: 'conflict' as Status, profileValues: vals, note: `Your profile says ${vals.join(' or ')}. If these are the same figure in different units or periods, make sure the deck says so; otherwise one of them is out of date.` };
  });
}

export interface Inconsistency { metric: Metric; label: string; values: { value: string; slide: number | null }[] }
/** The same single-valued metric given different current figures on different slides. Pure. */
export function internalConflicts(items: Item[]): Inconsistency[] {
  const out: Inconsistency[] = [];
  for (const m of SINGLE_VALUED) {
    const cur = items.filter((i) => i.metric === m && frame(i) === 'current');
    const distinct = cur.filter((i, idx) => cur.findIndex((j) => same(j.number, i.number)) === idx);
    if (distinct.length > 1) out.push({ metric: m, label: METRIC_LABEL[m], values: distinct.map((d) => ({ value: d.value, slide: d.slide })) });
  }
  return out;
}

export interface DeckReport {
  slides: number | null; words: number;
  checked: Checked[]; inconsistencies: Inconsistency[];
  counts: { match: number; conflict: number; unverified: number; dropped: number };
  missing: Check[]; // numbers investors ask for that the deck never states
  notes: string[];
}

export function buildReport(items: Item[], dropped: number, transcript: string, profile: FounderProfile): DeckReport {
  const checked = compare(items, profile).sort((a, b) => ({ conflict: 0, unverified: 1, match: 2 })[a.status] - ({ conflict: 0, unverified: 1, match: 2 })[b.status] || (a.slide ?? 99) - (b.slide ?? 99));
  const slides = (transcript.match(/^--- Slide \d+ ---/gim) ?? []).length || null;
  const missing = readinessFromText(transcript).checks.filter((c) => !c.pass);
  const counts = { match: checked.filter((c) => c.status === 'match').length, conflict: checked.filter((c) => c.status === 'conflict').length, unverified: checked.filter((c) => c.status === 'unverified').length, dropped };
  const notes: string[] = [];
  if (!items.length) notes.push('No business figures could be read from this deck. If it is mostly images, try pasting its text instead.');
  if (dropped) notes.push(`${dropped} figure${dropped > 1 ? 's were' : ' was'} left out because the sentence it came from could not be found in the deck text.`);
  return { slides, words: transcript.split(/\s+/).filter(Boolean).length, checked, inconsistencies: internalConflicts(items), counts, missing, notes };
}

/** Sample deck text with two deliberate mismatches against the sample founder (gross margin 55% vs 58%, raise $5M vs $4M), for trying the feature. */
export const SAMPLE_DECK = `--- Slide 1 ---
Sattva Kitchen. Millet-based ready-to-cook breakfast for urban India.

--- Slide 2 ---
Traction
Rs 14 crore annualised revenue run-rate, growing 3.1x year on year.
34% of customers reorder within 90 days.
Average order value Rs 640.

--- Slide 3 ---
Unit economics
Gross margin 55% on every order. Contribution margin about 9% after marketing.

--- Slide 4 ---
Team
A 22-person team in Pune, with an in-house kitchen and batch-level lab testing.

--- Slide 5 ---
The ask
We are raising $5M to build out quick-commerce distribution and a second kitchen in Pune.`;
