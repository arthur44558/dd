'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  createCorrectionRequestSchema,
  approveCorrectionRequestSchema,
  rejectCorrectionRequestSchema,
  type CreateCorrectionRequestInput,
  type ApproveCorrectionRequestInput,
  type RejectCorrectionRequestInput,
} from './schemas';
import type { CorrectionRequest } from './types';

/**
 * Propose a correction to a submitted follow-up record.
 * Allowed roles: Doctor, Assistant, Department Head.
 */
export async function createCorrectionRequest(
  input: CreateCorrectionRequestInput
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    const actor = await requireUser(['doctor', 'assistant', 'department_head']);
    const validated = createCorrectionRequestSchema.parse(input);
    const supabase = await createClient();

    // Verify follow_up exists and fetch current version
    const { data: followUp, error: fuError } = await supabase
      .from('follow_ups')
      .select('id, current_version, status, department_id')
      .eq('id', validated.followUpId)
      .single();

    if (fuError || !followUp) {
      return { success: false, error: 'Follow-up record not found' };
    }

    if (followUp.current_version !== validated.baseVersion) {
      return {
        success: false,
        error: `Base version mismatch: follow-up is on version ${followUp.current_version}, but proposal is based on version ${validated.baseVersion}`,
      };
    }

    // Insert correction_requests
    const { data: reqData, error: reqError } = await supabase
      .from('correction_requests')
      .insert({
        follow_up_id: validated.followUpId,
        requester_id: actor.id,
        base_version: validated.baseVersion,
        reason: validated.reason,
        supporting_evidence: validated.supportingEvidence || null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (reqError || !reqData) {
      return { success: false, error: reqError?.message || 'Failed to create correction request' };
    }

    // Insert correction_request_items
    const itemsToInsert = validated.items.map((item) => ({
      request_id: reqData.id,
      field_name: item.fieldName,
      original_value: item.originalValue || null,
      proposed_value: item.proposedValue,
      is_stale: false,
    }));

    const { error: itemsError } = await supabase
      .from('correction_request_items')
      .insert(itemsToInsert);

    if (itemsError) {
      // Clean up parent request on failure
      await supabase.from('correction_requests').delete().eq('id', reqData.id);
      return { success: false, error: itemsError.message };
    }

    revalidatePath('/department-head');
    revalidatePath('/doctor');
    revalidatePath('/assistant');

    return { success: true, requestId: reqData.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Approve a correction request atomically via database RPC.
 * Enforces FOR UPDATE lock, version verification, field updates, version increment,
 * follow_up_versions snapshot, stale competing proposal marking, schedule cancellation, and audit log.
 * Allowed roles: Department Head, IT Admin.
 */
export async function approveCorrectionRequestAction(
  input: ApproveCorrectionRequestInput
): Promise<{ success: boolean; newVersion?: number; error?: string }> {
  try {
    const actor = await requireUser(['department_head', 'it_admin']);
    const validated = approveCorrectionRequestSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('approve_correction_request', {
      p_request_id: validated.requestId,
      p_approver_id: actor.id,
      p_decision_reason: validated.decisionReason,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || !data.success) {
      return { success: false, error: data?.error || 'Approval failed' };
    }

    revalidatePath('/department-head');
    revalidatePath('/doctor');
    revalidatePath('/assistant');
    revalidatePath('/coordinator');

    return {
      success: true,
      newVersion: data.new_version,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Approval failed' };
  }
}

/**
 * Reject a correction request with a mandatory reason.
 * Allowed roles: Department Head, IT Admin.
 */
export async function rejectCorrectionRequestAction(
  input: RejectCorrectionRequestInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireUser(['department_head', 'it_admin']);
    const validated = rejectCorrectionRequestSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('reject_correction_request', {
      p_request_id: validated.requestId,
      p_approver_id: actor.id,
      p_rejection_reason: validated.rejectionReason,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || !data.success) {
      return { success: false, error: data?.error || 'Rejection failed' };
    }

    revalidatePath('/department-head');
    revalidatePath('/doctor');
    revalidatePath('/assistant');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Rejection failed' };
  }
}

/**
 * Fetch pending correction requests for Department Head queue.
 */
export async function getPendingCorrectionRequests(
  departmentId?: string
): Promise<{ requests: CorrectionRequest[]; error?: string }> {
  try {
    await requireUser(['department_head', 'doctor', 'assistant', 'it_admin']);
    const supabase = await createClient();

    let query = supabase
      .from('correction_requests')
      .select(
        `
        id,
        follow_up_id,
        requester_id,
        base_version,
        reason,
        supporting_evidence,
        status,
        created_at,
        updated_at,
        items:correction_request_items(
          id,
          request_id,
          field_name,
          original_value,
          proposed_value,
          is_stale,
          created_at
        ),
        requester:profiles!correction_requests_requester_id_fkey(
          id,
          full_name,
          email,
          role
        ),
        follow_up:follow_ups(
          id,
          patient_id,
          current_version,
          status,
          appointment_date,
          severity,
          notes,
          department_id,
          patient:patients(
            id,
            full_name,
            mrn,
            dob
          )
        )
      `
      )
      .order('created_at', { ascending: false });

    // Apply department filter if supplied
    if (departmentId) {
      query = query.eq('follow_up.department_id', departmentId);
    }

    const { data, error } = await query;

    if (error) {
      return { requests: [], error: error.message };
    }

    // Map to typed entities
    const requests: CorrectionRequest[] = (data || []).map((row: any) => ({
      id: row.id,
      followUpId: row.follow_up_id,
      requesterId: row.requester_id,
      baseVersion: row.base_version,
      reason: row.reason,
      supportingEvidence: row.supporting_evidence,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: (row.items || []).map((i: any) => ({
        id: i.id,
        requestId: i.request_id,
        fieldName: i.field_name,
        originalValue: i.original_value,
        proposedValue: i.proposed_value,
        isStale: i.is_stale,
        createdAt: i.created_at,
      })),
      requester: row.requester
        ? {
            id: row.requester.id,
            fullName: row.requester.full_name,
            email: row.requester.email,
            role: row.requester.role,
          }
        : undefined,
      followUp: row.follow_up
        ? {
            id: row.follow_up.id,
            patientId: row.follow_up.patient_id,
            currentVersion: row.follow_up.current_version,
            status: row.follow_up.status,
            appointmentDate: row.follow_up.appointment_date,
            severity: row.follow_up.severity,
            notes: row.follow_up.notes,
            departmentId: row.follow_up.department_id,
            patient: row.follow_up.patient
              ? {
                  id: row.follow_up.patient.id,
                  fullName: row.follow_up.patient.full_name,
                  mrn: row.follow_up.patient.mrn,
                  dob: row.follow_up.patient.dob,
                }
              : undefined,
          }
        : undefined,
    }));

    return { requests };
  } catch (err: any) {
    return { requests: [], error: err.message || 'Failed to fetch correction requests' };
  }
}
