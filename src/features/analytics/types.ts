export interface FollowUpHeadKPIs {
  totalFollowUps: number;
  activeFollowUps: number;
  completedFollowUps: number;
  overdueFollowUps: number;
  completionRate: number; // 0 - 100%
  overdueRate: number; // 0 - 100%
  openInquiriesCount: number;
}

export interface CoordinatorWorkloadMetric {
  coordinatorId: string;
  coordinatorName: string;
  activeTasks: number;
  completedTasks: number;
  status: string;
}

export interface DepartmentBreakdownMetric {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  totalFollowUps: number;
  completedFollowUps: number;
  overdueFollowUps: number;
  completionRate: number;
}

export interface AnalyticsDashboardData {
  kpis: FollowUpHeadKPIs;
  coordinatorWorkload: CoordinatorWorkloadMetric[];
  departmentMetrics: DepartmentBreakdownMetric[];
  generatedAt: string;
}
