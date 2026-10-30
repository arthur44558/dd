'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDraftFollowUp } from '@/features/follow-ups/actions';
import { uploadClinicalScan } from '@/features/follow-ups/storage-actions';
import { PatientSearch } from '@/features/patients/components/patient-search';
import type { DedupSearchResult } from '@/features/patients/schemas';
import {
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Stethoscope,
  Filter,
  Plus,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

interface DoctorItem {
  id: string;
  doctor_id: string;
  speciality: string;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    department_id: string | null;
  };
}

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

interface AssistantClientProps {
  initialFollowUps: FollowUpRecord[];
  doctors: DoctorItem[];
  userDepartmentId: string;
}

export default function AssistantClient({
  initialFollowUps,
  doctors,
  userDepartmentId,
}: AssistantClientProps) {
  const router = useRouter();
  const [followUps] = useState<FollowUpRecord[]>(initialFollowUps);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Intake Form State
  const [selectedPatient, setSelectedPatient] = useState<DedupSearchResult | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctors[0]?.id || '');
  const [appointmentDate, setAppointmentDate] = useState<string>('');
  const [severity, setSeverity] = useState<'routine' | 'moderate' | 'high' | 'critical'>('routine');
  const [followUpRequired, setFollowUpRequired] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [attachedDocId, setAttachedDocId] = useState<string | null>(null);

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ id: string; fileName: string } | null>(null);

  // Submission State
  const [submittingIntake, setSubmittingIntake] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter follow-ups
  const filteredRecords = followUps.filter((record) => {
    const matchesFilter = statusFilter === 'all' || record.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      record.patients?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.patients?.mrn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const draftCount = followUps.filter((f) => f.status === 'draft').length;
  const pendingReviewCount = followUps.filter((f) => f.status === 'submitted').length;
  const activeCount = followUps.filter((f) => f.status === 'active' || f.status === 'overdue').length;

  async function handleUploadScan(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setFormError('Please select a file (PDF, PNG, or JPEG) to upload.');
      return;
    }

    setUploading(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await uploadClinicalScan(formData);
      if (!res.success || !res.document) {
        throw new Error(res.error || 'Upload failed');
      }

      setAttachedDocId(res.document.id);
      setUploadResult({ id: res.document.id, fileName: res.document.fileName });
      setSuccessMessage(`Scan "${res.document.fileName}" successfully uploaded and verified.`);
      setShowUploadModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload document scan';
      setFormError(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitIntake(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient) {
      setFormError('Please select a patient using the search tool.');
      return;
    }
    if (!selectedDoctorId) {
      setFormError('Please select an attending doctor.');
      return;
    }
    if (followUpRequired && !appointmentDate) {
      setFormError('Appointment date is mandatory when follow-up is required.');
      return;
    }

    setSubmittingIntake(true);
    setFormError(null);

    try {
      // Find doctor's department if user has no department
      const doc = doctors.find((d) => d.id === selectedDoctorId);
      const effectiveDeptId = userDepartmentId || doc?.profiles.department_id;

      if (!effectiveDeptId) {
        throw new Error('Please select a valid clinical department');
      }

      const res = await createDraftFollowUp({
        patientId: selectedPatient.patientId,
        doctorId: selectedDoctorId,
        departmentId: effectiveDeptId,
        appointmentDate: followUpRequired ? appointmentDate : new Date().toISOString().slice(0, 10),
        followUpRequired,
        severity,
        notes: notes.trim() || undefined,
        sourceDocumentId: attachedDocId || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to create draft intake');
      }

      setSuccessMessage(
        `Draft intake for ${selectedPatient.fullName} (${selectedPatient.mrn}) created and queued for doctor verification!`
      );
      setShowIntakeModal(false);
      resetIntakeForm();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Intake submission failed';
      setFormError(msg);
    } finally {
      setSubmittingIntake(false);
    }
  }

  function resetIntakeForm() {
    setSelectedPatient(null);
    setAppointmentDate('');
    setSeverity('routine');
    setFollowUpRequired(true);
    setNotes('');
    setAttachedDocId(null);
    setUploadResult(null);
  }

  function renderStatusBadge(status: string) {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Intake Draft</Badge>;
      case 'submitted':
        return <Badge variant="warning">Pending Doctor Review</Badge>;
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
            <CardTitle className="text-sm font-medium text-slate-600">Intake Drafts</CardTitle>
            <Clock className="w-5 h-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{draftCount}</div>
            <p className="text-xs text-slate-500 mt-1">Forms in digitisation process</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Pending Doctor Review</CardTitle>
            <Stethoscope className="w-5 h-5 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{pendingReviewCount}</div>
            <p className="text-xs text-slate-500 mt-1">Awaiting clinical confirmation</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Active Follow-ups</CardTitle>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{activeCount}</div>
            <p className="text-xs text-slate-500 mt-1">Confirmed appointments under tracking</p>
          </CardContent>
        </Card>
      </div>

      {successMessage && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <AlertTitle className="text-xs font-semibold text-emerald-950">Intake Operation Completed</AlertTitle>
          <AlertDescription className="text-xs">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Main Workspace Card */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Department Clinical Intake Queue
              </CardTitle>
              <CardDescription className="text-xs">
                Digitise paper orders, upload document scans, and prepare intakes for clinician sign-off.
              </CardDescription>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFormError(null);
                  setShowUploadModal(true);
                }}
                className="text-xs h-9 space-x-1"
              >
                <UploadCloud className="w-4 h-4 text-slate-600" />
                <span>Upload Form Scan</span>
              </Button>

              <Button
                onClick={() => {
                  setFormError(null);
                  setShowIntakeModal(true);
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-9 space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>New Clinical Intake</span>
              </Button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Search patient name, MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            <div className="flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs h-9 w-36"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Drafts</option>
                <option value="submitted">Pending Doctor</option>
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="completed">Completed</option>
              </Select>
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
                  <TableHead>Department</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ver.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-500">
                      No follow-up records found matching filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((item) => (
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
                      <TableCell className="text-xs text-slate-600">
                        {item.departments?.name || 'Department'}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800">
                        {item.appointment_date}
                      </TableCell>
                      <TableCell>{renderSeverityBadge(item.severity)}</TableCell>
                      <TableCell>{renderStatusBadge(item.status)}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        v{item.current_version}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Clinical Intake Modal */}
      <Dialog open={showIntakeModal} onOpenChange={setShowIntakeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onClose={() => setShowIntakeModal(false)}>
          <DialogHeader>
            <DialogTitle>New Clinical Intake Digitisation</DialogTitle>
            <DialogDescription>
              Select patient, verify date of birth, and digitise the doctor follow-up order.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <AlertDescription className="text-xs">{formError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmitIntake} className="space-y-4 py-2">
            {/* Step 1: Patient Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                1. Select Patient & Verify Date of Birth <span className="text-red-500">*</span>
              </Label>
              {selectedPatient ? (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{selectedPatient.fullName}</span> (
                    <span className="font-mono">{selectedPatient.mrn}</span>)
                    <div className="text-[11px] text-slate-600">
                      DOB: <strong>{selectedPatient.dob}</strong> &bull; Contact:{' '}
                      {selectedPatient.primaryPhone}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPatient(null)}
                    className="h-7 text-xs"
                  >
                    Change Patient
                  </Button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <PatientSearch onSelectPatient={(p) => setSelectedPatient(p)} />
                </div>
              )}
            </div>

            {/* Step 2: Doctor Selection */}
            <div className="space-y-1">
              <Label htmlFor="doctor" className="text-xs font-semibold text-slate-700">
                2. Attending Clinician <span className="text-red-500">*</span>
              </Label>
              <Select
                id="doctor"
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="text-xs"
              >
                <option value="">-- Select Clinician --</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.profiles.full_name} ({d.speciality} &bull; Lic: {d.doctor_id})
                  </option>
                ))}
              </Select>
            </div>

            {/* Step 3: Follow-up Requirement & Appointment Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="required" className="text-xs font-semibold text-slate-700">
                  Follow-up Required?
                </Label>
                <Select
                  id="required"
                  value={followUpRequired ? 'yes' : 'no'}
                  onChange={(e) => setFollowUpRequired(e.target.value === 'yes')}
                  className="text-xs"
                >
                  <option value="yes">Yes (Schedule appointment & reminders)</option>
                  <option value="no">No (Clinical discharge / Routine completion)</option>
                </Select>
              </div>

              {followUpRequired && (
                <div className="space-y-1">
                  <Label htmlFor="appDate" className="text-xs font-semibold text-slate-700">
                    Appointment Date (Asia/Kolkata) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="appDate"
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="text-xs"
                    required={followUpRequired}
                  />
                </div>
              )}
            </div>

            {/* Step 4: Clinical Severity */}
            <div className="space-y-1">
              <Label htmlFor="severity" className="text-xs font-semibold text-slate-700">
                Clinical Severity Tier <span className="text-red-500">*</span>
              </Label>
              <Select
                id="severity"
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as 'routine' | 'moderate' | 'high' | 'critical')
                }
                className="text-xs"
              >
                <option value="routine">Routine (Standard clinical follow-up)</option>
                <option value="moderate">Moderate (Elevated clinical monitoring)</option>
                <option value="high">High (Strict monitoring required)</option>
                <option value="critical">Critical (Immediate continuity priority)</option>
              </Select>
            </div>

            {/* Step 5: Document Scan Attachment */}
            {uploadResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Attached Verified Document Scan: <strong>{uploadResult.fileName}</strong>
                </span>
              </div>
            )}

            {/* Step 6: Notes */}
            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">
                Digitised Clinical Notes & Instructions
              </Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Transcribe specific doctor instructions, required laboratory tests, or dietary restrictions."
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowIntakeModal(false)}
                disabled={submittingIntake}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submittingIntake} className="bg-sky-600 hover:bg-sky-700">
                {submittingIntake ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Saving Intake...</span>
                  </>
                ) : (
                  <span>Submit for Doctor Review</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Scan Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent onClose={() => setShowUploadModal(false)}>
          <DialogHeader>
            <DialogTitle>Upload Consultation Form Scan</DialogTitle>
            <DialogDescription>
              Upload the original paper consultation sheet (PDF, PNG, or JPEG). Magic bytes and SHA-256
              hash are verified server-side.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <AlertDescription className="text-xs">{formError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleUploadScan} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="scanFile" className="text-xs font-semibold text-slate-700">
                Select Scan Document (Max 10MB)
              </Label>
              <Input
                id="scanFile"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
                className="text-xs"
              />
              <p className="text-[11px] text-slate-500">
                Permitted formats: PDF, PNG, JPEG. The original bytes are preserved immutably.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
              <div className="flex items-center text-slate-800 font-medium space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                <span>Private Encrypted Storage</span>
              </div>
              <p>
                Stored in private Supabase Storage bucket with time-capped signed URLs (&le; 60 seconds).
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploading || !selectedFile}
                className="bg-sky-600 hover:bg-sky-700"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Verifying & Uploading...</span>
                  </>
                ) : (
                  <span>Upload Document</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
