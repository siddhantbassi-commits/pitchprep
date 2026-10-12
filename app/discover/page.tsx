import DiscoverPanel from '@/components/DiscoverPanel';
import { latestDiscovery } from '@/lib/discoverStore';
import { currentWorkspace, getProfile } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Discover: PitchPrep' };

export default async function Discover() {
  const ws = await currentWorkspace();
  const [profile, latest] = await Promise.all([getProfile(ws), latestDiscovery(ws)]);
  return (
    <div>
      <p className="label">Discover</p>
      <h1 className="mt-1 text-3xl font-semibold">Who should I pitch?</h1>
      <p className="text-muted mb-6 max-w-3xl">Finds investors who recently wrote cheques to startups like yours, with the deal, the date and the exact sentence behind each. It does not say who would invest in you. It shows who is active near you, so your first twenty emails go to the right inboxes.</p>
      <DiscoverPanel profile={{ startup: profile.startup, oneLiner: profile.oneLiner, sector: profile.sector, stage: profile.stage, geography: profile.geography, raise: profile.raise }} initial={latest} />
    </div>
  );
}
