// Side-effecting half of the nudge system: build each email from real data, send it, and record that it was sent.
// The decision of WHAT is due lives in lib/nudgeEngine.ts (pure, tested). Nothing is sent to an unconfirmed address.

import { createHash } from 'node:crypto';
import { db, logEvent } from './db';
import { computeDelta } from './delta';
import { renderEmail, type EmailData, type NudgeKind } from './emailTemplates';
import { mailerConfigured, sendMail, EMAIL_RE } from './mailer';
import { draftBump } from './assist';
import { Meter } from './gemini';
import { getPlan, listCommitments } from './raiseStore';
import { fmtMoney, summarize } from './raise';
import { istTime } from './emailTemplates';
import { STATUS_LABEL, STATUSES, type Status } from './tracker';
import { investorKey, plan, type BriefLite, type MeetingLite, type NoteLite, type Prefs } from './nudgeEngine';
import { allow, createBrief, getProfile, latestPrevious } from './store';
import { signToken } from './tokens';
import { needsDoubleCheck } from './verify';
import { runBriefJob } from './job';
import type { BriefResult } from './types';

export const appUrl = (base?: string) => base || process.env.APP_URL || 'https://pitchprep-three.vercel.app';
export const openUrl = (ws: string, next: string, base?: string) => `${appUrl(base)}/a/${signToken('open', { ws, next }, 7 * 86400)}`;
export const unsubUrl = (ws: string, base?: string) => `${appUrl(base)}/unsubscribe?t=${signToken('unsub', { ws }, 365 * 86400)}`;
const hash = (s: string) => createHash('sha256').update(s.toLowerCase()).digest('hex').slice(0, 20);

export interface PrefsRow {
  workspace_id: string; email: string; verified_at: string | null; verify_sent_at: string | null; enabled: boolean;
  brief_ready: boolean; pre_meeting: boolean; follow_up: boolean; overdue: boolean; daily_digest: boolean; bump: boolean; weekly: boolean; lead_minutes: number;
}

export async function getPrefs(ws: string): Promise<PrefsRow | null> {
  return ((await db().from('nudge_prefs').select('*').eq('workspace_id', ws).maybeSingle()).data as PrefsRow | null) ?? null;
}

const toPrefs = (r: PrefsRow): Prefs => ({ enabled: r.enabled, verified: !!r.verified_at, brief_ready: r.brief_ready, pre_meeting: r.pre_meeting, follow_up: r.follow_up, overdue: r.overdue, daily_digest: r.daily_digest, bump: r.bump, weekly: r.weekly, lead_minutes: r.lead_minutes });

/** Daily caps protect the sending account and the recipient: per workspace and across the site. */
async function underCaps(ws: string): Promise<boolean> {
  return (await allow(`nudge:${ws}`, 14, 86_400_000)) && (await allow('nudge-global', 300, 86_400_000));
}

async function founderName(ws: string): Promise<string> { return (await getProfile(ws)).founderName; }

export interface MailOutcome { ok: boolean; dryRun?: boolean; error?: string; limited?: boolean }

async function deliver(ws: string, to: string, data: Omit<EmailData, 'openUrl' | 'unsubscribeUrl' | 'founderName'> & { next: string }, base?: string): Promise<MailOutcome> {
  const { next, ...rest } = data;
  const email = renderEmail({ ...rest, founderName: await founderName(ws), openUrl: openUrl(ws, next, base), unsubscribeUrl: unsubUrl(ws, base) });
  const r = await sendMail({ to, subject: email.subject, text: email.text, html: email.html, unsubscribeUrl: unsubUrl(ws, base) });
  await logEvent('mail', r.ok ? 'sent' : r.dryRun ? 'dry_run' : 'failed', null, { kind: rest.kind, error: r.error });
  return r;
}

/** Step 1 of a new address: a confirmation email. Nothing else is ever sent until the link in it is clicked. */
export async function sendConfirmation(ws: string, email: string, base?: string): Promise<MailOutcome> {
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'That does not look like an email address.' };
  if (!(await allow(`mailto:${hash(email)}`, 1, 3_600_000))) return { ok: false, limited: true, error: 'A confirmation email was just sent to that address. Check your inbox (and spam), or try again in an hour.' };
  if (!(await allow(`mailws:${ws}`, 5, 86_400_000)) || !(await allow('mail-confirm-global', 200, 86_400_000))) return { ok: false, limited: true, error: 'Too many confirmation emails for now. Please try again later.' };
  const token = signToken('confirm', { ws, email }, 7 * 86400);
  return deliver(ws, email, { kind: 'confirm', confirmUrl: `${appUrl(base)}/api/nudges/confirm?t=${token}`, next: '/meetings' }, base);
}

export async function sendSimple(ws: string, kind: 'test' | 'signin', base?: string): Promise<MailOutcome> {
  const p = await getPrefs(ws);
  if (!p?.verified_at) return { ok: false, error: 'Confirm your email address first.' };
  if (!(await allow(`mailsimple:${ws}`, 4, 3_600_000))) return { ok: false, limited: true, error: 'Too many emails requested. Try again in a while.' };
  return deliver(ws, p.email, { kind, next: '/meetings' }, base);
}

// ----------------------------------------------------------------------------------------------- building email content

function ageNote(createdAt: string, now = new Date()): string {
  const h = Math.max(0, Math.round((now.getTime() - Date.parse(createdAt)) / 3_600_000));
  return h < 1 ? 'This brief was refreshed within the last hour.' : h < 48 ? `This brief was refreshed ${h} hour${h > 1 ? 's' : ''} ago.` : `This brief is ${Math.round(h / 24)} days old.`;
}

export function contentFromBrief(r: BriefResult, createdAt: string): Pick<EmailData, 'investor' | 'skim' | 'openers' | 'watchOuts' | 'askThem' | 'verifyFirst' | 'dataAgeNote'> {
  const watch = r.claims.filter((c) => c.verified && c.section === 'context' && (c.severity === 'high' || c.severity === 'watch')).slice(0, 2).map((c) => c.text);
  return {
    investor: { name: r.investor.name, firm: r.investor.firm, role: r.investor.role },
    skim: r.synthesis?.skim ?? [],
    openers: (r.synthesis?.talkingPoints ?? []).map((t) => ({ title: t.title, opener: t.opener })),
    watchOuts: watch,
    askThem: (r.synthesis?.questionsToAsk ?? []).slice(0, 3).map((q) => q.question),
    verifyFirst: needsDoubleCheck(r.claims, r.evidence, 3).map((d) => d.claim.text),
    dataAgeNote: ageNote(createdAt),
  };
}

// ----------------------------------------------------------------------------------------------- the runner

export interface RunSummary { configured: boolean; workspaces: number; sent: number; refreshed: number; failed: number; jobs: (() => Promise<void>)[] }

export async function runNudges(now = new Date(), base?: string): Promise<RunSummary> {
  const out: RunSummary = { configured: mailerConfigured(), workspaces: 0, sent: 0, refreshed: 0, failed: 0, jobs: [] };
  if (!out.configured) return out; // dry-run: no credentials yet, nothing to do
  const rows = ((await db().from('nudge_prefs').select('*').eq('enabled', true).not('verified_at', 'is', null).limit(300)).data ?? []) as PrefsRow[];
  for (const pr of rows) {
    out.workspaces++;
    const ws = pr.workspace_id;
    try {
      const from = new Date(now.getTime() - 8 * 86_400_000).toISOString();
      const to = new Date(now.getTime() + 8 * 86_400_000).toISOString();
      const meetings = ((await db().from('meetings').select('id,starts_at,title,status,is_investor,investor_name,firm,brief_id').eq('workspace_id', ws).gte('starts_at', from).lte('starts_at', to)).data ?? []) as MeetingLite[];
      const notes = ((await db().from('investor_notes').select('investor_key,investor_name,firm,status,notes,next_step,next_step_on,updated_at').eq('workspace_id', ws)).data ?? []) as (NoteLite & { notes: string })[];
      const briefIds = meetings.map((m) => m.brief_id).filter((x): x is string => !!x);
      const briefRows = briefIds.length ? (((await db().from('briefs').select('id,status,created_at,completed_at').in('id', briefIds)).data ?? []) as { id: string; status: BriefLite['status']; created_at: string; completed_at: string | null }[]) : [];
      const briefs: Record<string, BriefLite> = Object.fromEntries(briefRows.map((b) => [b.id, { id: b.id, status: b.status, ageMinutes: (now.getTime() - Date.parse(b.completed_at ?? b.created_at)) / 60_000 }]));
      const since = new Date(now.getTime() - 50 * 86_400_000).toISOString(); // long enough to remember a bump for as long as bumps can happen
      const ledger = ((await db().from('nudges_sent').select('kind,ref').eq('workspace_id', ws).gte('sent_at', since)).data ?? []) as { kind: string; ref: string }[];
      const sent = new Set(ledger.map((l) => `${l.kind}|${l.ref}`));

      const raisePlan = pr.weekly ? await getPlan(ws) : null;
      const p = plan({ now, prefs: toPrefs(pr), meetings, notes, briefs, sent, hasRaise: !!raisePlan && raisePlan.target > 0 });
      const record = async (kind: string, ref: string, ok = true, error?: string) => { await db().from('nudges_sent').upsert({ workspace_id: ws, kind, ref, ok, error: error ?? null }, { onConflict: 'workspace_id,kind,ref', ignoreDuplicates: true }); };

      // Refresh stale briefs shortly before a meeting; the nudge follows once the refresh has finished.
      for (const mid of p.refresh) {
        const m = meetings.find((x) => x.id === mid);
        if (!m?.investor_name || !m.firm) continue;
        const profile = await getProfile(ws);
        const id = await createBrief({ ws, name: m.investor_name, firm: m.firm, meetingAt: m.starts_at, profile });
        await db().from('meetings').update({ brief_id: id }).eq('id', mid);
        out.jobs.push(() => runBriefJob(id, { name: m.investor_name!, firm: m.firm!, profile }));
        await record('refresh', mid);
        out.refreshed++;
      }

      for (const d of p.send) {
        if (!(await underCaps(ws))) break;
        let outcome: MailOutcome;
        if (d.kind === 'overdue') {
          const today = new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
          const late = notes.filter((n) => n.next_step.trim() && n.next_step_on && n.next_step_on < today && n.status !== 'passed');
          outcome = await deliver(ws, pr.email, { kind: 'overdue', overdue: late.map((n) => ({ investor: n.investor_name, nextStep: n.next_step, due: n.next_step_on! })), next: '/pipeline' }, base);
        } else if (d.kind === 'bump') {
          const n = notes.find((x) => x.investor_key === d.investorKey);
          if (!n) continue;
          const days = Math.floor((now.getTime() - Date.parse(n.updated_at!)) / 86_400_000);
          const latest = (await db().from('briefs').select('result').eq('workspace_id', ws).eq('investor_key', n.investor_key).in('status', ['complete', 'partial']).order('created_at', { ascending: false }).limit(1)).data?.[0];
          let draft: { subject: string; body: string } | null = null;
          try { draft = await draftBump({ investor: n.investor_name, firm: n.firm, days, notes: n.notes, nextStep: n.next_step, result: (latest?.result as BriefResult | undefined) ?? null, profile: await getProfile(ws), meter: new Meter() }); } catch { draft = null; }
          outcome = await deliver(ws, pr.email, { kind: 'bump', bump: { investor: n.investor_name, firm: n.firm, days, draft }, next: '/pipeline' }, base);
        } else if (d.kind === 'weekly') {
          const today = new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
          const t = now.getTime();
          const who = (m: MeetingLite) => `${m.investor_name ?? m.title ?? 'Meeting'}${m.firm ? ` (${m.firm})` : ''}`;
          const inv = meetings.filter((m) => m.is_investor || m.status === 'prepared');
          const counts = STATUSES.map((st) => ({ st, n: notes.filter((x) => x.status === st).length })).filter((x) => x.n);
          let raise: string | null = null;
          if (raisePlan && raisePlan.target > 0) {
            const s = summarize(raisePlan, await listCommitments(ws), now);
            raise = `${fmtMoney(raisePlan.currency, s.committed)} committed of ${fmtMoney(raisePlan.currency, raisePlan.target)} (${s.pctCommitted}%), ${s.investorsActive} investor${s.investorsActive === 1 ? '' : 's'} active${s.daysLeft != null && s.daysLeft >= 0 ? `, ${s.daysLeft} days to your close-by date` : ''}`;
          }
          outcome = await deliver(ws, pr.email, {
            kind: 'weekly',
            weekly: {
              held: inv.filter((m) => Date.parse(m.starts_at) <= t && Date.parse(m.starts_at) > t - 7 * 86_400_000).map(who),
              upcoming: inv.filter((m) => Date.parse(m.starts_at) > t && Date.parse(m.starts_at) <= t + 7 * 86_400_000).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((m) => `${who(m)}, ${istTime(m.starts_at)}`),
              pendingFollowUps: notes.filter((x) => x.status === 'met').map((x) => `${x.investor_name} (${x.firm})`),
              overdue: notes.filter((x) => x.next_step.trim() && x.next_step_on && x.next_step_on < today && x.status !== 'passed').map((x) => `${x.investor_name}: ${x.next_step} (was due ${x.next_step_on})`),
              pipeline: counts.map((x) => `${x.n} ${STATUS_LABEL[x.st as Status].toLowerCase()}`).join(', '),
              raise,
            },
            next: raise ? '/raise' : '/pipeline',
          }, base);
        } else if (d.kind === 'digest') {
          const today = new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
          const todays = meetings.filter((m) => (m.is_investor || m.status === 'prepared') && new Date(Date.parse(m.starts_at) + 5.5 * 3_600_000).toISOString().slice(0, 10) === today && Date.parse(m.starts_at) > now.getTime());
          const hm = (iso: string) => { const x = new Date(Date.parse(iso) + 5.5 * 3_600_000); return `${String(x.getUTCHours()).padStart(2, '0')}:${String(x.getUTCMinutes()).padStart(2, '0')} IST`; };
          outcome = await deliver(ws, pr.email, { kind: 'digest', today: todays.map((m) => ({ investor: m.investor_name ?? m.title ?? 'Meeting', firm: m.firm ?? '', time: hm(m.starts_at), briefReady: !!m.brief_id })), next: '/meetings' }, base);
        } else {
          const m = meetings.find((x) => x.id === d.meetingId);
          if (!m?.brief_id) continue;
          const b = (await db().from('briefs').select('id,result,created_at,investor_name,firm').eq('id', m.brief_id).maybeSingle()).data as { id: string; result: BriefResult | null; created_at: string; investor_name: string; firm: string } | null;
          if (!b?.result) continue;
          let newSince: string[] | undefined;
          if (d.kind === 'pre_meeting') {
            const prev = await latestPrevious(ws, investorKey(b.investor_name, b.firm), b.id).catch(() => null);
            if (prev?.result) newSince = computeDelta(b.result, prev).newSince.map((c) => c.text).slice(0, 4);
          }
          outcome = await deliver(ws, pr.email, { kind: d.kind as NudgeKind, ...contentFromBrief(b.result, b.created_at), meetingAt: m.starts_at, newSince, followUpFor: b.investor_name, next: d.kind === 'follow_up' ? `/brief/${b.id}#after` : `/brief/${b.id}` }, base);
        }
        if (outcome.ok) { await record(d.kind, d.ref); out.sent++; } else { out.failed++; }
      }
    } catch (e) {
      out.failed++;
      await logEvent('mail', 'workspace_failed', null, { ws, error: String((e as Error).message).slice(0, 200) });
    }
  }
  return out;
}
