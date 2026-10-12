'use client';

import { useEffect, useRef, useState } from 'react';

interface Review { verdict: 'strong' | 'solid' | 'needs_work'; strengths: string[]; tighten: string[]; sharper: string; numberFlags: string[]; wordCount: number }
const VERDICT: Record<Review['verdict'], { label: string; cls: string }> = {
  strong: { label: 'Strong answer', cls: 'bg-brand-soft text-brand border-transparent' },
  solid: { label: 'Solid, can be sharper', cls: 'bg-blue-soft text-blue border-transparent' },
  needs_work: { label: 'Needs work', cls: 'bg-amber-soft text-amber border-transparent' },
};

type SR = { start(): void; stop(): void; onresult: ((e: any) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string };

/** Practise one likely question: type or dictate an answer and get coaching. Figures you quote are checked in code against your own profile. */
export default function Rehearse({ briefId, question, prep }: { briefId: string; question: string; prep: string }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const rec = useRef<SR | null>(null);

  useEffect(() => { setCanDictate(typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); }, []);

  function toggleMic() {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r: SR = new Ctor();
    r.continuous = true; r.interimResults = false; r.lang = 'en-IN';
    r.onresult = (e: any) => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; setAnswer((a) => `${a}${a && !a.endsWith(' ') ? ' ' : ''}${t.trim()}`); };
    r.onend = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  }

  async function submit() {
    setBusy(true); setErr('');
    const r = await fetch(`/api/briefs/${briefId}/rehearse`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, prep, answer }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? 'Something went wrong.'); else setReview(j);
    setBusy(false);
  }

  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="no-print">
      {!open ? (
        <button className="mt-2 text-sm font-medium text-brand underline" onClick={() => setOpen(true)}>Practise this answer</button>
      ) : (
        <div className="mt-3 rounded-xl border border-line bg-bg p-4">
          <label className="label" htmlFor={`ans-${question.slice(0, 12)}`}>Your answer, as you would say it</label>
          <textarea id={`ans-${question.slice(0, 12)}`} className="input mt-1" rows={5} maxLength={2500} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer out loud in your head, then write what you said. Use real numbers." />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={submit} disabled={busy || answer.trim().length < 20}>{busy ? 'Reviewing…' : review ? 'Review again' : 'Review my answer'}</button>
            {canDictate && <button type="button" className="btn" onClick={toggleMic} aria-pressed={listening}>{listening ? 'Stop dictating' : 'Dictate'}</button>}
            <span className="text-xs text-muted">{words} words{words > 150 ? ' (aim for under about 150 when spoken)' : ''}</span>
            <button className="ml-auto text-sm text-muted underline" onClick={() => setOpen(false)}>Close</button>
          </div>
          {err && <p role="alert" className="mt-2 text-sm text-red">{err}</p>}
          {review && (
            <div className="mt-4 border-t border-line pt-3 text-sm space-y-3" aria-live="polite">
              <span className={`chip ${VERDICT[review.verdict].cls}`}>{VERDICT[review.verdict].label}</span>
              {review.numberFlags.length > 0 && <ul className="rounded-lg bg-amber-soft p-3 text-amber space-y-1">{review.numberFlags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
              {review.strengths.length > 0 && <div><p className="font-medium">What worked</p><ul className="list-disc pl-5 text-muted">{review.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
              {review.tighten.length > 0 && <div><p className="font-medium">To tighten</p><ul className="list-disc pl-5 text-muted">{review.tighten.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
              <div><p className="font-medium">A sharper opening</p><p className="mt-1 border-l-4 border-brand pl-3 italic">&ldquo;{review.sharper}&rdquo;</p></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
