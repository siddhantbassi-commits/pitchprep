import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSealed, open, seal } from '../lib/crypto';

process.env.WORKSPACE_SECRET = 'test-secret-for-unit-tests'; // the key is read lazily, at call time

test('a calendar link round-trips and is not readable in storage', () => {
  const url = 'https://calendar.google.com/calendar/ical/me%40x.com/private-abc123/basic.ics';
  const s = seal(url);
  assert.ok(isSealed(s));
  assert.ok(!s.includes('private-abc123') && !s.includes('google.com'));
  assert.equal(open(s), url);
});

test('the same link encrypts differently each time (random IV)', () => {
  assert.notEqual(seal('https://example.com/a.ics'), seal('https://example.com/a.ics'));
});

test('tampering is detected, and legacy plain values still read', () => {
  const s = seal('https://example.com/a.ics');
  const bad = s.slice(0, -3) + (s.endsWith('AAA') ? 'BBB' : 'AAA');
  assert.throws(() => open(bad));
  assert.equal(open('https://example.com/legacy.ics'), 'https://example.com/legacy.ics');
});
