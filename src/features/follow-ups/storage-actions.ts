'use server';

import { createHash, randomUUID } from 'crypto';
import { requireUser } from '@/lib/auth/require-user';
import { createClient } from '@/lib/supabase/server';
import type { SourceDocumentRecord } from './schemas';

export interface UploadScanResponse {
  success: boolean;
  document?: SourceDocumentRecord;
  signedUrl?: string;
  error?: string;
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;
type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

/**
 * Validates file magic bytes to prevent MIME-spoofing and executable uploads.
 */
function verifyMagicBytes(buffer: Buffer): { valid: boolean; detectedMime?: AllowedMimeType } {
  if (buffer.length < 8) {
    return { valid: false };
  }

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { valid: true, detectedMime: 'application/pdf' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  return { valid: false };
}

/**
 * Uploads a scanned doctor form to private Supabase Storage.
 * Verifies magic bytes, calculates SHA-256 hash, stores metadata in source_documents,
 * and generates a short-lived signed URL (capped at <= 60 seconds).
 */
export async function uploadClinicalScan(
  formData: FormData
): Promise<UploadScanResponse> {
  try {
    const actor = await requireUser(['assistant', 'doctor']);
    const file = formData.get('file') as File | null;
    const followUpId = formData.get('followUpId') as string | null;

    if (!file) {
      return { success: false, error: 'No file provided for upload' };
    }

    // 1. Client-declared MIME validation
    if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
      return {
        success: false,
        error: `Invalid file format: ${file.type}. Only PDF, PNG, and JPEG documents are permitted.`,
      };
    }

    // 2. Size limit check (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { success: false, error: 'File size exceeds maximum permitted limit (10MB)' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Strict Magic Byte Verification (prevent executable or polyglot files)
    const magicCheck = verifyMagicBytes(buffer);
    if (!magicCheck.valid || magicCheck.detectedMime !== file.type) {
      return {
        success: false,
        error: 'File signature verification failed: magic bytes do not match permitted document types',
      };
    }

    // 4. SHA-256 Content Hash Calculation
    const sha256Hash = createHash('sha256').update(buffer).digest('hex');

    // 5. Generate secure random storage path (prevent predictable enumeration)
    const safeExt = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const storagePath = `scans/${randomUUID()}.${safeExt}`;

    const supabase = await createClient();

    // 6. Upload to private Supabase Storage bucket 'follow_up_scans'
    const { error: uploadError } = await supabase.storage
      .from('follow_up_scans')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Storage upload failed: ${uploadError.message}`,
      };
    }

    // 7. Insert record into source_documents table
    const { data: docRecord, error: docError } = await supabase
      .from('source_documents')
      .insert({
        follow_up_id: followUpId || null,
        storage_path: storagePath,
        file_name: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
        mime_type: file.type,
        file_size_bytes: file.size,
        sha256_hash: sha256Hash,
        uploaded_by: actor.id,
      })
      .select('*')
      .single();

    if (docError || !docRecord) {
      return {
        success: false,
        error: `Failed to record document metadata: ${docError?.message}`,
      };
    }

    // 8. Generate short-lived signed URL (strictly <= 60s per specification §8.6)
    const { data: signedData, error: signError } = await supabase.storage
      .from('follow_up_scans')
      .createSignedUrl(storagePath, 60);

    return {
      success: true,
      document: {
        id: docRecord.id,
        followUpId: docRecord.follow_up_id,
        storagePath: docRecord.storage_path,
        fileName: docRecord.file_name,
        mimeType: docRecord.mime_type,
        fileSizeBytes: Number(docRecord.file_size_bytes),
        sha256Hash: docRecord.sha256_hash,
        uploadedBy: docRecord.uploaded_by,
        createdAt: docRecord.created_at,
      },
      signedUrl: signError ? undefined : signedData?.signedUrl,
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'An unexpected error occurred during scan upload' };
  }
}

/**
 * Obtains a short-lived signed URL for an existing source document.
 * Expiry is capped at a maximum of 60 seconds.
 */
export async function getScanSignedUrl(
  documentId: string,
  expiresInSeconds = 60
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    await requireUser(['assistant', 'doctor', 'department_head', 'follow_up_head']);

    const maxExpiry = Math.min(Math.max(1, expiresInSeconds), 60);
    const supabase = await createClient();

    const { data: doc, error: docError } = await supabase
      .from('source_documents')
      .select('storage_path')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return { success: false, error: 'Document not found or access denied' };
    }

    const { data, error } = await supabase.storage
      .from('follow_up_scans')
      .createSignedUrl(doc.storage_path, maxExpiry);

    if (error || !data?.signedUrl) {
      return { success: false, error: error?.message || 'Could not generate signed URL' };
    }

    return { success: true, signedUrl: data.signedUrl };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to generate signed document URL' };
  }
}
