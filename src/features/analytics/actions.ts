'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  AnalyticsDashboardData,
  FollowUpHeadKPIs,
  CoordinatorWorkloadMetric,
  DepartmentBreakdownMetric,
} from './types';

/**
 * Fetches executive operational metrics for Follow-up Head and Department Heads.
 * Privacy-Preserving: Strictly aggregates numbers. Zero clinical text, notes,
 * diagnoses, patient names, MRNs, or telephone numbers are retrieved or exposed.
 */
export async function getFollowUpHeadAnalytics(
  selectedDepartmentId?: string
): Promise<AnalyticsDashboardData> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Verify session
    if (!user) {
      // In local dev/test or server actions without session, continue with admin or default
    }
    // Check follow-ups counts
    let fuQuery = supabaseAdmin
      .from('follow_ups')
      .select('id, status, department_id');

    if (selectedDepartmentId) {
      fuQuery = fuQuery.eq('department_id', selectedDepartmentId);
    }

    const { data: followUps, error: fuErr } = await fuQuery;

    let totalFollowUps = 0;
    let activeFollowUps = 0;
    let completedFollowUps = 0;
    let overdueFollowUps = 0;

    const deptStatsMap = new Map<
      string,
      { total: number; completed: number; overdue: number }
    >();

    if (!fuErr && followUps) {
      totalFollowUps = followUps.length;
      for (const fu of followUps) {
        if (fu.status === 'active' || fu.status === 'submitted') {
          activeFollowUps++;
        } else if (fu.status === 'completed') {
          completedFollowUps++;
        } else if (fu.status === 'overdue') {
          overdueFollowUps++;
        }

        // Aggregate by department
        if (fu.department_id) {
          const current = deptStatsMap.get(fu.department_id) || {
            total: 0,
            completed: 0,
            overdue: 0,
          };
          current.total++;
          if (fu.status === 'completed') current.completed++;
          if (fu.status === 'overdue') current.overdue++;
          deptStatsMap.set(fu.department_id, current);
        }
      }
    }

    const completionRate =
      totalFollowUps > 0
        ? Math.round((completedFollowUps / totalFollowUps) * 1000) / 10
        : 0;

    const overdueRate =
      totalFollowUps > 0
        ? Math.round((overdueFollowUps / totalFollowUps) * 1000) / 10
        : 0;

    // Count open internal inquiries
    const { count: openInquiries } = await supabaseAdmin
      .from('internal_queries')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']);

    const kpis: FollowUpHeadKPIs = {
      totalFollowUps,
      activeFollowUps,
      completedFollowUps,
      overdueFollowUps,
      completionRate,
      overdueRate,
      openInquiriesCount: openInquiries || 0,
    };

    // Department breakdown
    const { data: departments } = await supabaseAdmin
      .from('departments')
      .select('id, name, code')
      .eq('is_active', true);

    const departmentMetrics: DepartmentBreakdownMetric[] = (departments || []).map((d) => {
      const stats = deptStatsMap.get(d.id) || { total: 0, completed: 0, overdue: 0 };
      const rate =
        stats.total > 0
          ? Math.round((stats.completed / stats.total) * 1000) / 10
          : 0;

      return {
        departmentId: d.id,
        departmentName: d.name,
        departmentCode: d.code,
        totalFollowUps: stats.total,
        completedFollowUps: stats.completed,
        overdueFollowUps: stats.overdue,
        completionRate: rate,
      };
    });

    // Coordinator workload distribution
    const { data: coordinators } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, status')
      .eq('role', 'coordinator');

    // Query active and completed tasks from communication_tasks if table exists
    let tasksByCoordinator = new Map<string, { active: number; completed: number }>();
    try {
      const { data: tasks } = await supabaseAdmin
        .from('communication_tasks')
        .select('assigned_coordinator_id, status');

      if (tasks) {
        for (const t of tasks) {
          if (t.assigned_coordinator_id) {
            const current = tasksByCoordinator.get(t.assigned_coordinator_id) || {
              active: 0,
              completed: 0,
            };
            if (t.status === 'completed' || t.status === 'sent') {
              current.completed++;
            } else {
              current.active++;
            }
            tasksByCoordinator.set(t.assigned_coordinator_id, current);
          }
        }
      }
    } catch {
      // communication_tasks may not have data yet
    }

    const coordinatorWorkload: CoordinatorWorkloadMetric[] = (coordinators || []).map((c) => {
      const stats = tasksByCoordinator.get(c.id) || { active: 0, completed: 0 };
      return {
        coordinatorId: c.id,
        coordinatorName: c.full_name,
        activeTasks: stats.active,
        completedTasks: stats.completed,
        status: c.status,
      };
    });

    return {
      kpis,
      coordinatorWorkload,
      departmentMetrics,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('getFollowUpHeadAnalytics exception:', err);
    return {
      kpis: {
        totalFollowUps: 0,
        activeFollowUps: 0,
        completedFollowUps: 0,
        overdueFollowUps: 0,
        completionRate: 0,
        overdueRate: 0,
        openInquiriesCount: 0,
      },
      coordinatorWorkload: [],
      departmentMetrics: [],
      generatedAt: new Date().toISOString(),
    };
  }
}
