import { NextResponse, type NextRequest } from 'next/server';
import { WORKSPACE_COOKIE, signWorkspace, verifyWorkspace } from './lib/workspace';

// Gives every visitor a private workspace without a login wall. The cookie is signed so ids cannot be guessed or forged.
export async function proxy(req: NextRequest) {
  const existing = await verifyWorkspace(req.cookies.get(WORKSPACE_COOKIE)?.value);
  if (existing) return NextResponse.next();
  const id = crypto.randomUUID();
  const value = await signWorkspace(id);
  const headers = new Headers(req.headers);
  headers.set('cookie', [req.headers.get('cookie'), `${WORKSPACE_COOKIE}=${value}`].filter(Boolean).join('; '));
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(WORKSPACE_COOKIE, value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] };
