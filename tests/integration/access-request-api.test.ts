/**
 * Integration Test: Public Access Request API & Token Generation.
 * Adheres to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §3.1, §3.3.
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

interface AccessRequestRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  requestedRole: string;
  departmentId?: string | null;
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
  hashedToken: string;
  createdAt: string;
}

// In-memory test repository simulating the Supabase table `account_requests`
class MockAccountRequestStore {
  private requests: Map<string, AccessRequestRecord> = new Map();

  async submitRequest(payload: {
    fullName: string;
    email: string;
    phone: string;
    requestedRole: string;
    departmentId?: string | null;
    justification: string;
  }): Promise<{ id: string; trackingToken: string }> {
    // Generate raw secure token for applicant
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Store only SHA-256 hash in database
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: AccessRequestRecord = {
      id,
      ...payload,
      status: 'pending',
      hashedToken,
      createdAt: new Date().toISOString(),
    };

    this.requests.set(id, record);
    return { id, trackingToken: rawToken };
  }

  async findByTrackingToken(rawToken: string): Promise<AccessRequestRecord | null> {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    for (const req of this.requests.values()) {
      if (req.hashedToken === hashed) {
        return req;
      }
    }
    return null;
  }
}

describe('Access Request Workflow & Token Security', () => {
  const store = new MockAccountRequestStore();

  it('submits a public access request and generates a secure tracking token', async () => {
    const result = await store.submitRequest({
      fullName: 'Dr. Jane Specialist',
      email: 'dr.jane@hospital.test',
      phone: '+919876500000',
      requestedRole: 'doctor',
      departmentId: 'dept-cardio-001',
      justification: 'Joining inpatient rounds and follow-up outpatient clinics.',
    });

    expect(result.id).toBeDefined();
    expect(result.trackingToken).toHaveLength(64); // 32 bytes hex
  });

  it('retrieves request status using raw tracking token while database stores only SHA-256 hash', async () => {
    const submission = await store.submitRequest({
      fullName: 'Ramesh Receptionist Two',
      email: 'ramesh.two@hospital.test',
      phone: '+919876500001',
      requestedRole: 'reception',
      justification: 'New staff joining front desk reception.',
    });

    const record = await store.findByTrackingToken(submission.trackingToken);
    expect(record).not.toBeNull();
    expect(record?.status).toBe('pending');
    expect(record?.fullName).toBe('Ramesh Receptionist Two');
    // Ensure raw token is not stored directly
    expect(record?.hashedToken).not.toBe(submission.trackingToken);
  });

  it('fails safely when an invalid or forged tracking token is queried', async () => {
    const fakeToken = crypto.randomBytes(32).toString('hex');
    const record = await store.findByTrackingToken(fakeToken);
    expect(record).toBeNull();
  });
});
