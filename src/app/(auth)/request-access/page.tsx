'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AccessRequestSchema,
  type AccessRequestInput,
  operationalRoles,
} from '@/features/auth/schemas';
import {
  submitAccessRequest,
  getPublicDepartments,
  type PublicDepartment,
} from '@/features/auth/actions';
import {
  Stethoscope,
  ArrowLeft,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ROLE_LABELS: Record<(typeof operationalRoles)[number], string> = {
  reception: 'Reception Staff (Patient intake & check-in)',
  assistant: "Doctor's Assistant (Form digitisation & scans)",
  doctor: 'Attending Doctor (Clinical oversight)',
  department_head: 'Department Head (Clinical & correction approval)',
  coordinator: 'Follow-up Coordinator (Communication tasks)',
  follow_up_head: 'Follow-up Head (Central coordinator pool oversight)',
};

export default function RequestAccessPage() {
  const [departments, setDepartments] = useState<PublicDepartment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AccessRequestInput>({
    resolver: zodResolver(AccessRequestSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      employeeId: '',
      requestedRole: 'reception',
      departmentId: '',
      justification: '',
      agreementAccepted: undefined,
    },
  });

  const selectedRole = watch('requestedRole');
  const needsDepartment =
    selectedRole === 'assistant' ||
    selectedRole === 'doctor' ||
    selectedRole === 'department_head';

  useEffect(() => {
    let mounted = true;
    getPublicDepartments().then((deps) => {
      if (mounted) {
        setDepartments(deps);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(data: AccessRequestInput) {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitAccessRequest(data);
      if (!result.success || !result.trackingToken) {
        setSubmitError(result.error || 'Failed to submit request. Please try again.');
        return;
      }

      setGeneratedToken(result.trackingToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyToken() {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
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
            Staff Access Request
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Request an operational hospital workspace account. All submissions are vetted and
            approved exclusively by IT Administration.
          </p>
        </div>

        {generatedToken ? (
          <Card className="border-emerald-200 bg-white shadow-md">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <CardTitle className="text-2xl text-emerald-900">
                Access Request Submitted Successfully
              </CardTitle>
              <CardDescription className="text-slate-600">
                Your request has been routed to the IT Administration review queue.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 space-y-1">
                    <p className="font-semibold">Important: Save Your Tracking Token</p>
                    <p>
                      To prevent public email enumeration, request status is tracked strictly via this
                      cryptographic tracking token. This token will <strong>never be shown again</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Your 64-Character Tracking Token
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 p-3 bg-slate-900 text-sky-400 font-mono text-xs rounded-lg border border-slate-800 break-all select-all">
                    {generatedToken}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyToken}
                    className="shrink-0 flex items-center space-x-1"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={`/request-status?token=${generatedToken}`}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs space-x-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Check Request Status Now</span>
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Back to Home
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900">Applicant Information</CardTitle>
              <CardDescription>
                Provide your professional hospital credentials for identity verification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitError && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <AlertTitle>Submission Failed</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="fullName">
                      Full Legal Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="fullName"
                      {...register('fullName')}
                      placeholder="Dr. Rajesh Sharma"
                      aria-invalid={!!errors.fullName}
                    />
                    {errors.fullName && (
                      <p className="text-xs text-red-600">{errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="email">
                      Hospital/Work Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="r.sharma@hospital.org"
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="phone">
                      Contact Phone <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phone"
                      {...register('phone')}
                      placeholder="+91 98765 43210"
                      aria-invalid={!!errors.phone}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-600">{errors.phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="employeeId">Employee/Staff Identifier (Optional)</Label>
                    <Input
                      id="employeeId"
                      {...register('employeeId')}
                      placeholder="EMP-8492"
                      aria-invalid={!!errors.employeeId}
                    />
                    {errors.employeeId && (
                      <p className="text-xs text-red-600">{errors.employeeId.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="requestedRole">
                    Requested Operational Role <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    id="requestedRole"
                    {...register('requestedRole')}
                    aria-invalid={!!errors.requestedRole}
                  >
                    {operationalRoles.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-slate-500">
                    Administrative roles (e.g. IT Admin) cannot be requested publicly.
                  </p>
                  {errors.requestedRole && (
                    <p className="text-xs text-red-600">{errors.requestedRole.message}</p>
                  )}
                </div>

                {needsDepartment && (
                  <div className="space-y-1">
                    <Label htmlFor="departmentId">
                      Clinical Department <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      id="departmentId"
                      {...register('departmentId')}
                      aria-invalid={!!errors.departmentId}
                    >
                      <option value="">-- Select Clinical Department --</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </Select>
                    {errors.departmentId && (
                      <p className="text-xs text-red-600">{errors.departmentId.message}</p>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="justification">
                    Role Justification & Clinical Purpose <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="justification"
                    rows={3}
                    {...register('justification')}
                    placeholder="Describe your operational assignment, department team, and reasons for requesting this workspace access."
                    aria-invalid={!!errors.justification}
                  />
                  {errors.justification && (
                    <p className="text-xs text-red-600">{errors.justification.message}</p>
                  )}
                </div>

                <div className="pt-2">
                  <div className="flex items-start space-x-3">
                    <input
                      id="agreementAccepted"
                      type="checkbox"
                      {...register('agreementAccepted')}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <Label
                      htmlFor="agreementAccepted"
                      className="text-xs text-slate-600 font-normal leading-relaxed cursor-pointer"
                    >
                      I confirm that I am an authorized hospital staff member. I agree to adhere to
                      all hospital patient privacy guidelines, data security requirements, and understand
                      that all activity in the continuity workspace is immutably audited.
                    </Label>
                  </div>
                  {errors.agreementAccepted && (
                    <p className="text-xs text-red-600 mt-1">{errors.agreementAccepted.message}</p>
                  )}
                </div>

                <Button type="submit" disabled={submitting} className="w-full mt-4">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <span>Submit Access Request</span>
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
                Already submitted a request?{' '}
                <Link
                  href="/request-status"
                  className="font-semibold text-sky-600 hover:text-sky-500"
                >
                  Lookup request status with tracking token
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
