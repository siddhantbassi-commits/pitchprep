import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDelta } from '../lib/delta';
import type { BriefResult, Claim } from '../lib/types';

const claim = (id: string, o: Partial<Claim>): Claim => ({
  id, section: 'deals', kind: 'investment', text: `Deal ${id}`, company: id, eventDate: '2026-09-01', evidenceIds: ['E1'], quote: 'x'.repeat(20),
  severity: 'info', verified: true, dropReason: null, dateSource: 'claim', judge: 'supported', ...o,
});
const brief = (claims: Claim[]) => ({ claims } as unknown as BriefResult);

test('delta lists only verified claims that are new', () => {
  const prev = { id: 'p', created_at: '2026-10-01T00:00:00Z', result: brief([claim('A', {}), claim('B', {})]) };
  const cur = brief([claim('A', {}), claim('B', {}), claim('C', {}), claim('D', { verified: false })]);
  const d = computeDelta(cur, prev);
  assert.deepEqual([...d.newSince, ...d.alsoSurfaced].map((c) => c.text), ['Deal C']);
  assert.equal(d.newSince.length, 0); // dated 1 Sep, before the previous brief, so only "also surfaced"
});

test('the same deal reworded by the model on a re-run is not reported as new', () => {
  const prev = { id: 'p', created_at: '2026-10-01T00:00:00Z', result: brief([claim('Acme', { text: 'Peak XV led Acme.' })]) };
  const cur = brief([claim('Acme2', { company: 'Acme', text: 'Acme was led by Peak XV.' })]);
  const d = computeDelta(cur, prev);
  assert.equal(d.newSince.length + d.alsoSurfaced.length, 0);
});

test('an event dated after the previous brief counts as genuinely new', () => {
  const prev = { id: 'p', created_at: '2026-10-01T00:00:00Z', result: brief([claim('A', {})]) };
  const cur = brief([claim('A', {}), claim('Z', { eventDate: '2026-10-05' })]);
  const d = computeDelta(cur, prev);
  assert.deepEqual(d.newSince.map((c) => c.text), ['Deal Z']);
  assert.equal(d.alsoSurfaced.length, 0);
});
