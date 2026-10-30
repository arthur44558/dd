import { requireUser } from '@/lib/auth/require-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';
import DoctorClient from './doctor-client';

export const dynamic = 'force-dynamic';

export default async function DoctorPage() {
  const actor = await requireUser(['doctor', 'it_admin']);

  // Fetch doctor profile
  const { data: doctorProfile } = await supabaseAdmin
    .from('doctor_profiles')
    .select('id, doctor_id, speciality, profile_id')
    .eq('profile_id', actor.id)
    .maybeSingle();

  // Fetch follow-ups assigned to this doctor
  let query = supabaseAdmin
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

  if (doctorProfile?.id) {
    query = query.eq('doctor_id', doctorProfile.id);
  }

  const { data: followUps } = await query;

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
        departmentName: departmentName || doctorProfile?.speciality || null,
      }}
      title="Attending Clinician Workspace"
      subtitle="Patient consultations, intake verification sign-offs, and version correction proposals."
    >
      <DoctorClient
        initialFollowUps={(followUps as any) || []}
        doctorProfileId={doctorProfile?.id || ''}
      />
    </AuthenticatedShell>
  );
}
