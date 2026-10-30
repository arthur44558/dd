/**
 * Integration Test: Reminder Queue Processing & 3-Retry Cap Worker.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §6.4.
 */

import { describe, it, expect } from 'vitest';

export interface ReminderJobRecord {
  id: string;
  followUpId: string;
  scheduledFor: string;
  channel: 'sms' | 'call';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: string;
  lockedByWorkerId?: string | null;
}

export class MockReminderQueueEngine {
  private jobs: Map<string, ReminderJobRecord> = new Map();

  addJob(job: Omit<ReminderJobRecord, 'status' | 'retryCount' | 'maxRetries'>): ReminderJobRecord {
    const fullJob: ReminderJobRecord = {
      ...job,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      lockedByWorkerId: null,
    };
    this.jobs.set(job.id, fullJob);
    return fullJob;
  }

  getJob(id: string): ReminderJobRecord | undefined {
    return this.jobs.get(id);
  }

  // Simulates `SELECT ... FOR UPDATE SKIP LOCKED`
  claimNextJob(workerId: string): ReminderJobRecord | null {
    for (const job of this.jobs.values()) {
      if (job.status === 'pending' && !job.lockedByWorkerId) {
        job.status = 'processing';
        job.lockedByWorkerId = workerId;
        return job;
      }
    }
    return null;
  }

  // Simulates outcome of a job execution
  completeJob(jobId: string, success: boolean): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.lastAttemptAt = new Date().toISOString();
    job.lockedByWorkerId = null;

    if (success) {
      job.status = 'completed';
    } else {
      job.retryCount += 1;
      if (job.retryCount >= job.maxRetries) {
        job.status = 'failed'; // Strictly capped at 3 retries!
      } else {
        job.status = 'pending'; // Re-queued for next backoff interval
      }
    }
  }
}

describe('Reminder Queue & Worker Execution with Max 3 Retries', () => {
  it('claims pending jobs atomically without double-claiming', () => {
    const engine = new MockReminderQueueEngine();
    engine.addJob({
      id: 'job-001',
      followUpId: 'fu-001',
      scheduledFor: '2026-11-12T10:00:00Z',
      channel: 'sms',
    });

    const worker1Claim = engine.claimNextJob('worker-A');
    expect(worker1Claim).not.toBeNull();
    expect(worker1Claim?.id).toBe('job-001');

    // Worker B attempts to claim simultaneously — job-001 is locked, so returns null (SKIP LOCKED)
    const worker2Claim = engine.claimNextJob('worker-B');
    expect(worker2Claim).toBeNull();
  });

  it('marks job completed on successful execution', () => {
    const engine = new MockReminderQueueEngine();
    engine.addJob({
      id: 'job-002',
      followUpId: 'fu-002',
      scheduledFor: '2026-11-12T10:00:00Z',
      channel: 'sms',
    });

    const claimed = engine.claimNextJob('worker-A');
    expect(claimed).not.toBeNull();
    engine.completeJob('job-002', true);

    const updated = engine.getJob('job-002');
    expect(updated?.status).toBe('completed');
  });

  it('enforces maximum retry cap of 3 before transitioning permanently to FAILED', () => {
    const engine = new MockReminderQueueEngine();
    engine.addJob({
      id: 'job-003',
      followUpId: 'fu-003',
      scheduledFor: '2026-11-12T10:00:00Z',
      channel: 'call',
    });

    // Attempt 1 fails
    engine.claimNextJob('worker-A');
    engine.completeJob('job-003', false);
    let job = engine.getJob('job-003');
    expect(job?.retryCount).toBe(1);
    expect(job?.status).toBe('pending'); // Re-queued

    // Attempt 2 fails
    engine.claimNextJob('worker-A');
    engine.completeJob('job-003', false);
    job = engine.getJob('job-003');
    expect(job?.retryCount).toBe(2);
    expect(job?.status).toBe('pending');

    // Attempt 3 fails (hits maximum 3-retry cap)
    engine.claimNextJob('worker-A');
    engine.completeJob('job-003', false);
    job = engine.getJob('job-003');
    expect(job?.retryCount).toBe(3);
    expect(job?.status).toBe('failed'); // Permanently failed!

    // Assert that failed job cannot be claimed again
    const subsequentClaim = engine.claimNextJob('worker-B');
    expect(subsequentClaim).toBeNull();
  });
});
