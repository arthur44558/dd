export type InquiryStatus = 'open' | 'in_progress' | 'answered' | 'closed';
export type InquiryPriority = 'low' | 'normal' | 'urgent';

export interface InquiryMessage {
  id: string;
  queryId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string | null;
  recipientName?: string | null;
  body: string;
  isEscalation: boolean;
  escalatedTo: string | null;
  escalatedToName?: string | null;
  createdAt: string;
}

export interface ClinicalInquiry {
  id: string;
  followUpId: string;
  title: string;
  status: InquiryStatus;
  priority: InquiryPriority;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  assignedTo: string | null;
  assignedToName?: string | null;
  assignedToRole?: string | null;
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: InquiryMessage[];
  followUpContext?: {
    patientName?: string;
    mrn?: string;
    appointmentDate?: string;
    severity?: string;
    departmentName?: string;
  };
}

export interface CreateInquiryInput {
  followUpId: string;
  title: string;
  initialMessage: string;
  priority?: InquiryPriority;
}

export interface ReplyInquiryInput {
  queryId: string;
  body: string;
  escalateToDoctor?: boolean;
}
