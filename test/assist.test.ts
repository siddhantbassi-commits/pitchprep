import { test } from 'node:test';
import assert from 'node:assert/strict';
import { significantNumbers, unknownNumbers } from '../lib/text';
import { fitLabel, fitScore } from '../lib/tracker';
import { DEMO_PROFILE } from '../lib/demoProfile';

const profile = Object.values(DEMO_PROFILE).join('\n');

test('significant numbers: units and currency count, lone small digits do not', () => {
  const n = significantNumbers('34% repeat, Rs 14 crore run-rate, 3.1x growth, $4M raise, 22 people, 3 talking points, 140,000 subscribers');
  for (const want of ['34', '14', '3.1', '4', '22', '140000']) assert.ok(n.includes(want), `missing ${want}`);
  assert.ok(!n.includes('3'), 'a bare "3" is noise');
});

test('a figure that matches the profile is not flagged', () => {
  assert.deepEqual(unknownNumbers('Our 34% repeat rate and Rs 640 order value', [profile]), []);
});

test('a slip against the profile is caught by code (40% vs the recorded 34%)', () => {
  assert.deepEqual(unknownNumbers('Roughly 40% of customers reorder', [profile]), ['40']);
});

test('Indian and Western digit grouping are the same number, so no false alarm', () => {
  assert.deepEqual(unknownNumbers('We have 1,40,000 subscribers', ['140,000 subscribers']), []);
});

test('fit score and labels', () => {
  assert.equal(fitScore({ stage: 'strong', sector: 'strong', cheque: 'strong' }), 6);
  assert.equal(fitScore({ stage: 'weak', sector: 'weak', cheque: 'unknown' }), -2);
  assert.equal(fitScore(null), null);
  assert.equal(fitLabel(6), 'Strong fit');
  assert.equal(fitLabel(2), 'Promising');
  assert.equal(fitLabel(0), 'Unclear');
  assert.equal(fitLabel(-1), 'Weak fit');
  assert.equal(fitLabel(null), 'No fit read yet');
});

import { tidyEmail } from '../lib/assist';

test('a one-line email is restored to greeting, paragraphs and sign-off', () => {
  const out = tidyEmail('Hi Kirsten, Thank you for meeting today. I enjoyed the discussion. I will send the data by Friday. Please let me know what else helps. Best regards, Priya Raghunathan');
  const lines = out.split('\n');
  assert.equal(lines[0], 'Hi Kirsten,');
  assert.ok(out.includes('\n\n'));
  assert.equal(lines[lines.length - 1], 'Priya Raghunathan');
  assert.equal(lines[lines.length - 2], 'Best regards,');
});

test('an email that already has line breaks is left alone', () => {
  const e = 'Hi Kirsten,\n\nThanks.\n\nBest,\nPriya';
  assert.equal(tidyEmail(e), e);
});

import { applyFidelity } from '../lib/assist';

test('fidelity rewrites replace only unfaithful points with non-empty text', () => {
  const pts = [
    { title: 'a', angle: 'angle A', opener: 'opener A', claimIds: ['C1'] },
    { title: 'b', angle: 'angle B', opener: 'opener B', claimIds: ['C2'] },
    { title: 'c', angle: 'angle C', opener: 'opener C', claimIds: ['C3'] },
  ];
  const r = applyFidelity(pts, [
    { index: 0, faithful: true, opener: 'IGNORED', angle: 'IGNORED' },
    { index: 1, faithful: false, opener: 'fixed B', angle: 'fixed angle B' },
    { index: 2, faithful: false, opener: '   ', angle: 'x' }, // empty rewrite is refused
  ]);
  assert.equal(r.fixed, 1);
  assert.equal(r.points[0].opener, 'opener A');
  assert.equal(r.points[1].opener, 'fixed B');
  assert.equal(r.points[2].opener, 'opener C');
});
