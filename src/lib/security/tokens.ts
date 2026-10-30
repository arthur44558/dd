import crypto from 'node:crypto';

export interface GeneratedToken {
  rawToken: string;
  tokenHash: string;
}

/**
 * Generates a 32-byte cryptographically secure random token and its SHA-256 hash.
 */
export function generateSecureToken(): GeneratedToken {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

/**
 * Computes the SHA-256 hex digest of a user-supplied token.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}
