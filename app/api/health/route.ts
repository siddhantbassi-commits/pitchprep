import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t = Date.now();
  const r = await db().from('briefs').select('id', { head: true, count: 'exact' });
  return NextResponse.json({
    ok: !r.error, db: r.error ? r.error.message : 'ok', dbMs: Date.now() - t, model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash',
    geminiKey: !!process.env.GEMINI_API_KEY, searchFallback: !!process.env.OPENROUTER_API_KEY, region: process.env.VERCEL_REGION ?? 'local',
  }, { status: r.error ? 503 : 200 });
}
