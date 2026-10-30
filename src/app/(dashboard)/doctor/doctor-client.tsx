'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitDoctorReview } from '@/features/follow-ups/actions';
import { createCorrectionRequest } from '@/features/approvals/actions';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Edit3,
  ShieldCheck,
  Search,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

interface FollowUpRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  department_id: string;
  appointment_date: string;
  follow_up_required: boolean;
  severity: 'routine' | 'moderate' | 'high' | 'critical';
  status: 'draft' | 'submitted' | 'active' | 'overdue' | 'completed' | 'cancelled';
  current_version: number;
  notes: string | null;
  created_at: string;
  patients?: {
    id: string;
    mrn: string;
    full_name: string;
    dob: string;
    primary_phone: string;
  } | null;
  departments?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface DoctorClientProps {
  initialFollowUps: FollowUpRecord[];
  doctorProfileId: string;
}

export default function DoctorClient({ initialFollowUps }: DoctorClientProps) {
  const router = useRouter();
  const [followUps] = useState<FollowUpRecord[]>(initialFollowUps);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Sign-off Modal
  const [selectedForSignOff, setSelectedForSignOff] = useState<FollowUpRecord | null>(null);
  const [signOffDate, setSignOffDate] = useState('');
  const [signOffSeverity, setSignOffSeverity] = useState<'routine' | 'moderate' | 'high' | 'critical'>('routine');
  const [signOffNotes, setSignOffNotes] = useState('');
  const [submittingSignOff, setSubmittingSignOff] = useState(false);

  // Correction Proposal Modal
  const [selectedForCorrection, setSelectedForCorrection] = useState<FollowUpRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionDate, setCorrectionDate] = useState('');
  const [correctionSeverity, setCorrectionSeverity] = useState<string>('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Feedback states
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Compute metrics
  const pendingSignOffCount = followUps.filter((f) => f.status === 'draft').length;
  const activeFollowUpsCount = followUps.filter(
    (f) => f.status === 'submitted' || f.status === 'active'
  ).length;
  const overdueCount = followUps.filter((f) => f.status === 'overdue').length;

  const displayedRecords = followUps.filter((record) => {
    const matchesTab = activeTab === 'pending' ? record.status === 'draft' : true;
    const matchesQuery =
      searchQuery === '' ||
      record.patients?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.patients?.mrn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesQuery;
  });

  function openSignOffModal(record: FollowUpRecord) {
    setSelectedForSignOff(record);
    setSignOffDate(record.appointment_date);
    setSignOffSeverity(record.severity);
    setSignOffNotes('');
    setFeedbackError(null);
  }

  function openCorrectionModal(record: FollowUpRecord) {
    setSelectedForCorrection(record);
    setCorrectionReason('');
    setCorrectionDate(record.appointment_date);
    setCorrectionSeverity(record.severity);
    setCorrectionNotes(record.notes || '');
    setFeedbackError(null);
  }

  async function handleConfirmSignOff(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedForSignOff) return;

    setSubmittingSignOff(true);
    setFeedbackError(null);

    try {
      const res = await submitDoctorReview({
        followUpId: selectedForSignOff.id,
        doctorConfirmation: true,
        appointmentDate: signOffDate || selectedForSignOff.appointment_date,
        severity: signOffSeverity,
        clinicalNotes: signOffNotes.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to submit clinical sign-off');
      }

      setFeedbackSuccess(
        `Consultation follow-up for ${selectedForSignOff.patients?.full_name} has been signed off and locked (v1).`
      );
      setSelectedForSignOff(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-off error';
      setFeedbackError(msg);
    } finally {
      setSubmittingSignOff(false);
    }
  }

  async function handleConfirmCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedForCorrection) return;

    if (!correctionReason || correctionReason.trim().length < 5) {
      setFeedbackError('Please provide a correction reason of at least 5 characters.');
      return;
    }

    setSubmittingCorrection(true);
    setFeedbackError(null);

    try {
      // Build proposed items array
      const items: Array<{
        fieldName: 'appointmentDate' | 'severity' | 'notes';
        originalValue: string;
        proposedValue: string;
      }> = [];

      if (correctionDate && correctionDate !== selectedForCorrection.appointment_date) {
        items.push({
          fieldName: 'appointmentDate',
          originalValue: selectedForCorrection.appointment_date,
          proposedValue: correctionDate,
        });
      }

      if (correctionSeverity && correctionSeverity !== selectedForCorrection.severity) {
        items.push({
          fieldName: 'severity',
          originalValue: selectedForCorrection.severity,
          proposedValue: correctionSeverity,
        });
      }

      if (correctionNotes && correctionNotes !== (selectedForCorrection.notes || '')) {
        items.push({
          fieldName: 'notes',
          originalValue: selectedForCorrection.notes || '',
          proposedValue: correctionNotes,
        });
      }

      if (items.length === 0) {
        throw new Error('At least one field change must be proposed.');
      }

      const res = await createCorrectionRequest({
        followUpId: selectedForCorrection.id,
        baseVersion: selectedForCorrection.current_version,
        reason: correctionReason.trim(),
        items,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to submit correction request');
      }

      setFeedbackSuccess(
        `Correction proposal submitted for Department Head review (Ref #${res.requestId?.slice(0, 8)}).`
      );
      setSelectedForCorrection(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Correction proposal failed';
      setFeedbackError(msg);
    } finally {
      setSubmittingCorrection(false);
    }
  }

  function renderStatusBadge(status: string) {
    switch (status) {
      case 'draft':
        return <Badge variant="warning">Awaiting Sign-off</Badge>;
      case 'submitted':
        return <Badge variant="info">Submitted & Locked</Badge>;
      case 'active':
        return <Badge variant="success">Active Follow-up</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Confirmed Overdue</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function renderSeverityBadge(sev: string) {
    switch (sev) {
      case 'critical':
        return <Badge variant="danger">Critical</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'moderate':
        return <Badge variant="warning">Moderate</Badge>;
      default:
        return <Badge variant="outline">Routine</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Pending Clinical Review
            </CardTitle>
            <Clock className="w-5 h-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{pendingSignOffCount}</div>
            <p className="text-xs text-slate-500 mt-1">Intakes awaiting doctor sign-off</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Active Follow-ups</CardTitle>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{activeFollowUpsCount}</div>
            <p className="text-xs text-slate-500 mt-1">Confirmed clinical appointments</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Confirmed Overdue</CardTitle>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{overdueCount}</div>
            <p className="text-xs text-slate-500 mt-1">Appointments requiring escalation</p>
          </CardContent>
        </Card>
      </div>

      {feedbackSuccess && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <AlertTitle className="text-xs font-semibold text-emerald-950">Clinical Action Confirmed</AlertTitle>
          <AlertDescription className="text-xs">{feedbackSuccess}</AlertDescription>
        </Alert>
      )}

      {/* Main Container */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending Doctor Sign-off ({pendingSignOffCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Assigned Patients ({followUps.length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Search patient name, MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MRN</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Appointment Date</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-500">
                      No follow-up records in this view.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedRecords.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        {item.patients?.mrn || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-800">
                        {item.patients?.full_name || 'Unknown Patient'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {item.patients?.dob || '—'}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800">
                        {item.appointment_date}
                      </TableCell>
                      <TableCell>{renderSeverityBadge(item.severity)}</TableCell>
                      <TableCell>{renderStatusBadge(item.status)}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        v{item.current_version}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {item.status === 'draft' ? (
                          <Button
                            size="sm"
                            onClick={() => openSignOffModal(item)}
                            className="h-8 text-xs bg-sky-600 hover:bg-sky-700 text-white"
                          >
                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                            <span>Sign Off Intake</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCorrectionModal(item)}
                            className="h-8 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            <span>Propose Correction</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Sign-off Modal */}
      <Dialog
        open={!!selectedForSignOff}
        onOpenChange={(open) => {
          if (!open) setSelectedForSignOff(null);
        }}
      >
        <DialogContent onClose={() => setSelectedForSignOff(null)}>
          <DialogHeader>
            <DialogTitle>Clinician Intake Sign-off</DialogTitle>
            <DialogDescription>
              Verify the digitised order, confirm clinical severity, and commit version 1.
            </DialogDescription>
          </DialogHeader>

          {selectedForSignOff && (
            <form onSubmit={handleConfirmSignOff} className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-slate-500 font-medium">Patient:</span>{' '}
                  <strong className="text-slate-800">{selectedForSignOff.patients?.full_name}</strong>{' '}
                  (MRN: {selectedForSignOff.patients?.mrn})
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Verified DOB:</span>{' '}
                  <span className="text-slate-800">{selectedForSignOff.patients?.dob}</span>
                </div>
                {selectedForSignOff.notes && (
                  <div className="pt-1 border-t border-slate-200">
                    <span className="text-slate-500 font-medium block">Assistant Digitised Notes:</span>
                    <span className="text-slate-700 italic">{selectedForSignOff.notes}</span>
                  </div>
                )}
              </div>

              {feedbackError && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <AlertDescription className="text-xs">{feedbackError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="signOffDate" className="text-xs font-semibold">
                    Appointment Date
                  </Label>
                  <Input
                    id="signOffDate"
                    type="date"
                    value={signOffDate}
                    onChange={(e) => setSignOffDate(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="signOffSeverity" className="text-xs font-semibold">
                    Clinical Severity
                  </Label>
                  <Select
                    id="signOffSeverity"
                    value={signOffSeverity}
                    onChange={(e) =>
                      setSignOffSeverity(
                        e.target.value as 'routine' | 'moderate' | 'high' | 'critical'
                      )
                    }
                    className="text-xs"
                  >
                    <option value="routine">Routine</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="signOffNotes" className="text-xs font-semibold">
                  Clinician Confirmation & Prescription Notes
                </Label>
                <Textarea
                  id="signOffNotes"
                  rows={3}
                  value={signOffNotes}
                  onChange={(e) => setSignOffNotes(e.target.value)}
                  placeholder="Attending doctor notes confirming clinical plan, required diagnostic tests, or special precautions."
                  className="text-xs"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-700" />
                  Immutability Warning
                </p>
                <p>
                  Signing off locks this record into submitted state (v1). Any subsequent modifications
                  require a formal correction proposal approved by the Department Head.
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedForSignOff(null)}
                  disabled={submittingSignOff}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingSignOff} className="bg-sky-600 hover:bg-sky-700">
                  {submittingSignOff ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Locking v1...</span>
                    </>
                  ) : (
                    <span>Sign-off & Lock Record</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Propose Correction Modal */}
      <Dialog
        open={!!selectedForCorrection}
        onOpenChange={(open) => {
          if (!open) setSelectedForCorrection(null);
        }}
      >
        <DialogContent onClose={() => setSelectedForCorrection(null)}>
          <DialogHeader>
            <DialogTitle>Propose Clinical Correction</DialogTitle>
            <DialogDescription>
              Propose updates to a locked follow-up record. Proposals are routed to the Department
              Head for side-by-side review and atomic commit.
            </DialogDescription>
          </DialogHeader>

          {selectedForCorrection && (
            <form onSubmit={handleConfirmCorrection} className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Record:</span>{' '}
                  <strong>{selectedForCorrection.patients?.full_name}</strong> (Base version: v
                  {selectedForCorrection.current_version})
                </div>
              </div>

              {feedbackError && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <AlertDescription className="text-xs">{feedbackError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label htmlFor="correctionReason" className="text-xs font-semibold">
                  Clinical Change Reason <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="correctionReason"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Patient called regarding acute reaction to medication."
                  className="text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="correctionDate" className="text-xs font-semibold">
                    Proposed Appointment Date
                  </Label>
                  <Input
                    id="correctionDate"
                    type="date"
                    value={correctionDate}
                    onChange={(e) => setCorrectionDate(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="correctionSeverity" className="text-xs font-semibold">
                    Proposed Severity Tier
                  </Label>
                  <Select
                    id="correctionSeverity"
                    value={correctionSeverity}
                    onChange={(e) => setCorrectionSeverity(e.target.value)}
                    className="text-xs"
                  >
                    <option value="routine">Routine</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="correctionNotes" className="text-xs font-semibold">
                  Proposed Updated Clinical Instructions
                </Label>
                <Textarea
                  id="correctionNotes"
                  rows={3}
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  className="text-xs"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedForCorrection(null)}
                  disabled={submittingCorrection}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingCorrection} className="bg-sky-600 hover:bg-sky-700">
                  {submittingCorrection ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Submitting Proposal...</span>
                    </>
                  ) : (
                    <span>Submit to Department Head</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
