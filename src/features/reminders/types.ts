export type ReminderJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ReminderTaskType =
  | 'pre_appointment_text'
  | 'pre_appointment_call'
  | 'overdue_text_day_2'
  | 'overdue_text_day_4'
  | 'correction_notice'
  | 'custom';

export type CommunicationChannel = 'text' | 'call';

export interface ProposedReminderJob {
  taskType: ReminderTaskType;
  channel: CommunicationChannel;
  scheduledAt: Date;
  timezoneContext: string;
}

export interface ScheduleStrategyResult {
  status: 'needs_configuration' | 'ready';
  configVersion?: number;
  jobs: ProposedReminderJob[];
  reason?: string;
}

export interface ReminderScheduleStrategy {
  readonly id: string;
  readonly name: string;
  generateSchedule(params: {
    appointmentDate: Date;
    severity: 'routine' | 'moderate' | 'high' | 'critical';
    hospitalTimezone?: string;
    configVersion?: number;
  }): Promise<ScheduleStrategyResult>;
}

export interface ReminderJob {
  id: string;
  followUpId: string;
  scheduleId?: string | null;
  scheduleVersion: number;
  taskType: ReminderTaskType;
  channel: CommunicationChannel;
  scheduledAt: string;
  timezoneContext: string;
  status: ReminderJobStatus;
  retryCount: number;
  maxRetries: number;
  idempotencyKey: string;
  lockedAt?: string | null;
  lockedBy?: string | null;
  lastError?: string | null;
  executionStartedAt?: string | null;
  terminalAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleConfig {
  id: string;
  version: number;
  name: string;
  status: 'needs_configuration' | 'active' | 'archived' | 'disabled';
  timezone: string;
  daytimeStartHour: number;
  daytimeEndHour: number;
  parameters: Record<string, any>;
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}
