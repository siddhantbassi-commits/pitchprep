import { test } from 'node:test';
import assert from 'node:assert/strict';
import { externalAttendees, isIcsUrl, ownDomainsFrom, parseDtStart, parseIcs } from '../lib/ical';

const ICS = [
  'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:abc-1', 'DTSTART:20261014T093000Z', 'SUMMARY:Intro call: Priya <> Kirsten (Forerunner)',
  'ORGANIZER;CN=Priya Raghunathan:mailto:priya@sattvakitchen.in',
  'ATTENDEE;CN="Kirsten Green";ROLE=REQ-PARTICIPANT:mailto:Kirsten@forerunnerventures.com',
  'ATTENDEE;CN=Priya Raghunathan:mailto:priya@sattvakitchen.in', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:abc-2', 'DTSTART;TZID=Asia/Kolkata:20261015T110000', 'SUMMARY:Team standup\\, weekly', 'RRULE:FREQ=WEEKLY',
  'ATTENDEE:mailto:ops@sattvakitchen.in', 'ATTENDEE:mailto:priya@sattvakitchen.in', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:abc-3', 'DTSTART;VALUE=DATE:20261020', 'SUMMARY:Folded', ' title continues', 'END:VEVENT', 'END:VCALENDAR',
].join('\r\n');

test('parses events, attendees, folding and recurrence flags', () => {
  const ev = parseIcs(ICS);
  assert.equal(ev.length, 3);
  assert.equal(ev[0].startsAt, '2026-10-14T09:30:00.000Z');
  assert.equal(ev[0].attendees[0].email, 'kirsten@forerunnerventures.com');
  assert.equal(ev[0].attendees[0].name, 'Kirsten Green');
  assert.equal(ev[1].recurring, true);
  assert.equal(ev[1].title, 'Team standup, weekly');
  assert.equal(ev[2].title, 'Foldedtitle continues');
});

test('TZID times convert to UTC (Asia/Kolkata is +05:30)', () => {
  assert.equal(parseDtStart('20261015T110000', { TZID: 'Asia/Kolkata' }), '2026-10-15T05:30:00.000Z');
  assert.equal(parseDtStart('garbage', {}), null);
});

test('external attendees exclude the owner domain', () => {
  const ev = parseIcs(ICS);
  const own = ownDomainsFrom(ev);
  assert.ok(own.has('sattvakitchen.in'));
  assert.deepEqual(externalAttendees(ev[0], own).map((a) => a.email), ['kirsten@forerunnerventures.com']);
  assert.equal(externalAttendees(ev[1], own).length, 0);
});

test('only https calendar links are accepted', () => {
  assert.equal(isIcsUrl('https://calendar.google.com/calendar/ical/x%40y.com/private-abc/basic.ics'), true);
  assert.equal(isIcsUrl('webcal://calendar.google.com/calendar/ical/x/basic.ics'), true);
  assert.equal(isIcsUrl('http://example.com/cal.ics'), false);
  assert.equal(isIcsUrl('file:///etc/passwd'), false);
});

import { demoIcs } from '../lib/demoCalendar';

test('sample calendar: events are in the future and 11:00 IST really is 05:30 UTC', () => {
  const now = new Date('2026-10-12T08:00:00Z');
  const ev = parseIcs(demoIcs(now));
  assert.equal(ev.length, 5);
  assert.ok(ev.every((e) => Date.parse(e.startsAt) > now.getTime()));
  assert.equal(ev[0].startsAt, '2026-10-13T05:30:00.000Z'); // Forerunner call, tomorrow 11:00 IST
  const own = ownDomainsFrom(ev);
  assert.equal(externalAttendees(ev[0], own)[0].email, 'kirsten@forerunnerventures.com');
});
