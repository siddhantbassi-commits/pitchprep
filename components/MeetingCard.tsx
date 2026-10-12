'use client';

import { useEffect, useRef } from 'react';
import type { BriefResult, Claim } from '@/lib/types';
import { KIND_LABEL } from '@/lib/format';

/** Full-screen, large-type view for the minute before the meeting: openers, key facts, watch-outs, likely questions. */
export default function MeetingCard({ result, startup, onClose }: { result: BriefResult; startup: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    // The dialog's only control is Close, so Tab keeps focus there instead of wandering into the page behind.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'Tab') { e.preventDefault(); closeRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const s = result.synthesis;
  const flags: Claim[] = result.claims.filter((c) => c.verified && c.section === 'context').sort((a, b) => (b.severity === 'high' ? 2 : b.severity === 'watch' ? 1 : 0) - (a.severity === 'high' ? 2 : a.severity === 'watch' ? 1 : 0)).slice(0, 3);
  const recent = result.claims.filter((c) => c.verified && c.section === 'deals').sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? '')).slice(0, 2);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Meeting card for ${result.investor.name}`} className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label">Meeting card</p>
            <h2 className="mt-1 text-3xl font-semibold leading-tight">{result.investor.name}</h2>
            <p className="text-lg text-muted">{[result.investor.role, result.investor.firm].filter(Boolean).join(' · ')}</p>
          </div>
          <button ref={closeRef} className="btn shrink-0" onClick={onClose}>Close</button>
        </div>

        {s && (
          <>
            <h3 className="mt-8 text-xl font-semibold">Open with</h3>
            <ol className="mt-3 space-y-4">
              {s.talkingPoints.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="mt-1 h-7 w-7 shrink-0 rounded-full bg-brand text-brand-ink grid place-items-center text-sm font-semibold">{i + 1}</span>
                  <div><p className="font-semibold text-lg leading-snug">{t.title}</p><p className="mt-1 text-lg italic leading-snug">&ldquo;{t.opener}&rdquo;</p></div>
                </li>
              ))}
            </ol>
            <h3 className="mt-8 text-xl font-semibold">Know</h3>
            <ul className="mt-3 space-y-2 text-lg leading-snug">{s.skim.map((x, i) => <li key={i} className="flex gap-3"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />{x}</li>)}</ul>
            <p className="mt-3 text-sm text-muted">Fit with {startup}: stage {s.fit.stage}, sector {s.fit.sector}, cheque {s.fit.cheque}.</p>
          </>
        )}

        {recent.length > 0 && (
          <>
            <h3 className="mt-8 text-xl font-semibold">Latest activity</h3>
            <ul className="mt-3 space-y-2 text-lg leading-snug">{recent.map((c) => <li key={c.id}>{c.text}</li>)}</ul>
          </>
        )}

        <h3 className="mt-8 text-xl font-semibold">Be careful</h3>
        {flags.length ? (
          <ul className="mt-3 space-y-2 text-lg leading-snug">{flags.map((c) => <li key={c.id}><span className="chip mr-2 align-middle">{KIND_LABEL[c.kind] ?? c.kind}</span>{c.text}</li>)}</ul>
        ) : (
          <p className="mt-3 text-lg text-muted">No reported controversies or retreats were found in public sources.</p>
        )}

        {s && (s.questionsToAsk ?? []).length > 0 && (
          <>
            <h3 className="mt-8 text-xl font-semibold">Ask them</h3>
            <ul className="mt-3 space-y-3 text-lg leading-snug">{s.questionsToAsk.map((q, i) => <li key={i}>{q.question}</li>)}</ul>
          </>
        )}

        {s && s.likelyQuestions.length > 0 && (
          <>
            <h3 className="mt-8 text-xl font-semibold">Expect</h3>
            <ul className="mt-3 space-y-3 text-lg leading-snug">{s.likelyQuestions.map((q, i) => <li key={i}>{q.question}</li>)}</ul>
          </>
        )}
        <p className="mt-10 text-xs text-muted">Every line comes from a checked source; open the full brief for quotes and links. Press Esc to close.</p>
      </div>
    </div>
  );
}
