'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getRequestStatusByToken, type RequestStatusResult } from '@/features/auth/actions';
import {
  Stethoscope,
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function RequestStatusContent() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const [tokenInput, setTokenInput] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RequestStatusResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const performLookup = useCallback(async (token: string) => {
    const clean = token.trim();
    if (!clean) {
      setErrorMessage('Please enter your 64-character tracking token.');
      return;
    }
    if (clean.length !== 64) {
      setErrorMessage('A valid tracking token must be exactly 64 hexadecimal characters.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await getRequestStatusByToken(clean);
      if (!res.found || !res.data) {
        setErrorMessage(res.error || 'No matching request found for this tracking token.');
      } else {
        setResult(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lookup failed';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialToken && initialToken.trim().length === 64) {
      performLookup(initialToken);
    }
  }, [initialToken, performLookup]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    performLookup(tokenInput);
  }

  function renderStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="warning" className="text-xs px-2.5 py-1">
            <Clock className="w-3.5 h-3.5 mr-1" />
            <span>Pending IT Review</span>
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="success" className="text-xs px-2.5 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            <span>Approved & Invited</span>
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="text-xs px-2.5 py-1">
            <XCircle className="w-3.5 h-3.5 mr-1" />
            <span>Request Rejected</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs px-2.5 py-1">
            {status}
          </Badge>
        );
    }
  }

  function formatRole(role: string) {
    switch (role) {
      case 'reception':
        return 'Reception Staff';
      case 'assistant':
        return "Doctor's Assistant";
      case 'doctor':
        return 'Attending Doctor';
      case 'department_head':
        return 'Department Head';
      case 'coordinator':
        return 'Follow-up Coordinator';
      case 'follow_up_head':
        return 'Follow-up Head';
      default:
        return role;
    }
  }

  function formatDate(isoString?: string | null) {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Landing Page</span>
        </Link>
      </div>

      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-sky-600 text-white rounded-xl shadow-xs mb-3">
          <Stethoscope className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Track Request Status
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the tracking token received upon submitting your account request.
        </p>
      </div>

      <Card className="shadow-sm border-slate-200 bg-white mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="token" className="text-sm font-semibold text-slate-700">
                Tracking Token (64 Hex Characters)
              </Label>
              <Input
                id="token"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="e.g. 4f9b2d8e3c1a7056..."
                className="font-mono text-xs mt-1"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Looking up status...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  <span>Lookup Status</span>
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {errorMessage && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <AlertTitle>Lookup Notice</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {result?.data && (
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">Access Request Record</CardTitle>
              <CardDescription className="text-xs">
                Ref ID: <span className="font-mono">{result.data.requestId}</span>
              </CardDescription>
            </div>
            {renderStatusBadge(result.data.status)}
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-500 font-medium block">Requested Role</span>
                <span className="font-semibold text-slate-800">
                  {formatRole(result.data.requestedRole)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">Submitted At</span>
                <span className="text-slate-800">{formatDate(result.data.createdAt)}</span>
              </div>
            </div>

            {result.data.reviewedAt && (
              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-slate-100">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Reviewed At</span>
                  <span className="text-slate-800">{formatDate(result.data.reviewedAt)}</span>
                </div>
              </div>
            )}

            {result.data.status === 'pending' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1 mt-4">
                <p className="font-semibold flex items-center">
                  <Clock className="w-4 h-4 mr-1 text-amber-700" />
                  Request Under Review
                </p>
                <p>
                  Your request is currently awaiting verification by the IT Administrator. You will
                  receive an invitation email once approved.
                </p>
              </div>
            )}

            {result.data.status === 'approved' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 space-y-2 mt-4">
                <p className="font-semibold flex items-center text-emerald-800">
                  <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                  Account Approved & Invitation Issued
                </p>
                <p>
                  Your request has been approved! An invitation link has been dispatched to your
                  registered hospital email address. Follow the instructions in the email to activate
                  your account and establish your password.
                </p>
                <div className="pt-2">
                  <Link
                    href="/invite/accept"
                    className="inline-flex items-center text-xs font-semibold text-sky-700 hover:text-sky-900 underline space-x-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Received your invitation? Set up password here</span>
                  </Link>
                </div>
              </div>
            )}

            {result.data.status === 'rejected' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-950 space-y-1 mt-4">
                <p className="font-semibold flex items-center text-red-800">
                  <XCircle className="w-4 h-4 mr-1 text-red-600" />
                  Decision: Request Declined
                </p>
                <p>
                  <strong>Reason:</strong> {result.data.rejectionReason || 'No specific reason provided.'}
                </p>
                <p className="text-slate-600 pt-1">
                  If you believe this is in error, please contact your hospital IT Department directly.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-8 text-center text-xs text-slate-500">
        Need to submit a new request?{' '}
        <Link href="/request-access" className="font-semibold text-sky-600 hover:text-sky-500">
          Staff Access Request Form
        </Link>
      </div>
    </div>
  );
}

export default function RequestStatusPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="max-w-xl mx-auto text-center py-12 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading request lookup...</p>
          </div>
        }
      >
        <RequestStatusContent />
      </Suspense>
    </div>
  );
}
