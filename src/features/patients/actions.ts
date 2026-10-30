'use server';

import { requireUser } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import {
  patientRegistrationSchema,
  patientSearchSchema,
  type PatientRegistrationInput,
  type PatientSearchInput,
  type DedupSearchResult,
  type PatientDetail,
} from './schemas';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Searches patients using the deduplication RPC.
 * Discloses minimum required fields to distinguish patients and highlights shared contact numbers.
 */
export async function searchPatientsDedup(
  input: PatientSearchInput
): Promise<ActionResponse<DedupSearchResult[]>> {
  try {
    await requireUser();
    const validated = patientSearchSchema.parse(input);

    if (!validated.query && !validated.phone) {
      return { success: true, data: [] };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('search_patients_for_dedup', {
      p_query: validated.query || null,
      p_phone: validated.phone || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const results: DedupSearchResult[] = (data || []).map((row: {
      patient_id: string;
      mrn: string;
      full_name: string;
      dob: string;
      gender: 'male' | 'female' | 'other' | 'unknown';
      primary_phone: string;
      match_reasons: string[];
      is_shared_contact: boolean;
      shared_count: number | string;
    }) => ({
      patientId: row.patient_id,
      mrn: row.mrn,
      fullName: row.full_name,
      dob: row.dob,
      gender: row.gender,
      primaryPhone: row.primary_phone,
      matchReasons: row.match_reasons || [],
      isSharedContact: row.is_shared_contact,
      sharedCount: Number(row.shared_count) || 1,
    }));

    return { success: true, data: results };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to search patients' };
  }
}

/**
 * Registers a new patient with primary and alternate contact information.
 * Enforces server-side validation and role access (Reception & Assistant only).
 */
export async function registerPatient(
  rawInput: PatientRegistrationInput
): Promise<ActionResponse<{ id: string; mrn: string; fullName: string }>> {
  try {
    const actor = await requireUser(['reception', 'assistant']);
    const validated = patientRegistrationSchema.parse(rawInput);

    const supabase = await createClient();

    // 1. Insert patient
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .insert({
        full_name: validated.fullName,
        dob: validated.dob,
        gender: validated.gender,
        primary_phone: validated.primaryPhone,
        address: validated.address || null,
        registered_by: actor.id,
      })
      .select('id, mrn, full_name')
      .single();

    if (patientError || !patient) {
      return {
        success: false,
        error: patientError?.message || 'Could not insert patient record',
      };
    }

    // 2. Prepare contacts: primary phone + alternate contacts
    const contactsToInsert = [
      {
        patient_id: patient.id,
        contact_type: 'primary_phone',
        contact_value: validated.primaryPhone,
        is_verified: true,
        is_shared_contact: validated.isSharedContact,
        notes: 'Primary registration contact',
      },
      ...(validated.alternateContacts || []).map((c) => ({
        patient_id: patient.id,
        contact_type: c.contactType,
        contact_value: c.contactValue,
        is_verified: false,
        is_shared_contact: c.isSharedContact,
        notes: c.notes || null,
      })),
    ];

    const { error: contactsError } = await supabase
      .from('patient_contacts')
      .insert(contactsToInsert);

    if (contactsError) {
      return {
        success: false,
        error: `Patient registered as ${patient.mrn}, but contact insertion failed: ${contactsError.message}`,
      };
    }

    return {
      success: true,
      data: {
        id: patient.id,
        mrn: patient.mrn,
        fullName: patient.full_name,
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
    return { success: false, error: 'An unexpected error occurred during patient registration' };
  }
}

/**
 * Loads patient registration details and verified/alternate contacts.
 * Clinical privacy: Never exposes clinical notes, diagnoses, or follow-ups here.
 */
export async function getPatientDetails(
  patientId: string
): Promise<ActionResponse<PatientDetail>> {
  try {
    await requireUser();

    if (!patientId) {
      return { success: false, error: 'Patient ID is required' };
    }

    const supabase = await createClient();

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, mrn, full_name, dob, gender, primary_phone, address, registered_by, created_at, updated_at')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      return { success: false, error: 'Patient record not found' };
    }

    const { data: contacts, error: contactsError } = await supabase
      .from('patient_contacts')
      .select('id, contact_type, contact_value, is_verified, is_shared_contact, notes')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });

    if (contactsError) {
      return { success: false, error: 'Could not load patient contacts' };
    }

    return {
      success: true,
      data: {
        id: patient.id,
        mrn: patient.mrn,
        fullName: patient.full_name,
        dob: patient.dob,
        gender: patient.gender,
        primaryPhone: patient.primary_phone,
        address: patient.address,
        registeredBy: patient.registered_by,
        createdAt: patient.created_at,
        updatedAt: patient.updated_at,
        contacts: (contacts || []).map((c) => ({
          id: c.id,
          contactType: c.contact_type,
          contactValue: c.contact_value,
          isVerified: c.is_verified,
          isSharedContact: c.is_shared_contact,
          notes: c.notes,
        })),
      },
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to retrieve patient details' };
  }
}
