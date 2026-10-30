import { requireUser } from '@/lib/auth/require-user';
import { getMyTasks } from '@/features/coordinator/actions';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';
import CoordinatorClient from './coordinator-client';

export const dynamic = 'force-dynamic';

export default async function CoordinatorPage() {
  const actor = await requireUser(['coordinator', 'it_admin']);

  const { tasks } = await getMyTasks('all');

  return (
    <AuthenticatedShell
      user={{
        id: actor.id,
        email: actor.email,
        fullName: actor.profile.fullName,
        role: actor.profile.role,
        departmentName: 'Central Follow-up Pool',
      }}
      title="Follow-up Coordinator Workspace"
      subtitle="Assigned patient communication tasks, overdue follow-ups, and simulated outreach logging."
    >
      <CoordinatorClient initialTasks={tasks || []} />
    </AuthenticatedShell>
  );
}
