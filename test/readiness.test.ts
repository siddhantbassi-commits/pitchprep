import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readiness } from '../lib/readiness';
import { DEMO_PROFILE } from '../lib/demoProfile';
import type { FounderProfile } from '../lib/types';

const empty: FounderProfile = { founderName: 'A', startup: 'B', oneLiner: 'A thing', sector: 'Food', stage: 'Seed', raise: 'Raising money', geography: 'India', traction: 'Some traction', differentiators: 'Good product' };

test('a bare profile fails almost everything and says what to add', () => {
  const r = readiness(empty);
  assert.ok(r.passed <= 2);
  assert.ok(r.checks.every((c) => c.why.length > 10 && c.say.length > 10));
});

test('the sample founder passes the numbers she states and fails burn and runway', () => {
  const r = readiness(DEMO_PROFILE);
  const by = Object.fromEntries(r.checks.map((c) => [c.id, c.pass]));
  for (const id of ['revenue', 'growth', 'gm', 'cm', 'retention', 'aov', 'mix', 'team', 'funds']) assert.equal(by[id], true, id);
  assert.equal(by.burn, false);
  assert.equal(r.total, 11);
});

test('adding the missing number turns the check green', () => {
  const r = readiness({ ...DEMO_PROFILE, traction: DEMO_PROFILE.traction + ' Monthly burn is Rs 55 lakh with 14 months of runway.' });
  assert.equal(r.checks.find((c) => c.id === 'burn')!.pass, true);
});
