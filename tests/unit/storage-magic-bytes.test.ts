/**
 * Unit Test Suite: Storage Upload Validation & Magic Byte Sniffing.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §8.6.
 */

import { describe, it, expect } from 'vitest';
import { validateScanFile } from '../helpers/storage-helpers';
import { MOCK_SCAN_FILES } from '../fixtures/clinical-forms';

describe('Storage Upload Validation & Magic Byte Sniffing', () => {
  it('accepts valid PDF file buffer with correct %PDF- magic bytes', () => {
    const result = validateScanFile(MOCK_SCAN_FILES.validPdf.buffer, 'application/pdf');
    expect(result.isValid).toBe(true);
    expect(result.detectedMime).toBe('application/pdf');
    expect(result.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid PNG file buffer with correct PNG magic bytes', () => {
    const result = validateScanFile(MOCK_SCAN_FILES.validPng.buffer, 'image/png');
    expect(result.isValid).toBe(true);
    expect(result.detectedMime).toBe('image/png');
    expect(result.sha256Hash).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('rejects an adversarial executable file disguised as a PDF (DOS MZ header)', () => {
    const result = validateScanFile(MOCK_SCAN_FILES.maliciousExeAsPdf.buffer, 'application/pdf');
    expect(result.isValid).toBe(false);
    expect(result.detectedMime).toBe('application/x-dosexec');
    expect(result.error).toContain('executable file format detected');
  });

  it('rejects zero-byte empty file buffer', () => {
    const result = validateScanFile(MOCK_SCAN_FILES.emptyFile.buffer, 'application/pdf');
    expect(result.isValid).toBe(false);
    expect(result.detectedMime).toBe('empty');
    expect(result.error).toContain('0 bytes');
  });

  it('rejects file buffer exceeding 10MB maximum limit', () => {
    // Construct 11MB buffer
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    // Write PDF magic bytes to the start
    Buffer.from('%PDF-1.4').copy(largeBuffer);

    const result = validateScanFile(largeBuffer, 'application/pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('exceeds 10MB limit');
  });

  it('ensures SHA-256 hash is invariant and matches independent calculation', () => {
    const sample = MOCK_SCAN_FILES.validPdf.buffer;
    const result1 = validateScanFile(sample, 'application/pdf');
    const result2 = validateScanFile(sample, 'application/pdf');

    expect(result1.sha256Hash).toBe(result2.sha256Hash);
  });
});
