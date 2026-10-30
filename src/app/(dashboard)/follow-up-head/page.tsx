import { requireUser } from '@/lib/auth/require-user';
import { getFollowUpHeadAnalytics } from '@/features/analytics/actions';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';
import FollowUpHeadClient from './follow-up-head-client';

export const dynamic = 'force-dynamic';

export default async function FollowUpHeadPage() {
  const actor = await requireUser(['follow_up_head', 'it_admin']);

  const analyticsData = await getFollowUpHeadAnalytics();

  return (
    <AuthenticatedShell
      user={{
        id: actor.id,
        email: actor.email,
        fullName: actor.profile.fullName,
        role: actor.profile.role,
        departmentName: 'Central Coordinator Operations',
      }}
      title="Follow-up Head Operations Dashboard"
      subtitle="Hospital-wide continuity metrics, coordinator pool allocation, and overdue rates."
    >
      <FollowUpHeadClient initialData={analyticsData} />
    </AuthenticatedShell>
  );
}
