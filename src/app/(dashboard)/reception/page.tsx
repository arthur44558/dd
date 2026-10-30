import { requireUser } from '@/lib/auth/require-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';
import ReceptionClient from './reception-client';

export const dynamic = 'force-dynamic';

export default async function ReceptionPage() {
  const actor = await requireUser(['reception', 'it_admin']);

  // Strictly non-clinical fields only: MRN, Name, DOB, Gender, Phone, Registration timestamp
  const { data: recentPatients } = await supabaseAdmin
    .from('patients')
    .select('id, mrn, full_name, dob, gender, primary_phone, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <AuthenticatedShell
      user={{
        id: actor.id,
        email: actor.email,
        fullName: actor.profile.fullName,
        role: actor.profile.role,
        departmentName: actor.profile.departmentId ? 'Central Reception' : null,
      }}
      title="Reception Workspace"
      subtitle="Patient registration, arrival check-in, and identity deduplication."
    >
      <ReceptionClient initialRecentPatients={recentPatients || []} />
    </AuthenticatedShell>
  );
}
