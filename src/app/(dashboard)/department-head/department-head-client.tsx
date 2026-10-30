'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CorrectionRequest } from '@/features/approvals/types';
import { ApprovalDecisionDialog } from '@/features/approvals/components/approval-decision-dialog';
import {
  Clock,
  CheckCircle2,
  FileDiff,
  Users,
  Search,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  } | null;
  departments?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
}

interface DepartmentHeadClientProps {
  initialRequests: CorrectionRequest[];
  initialFollowUps: FollowUpRecord[];
  teamMembers: TeamMember[];
}

export default function DepartmentHeadClient({
  initialRequests,
  initialFollowUps,
  teamMembers,
}: DepartmentHeadClientProps) {
  const router = useRouter();
  const [requests] = useState<CorrectionRequest[]>(initialRequests);
  const [followUps] = useState<FollowUpRecord[]>(initialFollowUps);
  const [activeTab, setActiveTab] = useState<'approvals' | 'followups' | 'team'>('approvals');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected for decision dialog
  const [selectedRequest, setSelectedRequest] = useState<CorrectionRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Compute stats
  const pendingApprovalsCount = requests.filter((r) => r.status === 'pending').length;
  const activeFollowUpsCount = followUps.filter(
    (f) => f.status === 'submitted' || f.status === 'active'
  ).length;

  function handleOpenDecision(req: CorrectionRequest) {
    setSelectedRequest(req);
    setIsDialogOpen(true);
  }

  function handleDecisionSuccess() {
    setIsDialogOpen(false);
    setSelectedRequest(null);
    setSuccessToast('Decision recorded successfully. Immutability version snapshot committed.');
    setTimeout(() => setSuccessToast(null), 5000);
    router.refresh();
  }

  function renderStatusBadge(status: string) {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Intake Draft</Badge>;
      case 'submitted':
        return <Badge variant="info">Submitted</Badge>;
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
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
              Pending Correction Proposals
            </CardTitle>
            <Clock className="w-5 h-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{pendingApprovalsCount}</div>
            <p className="text-xs text-slate-500 mt-1">Awaiting side-by-side diff review</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Department Active Follow-ups
            </CardTitle>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{activeFollowUpsCount}</div>
            <p className="text-xs text-slate-500 mt-1">Confirmed patient appointments</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Clinical Team Members
            </CardTitle>
            <Users className="w-5 h-5 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{teamMembers.length}</div>
            <p className="text-xs text-slate-500 mt-1">Active doctors and assistants</p>
          </CardContent>
        </Card>
      </div>

      {successToast && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <AlertTitle className="text-xs font-semibold text-emerald-950">Governance Decision Committed</AlertTitle>
          <AlertDescription className="text-xs">{successToast}</AlertDescription>
        </Alert>
      )}

      {/* Main Container */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('approvals')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'approvals'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Correction Approval Queue ({pendingApprovalsCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('followups')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'followups'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Department Follow-ups ({followUps.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'team'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Team Workload ({teamMembers.length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Search patient, MRN, clinician..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              {requests.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  <FileDiff className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-semibold text-slate-700">No Pending Correction Requests</p>
                  <p className="mt-1">All department follow-up version updates have been adjudicated.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 border border-slate-200 rounded-xl hover:border-sky-300 transition-colors bg-white shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">
                            {req.followUp?.patient?.fullName || 'Patient Record'}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            (MRN: {req.followUp?.patient?.mrn || 'N/A'})
                          </span>
                          <Badge variant="warning">Base v{req.baseVersion}</Badge>
                        </div>

                        <div className="text-xs text-slate-600">
                          <strong>Reason:</strong> {req.reason}
                        </div>

                        <div className="text-[11px] text-slate-500">
                          Requester: {req.requester?.fullName} ({req.requester?.role}) &bull;{' '}
                          {req.items?.length || 0} field change(s) proposed
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleOpenDecision(req)}
                          className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-9 space-x-1"
                        >
                          <FileDiff className="w-4 h-4 mr-1" />
                          <span>Review & Decide</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'followups' && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MRN</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Target Date</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Version</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followUps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-500">
                        No department follow-up records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    followUps.map((item) => (
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {teamMembers.map((member) => {
                const assignedCount = followUps.filter(
                  (f) => f.doctor_id === member.id || (f as any).responsible_assistant_id === member.id
                ).length;

                return (
                  <div
                    key={member.id}
                    className="p-4 border border-slate-200 rounded-xl bg-white shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-sm text-slate-900">{member.full_name}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {member.role.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-slate-500">Active Cases:</span>
                      <span className="font-bold text-slate-900">{assignedCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Dialog */}
      <ApprovalDecisionDialog
        request={selectedRequest}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={handleDecisionSuccess}
      />
    </div>
  );
}
