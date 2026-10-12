import MeetingsPanel from '@/components/MeetingsPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meetings: PitchPrep' };

export default function Meetings() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Meetings</h1>
      <p className="text-muted mb-6">Connect your calendar once. PitchPrep spots investor meetings and has the brief ready before you walk in.</p>
      <MeetingsPanel />
    </div>
  );
}
