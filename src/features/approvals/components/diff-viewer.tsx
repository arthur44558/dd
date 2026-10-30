'use client';

import * as React from 'react';
import { AlertCircle, Clock, FileDiff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { CorrectionRequest } from '../types';

interface DiffViewerProps {
  request: CorrectionRequest;
}

export function DiffViewer({ request }: DiffViewerProps) {
  const isStale =
    request.status === 'stale' ||
    (request.followUp && request.followUp.currentVersion > request.baseVersion);

  return (
    <div className="space-y-4">
      {/* Header and status banner */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <FileDiff className="h-5 w-5 text-sky-600" />
          <h3 className="font-semibold text-slate-900 text-sm">
            Correction Request Diff (Base Version: v{request.baseVersion})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isStale && (
            <Badge variant="warning" className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Stale Proposal
            </Badge>
          )}
          <Badge
            variant={
              request.status === 'approved'
                ? 'success'
                : request.status === 'rejected'
                ? 'destructive'
                : request.status === 'stale'
                ? 'warning'
                : 'default'
            }
          >
            {request.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Stale Warning Alert */}
      {isStale && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Stale Proposal Warning</AlertTitle>
          <AlertDescription>
            This correction proposal was created against version {request.baseVersion}, but the
            current follow-up record has advanced to version {request.followUp?.currentVersion}.
            Review the latest record state before approving.
          </AlertDescription>
        </Alert>
      )}

      {/* Requester and Reason */}
      <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
        <div className="flex justify-between text-slate-600">
          <span>
            Requested by:{' '}
            <strong className="text-slate-900">
              {request.requester?.fullName || 'Clinical Staff'} ({request.requester?.role})
            </strong>
          </span>
          <span>{new Date(request.createdAt).toLocaleString('en-IN')}</span>
        </div>
        <div className="pt-1">
          <span className="font-medium text-slate-700">Clinical Reason: </span>
          <span className="text-slate-900">{request.reason}</span>
        </div>
        {request.supportingEvidence && (
          <div className="pt-1">
            <span className="font-medium text-slate-700">Supporting Evidence: </span>
            <span className="text-slate-900">{request.supportingEvidence}</span>
          </div>
        )}
      </div>

      {/* Field-by-Field Diff Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 border-b text-slate-600 uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-2.5 px-4 w-1/4">Field</th>
              <th className="py-2.5 px-4 w-3/8 text-red-700">Original Value</th>
              <th className="py-2.5 px-4 w-3/8 text-emerald-700">Proposed Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {request.items && request.items.length > 0 ? (
              request.items.map((item) => (
                <tr
                  key={item.id}
                  className={item.isStale ? 'bg-amber-50/50' : 'hover:bg-slate-50/80'}
                >
                  <td className="py-2.5 px-4 font-medium text-slate-800">
                    {formatFieldName(item.fieldName)}
                  </td>
                  <td className="py-2.5 px-4 text-red-700 bg-red-50/40 line-through">
                    {item.originalValue || <span className="text-slate-400 italic font-normal">None</span>}
                  </td>
                  <td className="py-2.5 px-4 text-emerald-800 bg-emerald-50/40 font-semibold">
                    {item.proposedValue}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="py-4 text-center text-slate-500 italic">
                  No individual field changes listed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatFieldName(name: string): string {
  switch (name) {
    case 'appointment_date':
      return 'Appointment Date';
    case 'severity':
      return 'Clinical Severity';
    case 'notes':
      return 'Clinical Notes / Instructions';
    case 'follow_up_required':
      return 'Follow-Up Required';
    default:
      return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
