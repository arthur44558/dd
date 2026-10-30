import type { UserRole } from '@/types/auth';

export type Permission =
  | 'manage_accounts'
  | 'view_audit_logs'
  | 'register_patient'
  | 'intake_followup'
  | 'review_followup'
  | 'approve_corrections'
  | 'send_reminders'
  | 'view_analytics';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  it_admin: ['manage_accounts', 'view_audit_logs'],
  reception: ['register_patient'],
  assistant: ['intake_followup', 'register_patient'],
  doctor: ['review_followup'],
  department_head: ['review_followup', 'approve_corrections'],
  coordinator: ['send_reminders'],
  follow_up_head: ['view_analytics', 'send_reminders'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
