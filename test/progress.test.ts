import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progress, type SessionLite } from '../lib/progress';

const mk = (n: number, overall: number, dims: [number, number, number, number], flags: string[] = []): SessionLite => ({
  id: `s${n}`, created_at: `2026-10-0${n}T10:00:00Z`, difficulty: 'tough', overall, investor_name: 'A', firm: 'B',
  score: { dimensions: [{ key: 'directness', score: dims[0] }, { key: 'evidence', score: dims[1] }, { key: 'candour', score: dims[2] }, { key: 'brevity', score: dims[3] }], flags },
});

test('no rounds: an invitation, not a chart', () => {
  const p = progress([]); assert.equal(p.rounds, 0); assert.match(p.insights[0], /first mock meeting/);
});

test('rounds are ordered oldest first and the change is last minus first', () => {
  const p = progress([mk(3, 70, [4, 3, 3, 4]), mk(1, 50, [2, 3, 2, 4]), mk(2, 60, [3, 3, 2, 4])]);
  assert.deepEqual(p.points.map((x) => x.overall), [50, 60, 70]);
  assert.equal(p.change, 20); assert.match(p.insights[0], /Up 20 points/);
});

test('a skill scoring 2 or lower in at least half the rounds is called out with advice', () => {
  const p = progress([mk(1, 50, [3, 3, 2, 4]), mk(2, 55, [3, 3, 2, 4]), mk(3, 65, [3, 3, 4, 4])]);
  assert.deepEqual(p.weak, ['candour']);
  assert.ok(p.insights.some((t) => /Candour scored 2 or lower in 2 of 3 rounds/.test(t) && /weak spot/.test(t)));
  assert.deepEqual(progress([mk(1, 70, [3, 3, 3, 3]), mk(2, 70, [3, 3, 3, 3])]).weak, []);
});

test('figure flags and a drop in score are reported plainly; unscored sessions are ignored', () => {
  const p = progress([mk(1, 70, [4, 4, 4, 4], ['x']), mk(2, 50, [3, 3, 3, 3]), { ...mk(3, 0, [1, 1, 1, 1]), overall: null, score: null }]);
  assert.equal(p.rounds, 2); assert.equal(p.roundsWithFigureFlags, 1);
  assert.match(p.insights[0], /Down 20 points/); assert.ok(p.insights.some((t) => /1 of 2 rounds/.test(t)));
});

test('a single round does not pretend to show a trend', () => {
  const p = progress([mk(1, 60, [3, 3, 3, 3])]); assert.equal(p.change, null); assert.match(p.insights[0], /second round/);
});

import { verifyPreMortem } from '../lib/premortem';
import { DEMO_PROFILE } from '../lib/demoProfile';
import type { Claim } from '../lib/types';

const claim = (id: string, verified = true) => ({ id, text: 'Forerunner closed Fund VII to back AI consumer companies.', verified } as unknown as Claim);
const R = (o: Record<string, unknown>) => ({ reason: 'Fund VII leans to AI, so a food brand could read as off-thesis.', basis: 'investor', claimIds: ['c1'], profileQuote: null, practiceSkill: null, prep: 'Lead with repeat rate.', ...o });

test('a pre-mortem reason survives only if it rests on a verified claim, a verbatim profile line, or a real weak skill', () => {
  const claims = [claim('c1'), claim('c2', false)];
  const line = DEMO_PROFILE.traction.slice(0, 40);
  const v = verifyPreMortem({ reasons: [
    R({}), // good: verified claim
    R({ reason: 'Invented.', claimIds: ['zzz'] }), // unknown claim
    R({ reason: 'Unverified claim.', claimIds: ['c2'] }), // claim exists but was not verified
    R({ reason: 'Profile based.', basis: 'founder', claimIds: [], profileQuote: line }),
    R({ reason: 'Misquoted profile.', basis: 'founder', claimIds: [], profileQuote: 'We have 900% growth' }),
    R({ reason: 'Practice based.', basis: 'practice', claimIds: [], practiceSkill: 'candour' }),
    R({ reason: 'Made-up skill.', basis: 'practice', claimIds: [], practiceSkill: 'charisma' }),
  ] } as never, claims, DEMO_PROFILE, ['candour']);
  assert.deepEqual(v.reasons.map((r) => r.reason), ['Fund VII leans to AI, so a food brand could read as off-thesis.', 'Profile based.', 'Practice based.']);
  assert.equal(v.dropped, 4);
});

test('certainty about the investor decision is refused, and duplicates and the cap of three hold', () => {
  const claims = [claim('c1')];
  const v = verifyPreMortem({ reasons: [R({ reason: 'They will definitely pass on this.' }), R({ reason: 'A' }), R({ reason: 'a' }), R({ reason: 'B' }), R({ reason: 'C' }), R({ reason: 'D' })] } as never, claims, DEMO_PROFILE, []);
  assert.deepEqual(v.reasons.map((r) => r.reason), ['A', 'B', 'C']);
});
