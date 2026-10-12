import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, istTime, renderEmail, type EmailData, type NudgeKind } from '../lib/emailTemplates';

const base = (kind: NudgeKind, extra: Partial<EmailData> = {}): EmailData => ({
  kind, founderName: 'Priya Raghunathan', openUrl: 'https://app.test/a/TOKEN', unsubscribeUrl: 'https://app.test/unsubscribe?t=U', confirmUrl: 'https://app.test/api/nudges/confirm?t=C', ...extra,
});

test('every email kind renders with an unsubscribe link, a call to action and no unfilled placeholders', () => {
  const kinds: NudgeKind[] = ['confirm', 'signin', 'test', 'brief_ready', 'pre_meeting', 'follow_up', 'overdue', 'digest'];
  for (const k of kinds) {
    const r = renderEmail(base(k, { investor: { name: 'Kirsten Green', firm: 'Forerunner Ventures' }, meetingAt: '2026-10-13T05:30:00.000Z', skim: ['Fund VII closed'], openers: [{ title: 'T', opener: 'Say this' }], overdue: [{ investor: 'A B', nextStep: 'Send data', due: '2026-10-10' }], today: [{ investor: 'A B', firm: 'C D', time: '11:00 IST', briefReady: true }] }));
    assert.ok(r.subject.length > 5, k);
    assert.ok(r.text.includes('https://app.test/unsubscribe?t=U'), `${k} text has unsubscribe`);
    assert.ok(r.html.includes('Unsubscribe'), `${k} html has unsubscribe`);
    assert.ok(!/undefined|\[object|NaN/.test(r.text + r.html), `${k} has no stray placeholders`);
  }
});

test('the confirmation email carries the confirm link and says nothing is sent until confirmed', () => {
  const r = renderEmail(base('confirm'));
  assert.ok(r.text.includes('/api/nudges/confirm?t=C'));
  assert.match(r.text, /ignore this email and nothing will be sent/);
});

test('model-written text is HTML-escaped, so an injected tag cannot run in an email', () => {
  const r = renderEmail(base('pre_meeting', { investor: { name: '<img src=x onerror=alert(1)>', firm: 'F' }, meetingAt: '2026-10-13T05:30:00.000Z', newSince: ['<script>alert(1)</script>'] }));
  assert.ok(!r.html.includes('<script>') && !r.html.includes('<img src=x'));
  assert.equal(esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
});

test('pre-meeting email says what is new, or plainly that nothing is', () => {
  const some = renderEmail(base('pre_meeting', { investor: { name: 'A B', firm: 'C' }, meetingAt: '2026-10-13T05:30:00.000Z', newSince: ['Forerunner closed Fund VII'] }));
  assert.match(some.text, /New since your last brief/i);
  const none = renderEmail(base('pre_meeting', { investor: { name: 'A B', firm: 'C' }, meetingAt: '2026-10-13T05:30:00.000Z' }));
  assert.match(none.text, /Nothing new since your last brief/);
});

test('times are always India time, hand-formatted', () => {
  assert.equal(istTime('2026-10-13T05:30:00.000Z'), '11:00 IST on 13 Oct');
  assert.equal(istTime('2026-12-31T20:00:00.000Z'), '01:30 IST on 1 Jan');
});
