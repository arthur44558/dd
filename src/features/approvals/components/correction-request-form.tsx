'use client';

import * as React from 'react';
import { AlertCircle, Plus, Trash2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { createCorrectionRequest } from '../actions';

interface FollowUpContext {
  id: string;
  currentVersion: number;
  appointmentDate: string;
  severity: string;
  notes?: string | null;
  followUpRequired: boolean;
  patientName?: string;
  patientMrn?: string;
}

interface CorrectionRequestFormProps {
  followUp: FollowUpContext;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (requestId: string) => void;
}

interface FieldDiff {
  fieldName: string;
  originalValue: string;
  proposedValue: string;
}

export function CorrectionRequestForm({
  followUp,
  isOpen,
  onClose,
  onSuccess,
}: CorrectionRequestFormProps) {
  const [reason, setReason] = React.useState('');
  const [supportingEvidence, setSupportingEvidence] = React.useState('');
  const [diffs, setDiffs] = React.useState<FieldDiff[]>([]);
  const [selectedField, setSelectedField] = React.useState('appointment_date');
  const [newFieldValue, setNewFieldValue] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setReason('');
      setSupportingEvidence('');
      setDiffs([]);
      setSelectedField('appointment_date');
      setNewFieldValue('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  function getOriginalValueForField(field: string): string {
    switch (field) {
      case 'appointment_date':
        return followUp.appointmentDate || '';
      case 'severity':
        return followUp.severity || 'routine';
      case 'notes':
        return followUp.notes || '';
      case 'follow_up_required':
        return followUp.followUpRequired ? 'true' : 'false';
      default:
        return '';
    }
  }

  function handleAddFieldDiff() {
    if (!newFieldValue || !newFieldValue.trim()) {
      setErrorMessage('Please specify the new proposed value for the field.');
      return;
    }

    const orig = getOriginalValueForField(selectedField);
    if (orig === newFieldValue.trim()) {
      setErrorMessage('Proposed value is identical to the current value.');
      return;
    }

    setErrorMessage(null);
    setDiffs((prev) => [
      ...prev.filter((d) => d.fieldName !== selectedField),
      {
        fieldName: selectedField,
        originalValue: orig,
        proposedValue: newFieldValue.trim(),
      },
    ]);
    setNewFieldValue('');
  }

  function handleRemoveDiff(fieldName: string) {
    setDiffs((prev) => prev.filter((d) => d.fieldName !== fieldName));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setErrorMessage('A detailed clinical reason of at least 5 characters is required.');
      return;
    }
    if (diffs.length === 0) {
      setErrorMessage('You must add at least one proposed field change.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await createCorrectionRequest({
        followUpId: followUp.id,
        baseVersion: followUp.currentVersion,
        reason: reason.trim(),
        supportingEvidence: supportingEvidence.trim() || null,
        items: diffs.map((d) => ({
          fieldName: d.fieldName,
          originalValue: d.originalValue || null,
          proposedValue: d.proposedValue,
        })),
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to submit proposal');
      } else {
        onSuccess?.(res.requestId!);
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Propose Follow-Up Correction</DialogTitle>
          <DialogDescription>
            Submitted records cannot be edited directly. Submit a proposal for Department Head
            review based on current record version <strong>v{followUp.currentVersion}</strong>.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="reason">
              Clinical Reason for Correction <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="e.g. Patient called reporting worsening pain; doctor recommended earlier review date."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="supportingEvidence">Supporting Evidence / Document Reference (Optional)</Label>
            <Input
              id="supportingEvidence"
              placeholder="e.g. Phone triage note, updated scan reference, lab report ref"
              value={supportingEvidence}
              onChange={(e) => setSupportingEvidence(e.target.value)}
            />
          </div>

          <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
            <Label className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              Add Proposed Field Changes
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label htmlFor="fieldSelect" className="text-xs">Field</Label>
                <select
                  id="fieldSelect"
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                  value={selectedField}
                  onChange={(e) => {
                    setSelectedField(e.target.value);
                    setNewFieldValue('');
                  }}
                >
                  <option value="appointment_date">Appointment Date</option>
                  <option value="severity">Clinical Severity</option>
                  <option value="notes">Clinical Notes</option>
                  <option value="follow_up_required">Follow-Up Required</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="newValue" className="text-xs">
                  Proposed New Value (Current: {getOriginalValueForField(selectedField)})
                </Label>
                <div className="flex gap-2">
                  {selectedField === 'appointment_date' ? (
                    <Input
                      id="newValue"
                      type="date"
                      value={newFieldValue}
                      onChange={(e) => setNewFieldValue(e.target.value)}
                      className="h-9 text-xs"
                    />
                  ) : selectedField === 'severity' ? (
                    <select
                      id="newValue"
                      className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                      value={newFieldValue}
                      onChange={(e) => setNewFieldValue(e.target.value)}
                    >
                      <option value="">Select severity...</option>
                      <option value="routine">Routine</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  ) : selectedField === 'follow_up_required' ? (
                    <select
                      id="newValue"
                      className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                      value={newFieldValue}
                      onChange={(e) => setNewFieldValue(e.target.value)}
                    >
                      <option value="">Select status...</option>
                      <option value="true">Yes (Follow-up Required)</option>
                      <option value="false">No (Discharge / No Follow-up)</option>
                    </select>
                  ) : (
                    <Input
                      id="newValue"
                      type="text"
                      placeholder="Updated notes..."
                      value={newFieldValue}
                      onChange={(e) => setNewFieldValue(e.target.value)}
                      className="h-9 text-xs"
                    />
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddFieldDiff}
                    className="h-9"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* List of staged diffs */}
            {diffs.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t">
                <span className="text-xs font-medium text-slate-700">Staged Changes:</span>
                <div className="space-y-1">
                  {diffs.map((d) => (
                    <div
                      key={d.fieldName}
                      className="flex items-center justify-between text-xs bg-white border rounded px-2.5 py-1.5"
                    >
                      <div>
                        <strong className="text-slate-800">{d.fieldName}: </strong>
                        <span className="line-through text-red-600 mr-2">{d.originalValue || 'None'}</span>
                        <span className="font-semibold text-emerald-700">→ {d.proposedValue}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDiff(d.fieldName)}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-sky-600 hover:bg-sky-700 text-white"
              disabled={isLoading || diffs.length === 0}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Proposal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
