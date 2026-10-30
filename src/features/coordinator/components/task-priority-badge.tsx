import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { TaskPriority } from '../types';

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  switch (priority) {
    case 'critical':
      return (
        <Badge variant="destructive" className={className}>
          CRITICAL
        </Badge>
      );
    case 'high':
      return (
        <Badge variant="danger" className={className}>
          HIGH
        </Badge>
      );
    case 'moderate':
      return (
        <Badge variant="warning" className={className}>
          MODERATE
        </Badge>
      );
    case 'routine':
    default:
      return (
        <Badge variant="secondary" className={className}>
          ROUTINE
        </Badge>
      );
  }
}
