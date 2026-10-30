export type CorrectionRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'stale'
  | 'cancelled';

export interface CorrectionRequestItem {
  id: string;
  requestId: string;
  fieldName: string;
  originalValue: string | null;
  proposedValue: string;
  isStale: boolean;
  createdAt: string;
}

export interface CorrectionRequest {
  id: string;
  followUpId: string;
  requesterId: string;
  baseVersion: number;
  reason: string;
  supportingEvidence?: string | null;
  status: CorrectionRequestStatus;
  createdAt: string;
  updatedAt: string;
  items?: CorrectionRequestItem[];
  requester?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  followUp?: {
    id: string;
    patientId: string;
    currentVersion: number;
    status: string;
    appointmentDate: string;
    severity: string;
    notes?: string | null;
    departmentId: string;
    patient?: {
      id: string;
      fullName: string;
      mrn: string;
      dob: string;
    };
    doctor?: {
      id: string;
      fullName: string;
    };
  };
}

export interface ApprovalDecision {
  id: string;
  requestId: string;
  approverId: string;
  decision: 'approved' | 'rejected';
  decisionReason: string;
  targetVersion?: number | null;
  createdAt: string;
  approver?: {
    id: string;
    fullName: string;
    role: string;
  };
}
