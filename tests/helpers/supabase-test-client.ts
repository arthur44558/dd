/**
 * Supabase test client helper for integration and contract tests.
 * Provides typed helper to query test DB and simulate authenticated user sessions.
 */

import { TEST_USERS, TestUser } from '../fixtures/auth-users';

export interface TestSession {
  user: TestUser;
  accessToken: string;
  cookies: Record<string, string>;
}

/**
 * Creates a synthetic authenticated session object for test assertions.
 */
export function createMockSession(roleKey: keyof typeof TEST_USERS): TestSession {
  const user = TEST_USERS[roleKey];
  if (!user) {
    throw new Error(`Test user for roleKey '${roleKey}' not found in fixtures`);
  }

  // Simulated synthetic JWT token payload for testing headers
  const syntheticToken = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      department_id: user.departmentId,
      status: user.status,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64');

  return {
    user,
    accessToken: `synthetic-jwt-${syntheticToken}`,
    cookies: {
      'sb-access-token': `synthetic-jwt-${syntheticToken}`,
      'sb-refresh-token': `synthetic-refresh-${user.id}`,
    },
  };
}

/**
 * Validates whether a given user role has permission to access a target route according to Spec §4.
 */
export function isRoutePermittedForRole(route: string, role: TestUser['role']): boolean {
  const roleRouteMap: Record<TestUser['role'], string[]> = {
    reception: ['/reception', '/patients'],
    assistant: ['/assistant', '/follow-ups', '/queries'],
    doctor: ['/doctor', '/follow-ups', '/queries'],
    department_head: ['/department-head', '/follow-ups', '/approvals', '/queries'],
    coordinator: ['/coordinator', '/follow-ups', '/queries'],
    follow_up_head: ['/follow-up-head', '/coordinator', '/metrics'],
    it_admin: ['/it-admin', '/audit'],
  };

  const allowedPrefixes = roleRouteMap[role] || [];
  return allowedPrefixes.some((prefix) => route.startsWith(prefix));
}
