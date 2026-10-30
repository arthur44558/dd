import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile, UserRole } from '@/types/auth';

export interface AuthorizedActor {
  id: string;
  email: string;
  profile: UserProfile;
}

export async function requireUser(allowedRoles?: UserRole[]): Promise<AuthorizedActor> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    redirect('/login');
  }

  // Load user profile from database
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // Fail closed: Profile missing
    redirect('/login?error=profile_not_found');
  }

  // Enforce account status check
  if (profile.status !== 'active') {
    redirect(`/login?error=account_${profile.status}`);
  }

  // Enforce role authorization if specified
  if (allowedRoles && !allowedRoles.includes(profile.role as UserRole)) {
    redirect('/login?error=unauthorized_role');
  }

  return {
    id: user.id,
    email: user.email,
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      departmentId: profile.department_id,
      status: profile.status,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    },
  };
}
