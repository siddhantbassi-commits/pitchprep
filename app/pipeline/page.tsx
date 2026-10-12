import PipelineBoard from '@/components/PipelineBoard';
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
    </div>
  );
}
