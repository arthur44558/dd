'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Stethoscope, Lock, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    rawError ? getErrorMessage(rawError) : null
  );

  function getErrorMessage(code: string): string {
    switch (code) {
      case 'profile_not_found':
        return 'User profile was not found. Please contact IT Administration.';
      case 'account_invited':
        return 'Your account is invited but password is not yet set. Please check your invitation email.';
      case 'account_pending':
        return 'Your account request is currently pending IT Admin review.';
      case 'account_deactivated':
        return 'This account has been deactivated. Please contact IT Administration.';
      case 'account_suspended':
        return 'This account has been temporarily suspended.';
      case 'unauthorized_role':
        return 'You do not have the required role permissions to access that resource.';
      default:
        return 'Authentication required. Please sign in with your hospital credentials.';
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data.user) {
        throw new Error(error?.message || 'Invalid email or password');
      }

      // Check profile role to determine redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .single();

      if (!profile || profile.status !== 'active') {
        router.push(`/login?error=account_${profile?.status || 'missing'}`);
        return;
      }

      // Redirect to role workspace
      if (profile.role === 'it_admin') {
        router.push('/it-admin');
      } else {
        router.push(`/${profile.role}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link
          href="/"
          className="inline-flex items-center text-xs text-slate-500 hover:text-slate-700 mb-6 space-x-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Landing Page</span>
        </Link>
        <div className="flex justify-center">
          <div className="p-3 bg-sky-600 text-white rounded-xl shadow-xs">
            <Stethoscope className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Staff Operational Login
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to access clinical and administrative follow-up workspaces.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs border border-slate-200 rounded-xl sm:px-10">
          {errorMsg && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label htmlFor="email">Hospital Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@hospital.org"
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  <span>Sign In</span>
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col space-y-3 text-center text-xs text-slate-500">
            <div>
              Don&apos;t have an account?{' '}
              <Link href="/request-access" className="font-semibold text-sky-600 hover:text-sky-500">
                Submit an Access Request
              </Link>
            </div>
            <div>
              Already submitted a request?{' '}
              <Link href="/request-status" className="font-semibold text-sky-600 hover:text-sky-500">
                Track Request Status
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
