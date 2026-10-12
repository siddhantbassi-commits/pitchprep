import UnsubscribeButton from '@/components/UnsubscribeButton';

export const metadata = { title: 'Unsubscribe: PitchPrep', robots: { index: false } };

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl font-semibold">Unsubscribe from PitchPrep emails</h1>
      <p className="mt-2 text-muted">You will stop receiving meeting nudges immediately. Your briefs and notes are not affected, and you can switch emails back on any time from the Meetings page.</p>
      <UnsubscribeButton token={t ?? ''} />
    </div>
  );
}
