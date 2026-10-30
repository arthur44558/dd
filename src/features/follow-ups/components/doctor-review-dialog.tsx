'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle,
  FileCheck,
  AlertTriangle,
  Loader2,
  Calendar,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  doctorReviewSchema,
  type DoctorReviewInput,
  type FollowUpSummary,
} from '../schemas';
import { submitDoctorReview } from '../actions';
import { getScanSignedUrl } from '../storage-actions';

export interface DoctorReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUp: FollowUpSummary | null;
  onSuccess?: () => void;
}

export function DoctorReviewDialog({
  open,
  onOpenChange,
  followUp,
  onSuccess,
}: DoctorReviewDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [signedScanUrl, setSignedScanUrl] = React.useState<string | null>(null);
  const [loadingScan, setLoadingScan] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DoctorReviewInput>({
    resolver: zodResolver(doctorReviewSchema),
    defaultValues: {
      followUpId: followUp?.id || '',
      doctorConfirmation: true,
      clinicalNotes: '',
      appointmentDate: followUp?.appointmentDate || '',
      severity: followUp?.severity || 'routine',
    },
  });

  // Re-sync form when followUp changes
  React.useEffect(() => {
    if (followUp) {
      setValue('followUpId', followUp.id);
      setValue('appointmentDate', followUp.appointmentDate);
      setValue('severity', followUp.severity);
      setValue('doctorConfirmation', true);
      setValue('clinicalNotes', '');
    }
  }, [followUp, setValue]);

  const handleFetchScanUrl = async () => {
    if (!followUp?.sourceDocumentId) return;
    setLoadingScan(true);
    try {
      const res = await getScanSignedUrl(followUp.sourceDocumentId, 60);
      if (res.success && res.signedUrl) {
        setSignedScanUrl(res.signedUrl);
        window.open(res.signedUrl, '_blank');
      } else {
        setServerError(res.error || 'Could not retrieve scan file');
      }
    } catch {
      setServerError('An error occurred retrieving scan URL');
    } finally {
      setLoadingScan(false);
    }
  };

  const onSubmit = async (data: DoctorReviewInput) => {
    setIsSubmitting(true);
    setServerError(null);

    try {
      const res = await submitDoctorReview(data);
      if (res.success && res.data) {
        reset();
        onOpenChange(false);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setServerError(res.error || 'Failed to submit doctor review');
      }
    } catch {
      setServerError('An unexpected error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!followUp) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Doctor Clinical Review & Sign-Off
          </DialogTitle>
          <DialogDescription>
            Verify digitized clinical instructions, adjust dates or severity if required, and provide clinical sign-off.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Review Submission Error</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* Patient Summary Card */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">{followUp.patientName}</span>
            <Badge variant="outline" className="font-mono text-xs">
              {followUp.patientMrn}
            </Badge>
          </div>
          <div className="flex gap-4 text-xs text-slate-600">
            <span>
              <strong>DOB:</strong> {followUp.patientDob}
            </span>
            <span>
              <strong>Department:</strong> {followUp.departmentName || 'General'}
            </span>
            <span>
              <strong>Status:</strong>{' '}
              <Badge variant="secondary" className="capitalize text-[10px]">
                {followUp.status}
              </Badge>
            </span>
          </div>
        </div>

        {/* Original Scan Link */}
        {followUp.sourceDocumentId && (
          <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50/60 p-3">
            <div className="flex items-center gap-2 text-xs text-sky-900 font-medium">
              <FileCheck className="h-4 w-4 text-sky-600" />
              Scanned Doctor Form Available
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFetchScanUrl}
              disabled={loadingScan}
              className="gap-1.5 text-xs border-sky-300 hover:bg-sky-100"
            >
              {loadingScan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              {signedScanUrl ? 'Re-open Scan' : 'View Original Scan'}
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Appointment Date and Severity Adjustment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="reviewApptDate" className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Appointment Date
              </Label>
              <Input
                id="reviewApptDate"
                type="date"
                defaultValue={followUp.appointmentDate}
                {...register('appointmentDate')}
              />
              {errors.appointmentDate && (
                <p className="text-xs text-red-600">{errors.appointmentDate.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="reviewSeverity" className="text-xs">
                Clinical Severity
              </Label>
              <Select
                id="reviewSeverity"
                defaultValue={followUp.severity}
                {...register('severity')}
              >
                <option value="routine">Routine</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
              {errors.severity && (
                <p className="text-xs text-red-600">{errors.severity.message}</p>
              )}
            </div>
          </div>

          {/* Current Notes Display & Additions */}
          <div className="space-y-1">
            <Label className="text-xs">Assistant Intake Notes</Label>
            <div className="p-2.5 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700 min-h-[60px] whitespace-pre-wrap">
              {followUp.notes || 'No preliminary notes recorded.'}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="clinicalNotes" className="text-xs">
              Doctor Clinical Confirmation Notes (Optional)
            </Label>
            <Textarea
              id="clinicalNotes"
              placeholder="Add clinical remarks, specific medical directions, or continuity guidance..."
              rows={2}
              {...register('clinicalNotes')}
            />
            {errors.clinicalNotes && (
              <p className="text-xs text-red-600">{errors.clinicalNotes.message}</p>
            )}
          </div>

          {/* Immutability & Clinical Confirmation Notice */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={true}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                {...register('doctorConfirmation')}
              />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <span className="font-bold block">
                  Mandatory Clinical Confirmation *
                </span>
                I confirm that I have reviewed the clinical details, appointment anchor date, and follow-up instructions for this patient. Upon submission, this record becomes immutable (Version 1); any further modifications will require Department Head governance.
              </div>
            </label>
            {errors.doctorConfirmation && (
              <p className="text-xs text-red-600 font-medium">
                {errors.doctorConfirmation.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Sign-Off & Submit (Lock Record)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
