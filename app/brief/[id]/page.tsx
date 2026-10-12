import { notFound } from 'next/navigation';
import BriefView, { type BriefData } from '@/components/BriefView';
import { currentWorkspace, getBrief } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getBrief(id, await currentWorkspace().catch(() => null), null);
  return { title: row ? `${row.investor_name} · ${row.firm}: PitchPrep` : 'Brief: PitchPrep' };
}

export default async function BriefPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  const ws = await currentWorkspace().catch(() => null);
  const row = await getBrief(id, ws, t ?? null);
  if (!row) notFound();
  const initial: BriefData = {
    id: row.id, status: row.status, stages: row.stages ?? [], result: row.result, error: row.error,
    investor: { name: row.investor_name, firm: row.firm }, createdAt: row.created_at,
    isOwner: !!ws && ws === row.workspace_id, isSeed: row.is_seed, profile: row.profile_snapshot, meetingAt: row.meeting_at,
  };
  return <BriefView initial={initial} token={t ?? null} />;
}
