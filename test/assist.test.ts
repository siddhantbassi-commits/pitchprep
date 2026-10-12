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

import { briefToSpeech } from '../lib/speech';
import type { BriefResult } from '../lib/types';

test('the spoken script covers who, openers, watch-outs and questions, with no stray markup', () => {
  const r = {
    investor: { name: 'Kirsten Green', firm: 'Forerunner Ventures', role: 'Founding Partner' },
    claims: [{ verified: true, section: 'context', severity: 'watch', text: 'Brian O\'Malley moved to board partner.' }],
    synthesis: { skim: ['Fund VII closed $500M.'], talkingPoints: [{ title: 'Retention', opener: 'We built around organic retention.' }], likelyQuestions: [{ question: 'How is margin trending?' }], questionsToAsk: [{ question: 'How do you use follow-on reserves?' }] },
  } as unknown as BriefResult;
  const lines = briefToSpeech(r);
  assert.match(lines[0], /Kirsten Green, Founding Partner, Forerunner Ventures/);
  for (const needle of ['Fund VII', 'organic retention', 'board partner', 'follow-on reserves', 'margin trending']) assert.ok(lines.some((l) => l.includes(needle)), needle);
  assert.ok(lines.every((l) => !/[<>{}]|undefined/.test(l)));
});

import { verifyThemes } from '../lib/patterns';

test('a recurring theme survives only if its snippets truly appear in at least two investors notes', () => {
  const notes = [
    { name: 'Kirsten Green', firm: 'Forerunner', notes: 'She worried about the quick-commerce margin squeeze and asked about repeat rate.' },
    { name: 'Rajan Anandan', firm: 'Peak XV', notes: 'Pushed hard on quick-commerce margin squeeze. Liked the community.' },
    { name: 'Garry Tan', firm: 'YC', notes: 'Asked about hiring plans only.' },
  ];
  const themes = verifyThemes([
    { theme: 'Quick-commerce margins', prepare: 'Show channel mix', evidence: [{ investor: 'Kirsten Green', snippet: 'quick-commerce margin squeeze' }, { investor: 'Rajan Anandan', snippet: 'quick-commerce margin squeeze' }] },
    { theme: 'Invented concern', prepare: 'x', evidence: [{ investor: 'Garry Tan', snippet: 'worried about burn rate and runway' }, { investor: 'Kirsten Green', snippet: 'worried about burn rate and runway' }] },
    { theme: 'Only one investor', prepare: 'x', evidence: [{ investor: 'Garry Tan', snippet: 'Asked about hiring plans only' }] },
  ], notes);
  assert.equal(themes.length, 1);
  assert.equal(themes[0].theme, 'Quick-commerce margins');
  assert.deepEqual(themes[0].investors.sort(), ['Kirsten Green', 'Rajan Anandan']);
});

test('theme verification accepts "Name (Firm)" labels echoed by the model and still rejects invented quotes', () => {
  const notes = [
    { name: 'Kirsten Green', firm: 'Forerunner', notes: 'She worried about the quick-commerce margin squeeze.' },
    { name: 'Rajan Anandan', firm: 'Peak XV', notes: 'Pushed hard on the quick-commerce margin squeeze.' },
  ];
  const t = verifyThemes([{ theme: 'Margins', prepare: 'x', evidence: [{ investor: 'Kirsten Green (Forerunner)', snippet: 'quick-commerce margin squeeze' }, { investor: 'Rajan Anandan (Peak XV)', snippet: 'quick-commerce margin squeeze' }] }], notes);
  assert.equal(t.length, 1);
  assert.deepEqual(t[0].investors.sort(), ['Kirsten Green', 'Rajan Anandan']);
  const bad = verifyThemes([{ theme: 'Made up', prepare: 'x', evidence: [{ investor: 'Kirsten Green (Forerunner)', snippet: 'asked about burn rate and runway' }, { investor: 'Rajan Anandan (Peak XV)', snippet: 'asked about burn rate and runway' }] }], notes);
  assert.equal(bad.length, 0);
});
