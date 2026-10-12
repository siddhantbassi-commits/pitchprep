// The whole brief, end to end, with no database dependency. Persistence wraps this (lib/store.ts).

import { z } from 'zod';
import { Meter, grounded, structured, type GroundedResult } from './gemini';
import { buildEvidence } from './sources';
import { gate, sectionConfidence } from './verify';
import { COLLECTORS, EXTRACT_SYSTEM, JUDGE_SYSTEM, collectorPrompt, extractPrompt, synthesisPrompt, synthesisSystem } from './prompts';
import { addDays, isoDay } from './text';
import { Extraction, SECTIONS, Synthesis, type BriefResult, type Claim, type FounderProfile, type Section, type StageState } from './types';

export interface RunInput {
  name: string;
  firm: string;
  profile: FounderProfile;
  userContext?: string;
  now?: Date;
}

export interface Hooks {
  onStages?: (s: StageState[]) => void | Promise<void>;
}

const HARD_DEADLINE_MS = 115_000;

const STAGE_DEFS: { key: string; label: string }[] = [
  { key: 'collect', label: 'Searching the live web (portfolio, thesis, context, firm)' },
  { key: 'sources', label: 'Opening and reading the sources' },
  { key: 'extract', label: 'Extracting claims with exact quotes' },
  { key: 'verify', label: 'Verifying every claim against its source' },
  { key: 'synthesize', label: "Writing your talking points" },
];

const Judgement = z.object({
  verdicts: z.array(z.object({ id: z.string(), verdict: z.enum(['supported', 'partial', 'unsupported']), rewrite: z.string().nullable() })),
});

export async function runPipeline(input: RunInput, hooks: Hooks = {}): Promise<BriefResult> {
  const t0 = Date.now();
  const now = input.now ?? new Date();
  const today = isoDay(now);
  const windowStart = addDays(today, -90);
  const left = () => HARD_DEADLINE_MS - (Date.now() - t0);
  const meter = new Meter();
  const notes: string[] = [];
  const name = input.name.trim();
  const firm = input.firm.trim();

  const stages: StageState[] = STAGE_DEFS.map((s) => ({ ...s, status: 'pending' }));
  const emit = async () => { try { await hooks.onStages?.(structuredClone(stages)); } catch { /* progress is best effort */ } };
  const begin = async (key: string, detail?: string) => {
    const s = stages.find((x) => x.key === key)!;
    s.status = 'running'; s.startedAt = new Date().toISOString(); if (detail) s.detail = detail;
    await emit();
  };
  const end = async (key: string, status: StageState['status'] = 'done', detail?: string) => {
    const s = stages.find((x) => x.key === key)!;
    s.status = status; s.endedAt = new Date().toISOString(); if (detail) s.detail = detail;
    await emit();
  };

  const nameParts = name.split(/\s+/);
  const terms = [name, nameParts[nameParts.length - 1], firm.replace(/\b(partners|capital|ventures|fund)\b/gi, '').trim()].filter((t) => t.length >= 3);

  // ---- 1. Collect: four grounded research calls in parallel -------------------------------------------------
  await begin('collect');
  const settled = await Promise.allSettled(
    COLLECTORS.map(async ({ key, section }) => ({
      section,
      g: await grounded(collectorPrompt(key, { name, firm, today, windowStart }), meter, Math.min(50_000, left() - 40_000)),
    })),
  );
  const results: { section: Section; g: GroundedResult }[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') results.push(r.value);
    else notes.push(`The ${COLLECTORS[i].key.replace('_', ' ')} search did not complete (${String(r.reason?.message ?? r.reason).slice(0, 80)}), so that section may be thin.`);
  });
  const queryCount = results.reduce((n, r) => n + r.g.queries.length, 0);
  if (!results.length) {
    await end('collect', 'failed', 'All searches failed');
    throw new Error('Live search is unavailable right now. Please try again in a minute.');
  }
  await end('collect', 'done', `${queryCount} searches run`);

  // ---- 2. Sources: resolve, fetch, date ----------------------------------------------------------------------
  await begin('sources');
  const built = await buildEvidence({ results, firm, terms, userContext: input.userContext });
  const { evidence, firmDomain } = built;
  notes.push(...built.notes);
  await end('sources', 'done', `${evidence.length} sources, ${evidence.filter((e) => e.fullFetch).length} read in full`);

  if (!evidence.length) {
    stages.filter((s) => s.status === 'pending').forEach((s) => (s.status = 'skipped'));
    await emit();
    return finish('unverified', null, [], evidence, null, [...notes, 'No usable public sources were found for this name and firm.']);
  }

  // ---- 3. Extract ---------------------------------------------------------------------------------------------
  await begin('extract');
  let extraction: Extraction;
  try {
    extraction = await structured(Extraction, EXTRACT_SYSTEM, extractPrompt({ name, firm, today, windowStart, evidence }), meter, Math.min(40_000, left() - 15_000));
  } catch (e) {
    await end('extract', 'failed', String((e as Error).message).slice(0, 100));
    stages.filter((s) => s.status === 'pending').forEach((s) => (s.status = 'skipped'));
    await emit();
    return finish('partial', null, [], evidence, null, [...notes, 'Claim extraction did not complete in time, so no claims are shown. The sources found are listed below.']);
  }
  await end('extract', 'done', `${extraction.claims.length} candidate claims`);

  // ---- 4. Verify ----------------------------------------------------------------------------------------------
  await begin('verify');
  const g = gate({ claims: extraction.claims, evidence, name, firm, today });
  let claims = g.claims;
  const survivors = claims.filter((c) => c.verified);
  if (survivors.length && left() > 12_000) {
    try {
      const j = await structured(
        Judgement,
        JUDGE_SYSTEM,
        survivors.map((c) => `id=${c.id}\nclaim: ${c.text}\nquote: ${c.quote}`).join('\n\n'),
        meter,
        Math.min(20_000, left() - 8_000),
      );
      const v = new Map(j.verdicts.map((x) => [x.id, x]));
      claims = claims.map((c) => {
        if (!c.verified) return c;
        const j1 = v.get(c.id);
        const verdict = j1?.verdict ?? 'partial';
        if (verdict === 'unsupported') return { ...c, verified: false, dropReason: 'judge_unsupported', judge: verdict };
        // Partly supported: show only what the quote itself states, never the model's embellishment.
        if (verdict === 'partial') {
          const narrowed = j1?.rewrite?.trim();
          if (!narrowed || narrowed.length < 15) return { ...c, verified: false, dropReason: 'judge_unsupported', judge: verdict };
          return { ...c, text: narrowed.slice(0, 260), judge: verdict };
        }
        return { ...c, judge: verdict };
      });
    } catch {
      notes.push('The semantic fact-check did not complete; claims shown passed the quote, date and source checks only.');
    }
  }
  if (g.olderDealsOmitted) notes.push(`${g.olderDealsOmitted} older deal${g.olderDealsOmitted > 1 ? 's' : ''} found outside the 90-day window and left out.`);
  const verified = claims.filter((c) => c.verified);
  await end('verify', 'done', `${verified.length} of ${claims.length} claims verified`);

  if (!extraction.identity.found || !verified.length) {
    stages.filter((s) => s.status === 'pending').forEach((s) => (s.status = 'skipped'));
    await emit();
    return finish('unverified', extraction, claims, evidence, null, [
      ...notes,
      !extraction.identity.found
        ? `We could not confirm that ${name} is associated with ${firm} from public sources. Check the spelling of the name and firm.`
        : 'No claim survived verification, so nothing is shown rather than risk an unsupported statement.',
    ]);
  }

  // ---- 5. Synthesise ------------------------------------------------------------------------------------------
  await begin('synthesize');
  let synthesis: Synthesis | null = null;
  const validIds = new Set(verified.map((c) => c.id));
  for (let attempt = 0; attempt < 2 && !synthesis && left() > 10_000; attempt++) {
    try {
      const s = await structured(Synthesis, synthesisSystem(), synthesisPrompt(input.profile, verified), meter, Math.min(30_000, left() - 3_000));
      s.talkingPoints = s.talkingPoints
        .map((t) => ({ ...t, claimIds: t.claimIds.filter((id) => validIds.has(id)) }))
        .filter((t) => t.claimIds.length > 0)
        .slice(0, 3);
      s.fit.claimIds = s.fit.claimIds.filter((id) => validIds.has(id));
      s.questionsToAsk = (s.questionsToAsk ?? []).map((q) => ({ ...q, claimIds: q.claimIds.filter((id) => validIds.has(id)) })).slice(0, 3);
      if (s.talkingPoints.length === 3 && s.skim.length >= 1) synthesis = { ...s, skim: s.skim.slice(0, 3) };
    } catch { /* retry once */ }
  }
  if (!synthesis) notes.push('Talking points could not be generated within the time limit. The verified research above is complete.');
  await end('synthesize', synthesis ? 'done' : 'failed');

  return finish(synthesis ? 'complete' : 'partial', extraction, claims, evidence, synthesis, notes);

  function finish(status: BriefResult['status'], ex: Extraction | null, cl: Claim[], ev: typeof evidence, syn: Synthesis | null, n: string[]): BriefResult {
    const ok = cl.filter((c) => c.verified);
    const usedIds = new Set(cl.flatMap((c) => c.evidenceIds));
    const shownEvidence = ev.filter((e) => usedIds.has(e.id) || status !== 'complete');
    return {
      status,
      investor: { name, firm, role: ex?.identity.role ?? null, firmDomain: ex?.identity.firmDomain ?? firmDomain, ambiguity: ex?.identity.ambiguity ?? null },
      asOf: new Date().toISOString(),
      windowStart,
      windowEnd: today,
      claims: cl,
      evidence: shownEvidence,
      sectionConfidence: sectionConfidence(cl, ev),
      synthesis: syn,
      notes: n,
      stats: {
        claimsExtracted: cl.length,
        claimsVerified: ok.length,
        claimsDropped: cl.length - ok.length,
        sources: ev.length,
        fullTextSources: ev.filter((e) => e.fullFetch).length,
        latencyMs: Date.now() - t0,
      },
      usage: meter.u,
    };
  }
}
