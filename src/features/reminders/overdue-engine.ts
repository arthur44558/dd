import { supabaseAdmin } from '@/lib/supabase/admin';

export interface OverdueEvaluationResult {
  success: boolean;
  hospitalDate: string;
  transitionedOverdueCount: number;
  error?: string;
}

export const DEFAULT_HOSPITAL_TIMEZONE = 'Asia/Kolkata';

/**
 * Confirmed Overdue Engine.
 * Evaluates follow-ups whose appointment date has passed without clinical resolution.
 * Transitions state to 'OVERDUE' and generates exactly two overdue text tasks:
 * - Day +2 calendar days at 10:00 AM hospital timezone (Asia/Kolkata)
 * - Day +4 calendar days at 10:00 AM hospital timezone (Asia/Kolkata)
 *
 * Enforces calendar day offsets in the hospital timezone rather than raw hour offsets.
 */
export async function evaluateOverdueFollowUps(
  hospitalTimezone: string = DEFAULT_HOSPITAL_TIMEZONE
): Promise<OverdueEvaluationResult> {
  try {
    // Invoke the database-level transactional RPC
    const { data, error } = await supabaseAdmin.rpc('evaluate_overdue_follow_ups', {
      p_hospital_timezone: hospitalTimezone,
    });

    if (error) {
      return {
        success: false,
        hospitalDate: new Date().toISOString(),
        transitionedOverdueCount: 0,
        error: error.message,
      };
    }

    return {
      success: true,
      hospitalDate: data?.hospital_date || new Date().toISOString(),
      transitionedOverdueCount: data?.transitioned_overdue_count || 0,
    };
  } catch (err: any) {
    return {
      success: false,
      hospitalDate: new Date().toISOString(),
      transitionedOverdueCount: 0,
      error: err.message || 'Overdue evaluation failed',
    };
  }
}
