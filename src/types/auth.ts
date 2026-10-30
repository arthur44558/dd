export type UserRole =
  | 'reception'
  | 'assistant'
  | 'doctor'
  | 'department_head'
  | 'coordinator'
  | 'follow_up_head'
  | 'it_admin';

export type AccountStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'invited'
  | 'active'
  | 'suspended'
  | 'deactivated';

export interface UserProfile {
  id: string; // auth.users UUID
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string | null;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentMembership {
  id: string;
  profileId: string;
  departmentId: string;
  role: UserRole;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorProfile {
  id: string;
  profileId: string;
  doctorId: string;
  medicalLicenseNumber: string;
  speciality: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountRequest {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  employeeId?: string | null;
  requestedRole: UserRole;
  departmentId?: string | null;
  justification: string;
  status: AccountStatus;
  statusTokenHash: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  authUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  departments?: {
    name: string;
    code: string;
  } | null;
}

export interface AccessRequestPayload {
  fullName: string;
  email: string;
  phone: string;
  employeeId?: string;
  requestedRole: UserRole;
  departmentId?: string;
  justification: string;
}
