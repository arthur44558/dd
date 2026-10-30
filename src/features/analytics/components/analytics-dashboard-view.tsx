'use client';

import React, { useState, useTransition } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MessageSquare,
  Users,
  Building2,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { getFollowUpHeadAnalytics } from '../actions';
import type { AnalyticsDashboardData } from '../types';

interface AnalyticsDashboardViewProps {
  initialData: AnalyticsDashboardData;
}

export function AnalyticsDashboardView({ initialData }: AnalyticsDashboardViewProps) {
  const [data, setData] = useState<AnalyticsDashboardData>(initialData);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      const refreshed = await getFollowUpHeadAnalytics();
      setData(refreshed);
    });
  };

  const { kpis, departmentMetrics, coordinatorWorkload, generatedAt } = data;

  return (
    <div className="space-y-6">
      {/* Privacy Notice Banner */}
      <div className="p-4 bg-teal-900 text-teal-50 rounded-xl flex items-start gap-3 shadow-xs">
        <Shield className="w-5 h-5 text-teal-300 mt-0.5 flex-shrink-0" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-200">
            Privacy-Preserving Executive Dashboard
          </p>
          <p className="text-xs text-teal-100/90 leading-relaxed">
            Clinical notes, diagnoses, and patient identities are segregated from executive reporting. All metrics shown are strictly aggregated throughput and workload numbers.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-800 hover:bg-teal-700 text-teal-100 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Follow-ups */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Volume</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{kpis.totalFollowUps}</div>
          <p className="text-[11px] text-slate-500">All registered follow-up cycles</p>
        </div>

        {/* Active Cases */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active In Pipeline</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700">{kpis.activeFollowUps}</div>
          <p className="text-[11px] text-slate-500">Under reminder or scheduled cycle</p>
        </div>

        {/* Completion Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{kpis.completionRate}%</div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, kpis.completionRate))}%` }}
            />
          </div>
        </div>

        {/* Overdue Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue Rate</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">{kpis.overdueRate}%</div>
          <p className="text-[11px] text-slate-500">{kpis.overdueFollowUps} overdue cases</p>
        </div>

        {/* Open Inquiries */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Open Inquiries</span>
            <MessageSquare className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-700">{kpis.openInquiriesCount}</div>
          <p className="text-[11px] text-slate-500">Clinical questions in progress</p>
        </div>
      </div>

      {/* Two Column Layout: Department Breakdown & Coordinator Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Throughput Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-700" />
              <h3 className="font-bold text-slate-800 text-sm">
                Department Follow-Up Continuity
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {departmentMetrics.length} Departments
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Total Cases</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Overdue</th>
                  <th className="px-4 py-3">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departmentMetrics.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No departments registered.
                    </td>
                  </tr>
                ) : (
                  departmentMetrics.map((dept) => (
                    <tr key={dept.departmentId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{dept.departmentName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{dept.departmentCode}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {dept.totalFollowUps}
                      </td>
                      <td className="px-4 py-3 text-emerald-700 font-medium">
                        {dept.completedFollowUps}
                      </td>
                      <td className="px-4 py-3 text-amber-700 font-medium">
                        {dept.overdueFollowUps}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-xs min-w-[2.5rem]">
                            {dept.completionRate}%
                          </span>
                          <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-teal-600 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, dept.completionRate))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coordinator Workload Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-700" />
              <h3 className="font-bold text-slate-800 text-sm">
                Coordinator Workload Distribution
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Central Hospital Pool
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Coordinator</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Active Tasks</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Load Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coordinatorWorkload.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No coordinators found in central pool.
                    </td>
                  </tr>
                ) : (
                  coordinatorWorkload.map((coord) => {
                    const isHeavy = coord.activeTasks >= 15;
                    const isOptimal = coord.activeTasks > 0 && coord.activeTasks < 15;

                    return (
                      <tr key={coord.coordinatorId} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                          {coord.coordinatorName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              coord.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {coord.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {coord.activeTasks}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {coord.completedTasks}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isHeavy ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Heavy Load
                            </span>
                          ) : isOptimal ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              Optimal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              Available
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer Timestamp */}
      <div className="text-right text-[11px] text-slate-400">
        Aggregated as of {new Date(generatedAt).toLocaleString()} (Hospital Standard Time)
      </div>
    </div>
  );
}
