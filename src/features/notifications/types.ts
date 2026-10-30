export type NotificationCategory =
  | 'general'
  | 'inquiry'
  | 'approval'
  | 'overdue'
  | 'assignment'
  | 'system';

export interface NotificationItem {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  targetType: string | null;
  targetId: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface CreateNotificationPayload {
  recipientId: string;
  title: string;
  message: string;
  category?: NotificationCategory;
  targetType?: string;
  targetId?: string;
  actionUrl?: string;
}
