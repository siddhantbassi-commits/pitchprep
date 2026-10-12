import RaiseCockpit from '@/components/RaiseCockpit';
import ReadinessCard from '@/components/ReadinessCard';
import PracticeProgress from '@/components/PracticeProgress';
import { db } from '@/lib/db';
import type { SessionLite } from '@/lib/progress';
import { getPlan, listCommitments } from '@/lib/raiseStore';
import { currentWorkspace, getProfile, listPipeline } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Raise: PitchPrep' };

export default async function Raise() {
  const ws = await currentWorkspace();
  const [plan, commitments, pipeline, profile, sessions] = await Promise.all([getPlan(ws), listCommitments(ws), listPipeline(ws), getProfile(ws), db().from('mock_sessions').select('id,created_at,difficulty,overall,investor_name,firm,score').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(40).then((r) => (r.data ?? []) as SessionLite[])]);
  return (
    <div>
      <p className="label">Raise</p>
      <h1 className="mt-1 text-3xl font-semibold">Your round, in one place</h1>
      <p className="text-muted mb-6">Set the round, put each investor&apos;s amount against their stage, and see how full it is, what it costs you in ownership, and what to fix. Pure arithmetic on your own numbers; nothing here is a prediction.</p>
      <RaiseCockpit initialPlan={plan} initialCommitments={commitments} pipeline={pipeline.map((p) => ({ key: p.key, name: p.name, firm: p.firm, stage: p.status, fit: p.fit, briefId: p.briefId }))} startup={profile.startup} raiseNote={profile.raise} />
      <div className="mt-8"><ReadinessCard profile={profile} /></div>
      <div className="mt-8">
        {sessions.length > 0 ? <PracticeProgress sessions={sessions} /> : (
          <section className="card p-5 sm:p-6"><h2 className="text-xl font-semibold">Your practice progress</h2><p className="mt-1 text-sm text-muted">Open any brief and start a mock meeting. Each round is scored and saved here, so you can see whether practice is working and which skill to work on next.</p></section>
        )}
      </div>
    </div>
  );
}
