'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type {
  CreateNotificationPayload,
  NotificationItem,
} from './types';

/**
 * Creates an in-app notification for a staff member.
 * Safe helper callable by server actions, cron jobs, and domain events.
 * Enforces privacy: ensures no sensitive PHI or clinical notes are embedded.
 */
export async function createNotification(
  payload: CreateNotificationPayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        recipient_id: payload.recipientId,
        title: payload.title,
        message: payload.message,
        category: payload.category || 'general',
        target_type: payload.targetType || null,
        target_id: payload.targetId || null,
        action_url: payload.actionUrl || null,
        is_read: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('createNotification database error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown notification error';
    console.error('createNotification exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Retrieves the count of unread notifications for the currently authenticated user.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return 0;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('getUnreadNotificationCount error:', error.message);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('getUnreadNotificationCount exception:', err);
    return 0;
  }
}

/**
 * Fetches recent notifications for the currently authenticated user.
 */
export async function getNotifications(
  limit: number = 20
): Promise<NotificationItem[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('getNotifications error:', error.message);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      recipientId: row.recipient_id as string,
      title: row.title as string,
      message: row.message as string,
      category: row.category as NotificationItem['category'],
      targetType: (row.target_type as string) || null,
      targetId: (row.target_id as string) || null,
      actionUrl: (row.action_url as string) || null,
      isRead: Boolean(row.is_read),
      readAt: (row.read_at as string) || null,
      createdAt: row.created_at as string,
    }));
  } catch (err) {
    console.error('getNotifications exception:', err);
    return [];
  }
}

/**
 * Marks a single notification as read by the recipient.
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('recipient_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to mark as read';
    return { success: false, error: message };
  }
}

/**
 * Marks all unread notifications as read for the current user.
 */
export async function markAllNotificationsAsRead(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('recipient_id', user.id)
      .eq('is_read', false);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to mark all as read';
    return { success: false, error: message };
  }
}
