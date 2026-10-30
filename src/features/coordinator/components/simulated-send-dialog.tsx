'use client';

import * as React from 'react';
import { Send, Phone, AlertTriangle, Info, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  recordSimulatedSendAction,
  recordCallAttemptAction,
} from '../actions';
import {
  type CommunicationTask,
  type CallOutcome,
  type PatientResponse,
  MANDATORY_SIMULATION_DISCLAIMER,
} from '../types';

interface SimulatedSendDialogProps {
  task: CommunicationTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SimulatedSendDialog({
  task,
  isOpen,
  onClose,
  onSuccess,
}: SimulatedSendDialogProps) {
  const [actionType, setActionType] = React.useState<'send' | 'call'>('send');
  const [notes, setNotes] = React.useState('');
  const [callOutcome, setCallOutcome] = React.useState<CallOutcome>('answered');
  const [patientResponse, setPatientResponse] = React.useState<PatientResponse>('appointment_confirmed');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setActionType(task?.channel === 'call' ? 'call' : 'send');
      setNotes('');
      setCallOutcome('answered');
      setPatientResponse('appointment_confirmed');
      setErrorMessage(null);
    }
  }, [isOpen, task]);

  if (!task) return null;

  const isSharedPhone = task.followUp?.patient?.isSharedContact;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (actionType === 'send') {
        const res = await recordSimulatedSendAction({
          taskId: task!.id,
          followUpId: task!.followUpId,
          channel: task!.channel,
          notes: notes.trim() || null,
        });
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to record simulated communication');
        } else {
          onSuccess?.();
          onClose();
        }
      } else {
        const res = await recordCallAttemptAction({
          taskId: task!.id,
          followUpId: task!.followUpId,
          callOutcome,
          patientResponse,
          notes: notes.trim() || null,
        });
        if (!res.success) {
          setErrorMessage(res.error || 'Failed to record call attempt');
        } else {
          onSuccess?.();
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Manual Communication</DialogTitle>
          <DialogDescription>
            Record simulated message delivery or telephone contact for Patient{' '}
            <strong>{task.followUp?.patient?.fullName || 'Record'}</strong> (
            MRN: {task.followUp?.patient?.mrn || 'N/A'}).
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Mandatory Truthfulness Disclaimer Banner */}
        <Alert variant="warning" className="border-amber-300 bg-amber-50">
          <Info className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900 font-semibold text-xs uppercase tracking-wide">
            Mandatory Communication Disclaimer
          </AlertTitle>
          <AlertDescription className="text-amber-900 font-bold text-xs">
            {MANDATORY_SIMULATION_DISCLAIMER}
          </AlertDescription>
        </Alert>

        {/* Shared Phone Warning Banner */}
        {isSharedPhone && (
          <Alert variant="destructive" className="border-red-300 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-700" />
            <AlertTitle className="text-red-900 font-semibold text-xs">
              Shared Phone Number Warning
            </AlertTitle>
            <AlertDescription className="text-red-800 text-xs">
              This telephone number is shared among multiple individuals. Use only approved non-sensitive
              appointment reminder phrasing. Do NOT disclose clinical diagnosis, severity, notes, or prescriptions.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Action Mode Toggle */}
          <div className="flex gap-2 border-b pb-2">
            <Button
              type="button"
              variant={actionType === 'send' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActionType('send')}
              className="text-xs h-8"
            >
              <Send className="h-3.5 w-3.5 mr-1" /> Simulated Send (Text)
            </Button>
            <Button
              type="button"
              variant={actionType === 'call' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActionType('call')}
              className="text-xs h-8"
            >
              <Phone className="h-3.5 w-3.5 mr-1" /> Telephone Call Attempt
            </Button>
          </div>

          <div className="bg-slate-50 p-2.5 rounded border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Contact Number:</span>
              <span className="font-mono font-medium text-slate-800">
                {task.followUp?.patient?.primaryPhone || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Task Type:</span>
              <span className="font-medium text-slate-800">{task.taskType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Appointment Date:</span>
              <span className="font-medium text-slate-800">
                {task.followUp?.appointmentDate || 'N/A'}
              </span>
            </div>
          </div>

          {actionType === 'call' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Label htmlFor="callOutcome" className="text-xs">
                  Call Outcome <span className="text-red-500">*</span>
                </Label>
                <select
                  id="callOutcome"
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value as CallOutcome)}
                >
                  <option value="answered">Answered</option>
                  <option value="no_answer">No Answer</option>
                  <option value="unreachable">Unreachable / Switched Off</option>
                  <option value="callback_requested">Callback Requested</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="patientResponse" className="text-xs">
                  Patient Response
                </Label>
                <select
                  id="patientResponse"
                  className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                  value={patientResponse}
                  onChange={(e) => setPatientResponse(e.target.value as PatientResponse)}
                >
                  <option value="appointment_confirmed">Appointment Confirmed</option>
                  <option value="rescheduling_requested">Rescheduling Requested</option>
                  <option value="follow_up_declined">Follow-up Declined</option>
                  <option value="clinical_guidance_needed">Clinical Guidance Needed</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs">
              Communication Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Record any relevant communication context or patient feedback..."
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm Simulated Action
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
