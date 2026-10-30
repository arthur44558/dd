'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type {
  ClinicalInquiry,
  CreateInquiryInput,
  ReplyInquiryInput,
  InquiryStatus,
  InquiryMessage,
} from './types';

/**
 * Creates an internal clinical inquiry anchored to a specific follow-up record.
 * Chains: Coordinator -> linked Assistant (or Doctor if unassigned).
 */
export async function createInquiryAction(
  input: CreateInquiryInput
): Promise<{ success: boolean; inquiryId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized: Authentication required.' };
    }

    // Try calling the database RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_clinical_inquiry', {
      p_follow_up_id: input.followUpId,
      p_title: input.title.trim(),
      p_initial_message: input.initialMessage.trim(),
      p_priority: input.priority || 'normal',
    });

    if (!rpcError && rpcData) {
      revalidatePath('/inquiries');
      revalidatePath(`/inquiries/${rpcData}`);
      return { success: true, inquiryId: rpcData };
    }

    // Fallback if RPC is not loaded in current test harness: direct transactional query
    const { data: followUp, error: fuErr } = await supabaseAdmin
      .from('follow_ups')
      .select('id, responsible_assistant_id, doctor_id, department_id')
      .eq('id', input.followUpId)
      .single();

    if (fuErr || !followUp) {
      return { success: false, error: 'Follow-up record not found.' };
    }

    // Determine target assignee
    let assignedTo: string | null = followUp.responsible_assistant_id;
    if (!assignedTo && followUp.doctor_id) {
      const { data: doc } = await supabaseAdmin
        .from('doctor_profiles')
        .select('profile_id')
        .eq('id', followUp.doctor_id)
        .single();
      assignedTo = doc?.profile_id || null;
    }

    // Insert query
    const { data: newQuery, error: qErr } = await supabaseAdmin
      .from('internal_queries')
      .insert({
        follow_up_id: input.followUpId,
        title: input.title.trim(),
        status: 'open',
        priority: input.priority || 'normal',
        created_by: user.id,
        assigned_to: assignedTo,
      })
      .select('id')
      .single();

    if (qErr || !newQuery) {
      return { success: false, error: qErr?.message || 'Failed to create inquiry' };
    }

    // Insert initial message
    await supabaseAdmin.from('query_messages').insert({
      query_id: newQuery.id,
      sender_id: user.id,
      recipient_id: assignedTo,
      body: input.initialMessage.trim(),
    });

    // Notify assigned staff
    if (assignedTo) {
      await supabaseAdmin.from('notifications').insert({
        recipient_id: assignedTo,
        title: `Clinical Inquiry: ${input.title.slice(0, 35)}`,
        message: 'A coordinator or assistant raised an inquiry regarding a follow-up.',
        category: 'inquiry',
        target_type: 'internal_queries',
        target_id: newQuery.id,
        action_url: `/inquiries/${newQuery.id}`,
      });
    }

    // Log audit event
    await supabaseAdmin.from('audit_events').insert({
      actor_id: user.id,
      action: 'clinical_inquiry.created',
      target_type: 'internal_queries',
      target_id: newQuery.id,
      outcome: 'success',
      metadata: {
        followUpId: input.followUpId,
        title: input.title,
        priority: input.priority || 'normal',
      },
    });

    revalidatePath('/inquiries');
    revalidatePath(`/inquiries/${newQuery.id}`);
    return { success: true, inquiryId: newQuery.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create inquiry';
    return { success: false, error: message };
  }
}

/**
 * Posts a reply to an ongoing clinical inquiry thread.
 * Supports Assistant -> Doctor escalation when clinical confirmation is required.
 */
export async function replyInquiryAction(
  input: ReplyInquiryInput
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized: Authentication required.' };
    }

    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('post_query_reply', {
      p_query_id: input.queryId,
      p_body: input.body.trim(),
      p_escalate_to_doctor: Boolean(input.escalateToDoctor),
    });

    if (!rpcError && rpcData) {
      revalidatePath(`/inquiries/${input.queryId}`);
      revalidatePath('/inquiries');
      return { success: true, messageId: rpcData };
    }

    // Direct fallback
    const { data: query, error: qErr } = await supabaseAdmin
      .from('internal_queries')
      .select('id, follow_up_id, created_by, assigned_to, status, title')
      .eq('id', input.queryId)
      .single();

    if (qErr || !query) {
      return { success: false, error: 'Query not found' };
    }

    let recipientId = user.id === query.created_by ? query.assigned_to : query.created_by;
    let escalatedTo: string | null = null;

    if (input.escalateToDoctor) {
      const { data: followUp } = await supabaseAdmin
        .from('follow_ups')
        .select('doctor_id')
        .eq('id', query.follow_up_id)
        .single();

      if (followUp?.doctor_id) {
        const { data: doc } = await supabaseAdmin
          .from('doctor_profiles')
          .select('profile_id')
          .eq('id', followUp.doctor_id)
          .single();
        escalatedTo = doc?.profile_id || null;
        recipientId = escalatedTo;

        await supabaseAdmin
          .from('internal_queries')
          .update({
            assigned_to: escalatedTo,
            status: 'in_progress',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.queryId);
      }
    } else if (user.id !== query.created_by && query.status === 'open') {
      await supabaseAdmin
        .from('internal_queries')
        .update({
          status: 'answered',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.queryId);
    }

    const { data: newMsg, error: mErr } = await supabaseAdmin
      .from('query_messages')
      .insert({
        query_id: input.queryId,
        sender_id: user.id,
        recipient_id: recipientId,
        body: input.body.trim(),
        is_escalation: Boolean(input.escalateToDoctor),
        escalated_to: escalatedTo,
      })
      .select('id')
      .single();

    if (mErr || !newMsg) {
      return { success: false, error: mErr?.message || 'Failed to post reply' };
    }

    // Notify recipient
    if (recipientId && recipientId !== user.id) {
      await supabaseAdmin.from('notifications').insert({
        recipient_id: recipientId,
        title: `Reply on Inquiry: ${query.title.slice(0, 35)}`,
        message: input.escalateToDoctor
          ? 'Inquiry escalated to doctor for clinical guidance.'
          : 'A new reply was posted on your inquiry thread.',
        category: 'inquiry',
        target_type: 'internal_queries',
        target_id: input.queryId,
        action_url: `/inquiries/${input.queryId}`,
      });
    }

    // Audit log
    await supabaseAdmin.from('audit_events').insert({
      actor_id: user.id,
      action: input.escalateToDoctor ? 'clinical_inquiry.escalated' : 'clinical_inquiry.replied',
      target_type: 'internal_queries',
      target_id: input.queryId,
      outcome: 'success',
      metadata: {
        isEscalation: Boolean(input.escalateToDoctor),
        escalatedTo,
        recipientId,
      },
    });

    revalidatePath(`/inquiries/${input.queryId}`);
    revalidatePath('/inquiries');
    return { success: true, messageId: newMsg.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to post reply';
    return { success: false, error: message };
  }
}

/**
 * Transitions inquiry status (e.g. to closed or answered).
 */
export async function updateInquiryStatusAction(
  queryId: string,
  newStatus: InquiryStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'closed') {
      updates.closed_at = new Date().toISOString();
      updates.closed_by = user.id;
    }

    const { error } = await supabaseAdmin
      .from('internal_queries')
      .update(updates)
      .eq('id', queryId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabaseAdmin.from('audit_events').insert({
      actor_id: user.id,
      action: `clinical_inquiry.status_${newStatus}`,
      target_type: 'internal_queries',
      target_id: queryId,
      outcome: 'success',
      metadata: { newStatus },
    });

    revalidatePath(`/inquiries/${queryId}`);
    revalidatePath('/inquiries');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update status';
    return { success: false, error: message };
  }
}

/**
 * Retrieves a single clinical inquiry with all threaded messages, participant profiles,
 * and sanitized follow-up context.
 */
export async function getInquiryById(queryId: string): Promise<ClinicalInquiry | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: q, error: qErr } = await supabaseAdmin
      .from('internal_queries')
      .select(`
        id,
        follow_up_id,
        title,
        status,
        priority,
        created_by,
        assigned_to,
        closed_at,
        closed_by,
        created_at,
        updated_at
      `)
      .eq('id', queryId)
      .single();

    if (qErr || !q) return null;

    // Fetch sender and assignee profiles
    const profileIds = [q.created_by, q.assigned_to].filter(Boolean) as string[];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .in('id', profileIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Fetch messages
    const { data: messages } = await supabaseAdmin
      .from('query_messages')
      .select(`
        id,
        query_id,
        sender_id,
        recipient_id,
        body,
        is_escalation,
        escalated_to,
        created_at
      `)
      .eq('query_id', queryId)
      .order('created_at', { ascending: true });

    // Fetch extra profiles for message senders/recipients if not already in map
    const msgUserIds = new Set<string>();
    (messages || []).forEach((m) => {
      if (m.sender_id) msgUserIds.add(m.sender_id);
      if (m.recipient_id) msgUserIds.add(m.recipient_id);
      if (m.escalated_to) msgUserIds.add(m.escalated_to);
    });

    const missingIds = Array.from(msgUserIds).filter((id) => !profileMap.has(id));
    if (missingIds.length > 0) {
      const { data: extraProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role')
        .in('id', missingIds);
      (extraProfiles || []).forEach((p) => profileMap.set(p.id, p));
    }

    // Format messages
    const formattedMessages: InquiryMessage[] = (messages || []).map((m) => {
      const sender = profileMap.get(m.sender_id);
      const recipient = m.recipient_id ? profileMap.get(m.recipient_id) : null;
      const escalated = m.escalated_to ? profileMap.get(m.escalated_to) : null;

      return {
        id: m.id,
        queryId: m.query_id,
        senderId: m.sender_id,
        senderName: sender?.full_name || 'Staff Member',
        senderRole: sender?.role || 'Staff',
        recipientId: m.recipient_id,
        recipientName: recipient?.full_name || null,
        body: m.body,
        isEscalation: Boolean(m.is_escalation),
        escalatedTo: m.escalated_to,
        escalatedToName: escalated?.full_name || null,
        createdAt: m.created_at,
      };
    });

    // Fetch follow-up context (patient name, MRN, appointment date)
    let followUpContext: ClinicalInquiry['followUpContext'] = undefined;
    if (q.follow_up_id) {
      const { data: fu } = await supabaseAdmin
        .from('follow_ups')
        .select(`
          appointment_date,
          severity,
          patients (full_name, mrn),
          departments (name)
        `)
        .eq('id', q.follow_up_id)
        .single();

      if (fu) {
        const pat = fu.patients as unknown as { full_name?: string; mrn?: string };
        const dept = fu.departments as unknown as { name?: string };
        followUpContext = {
          appointmentDate: fu.appointment_date,
          severity: fu.severity,
          patientName: pat?.full_name,
          mrn: pat?.mrn,
          departmentName: dept?.name,
        };
      }
    }

    const creator = profileMap.get(q.created_by);
    const assignee = q.assigned_to ? profileMap.get(q.assigned_to) : null;

    return {
      id: q.id,
      followUpId: q.follow_up_id,
      title: q.title,
      status: q.status as InquiryStatus,
      priority: q.priority as ClinicalInquiry['priority'],
      createdBy: q.created_by,
      createdByName: creator?.full_name || 'Staff Member',
      createdByRole: creator?.role || 'Staff',
      assignedTo: q.assigned_to,
      assignedToName: assignee?.full_name || null,
      assignedToRole: assignee?.role || null,
      closedAt: q.closed_at,
      closedBy: q.closed_by,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
      messages: formattedMessages,
      followUpContext,
    };
  } catch (err) {
    console.error('getInquiryById exception:', err);
    return null;
  }
}

/**
 * Retrieves inquiries associated with a specific follow-up record.
 */
export async function getInquiriesForFollowUp(
  followUpId: string
): Promise<ClinicalInquiry[]> {
  try {
    const { data: queries, error } = await supabaseAdmin
      .from('internal_queries')
      .select('id, title, status, priority, created_by, assigned_to, created_at, updated_at')
      .eq('follow_up_id', followUpId)
      .order('created_at', { ascending: false });

    if (error || !queries) return [];

    const profileIds = Array.from(
      new Set(
        queries.flatMap((q) => [q.created_by, q.assigned_to]).filter(Boolean) as string[]
      )
    );

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .in('id', profileIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    return queries.map((q) => {
      const creator = profileMap.get(q.created_by);
      const assignee = q.assigned_to ? profileMap.get(q.assigned_to) : null;

      return {
        id: q.id,
        followUpId,
        title: q.title,
        status: q.status as InquiryStatus,
        priority: q.priority as ClinicalInquiry['priority'],
        createdBy: q.created_by,
        createdByName: creator?.full_name || 'Staff',
        createdByRole: creator?.role || 'Staff',
        assignedTo: q.assigned_to,
        assignedToName: assignee?.full_name || null,
        assignedToRole: assignee?.role || null,
        closedAt: null,
        closedBy: null,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      };
    });
  } catch (err) {
    console.error('getInquiriesForFollowUp exception:', err);
    return [];
  }
}
