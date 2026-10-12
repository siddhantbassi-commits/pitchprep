import BriefHistory from '@/components/BriefHistory';
import { currentWorkspace, listBriefs } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'History: PitchPrep' };

export default async function History() {
  const ws = await currentWorkspace();
  const rows = await listBriefs(ws, 100);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Your briefs</h1>
      <p className="text-muted mb-4">Saved in this browser. Delete everything any time from My startup.</p>
      <BriefHistory rows={rows} />
    </div>
  );
}
