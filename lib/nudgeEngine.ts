// Decides which nudges are due. Pure: it reads a snapshot and returns what to send, so every rule is unit-tested.
// Rules: brief ready (once per meeting), refreshed brief shortly before a meeting (once), a follow-up reminder the morning
// after (once), an overdue next-steps digest (once a day), a morning digest of today's meetings (once a day), a gentle bump a week
// after a follow-up that got no reply (one a day at most), and a Monday summary of the week.

export interface Prefs {
  enabled: boolean; verified: boolean;
  brief_ready: boolean; pre_meeting: boolean; follow_up: boolean; overdue: boolean; daily_digest: boolean; bump: boolean; weekly: boolean;
  lead_minutes: number;
}

export interface MeetingLite {
  id: string; starts_at: string; title: string | null; status: 'detected' | 'prepared' | 'skipped'; is_investor: boolean;
  investor_name: string | null; firm: string | null; brief_id: string | null;
}

export interface BriefLite { id: string; status: 'running' | 'complete' | 'partial' | 'unverified' | 'failed'; ageMinutes: number }

export interface NoteLite { investor_key: string; investor_name: string; firm: string; status: string; next_step: string; next_step_on: string | null; updated_at?: string | null }

export type Kind = 'brief_ready' | 'pre_meeting' | 'follow_up' | 'overdue' | 'digest' | 'bump' | 'weekly';
export interface Due { kind: Kind; ref: string; meetingId?: string; investorKey?: string }

export interface Snapshot {
  now: Date; prefs: Prefs; meetings: MeetingLite[]; notes: NoteLite[]; briefs: Record<string, BriefLite>;
  sent: Set<string>; // "kind|ref"
  hasRaise?: boolean; // the founder has set up a round, so the weekly summary has something to say about it
}

export const STALE_AFTER_MIN = 180;      // a brief older than this is refreshed before the meeting
export const SEND_ANYWAY_WITHIN_MIN = 40; // ... but if the refresh is not done this close to the meeting, send what we have
export const MORNING_FROM_IST = 8;
export const MORNING_TO_IST = 12;
export const BUMP_AFTER_DAYS = 7;   // a follow-up with no movement for this long earns a gentle bump
export const BUMP_GIVE_UP_DAYS = 45; // ... but not forever

export const investorKey = (name: string, firm: string) => `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${firm.trim().toLowerCase().replace(/\s+/g, ' ')}`;
const ist = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000);
export const istHour = (d: Date) => ist(d).getUTCHours();
export const istDate = (d: Date) => ist(d).toISOString().slice(0, 10);
export const istWeekday = (d: Date) => ist(d).getUTCDay(); // 0 = Sunday, 1 = Monday
const minutesUntil = (iso: string, now: Date) => (Date.parse(iso) - now.getTime()) / 60_000;
const key = (k: string, r: string) => `${k}|${r}`;

export interface Plan { send: Due[]; refresh: string[] }

export function plan(s: Snapshot): Plan {
  const out: Plan = { send: [], refresh: [] };
  const p = s.prefs;
  if (!p.enabled || !p.verified) return out;
  const hour = istHour(s.now);
  const morning = hour >= MORNING_FROM_IST && hour < MORNING_TO_IST;
  const today = istDate(s.now);
  const investors = s.meetings.filter((m) => m.is_investor || m.status === 'prepared');

  for (const m of investors) {
    const mins = minutesUntil(m.starts_at, s.now);
    const brief = m.brief_id ? s.briefs[m.brief_id] : undefined;

    // 1. A brief was prepared for an upcoming meeting.
    if (p.brief_ready && m.status === 'prepared' && brief && brief.status !== 'running' && brief.status !== 'failed' && mins > 0 && !s.sent.has(key('brief_ready', m.id)))
      out.send.push({ kind: 'brief_ready', ref: m.id, meetingId: m.id });

    // 2. Shortly before the meeting: refresh a stale brief, then send the refreshed one with what is new.
    //    The nudge never goes out with a stale brief while a refresh is still to be started or is still running,
    //    unless the meeting is so close that sending what exists is better than sending nothing.
    if (p.pre_meeting && m.status === 'prepared' && m.brief_id && mins > 0 && mins <= p.lead_minutes + 60) {
      const stale = !brief || brief.ageMinutes > STALE_AFTER_MIN;
      const closeToStart = mins <= SEND_ANYWAY_WITHIN_MIN;
      const needsRefresh = stale && !s.sent.has(key('refresh', m.id)) && !closeToStart;
      if (needsRefresh) out.refresh.push(m.id);
      const refreshing = brief?.status === 'running';
      if (mins <= p.lead_minutes && !s.sent.has(key('pre_meeting', m.id)) && !needsRefresh && (!refreshing || closeToStart)) out.send.push({ kind: 'pre_meeting', ref: m.id, meetingId: m.id });
    }

    // 3. The morning after: no follow-up logged yet.
    if (p.follow_up && morning && m.investor_name && m.firm) {
      const sinceMin = -mins;
      const note = s.notes.find((n) => n.investor_key === investorKey(m.investor_name!, m.firm!));
      const done = note && ['followed_up', 'in_talks', 'passed'].includes(note.status);
      if (sinceMin >= 90 && sinceMin <= 72 * 60 && !done && !s.sent.has(key('follow_up', m.id)))
        out.send.push({ kind: 'follow_up', ref: m.id, meetingId: m.id });
    }
  }

  // 4. Overdue next steps: one email a day, in the morning.
  if (p.overdue && morning && !s.sent.has(key('overdue', today))) {
    const late = s.notes.filter((n) => n.next_step.trim() && n.next_step_on && n.next_step_on < today && n.status !== 'passed');
    if (late.length) out.send.push({ kind: 'overdue', ref: today });
  }

  // 5. Today's meetings: one email in the early morning.
  if (p.daily_digest && hour >= 7 && hour < MORNING_TO_IST && !s.sent.has(key('digest', today))) {
    const todays = investors.filter((m) => istDate(new Date(m.starts_at)) === today && minutesUntil(m.starts_at, s.now) > 0);
    if (todays.length) out.send.push({ kind: 'digest', ref: today });
  }

  // 6. A bump: a follow-up was sent a week or more ago and nothing has moved since. One bump a day, one per follow-up state.
  if (p.bump && morning && ![...s.sent].some((k) => k.startsWith(`bump|${today}|`))) {
    const due = s.notes
      .filter((n) => n.status === 'followed_up' && n.updated_at)
      .map((n) => ({ n, days: (s.now.getTime() - Date.parse(n.updated_at!)) / 86_400_000 }))
      .filter((x) => x.days >= BUMP_AFTER_DAYS && x.days <= BUMP_GIVE_UP_DAYS && !(x.n.next_step_on && x.n.next_step_on >= today))
      .filter((x) => !bumpSent(s.sent, x.n))
      .sort((a, b) => b.days - a.days);
    if (due.length) out.send.push({ kind: 'bump', ref: bumpRef(today, due[0].n), investorKey: due[0].n.investor_key });
  }

  // 7. The Monday summary: last week, this week, and the round.
  if (p.weekly && morning && istWeekday(s.now) === 1 && !s.sent.has(key('weekly', today)) && (s.notes.length > 0 || investors.length > 0 || s.hasRaise)) out.send.push({ kind: 'weekly', ref: today });
  return out;
}

const stateDay = (n: NoteLite) => (n.updated_at ?? '').slice(0, 10);
/** One bump per follow-up state: the ref carries the day the note last changed, so editing the note re-arms it. */
export const bumpRef = (today: string, n: NoteLite) => `${today}|${n.investor_key}|${stateDay(n)}`;
const bumpSent = (sent: Set<string>, n: NoteLite) => [...sent].some((k) => k.startsWith('bump|') && k.endsWith(`|${n.investor_key}|${stateDay(n)}`));
