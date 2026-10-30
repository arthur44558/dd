'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  type CommunicationTask,
  MANDATORY_SIMULATION_DISCLAIMER,
} from '@/features/coordinator/types';
import {
  recordSimulatedSendAction,
  recordCallAttemptAction,
} from '@/features/coordinator/actions';
import {
  Send,
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  ShieldAlert,
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

interface CoordinatorClientProps {
  initialTasks: CommunicationTask[];
}

export default function CoordinatorClient({ initialTasks }: CoordinatorClientProps) {
  const router = useRouter();
  const [tasks] = useState<CommunicationTask[]>(initialTasks);
  const [activeFilter, setActiveFilter] = useState<'all' | 'due' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [selectedTaskForSend, setSelectedTaskForSend] = useState<CommunicationTask | null>(null);
  const [sendNotes, setSendNotes] = useState('');
  const [submittingSend, setSubmittingSend] = useState(false);

  const [selectedTaskForCall, setSelectedTaskForCall] = useState<CommunicationTask | null>(null);
  const [callOutcome, setCallOutcome] = useState<
    'answered' | 'no_answer' | 'unreachable' | 'callback_requested' | 'other'
  >('answered');
  const [patientResponse, setPatientResponse] = useState<
    | 'appointment_confirmed'
    | 'rescheduling_requested'
    | 'follow_up_declined'
    | 'clinical_guidance_needed'
    | 'other'
  >('appointment_confirmed');
  const [callNotes, setCallNotes] = useState('');
  const [submittingCall, setSubmittingCall] = useState(false);

  // Success / error banner
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Compute metrics
  const now = new Date();
  const overdueCount = tasks.filter(
    (t) => t.status === 'pending' && new Date(t.dueAt) < now
  ).length;
  const dueCount = tasks.filter((t) => t.status === 'pending').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  const filteredTasks = tasks.filter((task) => {
    let matchesStatus = true;
    if (activeFilter === 'overdue') {
      matchesStatus = task.status === 'pending' && new Date(task.dueAt) < now;
    } else if (activeFilter === 'due') {
      matchesStatus = task.status === 'pending';
    }

    const matchesSearch =
      searchQuery === '' ||
      task.followUp?.patient?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.followUp?.patient?.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.followUp?.patient?.primaryPhone && task.followUp.patient.primaryPhone.includes(searchQuery));

    return matchesStatus && matchesSearch;
  });

  async function handleSimulateSendSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTaskForSend) return;

    setSubmittingSend(true);
    setFeedbackError(null);

    try {
      const res = await recordSimulatedSendAction({
        taskId: selectedTaskForSend.id,
        followUpId: selectedTaskForSend.followUpId,
        channel: 'text',
        notes: sendNotes.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to record simulated communication');
      }

      setFeedbackSuccess(
        `Simulated text message recorded for ${selectedTaskForSend.followUp?.patient?.fullName}. Status updated.`
      );
      setSelectedTaskForSend(null);
      setSendNotes('');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Simulated send failed';
      setFeedbackError(msg);
    } finally {
      setSubmittingSend(false);
    }
  }

  async function handleLogCallSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTaskForCall) return;

    setSubmittingCall(true);
    setFeedbackError(null);

    try {
      const res = await recordCallAttemptAction({
        taskId: selectedTaskForCall.id,
        followUpId: selectedTaskForCall.followUpId,
        callOutcome,
        patientResponse,
        notes: callNotes.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to log call attempt');
      }

      setFeedbackSuccess(
        `Call attempt logged for ${selectedTaskForCall.followUp?.patient?.fullName}. Response recorded: "${patientResponse.replace('_', ' ')}".`
      );
      setSelectedTaskForCall(null);
      setCallNotes('');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Call log failed';
      setFeedbackError(msg);
    } finally {
      setSubmittingCall(false);
    }
  }

  function renderPriorityBadge(priority: string) {
    switch (priority) {
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

  function renderTaskType(type: string) {
    switch (type) {
      case 'pre_appointment_text':
        return 'Pre-Appointment SMS';
      case 'pre_appointment_call':
        return 'Pre-Appointment Call';
      case 'overdue_text_day_2':
        return 'Day +2 Overdue SMS';
      case 'overdue_text_day_4':
        return 'Day +4 Overdue Call';
      default:
        return type.replace(/_/g, ' ');
    }
  }

  function formatDate(isoString: string) {
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  }

  return (
    <div className="space-y-6">
      {/* Mandatory Truthfulness Disclaimer Banner */}
      <Alert className="bg-amber-50 border-amber-300 text-amber-950">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-700" />
        <AlertTitle className="text-xs font-bold uppercase tracking-wider text-amber-900">
          Simulation Notice: {MANDATORY_SIMULATION_DISCLAIMER}
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-800">
          All coordinator outreach actions (SMS dispatch, phone calls) in this demonstration release
          are simulated workflows recorded with timestamped audit trails.
        </AlertDescription>
      </Alert>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Overdue Tasks</CardTitle>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{overdueCount}</div>
            <p className="text-xs text-slate-500 mt-1">Past scheduled outreach window</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Pending Tasks</CardTitle>
            <Clock className="w-5 h-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{dueCount}</div>
            <p className="text-xs text-slate-500 mt-1">Due for patient communication</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Completed Outreach</CardTitle>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{completedCount}</div>
            <p className="text-xs text-slate-500 mt-1">Successfully handled tasks</p>
          </CardContent>
        </Card>
      </div>

      {feedbackSuccess && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <AlertTitle className="text-xs font-semibold text-emerald-950">Action Logged</AlertTitle>
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
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Tasks ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('due')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeFilter === 'due'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending ({dueCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('overdue')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeFilter === 'overdue'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overdue Escalations ({overdueCount})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Search patient, MRN, phone..."
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
                  <TableHead>Patient Details</TableHead>
                  <TableHead>Task Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Target Appt</TableHead>
                  <TableHead>Due At (IST)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Simulated Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                      No communication tasks found in this view.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs">
                          {t.followUp?.patient?.fullName || 'Patient'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          MRN: {t.followUp?.patient?.mrn} &bull; Ph: {t.followUp?.patient?.primaryPhone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-slate-800">
                          {renderTaskType(t.taskType)}
                        </span>
                      </TableCell>
                      <TableCell>{renderPriorityBadge(t.priority)}</TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {t.followUp?.appointmentDate}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{formatDate(t.dueAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.status === 'completed'
                              ? 'success'
                              : t.status === 'in_progress'
                              ? 'info'
                              : 'warning'
                          }
                          className="capitalize"
                        >
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {t.status !== 'completed' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTaskForSend(t);
                                setSendNotes('');
                                setFeedbackError(null);
                              }}
                              className="h-8 text-xs text-sky-700 hover:bg-sky-50"
                              title="Manually confirmed / simulated — not provider verified"
                            >
                              <Send className="w-3.5 h-3.5 mr-1" />
                              <span>Simulate SMS</span>
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedTaskForCall(t);
                                setCallNotes('');
                                setFeedbackError(null);
                              }}
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              title="Manually confirmed / simulated — not provider verified"
                            >
                              <PhoneCall className="w-3.5 h-3.5 mr-1" />
                              <span>Log Call</span>
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Handled</span>
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

      {/* Simulate SMS Send Dialog */}
      <Dialog
        open={!!selectedTaskForSend}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskForSend(null);
        }}
      >
        <DialogContent onClose={() => setSelectedTaskForSend(null)}>
          <DialogHeader>
            <DialogTitle>Simulate Patient SMS Reminder</DialogTitle>
            <DialogDescription>
              Record a simulated SMS outreach action for this follow-up appointment.
            </DialogDescription>
          </DialogHeader>

          {selectedTaskForSend && (
            <form onSubmit={handleSimulateSendSubmit} className="space-y-4 py-2">
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1 text-amber-950">
                <p className="font-bold flex items-center">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-700" />
                  Mandatory Disclaimer
                </p>
                <p className="font-semibold">{MANDATORY_SIMULATION_DISCLAIMER}</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-slate-500 font-medium">Recipient:</span>{' '}
                  <strong>{selectedTaskForSend.followUp?.patient?.fullName}</strong> (MRN:{' '}
                  {selectedTaskForSend.followUp?.patient?.mrn})
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Destination Number:</span>{' '}
                  <span className="font-mono text-slate-800">
                    {selectedTaskForSend.followUp?.patient?.primaryPhone}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Target Appointment:</span>{' '}
                  <span className="text-slate-800 font-semibold">
                    {selectedTaskForSend.followUp?.appointmentDate}
                  </span>
                </div>
              </div>

              {feedbackError && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <AlertDescription className="text-xs">{feedbackError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label htmlFor="sendNotes" className="text-xs font-semibold">
                  Coordinator Action Notes (Optional)
                </Label>
                <Textarea
                  id="sendNotes"
                  rows={2}
                  value={sendNotes}
                  onChange={(e) => setSendNotes(e.target.value)}
                  placeholder="e.g. Sent standard pre-appointment reminder text."
                  className="text-xs"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTaskForSend(null)}
                  disabled={submittingSend}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingSend} className="bg-sky-600 hover:bg-sky-700">
                  {submittingSend ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Logging Send...</span>
                    </>
                  ) : (
                    <span>Confirm Simulated Send</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Log Call Attempt Dialog */}
      <Dialog
        open={!!selectedTaskForCall}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskForCall(null);
        }}
      >
        <DialogContent onClose={() => setSelectedTaskForCall(null)}>
          <DialogHeader>
            <DialogTitle>Log Patient Call Attempt</DialogTitle>
            <DialogDescription>
              Record the outcome of the phone call and patient response.
            </DialogDescription>
          </DialogHeader>

          {selectedTaskForCall && (
            <form onSubmit={handleLogCallSubmit} className="space-y-4 py-2">
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1 text-amber-950">
                <p className="font-bold flex items-center">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-700" />
                  Mandatory Disclaimer
                </p>
                <p className="font-semibold">{MANDATORY_SIMULATION_DISCLAIMER}</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-slate-500 font-medium">Patient:</span>{' '}
                  <strong>{selectedTaskForCall.followUp?.patient?.fullName}</strong> (MRN:{' '}
                  {selectedTaskForCall.followUp?.patient?.mrn})
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Contact Phone:</span>{' '}
                  <span className="font-mono text-slate-800">
                    {selectedTaskForCall.followUp?.patient?.primaryPhone}
                  </span>
                </div>
              </div>

              {feedbackError && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <AlertDescription className="text-xs">{feedbackError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="callOutcome" className="text-xs font-semibold">
                    Call Attempt Result
                  </Label>
                  <Select
                    id="callOutcome"
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value as any)}
                    className="text-xs"
                  >
                    <option value="answered">Answered</option>
                    <option value="no_answer">No Answer</option>
                    <option value="unreachable">Unreachable</option>
                    <option value="callback_requested">Callback Requested</option>
                    <option value="other">Other</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="patientResponse" className="text-xs font-semibold">
                    Patient Response
                  </Label>
                  <Select
                    id="patientResponse"
                    value={patientResponse}
                    onChange={(e) => setPatientResponse(e.target.value as any)}
                    className="text-xs"
                  >
                    <option value="appointment_confirmed">Appointment Confirmed</option>
                    <option value="rescheduling_requested">Rescheduling Requested</option>
                    <option value="follow_up_declined">Follow-up Declined</option>
                    <option value="clinical_guidance_needed">Clinical Guidance Needed</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="callNotes" className="text-xs font-semibold">
                  Call Summary Notes
                </Label>
                <Textarea
                  id="callNotes"
                  rows={2}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Record patient communication notes or reasons for rescheduling."
                  className="text-xs"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTaskForCall(null)}
                  disabled={submittingCall}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingCall} className="bg-emerald-600 hover:bg-emerald-700">
                  {submittingCall ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Recording Call...</span>
                    </>
                  ) : (
                    <span>Log Call Outcome</span>
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
