'use client';

import { useEffect, useRef, useState } from 'react';
import type { Scorecard, Turn } from '@/lib/mock';
import PracticeProgress from './PracticeProgress';
import type { SessionLite } from '@/lib/progress';

const TOTAL = 5;
type SR = { start(): void; stop(): void; onresult: ((e: any) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string };
type Past = SessionLite;

/** A five-question practice round with a simulated investor. Built only from the verified brief; scored with code-checked numbers. */
export default function MockMeeting({ briefId, investor }: { briefId: string; investor: string }) {
  const [open, setOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<'friendly' | 'tough'>('friendly');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [errAt, setErrAt] = useState<'ask' | 'score'>('ask');
  const [card, setCard] = useState<Scorecard | null>(null);
  const [past, setPast] = useState<Past[]>([]);
  const [speak, setSpeak] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const rec = useRef<SR | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanSpeak('speechSynthesis' in window);
    setCanDictate(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);
  useEffect(() => { if (open) fetch('/api/mock/progress', { cache: 'no-store' }).then((r) => r.json()).then((j) => setPast(j.sessions ?? [])).catch(() => {}); }, [open, briefId, card]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [turns, card]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); rec.current?.stop(); }, []);

  const asked = turns.filter((t) => t.role === 'investor').length;
  const answered = turns.filter((t) => t.role === 'founder').length;
  const started = turns.length > 0;
  const waitingForAnswer = started && turns[turns.length - 1].role === 'investor';

  async function call(body: object) {
    const r = await fetch(`/api/briefs/${briefId}/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ difficulty, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? 'Something went wrong.');
    return j;
  }
  function say(text: string) {
    if (!speak || !canSpeak) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
  async function ask(next: Turn[]) {
    setBusy(true); setErr('');
    try {
      const j = await call({ action: 'turn', turns: next });
      setTurns([...next, { role: 'investor', text: j.question }]);
      say(j.question);
    } catch (e) { setErr((e as Error).message); setErrAt('ask'); setTurns(next); }
    setBusy(false);
  }
  async function begin() { setTurns([]); setCard(null); setAnswer(''); await ask([]); }
  async function send() {
    const next: Turn[] = [...turns, { role: 'founder', text: answer.trim() }];
    setAnswer(''); setTurns(next);
    if (rec.current && listening) rec.current.stop();
    if (next.filter((t) => t.role === 'founder').length >= TOTAL) await finish(next); else await ask(next);
  }
  async function finish(next = turns) {
    // An unanswered last question is not part of the score; drop it so the transcript ends with the founder's answer.
    const answeredOnly = next.length && next[next.length - 1].role === 'investor' ? next.slice(0, -1) : next;
    setBusy(true); setErr(''); setTurns(answeredOnly);
    try { setCard((await call({ action: 'score', turns: answeredOnly })).card); } catch (e) { setErr((e as Error).message); setErrAt('score'); }
    setBusy(false);
  }
  function toggleMic() {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r: SR = new Ctor();
    r.continuous = true; r.interimResults = false; r.lang = 'en-IN';
    r.onresult = (e: any) => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; setAnswer((a) => `${a}${a && !a.endsWith(' ') ? ' ' : ''}${t.trim()}`); };
    r.onend = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  }

  if (!open) {
    return (
      <section className="mt-8 no-print" aria-labelledby="mock">
        <h2 id="mock" className="text-2xl font-semibold">Practise the meeting</h2>
        <div className="card mt-3 p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted max-w-xl">A five-question mock meeting with a simulated {investor}, built only from what this brief verified. Answer by typing or dictating; get a scorecard where every figure you quote is checked against your profile.</p>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Start a mock meeting</button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 no-print" aria-labelledby="mock">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="mock" className="text-2xl font-semibold">Practise the meeting</h2>
        <button className="text-sm text-muted underline" onClick={() => { window.speechSynthesis?.cancel(); setOpen(false); }}>Close</button>
      </div>
      <div className="card mt-3 p-5">
        <p className="rounded-lg bg-bg px-3 py-2 text-xs text-muted">This is a simulation. The questions are generated from the verified facts in this brief and your profile; they are not what the real {investor} will ask, and no real statements are attributed to them.</p>

        {!started && !card && (
          <div className="mt-4">
            <fieldset>
              <legend className="label">How hard should they be?</legend>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
                {(['friendly', 'tough'] as const).map((d) => (
                  <label key={d} className={`btn cursor-pointer ${difficulty === d ? 'btn-primary' : ''}`}>
                    <input type="radio" name="difficulty" className="sr-only" checked={difficulty === d} onChange={() => setDifficulty(d)} />
                    {d === 'friendly' ? 'Friendly: curious and constructive' : 'Tough: sceptical, presses on numbers'}
                  </label>
                ))}
              </div>
            </fieldset>
            {canSpeak && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} /> Read their questions aloud</label>}
            <button className="btn btn-primary mt-4" onClick={begin} disabled={busy}>{busy ? 'Connecting…' : 'Begin'}</button>
            {past.length > 0 && <div className="mt-5 border-t border-line pt-4"><PracticeProgress sessions={past} compact /></div>}
          </div>
        )}

        {started && !card && (
          <div>
            <p className="mt-4 text-sm text-muted">Question {Math.min(asked, TOTAL)} of {TOTAL} · {difficulty}</p>
            <ol className="mt-3 space-y-3" aria-live="polite">
              {turns.map((t, i) => (
                <li key={i} className={`max-w-[92%] rounded-xl px-4 py-3 text-sm ${t.role === 'investor' ? 'bg-bg border border-line' : 'ml-auto bg-brand-soft'}`}>
                  <p className="label mb-1">{t.role === 'investor' ? investor : 'You'}</p>
                  <p className="whitespace-pre-wrap">{t.text}</p>
                </li>
              ))}
              {busy && <li className="text-sm text-muted">{answered >= TOTAL ? 'Scoring your answers…' : `${investor} is thinking…`}</li>}
            </ol>
            <div ref={endRef} />
            {waitingForAnswer && !busy && (
              <div className="mt-4">
                <label htmlFor="mock-ans" className="label">Your answer</label>
                <textarea id="mock-ans" className="input mt-1" rows={4} maxLength={2500} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer as you would out loud. Use your real numbers." />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button className="btn btn-primary" onClick={send} disabled={answer.trim().length < 5}>{asked >= TOTAL ? 'Send and get my scorecard' : 'Send answer'}</button>
                  {canDictate && <button type="button" className="btn" onClick={toggleMic} aria-pressed={listening}>{listening ? 'Stop dictating' : 'Dictate'}</button>}
                  {answered >= 3 && asked < TOTAL && <button className="text-sm text-muted underline" onClick={() => finish()}>End here and score what I have</button>}
                </div>
              </div>
            )}
          </div>
        )}
        {err && (
          <div role="alert" className="mt-3 text-sm text-red">
            {err}{' '}
            {started && !card && (errAt === 'score' ? <button className="underline" onClick={() => finish()}>Retry scoring</button> : !waitingForAnswer && <button className="underline" onClick={() => ask(turns)}>Retry</button>)}
          </div>
        )}

        {card && <Card card={card} onAgain={() => { setTurns([]); setCard(null); }} past={past} />}
      </div>
    </section>
  );
}

function Card({ card, onAgain, past }: { card: Scorecard; onAgain: () => void; past: Past[] }) {
  const prev = past.find((p) => p.overall != null && p.overall !== card.overall);
  return (
    <div className="mt-4" aria-live="polite">
      <div className="flex flex-wrap items-end gap-4">
        <p className="text-5xl font-semibold">{card.overall}<span className="text-xl text-muted">/100</span></p>
        <p className="text-sm text-muted pb-1">Average of four scores out of 5, computed from the table below. {prev ? `Your previous round scored ${prev.overall}.` : ''}</p>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {card.dimensions.map((d) => (
          <li key={d.key} className="rounded-lg border border-line p-3 text-sm">
            <p className="font-medium">{d.label}: {d.score}/5</p>
            <p className="text-muted">{d.note}</p>
          </li>
        ))}
      </ul>
      {card.flags.map((f) => <p key={f} className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">{f}</p>)}
      {card.strongest && <p className="mt-4 text-sm"><b>Your strongest moment</b><br /><span className="italic border-l-4 border-brand pl-3 inline-block mt-1">&ldquo;{card.strongest}&rdquo;</span></p>}
      <p className="mt-4 text-sm"><b>The one thing to fix</b><br /><span className="text-muted">{card.biggestFix}</span></p>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium">Answer by answer</summary>
        <ol className="mt-2 space-y-3 text-sm">
          {card.perAnswer.map((p) => (
            <li key={p.n} className="rounded-lg border border-line p-3">
              <p className="font-medium">{p.n}. {p.question}</p>
              <p className="text-muted mt-1">{p.note} <span>({p.words} words)</span></p>
              {p.flags.map((f) => <p key={f} className="mt-1 text-amber">{f}</p>)}
            </li>
          ))}
        </ol>
      </details>
      <button className="btn mt-4" onClick={onAgain}>Practise again</button>
    </div>
  );
}
