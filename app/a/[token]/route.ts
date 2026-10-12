import { NextResponse } from 'next/server';
import { safeNext, verifyToken } from '@/lib/tokens';
import { WORKSPACE_COOKIE, signWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

// One-tap link from an email: signs this browser into the workspace, then goes to the page the email was about.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const url = new URL(req.url);
  const t = verifyToken<{ ws: string; next: string }>(token, 'open');
  if (!t) return NextResponse.redirect(new URL('/?link=expired', url.origin));
  const res = NextResponse.redirect(new URL(safeNext(t.next), url.origin));
  res.cookies.set(WORKSPACE_COOKIE, await signWorkspace(t.ws), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
