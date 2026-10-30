'use client';

import * as React from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { recordFollowUpOutcomeAction } from '../actions';
import type { FollowUpOutcomeType } from '../types';

interface OutcomeRecordingDialogProps {
  followUpId: string | null;
  patientName?: string;
  mrn?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function OutcomeRecordingDialog({
  followUpId,
  patientName,
  mrn,
  isOpen,
  onClose,
  onSuccess,
}: OutcomeRecordingDialogProps) {
  const [outcome, setOutcome] = React.useState<FollowUpOutcomeType>('completed');
  const [attendedAppointment, setAttendedAppointment] = React.useState(true);
  const [requiresFurtherFollowUp, setRequiresFurtherFollowUp] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setOutcome('completed');
      setAttendedAppointment(true);
      setRequiresFurtherFollowUp(false);
      setNotes('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!followUpId) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await recordFollowUpOutcomeAction({
        followUpId: followUpId!,
        outcome,
        attendedAppointment: outcome === 'completed' ? attendedAppointment : null,
        requiresFurtherFollowUp,
        notes: notes.trim() || null,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to record outcome');
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Follow-Up Clinical Outcome</DialogTitle>
          <DialogDescription>
            Record resolution for Patient <strong>{patientName || 'Record'}</strong> (MRN:{' '}
            {mrn || 'N/A'}).
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="outcome" className="text-xs">
              Resolution Outcome <span className="text-red-500">*</span>
            </Label>
            <select
              id="outcome"
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as FollowUpOutcomeType)}
            >
              <option value="completed">Completed (Appointment Attended / Cycle Concluded)</option>
              <option value="patient_rescheduled">Patient Rescheduled (Awaiting New Date)</option>
              <option value="patient_refused">Patient Refused Further Follow-up</option>
              <option value="lost_to_follow_up">Lost to Follow-up (Exhausted Contact Attempts)</option>
            </select>
          </div>

          {outcome === 'completed' && (
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="attendedAppointment"
                checked={attendedAppointment}
                onChange={(e) => setAttendedAppointment(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <Label htmlFor="attendedAppointment" className="text-xs font-normal">
                Patient physically attended the scheduled follow-up consultation
              </Label>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="requiresFurtherFollowUp"
              checked={requiresFurtherFollowUp}
              onChange={(e) => setRequiresFurtherFollowUp(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <Label htmlFor="requiresFurtherFollowUp" className="text-xs font-normal">
              Clinical doctor determined an additional follow-up cycle is required
            </Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs">
              Outcome Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="e.g. Patient attended consultation with Dr. Rao. Prescribed revised medication."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-sky-600 hover:bg-sky-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Save Outcome
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
