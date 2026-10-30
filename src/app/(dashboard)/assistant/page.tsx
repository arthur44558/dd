import { requireUser } from '@/lib/auth/require-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';
import AssistantClient from './assistant-client';

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const actor = await requireUser(['assistant', 'it_admin']);

  // Fetch doctors in department or all active doctors
  const { data: doctors } = await supabaseAdmin
    .from('doctor_profiles')
    .select('id, doctor_id, medical_license_number, speciality, profiles!inner(id, full_name, email, department_id)')
    .eq('is_active', true);

  // Fetch follow-ups in the department
  let followUpsQuery = supabaseAdmin
    .from('follow_ups')
    .select(`
      id,
      patient_id,
      doctor_id,
      department_id,
      appointment_date,
      follow_up_required,
      severity,
      status,
      current_version,
      notes,
      created_at,
      patients (
        id,
        mrn,
        full_name,
        dob,
        primary_phone
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
      title="Doctor's Assistant Workspace"
      subtitle="Clinical intake digitisation, document scans, and pending doctor review queue."
    >
      <AssistantClient
        initialFollowUps={(followUps as any) || []}
        doctors={(doctors as any) || []}
        userDepartmentId={actor.profile.departmentId || ''}
      />
    </AuthenticatedShell>
  );
}
