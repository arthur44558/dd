'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveAccountRequest,
  rejectAccountRequest,
  deactivateUserProfile,
} from '@/features/auth/admin-actions';
import type { UserRole, AccountStatus } from '@/types/auth';
import { operationalRoles } from '@/features/auth/schemas';
import {
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Search,
  Filter,
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

interface Department {
  id: string;
  name: string;
  code: string;
}

interface RequestRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  employee_id: string | null;
  requested_role: UserRole;
  department_id: string | null;
  justification: string;
  status: AccountStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  departments?: { name: string; code: string } | null;
}

interface ProfileRecord {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department_id: string | null;
  status: AccountStatus;
  created_at: string;
  departments?: { name: string; code: string } | null;
}

interface ITAdminClientProps {
  initialRequests: RequestRecord[];
  initialProfiles: ProfileRecord[];
  departments: Department[];
  currentUserId: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  reception: 'Reception Staff',
  assistant: "Doctor's Assistant",
  doctor: 'Attending Doctor',
  department_head: 'Department Head',
  coordinator: 'Follow-up Coordinator',
  follow_up_head: 'Follow-up Head',
  it_admin: 'IT Administrator',
};

export default function ITAdminClient({
  initialRequests,
  initialProfiles,
  departments,
  currentUserId,
}: ITAdminClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'requests' | 'profiles'>('requests');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Action dialog states
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);
  const [approvalRole, setApprovalRole] = useState<UserRole>('reception');
  const [approvalDept, setApprovalDept] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [dialogMode, setDialogMode] = useState<'approve' | 'reject' | null>(null);

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Compute stats
  const pendingCount = initialRequests.filter((r) => r.status === 'pending').length;
  const activeStaffCount = initialProfiles.filter((p) => p.status === 'active').length;
  const deactivatedCount = initialProfiles.filter((p) => p.status === 'deactivated').length;

  // Filter requests
  const filteredRequests = initialRequests.filter((r) => {
    const matchesFilter = statusFilter === 'all' || r.status === statusFilter;
    const matchesQuery =
      searchQuery === '' ||
      r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.employee_id && r.employee_id.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesQuery;
  });

  // Filter profiles
  const filteredProfiles = initialProfiles.filter((p) => {
    return (
      searchQuery === '' ||
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  function openApproveDialog(req: RequestRecord) {
    setSelectedRequest(req);
    setApprovalRole(req.requested_role);
    setApprovalDept(req.department_id || '');
    setActionError(null);
    setDialogMode('approve');
  }

  function openRejectDialog(req: RequestRecord) {
    setSelectedRequest(req);
    setRejectionReason('');
    setActionError(null);
    setDialogMode('reject');
  }

  async function handleConfirmApprove() {
    if (!selectedRequest) return;
    setSubmittingAction(true);
    setActionError(null);

    try {
      const res = await approveAccountRequest(
        selectedRequest.id,
        approvalRole,
        approvalDept || null
      );

      if (!res.success) {
        throw new Error(res.error || 'Approval failed');
      }

      setActionSuccess(`Successfully approved ${selectedRequest.full_name}. Invitation email dispatched.`);
      setDialogMode(null);
      setSelectedRequest(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval error';
      setActionError(msg);
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleConfirmReject() {
    if (!selectedRequest) return;
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      setActionError('Rejection reason must be at least 5 characters');
      return;
    }

    setSubmittingAction(true);
    setActionError(null);

    try {
      const res = await rejectAccountRequest(selectedRequest.id, rejectionReason.trim());
      if (!res.success) {
        throw new Error(res.error || 'Rejection failed');
      }

      setActionSuccess(`Request for ${selectedRequest.full_name} has been rejected.`);
      setDialogMode(null);
      setSelectedRequest(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection error';
      setActionError(msg);
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleDeactivateUser(profile: ProfileRecord) {
    if (profile.id === currentUserId) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }

    if (!confirm(`Are you sure you want to deactivate ${profile.full_name} (${profile.email})? Login access will be revoked immediately.`)) {
      return;
    }

    setDeactivatingId(profile.id);
    setActionError(null);

    try {
      const res = await deactivateUserProfile(profile.id);
      if (!res.success) {
        throw new Error(res.error || 'Deactivation failed');
      }

      setActionSuccess(`Account for ${profile.full_name} has been deactivated.`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deactivation error';
      setActionError(msg);
    } finally {
      setDeactivatingId(null);
    }
  }

  function renderStatusBadge(status: AccountStatus) {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending Review</Badge>;
      case 'approved':
      case 'invited':
        return <Badge variant="info">{status === 'invited' ? 'Invited' : 'Approved'}</Badge>;
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'rejected':
      case 'deactivated':
        return <Badge variant="destructive">{status === 'rejected' ? 'Rejected' : 'Deactivated'}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Pending Access Requests
            </CardTitle>
            <Clock className="w-5 h-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{pendingCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              Awaiting identity & role verification
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Active Staff Profiles</CardTitle>
            <UserCheck className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{activeStaffCount}</div>
            <p className="text-xs text-slate-500 mt-1">Operational hospital workforce</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Deactivated Accounts
            </CardTitle>
            <UserX className="w-5 h-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{deactivatedCount}</div>
            <p className="text-xs text-slate-500 mt-1">Access permanently revoked</p>
          </CardContent>
        </Card>
      </div>

      {actionSuccess && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <AlertTitle className="font-semibold text-emerald-900">Operation Successful</AlertTitle>
          <AlertDescription className="text-xs">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <AlertTitle className="font-semibold">Operation Error</AlertTitle>
          <AlertDescription className="text-xs">{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Main Container */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Tabs */}
            <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('requests');
                  setSearchQuery('');
                }}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'requests'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Access Requests Queue ({initialRequests.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('profiles');
                  setSearchQuery('');
                }}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'profiles'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Staff Profile Directory ({initialProfiles.length})
              </button>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Search by name, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>

              {activeTab === 'requests' && (
                <div className="flex items-center space-x-1">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs h-9 w-32"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {activeTab === 'requests' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Requested Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Justification</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                        No access requests match the current criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900 text-xs">{req.full_name}</div>
                          {req.employee_id && (
                            <div className="text-[11px] text-slate-500 font-mono">
                              ID: {req.employee_id}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-800">{req.email}</div>
                          <div className="text-[11px] text-slate-500">{req.phone}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-slate-700">
                            {ROLE_LABELS[req.requested_role] || req.requested_role}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-600">
                            {req.departments?.name || 'General / None'}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-slate-600" title={req.justification}>
                          {req.justification}
                        </TableCell>
                        <TableCell>{renderStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {req.status === 'pending' ? (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openApproveDialog(req)}
                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRejectDialog(req)}
                                className="h-8 text-xs text-red-600 hover:border-red-300"
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Processed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500 text-xs">
                        No staff profiles match the search query.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProfiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-slate-900 text-xs">
                          {p.full_name}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">{p.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ROLE_LABELS[p.role] || p.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {p.departments?.name || 'Hospital Administration'}
                        </TableCell>
                        <TableCell>{renderStatusBadge(p.status)}</TableCell>
                        <TableCell className="text-right">
                          {p.status === 'active' && p.id !== currentUserId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeactivateUser(p)}
                              disabled={deactivatingId === p.id}
                              className="h-8 text-xs text-red-600 hover:bg-red-50 hover:border-red-200"
                            >
                              {deactivatingId === p.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                'Deactivate'
                              )}
                            </Button>
                          )}
                          {p.id === currentUserId && (
                            <span className="text-xs text-slate-400">Current User</span>
                          )}
                          {p.status === 'deactivated' && (
                            <span className="text-xs text-red-500 font-medium">Deactivated</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog
        open={dialogMode === 'approve'}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
      >
        <DialogContent onClose={() => setDialogMode(null)}>
          <DialogHeader>
            <DialogTitle>Approve Staff Access Request</DialogTitle>
            <DialogDescription>
              Assign the final verified operational role and department assignment.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div>
                  <span className="text-slate-500 font-medium">Applicant:</span>{' '}
                  <strong className="text-slate-800">{selectedRequest.full_name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Hospital Email:</span>{' '}
                  <span className="font-mono text-slate-800">{selectedRequest.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Requested:</span>{' '}
                  <span className="text-slate-800 font-medium">
                    {ROLE_LABELS[selectedRequest.requested_role]}
                  </span>
                </div>
              </div>

              {actionError && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <AlertDescription className="text-xs">{actionError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label htmlFor="finalRole" className="text-xs font-semibold">
                  Final Operational Role
                </Label>
                <Select
                  id="finalRole"
                  value={approvalRole}
                  onChange={(e) => setApprovalRole(e.target.value as UserRole)}
                  className="text-xs"
                >
                  {operationalRoles.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-slate-500">
                  IT Admin role cannot be granted via public request approval.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="finalDept" className="text-xs font-semibold">
                  Assigned Clinical Department
                </Label>
                <Select
                  id="finalDept"
                  value={approvalDept}
                  onChange={(e) => setApprovalDept(e.target.value)}
                  className="text-xs"
                >
                  <option value="">-- No Department (Central / Reception / Coordinator) --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center">
                  <ShieldAlert className="w-4 h-4 mr-1 text-amber-700" />
                  Approval Action Notice
                </p>
                <p>
                  Approving this request will invoke the Supabase Auth Admin API to dispatch an
                  invitation email with an activation link to <strong>{selectedRequest.email}</strong>.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogMode(null)}
              disabled={submittingAction}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmApprove}
              disabled={submittingAction}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submittingAction ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Issuing Invitation...</span>
                </>
              ) : (
                <span>Confirm & Invite Staff</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog
        open={dialogMode === 'reject'}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
      >
        <DialogContent onClose={() => setDialogMode(null)}>
          <DialogHeader>
            <DialogTitle>Decline Staff Access Request</DialogTitle>
            <DialogDescription>
              State the reason for rejecting this access request. The reason will be recorded in
              the audit history.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="text-xs text-slate-600">
                Rejecting request for <strong>{selectedRequest.full_name}</strong> (
                {selectedRequest.email})
              </div>

              {actionError && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <AlertDescription className="text-xs">{actionError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label htmlFor="rejectionReason" className="text-xs font-semibold">
                  Rejection Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="rejectionReason"
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Identity could not be verified with hospital HR records."
                  className="text-xs"
                />
                <p className="text-[11px] text-slate-500">
                  Minimum 5 characters. Requester will see this reason on the status tracker.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogMode(null)}
              disabled={submittingAction}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={submittingAction}
            >
              {submittingAction ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <span>Confirm Rejection</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
