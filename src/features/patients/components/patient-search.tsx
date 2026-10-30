'use client';

import * as React from 'react';
import { Search, AlertTriangle, Phone, UserCheck, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { searchPatientsDedup } from '../actions';
import type { DedupSearchResult } from '../schemas';

export interface PatientSearchProps {
  onSelectPatient?: (patient: DedupSearchResult) => void;
  onOpenRegistration?: () => void;
  selectedPatientId?: string | null;
}

export function PatientSearch({
  onSelectPatient,
  onOpenRegistration,
  selectedPatientId,
}: PatientSearchProps) {
  const [query, setQuery] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [results, setResults] = React.useState<DedupSearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() && !phone.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await searchPatientsDedup({
        query: query.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      if (res.success && res.data) {
        setResults(res.data);
      } else {
        setError(res.error || 'Failed to search patients');
        setResults([]);
      }
    } catch {
      setError('An unexpected error occurred while searching');
      setResults([]);
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  };

  const handleClear = () => {
    setQuery('');
    setPhone('');
    setResults([]);
    setHasSearched(false);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by Patient Name or MRN..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative sm:w-64">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Phone number..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
          {(hasSearched || query || phone) && (
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear
            </Button>
          )}
          {onOpenRegistration && (
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenRegistration}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Register Patient
            </Button>
          )}
        </div>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Search Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Disambiguation Warning when multiple matches exist */}
      {results.length > 1 && (
        <Alert variant="warning" className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900 font-semibold">
            Disambiguation Warning: Multiple Matches Found ({results.length})
          </AlertTitle>
          <AlertDescription className="text-amber-800 text-sm">
            Multiple patient records match your search criteria. Per hospital policy, you must verify the patient&apos;s Date of Birth (DOB) and primary contact details with the patient before selecting a record. Never guess identity.
          </AlertDescription>
        </Alert>
      )}

      {/* Search Results List */}
      {hasSearched && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-500">No matching patient records found.</p>
              {onOpenRegistration && (
                <Button
                  variant="outline"
                  onClick={onOpenRegistration}
                  className="mt-3 gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Proceed to Register New Patient
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {results.map((patient) => {
                const isSelected = selectedPatientId === patient.patientId;
                return (
                  <div
                    key={patient.patientId}
                    className={`rounded-lg border p-4 transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-base">
                            {patient.fullName}
                          </span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {patient.mrn}
                          </Badge>
                          {patient.isSharedContact && (
                            <Badge variant="warning" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Shared Contact ({patient.sharedCount} patients)
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span>
                            <strong>DOB:</strong> {patient.dob}
                          </span>
                          <span className="capitalize">
                            <strong>Gender:</strong> {patient.gender}
                          </span>
                          <span>
                            <strong>Phone:</strong> {patient.primaryPhone}
                          </span>
                        </div>

                        {patient.matchReasons && patient.matchReasons.length > 0 && (
                          <div className="flex gap-1.5 pt-1">
                            {patient.matchReasons.map((reason) => (
                              <Badge key={reason} variant="info" className="text-[10px] py-0 px-2">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {onSelectPatient && (
                        <div className="self-end sm:self-center">
                          <Button
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            onClick={() => onSelectPatient(patient)}
                            className="gap-1.5"
                          >
                            <UserCheck className="h-4 w-4" />
                            {isSelected ? 'Selected' : 'Select Patient'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
