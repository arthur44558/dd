'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PatientSearch } from '@/features/patients/components/patient-search';
import { PatientRegistrationModal } from '@/features/patients/components/patient-registration-modal';
import type { DedupSearchResult } from '@/features/patients/schemas';
import {
  Users,
  UserPlus,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

interface PatientRecord {
  id: string;
  mrn: string;
  full_name: string;
  dob: string;
  gender: string;
  primary_phone: string;
  created_at: string;
}

interface ReceptionClientProps {
  initialRecentPatients: PatientRecord[];
}

export default function ReceptionClient({ initialRecentPatients }: ReceptionClientProps) {
  const router = useRouter();
  const [showRegModal, setShowRegModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<DedupSearchResult | null>(null);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [recentPatients] = useState<PatientRecord[]>(initialRecentPatients);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);

  function handleSelectPatient(patient: DedupSearchResult) {
    setSelectedPatient(patient);
    setCheckInMessage(null);
  }

  function handleCheckIn(id: string, name: string) {
    setCheckedInIds((prev) => new Set(prev).add(id));
    setCheckInMessage(`Patient ${name} has been checked in for today's clinical consultation.`);
    setTimeout(() => setCheckInMessage(null), 5000);
  }

  function handleRegistrationSuccess(newPatient: { id: string; mrn: string; fullName: string }) {
    setCheckInMessage(`New patient ${newPatient.fullName} (${newPatient.mrn}) successfully registered!`);
    setShowRegModal(false);
    router.refresh();
  }

  function formatTime(isoString: string) {
    try {
      return new Date(isoString).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  return (
    <div className="space-y-6">
      {/* Strict Clinical Privacy Boundary Banner */}
      <Alert className="bg-sky-50 border-sky-200 text-sky-900">
        <ShieldAlert className="w-4 h-4 shrink-0 text-sky-700" />
        <AlertTitle className="text-xs font-semibold text-sky-950">
          Clinical Boundary Protection Active
        </AlertTitle>
        <AlertDescription className="text-xs text-sky-800">
          Reception personnel are strictly restricted to demographic disambiguation and contact validation.
          Clinical diagnosis, consultation notes, severity tiers, and prescriptions are not accessible.
        </AlertDescription>
      </Alert>

      {checkInMessage && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <AlertTitle className="text-xs font-semibold text-emerald-950">Reception Desk Update</AlertTitle>
          <AlertDescription className="text-xs">{checkInMessage}</AlertDescription>
        </Alert>
      )}

      {/* Primary Actions & Patient Search */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Patient Search & Deduplication Check
                </CardTitle>
                <CardDescription className="text-xs">
                  Search by name, MRN, or phone number before registering a new profile.
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowRegModal(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-9 space-x-1"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register New Patient</span>
              </Button>
            </CardHeader>

            <CardContent className="pt-4">
              <PatientSearch
                onSelectPatient={handleSelectPatient}
                onOpenRegistration={() => setShowRegModal(true)}
                selectedPatientId={selectedPatient?.patientId}
              />
            </CardContent>
          </Card>
        </div>

        {/* Selected Patient Arrival Card */}
        <div className="space-y-6">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-sky-600" />
                <span>Identity Verification & Check-in</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Confirm demographic details with the arriving patient.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              {selectedPatient ? (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium block">MRN:</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {selectedPatient.mrn}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-medium block">Full Legal Name:</span>
                      <span className="font-semibold text-slate-900 text-sm">
                        {selectedPatient.fullName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                      <div>
                        <span className="text-slate-500 font-medium block">Date of Birth:</span>
                        <span className="text-slate-800 font-medium">{selectedPatient.dob}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">Gender:</span>
                        <span className="text-slate-800 font-medium capitalize">
                          {selectedPatient.gender}
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-200">
                      <span className="text-slate-500 font-medium block">Primary Phone:</span>
                      <span className="font-mono text-slate-900">{selectedPatient.primaryPhone}</span>
                    </div>

                    {selectedPatient.isSharedContact && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] flex items-start space-x-1.5 mt-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Shared contact number detected across {selectedPatient.sharedCount} patients.
                          Do not disclose clinical details.
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    {checkedInIds.has(selectedPatient.patientId) ? (
                      <Button disabled className="w-full bg-emerald-600 text-white text-xs h-9">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        <span>Arrival Confirmed Today</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={() =>
                          handleCheckIn(selectedPatient.patientId, selectedPatient.fullName)
                        }
                        className="w-full bg-sky-600 hover:bg-sky-700 text-white text-xs h-9"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        <span>Record Patient Arrival</span>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Select a patient from search results to verify identity and record arrival.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Registrations & Today's Arrivals Queue */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Recent Patient Registrations & Arrivals</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Demographic queue for incoming hospital visits today.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MRN</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Primary Contact</TableHead>
                  <TableHead>Registered Time</TableHead>
                  <TableHead className="text-right">Arrival Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-xs text-slate-500">
                      No recent patient registrations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPatients.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        {p.mrn}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-800">
                        {p.full_name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{p.dob}</TableCell>
                      <TableCell className="text-xs text-slate-600 capitalize">
                        {p.gender}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700">
                        {p.primary_phone}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatTime(p.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {checkedInIds.has(p.id) ? (
                          <Badge variant="success" className="text-[11px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            <span>Arrived</span>
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCheckIn(p.id, p.full_name)}
                            className="h-7 text-xs text-sky-700 hover:bg-sky-50"
                          >
                            Check In
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Patient Registration Modal */}
      <PatientRegistrationModal
        open={showRegModal}
        onOpenChange={setShowRegModal}
        onSuccess={handleRegistrationSuccess}
      />
    </div>
  );
}
