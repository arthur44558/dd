import { supabaseAdmin } from '@/lib/supabase/admin';

export interface JobProcessingResult {
  success: boolean;
  processedCount: number;
  workerId: string;
  error?: string;
}

/**
 * Durable Reminder Queue Worker.
 *
 * Implements FOR UPDATE SKIP LOCKED batch claiming directly in PostgreSQL.
 * Enforces maximum 3 total retries.
 * Creates coordinator communication tasks for due jobs without invoking external SMS providers.
 */
export async function processDueReminderJobs(
  batchSize: number = 50,
  workerId: string = 'cron-worker'
): Promise<JobProcessingResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc('process_due_reminder_jobs', {
      p_batch_size: batchSize,
      p_worker_id: workerId,
    });

    if (error) {
      return {
        success: false,
        processedCount: 0,
        workerId,
        error: error.message,
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        processedCount: 0,
        workerId,
        error: data?.error || 'Worker execution failed',
      };
    }

    return {
      success: true,
      processedCount: data.processed_count || 0,
      workerId: data.worker_id || workerId,
    };
  } catch (err: any) {
    return {
      success: false,
      processedCount: 0,
      workerId,
      error: err.message || 'Worker processing failed',
    };
  }
}
