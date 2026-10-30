'use client';

import React, { useState, useTransition } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  X,
  FileCode,
  Lock,
} from 'lucide-react';
import { getAuditEvents } from '../actions';
import type { AuditEvent, AuditEventOutcome } from '../types';

interface AuditTrailViewerProps {
  initialEvents: AuditEvent[];
  initialTotal: number;
}

export function AuditTrailViewer({
  initialEvents,
  initialTotal,
}: AuditTrailViewerProps) {
  const [events, setEvents] = useState<AuditEvent[]>(initialEvents);
  const [total, setTotal] = useState<number>(initialTotal);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<AuditEventOutcome | ''>('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleApplyFilter = () => {
    startTransition(async () => {
      const res = await getAuditEvents({
        action: actionFilter || undefined,
        targetType: targetTypeFilter || undefined,
        outcome: (outcomeFilter as AuditEventOutcome) || undefined,
        limit: 50,
      });
      setEvents(res.events);
      setTotal(res.total);
    });
  };

  const handleReset = () => {
    setActionFilter('');
    setTargetTypeFilter('');
    setOutcomeFilter('');
    startTransition(async () => {
      const res = await getAuditEvents({ limit: 50 });
      setEvents(res.events);
      setTotal(res.total);
    });
  };

  const getOutcomeBadge = (outcome: AuditEventOutcome) => {
    switch (outcome) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Success
          </span>
        );
      case 'failure':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 text-red-600" /> Failure
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Denied
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Immutability Banner */}
      <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-100">
              Cryptographically Protected Immutable Audit Trail
            </p>
            <p className="text-[11px] text-slate-400">
              Zero UPDATE and DELETE operations are allowed. All events are permanently recorded.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-lg text-[11px] font-mono text-slate-300">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>WORM Compliant</span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Search by action (e.g. follow_up, query)..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          <div className="w-44">
            <select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value)}
              className="w-full py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
            >
              <option value="">All Target Types</option>
              <option value="follow_ups">Follow Ups</option>
              <option value="internal_queries">Internal Queries</option>
              <option value="profiles">Staff Profiles</option>
              <option value="account_requests">Account Requests</option>
              <option value="patients">Patients</option>
            </select>
          </div>

          <div className="w-36">
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as AuditEventOutcome | '')}
              className="w-full py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
            >
              <option value="">All Outcomes</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="denied">Denied</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleApplyFilter}
            disabled={isPending}
            className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{isPending ? 'Filtering...' : 'Filter'}</span>
          </button>

          {(actionFilter || targetTypeFilter || outcomeFilter) && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Reset
            </button>
          )}

          <span className="text-xs text-slate-500 ml-auto font-medium">
            Showing {events.length} of {total} records
          </span>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No audit records match the current criteria.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(evt.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{evt.actorName}</div>
                      <div className="text-[10px] uppercase text-slate-400 font-medium">
                        {evt.actorRole || 'System'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60 font-medium">
                        {evt.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{evt.targetType}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {evt.targetId.slice(0, 12)}...
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getOutcomeBadge(evt.outcome)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(evt)}
                        className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold text-xs hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-teal-700" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Audit Event Inspection
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-medium">Event ID</span>
                  <span className="font-mono text-slate-800 break-all">{selectedEvent.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-medium">Timestamp</span>
                  <span className="text-slate-800">{new Date(selectedEvent.createdAt).toISOString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-medium">Outcome</span>
                  <div>{getOutcomeBadge(selectedEvent.outcome)}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-medium">Actor</span>
                  <span className="font-medium text-slate-800">{selectedEvent.actorName} ({selectedEvent.actorRole})</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-medium">Action</span>
                  <span className="font-mono text-teal-800 font-semibold">{selectedEvent.action}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-medium">Target</span>
                  <span className="font-mono text-slate-800">{selectedEvent.targetType} / {selectedEvent.targetId}</span>
                </div>
              </div>

              {selectedEvent.reason && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Stated Reason:</span>
                  <p className="p-2.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg font-medium">
                    {selectedEvent.reason}
                  </p>
                </div>
              )}

              {/* JSON Metadata */}
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Metadata Payload:</span>
                <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-44 border border-slate-800">
                  {JSON.stringify(selectedEvent.metadata, null, 2)}
                </pre>
              </div>

              {/* Before/After states if present */}
              {selectedEvent.beforeState && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">State Before Operation:</span>
                  <pre className="p-3 bg-slate-900 text-slate-300 font-mono text-[11px] rounded-lg overflow-x-auto max-h-44 border border-slate-800">
                    {JSON.stringify(selectedEvent.beforeState, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEvent.afterState && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">State After Operation:</span>
                  <pre className="p-3 bg-slate-900 text-slate-300 font-mono text-[11px] rounded-lg overflow-x-auto max-h-44 border border-slate-800">
                    {JSON.stringify(selectedEvent.afterState, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
              <span className="text-[11px] text-slate-400 italic">
                Read-only forensic view. Modifications are mathematically impossible.
              </span>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
