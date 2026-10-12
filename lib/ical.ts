// Minimal iCalendar (RFC 5545) reader for single events. Pure functions, unit-tested.
// Not supported on purpose: recurrence expansion (RRULE). Investor meetings are almost always one-off events.

export interface CalEvent {
  uid: string;
  title: string;
  startsAt: string; // ISO UTC
  attendees: { name: string | null; email: string }[];
  organizer: { name: string | null; email: string } | null;
  recurring: boolean;
}

function unfold(txt: string): string[] {
  return txt.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\');
}

function parseParams(left: string): { name: string; params: Record<string, string> } {
  const [name, ...rest] = left.split(';');
  const params: Record<string, string> = {};
  for (const p of rest) {
    const i = p.indexOf('=');
    if (i > 0) params[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params };
}

/** Converts DTSTART to UTC ISO. Handles Z times, floating/TZID times (treated with a fixed offset map or UTC) and all-day dates. */
export function parseDtStart(value: string, params: Record<string, string>): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
  const base = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (Number.isNaN(base)) return null;
  if (z || !params.TZID) return new Date(base).toISOString();
  // TZID: use Intl to find the zone's offset at that wall-clock time.
  try {
    const guess = new Date(base);
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: params.TZID, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
    const asZone = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return new Date(base - (asZone - base)).toISOString();
  } catch {
    return new Date(base).toISOString();
  }
}

export function parseIcs(txt: string): CalEvent[] {
  const events: CalEvent[] = [];
  let cur: Partial<CalEvent> & { attendees: CalEvent['attendees'] } | null = null;
  for (const line of unfold(txt)) {
    if (line === 'BEGIN:VEVENT') { cur = { attendees: [], recurring: false }; continue; }
    if (line === 'END:VEVENT') {
      if (cur?.uid && cur.startsAt) events.push({ uid: cur.uid, title: cur.title ?? '(no title)', startsAt: cur.startsAt, attendees: cur.attendees, organizer: cur.organizer ?? null, recurring: !!cur.recurring });
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const { name, params } = parseParams(line.slice(0, i));
    const value = line.slice(i + 1);
    if (name === 'UID') cur.uid = value.trim();
    else if (name === 'SUMMARY') cur.title = unescapeText(value).slice(0, 200);
    else if (name === 'DTSTART') cur.startsAt = parseDtStart(value.trim(), params) ?? undefined;
    else if (name === 'RRULE') cur.recurring = true;
    else if (name === 'ATTENDEE' || name === 'ORGANIZER') {
      const email = value.replace(/^mailto:/i, '').trim().toLowerCase();
      if (!email.includes('@')) continue;
      const who = { name: params.CN ? unescapeText(params.CN) : null, email };
      if (name === 'ATTENDEE') cur.attendees.push(who); else cur.organizer = who;
    }
  }
  return events;
}

const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com', 'live.com', 'me.com']);

/** Attendees outside the owner's own domain. Calendar owners are identified by the most common attendee domain, or an explicit hint. */
export function externalAttendees(ev: CalEvent, ownDomains: Set<string>): CalEvent['attendees'] {
  const all = [...ev.attendees, ...(ev.organizer ? [ev.organizer] : [])];
  const seen = new Set<string>();
  return all.filter((a) => {
    const d = a.email.split('@')[1];
    if (!d || ownDomains.has(d) || seen.has(a.email)) return false;
    seen.add(a.email);
    return true;
  });
}

export function ownDomainsFrom(events: CalEvent[], hint?: string[]): Set<string> {
  const count = new Map<string, number>();
  for (const e of events) for (const a of e.attendees) { const d = a.email.split('@')[1]; if (d && !FREE_MAIL.has(d)) count.set(d, (count.get(d) ?? 0) + 1); }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return new Set([...(hint ?? []), ...(top ? [top] : [])]);
}

export function isIcsUrl(u: string): boolean {
  try {
    const x = new URL(u.replace(/^webcal:/i, 'https:'));
    return x.protocol === 'https:' && (/\.ics($|\?)/i.test(x.pathname + x.search) || /calendar|ical/i.test(x.href));
  } catch { return false; }
}
