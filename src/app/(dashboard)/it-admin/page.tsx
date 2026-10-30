import { requireUser } from '@/lib/auth/require-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';
import ITAdminClient from './it-admin-client';

export const dynamic = 'force-dynamic';

export default async function ITAdminPage() {
  const actor = await requireUser(['it_admin']);

  // Fetch all requests
  const { data: requests } = await supabaseAdmin
    .from('account_requests')
    .select('*, departments(name, code)')
    .order('created_at', { ascending: false });

  // Fetch all profiles
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('*, departments(name, code)')
    .order('created_at', { ascending: false });

  // Fetch active clinical departments
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name');

  return (
    <AuthenticatedShell
      user={{
        id: actor.id,
        email: actor.email,
        fullName: actor.profile.fullName,
        role: actor.profile.role,
      }}
      title="IT Administration Console"
      subtitle="Identity lifecycle, operational access requests, and account governance."
    >
      <ITAdminClient
        initialRequests={requests || []}
        initialProfiles={profiles || []}
        departments={departments || []}
        currentUserId={actor.id}
      />
    </AuthenticatedShell>
  );
}
