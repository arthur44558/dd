'use server';

import { requireUser } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import {
  clinicalIntakeSchema,
  doctorReviewSchema,
  type ClinicalIntakeInput,
  type DoctorReviewInput,
  type FollowUpSummary,
  type FollowUpStatus,
} from './schemas';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Creates a draft follow-up record initiated by a Doctor's Assistant.
 * Validates clinical fields, verifies patient and doctor, and links source document scans.
 */
export async function createDraftFollowUp(
  rawInput: ClinicalIntakeInput
): Promise<ActionResponse<{ id: string; status: FollowUpStatus; currentVersion: number }>> {
  try {
    const actor = await requireUser(['assistant']);
    const validated = clinicalIntakeSchema.parse(rawInput);

    const supabase = await createClient();

    // 1. Verify patient exists
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', validated.patientId)
      .single();

    if (patientError || !patient) {
      return { success: false, error: 'Target patient record does not exist' };
    }

    // 2. Verify doctor exists and is active
    const { data: doctor, error: doctorError } = await supabase
      .from('doctor_profiles')
      .select('id, is_active')
      .eq('id', validated.doctorId)
      .single();

    if (doctorError || !doctor || !doctor.is_active) {
      return { success: false, error: 'Specified doctor is inactive or not found' };
    }

    // 3. Insert draft follow-up record
    const { data: followUp, error: followUpError } = await supabase
      .from('follow_ups')
      .insert({
        patient_id: validated.patientId,
        doctor_id: validated.doctorId,
        department_id: validated.departmentId,
        consultation_id: validated.consultationId || null,
        responsible_assistant_id: actor.id,
        appointment_date: validated.appointmentDate,
        follow_up_required: validated.followUpRequired,
        severity: validated.severity,
        status: 'draft',
        current_version: 1,
        notes: validated.notes || null,
      })
      .select('id, status, current_version')
      .single();

    if (followUpError || !followUp) {
      return {
        success: false,
        error: followUpError?.message || 'Could not create draft follow-up',
      };
    }

    // 4. If source document was uploaded, link it to this follow_up
    if (validated.sourceDocumentId) {
      await supabase
        .from('source_documents')
        .update({ follow_up_id: followUp.id })
        .eq('id', validated.sourceDocumentId);
    }

    return {
      success: true,
      data: {
        id: followUp.id,
        status: followUp.status as FollowUpStatus,
        currentVersion: followUp.current_version,
      },
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'flatten' in err) {
      const zErr = err as { flatten: () => { fieldErrors: Record<string, string[]> } };
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: zErr.flatten().fieldErrors,
      };
    }
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to create draft follow-up' };
  }
}

/**
 * Doctor reviews and submits a follow-up record.
 * Validates clinical accuracy, sets status to 'submitted', locks direct mutations,
 * and records an immutable snapshot in follow_up_versions.
 */
export async function submitDoctorReview(
  rawInput: DoctorReviewInput
): Promise<ActionResponse<{ id: string; status: FollowUpStatus; currentVersion: number }>> {
  try {
    const actor = await requireUser(['doctor']);
    const validated = doctorReviewSchema.parse(rawInput);

    const supabase = await createClient();

    // 1. Locate Doctor Profile for this actor
    const { data: doctorProfile, error: docProfileError } = await supabase
      .from('doctor_profiles')
      .select('id')
      .eq('profile_id', actor.id)
      .eq('is_active', true)
      .single();

    if (docProfileError || !doctorProfile) {
      return { success: false, error: 'Authenticated doctor profile not found or inactive' };
    }

    // 2. Fetch the target follow-up
    const { data: followUp, error: fetchError } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('id', validated.followUpId)
      .single();

    if (fetchError || !followUp) {
      return { success: false, error: 'Follow-up record not found' };
    }

    // Authorization check: doctor must be the assigned clinician
    if (followUp.doctor_id !== doctorProfile.id) {
      return { success: false, error: 'You are not the designated doctor for this follow-up record' };
    }

    if (followUp.status !== 'draft') {
      return {
        success: false,
        error: `Cannot submit: record is already in '${followUp.status}' status (must be 'draft')`,
      };
    }

    // 3. Prepare final submitted values
    const finalAppointmentDate = validated.appointmentDate || followUp.appointment_date;
    const finalSeverity = validated.severity || followUp.severity;
    const finalNotes = validated.clinicalNotes
      ? `${followUp.notes ? `${followUp.notes}\n\n` : ''}[Doctor Confirmation Note]: ${validated.clinicalNotes}`
      : followUp.notes;

    // 4. Find linked source document if any
    const { data: sourceDoc } = await supabase
      .from('source_documents')
      .select('id')
      .eq('follow_up_id', followUp.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Update follow_up to 'submitted'
    const { error: updateError } = await supabase
      .from('follow_ups')
      .update({
        status: 'submitted',
        current_version: 1,
        appointment_date: finalAppointmentDate,
        severity: finalSeverity,
        notes: finalNotes,
      })
      .eq('id', followUp.id);

    if (updateError) {
      return { success: false, error: `Submission update failed: ${updateError.message}` };
    }

    // 6. Create immutable version snapshot in follow_up_versions
    const versionSnapshot = {
      patientId: followUp.patient_id,
      doctorId: followUp.doctor_id,
      departmentId: followUp.department_id,
      appointmentDate: finalAppointmentDate,
      severity: finalSeverity,
      status: 'submitted',
      notes: finalNotes,
      submittedBy: actor.id,
      submittedRole: 'doctor',
      submittedAt: new Date().toISOString(),
    };

    const { error: versionError } = await supabase
      .from('follow_up_versions')
      .insert({
        follow_up_id: followUp.id,
        version_number: 1,
        snapshot: versionSnapshot,
        source_document_id: sourceDoc?.id || null,
        created_by: actor.id,
      });

    if (versionError) {
      return {
        success: false,
        error: `Submitted status set, but failed to create immutable version snapshot: ${versionError.message}`,
      };
    }

    return {
      success: true,
      data: {
        id: followUp.id,
        status: 'submitted',
        currentVersion: 1,
      },
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'flatten' in err) {
      const zErr = err as { flatten: () => { fieldErrors: Record<string, string[]> } };
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: zErr.flatten().fieldErrors,
      };
    }
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to submit doctor review' };
  }
}

/**
 * Retrieves detailed clinical follow-up record with role-based access enforcement.
 * Prohibits Reception role from accessing clinical details.
 */
export async function getFollowUpDetails(
  followUpId: string
): Promise<ActionResponse<FollowUpSummary>> {
  try {
    const actor = await requireUser();

    // Strict Clinical Privacy Gate
    if (actor.profile.role === 'reception') {
      return { success: false, error: 'Unauthorized: Reception staff cannot view clinical follow-up details' };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('follow_ups')
      .select(`
        *,
        patients (
          id,
          mrn,
          full_name,
          dob
        ),
        departments (
          id,
          name
        )
      `)
      .eq('id', followUpId)
      .single();

    if (error || !data) {
      return { success: false, error: 'Follow-up record not found or access denied by policy' };
    }

    // Get source document ID if present
    const { data: sourceDoc } = await supabase
      .from('source_documents')
      .select('id')
      .eq('follow_up_id', followUpId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      success: true,
      data: {
        id: data.id,
        patientId: data.patient_id,
        patientName: data.patients?.full_name || 'Unknown Patient',
        patientMrn: data.patients?.mrn || 'N/A',
        patientDob: data.patients?.dob || 'N/A',
        doctorId: data.doctor_id,
        departmentId: data.department_id,
        departmentName: data.departments?.name,
        appointmentDate: data.appointment_date,
        severity: data.severity,
        status: data.status,
        currentVersion: data.current_version,
        followUpRequired: data.follow_up_required,
        notes: data.notes,
        responsibleAssistantId: data.responsible_assistant_id,
        sourceDocumentId: sourceDoc?.id || null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to retrieve follow-up details' };
  }
}

/**
 * Lists follow-ups based on status and user authority.
 */
export async function listFollowUps(filters?: {
  status?: FollowUpStatus;
  patientId?: string;
}): Promise<ActionResponse<FollowUpSummary[]>> {
  try {
    const actor = await requireUser();

    if (actor.profile.role === 'reception') {
      return { success: false, error: 'Unauthorized: Reception staff cannot list clinical follow-ups' };
    }

    const supabase = await createClient();

    let query = supabase
      .from('follow_ups')
      .select(`
        *,
        patients (
          id,
          mrn,
          full_name,
          dob
        ),
        departments (
          id,
          name
        )
      `)
      .order('appointment_date', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.patientId) {
      query = query.eq('patient_id', filters.patientId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const summaries: FollowUpSummary[] = (data || []).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patients?.full_name || 'Unknown',
      patientMrn: row.patients?.mrn || 'N/A',
      patientDob: row.patients?.dob || 'N/A',
      doctorId: row.doctor_id,
      departmentId: row.department_id,
      departmentName: row.departments?.name,
      appointmentDate: row.appointment_date,
      severity: row.severity,
      status: row.status,
      currentVersion: row.current_version,
      followUpRequired: row.follow_up_required,
      notes: row.notes,
      responsibleAssistantId: row.responsible_assistant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { success: true, data: summaries };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to list follow-ups' };
  }
}
