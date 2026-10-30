'use client';

import { useState } from 'react';
import type { AnalyticsDashboardData } from '@/features/analytics/types';
import {
  AlertCircle,
  CheckCircle2,
  Users,
  Building2,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

interface FollowUpHeadClientProps {
  initialData: AnalyticsDashboardData;
}

export default function FollowUpHeadClient({ initialData }: FollowUpHeadClientProps) {
  const [data] = useState<AnalyticsDashboardData>(initialData);
  const { kpis, coordinatorWorkload, departmentMetrics } = data;

  return (
    <div className="space-y-6">
      {/* Strict Privacy Protection Notice */}
      <Alert className="bg-purple-50 border-purple-200 text-purple-950">
        <ShieldCheck className="w-4 h-4 shrink-0 text-purple-700" />
        <AlertTitle className="text-xs font-semibold text-purple-900">
          Executive Operational Boundary (Zero Clinical Text)
        </AlertTitle>
        <AlertDescription className="text-xs text-purple-800">
          This dashboard strictly aggregates operational performance indicators, overdue escalation
          rates, and central coordinator pool throughput. Patient clinical notes, diagnoses, and
          prescriptions are completely excluded from executive reporting.
        </AlertDescription>
      </Alert>

      {/* Hospital-Wide KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Follow-ups</CardTitle>
            <Layers className="w-5 h-5 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{kpis.totalFollowUps}</div>
            <p className="text-xs text-slate-500 mt-1">Hospital-wide continuity volume</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Active Pipeline</CardTitle>
            <Activity className="w-5 h-5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{kpis.activeFollowUps}</div>
            <p className="text-xs text-slate-500 mt-1">Cases currently under management</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Overdue Rate</CardTitle>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{kpis.overdueRate}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {kpis.overdueFollowUps} overdue / escalated cases
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Completion Rate</CardTitle>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{kpis.completionRate}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {kpis.completedFollowUps} successfully completed
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Central Coordinator Workload Table */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span>Coordinator Pool Workload</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Active assignments, throughput, and capacity status per staff member.
                </CardDescription>
              </div>
              <Badge variant="outline">{coordinatorWorkload.length} Staff</Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coordinator</TableHead>
                    <TableHead className="text-center">Active Tasks</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-right">Workload Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coordinatorWorkload.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-xs text-slate-500">
                        No coordinators registered in central pool.
                      </TableCell>
                    </TableRow>
                  ) : (
                    coordinatorWorkload.map((cw) => {
                      const isHighLoad = cw.activeTasks >= 10;
                      return (
                        <TableRow key={cw.coordinatorId}>
                          <TableCell className="font-semibold text-xs text-slate-900">
                            {cw.coordinatorName}
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs text-slate-800">
                            {cw.activeTasks}
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-600">
                            {cw.completedTasks}
                          </TableCell>
                          <TableCell className="text-right">
                            {isHighLoad ? (
                              <Badge variant="warning" className="text-[11px]">
                                High Load
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-[11px]">
                                Balanced
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Departmental Throughput Breakdown */}
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>Clinical Department Throughput</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Follow-up adherence and completion rates across clinical departments.
                </CardDescription>
              </div>
              <Badge variant="outline">{departmentMetrics.length} Departments</Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-center">Overdue</TableHead>
                    <TableHead className="text-right">Adherence Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentMetrics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-500">
                        No department metrics recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    departmentMetrics.map((dept) => (
                      <TableRow key={dept.departmentId}>
                        <TableCell>
                          <span className="font-semibold text-xs text-slate-900 block">
                            {dept.departmentName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {dept.departmentCode}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold text-slate-800">
                          {dept.totalFollowUps}
                        </TableCell>
                        <TableCell className="text-center text-xs text-emerald-700 font-medium">
                          {dept.completedFollowUps}
                        </TableCell>
                        <TableCell className="text-center text-xs text-red-600 font-medium">
                          {dept.overdueFollowUps}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <span className="text-xs font-bold text-slate-900">
                              {dept.completionRate}%
                            </span>
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(dept.completionRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
