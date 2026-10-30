'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FileText,
  Upload,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileCheck,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  clinicalIntakeSchema,
  type ClinicalIntakeInput,
} from '../schemas';
import { createDraftFollowUp } from '../actions';
import { uploadClinicalScan } from '../storage-actions';
import type { DedupSearchResult } from '@/features/patients/schemas';

export interface DoctorOption {
  id: string; // doctor_profiles UUID
  doctorId: string; // alphanumeric code
  fullName: string;
  speciality: string;
  departmentId: string;
  departmentName?: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

export interface ClinicalIntakeFormProps {
  selectedPatient?: DedupSearchResult | null;
  doctors: DoctorOption[];
  departments: DepartmentOption[];
  onSuccess?: (created: { id: string; currentVersion: number }) => void;
  onCancel?: () => void;
}

export function ClinicalIntakeForm({
  selectedPatient,
  doctors,
  departments,
  onSuccess,
  onCancel,
}: ClinicalIntakeFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Scan Upload State
  const [uploadingScan, setUploadingScan] = React.useState(false);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = React.useState<{
    id: string;
    fileName: string;
    signedUrl?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClinicalIntakeInput>({
    resolver: zodResolver(clinicalIntakeSchema),
    defaultValues: {
      patientId: selectedPatient?.patientId || '',
      doctorId: doctors[0]?.id || '',
      departmentId: departments[0]?.id || '',
      appointmentDate: '',
      followUpRequired: true,
      severity: 'routine',
      notes: '',
      sourceDocumentId: null,
    },
  });

  const watchDoctorId = watch('doctorId');
  const watchFollowUpRequired = watch('followUpRequired');

  // Sync selected patient
  React.useEffect(() => {
    if (selectedPatient) {
      setValue('patientId', selectedPatient.patientId);
    }
  }, [selectedPatient, setValue]);

  // Sync department when doctor changes
  React.useEffect(() => {
    const doc = doctors.find((d) => d.id === watchDoctorId);
    if (doc?.departmentId) {
      setValue('departmentId', doc.departmentId);
    }
  }, [watchDoctorId, doctors, setValue]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side MIME check
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setScanError('Only PDF, PNG, or JPG files are accepted.');
      return;
    }

    setUploadingScan(true);
    setScanError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await uploadClinicalScan(formData);

      if (res.success && res.document) {
        setUploadedDoc({
          id: res.document.id,
          fileName: res.document.fileName,
          signedUrl: res.signedUrl,
        });
        setValue('sourceDocumentId', res.document.id);
      } else {
        setScanError(res.error || 'Failed to upload document scan');
      }
    } catch {
      setScanError('An error occurred during scan upload');
    } finally {
      setUploadingScan(false);
    }
  };

  const onSubmit = async (data: ClinicalIntakeInput) => {
    if (!selectedPatient && !data.patientId) {
      setFormError('Please select a patient before creating a follow-up intake.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await createDraftFollowUp(data);
      if (res.success && res.data) {
        if (onSuccess) {
          onSuccess(res.data);
        }
      } else {
        setFormError(res.error || 'Failed to create follow-up draft');
      }
    } catch {
      setFormError('An unexpected error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Intake Error</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {/* Patient Identity Banner */}
      {selectedPatient ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-sky-800 uppercase tracking-wider block">
                Target Patient
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-bold text-slate-900">
                  {selectedPatient.fullName}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedPatient.mrn}
                </Badge>
              </div>
              <div className="text-xs text-slate-600 mt-1 flex gap-3">
                <span>
                  <strong>DOB:</strong> {selectedPatient.dob}
                </span>
                <span className="capitalize">
                  <strong>Gender:</strong> {selectedPatient.gender}
                </span>
                <span>
                  <strong>Phone:</strong> {selectedPatient.primaryPhone}
                </span>
              </div>
            </div>
            {selectedPatient.isSharedContact && (
              <Badge variant="warning" className="self-start sm:self-center">
                Shared Contact Number
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Patient Selected</AlertTitle>
          <AlertDescription>
            Search and verify the patient identity above before filling the clinical intake.
          </AlertDescription>
        </Alert>
      )}

      {/* Doctor & Department Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="doctorId">Attending Doctor *</Label>
          <Select id="doctorId" {...register('doctorId')}>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dr. {d.fullName} ({d.speciality} - {d.doctorId})
              </option>
            ))}
          </Select>
          {errors.doctorId && (
            <p className="text-xs text-red-600">{errors.doctorId.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="departmentId">Clinical Department *</Label>
          <Select id="departmentId" {...register('departmentId')}>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </Select>
          {errors.departmentId && (
            <p className="text-xs text-red-600">{errors.departmentId.message}</p>
          )}
        </div>
      </div>

      {/* Follow-up Required & Severity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <div className="space-y-2">
          <Label>Follow-Up Continuity *</Label>
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                value="true"
                checked={watchFollowUpRequired === true}
                onChange={() => setValue('followUpRequired', true)}
                className="text-sky-600"
              />
              <span>Follow-Up Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                value="false"
                checked={watchFollowUpRequired === false}
                onChange={() => setValue('followUpRequired', false)}
                className="text-slate-600"
              />
              <span>No Follow-Up Needed</span>
            </label>
          </div>
          <p className="text-xs text-slate-500">
            If marked &apos;No&apos;, no reminder jobs or appointment tasks will be scheduled.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="severity">Clinical Severity Level *</Label>
          <Select id="severity" {...register('severity')}>
            <option value="routine">Routine (Standard cadence)</option>
            <option value="moderate">Moderate (Enhanced priority)</option>
            <option value="high">High (Strict tracking)</option>
            <option value="critical">Critical (Immediate clinical oversight)</option>
          </Select>
          {errors.severity && (
            <p className="text-xs text-red-600">{errors.severity.message}</p>
          )}
        </div>
      </div>

      {/* Appointment Date (Mandatory when follow-up is required) */}
      {watchFollowUpRequired && (
        <div className="space-y-1 sm:w-1/2">
          <Label htmlFor="appointmentDate" className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-sky-600" />
            Next Appointment Date *
          </Label>
          <Input
            id="appointmentDate"
            type="date"
            {...register('appointmentDate')}
            aria-invalid={!!errors.appointmentDate}
          />
          {errors.appointmentDate && (
            <p className="text-xs text-red-600">{errors.appointmentDate.message}</p>
          )}
        </div>
      )}

      {/* Scan Document Upload */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Upload className="h-4 w-4 text-sky-600" />
              Scanned Doctor Follow-Up Form
            </Label>
            <p className="text-xs text-slate-500">
              Upload original physical form (PDF, PNG, JPG). Preserves exact original bytes and SHA-256 hash.
            </p>
          </div>
          {uploadedDoc && (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Uploaded & Verified
            </Badge>
          )}
        </div>

        {scanError && (
          <Alert variant="destructive" className="py-2 text-xs">
            {scanError}
          </Alert>
        )}

        {uploadedDoc ? (
          <div className="flex items-center justify-between p-3 rounded-md bg-white border border-slate-200">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-slate-800">
                {uploadedDoc.fileName}
              </span>
            </div>
            {uploadedDoc.signedUrl && (
              <a
                href={uploadedDoc.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 font-medium"
              >
                <Eye className="h-3.5 w-3.5" />
                View Scan (Signed URL)
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={uploadingScan}
              className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
            />
            {uploadingScan && <Loader2 className="h-5 w-5 animate-spin text-sky-600" />}
          </div>
        )}
      </div>

      {/* Clinical Notes & Instructions */}
      <div className="space-y-1">
        <Label htmlFor="notes" className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-slate-600" />
          Clinical Instructions & Notes
        </Label>
        <Textarea
          id="notes"
          placeholder="Enter instructions, precautions, medication continuity details, or specific test requirements..."
          rows={3}
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-xs text-red-600">{errors.notes.message}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || !selectedPatient}
          className="gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Create Follow-Up Draft
        </Button>
      </div>
    </form>
  );
}
