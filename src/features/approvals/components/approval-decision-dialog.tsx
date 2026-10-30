'use client';

import * as React from 'react';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { approveCorrectionRequestAction, rejectCorrectionRequestAction } from '../actions';
import type { CorrectionRequest } from '../types';
import { DiffViewer } from './diff-viewer';

interface ApprovalDecisionDialogProps {
  request: CorrectionRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ApprovalDecisionDialog({
  request,
  isOpen,
  onClose,
  onSuccess,
}: ApprovalDecisionDialogProps) {
  const [mode, setMode] = React.useState<'review' | 'approve' | 'reject'>('review');
  const [decisionNotes, setDecisionNotes] = React.useState('');
  const [rejectionReason, setRejectionReason] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMode('review');
      setDecisionNotes('Approved by Department Head');
      setRejectionReason('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!request) return null;

  async function handleApprove() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await approveCorrectionRequestAction({
        requestId: request!.id,
        decisionReason: decisionNotes || 'Approved by Department Head',
      });
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to approve request');
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

  async function handleReject() {
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      setErrorMessage('A rejection reason of at least 5 characters is mandatory.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await rejectCorrectionRequestAction({
        requestId: request!.id,
        rejectionReason: rejectionReason.trim(),
      });
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to reject request');
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Correction Request</DialogTitle>
          <DialogDescription>
            Examine proposed changes for Patient {request.followUp?.patient?.fullName || 'Record'} (
            {request.followUp?.patient?.mrn || request.followUpId}).
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="py-2">
          <DiffViewer request={request} />
        </div>

        {mode === 'approve' && (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="decisionNotes">Approval Notes (Optional)</Label>
            <Textarea
              id="decisionNotes"
              placeholder="e.g. Verified with clinical findings and signed off."
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {mode === 'reject' && (
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="rejectionReason">
              Rejection Reason <span className="text-red-500 font-bold">*</span>
            </Label>
            <Textarea
              id="rejectionReason"
              placeholder="Explain why this proposal is rejected (mandatory, min 5 chars)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <DialogFooter className="border-t pt-4 flex items-center justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>

          {mode === 'review' ? (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => setMode('reject')}
                disabled={isLoading || request.status !== 'pending'}
              >
                <X className="h-4 w-4 mr-1" /> Reject...
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setMode('approve')}
                disabled={isLoading || request.status !== 'pending'}
              >
                <Check className="h-4 w-4 mr-1" /> Approve...
              </Button>
            </div>
          ) : mode === 'approve' ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('review')} disabled={isLoading}>
                Back
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleApprove}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Confirm Approval
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('review')} disabled={isLoading}>
                Back
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Confirm Rejection
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
