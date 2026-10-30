export type TaskPriority = 'routine' | 'moderate' | 'high' | 'critical';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export const MANDATORY_SIMULATION_DISCLAIMER =
  'Manually confirmed / simulated — not provider verified';

export type CommunicationChannel = 'text' | 'call';

export type AttemptType =
  | 'manual_simulated_send'
  | 'phone_call'
  | 'in_person'
  | 'other';

export type CallOutcome =
  | 'answered'
  | 'no_answer'
  | 'unreachable'
  | 'callback_requested'
  | 'other';

export type PatientResponse =
  | 'appointment_confirmed'
  | 'rescheduling_requested'
  | 'follow_up_declined'
  | 'clinical_guidance_needed'
  | 'other';

export type FollowUpOutcomeType =
  | 'completed'
  | 'patient_rescheduled'
  | 'patient_refused'
  | 'lost_to_follow_up';

export interface CommunicationTask {
  id: string;
  followUpId: string;
  reminderJobId?: string | null;
  coordinatorId?: string | null;
  taskType: string;
  channel: CommunicationChannel;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  followUp?: {
    id: string;
    patientId: string;
    appointmentDate: string;
    severity: TaskPriority;
    status: string;
    notes?: string | null;
    patient?: {
      id: string;
      fullName: string;
      mrn: string;
      dob: string;
      primaryPhone: string;
      isSharedContact?: boolean;
    };
    doctor?: {
      id: string;
      fullName: string;
    };
  };
}

export interface CommunicationAttempt {
  id: string;
  taskId?: string | null;
  followUpId: string;
  actorId: string;
  attemptType: AttemptType;
  channel: CommunicationChannel;
  callOutcome?: CallOutcome | null;
  patientResponse?: PatientResponse | null;
  isSimulated: boolean;
  disclaimer: string;
  notes?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    role: string;
  };
}

export interface FollowUpOutcome {
  id: string;
  followUpId: string;
  actorId: string;
  outcome: FollowUpOutcomeType;
  attendedAppointment?: boolean | null;
  requiresFurtherFollowUp: boolean;
  notes?: string | null;
  resolvedAt: string;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    role: string;
  };
}
