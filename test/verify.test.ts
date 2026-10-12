import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gate, mentionsSubject, sectionConfidence } from '../lib/verify';
import type { Evidence, RawClaim } from '../lib/types';

const TODAY = '2026-10-12';
const ev = (id: string, text: string, o: Partial<Evidence> = {}): Evidence => ({
  id, url: `https://example.com/${id}`, domain: 'techcrunch.com', title: id, publishedAt: '2026-09-29', tier: 2, text, origin: 'grounding', fullFetch: true, fetchedAt: TODAY, ...o,
});
const claim = (o: Partial<RawClaim>): RawClaim => ({
  section: 'deals', kind: 'investment', text: 'Peak XV led a round.', company: 'Acme', eventDate: '2026-09-29', evidenceIds: ['E1'],
  quote: 'Peak XV Partners led the $45 million Series B', severity: 'info', ...o,
});
const E = [ev('E1', 'Rajan Anandan said Peak XV Partners led the $45 million Series B in Acme this week.')];
const run = (claims: RawClaim[], evidence = E) => gate({ claims, evidence, name: 'Rajan Anandan', firm: 'Peak XV Partners', today: TODAY }).claims;

test('a well-supported recent deal passes', () => {
  const [c] = run([claim({})]);
  assert.equal(c.verified, true);
  assert.equal(c.dateSource, 'claim');
});

test('a quote that is not in the source is dropped (the core anti-hallucination rule)', () => {
  const [c] = run([claim({ quote: 'Peak XV Partners led the $90 million Series C' })]);
  assert.equal(c.verified, false);
  assert.equal(c.dropReason, 'quote_not_found_in_source');
});

test('a claim citing a non-existent evidence id is dropped', () => {
  assert.equal(run([claim({ evidenceIds: ['E99'] })])[0].dropReason, 'no_valid_evidence');
});

test('deals older than 90 days are dropped and counted', () => {
  const r = gate({ claims: [claim({ eventDate: '2026-07-01' })], evidence: E, name: 'Rajan Anandan', firm: 'Peak XV Partners', today: TODAY });
  assert.equal(r.claims[0].dropReason, 'outside_90_day_window');
  assert.equal(r.olderDealsOmitted, 1);
});

test('the 90-day boundary is inclusive', () => {
  assert.equal(run([claim({ eventDate: '2026-07-14' })])[0].verified, true);
  assert.equal(run([claim({ eventDate: '2026-07-13' })])[0].verified, false);
});

test('a deal with no date anywhere cannot be certified as recent', () => {
  const noDate = [ev('E1', E[0].text, { publishedAt: null })];
  assert.equal(run([claim({ eventDate: null })], noDate)[0].dropReason, 'deal_without_date');
});

test('missing event date falls back to the article date and says so', () => {
  const [c] = run([claim({ eventDate: null })]);
  assert.equal(c.verified, true);
  assert.equal(c.dateSource, 'article');
  assert.equal(c.eventDate, '2026-09-29');
});

test('future dates are rejected', () => {
  assert.equal(run([claim({ eventDate: '2026-12-01' })])[0].dropReason, 'date_in_future');
});

test('a source that never mentions the investor or firm is rejected', () => {
  const other = [ev('E1', 'Totally unrelated company raised $45 million Series B in Acme this week.')];
  assert.equal(run([claim({ quote: 'raised $45 million Series B in Acme' })], other)[0].dropReason, 'source_not_about_subject');
});

test('thesis statements older than 24 months are stale, but 12-month-old ones stay', () => {
  const t = (d: string) => claim({ section: 'thesis', kind: 'statement', eventDate: d });
  assert.equal(run([t('2024-02-27')])[0].dropReason, 'stale_over_24_months');
  assert.equal(run([t('2025-09-26')])[0].verified, true);
});

test('duplicates collapse to one', () => {
  const r = run([claim({}), claim({ text: 'Same deal reported twice.' })]);
  assert.equal(r.filter((c) => c.verified).length, 1);
  assert.equal(r[1].dropReason, 'duplicate');
});

test('mentionsSubject matches surname or firm core', () => {
  assert.ok(mentionsSubject('Anandan spoke at the summit', 'Rajan Anandan', 'Peak XV Partners'));
  assert.ok(mentionsSubject('Peak XV reported a fund close', 'Rajan Anandan', 'Peak XV Partners'));
  assert.equal(mentionsSubject('Sequoia reported a fund close', 'Rajan Anandan', 'Peak XV Partners'), false);
});

test('section confidence reflects source diversity and quality', () => {
  const evid = [ev('E1', 'x'), ev('E2', 'y', { domain: 'reuters.com' }), ev('E3', 'z', { domain: 'blog.example', tier: 3, fullFetch: false })];
  const claims = run([claim({}), claim({ company: 'Beta', evidenceIds: ['E2'], quote: 'x' })], evid);
  const high = sectionConfidence(
    [{ ...claims[0], verified: true, evidenceIds: ['E1', 'E2'] }, { ...claims[0], id: 'C2', verified: true, evidenceIds: ['E1'] }], evid,
  );
  assert.equal(high.deals, 'high');
  assert.equal(high.thesis, 'none');
  const low = sectionConfidence([{ ...claims[0], verified: true, evidenceIds: ['E3'] }], evid);
  assert.equal(low.deals, 'low');
});

import { isVague } from '../lib/verify';

test('vague wording is detected; named subjects pass', () => {
  assert.ok(isVague('A speaker stated that markets reward companies solving real problems.'));
  assert.ok(isVague('The quote indicates that they back founders.'));
  assert.ok(isVague('They back founders building durable consumer brands.'));
  assert.equal(isVague('Vani Kola said Kalaari backs founders building durable consumer brands.'), false);
  assert.equal(isVague('Forerunner led a $30 million Series A in Natural.'), false);
  assert.equal(isVague('Kirsten Green warned that virality will not endure for some consumer AI startups.'), false);
});
