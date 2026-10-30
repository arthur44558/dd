'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateSecureToken, hashToken } from '@/lib/security/tokens';
import { AccessRequestSchema, type AccessRequestInput } from './schemas';

export interface SubmitRequestResult {
  success: boolean;
  trackingToken?: string;
  error?: string;
}

export async function submitAccessRequest(
  data: AccessRequestInput
): Promise<SubmitRequestResult> {
  const parsed = AccessRequestSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid form input' };
  }

  const payload = parsed.data;
  const normalizedEmail = payload.email.toLowerCase();

  try {
    // Check if there is already a pending request for this email
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('account_requests')
      .select('id, status')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (checkError) {
      return { success: false, error: 'Database error checking existing requests' };
    }

    if (existing) {
      return {
        success: false,
        error: 'A pending access request already exists for this email address.',
      };
    }

    const { rawToken, tokenHash } = generateSecureToken();

    // Insert into account_requests
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('account_requests')
      .insert({
        full_name: payload.fullName,
        email: normalizedEmail,
        phone: payload.phone,
        employee_id: payload.employeeId || null,
        requested_role: payload.requestedRole,
        department_id: payload.departmentId || null,
        justification: payload.justification,
        status: 'pending',
        status_token_hash: tokenHash,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      return {
        success: false,
        error: insertError?.message || 'Failed to record access request. Please try again later.',
      };
    }

    // Insert submission event
    await supabaseAdmin.from('account_request_events').insert({
      request_id: inserted.id,
      event_type: 'submitted',
      notes: 'Access request submitted by prospective staff member',
    });

    return {
      success: true,
      trackingToken: rawToken,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { success: false, error: message };
  }
}

export interface RequestStatusResult {
  found: boolean;
  data?: {
    requestId: string;
    requestedRole: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    rejectionReason: string | null;
  };
  error?: string;
}

export async function getRequestStatusByToken(
  rawToken: string
): Promise<RequestStatusResult> {
  if (!rawToken || rawToken.trim().length !== 64) {
    return {
      found: false,
      error: 'Invalid token format. A 64-character hex token is required.',
    };
  }

  const tokenHash = hashToken(rawToken);

  try {
    // Call the SECURITY DEFINER RPC
    const { data, error } = await supabaseAdmin.rpc('check_request_status', {
      p_token_hash: tokenHash,
    });

    if (error || !data || data.length === 0) {
      return { found: false, error: 'No matching request found for this tracking token.' };
    }

    const item = data[0];
    return {
      found: true,
      data: {
        requestId: item.request_id,
        requestedRole: item.requested_role,
        status: item.status,
        createdAt: item.created_at,
        reviewedAt: item.reviewed_at,
        rejectionReason: item.rejection_reason,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { found: false, error: message };
  }
}

export interface PublicDepartment {
  id: string;
  name: string;
  code: string;
}

export async function getPublicDepartments(): Promise<PublicDepartment[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('departments')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (error || !data) {
      return [];
    }

    return data;
  } catch {
    return [];
  }
}

export async function activateInvitedAccount(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: 'User identifier is required' };
    }

    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, status')
      .eq('id', userId)
      .single();

    if (fetchErr || !profile) {
      return { success: false, error: 'Profile not found' };
    }

    if (profile.status === 'active') {
      return { success: true };
    }

    if (profile.status !== 'invited') {
      return { success: false, error: `Account cannot be activated from '${profile.status}' status` };
    }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', userId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Activation failed';
    return { success: false, error: message };
  }
}

