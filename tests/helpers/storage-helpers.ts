/**
 * Storage helpers for file upload and MIME/magic byte validation.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §8.6.
 */

import crypto from 'crypto';

export interface FileValidationResult {
  isValid: boolean;
  detectedMime: string;
  sha256Hash: string;
  error?: string;
}

/**
 * Validates a file buffer against required magic byte headers.
 * Supported formats: PDF, PNG, JPEG.
 */
export function validateScanFile(buffer: Buffer, claimedMime: string): FileValidationResult {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      detectedMime: 'empty',
      sha256Hash: hash,
      error: 'File buffer is empty (0 bytes).',
    };
  }

  // Max 10MB limit check
  const MAX_SIZE = 10 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    return {
      isValid: false,
      detectedMime: 'unknown',
      sha256Hash: hash,
      error: `File size ${buffer.length} exceeds 10MB limit.`,
    };
  }

  // PDF magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return {
      isValid: true,
      detectedMime: 'application/pdf',
      sha256Hash: hash,
    };
  }

  // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return {
      isValid: true,
      detectedMime: 'image/png',
      sha256Hash: hash,
    };
  }

  // JPEG magic bytes: 0xFF, 0xD8, 0xFF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return {
      isValid: true,
      detectedMime: 'image/jpeg',
      sha256Hash: hash,
    };
  }

  // Adversarial check: DOS MZ header
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return {
      isValid: false,
      detectedMime: 'application/x-dosexec',
      sha256Hash: hash,
      error: 'Security violation: executable file format detected.',
    };
  }

  return {
    isValid: false,
    detectedMime: 'unknown',
    sha256Hash: hash,
    error: `Unsupported file format. Claimed MIME: ${claimedMime}`,
  };
}
