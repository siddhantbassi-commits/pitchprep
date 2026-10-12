// Sends email through a Gmail account using an app password. If the credentials are not set, nothing is sent
// (dry-run) and callers are told, so the rest of the system can be built, previewed and tested safely.

import nodemailer, { type Transporter } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl?: string; // adds the List-Unsubscribe headers that mail apps show as an Unsubscribe button
}

export interface SendResult { ok: boolean; dryRun?: boolean; error?: string }

export function mailerConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD);
}

let transport: Transporter | null = null;
function tx(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_APP_PASSWORD!.replace(/\s+/g, '') },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    });
  }
  return transport;
}

export const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[A-Za-z]{2,}$/;

export async function sendMail(m: Mail): Promise<SendResult> {
  if (!EMAIL_RE.test(m.to) || m.to.length > 254) return { ok: false, error: 'invalid recipient' };
  if (!mailerConfigured()) return { ok: false, dryRun: true };
  try {
    await tx().sendMail({
      from: { name: process.env.MAIL_FROM_NAME || 'PitchPrep', address: process.env.SMTP_USER! },
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
      headers: m.unsubscribeUrl
        ? { 'List-Unsubscribe': `<${m.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        : undefined,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e).slice(0, 200) };
  }
}
