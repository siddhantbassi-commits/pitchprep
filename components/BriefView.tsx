'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BriefResult, Claim, Confidence, Evidence, FounderProfile, Section, StageState } from '@/lib/types';
import AfterMeeting from './AfterMeeting';
import MeetingCard from './MeetingCard';
import Rehearse from './Rehearse';
import VerifyList from './VerifyList';
import FreshnessChip from './FreshnessChip';
import ListenButton from './ListenButton';
import Outreach from './Outreach';
import { DEMO_PROFILE } from '@/lib/demoProfile';
import { CONF_LABEL, DROP_LABEL, KIND_LABEL, claimDate, fmtDate, fmtDateTime, fmtSecs } from '@/lib/format';

export interface BriefData {
  id: string;
  status: 'running' | 'complete' | 'partial' | 'unverified' | 'failed';
  stages: StageState[];
  result: BriefResult | null;
  error: string | null;
  investor: { name: string; firm: string };
  createdAt: string;
  isOwner: boolean;
  isSeed: boolean;
  profile: FounderProfile | null;
  meetingAt: string | null;
  delta?: { prevId: string; prevAt: string; newSince: { id: string; section: string; kind: string; date: string | null; text: string }[]; alsoSurfaced: { id: string; section: string; kind: string; date: string | null; text: string }[] } | null;
}

export default function BriefView({ initial, token }: { initial: BriefData; token: string | null }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const running = data.status === 'running';

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/briefs/${data.id}${token ? `?t=${token}` : ''}`, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch { /* keep polling */ }
    }, 1500);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [running, data.id, token]);

  const regenerate = useCallback(async () => {
    const r = await fetch('/api/briefs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: data.investor.name, firm: data.investor.firm, fresh: true }) });
    const j = await r.json();
    if (r.ok) router.push(`/brief/${j.id}`);
    else alert(j.error ?? 'Could not start a new brief.');
  }, [data.investor, router]);

  if (running) return <Progress data={data} elapsed={Math.max(0, Math.round((now - Date.parse(data.createdAt)) / 1000))} />;
  if (data.status === 'failed' || !data.result)
    return (
      <div className="card p-8 text-center max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold">We could not finish this brief</h1>
        <p className="mt-2 text-muted">{data.error ?? 'Something went wrong.'}</p>
        <button className="btn btn-primary mt-6" onClick={regenerate}>Try again</button>
      </div>
    );
  return <Brief data={data} result={data.result} onRegenerate={regenerate} />;
}

function Progress({ data, elapsed }: { data: BriefData; elapsed: number }) {
  const stages = data.stages.length ? data.stages : [];
  return (
    <div className="max-w-xl mx-auto">
      <p className="label">Preparing your brief</p>
      <h1 className="mt-1 text-3xl font-semibold">{data.investor.name}</h1>
      <p className="text-muted">{data.investor.firm}</p>
      <div className="card mt-6 p-5" role="status" aria-live="polite">
        <ol className="space-y-3">
          {(stages.length ? stages : [{ key: 'start', label: 'Starting up', status: 'running' } as StageState]).map((s) => (
            <li key={s.key} className="flex items-start gap-3">
              <span aria-hidden className={`mt-1 h-3 w-3 rounded-full shrink-0 ${s.status === 'done' ? 'bg-brand' : s.status === 'running' ? 'bg-brand pulse' : s.status === 'failed' ? 'bg-red' : 'bg-line'}`} />
              <div className="min-w-0">
                <p className={s.status === 'pending' || s.status === 'skipped' ? 'text-muted' : 'font-medium'}>{s.label}</p>
                {s.detail && <p className="text-sm text-muted">{s.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex items-center justify-between text-sm text-muted border-t border-line pt-3">
          <span>{elapsed}s elapsed. Usually 40 to 70 seconds.</span>
          {data.profile && <span className="hidden sm:inline">Tailoring to {data.profile.startup}</span>}
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">You can leave this page. The brief will be saved under History.</p>
    </div>
  );
}

const CONF_STYLE: Record<Confidence, string> = {
  high: 'bg-brand-soft text-brand border-transparent',
  medium: 'bg-blue-soft text-blue border-transparent',
  low: 'bg-amber-soft text-amber border-transparent',
  none: 'bg-surface text-muted',
};

function Brief({ data, result, onRegenerate }: { data: BriefData; result: BriefResult; onRegenerate: () => void }) {
  const [copied, setCopied] = useState('');
  const [card, setCard] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const router = useRouter();
  const verified = useMemo(() => result.claims.filter((c) => c.verified), [result]);
  const evById = useMemo(() => new Map(result.evidence.map((e) => [e.id, e])), [result]);
  const bySection = (s: Section) => verified.filter((c) => c.section === s).sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? ''));
  const undatedDeals = result.claims.filter((c) => !c.verified && c.dropReason === 'deal_without_date');
  const excluded = result.claims.filter((c) => !c.verified && c.dropReason !== 'deal_without_date');
  const syn = result.synthesis;
  const claimById = new Map(result.claims.map((c) => [c.id, c]));

  const flash = (m: string) => { setCopied(m); setTimeout(() => setCopied(''), 2000); };
  const copyText = async () => {
    await copyToClipboard(toPlainText(result, verified, evById), 'Brief copied');
  };
  const copyToClipboard = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); flash(msg); } catch { flash('Could not copy automatically. Copy the address from the browser bar.'); }
  };
  const share = async () => {
    if (data.isSeed) return copyToClipboard(location.href, 'Link copied');
    const r = await fetch(`/api/briefs/${data.id}`, { method: 'POST' });
    const j = await r.json();
    if (r.ok) await copyToClipboard(`${location.origin}${j.path}`, 'Share link copied. Anyone with it can read this brief, including the startup details in the talking points.');
  };
  const adopt = async () => {
    setAdopting(true);
    const r = await fetch(`/api/briefs/${data.id}/adopt`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) router.push(`/brief/${j.id}`); else { flash(j.error ?? 'Could not add it.'); setAdopting(false); }
  };
  const remove = async () => {
    if (!confirm(`Delete this brief on ${result.investor.name}? Your notes for this investor are kept.`)) return;
    const r = await fetch(`/api/briefs/${data.id}`, { method: 'DELETE' });
    if (r.ok) { router.push('/briefs'); router.refresh(); } else flash('Could not delete it.');
  };
  const canAssist = data.isOwner || data.isSeed;
  const sample = data.isOwner && data.profile?.startup === DEMO_PROFILE.startup;

  return (
    <article>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">Pre-meeting brief{data.isSeed ? ' · example' : ''}{data.meetingAt ? ` · for your meeting on ${fmtDateTime(data.meetingAt)}` : ''}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-semibold">{result.investor.name}</h1>
          <p className="text-lg text-muted">{[result.investor.role, result.investor.firm].filter(Boolean).join(' · ')}</p>
          <p className="mt-2 text-sm text-muted">
            Generated {fmtDateTime(result.asOf)} in {fmtSecs(result.stats.latencyMs)} · {result.stats.sources} sources, {result.stats.fullTextSources} read in full · deals window {fmtDate(result.windowStart)} to {fmtDate(result.windowEnd)}
          </p>
          {result.status !== 'unverified' && <FreshnessChip asOf={result.asOf} meetingAt={data.meetingAt} onRefresh={onRegenerate} />}
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {result.synthesis && <button className="btn btn-primary" onClick={() => setCard(true)}>Meeting card</button>}
          {result.synthesis && <ListenButton result={result} />}
          {result.status !== 'unverified' && <button className="btn" onClick={copyText}>Copy text</button>}
          {result.status !== 'unverified' && <button className="btn" onClick={() => window.print()}>Save as PDF</button>}
          {result.status !== 'unverified' && <button className="btn" onClick={share}>{data.isSeed ? 'Copy link' : 'Share link'}</button>}
          <button className="btn" onClick={onRegenerate}>{result.status === 'unverified' ? 'Try again' : 'Refresh'}</button>
        </div>
      </header>
      {copied && <p role="status" className="no-print mt-2 text-sm text-brand font-medium">{copied}</p>}

      {result.investor.ambiguity && (
        <div className="mt-4 rounded-xl border border-line bg-amber-soft text-amber p-3 text-sm"><strong>Check the match:</strong> {result.investor.ambiguity}</div>
      )}
      {data.isSeed && (
        <div className="no-print mt-4 rounded-xl border border-line bg-brand-soft p-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <p><strong>Example brief.</strong> Written for a sample founder. Add it to your pipeline to take notes, draft a follow-up and track the investor.</p>
          <button className="btn btn-primary" onClick={adopt} disabled={adopting}>{adopting ? 'Adding…' : 'Add to my pipeline'}</button>
        </div>
      )}
      {sample && result.status !== 'unverified' && (
        <div className="no-print mt-4 rounded-xl border border-line bg-blue-soft p-4 text-sm text-blue flex flex-wrap items-center justify-between gap-3">
          <p>Talking points are tailored to a <strong>sample founder</strong> ({DEMO_PROFILE.startup}). Put in your own startup and every brief becomes yours.</p>
          <a className="btn" href="/settings">Use my startup</a>
        </div>
      )}
      {result.status === 'unverified' && (
        <div className="card mt-6 p-6">
          <h2 className="text-xl font-semibold">We could not verify {result.investor.name} at {result.investor.firm}</h2>
          <p className="mt-2 text-muted">{result.stats.claimsExtracted > 0 ? 'Sources were found, but none could be tied to this person at this firm, so nothing is shown rather than risk an unsupported statement.' : 'We found no public record of this person at this firm. Nothing is shown rather than risk an invented one.'}</p>
          <ul className="mt-3 list-disc pl-5 space-y-1 text-sm">
            <li>Check the spelling of the name, and use the firm's usual name (for example &ldquo;Peak XV Partners&rdquo;).</li>
            <li>If they are newer or lower-profile, paste a link, bio or post under &ldquo;Add context&rdquo; and we will use it as a source you supplied.</li>
            <li>Not everyone has a public footprint. For those people, the brief cannot be built from public sources, and that is the honest answer.</li>
          </ul>
          <div className="no-print mt-5 flex flex-wrap gap-3">
            <a className="btn btn-primary" href={`/?name=${encodeURIComponent(result.investor.name)}&firm=${encodeURIComponent(result.investor.firm)}&ctx=1`}>Edit and add context</a>
            <a className="btn" href="/">Try another investor</a>
          </div>
        </div>
      )}

      {data.delta && (
        <section className="mt-6 card p-5" aria-labelledby="delta">
          <h2 id="delta" className="text-lg font-semibold">Compared with your last brief ({fmtDateTime(data.delta.prevAt)})</h2>
          {data.delta.newSince.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No new events dated after your last brief were found in public sources.</p>
          ) : (
            <>
              <p className="mt-1 text-sm font-medium">New since then</p>
              <ul className="mt-1 space-y-2 text-sm">
                {data.delta.newSince.map((c) => (
                  <li key={c.id} className="flex gap-2"><span className="chip shrink-0">{KIND_LABEL[c.kind] ?? c.kind}</span><a className="underline" href={`#${c.id}`}>{c.text}</a></li>
                ))}
              </ul>
            </>
          )}
          {data.delta.alsoSurfaced.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">Also surfaced this time ({data.delta.alsoSurfaced.length}). Live search varies, so these may be older facts that did not show up before.</summary>
              <ul className="mt-2 space-y-2 text-sm">
                {data.delta.alsoSurfaced.map((c) => (
                  <li key={c.id} className="flex gap-2"><span className="chip shrink-0">{KIND_LABEL[c.kind] ?? c.kind}</span><a className="underline" href={`#${c.id}`}>{c.text}</a></li>
                ))}
              </ul>
            </details>
          )}
          <a className="mt-3 inline-block text-sm text-muted underline" href={`/brief/${data.delta.prevId}`}>Open the previous brief</a>
        </section>
      )}

      {syn && (
        <>
          <section className="mt-8 card p-5 sm:p-6" aria-labelledby="skim">
            <h2 id="skim" className="text-xl font-semibold">In 20 seconds</h2>
            <ul className="mt-3 space-y-2">{syn.skim.map((s, i) => <li key={i} className="flex gap-3"><span aria-hidden className="mt-2 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />{s}</li>)}</ul>
            <div className="mt-4 flex flex-wrap gap-2 items-center">
              <span className="label mr-1">Fit with {data.profile?.startup ?? 'your startup'}</span>
              {(['stage', 'sector', 'cheque'] as const).map((k) => (
                <span key={k} className={`chip ${syn.fit[k] === 'strong' ? 'bg-brand-soft text-brand border-transparent' : syn.fit[k] === 'possible' ? 'bg-blue-soft text-blue border-transparent' : syn.fit[k] === 'weak' ? 'bg-red-soft text-red border-transparent' : ''}`}>{k}: {syn.fit[k]}</span>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">{syn.fit.rationale}</p>
          </section>

          <section className="mt-8" aria-labelledby="tp">
            <h2 id="tp" className="text-2xl font-semibold">Three talking points for {data.profile?.startup ?? 'your pitch'}</h2>
            <div className="mt-4 grid gap-4 print-block">
              {syn.talkingPoints.map((t, i) => (
                <div key={i} className="card p-5 sm:p-6">
                  <div className="flex gap-4">
                    <span aria-hidden className="h-8 w-8 shrink-0 rounded-full bg-brand text-brand-ink grid place-items-center font-semibold">{i + 1}</span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold">{t.title}</h3>
                      <p className="mt-1">{t.angle}</p>
                      <blockquote className="mt-3 border-l-4 border-brand pl-3 italic">&ldquo;{t.opener}&rdquo;</blockquote>
                      <p className="mt-3 text-sm text-muted"><span className="font-semibold text-ink">Uses from your startup:</span> {t.tailoredTo}</p>
                      <div className="mt-2 text-sm text-muted">
                        <span className="font-semibold text-ink">Built on:</span>
                        <ul className="mt-1 space-y-1">
                          {t.claimIds.map((id) => claimById.get(id)).filter((c): c is Claim => !!c).map((c) => (
                            <li key={c.id} className="flex gap-2"><span aria-hidden>&rarr;</span><a className="underline" href={`#${c.id}`}>{c.text}</a></li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {result.status !== 'unverified' && syn && <VerifyList claims={result.claims} evidence={result.evidence} />}

      {result.status !== 'unverified' && (
        <>
          <Section id="deals" title="Recent portfolio activity" sub={`Investments, exits and milestones from ${fmtDate(result.windowStart)} to ${fmtDate(result.windowEnd)} (last 90 days)`} conf={result.sectionConfidence.deals} count={bySection('deals').length} empty="No investments or exits dated in the last 90 days were found in public sources. That does not prove there were none, only that none could be sourced.">
            {bySection('deals').map((c) => <ClaimRow key={c.id} c={c} ev={evById} briefId={data.id} canReport={canAssist} />)}
            {undatedDeals.length > 0 && (
              <details className="px-5 py-3 border-t border-line">
                <summary className="cursor-pointer text-sm font-medium text-amber">Possibly relevant, but the date could not be confirmed ({undatedDeals.length})</summary>
                <p className="mt-1 text-xs text-muted">Not counted as recent because no publication or event date was found. Open the source to check.</p>
                {undatedDeals.map((c) => <ClaimRow key={c.id} c={c} ev={evById} briefId={data.id} canReport={false} muted />)}
              </details>
            )}
          </Section>
          <Section id="thesis" title="Stated thesis" sub="What they have said publicly, with where and when" conf={result.sectionConfidence.thesis} count={bySection('thesis').length} empty="No public statements of thesis could be sourced.">
            {bySection('thesis').map((c) => <ClaimRow key={c.id} c={c} ev={evById} briefId={data.id} canReport={canAssist} />)}
          </Section>
          <Section id="context" title="Watch-outs and context" sub="Sectors they are pulling back from, portfolio pivots and reported controversies. Reported by the outlet named, not our judgement." conf={result.sectionConfidence.context} count={bySection('context').length} empty="No retreats, pivots or controversies were found in credible public reporting. That is useful, but it does not prove there are none.">
            {bySection('context').map((c) => <ClaimRow key={c.id} c={c} ev={evById} briefId={data.id} canReport={canAssist} />)}
          </Section>
          <Section id="firm" title="Firm snapshot" sub="Fund size, cheque size and focus" conf={result.sectionConfidence.firm} count={bySection('firm').length} empty="No firm facts could be sourced.">
            {bySection('firm').map((c) => <ClaimRow key={c.id} c={c} ev={evById} briefId={data.id} canReport={canAssist} />)}
          </Section>
        </>
      )}

      {syn && syn.likelyQuestions.length > 0 && (
        <section className="mt-8" aria-labelledby="qs">
          <h2 id="qs" className="text-2xl font-semibold">Questions to prepare for</h2>
          <div className="card mt-3 divide-y divide-line">
            {syn.likelyQuestions.map((q, i) => (
              <div key={i} className="p-4"><p className="font-medium">{q.question}</p><p className="text-sm text-muted mt-1">{q.prep}</p>{canAssist && <Rehearse briefId={data.id} question={q.question} prep={q.prep} />}</div>
            ))}
          </div>
        </section>
      )}

      {syn && (syn.questionsToAsk ?? []).length > 0 && (
        <section className="mt-8" aria-labelledby="qa">
          <h2 id="qa" className="text-2xl font-semibold">Questions to ask them</h2>
          <p className="text-sm text-muted">Fundraising is diligence in both directions. These help you judge whether this is the right partner.</p>
          <div className="card mt-3 divide-y divide-line">
            {syn.questionsToAsk.map((q, i) => (
              <div key={i} className="p-4">
                <p className="font-medium">{q.question}</p>
                <p className="text-sm text-muted mt-1">{q.why}</p>
                {q.claimIds.length > 0 && <p className="text-xs text-muted mt-1">Based on: {q.claimIds.map((id) => claimById.get(id)).filter((c): c is Claim => !!c).map((c) => <a key={c.id} className="underline mr-2" href={`#${c.id}`}>{c.text.length > 70 ? c.text.slice(0, 67) + '...' : c.text}</a>)}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {data.isOwner && (result.status === 'complete' || result.status === 'partial') && <Outreach briefId={data.id} investor={data.investor.name} />}

      {data.isOwner && (result.status === 'complete' || result.status === 'partial') && <AfterMeeting briefId={data.id} name={data.investor.name} firm={data.investor.firm} />}

      <section className="mt-10" aria-labelledby="ver">
        <h2 id="ver" className="text-2xl font-semibold">How this was verified</h2>
        <div className="card mt-3 p-5">
          {result.stats.claimsExtracted === 0 ? <p>No claims could be extracted from public sources, so there was nothing to verify and nothing is shown.</p> : <p>
            {result.stats.claimsExtracted} candidate claims were extracted. <strong>{result.stats.claimsVerified} passed</strong> every check (an exact quote found in the source text, the source is about this investor, the date is inside the allowed window, and an independent fact-check agreed). {result.stats.claimsDropped} were left out.
          </p>}
          {result.status !== 'unverified' && result.notes.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-muted space-y-1">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          {excluded.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">What we left out and why ({excluded.length})</summary>
              <ul className="mt-2 space-y-2 text-sm">{excluded.map((c) => <li key={c.id}><span className="text-muted">{DROP_LABEL[c.dropReason ?? ''] ?? c.dropReason}:</span> {c.text}</li>)}</ul>
            </details>
          )}
        </div>
        <h3 className="mt-6 text-lg font-semibold">Sources</h3>
        <ol className="card mt-2 divide-y divide-line text-sm">
          {result.evidence.map((e, i) => (
            <li key={e.id} className="p-3 flex gap-3">
              <span className="text-muted w-5 shrink-0">{i + 1}.</span>
              <div className="min-w-0">
                {e.url.startsWith('http') ? <a className="font-medium underline break-words" href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a> : <span className="font-medium">{e.title}</span>}
                <p className="text-muted">{e.domain} · {tierLabel(e.tier)} · {e.publishedAt ? fmtDate(e.publishedAt) : 'date not found'} · {e.fullFetch ? 'read in full' : "Google's excerpt only"}</p>
              </div>
            </li>
          ))}
        </ol>
        {data.isOwner && <button className="no-print mt-4 text-sm text-muted underline hover:text-red" onClick={remove}>Delete this brief</button>}
        <p className="mt-4 text-xs text-muted">Cost to produce this brief: ${result.usage.costUsd.toFixed(3)} at list price across {result.usage.calls} Gemini calls and {result.usage.groundedQueries} searches. Public professional information only.</p>
      </section>
      {card && <MeetingCard result={result} startup={data.profile?.startup ?? 'your startup'} onClose={() => setCard(false)} />}
    </article>
  );
}

function tierLabel(t: number) { return t === 1 ? 'primary source' : t === 2 ? 'established press or database' : 'other source'; }

function Section(p: { id: string; title: string; sub: string; conf: Confidence; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mt-8" aria-labelledby={p.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={p.id} className="text-2xl font-semibold">{p.title}</h2>
        <span className={`chip ${CONF_STYLE[p.conf]}`}>{CONF_LABEL[p.conf]}</span>
      </div>
      <p className="text-sm text-muted">{p.sub}</p>
      <div className="card mt-3 divide-y divide-line">
        {p.count === 0 && <p className="p-5 text-muted">{p.empty}</p>}
        {p.children}
      </div>
    </section>
  );
}

function ClaimRow({ c, ev, briefId, canReport, muted }: { c: Claim; ev: Map<string, Evidence>; briefId: string; canReport: boolean; muted?: boolean }) {
  const [sent, setSent] = useState(false);
  const sources = c.evidenceIds.map((id) => ev.get(id)).filter((e): e is Evidence => !!e);
  const report = async (verdict: 'wrong' | 'outdated') => {
    await fetch(`/api/briefs/${briefId}/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimId: c.id, verdict }) });
    setSent(true);
  };
  const tone = c.severity === 'high' ? 'bg-red-soft text-red border-transparent' : c.severity === 'watch' ? 'bg-amber-soft text-amber border-transparent' : '';
  return (
    <div id={c.id} className={`p-4 sm:p-5 scroll-mt-20 ${muted ? 'opacity-80' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`chip ${tone}`}>{KIND_LABEL[c.kind] ?? c.kind}</span>
        <span className="text-muted">{claimDate(c)}</span>
        {c.judge === 'partial' && <span className="chip" title="The source supports the core fact but not every detail the model first wrote, so this wording was narrowed to what the source actually states">narrowed to the source</span>}
      </div>
      <p className="mt-1.5">{c.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {sources.map((s) => s.url.startsWith('http')
          ? <a key={s.id} className="inline-flex items-center gap-1 text-muted hover:text-ink underline" href={s.url} target="_blank" rel="noopener noreferrer"><span aria-hidden>{s.tier === 1 ? '●' : s.tier === 2 ? '◐' : '○'}</span>{s.domain}<span className="sr-only"> ({tierLabel(s.tier)})</span></a>
          : <span key={s.id} className="text-muted">your pasted text</span>)}
        <details className="inline">
          <summary className="cursor-pointer text-muted hover:text-ink">exact quote</summary>
          <p className="mt-1 text-xs text-muted border-l-2 border-line pl-2 italic">&ldquo;{c.quote}&rdquo;</p>
        </details>
        {canReport && !sent && (
          <span className="no-print ml-auto flex gap-2 text-xs">
            <button className="text-muted hover:text-red underline" onClick={() => report('wrong')}>Wrong?</button>
            <button className="text-muted hover:text-ink underline" onClick={() => report('outdated')}>Outdated?</button>
          </span>
        )}
        {sent && <span className="no-print ml-auto text-xs text-brand">Thanks, noted</span>}
      </div>
    </div>
  );
}

export function toPlainText(r: BriefResult, verified: Claim[], ev: Map<string, Evidence>): string {
  const L: string[] = [];
  L.push(`PRE-MEETING BRIEF: ${r.investor.name}, ${r.investor.firm}`, `Generated ${fmtDateTime(r.asOf)}. Deals window ${fmtDate(r.windowStart)} to ${fmtDate(r.windowEnd)}.`, '');
  if (r.synthesis) {
    L.push('IN 20 SECONDS', ...r.synthesis.skim.map((s) => `- ${s}`), '', 'TALKING POINTS');
    r.synthesis.talkingPoints.forEach((t, i) => L.push(`${i + 1}. ${t.title}`, `   ${t.angle}`, `   Say: "${t.opener}"`));
    L.push('');
    if ((r.synthesis.questionsToAsk ?? []).length) L.push('QUESTIONS TO ASK THEM', ...r.synthesis.questionsToAsk.map((q) => `- ${q.question}`), '');
  }
  const sec = (title: string, s: Section) => {
    const rows = verified.filter((c) => c.section === s);
    L.push(title.toUpperCase());
    if (!rows.length) L.push('- Nothing found in public sources.');
    rows.forEach((c) => L.push(`- [${c.eventDate ?? 'undated'}] ${c.text} (${c.evidenceIds.map((id) => ev.get(id)?.domain).filter(Boolean).join(', ')})`));
    L.push('');
  };
  sec('Recent portfolio activity (last 90 days)', 'deals'); sec('Stated thesis', 'thesis'); sec('Watch-outs and context', 'context'); sec('Firm snapshot', 'firm');
  L.push('Every claim above was quoted from a public source and checked before inclusion.');
  return L.join('\n');
}
