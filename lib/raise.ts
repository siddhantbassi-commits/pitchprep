// The raise cockpit's arithmetic. Pure and unit-tested: no model, no guesses. Anything that is an assumption
// (like the chance that a soft-circled investor closes) is labelled and editable, never presented as fact.

export type Currency = 'USD' | 'INR';
export type CStatus = 'interested' | 'soft_circled' | 'committed' | 'term_sheet' | 'passed';

export const CSTATUSES: CStatus[] = ['interested', 'soft_circled', 'committed', 'term_sheet', 'passed'];
export const CSTATUS_LABEL: Record<CStatus, string> = { interested: 'Interested', soft_circled: 'Soft-circled', committed: 'Committed', term_sheet: 'Term sheet', passed: 'Passed' };

/** One unit the founder types in: millions of dollars, or crore rupees (1 crore = 10,000,000). */
export const UNIT: Record<Currency, { size: number; label: string; short: string }> = {
  USD: { size: 1_000_000, label: 'million dollars', short: '$M' },
  INR: { size: 10_000_000, label: 'crore rupees', short: 'crore' },
};
export const toBase = (c: Currency, v: number) => Math.round(v * UNIT[c].size);
export const fromBase = (c: Currency, v: number) => v / UNIT[c].size;

export function fmtMoney(c: Currency, base: number): string {
  const n = Math.abs(base);
  const sign = base < 0 ? '-' : '';
  if (c === 'USD') {
    if (n >= 1e6) return `${sign}$${trim(n / 1e6)}M`;
    if (n >= 1e3) return `${sign}$${Math.round(n / 1e3)}K`;
    return `${sign}$${Math.round(n)}`;
  }
  if (n >= 1e7) return `${sign}₹${trim(n / 1e7)} crore`;
  if (n >= 1e5) return `${sign}₹${trim(n / 1e5)} lakh`;
  return `${sign}₹${Math.round(n).toLocaleString('en-IN')}`;
}
const trim = (x: number) => (Math.round(x * 100) / 100).toString();

export interface Plan {
  currency: Currency; target: number; pre_money: number | null; min_close: number | null; close_by: string | null;
  founder_pct: number | null; monthly_burn: number | null;
}
export interface Commitment { investor_key: string; investor_name: string; firm: string; amount: number; status: CStatus; is_lead: boolean }

/** Assumed chance each stage closes. These are the founder's to change; they are not facts about investors. */
export const DEFAULT_PROB: Record<Exclude<CStatus, 'passed'>, number> = { interested: 0.1, soft_circled: 0.4, committed: 0.85, term_sheet: 0.95 };

export interface Summary {
  target: number; committed: number; soft: number; interested: number; pipeline: number; expected: number;
  pctCommitted: number; pctCommittedSoft: number; pctPipeline: number; coverage: number | null; gap: number;
  hasLead: boolean; leadName: string | null; meetsMin: boolean | null;
  dilutionAtTarget: number | null; dilutionIfCommittedSoft: number | null; dilutionIfCommitted: number | null;
  founderAfterAtTarget: number | null; runwayMonthsAtTarget: number | null; runwayMonthsCommitted: number | null;
  daysLeft: number | null; investorsActive: number; warnings: string[];
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const dilution = (money: number, pre: number | null) => (pre && pre > 0 ? Math.round((money / (pre + money)) * 1000) / 10 : null);

export function summarize(plan: Plan, items: Commitment[], now = new Date(), prob = DEFAULT_PROB): Summary {
  const live = items.filter((i) => i.status !== 'passed');
  const sum = (f: (i: Commitment) => boolean) => live.filter(f).reduce((n, i) => n + (Number.isFinite(i.amount) ? i.amount : 0), 0);
  const committed = sum((i) => i.status === 'committed' || i.status === 'term_sheet');
  const soft = sum((i) => i.status === 'soft_circled');
  const interested = sum((i) => i.status === 'interested');
  const pipeline = committed + soft + interested;
  const expected = live.reduce((n, i) => n + (i.amount || 0) * prob[i.status as Exclude<CStatus, 'passed'>], 0);
  const t = plan.target;
  const lead = live.find((i) => i.is_lead);
  const closeBy = plan.close_by ? Date.parse(`${plan.close_by}T00:00:00Z`) : null;
  const daysLeft = closeBy == null ? null : Math.ceil((closeBy - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86_400_000);
  const runway = (m: number) => (plan.monthly_burn && plan.monthly_burn > 0 ? Math.round((m / plan.monthly_burn) * 10) / 10 : null);
  const founderAfter = plan.founder_pct != null && plan.pre_money ? Math.round(plan.founder_pct * (1 - t / (plan.pre_money + t)) * 10) / 10 : null;

  const s: Summary = {
    target: t, committed, soft, interested, pipeline, expected: Math.round(expected),
    pctCommitted: pct(committed, t), pctCommittedSoft: pct(committed + soft, t), pctPipeline: pct(pipeline, t),
    coverage: t > 0 ? Math.round((pipeline / t) * 10) / 10 : null, gap: Math.max(0, t - committed),
    hasLead: !!lead, leadName: lead?.investor_name ?? null,
    meetsMin: plan.min_close ? committed + soft >= plan.min_close : null,
    dilutionAtTarget: dilution(t, plan.pre_money), dilutionIfCommittedSoft: dilution(committed + soft, plan.pre_money), dilutionIfCommitted: dilution(committed, plan.pre_money),
    founderAfterAtTarget: founderAfter, runwayMonthsAtTarget: runway(t), runwayMonthsCommitted: runway(committed),
    daysLeft, investorsActive: live.length, warnings: [],
  };

  if (!(t > 0)) s.warnings.push('Set a target to see progress.');
  else {
    if (!s.hasLead && live.length) s.warnings.push('No lead investor identified yet. Rounds rarely close without one setting the terms.');
    if (committed > t * 1.0001) s.warnings.push('Commitments exceed your target: the round is oversubscribed. Decide whether to raise the target or allocate.');
    if (s.coverage != null && s.coverage < 1 && live.length) s.warnings.push(`Everyone in the pipeline together would not fill the round (${s.coverage}x of target). You need more investors in the funnel.`);
    if (plan.min_close && committed + soft < plan.min_close) s.warnings.push('Committed plus soft-circled is still below your minimum close.');
    if (daysLeft != null && daysLeft < 0) s.warnings.push('Your close-by date has passed. Update it or the target.');
    else if (daysLeft != null && daysLeft <= 14 && s.pctCommitted < 60) s.warnings.push(`Only ${daysLeft} days to your close-by date with ${s.pctCommitted}% committed.`);
    if (!plan.pre_money) s.warnings.push('Add a pre-money valuation to see dilution.');
  }
  return s;
}
