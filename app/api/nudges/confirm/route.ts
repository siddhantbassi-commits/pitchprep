import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPrefs } from '@/lib/nudges';
import { verifyToken } from '@/lib/tokens';
import { WORKSPACE_COOKIE, signWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

// The link in the confirmation email. Clicking it proves control of the address, so it also signs this browser into the workspace.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = verifyToken<{ ws: string; email: string }>(url.searchParams.get('t') ?? '', 'confirm');
  if (!t) return NextResponse.redirect(new URL('/meetings?nudges=expired', url.origin));
  const p = await getPrefs(t.ws);
  if (!p || p.email !== t.email) return NextResponse.redirect(new URL('/meetings?nudges=expired', url.origin));
  await db().from('nudge_prefs').update({ verified_at: new Date().toISOString(), enabled: true }).eq('workspace_id', t.ws);
  const res = NextResponse.redirect(new URL('/meetings?nudges=confirmed', url.origin));
  res.cookies.set(WORKSPACE_COOKIE, await signWorkspace(t.ws), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
