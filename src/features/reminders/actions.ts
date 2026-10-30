'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import { evaluateOverdueFollowUps, DEFAULT_HOSPITAL_TIMEZONE } from './overdue-engine';
import { processDueReminderJobs } from './processor';
import type { ReminderJob, ScheduleConfig } from './types';

/**
 * Manually trigger overdue evaluation.
 * Allowed roles: Follow-up Head, IT Admin.
 */
export async function triggerOverdueEvaluationAction(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    await requireUser(['follow_up_head', 'it_admin']);
    const result = await evaluateOverdueFollowUps(DEFAULT_HOSPITAL_TIMEZONE);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/coordinator');
    revalidatePath('/follow-up-head');

    return { success: true, count: result.transitionedOverdueCount };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unauthorized or failed' };
  }
}

/**
 * Manually trigger due reminder jobs processing.
 * Allowed roles: Follow-up Head, IT Admin.
 */
export async function triggerProcessDueJobsAction(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    await requireUser(['follow_up_head', 'it_admin']);
    const result = await processDueReminderJobs(50, 'manual-action-worker');

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath('/coordinator');
    revalidatePath('/follow-up-head');

    return { success: true, count: result.processedCount };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unauthorized or failed' };
  }
}

/**
 * Fetch reminder jobs linked to a follow-up record.
 */
export async function getReminderJobsForFollowUp(
  followUpId: string
): Promise<{ jobs: ReminderJob[]; error?: string }> {
  try {
    await requireUser([
      'coordinator',
      'follow_up_head',
      'assistant',
      'doctor',
      'department_head',
      'it_admin',
    ]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('reminder_jobs')
      .select('*')
      .eq('follow_up_id', followUpId)
      .order('scheduled_at', { ascending: true });

    if (error) {
      return { jobs: [], error: error.message };
    }

    const jobs: ReminderJob[] = (data || []).map((row: any) => ({
      id: row.id,
      followUpId: row.follow_up_id,
      scheduleId: row.schedule_id,
      scheduleVersion: row.schedule_version,
      taskType: row.task_type,
      channel: row.channel,
      scheduledAt: row.scheduled_at,
      timezoneContext: row.timezone_context,
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      idempotencyKey: row.idempotency_key,
      lockedAt: row.locked_at,
      lockedBy: row.locked_by,
      lastError: row.last_error,
      executionStartedAt: row.execution_started_at,
      terminalAt: row.terminal_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { jobs };
  } catch (err: any) {
    return { jobs: [], error: err.message || 'Failed to fetch reminder jobs' };
  }
}

/**
 * Fetch active schedule configuration.
 */
export async function getActiveScheduleConfig(): Promise<{
  config: ScheduleConfig | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('schedule_configs')
      .select('*')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return { config: null, error: error.message };
    }

    return {
      config: {
        id: data.id,
        version: data.version,
        name: data.name,
        status: data.status,
        timezone: data.timezone,
        daytimeStartHour: data.daytime_start_hour,
        daytimeEndHour: data.daytime_end_hour,
        parameters: data.parameters || {},
        approvedBy: data.approved_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (err: any) {
    return { config: null, error: err.message || 'Failed to fetch schedule config' };
  }
}
