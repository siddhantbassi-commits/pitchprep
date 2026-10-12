import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istDate, istHour, plan, type MeetingLite, type Prefs, type Snapshot } from '../lib/nudgeEngine';

const prefs: Prefs = { enabled: true, verified: true, brief_ready: true, pre_meeting: true, follow_up: true, overdue: true, daily_digest: true, bump: true, weekly: true, lead_minutes: 120 };
const T = (iso: string) => new Date(iso);
const meeting = (o: Partial<MeetingLite> = {}): MeetingLite => ({ id: 'm1', starts_at: '2026-10-13T05:30:00.000Z', title: 'Intro', status: 'prepared', is_investor: true, investor_name: 'Kirsten Green', firm: 'Forerunner Ventures', brief_id: 'b1', ...o });
const DIGEST_DONE = 'digest|2026-10-13'; // keeps the morning digest out of tests about other nudges
const snap = (o: Partial<Snapshot> = {}): Snapshot => ({ now: T('2026-10-12T12:00:00.000Z'), prefs, meetings: [meeting()], notes: [], briefs: { b1: { id: 'b1', status: 'complete', ageMinutes: 30 } }, sent: new Set(), ...o });
const kinds = (s: Snapshot) => plan(s).send.map((d) => d.kind);

test('IST helpers', () => {
  assert.equal(istHour(T('2026-10-12T02:30:00Z')), 8);
  assert.equal(istDate(T('2026-10-12T20:00:00Z')), '2026-10-13');
});

test('nothing is ever sent unless the address is verified and emails are enabled', () => {
  assert.deepEqual(plan(snap({ prefs: { ...prefs, verified: false } })).send, []);
  assert.deepEqual(plan(snap({ prefs: { ...prefs, enabled: false } })).send, []);
});

test('brief-ready goes out once for an upcoming meeting, never twice', () => {
  assert.deepEqual(kinds(snap()), ['brief_ready']);
  assert.deepEqual(kinds(snap({ sent: new Set(['brief_ready|m1']) })), []);
  assert.deepEqual(kinds(snap({ meetings: [meeting({ starts_at: '2026-10-11T05:30:00Z' })] })), []); // meeting already past
});

test('a still-running brief is not announced', () => {
  assert.deepEqual(kinds(snap({ briefs: { b1: { id: 'b1', status: 'running', ageMinutes: 1 } } })), []);
});

test('two hours before: a fresh brief is sent as-is', () => {
  const s = snap({ now: T('2026-10-13T03:45:00Z'), sent: new Set(['brief_ready|m1', DIGEST_DONE]) }); // 1h45 before 05:30Z
  const p = plan(s);
  assert.deepEqual(p.send.map((d) => d.kind), ['pre_meeting']);
  assert.deepEqual(p.refresh, []);
});

test('a stale brief is refreshed first, and the nudge waits for the refresh', () => {
  const stale = { b1: { id: 'b1', status: 'complete' as const, ageMinutes: 600 } };
  const early = plan(snap({ now: T('2026-10-13T02:45:00Z'), briefs: stale, sent: new Set(['brief_ready|m1', DIGEST_DONE]) })); // 2h45 before: inside lead+60
  assert.deepEqual(early.refresh, ['m1']);
  assert.deepEqual(early.send, []); // not within the 2h lead yet
  const running = plan(snap({ now: T('2026-10-13T03:45:00Z'), briefs: { b2: { id: 'b2', status: 'running', ageMinutes: 1 } }, meetings: [meeting({ brief_id: 'b2' })], sent: new Set(['brief_ready|m1', 'refresh|m1', DIGEST_DONE]) }));
  assert.deepEqual(running.send, []); // refresh still running with an hour to go: wait
  const late = plan(snap({ now: T('2026-10-13T04:55:00Z'), briefs: { b2: { id: 'b2', status: 'running', ageMinutes: 1 } }, meetings: [meeting({ brief_id: 'b2' })], sent: new Set(['brief_ready|m1', 'refresh|m1', DIGEST_DONE]) }));
  assert.deepEqual(late.send.map((d) => d.kind), ['pre_meeting']); // 35 minutes out: send what exists
});

test('follow-up reminder: next morning, once, and only if no follow-up is logged', () => {
  const morning = T('2026-10-14T03:30:00Z'); // 09:00 IST the day after
  assert.ok(kinds(snap({ now: morning, sent: new Set(['brief_ready|m1', 'pre_meeting|m1']) })).includes('follow_up'));
  const note = { investor_key: 'kirsten green|forerunner ventures', investor_name: 'Kirsten Green', firm: 'Forerunner Ventures', status: 'followed_up', next_step: '', next_step_on: null };
  assert.ok(!kinds(snap({ now: morning, notes: [note] })).includes('follow_up'));
  assert.ok(!kinds(snap({ now: T('2026-10-14T13:00:00Z') })).includes('follow_up')); // evening is not the morning window
  assert.ok(!kinds(snap({ now: morning, sent: new Set(['follow_up|m1']) })).includes('follow_up'));
});

test('overdue digest: one a day, morning only, ignores passed investors', () => {
  const late = { investor_key: 'a|b', investor_name: 'A', firm: 'B', status: 'met', next_step: 'Send data', next_step_on: '2026-10-10' };
  const morning = T('2026-10-12T04:00:00Z');
  assert.ok(kinds(snap({ now: morning, meetings: [], notes: [late] })).includes('overdue'));
  assert.ok(!kinds(snap({ now: morning, meetings: [], notes: [{ ...late, status: 'passed' }] })).includes('overdue'));
  assert.ok(!kinds(snap({ now: morning, meetings: [], notes: [late], sent: new Set(['overdue|2026-10-12']) })).includes('overdue'));
  assert.ok(!kinds(snap({ now: morning, meetings: [], notes: [{ ...late, next_step_on: '2026-10-12' }] })).includes('overdue')); // due today is not overdue
});

test("today's digest lists upcoming investor meetings in the early morning only", () => {
  const early = T('2026-10-13T02:00:00Z'); // 07:30 IST, meeting at 11:00 IST
  assert.ok(kinds(snap({ now: early, sent: new Set(['brief_ready|m1']) })).includes('digest'));
  assert.ok(!kinds(snap({ now: T('2026-10-13T08:00:00Z'), sent: new Set(['brief_ready|m1']) })).includes('digest'));
});

test('each preference switches its own nudge off', () => {
  assert.deepEqual(kinds(snap({ prefs: { ...prefs, brief_ready: false } })), []);
});

test('inside the lead window with a stale brief: start the refresh and do NOT send the stale brief', () => {
  const stale = { b1: { id: 'b1', status: 'complete' as const, ageMinutes: 600 } };
  const p = plan(snap({ now: T('2026-10-13T03:45:00Z'), briefs: stale, sent: new Set(['brief_ready|m1', DIGEST_DONE]) })); // 105 min before, refresh not started
  assert.deepEqual(p.refresh, ['m1']);
  assert.deepEqual(p.send, []);
  const close = plan(snap({ now: T('2026-10-13T04:55:00Z'), briefs: stale, sent: new Set(['brief_ready|m1', DIGEST_DONE]) })); // 35 min before, too late to refresh
  assert.deepEqual(close.refresh, []);
  assert.deepEqual(close.send.map((d) => d.kind), ['pre_meeting']);
});

test('a bump is offered a week after a follow-up with no movement: one a day, one per follow-up, never while a next step is scheduled', () => {
  const note = (o: Record<string, unknown> = {}) => ({ investor_key: 'a|b', investor_name: 'A', firm: 'B', status: 'followed_up', next_step: '', next_step_on: null, updated_at: '2026-10-03T10:00:00Z', ...o });
  const morning = T('2026-10-12T04:00:00Z'); // Monday 09:30 IST, follow-up was 9 days ago
  const bump = (s: Snapshot) => plan(s).send.filter((d) => d.kind === 'bump');
  assert.equal(bump(snap({ now: morning, meetings: [], notes: [note()] })).length, 1);
  assert.equal(bump(snap({ now: morning, meetings: [], notes: [note({ updated_at: '2026-10-08T10:00:00Z' })] })).length, 0); // only 4 days
  assert.equal(bump(snap({ now: morning, meetings: [], notes: [note({ updated_at: '2026-08-01T10:00:00Z' })] })).length, 0); // given up
  assert.equal(bump(snap({ now: morning, meetings: [], notes: [note({ status: 'in_talks' })] })).length, 0);
  assert.equal(bump(snap({ now: morning, meetings: [], notes: [note({ next_step_on: '2026-10-20' })] })).length, 0); // something is scheduled
  assert.equal(bump(snap({ now: morning, meetings: [], notes: [note()], prefs: { ...prefs, bump: false } })).length, 0);
  assert.equal(bump(snap({ now: T('2026-10-12T12:00:00Z'), meetings: [], notes: [note()] })).length, 0); // afternoon
  const first = bump(snap({ now: morning, meetings: [], notes: [note()] }))[0];
  const ledger = new Set([`bump|${first.ref}`]);
  assert.equal(bump(snap({ now: morning, meetings: [], notes: [note()], sent: ledger })).length, 0); // already bumped this state
  assert.equal(bump(snap({ now: T('2026-10-13T04:00:00Z'), meetings: [], notes: [note()], sent: ledger })).length, 0); // ... even a day later
  const two = [note(), note({ investor_key: 'c|d', investor_name: 'C', firm: 'D', updated_at: '2026-10-01T10:00:00Z' })];
  assert.equal(bump(snap({ now: morning, meetings: [], notes: two }))[0].investorKey, 'c|d'); // oldest first
  assert.equal(bump(snap({ now: morning, meetings: [], notes: two, sent: ledger })).length, 0); // one a day
  assert.equal(bump(snap({ now: T('2026-10-13T04:00:00Z'), meetings: [], notes: two, sent: new Set([`bump|2026-10-12|c|d|2026-10-01`]) })).length, 1); // next day: the other one
  assert.equal(bump(snap({ now: T('2026-10-14T04:00:00Z'), meetings: [], notes: [note({ updated_at: '2026-10-05T10:00:00Z' })], sent: ledger })).length, 1); // note edited since and quiet again: re-armed
});

test('the Monday summary goes out once, on Monday mornings, only when there is something to say', () => {
  const weekly = (s: Snapshot) => plan(s).send.filter((d) => d.kind === 'weekly');
  const mon = T('2026-10-12T04:00:00Z'); // Monday 09:30 IST
  const n = { investor_key: 'a|b', investor_name: 'A', firm: 'B', status: 'met', next_step: '', next_step_on: null };
  assert.equal(weekly(snap({ now: mon, meetings: [], notes: [n] })).length, 1);
  assert.equal(weekly(snap({ now: T('2026-10-13T04:00:00Z'), meetings: [], notes: [n] })).length, 0); // Tuesday
  assert.equal(weekly(snap({ now: mon, meetings: [], notes: [n], sent: new Set(['weekly|2026-10-12']) })).length, 0);
  assert.equal(weekly(snap({ now: mon, meetings: [], notes: [] })).length, 0); // nothing to report
  assert.equal(weekly(snap({ now: mon, meetings: [], notes: [], hasRaise: true })).length, 1); // a round counts
  assert.equal(weekly(snap({ now: mon, meetings: [], notes: [n], prefs: { ...prefs, weekly: false } })).length, 0);
});
