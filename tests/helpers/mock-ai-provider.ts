/**
 * Mock Form Extraction Provider Test Double.
 * Implements deterministic AI extraction for testing scan processing without live API costs or outages.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §9.3 and PROJECT.md Feature 23.
 */

export interface FormExtractionResult {
  confidenceScore: number;
  extractedFields: {
    patientName?: string;
    mrn?: string;
    appointmentDate?: string;
    severity?: 'routine' | 'moderate' | 'high' | 'critical';
    followUpRequired?: boolean;
    clinicalNotes?: string;
  };
  uncertainFields: string[];
  rawSummary: string;
}

export interface FormExtractionProvider {
  extractFromScan(fileBuffer: Buffer, filename: string): Promise<FormExtractionResult>;
}

export class MockFormExtractionProvider implements FormExtractionProvider {
  private simulateFailure: boolean = false;
  private customResult: FormExtractionResult | null = null;

  constructor(options?: { simulateFailure?: boolean; customResult?: FormExtractionResult }) {
    if (options?.simulateFailure) this.simulateFailure = true;
    if (options?.customResult) this.customResult = options.customResult;
  }

  async extractFromScan(_fileBuffer: Buffer, _filename: string): Promise<FormExtractionResult> {
    if (this.simulateFailure) {
      throw new Error('MOCK_AI_PROVIDER_ERROR: Simulated model timeout or provider outage.');
    }

    if (this.customResult) {
      return this.customResult;
    }

    // Default deterministic extraction for synthetic demo scan
    return {
      confidenceScore: 0.94,
      extractedFields: {
        patientName: 'Rajesh Kumar [SYNTHETIC DEMO]',
        mrn: 'SYN-MRN-2026-001',
        appointmentDate: '2026-11-14',
        severity: 'routine',
        followUpRequired: true,
        clinicalNotes: 'Post-CABG follow-up. Check surgical wound healing and review ECG.',
      },
      uncertainFields: [],
      rawSummary: 'Extracted post-CABG discharge follow-up form with high confidence.',
    };
  }
}
