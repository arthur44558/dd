'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';
import {
  recordSimulatedSendSchema,
  recordCallAttemptSchema,
  recordFollowUpOutcomeSchema,
  type RecordSimulatedSendInput,
  type RecordCallAttemptInput,
  type RecordFollowUpOutcomeInput,
} from './schemas';
import {
  MANDATORY_SIMULATION_DISCLAIMER,
  type CommunicationTask,
  type CommunicationAttempt,
  type FollowUpOutcome,
} from './types';

/**
 * Fetch Coordinator "My Tasks" queue with strict priority ordering:
 * 1. Critical / High severity first
 * 2. Nearest due date second
 */
export async function getMyTasks(
  filter?: 'all' | 'due' | 'overdue' | 'completed'
): Promise<{ tasks: CommunicationTask[]; error?: string }> {
  try {
    const actor = await requireUser(['coordinator', 'follow_up_head', 'it_admin']);
    const supabase = await createClient();

    let query = supabase
      .from('communication_tasks')
      .select(
        `
        id,
        follow_up_id,
        reminder_job_id,
        coordinator_id,
        task_type,
        channel,
        priority,
        status,
        due_at,
        notes,
        created_at,
        updated_at,
        follow_up:follow_ups(
          id,
          patient_id,
          appointment_date,
          severity,
          status,
          notes,
          patient:patients(
            id,
            full_name,
            mrn,
            dob,
            primary_phone
          )
        )
      `
      );

    // If coordinator, filter by own tasks or unassigned pool tasks
    if (actor.profile.role === 'coordinator') {
      query = query.or(`coordinator_id.eq.${actor.id},coordinator_id.is.null`);
    }

    // Apply status/due filter
    const nowIso = new Date().toISOString();
    if (filter === 'completed') {
      query = query.eq('status', 'completed');
    } else if (filter === 'overdue') {
      query = query.eq('status', 'pending').lt('due_at', nowIso);
    } else if (filter === 'due') {
      query = query.eq('status', 'pending').lte('due_at', nowIso);
    } else {
      // Default: exclude completed / cancelled
      query = query.in('status', ['pending', 'in_progress']);
    }

    const { data, error } = await query;

    if (error) {
      return { tasks: [], error: error.message };
    }

    // Priority ordering weights: Critical = 1, High = 2, Moderate = 3, Routine = 4
    const priorityWeight: Record<string, number> = {
      critical: 1,
      high: 2,
      moderate: 3,
      routine: 4,
    };

    const tasks: CommunicationTask[] = (data || []).map((row: any) => ({
      id: row.id,
      followUpId: row.follow_up_id,
      reminderJobId: row.reminder_job_id,
      coordinatorId: row.coordinator_id,
      taskType: row.task_type,
      channel: row.channel,
      priority: row.priority,
      status: row.status,
      dueAt: row.due_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      followUp: row.follow_up
        ? {
            id: row.follow_up.id,
            patientId: row.follow_up.patient_id,
            appointmentDate: row.follow_up.appointment_date,
            severity: row.follow_up.severity,
            status: row.follow_up.status,
            notes: row.follow_up.notes,
            patient: row.follow_up.patient
              ? {
                  id: row.follow_up.patient.id,
                  fullName: row.follow_up.patient.full_name,
                  mrn: row.follow_up.patient.mrn,
                  dob: row.follow_up.patient.dob,
                  primaryPhone: row.follow_up.patient.primary_phone,
                }
              : undefined,
          }
        : undefined,
    }));

    // Sort priority first, then nearest due date
    tasks.sort((a, b) => {
      const weightA = priorityWeight[a.priority] || 5;
      const weightB = priorityWeight[b.priority] || 5;
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });

    return { tasks };
  } catch (err: any) {
    return { tasks: [], error: err.message || 'Failed to fetch tasks' };
  }
}

/**
 * Record a manual simulated communication send.
 * Mandatory truthfulness disclaimer: "Manually confirmed / simulated — not provider verified".
 * Allowed roles: Coordinator, Follow-up Head.
 */
export async function recordSimulatedSendAction(
  input: RecordSimulatedSendInput
): Promise<{ success: boolean; attemptId?: string; error?: string }> {
  try {
    const actor = await requireUser(['coordinator', 'follow_up_head']);
    const validated = recordSimulatedSendSchema.parse(input);
    const supabase = await createClient();

    // 1. Insert into communication_attempts
    const { data: attempt, error: attemptError } = await supabase
      .from('communication_attempts')
      .insert({
        task_id: validated.taskId || null,
        follow_up_id: validated.followUpId,
        actor_id: actor.id,
        attempt_type: 'manual_simulated_send',
        channel: validated.channel,
        is_simulated: true,
        disclaimer: MANDATORY_SIMULATION_DISCLAIMER,
        notes: validated.notes || null,
      })
      .select('id')
      .single();

    if (attemptError || !attempt) {
      return {
        success: false,
        error: attemptError?.message || 'Failed to record simulated communication',
      };
    }

    // 2. If associated with a task, mark task as completed
    if (validated.taskId) {
      await supabase
        .from('communication_tasks')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', validated.taskId);

      // Record coordinator workload event
      await supabase.from('coordinator_workload_events').insert({
        coordinator_id: actor.id,
        event_type: 'task_completed',
        task_id: validated.taskId,
        follow_up_id: validated.followUpId,
        actor_id: actor.id,
        details: { attempt_id: attempt.id, channel: validated.channel },
      });
    }

    revalidatePath('/coordinator');
    revalidatePath('/follow-up-head');

    return { success: true, attemptId: attempt.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Action failed' };
  }
}

/**
 * Record a phone call attempt and patient response.
 * Allowed roles: Coordinator, Follow-up Head.
 */
export async function recordCallAttemptAction(
  input: RecordCallAttemptInput
): Promise<{ success: boolean; attemptId?: string; error?: string }> {
  try {
    const actor = await requireUser(['coordinator', 'follow_up_head']);
    const validated = recordCallAttemptSchema.parse(input);
    const supabase = await createClient();

    const { data: attempt, error: attemptError } = await supabase
      .from('communication_attempts')
      .insert({
        task_id: validated.taskId || null,
        follow_up_id: validated.followUpId,
        actor_id: actor.id,
        attempt_type: 'phone_call',
        channel: 'call',
        call_outcome: validated.callOutcome,
        patient_response: validated.patientResponse || null,
        is_simulated: true,
        disclaimer: MANDATORY_SIMULATION_DISCLAIMER,
        notes: validated.notes || null,
      })
      .select('id')
      .single();

    if (attemptError || !attempt) {
      return { success: false, error: attemptError?.message || 'Failed to record call attempt' };
    }

    // Mark task completed if answered/confirmed
    if (
      validated.taskId &&
      (validated.callOutcome === 'answered' || validated.patientResponse === 'appointment_confirmed')
    ) {
      await supabase
        .from('communication_tasks')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', validated.taskId);
    }

    revalidatePath('/coordinator');
    revalidatePath('/follow-up-head');

    return { success: true, attemptId: attempt.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Action failed' };
  }
}

/**
 * Record follow-up outcome (completed, patient rescheduled, patient refused, lost to follow-up).
 * If outcome is completed, cancels remaining reminder jobs.
 * Allowed roles: Coordinator, Assistant, Doctor, Department Head, Follow-up Head.
 */
export async function recordFollowUpOutcomeAction(
  input: RecordFollowUpOutcomeInput
): Promise<{ success: boolean; outcomeId?: string; error?: string }> {
  try {
    const actor = await requireUser([
      'coordinator',
      'assistant',
      'doctor',
      'department_head',
      'follow_up_head',
    ]);
    const validated = recordFollowUpOutcomeSchema.parse(input);
    const supabase = await createClient();

    // 1. Insert into follow_up_outcomes
    const { data: outcomeRow, error: outcomeError } = await supabase
      .from('follow_up_outcomes')
      .insert({
        follow_up_id: validated.followUpId,
        actor_id: actor.id,
        outcome: validated.outcome,
        attended_appointment: validated.attendedAppointment ?? null,
        requires_further_follow_up: validated.requiresFurtherFollowUp,
        notes: validated.notes || null,
        resolved_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (outcomeError || !outcomeRow) {
      return { success: false, error: outcomeError?.message || 'Failed to record outcome' };
    }

    // 2. Update follow-up status
    const newStatus = validated.outcome === 'completed' ? 'completed' : 'active';
    await supabase
      .from('follow_ups')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.followUpId);

    // 3. If cycle is completed, cancel remaining unsent reminder jobs
    if (validated.outcome === 'completed') {
      await supabase
        .from('reminder_jobs')
        .update({
          status: 'cancelled',
          terminal_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('follow_up_id', validated.followUpId)
        .eq('status', 'pending');
    }

    revalidatePath('/coordinator');
    revalidatePath('/assistant');
    revalidatePath('/doctor');
    revalidatePath('/department-head');

    return { success: true, outcomeId: outcomeRow.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Action failed' };
  }
}

/**
 * Fetch communication history for a follow-up.
 */
export async function getCommunicationHistoryForFollowUp(
  followUpId: string
): Promise<{ attempts: CommunicationAttempt[]; outcomes: FollowUpOutcome[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: attemptsData, error: attemptsError } = await supabase
      .from('communication_attempts')
      .select(
        `
        id,
        task_id,
        follow_up_id,
        actor_id,
        attempt_type,
        channel,
        call_outcome,
        patient_response,
        is_simulated,
        disclaimer,
        notes,
        created_at,
        actor:profiles(
          id,
          full_name,
          role
        )
      `
      )
      .eq('follow_up_id', followUpId)
      .order('created_at', { ascending: false });

    const { data: outcomesData, error: outcomesError } = await supabase
      .from('follow_up_outcomes')
      .select(
        `
        id,
        follow_up_id,
        actor_id,
        outcome,
        attended_appointment,
        requires_further_follow_up,
        notes,
        resolved_at,
        created_at,
        actor:profiles(
          id,
          full_name,
          role
        )
      `
      )
      .eq('follow_up_id', followUpId)
      .order('created_at', { ascending: false });

    if (attemptsError || outcomesError) {
      return {
        attempts: [],
        outcomes: [],
        error: attemptsError?.message || outcomesError?.message,
      };
    }

    const attempts: CommunicationAttempt[] = (attemptsData || []).map((r: any) => ({
      id: r.id,
      taskId: r.task_id,
      followUpId: r.follow_up_id,
      actorId: r.actor_id,
      attemptType: r.attempt_type,
      channel: r.channel,
      callOutcome: r.call_outcome,
      patientResponse: r.patient_response,
      isSimulated: r.is_simulated,
      disclaimer: r.disclaimer,
      notes: r.notes,
      createdAt: r.created_at,
      actor: r.actor
        ? {
            id: r.actor.id,
            fullName: r.actor.full_name,
            role: r.actor.role,
          }
        : undefined,
    }));

    const outcomes: FollowUpOutcome[] = (outcomesData || []).map((r: any) => ({
      id: r.id,
      followUpId: r.follow_up_id,
      actorId: r.actor_id,
      outcome: r.outcome,
      attendedAppointment: r.attended_appointment,
      requiresFurtherFollowUp: r.requires_further_follow_up,
      notes: r.notes,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
      actor: r.actor
        ? {
            id: r.actor.id,
            fullName: r.actor.full_name,
            role: r.actor.role,
          }
        : undefined,
    }));

    return { attempts, outcomes };
  } catch (err: any) {
    return { attempts: [], outcomes: [], error: err.message || 'Failed to fetch history' };
  }
}
