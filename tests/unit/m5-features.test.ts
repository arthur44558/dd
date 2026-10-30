import { describe, it, expect } from 'vitest';
import {
  MockFormExtractionProvider,
  getFormExtractionProvider,
} from '@/lib/ai/mock-ai-provider';

describe('M5 AI Form Extraction Subsystem', () => {
  it('returns deterministic extraction output for identical document references', async () => {
    const provider = new MockFormExtractionProvider();

    const input1 = {
      documentReference: 'doc-scan-001.pdf',
      expectedFields: ['patientName', 'dob', 'appointmentDate', 'severity', 'notes'],
      schemaVersion: '1.0',
    };

    const input2 = {
      documentReference: 'doc-scan-001.pdf',
      expectedFields: ['patientName', 'dob', 'appointmentDate', 'severity', 'notes'],
      schemaVersion: '1.0',
    };

    const result1 = await provider.extract(input1);
    const result2 = await provider.extract(input2);

    expect(result1.inputHash).toBe(result2.inputHash);
    expect(result1.fields.patientName).toBe(result2.fields.patientName);
    expect(result1.confidence.patientName).toBe(0.94);
    expect(result1.confidence.severity).toBe(0.72); // Low confidence trigger for review
  });

  it('flags warning when test double mock is active', async () => {
    const { provider } = getFormExtractionProvider();
    expect(provider).toBeInstanceOf(MockFormExtractionProvider);

    const result = await provider.extract({
      documentReference: 'test-scan.png',
      expectedFields: ['severity'],
      schemaVersion: '1.0',
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      result.warnings.some((w) => w.includes('TEST DOUBLE') || w.includes('confirmation'))
    ).toBe(true);
  });
});

describe('M5 Analytics Calculation Invariants', () => {
  it('calculates completion and overdue rates correctly with rounding', () => {
    const total = 50;
    const completed = 35;
    const overdue = 5;

    const completionRate = Math.round((completed / total) * 1000) / 10;
    const overdueRate = Math.round((overdue / total) * 1000) / 10;

    expect(completionRate).toBe(70.0);
    expect(overdueRate).toBe(10.0);
  });

  it('safely handles zero total cases without division by zero', () => {
    const total = 0;
    const completed = 0;
    const overdue = 0;

    const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    const overdueRate = total > 0 ? Math.round((overdue / total) * 1000) / 10 : 0;

    expect(completionRate).toBe(0);
    expect(overdueRate).toBe(0);
  });
});

describe('M5 Sensitive Key Sanitization Rules', () => {
  const SENSITIVE_KEY_REGEX = /(password|token|secret|key|authorization|bearer|cookie|salt|hash|credential)/i;

  function sanitizeObject(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeObject);

    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        clean[key] = '[REDACTED]';
      } else if (val && typeof val === 'object') {
        clean[key] = sanitizeObject(val);
      } else {
        clean[key] = val;
      }
    }
    return clean;
  }

  it('redacts sensitive keys while preserving safe audit metadata', () => {
    const rawPayload = {
      userEmail: 'staff@hospital.org',
      apiKey: 'sk-secret-12345',
      sessionToken: 'jwt.token.here',
      authPassword: 'SuperSecretPassword!',
      actionDetails: {
        reason: 'Clinical inquiry escalation',
        nestedSecret: 'topsecret',
        timestamp: '2026-10-30T04:00:00Z',
      },
    };

    const sanitized = sanitizeObject(rawPayload) as typeof rawPayload;

    expect(sanitized.userEmail).toBe('staff@hospital.org');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.sessionToken).toBe('[REDACTED]');
    expect(sanitized.authPassword).toBe('[REDACTED]');
    expect(sanitized.actionDetails.reason).toBe('Clinical inquiry escalation');
    expect(sanitized.actionDetails.nestedSecret).toBe('[REDACTED]');
  });
});
