// Generates real example briefs (live data) into a shared "examples" workspace. Usage: npm run seed
import { db, must } from '../lib/db';
import { runPipeline } from '../lib/pipeline';
import { DEMO_PROFILE } from '../lib/demoProfile';
import { investorKey } from '../lib/store';
import { overallConfidence } from '../lib/verify';

const SEED_WS = '00000000-0000-4000-8000-000000000001';
const INVESTORS = [
  ['Kirsten Green', 'Forerunner Ventures'],
  ['Rajan Anandan', 'Peak XV Partners'],
  ['Garry Tan', 'Y Combinator'],
  ['Kunal Bahl', 'Titan Capital'],
  ['Alexis Ohanian', 'Seven Seven Six'],
  ['Vani Kola', 'Kalaari Capital'],
];
const only = process.argv.slice(2);

must(await db().from('workspaces').upsert({ id: SEED_WS }, { onConflict: 'id' }), 'seed workspace');
must(await db().from('founder_profiles').upsert({ workspace_id: SEED_WS, profile: DEMO_PROFILE }), 'seed profile');

async function one([name, firm]: string[]) {
  const t = Date.now();
  const r = await runPipeline({ name, firm, profile: DEMO_PROFILE });
  const id = must(
    await db().from('briefs').insert({
      workspace_id: SEED_WS, investor_name: name, firm, investor_key: investorKey(name, firm), status: r.status, result: r,
      profile_snapshot: DEMO_PROFILE, is_seed: true, latency_ms: r.stats.latencyMs, cost_usd: r.usage.costUsd, tokens_in: r.usage.promptTokens,
      tokens_out: r.usage.outputTokens + r.usage.thoughtTokens, grounded_queries: r.usage.groundedQueries, claims_verified: r.stats.claimsVerified,
      claims_dropped: r.stats.claimsDropped, sources: r.stats.sources, confidence: overallConfidence(r), completed_at: new Date().toISOString(),
    }).select('id').single(),
    'insert seed',
  )!.id as string;
  if (r.claims.length) await db().from('claims').insert(r.claims.map((c) => ({ brief_id: id, claim_id: c.id, section: c.section, kind: c.kind, text: c.text, event_date: c.eventDate, verified: c.verified, drop_reason: c.dropReason, judge: c.judge, evidence_ids: c.evidenceIds, quote: c.quote, severity: c.severity })));
  if (r.evidence.length) await db().from('evidence').insert(r.evidence.map((e) => ({ brief_id: id, evidence_id: e.id, url: e.url, domain: e.domain, title: e.title, published_at: e.publishedAt, tier: e.tier, full_fetch: e.fullFetch, origin: e.origin })));
  console.log(`${name} (${firm}): ${r.status}, ${r.stats.claimsVerified} verified, ${(r.stats.latencyMs / 1000).toFixed(0)}s -> ${id} [${((Date.now() - t) / 1000).toFixed(0)}s wall]`);
}

// Remove earlier seeds for the investors being regenerated so the list stays clean.
const todo = INVESTORS.filter(([n]) => !only.length || only.includes(n));
for (const [n, f] of todo) await db().from('briefs').delete().eq('workspace_id', SEED_WS).eq('investor_key', investorKey(n, f));
// two at a time keeps us well inside Gemini rate limits
for (let i = 0; i < todo.length; i += 2) await Promise.all(todo.slice(i, i + 2).map(one));
console.log('seed done');
