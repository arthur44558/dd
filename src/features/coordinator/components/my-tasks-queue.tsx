'use client';

import * as React from 'react';
import {
  Send,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommunicationTask } from '../types';
import { TaskPriorityBadge } from './task-priority-badge';
import { SimulatedSendDialog } from './simulated-send-dialog';
import { OutcomeRecordingDialog } from './outcome-recording-dialog';

interface MyTasksQueueProps {
  initialTasks: CommunicationTask[];
  onRefresh?: () => void;
}

export function MyTasksQueue({ initialTasks, onRefresh }: MyTasksQueueProps) {
  const [tasks, setTasks] = React.useState<CommunicationTask[]>(initialTasks);
  const [selectedTaskForSend, setSelectedTaskForSend] = React.useState<CommunicationTask | null>(null);
  const [selectedTaskForOutcome, setSelectedTaskForOutcome] = React.useState<CommunicationTask | null>(null);
  const [filter, setFilter] = React.useState<'open' | 'due' | 'overdue' | 'completed'>('open');

  React.useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const now = new Date();

  const filteredTasks = tasks.filter((t) => {
    const isCompleted = t.status === 'completed';
    const isDue = new Date(t.dueAt) <= now;
    const isOverdue = t.followUp?.status === 'overdue' || isDue;

    if (filter === 'completed') return isCompleted;
    if (filter === 'overdue') return !isCompleted && isOverdue;
    if (filter === 'due') return !isCompleted && isDue;
    // 'open'
    return !isCompleted;
  });

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-bold">Coordinator Tasks Queue ("My Tasks")</CardTitle>
          <CardDescription>
            Patient follow-up communications strictly prioritized by clinical severity, then nearest due date.
          </CardDescription>
        </div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="h-8">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh Queue
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter Pills */}
        <div className="flex gap-2 border-b pb-3 text-xs">
          <Button
            variant={filter === 'open' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('open')}
            className="h-7 text-xs"
          >
            All Open Tasks ({tasks.filter((t) => t.status !== 'completed').length})
          </Button>
          <Button
            variant={filter === 'overdue' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('overdue')}
            className="h-7 text-xs text-red-700 hover:text-red-800"
          >
            Overdue (
            {
              tasks.filter(
                (t) => t.status !== 'completed' && (t.followUp?.status === 'overdue' || new Date(t.dueAt) <= now)
              ).length
            }
            )
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('completed')}
            className="h-7 text-xs"
          >
            Completed ({tasks.filter((t) => t.status === 'completed').length})
          </Button>
        </div>

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
            No tasks in this view. Great job keeping up with patient follow-ups!
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Patient / MRN</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Task & Channel</th>
                  <th className="py-2.5 px-3">Due / Appt Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const isTaskOverdue =
                    task.status !== 'completed' &&
                    (task.followUp?.status === 'overdue' || new Date(task.dueAt) <= now);
                  const isSharedPhone = task.followUp?.patient?.isSharedContact;

                  return (
                    <tr
                      key={task.id}
                      className={
                        task.priority === 'critical'
                          ? 'bg-red-50/30 hover:bg-red-50/60'
                          : task.priority === 'high'
                          ? 'bg-amber-50/20 hover:bg-amber-50/50'
                          : 'hover:bg-slate-50/80'
                      }
                    >
                      <td className="py-3 px-3">
                        <TaskPriorityBadge priority={task.priority} />
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          {task.followUp?.patient?.fullName || 'Patient Record'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {task.followUp?.patient?.mrn || 'MRN-PENDING'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-slate-800">
                          {task.followUp?.patient?.primaryPhone || 'No Phone'}
                        </div>
                        {isSharedPhone && (
                          <Badge
                            variant="danger"
                            className="mt-0.5 text-[9px] py-0 px-1 flex items-center gap-0.5 w-fit"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" /> Shared Phone
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 font-medium text-slate-800">
                          {task.channel === 'call' ? (
                            <Phone className="h-3.5 w-3.5 text-sky-600" />
                          ) : (
                            <Send className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                          <span>{formatTaskType(task.taskType)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 uppercase">{task.channel}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-slate-800 font-medium">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{new Date(task.dueAt).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Appt: {task.followUp?.appointmentDate || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {task.status === 'completed' ? (
                          <Badge variant="success">COMPLETED</Badge>
                        ) : isTaskOverdue ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" /> OVERDUE
                          </Badge>
                        ) : (
                          <Badge variant="default">PENDING</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {task.status !== 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                              onClick={() => setSelectedTaskForSend(task)}
                            >
                              <Send className="h-3 w-3 mr-1" /> Simulate Send
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setSelectedTaskForOutcome(task)}
                          >
                            <UserCheck className="h-3 w-3 mr-1" /> Record Outcome
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Simulated Send / Call Dialog */}
      <SimulatedSendDialog
        task={selectedTaskForSend}
        isOpen={!!selectedTaskForSend}
        onClose={() => setSelectedTaskForSend(null)}
        onSuccess={() => onRefresh?.()}
      />

      {/* Outcome Recording Dialog */}
      <OutcomeRecordingDialog
        followUpId={selectedTaskForOutcome?.followUpId || null}
        patientName={selectedTaskForOutcome?.followUp?.patient?.fullName}
        mrn={selectedTaskForOutcome?.followUp?.patient?.mrn}
        isOpen={!!selectedTaskForOutcome}
        onClose={() => setSelectedTaskForOutcome(null)}
        onSuccess={() => onRefresh?.()}
      />
    </Card>
  );
}

function formatTaskType(type: string): string {
  switch (type) {
    case 'pre_appointment_text':
      return 'Pre-Appt Text Reminder';
    case 'pre_appointment_call':
      return 'Pre-Appt Call Task';
    case 'overdue_text_day_2':
      return 'Overdue Text (+2 Days)';
    case 'overdue_text_day_4':
      return 'Overdue Text (+4 Days)';
    case 'correction_notice':
      return 'Schedule Correction Notice';
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
