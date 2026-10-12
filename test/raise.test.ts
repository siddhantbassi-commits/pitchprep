import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtMoney, fromBase, summarize, toBase, type Commitment, type Plan } from '../lib/raise';

const plan = (o: Partial<Plan> = {}): Plan => ({ currency: 'USD', target: 4_000_000, pre_money: 16_000_000, min_close: 2_500_000, close_by: '2026-12-15', founder_pct: 60, monthly_burn: 200_000, ...o });
const c = (name: string, amount: number, status: Commitment['status'], is_lead = false): Commitment => ({ investor_key: name.toLowerCase(), investor_name: name, firm: '', amount, status, is_lead });
const NOW = new Date('2026-10-12T10:00:00Z');

test('dilution is new money over post-money, and the founder stake follows', () => {
  const s = summarize(plan(), [], NOW);
  assert.equal(s.dilutionAtTarget, 20); // 4 / (16 + 4)
  assert.equal(s.founderAfterAtTarget, 48); // 60% x (1 - 20%)
  assert.equal(s.runwayMonthsAtTarget, 20); // 4,000,000 / 200,000
});

test('progress separates committed, soft-circled and interested money, and ignores passed investors', () => {
  const s = summarize(plan(), [c('A', 1_000_000, 'committed', true), c('B', 500_000, 'term_sheet'), c('C', 800_000, 'soft_circled'), c('D', 2_000_000, 'interested'), c('E', 9_000_000, 'passed')], NOW);
  assert.equal(s.committed, 1_500_000);
  assert.equal(s.soft, 800_000);
  assert.equal(s.interested, 2_000_000);
  assert.equal(s.pipeline, 4_300_000);
  assert.equal(s.pctCommitted, 37.5);
  assert.equal(s.coverage, 1.1);
  assert.equal(s.gap, 2_500_000);
  assert.equal(s.hasLead, true);
  assert.equal(s.leadName, 'A');
  assert.equal(s.meetsMin, false); // 2.3M < 2.5M minimum
  assert.equal(s.investorsActive, 4);
});

test('the expected raise weights each stage by an assumed, editable chance', () => {
  const s = summarize(plan(), [c('A', 1_000_000, 'committed'), c('B', 1_000_000, 'interested')], NOW);
  assert.equal(s.expected, 950_000); // 0.85M + 0.1M
});

test('warnings are honest: no lead, thin pipeline, oversubscribed, passed date, missing valuation', () => {
  assert.ok(summarize(plan(), [c('A', 1_000_000, 'interested')], NOW).warnings.some((w) => /No lead/.test(w)));
  assert.ok(summarize(plan(), [c('A', 1_000_000, 'interested', true)], NOW).warnings.some((w) => /would not fill the round/.test(w)));
  assert.ok(summarize(plan(), [c('A', 5_000_000, 'committed', true)], NOW).warnings.some((w) => /oversubscribed/.test(w)));
  assert.ok(summarize(plan({ close_by: '2026-10-01' }), [], NOW).warnings.some((w) => /has passed/.test(w)));
  assert.ok(summarize(plan({ pre_money: null }), [], NOW).warnings.some((w) => /pre-money/.test(w)));
  assert.deepEqual(summarize(plan({ target: 0 }), [], NOW).warnings, ['Set a target to see progress.']);
});

test('days left counts whole days to the close-by date', () => {
  assert.equal(summarize(plan({ close_by: '2026-10-15' }), [], NOW).daysLeft, 3);
  assert.equal(summarize(plan({ close_by: null }), [], NOW).daysLeft, null);
});

test('money formatting: dollars in K and M, rupees in lakh and crore', () => {
  assert.equal(fmtMoney('USD', 4_000_000), '$4M');
  assert.equal(fmtMoney('USD', 850_000), '$850K');
  assert.equal(fmtMoney('INR', 340_000_000), '₹34 crore');
  assert.equal(fmtMoney('INR', 7_500_000), '₹75 lakh');
  assert.equal(toBase('INR', 34), 340_000_000);
  assert.equal(fromBase('USD', 4_000_000), 4);
});
