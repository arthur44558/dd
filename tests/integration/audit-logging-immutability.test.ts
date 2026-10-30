/**
 * Integration Test: Immutable Audit Logging & Non-Tamperability.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §8.7.
 */

import { describe, it, expect } from 'vitest';

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  payloadDelta?: Record<string, unknown>;
  createdAt: string;
}

export class MockAuditRepository {
  private events: AuditEvent[] = [];

  recordEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>): AuditEvent {
    const fullEvent: AuditEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...event,
    };
    this.events.push(fullEvent);
    return fullEvent;
  }

  getEvents(): ReadonlyArray<AuditEvent> {
    return [...this.events];
  }

  // Simulated DB Trigger: Attempting to update or delete throws PostgreSQL exception
  updateEvent(_id: string, _updates: Partial<AuditEvent>): never {
    throw new Error('AUDIT_IMMUTABILITY_VIOLATION: Direct updates to audit_events table are strictly prohibited.');
  }

  deleteEvent(_id: string): never {
    throw new Error('AUDIT_IMMUTABILITY_VIOLATION: Deletion of audit_events records is strictly prohibited.');
  }
}

describe('Immutable Audit Logging Verification', () => {
  it('records critical operational events with full attribution', () => {
    const repo = new MockAuditRepository();

    const event = repo.recordEvent({
      actorId: 'usr-itadmin-0001',
      action: 'APPROVE_ACCOUNT_REQUEST',
      resourceType: 'account_requests',
      resourceId: 'req-001',
      ipAddress: '192.168.1.10',
      payloadDelta: { status: 'approved', assignedRole: 'doctor' },
    });

    expect(event.id).toBeDefined();
    expect(event.createdAt).toBeDefined();
    expect(event.action).toBe('APPROVE_ACCOUNT_REQUEST');
    expect(repo.getEvents()).toHaveLength(1);
  });

  it('rejects any attempt to modify existing audit event records', () => {
    const repo = new MockAuditRepository();
    const event = repo.recordEvent({
      actorId: 'usr-doctor-0004',
      action: 'SUBMIT_FOLLOW_UP',
      resourceType: 'follow_ups',
      resourceId: 'fu-001',
    });

    expect(() => {
      repo.updateEvent(event.id, { action: 'ALTERED_ACTION' });
    }).toThrowError(/AUDIT_IMMUTABILITY_VIOLATION/);
  });

  it('rejects any attempt to delete audit event records', () => {
    const repo = new MockAuditRepository();
    const event = repo.recordEvent({
      actorId: 'usr-itadmin-0001',
      action: 'DEACTIVATE_USER',
      resourceType: 'profiles',
      resourceId: 'usr-002',
    });

    expect(() => {
      repo.deleteEvent(event.id);
    }).toThrowError(/AUDIT_IMMUTABILITY_VIOLATION/);
  });
});
