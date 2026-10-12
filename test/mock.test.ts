import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalizeScore, overallScore, pairs, type Turn } from '../lib/mock';
import { DEMO_PROFILE } from '../lib/demoProfile';

const turns: Turn[] = [
  { role: 'investor', text: 'Why millet, and why now?' },
  { role: 'founder', text: 'Millet is moving from a niche to a daily staple, and our repeat rate is 34% across the quarter, which tells us people actually come back.' },
  { role: 'investor', text: 'How defensible is that?' },
  { role: 'founder', text: 'We grew 40% month on month and nobody can copy it.' },
];
const dims = (s: number[]) => (['directness', 'evidence', 'candour', 'brevity'] as const).map((key, i) => ({ key, score: s[i], note: 'n' }));

test('pairs attach each answer to the question before it', () => {
  const p = pairs(turns);
  assert.equal(p.length, 2);
  assert.equal(p[1].question, 'How defensible is that?');
});

test('overall is arithmetic on the dimension scores, not a model opinion', () => {
  assert.equal(overallScore([5, 5, 5, 5]), 100);
  assert.equal(overallScore([3, 3, 3, 3]), 60);
  assert.equal(overallScore([4, 2, 3, 3]), 60);
});

test('a quoted strongest moment must be verbatim from a founder answer, else it is withheld', () => {
  const good = finalizeScore({ dimensions: dims([4, 4, 3, 4]), perAnswer: [{ n: 1, note: 'a' }, { n: 2, note: 'b' }], strongest: 'our repeat rate is 34% across the quarter', biggestFix: 'x' }, turns, DEMO_PROFILE);
  assert.equal(good.strongest, 'our repeat rate is 34% across the quarter');
  const made = finalizeScore({ dimensions: dims([4, 4, 3, 4]), perAnswer: [], strongest: 'we have the best margins in the category', biggestFix: 'x' }, turns, DEMO_PROFILE);
  assert.equal(made.strongest, null);
});

test('figures that are not in the profile are flagged per answer in code', () => {
  const sc = finalizeScore({ dimensions: dims([3, 3, 3, 3]), perAnswer: [], strongest: '', biggestFix: 'x' }, turns, DEMO_PROFILE);
  assert.equal(sc.perAnswer[0].flags.length, 0);
  assert.ok(sc.perAnswer[1].flags.some((f) => f.includes('40')));
  assert.ok(sc.flags.length === 1);
});

test('missing dimensions default to the neutral score and scores are clamped to 1-5', () => {
  const sc = finalizeScore({ dimensions: [{ key: 'directness', score: 9 as never, note: '' }], perAnswer: [], strongest: '', biggestFix: '' }, turns, DEMO_PROFILE);
  assert.equal(sc.dimensions.find((d) => d.key === 'directness')!.score, 5);
  assert.equal(sc.dimensions.find((d) => d.key === 'evidence')!.score, 3);
});

import { stretchLines } from '../lib/assist';

test('a sentence that names the investor and characterises their interests is flagged; a plain sourced observation is not', () => {
  const blurb = 'Priya is reaching out because Alexis Ohanian participated in the Series C round for Neko Health, aligning with consumer health-focused ventures. She noticed that Alexis Ohanian participated in a $700 million Series C round in July 2026. Sattva Kitchen is raising $4M and fits a seed round.';
  const flagged = stretchLines(blurb, 'Alexis Ohanian', 'Seven Seven Six');
  assert.equal(flagged.length, 1);
  assert.match(flagged[0], /aligning/);
});
