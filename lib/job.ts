import { logEvent } from './db';
import { runPipeline } from './pipeline';
import { failBrief, saveResult, setStages } from './store';
import type { FounderProfile } from './types';

/** Runs one brief to completion in the background and persists progress and result. */
export async function runBriefJob(id: string, a: { name: string; firm: string; profile: FounderProfile; userContext?: string | null }) {
  const started = Date.now();
  try {
    let last = '';
    const result = await runPipeline(
      { name: a.name, firm: a.firm, profile: a.profile, userContext: a.userContext ?? undefined },
      {
        onStages: async (s) => {
          const sig = s.map((x) => x.status + (x.detail ?? '')).join('|');
          if (sig !== last) { last = sig; await setStages(id, s); }
        },
      },
    );
    await saveResult(id, result);
    await logEvent('job', 'brief_done', id, { status: result.status, ms: result.stats.latencyMs, cost: result.usage.costUsd });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    await failBrief(id, msg);
    await logEvent('job', 'brief_failed', id, { error: msg, ms: Date.now() - started });
  }
}
