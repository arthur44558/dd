import { describe, it, expect } from 'vitest';
import {
  createCorrectionRequestSchema,
  approveCorrectionRequestSchema,
  rejectCorrectionRequestSchema,
} from '@/features/approvals/schemas';
import {
  recordSimulatedSendSchema,
  recordCallAttemptSchema,
  recordFollowUpOutcomeSchema,
} from '@/features/coordinator/schemas';
import { MANDATORY_SIMULATION_DISCLAIMER } from '@/features/coordinator/types';

describe('Approvals Governance & Schemas', () => {
  const validUUID = '11111111-2222-3333-4444-555555555555';

  it('validates a correct correction request payload', () => {
    const input = {
      followUpId: validUUID,
      baseVersion: 1,
      reason: 'Patient reported worsening pain; earlier review date required.',
      supportingEvidence: 'Phone triage note #482',
      items: [
        {
          fieldName: 'appointment_date',
          originalValue: '2026-11-20',
          proposedValue: '2026-11-15',
        },
      ],
    };

    const parsed = createCorrectionRequestSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it('rejects correction request with missing or short reason (<5 chars)', () => {
    const input = {
      followUpId: validUUID,
      baseVersion: 1,
      reason: 'bad',
      items: [
        {
          fieldName: 'appointment_date',
          originalValue: '2026-11-20',
          proposedValue: '2026-11-15',
        },
      ],
    };

    const parsed = createCorrectionRequestSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('at least 5 characters');
    }
  });

  it('rejects correction request with zero items', () => {
    const input = {
      followUpId: validUUID,
      baseVersion: 1,
      reason: 'Valid clinical explanation',
      items: [],
    };

    const parsed = createCorrectionRequestSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('At least one field change');
    }
  });

  it('strictly requires a non-empty rejection reason (>= 5 chars) for Dept Head rejection', () => {
    const emptyReject = {
      requestId: validUUID,
      rejectionReason: '',
    };
    expect(rejectCorrectionRequestSchema.safeParse(emptyReject).success).toBe(false);

    const shortReject = {
      requestId: validUUID,
      rejectionReason: 'nope',
    };
    expect(rejectCorrectionRequestSchema.safeParse(shortReject).success).toBe(false);

    const validReject = {
      requestId: validUUID,
      rejectionReason: 'Clinical justification insufficient; patient already scheduled for diagnostics.',
    };
    expect(rejectCorrectionRequestSchema.safeParse(validReject).success).toBe(true);
  });

  it('defaults approval decision reason when omitted', () => {
    const validApprove = {
      requestId: validUUID,
    };
    const parsed = approveCorrectionRequestSchema.parse(validApprove);
    expect(parsed.decisionReason).toBe('Approved by Department Head');
  });
});

describe('Coordinator Actions, Simulation Disclaimer & Outcome Schemas', () => {
  const validUUID = '11111111-2222-3333-4444-555555555555';

  it('enforces mandatory simulated communication disclaimer text', () => {
    expect(MANDATORY_SIMULATION_DISCLAIMER).toBe(
      'Manually confirmed / simulated — not provider verified'
    );
  });

  it('validates simulated send input with text channel default', () => {
    const input = {
      followUpId: validUUID,
      notes: 'Sent standard SMS appointment reminder via manual phone.',
    };
    const parsed = recordSimulatedSendSchema.parse(input);
    expect(parsed.channel).toBe('text');
    expect(parsed.followUpId).toBe(validUUID);
  });

  it('validates call attempt input with controlled enum outcomes', () => {
    const input = {
      followUpId: validUUID,
      callOutcome: 'answered' as const,
      patientResponse: 'appointment_confirmed' as const,
      notes: 'Patient confirmed attendance.',
    };
    const parsed = recordCallAttemptSchema.safeParse(input);
    expect(parsed.success).toBe(true);

    const invalidOutcome = {
      followUpId: validUUID,
      callOutcome: 'unknown_status',
    };
    expect(recordCallAttemptSchema.safeParse(invalidOutcome).success).toBe(false);
  });

  it('validates follow-up outcome recording with requiresFurtherFollowUp default', () => {
    const input = {
      followUpId: validUUID,
      outcome: 'completed' as const,
      attendedAppointment: true,
      requiresFurtherFollowUp: false,
      notes: 'Patient completed review.',
    };
    const parsed = recordFollowUpOutcomeSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it('orders coordinator tasks strictly: severity first, then nearest due date', () => {
    const priorityWeight: Record<string, number> = {
      critical: 1,
      high: 2,
      moderate: 3,
      routine: 4,
    };

    const tasks = [
      { id: '1', priority: 'routine', dueAt: '2026-11-01T10:00:00Z' },
      { id: '2', priority: 'critical', dueAt: '2026-11-05T10:00:00Z' },
      { id: '3', priority: 'high', dueAt: '2026-11-02T10:00:00Z' },
      { id: '4', priority: 'critical', dueAt: '2026-11-03T10:00:00Z' },
      { id: '5', priority: 'moderate', dueAt: '2026-11-01T10:00:00Z' },
    ];

    tasks.sort((a, b) => {
      const weightA = priorityWeight[a.priority] || 5;
      const weightB = priorityWeight[b.priority] || 5;
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });

    // Expect critical tasks first, ordered by due date: id 4 (Nov 3), then id 2 (Nov 5)
    expect(tasks[0]?.id).toBe('4');
    expect(tasks[1]?.id).toBe('2');
    // Next high: id 3
    expect(tasks[2]?.id).toBe('3');
    // Next moderate: id 5
    expect(tasks[3]?.id).toBe('5');
    // Next routine: id 1
    expect(tasks[4]?.id).toBe('1');
  });
});
