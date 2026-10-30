/**
 * Unit Test Suite: Pluggable Reminder Schedule Strategy & Defensive Configuration.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §6.1-6.2, §16 (OQ-04..06) and PROJECT.md Feature 15.
 */

import { describe, it, expect } from 'vitest';
import { UNCONFIGURED_STRATEGY_EXPECTATION, ScheduleStrategyOutput } from '../fixtures/schedule-rules';

export interface ReminderJob {
  scheduledFor: string;
  channel: 'sms' | 'call';
  priority: number;
}

export interface ReminderScheduleStrategy {
  generateSchedule(followUp: {
    appointmentDate: string;
    severity: string;
    followUpRequired: boolean;
  }): ScheduleStrategyOutput;
}

/**
 * Default defensive strategy implementation that satisfies the spec requirement:
 * Unapproved reminder spacing rules must remain in `needs_configuration` state.
 */
export class DefaultDefensiveReminderStrategy implements ReminderScheduleStrategy {
  generateSchedule(followUp: {
    appointmentDate: string;
    severity: string;
    followUpRequired: boolean;
  }): ScheduleStrategyOutput {
    // If follow-up is not required, zero jobs are created
    if (!followUp.followUpRequired) {
      return {
        strategyName: 'default_clinical_cadence',
        isConfigured: true,
        status: 'active_configured',
        generatedJobs: [],
      };
    }

    // Defensive default: unconfigured cadences MUST NOT generate arbitrary unapproved reminders
    return {
      strategyName: 'default_clinical_cadence',
      isConfigured: false,
      status: 'needs_configuration',
      generatedJobs: [],
    };
  }
}

/**
 * Mock configured strategy used to test future approved hospital schedule activation
 */
export class ConfiguredHospitalReminderStrategy implements ReminderScheduleStrategy {
  generateSchedule(followUp: {
    appointmentDate: string;
    severity: string;
    followUpRequired: boolean;
  }): ScheduleStrategyOutput {
    if (!followUp.followUpRequired) {
      return {
        strategyName: 'approved_hospital_cadence_v1',
        isConfigured: true,
        status: 'active_configured',
        generatedJobs: [],
      };
    }

    // Example approved cadence: T-3 days and T-1 day
    return {
      strategyName: 'approved_hospital_cadence_v1',
      isConfigured: true,
      status: 'active_configured',
      generatedJobs: [
        { scheduledFor: `${followUp.appointmentDate}T10:00:00+05:30`, channel: 'sms', priority: 1 },
        { scheduledFor: `${followUp.appointmentDate}T16:00:00+05:30`, channel: 'call', priority: 2 },
      ],
    };
  }
}

describe('Pluggable Reminder Schedule Strategy & OQ-04..06 Defense', () => {
  const defaultStrategy = new DefaultDefensiveReminderStrategy();

  it('defaults to needs_configuration state when reminder spacing is unapproved', () => {
    const result = defaultStrategy.generateSchedule({
      appointmentDate: '2026-11-20',
      severity: 'routine',
      followUpRequired: true,
    });

    expect(result.status).toBe('needs_configuration');
    expect(result.isConfigured).toBe(false);
    expect(result.generatedJobs).toHaveLength(0);
    expect(result).toEqual(UNCONFIGURED_STRATEGY_EXPECTATION);
  });

  it('generates zero jobs when followUpRequired is false regardless of date', () => {
    const result = defaultStrategy.generateSchedule({
      appointmentDate: '2026-11-20',
      severity: 'routine',
      followUpRequired: false,
    });

    expect(result.generatedJobs).toHaveLength(0);
  });

  it('does not invent arbitrary reminder cadences without approved configuration', () => {
    const severities = ['routine', 'moderate', 'high', 'critical'] as const;

    severities.forEach((sev) => {
      const result = defaultStrategy.generateSchedule({
        appointmentDate: '2026-11-15',
        severity: sev,
        followUpRequired: true,
      });

      // Must remain in defensive needs_configuration state
      expect(result.isConfigured).toBe(false);
      expect(result.generatedJobs).toHaveLength(0);
    });
  });

  it('allows plugging an approved hospital strategy to generate jobs once signed off', () => {
    const configuredStrategy = new ConfiguredHospitalReminderStrategy();
    const result = configuredStrategy.generateSchedule({
      appointmentDate: '2026-11-20',
      severity: 'high',
      followUpRequired: true,
    });

    expect(result.status).toBe('active_configured');
    expect(result.isConfigured).toBe(true);
    expect(result.generatedJobs).toHaveLength(2);
    expect(result.generatedJobs[0]?.channel).toBe('sms');
    expect(result.generatedJobs[1]?.channel).toBe('call');
  });
});
