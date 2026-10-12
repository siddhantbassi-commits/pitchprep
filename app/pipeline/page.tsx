import PipelineBoard from '@/components/PipelineBoard';
import WarmPaths from '@/components/WarmPaths';
import { currentWorkspace, listPipeline } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pipeline: PitchPrep' };

export default async function Pipeline() {
  const ws = await currentWorkspace();
  const items = await listPipeline(ws);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Investor pipeline</h1>
      <p className="text-muted mb-6">Every investor you have researched, ranked by fit with your startup. Track where each one stands, what happens next, and what was said.</p>
      <PipelineBoard initial={items} />
      <div className="mt-10"><WarmPaths targets={items.map((i) => ({ name: i.name, firm: i.firm, briefId: i.briefId }))} /></div>
    </div>
  );
}
