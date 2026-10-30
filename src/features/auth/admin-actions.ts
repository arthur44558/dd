'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/require-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { UserRole } from '@/types/auth';

export interface ActionResponse {
  success: boolean;
  error?: string;
}

/**
 * Approves a pending account request, creates an Auth user invite via Admin API,
 * maps the profile record in 'invited' state, and assigns department membership.
 */
export async function approveAccountRequest(
  requestId: string,
  finalRole: UserRole,
  departmentId?: string | null
): Promise<ActionResponse> {
  try {
    // 1. Authorize IT Admin actor
    const adminActor = await requireUser(['it_admin']);

    // 2. Fetch target request in pending state (concurrency check)
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('account_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: 'Account request not found' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: `Request has already been ${request.status}` };
    }

    // 3. Invite user via Supabase Auth Admin API
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(request.email, {
        redirectTo: `${appUrl}/invite/accept`,
        data: {
          full_name: request.full_name,
          role: finalRole,
        },
      });

    if (inviteError || !inviteData.user) {
      return {
        success: false,
        error: `Auth Admin invitation failed: ${inviteError?.message || 'Unknown error'}`,
      };
    }

    const authUserId = inviteData.user.id;

    // 4. Create or update profile record with 'invited' status
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: authUserId,
        email: request.email,
        full_name: request.full_name,
        role: finalRole,
        department_id: departmentId || null,
        status: 'invited',
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      return {
        success: false,
        error: `Profile mapping failed: ${profileError.message}`,
      };
    }

    // 5. Add department membership if clinical role
    if (departmentId) {
      await supabaseAdmin.from('department_memberships').upsert(
        {
          profile_id: authUserId,
          department_id: departmentId,
          role: finalRole,
          is_primary: true,
          is_active: true,
        },
        { onConflict: 'profile_id,department_id' }
      );
    }

    // 6. Update account request status to approved
    const { error: updateError } = await supabaseAdmin
      .from('account_requests')
      .update({
        status: 'approved',
        reviewed_by: adminActor.id,
        reviewed_at: new Date().toISOString(),
        auth_user_id: authUserId,
      })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (updateError) {
      return { success: false, error: 'Failed to update request status' };
    }

    // 7. Record approval event
    await supabaseAdmin.from('account_request_events').insert({
      request_id: requestId,
      actor_id: adminActor.id,
      event_type: 'approved',
      notes: `Approved by IT Admin. Final role: ${finalRole}. Invite sent.`,
      metadata: { finalRole, departmentId, authUserId },
    });

    revalidatePath('/it-admin');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { success: false, error: message };
  }
}

/**
 * Rejects an account request with a mandatory reason.
 */
export async function rejectAccountRequest(
  requestId: string,
  reason: string
): Promise<ActionResponse> {
  try {
    const adminActor = await requireUser(['it_admin']);

    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'A rejection reason of at least 5 characters is required' };
    }

    const { error: updateError } = await supabaseAdmin
      .from('account_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason.trim(),
        reviewed_by: adminActor.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (updateError) {
      return { success: false, error: 'Failed to reject request' };
    }

    await supabaseAdmin.from('account_request_events').insert({
      request_id: requestId,
      actor_id: adminActor.id,
      event_type: 'rejected',
      notes: reason.trim(),
    });

    revalidatePath('/it-admin');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { success: false, error: message };
  }
}

/**
 * Deactivates an active user profile and revokes login access.
 */
export async function deactivateUserProfile(userId: string): Promise<ActionResponse> {
  try {
    await requireUser(['it_admin']);

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'deactivated' })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: 'Failed to deactivate profile' };
    }

    // Ban user in Supabase Auth
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876600h', // 100 years
    });

    revalidatePath('/it-admin');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { success: false, error: message };
  }
}
