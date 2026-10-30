import type {
  ReminderScheduleStrategy,
  ScheduleStrategyResult,
} from './types';

/**
 * Defensive Strategy implementation for Open Clinical Decisions (OQ-04..06).
 *
 * Per Spec §6.2:
 * "Exact formula, parameters, minimum gap, rounding, severity-specific text/call ratios,
 * short-interval behaviour and daytime rules have not been approved.
 * Until approved configuration exists:
 * - Keep the schedule feature marked `needs_configuration`.
 * - Do not activate automatic pre-appointment jobs in production."
 */
export class DefaultReminderScheduleStrategy implements ReminderScheduleStrategy {
  public readonly id = 'default-defensive-strategy';
  public readonly name = 'Default Defensive Reminder Strategy (Pending Configuration)';

  public async generateSchedule(params: {
    appointmentDate: Date;
    severity: 'routine' | 'moderate' | 'high' | 'critical';
    hospitalTimezone?: string;
    configVersion?: number;
  }): Promise<ScheduleStrategyResult> {
    // Fail safe: return needs_configuration without inventing fake intervals
    return {
      status: 'needs_configuration',
      configVersion: params.configVersion || 1,
      jobs: [],
      reason:
        'Pre-appointment reminder scheduling formula, severity ratios, and daytime windows require formal hospital clinical committee sign-off (Open Decisions OQ-04..06). Automatic pre-appointment jobs remain disabled until configured.',
    };
  }
}

/**
 * Active strategy resolver. Allows swapping or configuring approved strategies.
 */
export function getReminderScheduleStrategy(): ReminderScheduleStrategy {
  return new DefaultReminderScheduleStrategy();
}
