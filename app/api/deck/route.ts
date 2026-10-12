import { NextResponse } from 'next/server';
import { logEvent } from '@/lib/db';
import { checkDeck } from '@/lib/deck';
import { Meter } from '@/lib/gemini';
import { allow, currentWorkspace, getProfile } from '@/lib/store';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const MAX_PDF = 3_900_000; // Vercel request bodies are capped at 4.5 MB; stay under it
const MAX_TEXT = 40_000;

// Checks a pitch deck (PDF or pasted text) against the founder's profile. The deck is processed in memory and never stored.
export async function POST(req: Request) {
  const ws = await currentWorkspace();
  if (!(await allow(`deck:${ws}`, 6, 3600_000)) || !(await allow('deck-global', 100, 86_400_000))) return NextResponse.json({ error: 'You have checked a few decks in the last hour. Please try again a little later.' }, { status: 429 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'That upload did not arrive. Please try again.' }, { status: 400 }); }
  const file = form.get('file');
  const text = String(form.get('text') ?? '').trim();
  let pdf: Buffer | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF) return NextResponse.json({ error: 'That PDF is larger than 3.9 MB. Export a smaller version, or paste the deck text instead.' }, { status: 413 });
    pdf = Buffer.from(await file.arrayBuffer());
    if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') return NextResponse.json({ error: 'That file is not a PDF.' }, { status: 400 });
  } else if (text.length < 40) return NextResponse.json({ error: 'Choose a PDF or paste the text of your deck.' }, { status: 400 });
  else if (text.length > MAX_TEXT) return NextResponse.json({ error: 'That text is longer than 40,000 characters. Paste just the slides.' }, { status: 413 });
  try {
    const meter = new Meter();
    const out = await checkDeck({ pdf, text: pdf ? undefined : text, profile: await getProfile(ws), meter });
    await logEvent('assist', 'deck_check', null, { conflicts: out.report.counts.conflict, figures: out.report.checked.length, pdf: !!pdf, cost: meter.u.costUsd });
    return NextResponse.json({ report: out.report, transcript: out.transcript.slice(0, 40_000) });
  } catch (e) {
    const m = String((e as Error).message ?? '');
    return NextResponse.json({ error: /No readable text/.test(m) ? m : 'That did not come back in time. Please try again, or paste the deck text.' }, { status: /No readable text/.test(m) ? 422 : 502 });
  }
}
