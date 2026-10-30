'use client';

import * as React from 'react';
import { Phone, Mail, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PatientDetail } from '../schemas';

export interface PatientContactListProps {
  contacts: PatientDetail['contacts'];
}

export function PatientContactList({ contacts }: PatientContactListProps) {
  if (!contacts || contacts.length === 0) {
    return (
      <div className="p-4 text-center rounded-lg border border-dashed border-slate-200 text-slate-500 text-sm">
        No contact numbers recorded for this patient.
      </div>
    );
  }

  const hasSharedContact = contacts.some((c) => c.isSharedContact);

  return (
    <div className="space-y-3">
      {hasSharedContact && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Privacy & Communication Constraint</span>
            One or more contacts are shared family/proxy numbers. Per hospital continuity guidelines, coordinator and automated reminder messages sent to shared numbers must NEVER disclose sensitive clinical details, diagnoses, or prescriptions.
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {contacts.map((contact) => {
          const isPhone = contact.contactType.includes('phone') || contact.contactType === 'emergency_contact';

          return (
            <div
              key={contact.id}
              className="p-3 sm:flex sm:items-center sm:justify-between space-y-2 sm:space-y-0"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-full bg-slate-100 text-slate-600">
                  {isPhone ? <Phone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm font-mono">
                      {contact.contactValue}
                    </span>
                    <Badge variant="outline" className="text-[11px] capitalize">
                      {contact.contactType.replace('_', ' ')}
                    </Badge>
                    {contact.isVerified ? (
                      <Badge variant="success" className="gap-1 text-[10px]">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Unverified
                      </Badge>
                    )}
                  </div>

                  {contact.notes && (
                    <p className="text-xs text-slate-500">{contact.notes}</p>
                  )}
                </div>
              </div>

              <div>
                {contact.isSharedContact && (
                  <Badge variant="warning" className="gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    Shared Contact
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
