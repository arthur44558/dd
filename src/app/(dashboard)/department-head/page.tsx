import { requireUser } from '@/lib/auth/require-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPendingCorrectionRequests } from '@/features/approvals/actions';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';
import DepartmentHeadClient from './department-head-client';

export const dynamic = 'force-dynamic';

export default async function DepartmentHeadPage() {
  const actor = await requireUser(['department_head', 'it_admin']);

  // Fetch pending correction requests
  const { requests: pendingRequests } = await getPendingCorrectionRequests(
    actor.profile.departmentId || undefined
  );

  // Fetch department follow-ups
  let followUpsQuery = supabaseAdmin
    .from('follow_ups')
    .select(`
      id,
      patient_id,
      doctor_id,
      department_id,
      appointment_date,
      severity,
      status,
      current_version,
      notes,
      created_at,
      patients (
        id,
        mrn,
        full_name,
        dob
      ),
      departments (
        id,
        name,
        code
      )
    `)
    .order('created_at', { ascending: false });

  if (actor.profile.departmentId) {
    followUpsQuery = followUpsQuery.eq('department_id', actor.profile.departmentId);
  }

  const { data: followUps } = await followUpsQuery;

  // Fetch department team members (doctors and assistants)
  let membersQuery = supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, status, department_id')
    .in('role', ['doctor', 'assistant'])
    .eq('status', 'active');

  if (actor.profile.departmentId) {
    membersQuery = membersQuery.eq('department_id', actor.profile.departmentId);
  }

  const { data: teamMembers } = await membersQuery;

  // Department name
  let departmentName = null;
  if (actor.profile.departmentId) {
    const { data: dept } = await supabaseAdmin
      .from('departments')
      .select('name')
      .eq('id', actor.profile.departmentId)
      .single();
    departmentName = dept?.name || null;
  }

  return (
    <AuthenticatedShell
      user={{
        id: actor.id,
        email: actor.email,
        fullName: actor.profile.fullName,
        role: actor.profile.role,
        departmentName,
      }}
      title="Department Head Workspace"
      subtitle="Clinical governance, side-by-side correction approvals, and department team oversight."
    >
      <DepartmentHeadClient
        initialRequests={pendingRequests || []}
        initialFollowUps={(followUps as any) || []}
        teamMembers={teamMembers || []}
      />
    </AuthenticatedShell>
  );
}
