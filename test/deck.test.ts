import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, compare, internalConflicts, profileFigures, SAMPLE_DECK, verifyItems, type Item } from '../lib/deckCore';
import { DEMO_PROFILE } from '../lib/demoProfile';

const it = (metric: Item['metric'], number: number, quote: string, o: Partial<Item> = {}): Item => ({ metric, label: metric, value: String(number), number, timeframe: 'current', slide: 2, quote, ...o });

test('profile figures are read clause by clause, so one metric never borrows another\'s number', () => {
  assert.deepEqual(profileFigures(DEMO_PROFILE, 'gross_margin'), ['58']);
  assert.deepEqual(profileFigures(DEMO_PROFILE, 'contribution_margin'), ['9']);
  assert.ok(profileFigures(DEMO_PROFILE, 'raise_amount').includes('4') && profileFigures(DEMO_PROFILE, 'raise_amount').includes('34'));
  assert.ok(profileFigures(DEMO_PROFILE, 'revenue').includes('14'));
  assert.ok(profileFigures(DEMO_PROFILE, 'team_size').includes('22'));
  assert.deepEqual(profileFigures(DEMO_PROFILE, 'burn'), []);
});

test('figures are compared with the profile: match, conflict, or cannot be checked', () => {
  const r = compare([
    it('gross_margin', 58, 'Gross margin 58%'), it('gross_margin', 55, 'Gross margin 55%'), it('burn', 25, 'We burn Rs 25 lakh a month'),
    it('revenue', 20, 'Projected Rs 20 crore next year', { timeframe: 'projection' }),
  ], DEMO_PROFILE);
  assert.deepEqual(r.map((x) => x.status), ['match', 'conflict', 'unverified', 'unverified']);
  assert.match(r[1].note, /profile says 58/); assert.match(r[2].note, /does not state this/); assert.match(r[3].note, /forecast/);
});

test('a quote that is not in the deck, or a number that is not in its quote, is dropped before any comparison', () => {
  const t = 'Gross margin 58% on every order. A team of 22 people.';
  const v = verifyItems({ items: [it('gross_margin', 58, 'Gross margin 58%'), it('gross_margin', 60, 'Gross margin 60%'), it('team_size', 30, 'A team of 22 people'), it('team_size', 22, 'A team of 22 people')] }, t);
  assert.deepEqual(v.items.map((x) => x.number), [58, 22]); assert.equal(v.dropped, 2);
});

test('the same figure given two different current values inside the deck is flagged; periods and growth are not', () => {
  const c = internalConflicts([it('revenue', 14, 'Rs 14 crore', { slide: 2 }), it('revenue', 11, 'Rs 11 crore', { slide: 6 }), it('revenue', 9, 'Rs 9 crore', { timeframe: 'past' }), it('growth', 3.1, '3.1x'), it('growth', 40, '40% MoM')]);
  assert.equal(c.length, 1); assert.deepEqual(c[0].values.map((v) => v.slide), [2, 6]);
});

test('the sample deck reproduces its two deliberate mismatches and reports what the deck never mentions', () => {
  const items = [
    it('revenue', 14, 'Rs 14 crore annualised revenue run-rate'), it('gross_margin', 55, 'Gross margin 55%'), it('retention', 34, '34% of customers reorder'),
    it('raise_amount', 5, 'raising $5M'), it('team_size', 22, 'A 22-person team'),
  ];
  const rep = buildReport(items, 0, SAMPLE_DECK, DEMO_PROFILE);
  assert.equal(rep.counts.conflict, 2); assert.equal(rep.counts.match, 3); assert.equal(rep.slides, 5);
  assert.deepEqual(rep.checked.slice(0, 2).map((c) => c.metric).sort(), ['gross_margin', 'raise_amount']);
  const missing = rep.missing.map((m) => m.id);
  assert.ok(missing.includes('burn') && missing.includes('cac') && !missing.includes('gm') && !missing.includes('revenue'));
});

test('the amount being raised is always compared, even if the model called it a target', () => {
  const r = compare([it('raise_amount', 5, 'We are raising $5M to build', { timeframe: 'projection' })], DEMO_PROFILE);
  assert.equal(r[0].status, 'conflict'); assert.match(r[0].note, /profile says 4 or 34/);
});
