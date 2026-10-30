'use client';

import * as React from 'react';
import { Eye, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CorrectionRequest } from '../types';
import { ApprovalDecisionDialog } from './approval-decision-dialog';

interface ApprovalsQueueProps {
  initialRequests: CorrectionRequest[];
  onRefresh?: () => void;
}

export function ApprovalsQueue({ initialRequests, onRefresh }: ApprovalsQueueProps) {
  const [requests, setRequests] = React.useState<CorrectionRequest[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = React.useState<CorrectionRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'stale' | 'resolved'>('pending');

  React.useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const filteredRequests = requests.filter((req) => {
    const isStale =
      req.status === 'stale' ||
      (req.followUp && req.followUp.currentVersion > req.baseVersion);

    if (filter === 'pending') return req.status === 'pending' && !isStale;
    if (filter === 'stale') return isStale;
    if (filter === 'resolved') return req.status === 'approved' || req.status === 'rejected';
    return true;
  });

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-bold">Correction & Schedule Approval Queue</CardTitle>
          <CardDescription>
            Review clinical change proposals and schedule amendments submitted by doctors and assistants.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} className="h-8">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter Pills */}
        <div className="flex gap-2 border-b pb-3 text-xs">
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
            className="h-7 text-xs"
          >
            Pending Review ({requests.filter((r) => r.status === 'pending').length})
          </Button>
          <Button
            variant={filter === 'stale' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('stale')}
            className="h-7 text-xs"
          >
            Stale Proposals ({requests.filter((r) => r.status === 'stale').length})
          </Button>
          <Button
            variant={filter === 'resolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('resolved')}
            className="h-7 text-xs"
          >
            Resolved ({requests.filter((r) => r.status === 'approved' || r.status === 'rejected').length})
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="h-7 text-xs"
          >
            All Requests ({requests.length})
          </Button>
        </div>

        {/* Table / List */}
        {filteredRequests.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            No correction requests match the selected filter.
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Patient / Record</th>
                  <th className="py-2.5 px-3">Requester</th>
                  <th className="py-2.5 px-3">Base / Current</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Proposed Changes</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const isStale =
                    req.status === 'stale' ||
                    (req.followUp && req.followUp.currentVersion > req.baseVersion);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          {req.followUp?.patient?.fullName || 'Patient Record'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          MRN: {req.followUp?.patient?.mrn || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-medium">
                          {req.requester?.fullName || 'Clinical Staff'}
                        </div>
                        <div className="text-[11px] text-slate-500 uppercase">
                          {req.requester?.role}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        v{req.baseVersion} / v{req.followUp?.currentVersion || req.baseVersion}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          {(req.items || []).slice(0, 2).map((item) => (
                            <div key={item.id} className="text-[11px]">
                              <span className="text-slate-500">{item.fieldName}:</span>{' '}
                              <span className="font-semibold text-slate-800">{item.proposedValue}</span>
                            </div>
                          ))}
                          {(req.items || []).length > 2 && (
                            <div className="text-[10px] text-slate-400">
                              +{(req.items || []).length - 2} more...
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {isStale ? (
                          <Badge variant="warning" className="flex items-center gap-1 w-fit">
                            <Clock className="h-3 w-3" /> STALE
                          </Badge>
                        ) : req.status === 'approved' ? (
                          <Badge variant="success" className="w-fit">APPROVED</Badge>
                        ) : req.status === 'rejected' ? (
                          <Badge variant="destructive" className="w-fit">REJECTED</Badge>
                        ) : (
                          <Badge variant="default" className="w-fit">PENDING</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setSelectedRequest(req);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {req.status === 'pending' ? 'Review & Decide' : 'View Diff'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <ApprovalDecisionDialog
        request={selectedRequest}
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedRequest(null);
        }}
        onSuccess={() => {
          onRefresh?.();
        }}
      />
    </Card>
  );
}
