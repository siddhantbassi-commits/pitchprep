import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSnapshot, parseMix, snapshot } from '../lib/snapshot';
import { DEMO_PROFILE } from '../lib/demoProfile';

test('the sample founder\'s numbers become the charts, exactly as written in the profile', () => {
  const s = snapshot(DEMO_PROFILE);
  assert.deepEqual(s.mix, [{ label: 'Own website and app', value: 62 }, { label: 'Quick-commerce', value: 38 }]);
  assert.deepEqual(s.growth, [{ label: 'A year ago', value: 4.5, implied: true }, { label: 'Now (run-rate)', value: 14, implied: false }]);
  assert.equal(s.growthNote, '3.1x year on year');
  assert.deepEqual(s.ratios.map((r) => [r.label, r.value]), [
    ['Gross margin', 58], ['Contribution margin', 9], ['Customers who reorder within 90 days', 34], ['Repeat orders driven by the community', 41], ['US share of revenue', 9],
  ]);
  assert.ok(hasSnapshot(s));
});

test('a profile without these numbers gets no charts and no errors', () => {
  const s = snapshot({ ...DEMO_PROFILE, traction: 'We are early and growing.', geography: 'Everywhere', differentiators: 'Great team', stage: 'Pre-seed' });
  assert.equal(s.mix, null); assert.equal(s.growth, null); assert.deepEqual(s.ratios, []);
  assert.equal(hasSnapshot(s), false);
});

test('mix parsing ignores brackets, tops up to 100, and refuses nonsense', () => {
  assert.deepEqual(parseMix('Mix: 60% direct, 30% marketplaces (Amazon, Flipkart)'), [{ label: 'Direct', value: 60 }, { label: 'Marketplaces', value: 30 }, { label: 'Other', value: 10 }]);
  assert.equal(parseMix('Mix: 80% direct, 70% retail'), null); // adds to 150
  assert.equal(parseMix('No mix stated'), null);
});

test('growth needs both a revenue figure and a multiple, and the earlier value is labelled implied', () => {
  const onlyRevenue = snapshot({ ...DEMO_PROFILE, traction: 'Rs 14 crore annualised revenue run-rate.' });
  assert.equal(onlyRevenue.growth, null);
  const both = snapshot({ ...DEMO_PROFILE, traction: 'Rs 20 crore annualised revenue run-rate, up 2x year on year.' });
  assert.deepEqual(both.growth!.map((g) => [g.value, g.implied]), [[10, true], [20, false]]);
});
