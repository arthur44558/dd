/**
 * Synthetic Patient Fixtures for the Hospital Follow-Up Continuity System.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §5.1, §7.1.
 * ALL DATA IS SYNTHETIC AND VISIBLY MARKED AS TEST/DEMO DATA.
 */

export interface SyntheticContact {
  id?: string;
  phoneNumber: string;
  relationship: 'self' | 'spouse' | 'child' | 'caregiver' | 'other';
  isPrimary: boolean;
  isShared: boolean;
  isVerified: boolean;
}

export interface SyntheticPatient {
  id: string;
  mrn: string;
  fullName: string;
  dob: string; // YYYY-MM-DD
  gender: 'male' | 'female' | 'other';
  primaryPhone: string;
  contacts: SyntheticContact[];
  address?: string;
  isSyntheticDemo: true;
}

export type SyntheticPatientKey =
  | 'rajeshKumar'
  | 'priyaSharma'
  | 'mohammedAli'
  | 'sunitaPatelSenior'
  | 'sunitaPatelJunior';

export const SYNTHETIC_PATIENTS: Record<SyntheticPatientKey, SyntheticPatient> = {
  // Scenario Patient A: Standard patient with verified private contact
  rajeshKumar: {
    id: 'pat-synth-001',
    mrn: 'SYN-MRN-2026-001',
    fullName: 'Rajesh Kumar [SYNTHETIC DEMO]',
    dob: '1978-05-14',
    gender: 'male',
    primaryPhone: '+919876543210',
    contacts: [
      {
        phoneNumber: '+919876543210',
        relationship: 'self',
        isPrimary: true,
        isShared: false,
        isVerified: true,
      },
    ],
    address: 'Flat 402, Greenfield Apts, Sector 4, New Delhi',
    isSyntheticDemo: true,
  },

  // Scenario Patient B: Patient with SHARED contact (spouse) requiring confidentiality warning
  priyaSharma: {
    id: 'pat-synth-002',
    mrn: 'SYN-MRN-2026-002',
    fullName: 'Priya Sharma [SYNTHETIC DEMO]',
    dob: '1985-11-23',
    gender: 'female',
    primaryPhone: '+919812345678',
    contacts: [
      {
        phoneNumber: '+919812345678',
        relationship: 'spouse',
        isPrimary: true,
        isShared: true, // SHARED CONTACT FLAG!
        isVerified: true,
      },
      {
        phoneNumber: '+919812345679',
        relationship: 'self',
        isPrimary: false,
        isShared: false,
        isVerified: false,
      },
    ],
    address: '12-B Baker Street, Vasant Vihar, New Delhi',
    isSyntheticDemo: true,
  },

  // Scenario Patient C: Multi-contact patient with caregiver
  mohammedAli: {
    id: 'pat-synth-003',
    mrn: 'SYN-MRN-2026-003',
    fullName: 'Mohammed Ali [SYNTHETIC DEMO]',
    dob: '1952-03-08',
    gender: 'male',
    primaryPhone: '+919711223344',
    contacts: [
      {
        phoneNumber: '+919711223344',
        relationship: 'self',
        isPrimary: true,
        isShared: false,
        isVerified: true,
      },
      {
        phoneNumber: '+919711223355',
        relationship: 'child',
        isPrimary: false,
        isShared: true,
        isVerified: true,
      },
      {
        phoneNumber: '+919711223366',
        relationship: 'caregiver',
        isPrimary: false,
        isShared: false,
        isVerified: true,
      },
    ],
    address: 'Plot 88, Okhla Industrial Area, New Delhi',
    isSyntheticDemo: true,
  },

  // Deduplication Pair: Same name "Sunita Patel", distinct DOB & MRN to test deduplication search warnings
  sunitaPatelSenior: {
    id: 'pat-synth-004',
    mrn: 'SYN-MRN-2026-004',
    fullName: 'Sunita Patel [SYNTHETIC DEMO]',
    dob: '1960-01-15',
    gender: 'female',
    primaryPhone: '+919655443322',
    contacts: [
      {
        phoneNumber: '+919655443322',
        relationship: 'self',
        isPrimary: true,
        isShared: false,
        isVerified: true,
      },
    ],
    isSyntheticDemo: true,
  },

  sunitaPatelJunior: {
    id: 'pat-synth-005',
    mrn: 'SYN-MRN-2026-005',
    fullName: 'Sunita Patel [SYNTHETIC DEMO]',
    dob: '1992-09-20',
    gender: 'female',
    primaryPhone: '+919655443322', // Same phone number! Disambiguation trigger
    contacts: [
      {
        phoneNumber: '+919655443322',
        relationship: 'spouse',
        isPrimary: true,
        isShared: true,
        isVerified: true,
      },
    ],
    isSyntheticDemo: true,
  },
};
