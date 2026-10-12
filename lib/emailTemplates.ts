// Email content. Pure functions: data in, subject + text + HTML out. Fully testable and previewable without sending anything.
// Every email says why it was sent, links to the right brief with a one-tap sign-in, and has an unsubscribe link.

export type NudgeKind = 'confirm' | 'signin' | 'test' | 'brief_ready' | 'pre_meeting' | 'follow_up' | 'overdue' | 'digest';

export interface EmailData {
  kind: NudgeKind;
  founderName?: string;
  investor?: { name: string; firm: string; role?: string | null };
  meetingAt?: string; // ISO
  openUrl: string; // magic link into the app
  unsubscribeUrl: string;
  confirmUrl?: string;
  skim?: string[];
  openers?: { title: string; opener: string }[];
  watchOuts?: string[];
  askThem?: string[];
  fit?: string;
  newSince?: string[]; // what changed since the brief the founder last saw
  dataAgeNote?: string;
  verifyFirst?: string[]; // the riskiest claims to double-check
  overdue?: { investor: string; nextStep: string; due: string }[];
  today?: { investor: string; firm: string; time: string; briefReady: boolean }[];
  followUpFor?: string;
}

export interface Rendered { subject: string; text: string; html: string; preheader: string }

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
/** India time, hand-formatted (no Intl) so the output never varies between servers. */
export function istTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 5.5 * 3600_000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST on ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const GREEN = '#1f5f4a';
const btn = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;font-size:15px">${esc(label)}</a>`;
const h = (t: string) => `<h2 style="font-family:Georgia,serif;font-size:18px;margin:22px 0 8px;color:#15181e">${esc(t)}</h2>`;
const ul = (items: string[]) => `<ul style="margin:6px 0 0;padding-left:20px;color:#15181e;font-size:15px;line-height:1.5">${items.map((i) => `<li style="margin:4px 0">${esc(i)}</li>`).join('')}</ul>`;
const tl = (title: string, items: string[]) => (items.length ? `${title.toUpperCase()}\n${items.map((i) => `- ${i}`).join('\n')}\n\n` : '');

function shell(a: { preheader: string; title: string; bodyHtml: string; ctaUrl?: string; ctaLabel?: string; unsubscribeUrl: string; why: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#faf8f3;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(a.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e6e1d6;border-radius:14px">
<tr><td style="padding:22px 24px 6px"><span style="display:inline-block;width:26px;height:26px;border-radius:7px;background:${GREEN};color:#fff;text-align:center;line-height:26px;font-weight:700;font-family:Georgia,serif">P</span> <span style="font-family:Georgia,serif;font-size:18px;font-weight:600;vertical-align:middle;color:#15181e">PitchPrep</span></td></tr>
<tr><td style="padding:6px 24px 4px"><h1 style="font-family:Georgia,serif;font-size:24px;line-height:1.25;margin:8px 0;color:#15181e">${esc(a.title)}</h1></td></tr>
<tr><td style="padding:0 24px 8px">${a.bodyHtml}</td></tr>
${a.ctaUrl ? `<tr><td style="padding:14px 24px 22px">${btn(a.ctaUrl, a.ctaLabel ?? 'Open PitchPrep')}</td></tr>` : ''}
<tr><td style="padding:14px 24px 20px;border-top:1px solid #e6e1d6;font-size:12px;line-height:1.5;color:#5d6470">${esc(a.why)} <a href="${esc(a.unsubscribeUrl)}" style="color:#5d6470">Unsubscribe</a> from all PitchPrep emails.<br>PitchPrep drafts and researches; it never contacts investors for you.</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderEmail(d: EmailData): Rendered {
  const who = d.investor ? `${d.investor.name}${d.investor.firm ? ` (${d.investor.firm})` : ''}` : '';
  const when = d.meetingAt ? istTime(d.meetingAt) : '';
  const hi = d.founderName ? `Hi ${d.founderName.split(' ')[0]},` : 'Hi,';
  const foot = (why: string) => ({ unsubscribeUrl: d.unsubscribeUrl, why });

  if (d.kind === 'confirm') {
    const preheader = 'Confirm this address to get meeting nudges.';
    return {
      subject: 'Confirm your email for PitchPrep nudges', preheader,
      text: `${hi}\n\nSomeone (hopefully you) asked PitchPrep to send meeting nudges to this address. Confirm it here:\n${d.confirmUrl}\n\nIf this was not you, ignore this email and nothing will be sent.\n\nUnsubscribe: ${d.unsubscribeUrl}`,
      html: shell({ preheader, title: 'Confirm your email', bodyHtml: `<p style="font-size:15px;line-height:1.5;color:#15181e">Someone (hopefully you) asked PitchPrep to send meeting nudges to this address: a heads-up when a brief is ready, a refreshed brief before an investor meeting, and a reminder to follow up.</p><p style="font-size:15px;line-height:1.5;color:#15181e">If this was not you, ignore this email. Nothing will be sent until you confirm.</p>`, ctaUrl: d.confirmUrl, ctaLabel: 'Confirm my email', ...foot('You are receiving this because this address was entered on PitchPrep.') }),
    };
  }

  if (d.kind === 'signin') {
    const preheader = 'A one-tap link to open PitchPrep on this device.';
    return {
      subject: 'Your PitchPrep sign-in link', preheader,
      text: `${hi}\n\nOpen PitchPrep on this device with your pipeline, notes and briefs:\n${d.openUrl}\n\nThe link works for 7 days. Anyone who has it can open your workspace, so do not forward it.\n\nUnsubscribe: ${d.unsubscribeUrl}`,
      html: shell({ preheader, title: 'Open PitchPrep on this device', bodyHtml: `<p style="font-size:15px;line-height:1.5;color:#15181e">One tap and your pipeline, notes and briefs are here. The link works for 7 days. Anyone who has it can open your workspace, so please do not forward it.</p>`, ctaUrl: d.openUrl, ctaLabel: 'Open PitchPrep', ...foot('You asked for this link.') }),
    };
  }

  if (d.kind === 'test') {
    const preheader = 'Nudges are working.';
    return {
      subject: 'PitchPrep test email: nudges are working', preheader,
      text: `${hi}\n\nThis is a test. Real nudges look like this: a short heads-up with a button that opens the right brief on your phone.\n\nOpen: ${d.openUrl}\n\nUnsubscribe: ${d.unsubscribeUrl}`,
      html: shell({ preheader, title: 'Nudges are working', bodyHtml: `<p style="font-size:15px;line-height:1.5;color:#15181e">This is a test email you asked for. Real nudges look like this: a short heads-up, and a button that opens the right brief on your phone.</p>`, ctaUrl: d.openUrl, ctaLabel: 'Open PitchPrep', ...foot('You asked for a test email.') }),
    };
  }

  if (d.kind === 'brief_ready') {
    const subject = `Your brief on ${d.investor?.name ?? 'your investor'} is ready`;
    const preheader = `Meeting ${when}. ${d.skim?.[0] ?? ''}`.trim();
    return {
      subject, preheader,
      text: `${hi}\n\nYour brief for the meeting with ${who} (${when}) is ready.\n\n${tl('In 20 seconds', d.skim ?? [])}${tl('Open with', (d.openers ?? []).map((o) => `${o.title}: "${o.opener}"`))}Open the full brief: ${d.openUrl}\n\nUnsubscribe: ${d.unsubscribeUrl}`,
      html: shell({ preheader, title: `Brief ready: ${d.investor?.name ?? ''}`, bodyHtml: `<p style="font-size:15px;line-height:1.5;color:#15181e">${esc(hi)} your meeting with <strong>${esc(who)}</strong> is at <strong>${esc(when)}</strong>. The brief is ready, and you will get a refreshed version just before you go.</p>${d.skim?.length ? h('In 20 seconds') + ul(d.skim) : ''}${d.openers?.length ? h('Open with') + ul(d.openers.map((o) => `${o.title}: “${o.opener}”`)) : ''}`, ctaUrl: d.openUrl, ctaLabel: 'Open the brief', ...foot('You are getting this because a brief was prepared for an upcoming meeting.') }),
    };
  }

  if (d.kind === 'pre_meeting') {
    const subject = `Meeting ${when.split(' on ')[0]}: ${d.investor?.name ?? ''}. Your refreshed brief`;
    const preheader = d.newSince?.length ? `New since your brief: ${d.newSince[0]}` : 'Nothing new since your brief. You are ready.';
    const newBlock = d.newSince?.length ? `${h('New since your last brief')}${ul(d.newSince)}` : `<p style="font-size:14px;color:#5d6470;margin:10px 0 0">Nothing new was found in public sources since your last brief.</p>`;
    return {
      subject, preheader,
      text: `${hi}\n\nYou meet ${who} at ${when}.\n${d.dataAgeNote ? d.dataAgeNote + '\n' : ''}\n${d.newSince?.length ? tl('New since your last brief', d.newSince) : 'Nothing new since your last brief.\n\n'}${tl('Open with', (d.openers ?? []).map((o) => `"${o.opener}"`))}${tl('Be careful', d.watchOuts ?? [])}${tl('Ask them', d.askThem ?? [])}${tl('Double-check before you say it', d.verifyFirst ?? [])}Meeting card: ${d.openUrl}\n\nUnsubscribe: ${d.unsubscribeUrl}`,
      html: shell({ preheader, title: `${d.investor?.name ?? 'Your meeting'} at ${when.split(' on ')[0]}`, bodyHtml: `<p style="font-size:15px;line-height:1.5;color:#15181e">${esc(hi)} you meet <strong>${esc(who)}</strong> at <strong>${esc(when)}</strong>. ${d.dataAgeNote ? esc(d.dataAgeNote) : ''}</p>${newBlock}${d.openers?.length ? h('Open with') + ul(d.openers.map((o) => `“${o.opener}”`)) : ''}${d.watchOuts?.length ? h('Be careful') + ul(d.watchOuts) : ''}${d.askThem?.length ? h('Ask them') + ul(d.askThem) : ''}${d.verifyFirst?.length ? h('Double-check before you say it') + ul(d.verifyFirst) : ''}`, ctaUrl: d.openUrl, ctaLabel: 'Open the meeting card', ...foot('You are getting this because you have a meeting coming up.') }),
    };
  }

  if (d.kind === 'follow_up') {
    const subject = `Follow up with ${d.followUpFor ?? d.investor?.name ?? 'your investor'} while it is fresh`;
    const preheader = 'A good follow-up is best sent within a day.';
    return {
      subject, preheader,
      text: `${hi}\n\nYou met ${who} recently and there is no follow-up logged yet. Add a few lines of notes and PitchPrep drafts the email for you to edit and send:\n${d.openUrl}\n\nUnsubscribe: ${d.unsubscribeUrl}`,
      html: shell({ preheader, title: 'Time to follow up', bodyHtml: `<p style="font-size:15px;line-height:1.5;color:#15181e">You met <strong>${esc(who)}</strong> recently and no follow-up is logged yet. Add a few lines of notes and PitchPrep drafts the email. You edit it and send it yourself.</p>`, ctaUrl: d.openUrl, ctaLabel: 'Draft the follow-up', ...foot('You are getting this because a meeting happened and no follow-up has been marked.') }),
    };
  }

  if (d.kind === 'overdue') {
    const items = (d.overdue ?? []).map((o) => `${o.investor}: ${o.nextStep} (was due ${o.due})`);
    const subject = items.length === 1 ? 'A next step is overdue' : `${items.length} next steps are overdue`;
    const preheader = items[0] ?? '';
    return {
      subject, preheader,
      text: `${hi}\n\n${tl('Overdue next steps', items)}Open your pipeline: ${d.openUrl}\n\nUnsubscribe: ${d.unsubscribeUrl}`,
      html: shell({ preheader, title: subject, bodyHtml: `<p style="font-size:15px;line-height:1.5;color:#15181e">${esc(hi)} these next steps in your investor pipeline have passed their date:</p>${ul(items)}`, ctaUrl: d.openUrl, ctaLabel: 'Open the pipeline', ...foot('You are getting this because next steps in your pipeline are overdue. At most one such email a day.') }),
    };
  }

  // digest
  const rows = (d.today ?? []).map((t) => `${t.time}: ${t.investor} (${t.firm})${t.briefReady ? '' : ', brief not prepared yet'}`);
  const subject = rows.length === 1 ? 'You have one investor meeting today' : `You have ${rows.length} investor meetings today`;
  const preheader = rows[0] ?? '';
  return {
    subject, preheader,
    text: `${hi}\n\n${tl('Today', rows)}Open your meetings: ${d.openUrl}\n\nUnsubscribe: ${d.unsubscribeUrl}`,
    html: shell({ preheader, title: subject, bodyHtml: `<p style="font-size:15px;line-height:1.5;color:#15181e">${esc(hi)} here is your day:</p>${ul(rows)}`, ctaUrl: d.openUrl, ctaLabel: 'Open your meetings', ...foot('You are getting this because you have investor meetings today. One email a morning at most.') }),
  };
}
