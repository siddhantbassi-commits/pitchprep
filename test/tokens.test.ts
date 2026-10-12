import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext, signToken, verifyToken } from '../lib/tokens';
import { EMAIL_RE } from '../lib/mailer';

process.env.WORKSPACE_SECRET = 'test-secret-for-unit-tests';

test('a signed token verifies and carries its data', () => {
  const t = signToken('confirm', { ws: 'abc', email: 'a@b.co' }, 600);
  const v = verifyToken<{ ws: string; email: string }>(t, 'confirm');
  assert.equal(v?.ws, 'abc');
  assert.equal(v?.email, 'a@b.co');
});

test('wrong purpose, tampering, and expiry are all rejected', () => {
  const t = signToken('confirm', { ws: 'abc' }, 600);
  assert.equal(verifyToken(t, 'unsub'), null); // a confirm link cannot be used to unsubscribe or sign in
  const [body, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ p: 'confirm', exp: 9999999999, ws: 'someone-else' })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${sig}`, 'confirm'), null);
  assert.equal(verifyToken(`${body}.AAAA`, 'confirm'), null);
  const old = signToken('confirm', { ws: 'abc' }, 60, Date.now() - 120_000);
  assert.equal(verifyToken(old, 'confirm'), null);
  assert.equal(verifyToken('garbage', 'confirm'), null);
});

test('redirect targets must stay on this site', () => {
  assert.equal(safeNext('/brief/123?x=1'), '/brief/123?x=1');
  assert.equal(safeNext('//evil.com'), '/');
  assert.equal(safeNext('https://evil.com'), '/');
  assert.equal(safeNext('/\\evil'), '/');
  assert.equal(safeNext(undefined), '/');
});

test('email address validation', () => {
  for (const ok of ['priya@sattvakitchen.in', 'a.b+tag@sub.example.co']) assert.ok(EMAIL_RE.test(ok), ok);
  for (const bad of ['no-at.com', 'a@b', 'a b@c.com', 'a@b.c', '<x>@y.com', 'a@@b.com']) assert.equal(EMAIL_RE.test(bad), false, bad);
});
