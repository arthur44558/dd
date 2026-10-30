import { z } from 'zod';

export const recordSimulatedSendSchema = z.object({
  taskId: z.string().uuid('Invalid task ID').optional().nullable(),
  followUpId: z.string().uuid('Invalid follow-up ID'),
  channel: z.enum(['text', 'call']).default('text'),
  notes: z.string().optional().nullable(),
});

export type RecordSimulatedSendInput = z.infer<typeof recordSimulatedSendSchema>;

export const recordCallAttemptSchema = z.object({
  taskId: z.string().uuid('Invalid task ID').optional().nullable(),
  followUpId: z.string().uuid('Invalid follow-up ID'),
  callOutcome: z.enum([
    'answered',
    'no_answer',
    'unreachable',
    'callback_requested',
    'other',
  ]),
  patientResponse: z
    .enum([
      'appointment_confirmed',
      'rescheduling_requested',
      'follow_up_declined',
      'clinical_guidance_needed',
      'other',
    ])
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
});

export type RecordCallAttemptInput = z.infer<typeof recordCallAttemptSchema>;

export const recordFollowUpOutcomeSchema = z.object({
  followUpId: z.string().uuid('Invalid follow-up ID'),
  outcome: z.enum([
    'completed',
    'patient_rescheduled',
    'patient_refused',
    'lost_to_follow_up',
  ]),
  attendedAppointment: z.boolean().optional().nullable(),
  requiresFurtherFollowUp: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export type RecordFollowUpOutcomeInput = z.infer<typeof recordFollowUpOutcomeSchema>;
