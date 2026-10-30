/**
 * Synthetic Test User Fixtures for all 7 roles in the Hospital Follow-Up System.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §4.
 */

export interface TestUser {
  id: string;
  email: string;
  fullName: string;
  role: 'reception' | 'assistant' | 'doctor' | 'department_head' | 'coordinator' | 'follow_up_head' | 'it_admin';
  departmentId?: string | null;
  departmentName?: string | null;
  status: 'active' | 'invited' | 'deactivated' | 'pending';
  password: string;
}

export const TEST_DEPARTMENTS = {
  CARDIOLOGY: { id: 'dept-cardio-001', name: 'Cardiology' },
  NEUROLOGY: { id: 'dept-neuro-002', name: 'Neurology' },
  ORTHOPEDICS: { id: 'dept-ortho-003', name: 'Orthopedics' },
} as const;

export type TestUserKey =
  | 'itAdmin'
  | 'reception'
  | 'assistantCardio'
  | 'doctorCardio'
  | 'deptHeadCardio'
  | 'doctorNeuro'
  | 'deptHeadNeuro'
  | 'coordinatorPrimary'
  | 'coordinatorSecondary'
  | 'followUpHead'
  | 'deactivatedUser';

export const TEST_USERS: Record<TestUserKey, TestUser> = {
  // IT Admin (Privileged Console)
  itAdmin: {
    id: 'usr-itadmin-0001',
    email: 'it.admin@hospital.test',
    fullName: 'David IT Administrator',
    role: 'it_admin',
    departmentId: null,
    status: 'active',
    password: 'Password123!',
  },

  // Operational Role 1: Reception
  reception: {
    id: 'usr-reception-0002',
    email: 'reception.one@hospital.test',
    fullName: 'Ramesh Receptionist',
    role: 'reception',
    departmentId: null,
    status: 'active',
    password: 'Password123!',
  },

  // Operational Role 2: Doctor's Assistant (Cardiology)
  assistantCardio: {
    id: 'usr-assistant-0003',
    email: 'assistant.cardio@hospital.test',
    fullName: 'Ananya Assistant',
    role: 'assistant',
    departmentId: TEST_DEPARTMENTS.CARDIOLOGY.id,
    departmentName: TEST_DEPARTMENTS.CARDIOLOGY.name,
    status: 'active',
    password: 'Password123!',
  },

  // Operational Role 3: Doctor (Cardiology)
  doctorCardio: {
    id: 'usr-doctor-0004',
    email: 'dr.sharma.cardio@hospital.test',
    fullName: 'Dr. Vivek Sharma',
    role: 'doctor',
    departmentId: TEST_DEPARTMENTS.CARDIOLOGY.id,
    departmentName: TEST_DEPARTMENTS.CARDIOLOGY.name,
    status: 'active',
    password: 'Password123!',
  },

  // Operational Role 4: Department Head (Cardiology)
  deptHeadCardio: {
    id: 'usr-depthead-0005',
    email: 'head.cardio@hospital.test',
    fullName: 'Dr. Meenakshi Sundaram',
    role: 'department_head',
    departmentId: TEST_DEPARTMENTS.CARDIOLOGY.id,
    departmentName: TEST_DEPARTMENTS.CARDIOLOGY.name,
    status: 'active',
    password: 'Password123!',
  },

  // Doctor in another department (Neurology) for cross-department isolation tests
  doctorNeuro: {
    id: 'usr-doctor-0006',
    email: 'dr.patel.neuro@hospital.test',
    fullName: 'Dr. Aris Patel',
    role: 'doctor',
    departmentId: TEST_DEPARTMENTS.NEUROLOGY.id,
    departmentName: TEST_DEPARTMENTS.NEUROLOGY.name,
    status: 'active',
    password: 'Password123!',
  },

  // Department Head in another department (Neurology) for cross-department tests
  deptHeadNeuro: {
    id: 'usr-depthead-0007',
    email: 'head.neuro@hospital.test',
    fullName: 'Dr. Sanjay Mukherjee',
    role: 'department_head',
    departmentId: TEST_DEPARTMENTS.NEUROLOGY.id,
    departmentName: TEST_DEPARTMENTS.NEUROLOGY.name,
    status: 'active',
    password: 'Password123!',
  },

  // Operational Role 5: Follow-up Coordinator
  coordinatorPrimary: {
    id: 'usr-coordinator-0008',
    email: 'coordinator.primary@hospital.test',
    fullName: 'Kavita Coordinator',
    role: 'coordinator',
    departmentId: null,
    status: 'active',
    password: 'Password123!',
  },

  // Second Coordinator for reassignment and concurrency tests
  coordinatorSecondary: {
    id: 'usr-coordinator-0009',
    email: 'coordinator.secondary@hospital.test',
    fullName: 'Deepak Coordinator',
    role: 'coordinator',
    departmentId: null,
    status: 'active',
    password: 'Password123!',
  },

  // Operational Role 6: Follow-up Head
  followUpHead: {
    id: 'usr-fuhead-0010',
    email: 'head.followup@hospital.test',
    fullName: 'Sunita Follow-up Head',
    role: 'follow_up_head',
    departmentId: null,
    status: 'active',
    password: 'Password123!',
  },

  // Deactivated user fixture for access revocation tests
  deactivatedUser: {
    id: 'usr-deact-0011',
    email: 'deactivated.staff@hospital.test',
    fullName: 'Former Staff Member',
    role: 'coordinator',
    departmentId: null,
    status: 'deactivated',
    password: 'Password123!',
  },
};
