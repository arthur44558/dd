/**
 * Schedule rules and calendar calculations fixtures.
 * Adheres to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §6.1-6.5 and §16 (OQ-04..06).
 */

export const SCHEDULE_DEFAULTS = {
  HOSPITAL_TIMEZONE: 'Asia/Kolkata',
  MAX_RETRY_ATTEMPTS: 3,
  OVERDUE_TRIGGER_DAYS_1: 2, // Exactly +2 calendar days
  OVERDUE_TRIGGER_DAYS_2: 4, // Exactly +4 calendar days
  CHANNELS: ['sms', 'call'] as const,
  SIMULATION_DISCLAIMER: 'Manually confirmed / simulated — not provider verified',
} as const;

/**
 * Calculates confirmed overdue trigger dates in Asia/Kolkata timezone.
 * @param appointmentDateStr ISO date string (YYYY-MM-DD)
 */
export function calculateOverdueDates(appointmentDateStr: string): {
  appointmentDate: string;
  overdueTask1Date: string; // +2 calendar days
  overdueTask2Date: string; // +4 calendar days
} {
  // Parse appointment date in YYYY-MM-DD
  const parts = appointmentDateStr.split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  
  // Create Date object at midnight
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  
  const datePlus2 = new Date(baseDate);
  datePlus2.setUTCDate(datePlus2.getUTCDate() + SCHEDULE_DEFAULTS.OVERDUE_TRIGGER_DAYS_1);
  
  const datePlus4 = new Date(baseDate);
  datePlus4.setUTCDate(datePlus4.getUTCDate() + SCHEDULE_DEFAULTS.OVERDUE_TRIGGER_DAYS_2);

  const formatDate = (d: Date): string => d.toISOString().split('T')[0] || '';

  return {
    appointmentDate: appointmentDateStr,
    overdueTask1Date: formatDate(datePlus2),
    overdueTask2Date: formatDate(datePlus4),
  };
}

/**
 * Contract representation for the Reminder Schedule Strategy
 */
export interface ScheduleStrategyOutput {
  strategyName: string;
  isConfigured: boolean;
  status: 'needs_configuration' | 'active_configured';
  generatedJobs: Array<{
    scheduledFor: string;
    channel: 'sms' | 'call';
    priority: number;
  }>;
}

/**
 * Expected output when ReminderScheduleStrategy is unconfigured (OQ-04..06 defense)
 */
export const UNCONFIGURED_STRATEGY_EXPECTATION: ScheduleStrategyOutput = {
  strategyName: 'default_clinical_cadence',
  isConfigured: false,
  status: 'needs_configuration',
  generatedJobs: [],
};
