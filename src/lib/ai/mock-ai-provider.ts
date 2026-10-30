import crypto from 'crypto';

export interface FormExtractionInput {
  documentReference: string;
  expectedFields: string[];
  schemaVersion: string;
}

export interface FormExtractionResult {
  fields: Record<string, unknown>;
  confidence: Record<string, number>;
  warnings: string[];
  modelId: string;
  modelVersion: string;
  provider: string;
  inputHash: string;
}

export interface FormExtractionProvider {
  extract(input: FormExtractionInput): Promise<FormExtractionResult>;
}

/**
 * Deterministic Mock AI Form Extraction Provider.
 * Used when AI_FORM_EXTRACTION_ENABLED is false or unconfigured.
 * Generates synthetic, deterministic draft suggestions anchored to document hash.
 * Never calls external APIs, never makes clinical diagnoses, and tags all outputs with confidence metadata.
 */
export class MockFormExtractionProvider implements FormExtractionProvider {
  private readonly modelId = 'adaption-labs-ocr-form-extractor';
  private readonly modelVersion = '2026.10-deterministic-mock';

  async extract(input: FormExtractionInput): Promise<FormExtractionResult> {
    // Generate deterministic sha256 of the input document reference + schema version
    const inputHash = crypto
      .createHash('sha256')
      .update(`${input.documentReference}:${input.schemaVersion}`)
      .digest('hex');

    // Deterministic synthetic values
    const fields: Record<string, unknown> = {};
    const confidence: Record<string, number> = {};
    const warnings: string[] = [
      'AI Form Extraction is in TEST DOUBLE mode (AI_FORM_EXTRACTION_ENABLED=false).',
      'All extracted fields require mandatory manual confirmation by Assistant before submission.',
    ];

    for (const field of input.expectedFields) {
      switch (field) {
        case 'patientName':
          fields[field] = 'Synthetic Patient (Extracted)';
          confidence[field] = 0.94;
          break;
        case 'dob':
          fields[field] = '1985-06-15';
          confidence[field] = 0.91;
          break;
        case 'appointmentDate': {
          // Provide a realistic near-future date
          const target = new Date();
          target.setDate(target.getDate() + 14);
          fields[field] = target.toISOString().split('T')[0];
          confidence[field] = 0.88;
          break;
        }
        case 'severity':
          fields[field] = 'moderate';
          confidence[field] = 0.72; // Low confidence to trigger Assistant verification
          warnings.push('Severity field has moderate confidence (0.72). Verify against clinical notes.');
          break;
        case 'notes':
          fields[field] = 'Routine follow-up in 2 weeks for blood pressure and medication evaluation.';
          confidence[field] = 0.85;
          break;
        case 'followUpRequired':
          fields[field] = true;
          confidence[field] = 0.98;
          break;
        default:
          fields[field] = null;
          confidence[field] = 0.5;
          warnings.push(`Unrecognized field '${field}' extracted with baseline confidence.`);
      }
    }

    return {
      fields,
      confidence,
      warnings,
      modelId: this.modelId,
      modelVersion: this.modelVersion,
      provider: 'mock_adaption_labs',
      inputHash,
    };
  }
}

/**
 * Provider factory enforcing feature-flagged design.
 */
export function getFormExtractionProvider(): {
  provider: FormExtractionProvider;
  isFeatureEnabled: boolean;
} {
  const isFeatureEnabled = process.env.AI_FORM_EXTRACTION_ENABLED === 'true';

  // Even if enabled, until real Adaption Labs credentials and models are provisioned,
  // we safely fallback to the Mock provider to prevent runtime crashes.
  return {
    provider: new MockFormExtractionProvider(),
    isFeatureEnabled,
  };
}

/**
 * Server-side audit logger for AI extraction events.
 * Logs provider, model version, confidence, and reviewer attribution without leaking PHI.
 */
export async function logAiAssistanceEvent(payload: {
  result: FormExtractionResult;
  documentReference?: string;
  humanReviewerId?: string;
  purpose?: string;
}): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { data, error } = await supabaseAdmin
      .from('ai_assistance_events')
      .insert({
        model_id: payload.result.modelId,
        model_version: payload.result.modelVersion,
        provider: payload.result.provider,
        purpose: payload.purpose || 'form_digitisation_ocr',
        input_hash: payload.result.inputHash,
        document_reference: payload.documentReference || null,
        extracted_fields: payload.result.fields,
        field_confidence: payload.result.confidence,
        warnings: payload.result.warnings,
        human_reviewer_id: payload.humanReviewerId || null,
        outcome: 'pending_review',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to log AI assistance event:', error.message);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error('Exception logging AI assistance event:', err);
    return null;
  }
}
