import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicUrl, isPrivateIp, parseRobots } from '../lib/safeFetch';
import { guessFirmDomain, tierOf } from '../lib/sources';

test('private and loopback addresses are blocked (SSRF guard)', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1', '0.0.0.0']) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '142.250.80.46']) assert.equal(isPrivateIp(ip), false, ip);
});

test('assertPublicUrl refuses unsafe URLs before any request is made', async () => {
  for (const u of ['http://localhost/x', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data', 'file:///etc/passwd', 'ftp://example.com', 'http://user:pw@example.com/', 'http://[::1]/', 'http://metadata.internal/'])
    await assert.rejects(() => assertPublicUrl(u), u);
});

test('robots.txt parsing honours * and our bot, ignores others', () => {
  const txt = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nDisallow: /admin # comment\nAllow: /private/ok';
  assert.deepEqual(parseRobots(txt), ['/private', '/admin']);
});

test('firm domain guessing', () => {
  assert.equal(guessFirmDomain('Peak XV Partners', ['economictimes.com', 'peakxv.com']), 'peakxv.com');
  assert.equal(guessFirmDomain('Y Combinator', ['ycombinator.com', 'techcrunch.com']), 'ycombinator.com');
  assert.equal(guessFirmDomain('Forerunner Ventures', ['forerunnerventures.com']), 'forerunnerventures.com');
  assert.equal(guessFirmDomain('Peak XV Partners', ['techcrunch.com']), null);
});

test('source tiers', () => {
  assert.equal(tierOf('peakxv.com', 'peakxv.com'), 1);
  assert.equal(tierOf('techcrunch.com', 'peakxv.com'), 2);
  assert.equal(tierOf('random-blog.xyz', 'peakxv.com'), 3);
});

import { ALLOWED_CAL, ALLOWED_HTML } from '../lib/safeFetch';

test('calendar feeds (text/calendar, as Google serves them) are accepted for calendars but not for web pages', () => {
  assert.ok(ALLOWED_CAL.test('text/calendar; charset=UTF-8'));
  assert.ok(ALLOWED_CAL.test('application/ics'));
  assert.equal(ALLOWED_HTML.test('text/calendar; charset=UTF-8'), false);
  assert.equal(ALLOWED_CAL.test('application/json'), false);
  assert.ok(ALLOWED_HTML.test('text/html; charset=utf-8'));
});
