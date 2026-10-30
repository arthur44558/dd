'use client';

import React, { useState, useTransition } from 'react';
import { HelpCircle, AlertCircle, Send, X } from 'lucide-react';
import { createInquiryAction } from '../actions';
import type { InquiryPriority } from '../types';

interface CreateInquiryDialogProps {
  followUpId: string;
  patientName?: string;
  mrn?: string;
  onSuccess?: (inquiryId: string) => void;
  triggerButtonText?: string;
}

export function CreateInquiryDialog({
  followUpId,
  patientName,
  mrn,
  onSuccess,
  triggerButtonText = 'Raise Clinical Inquiry',
}: CreateInquiryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [priority, setPriority] = useState<InquiryPriority>('normal');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !initialMessage.trim()) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await createInquiryAction({
        followUpId,
        title,
        initialMessage,
        priority,
      });

      if (res.success && res.inquiryId) {
        setIsOpen(false);
        setTitle('');
        setInitialMessage('');
        setPriority('normal');
        if (onSuccess) {
          onSuccess(res.inquiryId);
        }
      } else {
        setErrorMsg(res.error || 'Failed to create inquiry.');
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors shadow-xs"
      >
        <HelpCircle className="w-3.5 h-3.5 text-teal-700" />
        <span>{triggerButtonText}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-teal-700" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Raise Clinical Inquiry
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Context preview */}
            {(patientName || mrn) && (
              <div className="px-5 py-2.5 bg-teal-50/70 border-b border-teal-100 text-xs text-teal-900 flex items-center justify-between">
                <span>Patient: <strong>{patientName || 'N/A'}</strong></span>
                <span>MRN: <strong>{mrn || 'N/A'}</strong></span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inquiry Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Clarification on follow-up timing after lab results"
                  required
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as InquiryPriority)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                >
                  <option value="low">Low (General administrative clarification)</option>
                  <option value="normal">Normal (Standard clinical question)</option>
                  <option value="urgent">Urgent (Imminent overdue or clinical alert)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Question / Clinical Doubt <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Provide precise context on what requires clarification. Do not include passwords, raw tokens, or third-party sensitive disclosures."
                  rows={4}
                  required
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none"
                />
              </div>

              {/* Protocol disclaimer */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 leading-tight">
                <strong>Chain of Custody:</strong> This inquiry routes to the responsible Assistant, who can answer directly or escalate to the attending Doctor. Responses are permanently preserved in the immutable audit log.
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !title.trim() || !initialMessage.trim()}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPending ? 'Submitting...' : 'Submit Inquiry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
