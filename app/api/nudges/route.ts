import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, must } from '@/lib/db';
import { EMAIL_RE, mailerConfigured } from '@/lib/mailer';
import { getPrefs, sendConfirmation } from '@/lib/nudges';
import { currentWorkspace } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const view = (p: Awaited<ReturnType<typeof getPrefs>>) => p && ({
  email: p.email, verified: !!p.verified_at, enabled: p.enabled, brief_ready: p.brief_ready, pre_meeting: p.pre_meeting,
  follow_up: p.follow_up, overdue: p.overdue, daily_digest: p.daily_digest, lead_minutes: p.lead_minutes,
});

export async function GET() {
  const ws = await currentWorkspace();
  return NextResponse.json({ configured: mailerConfigured(), prefs: view(await getPrefs(ws)) });
}

const Email = z.object({ email: z.string().trim().toLowerCase().max(254) });

// Set (or change) the address. A confirmation email goes out first; nothing else is sent until it is confirmed.
export async function POST(req: Request) {
  const b = Email.safeParse(await req.json().catch(() => null));
  if (!b.success || !EMAIL_RE.test(b.data.email)) return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 });
  const ws = await currentWorkspace();
  const existing = await getPrefs(ws);
  const changed = !existing || existing.email !== b.data.email;
  must(await db().from('nudge_prefs').upsert({ workspace_id: ws, email: b.data.email, ...(changed ? { verified_at: null } : {}), verify_sent_at: new Date().toISOString() }), 'save address');
  if (!changed && existing?.verified_at) return NextResponse.json({ ok: true, alreadyConfirmed: true, prefs: view(await getPrefs(ws)) });
  const r = await sendConfirmation(ws, b.data.email, new URL(req.url).origin);
  if (r.limited) return NextResponse.json({ ok: false, error: r.error, prefs: view(await getPrefs(ws)) }, { status: 429 });
  if (!r.ok && !r.dryRun) return NextResponse.json({ ok: false, error: 'We could not send the confirmation email right now. Please try again shortly.', prefs: view(await getPrefs(ws)) }, { status: 502 });
  return NextResponse.json({ ok: true, dryRun: !!r.dryRun, prefs: view(await getPrefs(ws)) });
}

const Toggles = z.object({
  enabled: z.boolean().optional(), brief_ready: z.boolean().optional(), pre_meeting: z.boolean().optional(), follow_up: z.boolean().optional(),
  overdue: z.boolean().optional(), daily_digest: z.boolean().optional(), lead_minutes: z.number().int().min(30).max(360).optional(),
});

export async function PUT(req: Request) {
  const b = Toggles.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 });
  const ws = await currentWorkspace();
  if (!(await getPrefs(ws))) return NextResponse.json({ error: 'Add an email address first.' }, { status: 400 });
  must(await db().from('nudge_prefs').update(b.data).eq('workspace_id', ws), 'update prefs');
  return NextResponse.json({ ok: true, prefs: view(await getPrefs(ws)) });
}

export async function DELETE() {
  const ws = await currentWorkspace();
  await db().from('nudge_prefs').delete().eq('workspace_id', ws);
  return NextResponse.json({ ok: true });
}
