// Pitch readiness: does the founder's profile contain the numbers investors almost always ask for?
// A keyword scan, deliberately simple and explainable. It checks that something is stated, not that it is good.

import type { FounderProfile } from './types';

export interface Check { id: string; label: string; pass: boolean; why: string; say: string }

interface Rule { id: string; label: string; test: RegExp; why: string; say: string }

const RULES: Rule[] = [
  { id: 'revenue', label: 'Revenue or run-rate', test: /(revenue|\barr\b|\bmrr\b|run-?rate|\bgmv\b|\bsales\b)/i, why: 'The first thing any investor wants to size.', say: 'We are at Rs X crore annualised revenue, up Y% year on year.' },
  { id: 'growth', label: 'Growth rate', test: /(\d+(\.\d+)?\s?x\b|\d+\s?%\s*(yoy|y\/y|year|growth|mom|month)|year on year|growing|growth)/i, why: 'Growth is how they judge momentum and whether the market is real.', say: 'Revenue grew Nx over the last 12 months, with M% of it month on month.' },
  { id: 'gm', label: 'Gross margin', test: /gross margin/i, why: 'Shows whether each sale leaves room to pay for the business.', say: 'Gross margin is X%, after product, packaging and fulfilment.' },
  { id: 'cm', label: 'Contribution margin or unit economics', test: /(contribution margin|\bcm[123]\b|unit economics|ebitda|per order)/i, why: 'Investors test whether growth makes money or burns it.', say: 'After marketing and delivery, contribution margin is X% per order.' },
  { id: 'retention', label: 'Retention or repeat behaviour', test: /(repeat|retention|re-?order|churn|\bltv\b|cohort)/i, why: 'Repeat demand is the clearest proof the product is wanted.', say: 'X% of customers reorder within 90 days; cohort Y still buys at month 6.' },
  { id: 'cac', label: 'Customer acquisition cost or payback', test: /(\bcac\b|acquisition cost|payback|blended cost)/i, why: 'Tells them what it costs to grow and how fast it pays back.', say: 'Blended CAC is Rs X with a Y-month payback.' },
  { id: 'aov', label: 'Order value or revenue per customer', test: /(\baov\b|average order|\barpu\b|ticket size|basket)/i, why: 'Needed to turn customer counts into revenue.', say: 'Average order value is Rs X, up Y% from last year.' },
  { id: 'mix', label: 'Channel or customer mix', test: /(\d+\s?%[^.]*\b(website|app|quick[- ]commerce|marketplace|amazon|retail|channel|direct|wholesale|b2b|d2c)\b|\bmix\b)/i, why: 'Concentration in one channel is a risk they will probe.', say: 'X% direct, Y% quick-commerce, Z% marketplaces.' },
  { id: 'burn', label: 'Burn and runway', test: /(\bburn\b|runway|months of cash|cash balance)/i, why: 'They need to know how long you can last, and how soon you must close.', say: 'We burn Rs X a month and have Y months of runway today.' },
  { id: 'funds', label: 'What the money is for', test: /(use of funds|will be used|to (build|scale|expand|hire|open|launch|fund)|raising[^.]*\bto\b)/i, why: 'A round without a plan reads as a round without a thesis.', say: 'Of the $X, 50% goes to distribution, 30% to a second kitchen, 20% to team.' },
  { id: 'team', label: 'Team size or key hires', test: /(\d+[- ]person|team of|\d+\s+(people|employees)|co-?founder|\bcto\b)/i, why: 'Shows capacity to execute and where the gaps are.', say: 'A team of N, with leads for operations, growth and product.' },
];

export function readiness(p: FounderProfile): { checks: Check[]; passed: number; total: number } {
  return readinessFromText(Object.values(p).join('\n'));
}

/** The same eleven rules over any text, for example the transcript of a pitch deck. */
export function readinessFromText(text: string): { checks: Check[]; passed: number; total: number } {
  const checks = RULES.map((r) => ({ id: r.id, label: r.label, pass: r.test.test(text), why: r.why, say: r.say }));
  return { checks, passed: checks.filter((c) => c.pass).length, total: checks.length };
}
