import ProfileForm from '@/components/ProfileForm';
import { currentWorkspace, getProfile } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My startup: PitchPrep' };

export default async function Settings() {
  const ws = await currentWorkspace();
  const profile = await getProfile(ws);
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold">My startup</h1>
      <p className="text-muted mb-6">The talking points in every brief are tailored to this. It starts with a sample founder so you can try the tool straight away; replace it with your own details.</p>
      <ProfileForm initial={profile} />
    </div>
  );
}
