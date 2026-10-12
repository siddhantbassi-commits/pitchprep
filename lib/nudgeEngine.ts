// Decides which nudges are due. Pure: it reads a snapshot and returns what to send, so every rule is unit-tested.
// Rules: brief ready (once per meeting), refreshed brief shortly before a meeting (once), a follow-up reminder the morning
// after (once), an overdue next-steps digest (once a day) and a morning digest of today's meetings (once a day).

export interface Prefs {
  enabled: boolean; verified: boolean;
  brief_ready: boolean; pre_meeting: boolean; follow_up: boolean; overdue: boolean; daily_digest: boolean;
  lead_minutes: number;
}

export interface MeetingLite {
  id: string; starts_at: string; title: string | null; status: 'detected' | 'prepared' | 'skipped'; is_investor: boolean;
  investor_name: string | null; firm: string | null; brief_id: string | null;
}

export interface BriefLite { id: string; status: 'running' | 'complete' | 'partial' | 'unverified' | 'failed'; ageMinutes: number }

export interface NoteLite { investor_key: string; investor_name: string; firm: string; status: string; next_step: string; next_step_on: string | null }

export type Kind = 'brief_ready' | 'pre_meeting' | 'follow_up' | 'overdue' | 'digest';
export interface Due { kind: Kind; ref: string; meetingId?: string; investorKey?: string }

export interface Snapshot {
  now: Date; prefs: Prefs; meetings: MeetingLite[]; notes: NoteLite[]; briefs: Record<string, BriefLite>;
  sent: Set<string>; // "kind|ref"
}

export const STALE_AFTER_MIN = 180;      // a brief older than this is refreshed before the meeting
export const SEND_ANYWAY_WITHIN_MIN = 40; // ... but if the refresh is not done this close to the meeting, send what we have
export const MORNING_FROM_IST = 8;
export const MORNING_TO_IST = 12;

export const investorKey = (name: string, firm: string) => `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${firm.trim().toLowerCase().replace(/\s+/g, ' ')}`;
const ist = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000);
export const istHour = (d: Date) => ist(d).getUTCHours();
export const istDate = (d: Date) => ist(d).toISOString().slice(0, 10);
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
  return out;
}
