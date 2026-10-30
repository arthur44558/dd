'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  AuditEvent,
  LogAuditEventParams,
  AuditFilterParams,
} from './types';

// Blacklisted keys to sanitize from any audit event before/after states or metadata
const SENSITIVE_KEY_REGEX = /(password|token|secret|key|authorization|bearer|cookie|salt|hash|credential)/i;

function sanitizeObject(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeObject(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Server-side domain event logger for immutable compliance audit trail.
 * Enforces sanitization: strips credentials, secrets, and raw tokens.
 * Writes to the append-only `audit_events` table.
 */
export async function logAuditEvent(
  params: LogAuditEventParams
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    let resolvedActorId = params.actorId || null;
    let resolvedActorRole = params.actorRole || null;

    // If actor is omitted, attempt resolution from current session
    if (!resolvedActorId) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          resolvedActorId = user.id;
          if (!resolvedActorRole) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .single();
            resolvedActorRole = profile?.role || null;
          }
        }
      } catch {
        // Background job or unauthenticated context
      }
    }

    const cleanBefore = params.beforeState ? (sanitizeObject(params.beforeState) as Record<string, unknown>) : null;
    const cleanAfter = params.afterState ? (sanitizeObject(params.afterState) as Record<string, unknown>) : null;
    const cleanMeta = sanitizeObject(params.metadata || {}) as Record<string, unknown>;

    const { data, error } = await supabaseAdmin
      .from('audit_events')
      .insert({
        actor_id: resolvedActorId,
        actor_role: resolvedActorRole,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId,
        outcome: params.outcome || 'success',
        reason: params.reason || null,
        correlation_id: params.correlationId || null,
        before_state: cleanBefore,
        after_state: cleanAfter,
        metadata: cleanMeta,
      })
      .select('id')
      .single();

    if (error) {
      console.error('logAuditEvent database error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, eventId: data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown audit error';
    console.error('logAuditEvent exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Retrieves audit trail events for IT Admin and Department Heads with filtering.
 */
export async function getAuditEvents(
  filters: AuditFilterParams = {}
): Promise<{ events: AuditEvent[]; total: number }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { events: [], total: 0 };
    }

    // Role check
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedRoles = ['it_admin', 'department_head', 'follow_up_head'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      return { events: [], total: 0 };
    }

    let query = supabaseAdmin
      .from('audit_events')
      .select('*', { count: 'exact' });

    if (filters.action) {
      query = query.ilike('action', `%${filters.action}%`);
    }
    if (filters.targetType) {
      query = query.eq('target_type', filters.targetType);
    }
    if (filters.outcome) {
      query = query.eq('outcome', filters.outcome);
    }
    if (filters.actorId) {
      query = query.eq('actor_id', filters.actorId);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) {
      console.error('getAuditEvents error:', error?.message);
      return { events: [], total: 0 };
    }

    // Resolve actor names
    const actorIds = Array.from(new Set(data.map((e) => e.actor_id).filter(Boolean))) as string[];
    let actorMap = new Map<string, string>();

    if (actorIds.length > 0) {
      const { data: actors } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .in('id', actorIds);

      actorMap = new Map((actors || []).map((a) => [a.id, a.full_name]));
    }

    const events: AuditEvent[] = data.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      actorName: row.actor_id ? actorMap.get(row.actor_id) || 'System / Staff' : 'System',
      actorRole: row.actor_role,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      outcome: row.outcome,
      reason: row.reason,
      correlationId: row.correlation_id,
      beforeState: row.before_state,
      afterState: row.after_state,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));

    return { events, total: count || events.length };
  } catch (err) {
    console.error('getAuditEvents exception:', err);
    return { events: [], total: 0 };
  }
}
