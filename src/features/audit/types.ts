export type AuditEventOutcome = 'success' | 'failure' | 'denied';

export interface AuditEvent {
  id: string;
  actorId: string | null;
  actorName?: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string;
  outcome: AuditEventOutcome;
  reason: string | null;
  correlationId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LogAuditEventParams {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  outcome?: AuditEventOutcome;
  reason?: string | null;
  correlationId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export interface AuditFilterParams {
  action?: string;
  targetType?: string;
  outcome?: AuditEventOutcome;
  actorId?: string;
  limit?: number;
  offset?: number;
}
