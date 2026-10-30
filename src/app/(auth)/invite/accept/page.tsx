'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SetPasswordSchema, type SetPasswordInput } from '@/features/auth/schemas';
import { activateInvitedAccount } from '@/features/auth/actions';
import { createClient } from '@/lib/supabase/client';
import {
  Stethoscope,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function InviteAcceptContent() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(SetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const supabase = createClient();
    let unsubscribe: (() => void) | undefined;

    async function fetchProfile(uid: string) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', uid)
        .maybeSingle();

      if (profile) {
        setUserRole(profile.role);
        if (profile.status === 'active') {
          setCompleted(true);
        }
      }
    }

    async function checkAuth() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, newSession) => {
              if (newSession?.user) {
                setUserId(newSession.user.id);
                setUserEmail(newSession.user.email || null);
                await fetchProfile(newSession.user.id);
                setLoadingSession(false);
              }
            }
          );
          unsubscribe = () => authListener.subscription.unsubscribe();

          setTimeout(() => {
            setLoadingSession((prev) => {
              if (prev) {
                setStatusMessage(
                  'No active invitation session detected. If you followed an invite link, please ensure you open the complete URL.'
                );
              }
              return false;
            });
          }, 1500);
        } else {
          setUserId(session.user.id);
          setUserEmail(session.user.email || null);
          await fetchProfile(session.user.id);
          setLoadingSession(false);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to verify invite link';
        setErrorMessage(msg);
        setLoadingSession(false);
      }
    }

    checkAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  async function onSubmit(data: SetPasswordInput) {
    if (!userId) {
      setErrorMessage('No authenticated user session found to set password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      // 1. Update Auth password
      const { error: updateAuthErr } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateAuthErr) {
        throw new Error(updateAuthErr.message);
      }

      // 2. Activate profile using server action with admin rights
      const activationRes = await activateInvitedAccount(userId);
      if (!activationRes.success) {
        throw new Error(activationRes.error || 'Failed to activate account profile');
      }

      setCompleted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password setup failed';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoToWorkspace() {
    if (userRole === 'it_admin') {
      router.push('/it-admin');
    } else if (userRole) {
      router.push(`/${userRole}`);
    } else {
      router.push('/login');
    }
  }

  if (loadingSession) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-600 mb-4" />
        <p className="text-sm text-slate-600">Verifying secure invitation token...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-sky-600 text-white rounded-xl shadow-xs mb-3">
          <Stethoscope className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Account Activation
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Establish your hospital workspace password to complete activation.
        </p>
      </div>

      {completed ? (
        <Card className="border-emerald-200 bg-white shadow-md">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl text-emerald-900">Account Activated!</CardTitle>
            <CardDescription className="text-slate-600">
              Your password has been established and your staff profile is now active.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGoToWorkspace} className="w-full">
              <span>Enter Workspace</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <div className="text-center">
              <Link href="/login" className="text-xs text-sky-600 hover:text-sky-800">
                Sign in with new credentials
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Set Account Password</CardTitle>
            <CardDescription>
              {userEmail ? (
                <span>
                  Activating credentials for <strong className="text-slate-800">{userEmail}</strong>
                </span>
              ) : (
                <span>Create a strong password of at least 8 characters.</span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {statusMessage && (
              <Alert className="mb-4 bg-sky-50 border-sky-200 text-sky-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <AlertDescription className="text-xs">{statusMessage}</AlertDescription>
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <AlertTitle>Activation Error</AlertTitle>
                <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                />
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...register('confirmPassword')}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirmPassword}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                <div className="flex items-center text-slate-700 font-medium space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  <span>Hospital Security Standard</span>
                </div>
                <p>
                  Passwords must contain at least 8 characters. Never share your credentials.
                </p>
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    <span>Activate Account</span>
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              Already have an active account?{' '}
              <Link href="/login" className="font-semibold text-sky-600 hover:text-sky-500">
                Staff Login
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="max-w-md mx-auto text-center py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading invitation verification...</p>
          </div>
        }
      >
        <InviteAcceptContent />
      </Suspense>
    </div>
  );
}
