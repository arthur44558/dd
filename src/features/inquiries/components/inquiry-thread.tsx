'use client';

import React, { useState, useTransition } from 'react';
import {
  Send,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  User,
  Lock,
} from 'lucide-react';
import { replyInquiryAction, updateInquiryStatusAction } from '../actions';
import type { ClinicalInquiry, InquiryStatus } from '../types';

interface InquiryThreadProps {
  inquiry: ClinicalInquiry;
  currentUserRole?: string;
  currentUserId?: string;
}

export function InquiryThread({
  inquiry: initialInquiry,
  currentUserRole = 'coordinator',
  currentUserId,
}: InquiryThreadProps) {
  const [inquiry, setInquiry] = useState<ClinicalInquiry>(initialInquiry);
  const [replyText, setReplyText] = useState('');
  const [escalateToDoctor, setEscalateToDoctor] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isClosed = inquiry.status === 'closed';
  const canEscalate = ['assistant', 'department_head'].includes(currentUserRole);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isClosed) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await replyInquiryAction({
        queryId: inquiry.id,
        body: replyText,
        escalateToDoctor,
      });

      if (res.success) {
        setReplyText('');
        setEscalateToDoctor(false);

        // Optimistically add message
        const newMsg = {
          id: res.messageId || String(Date.now()),
          queryId: inquiry.id,
          senderId: currentUserId || 'me',
          senderName: 'You',
          senderRole: currentUserRole,
          recipientId: inquiry.assignedTo,
          body: replyText,
          isEscalation: escalateToDoctor,
          escalatedTo: null,
          createdAt: new Date().toISOString(),
        };

        setInquiry((prev) => ({
          ...prev,
          status: escalateToDoctor ? 'in_progress' : prev.status === 'open' ? 'answered' : prev.status,
          messages: [...(prev.messages || []), newMsg],
        }));
      } else {
        setErrorMsg(res.error || 'Failed to post reply.');
      }
    });
  };

  const handleStatusChange = async (nextStatus: InquiryStatus) => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await updateInquiryStatusAction(inquiry.id, nextStatus);
      if (res.success) {
        setInquiry((prev) => ({ ...prev, status: nextStatus }));
      } else {
        setErrorMsg(res.error || 'Failed to update status.');
      }
    });
  };

  const getStatusBadge = (status: InquiryStatus) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" /> Open
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <ArrowUpRight className="w-3 h-3" /> Escalated / In Progress
          </span>
        );
      case 'answered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Answered
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <Lock className="w-3 h-3" /> Closed
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: ClinicalInquiry['priority']) => {
    if (priority === 'urgent') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-200">
          URGENT
        </span>
      );
    }
    if (priority === 'low') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
          Low Priority
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
        Normal Priority
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-w-4xl mx-auto">
      {/* Thread Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{inquiry.title}</h2>
              {getStatusBadge(inquiry.status)}
              {getPriorityBadge(inquiry.priority)}
            </div>
            <p className="text-xs text-slate-500">
              Opened by <span className="font-medium text-slate-700">{inquiry.createdByName}</span> ({inquiry.createdByRole}) &bull; Assigned to:{' '}
              <span className="font-medium text-slate-700">{inquiry.assignedToName || 'Unassigned'}</span>
            </p>
          </div>

          {/* Status Controls */}
          <div className="flex items-center gap-2">
            {inquiry.status !== 'closed' ? (
              <>
                {inquiry.status !== 'answered' && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('answered')}
                    disabled={isPending}
                    className="px-3 py-1.5 text-xs font-medium bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                  >
                    Mark Answered
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleStatusChange('closed')}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Close Thread
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleStatusChange('open')}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-medium bg-white text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-50"
              >
                Reopen Thread
              </button>
            )}
          </div>
        </div>

        {/* Anchored Follow-up Banner */}
        {inquiry.followUpContext && (
          <div className="mt-3 p-2.5 rounded-lg bg-teal-50/60 border border-teal-100 flex flex-wrap items-center justify-between text-xs text-teal-900 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Anchored Follow-Up:</span>
              <span>Patient: {inquiry.followUpContext.patientName || 'N/A'}</span>
              <span>(MRN: {inquiry.followUpContext.mrn || 'N/A'})</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Appointment: <strong>{inquiry.followUpContext.appointmentDate}</strong></span>
              <span>Severity: <strong className="capitalize">{inquiry.followUpContext.severity}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[28rem] bg-slate-50/30">
        {(inquiry.messages || []).map((msg, idx) => {
          const isSender = msg.senderId === currentUserId || msg.senderName === 'You';
          const isDoctor = msg.senderRole === 'doctor';
          const isAssistant = msg.senderRole === 'assistant';

          return (
            <div
              key={msg.id || idx}
              className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm border ${
                  isSender
                    ? 'bg-teal-700 text-white border-teal-800 rounded-br-none'
                    : isDoctor
                    ? 'bg-purple-50 text-slate-900 border-purple-200 rounded-bl-none'
                    : isAssistant
                    ? 'bg-blue-50 text-slate-900 border-blue-200 rounded-bl-none'
                    : 'bg-white text-slate-900 border-slate-200 rounded-bl-none'
                }`}
              >
                {/* Message Header */}
                <div
                  className={`flex items-center justify-between gap-3 text-xs mb-1.5 pb-1 border-b ${
                    isSender ? 'border-teal-600/60 text-teal-100' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <User className="w-3.5 h-3.5" />
                    <span>{msg.senderName}</span>
                    <span className="text-[10px] font-normal uppercase px-1.5 py-0.2 rounded bg-black/10">
                      {msg.senderRole}
                    </span>
                  </div>
                  <span className="text-[10px]">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Escalation Tag */}
                {msg.isEscalation && (
                  <div className="mb-2 p-1.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Escalated to Doctor for clinical determination.</span>
                  </div>
                )}

                {/* Message Body */}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply Area */}
      <div className="p-4 border-t border-slate-200 bg-white">
        {errorMsg && (
          <div className="mb-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isClosed ? (
          <div className="p-3 bg-slate-50 rounded-lg text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>This clinical inquiry thread is marked closed. Reopen to post additional replies.</span>
          </div>
        ) : (
          <form onSubmit={handleReplySubmit} className="space-y-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your response or clinical question..."
              rows={3}
              required
              className="w-full text-sm p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Escalation Checkbox for Assistant */}
              {canEscalate && (
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={escalateToDoctor}
                    onChange={(e) => setEscalateToDoctor(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <span className="font-medium text-slate-800">
                    Escalate to Doctor (requires clinical clarification)
                  </span>
                </label>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="submit"
                  disabled={isPending || !replyText.trim()}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPending ? 'Sending...' : 'Send Reply'}</span>
                </button>
              </div>
            </div>

            {/* Regulatory Disclaimer */}
            <p className="text-[11px] text-slate-400 italic">
              Doctor instructions in inquiry threads are guidance only. Official changes to appointment dates or clinical severity require a formal correction proposal approved by Department Head.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
