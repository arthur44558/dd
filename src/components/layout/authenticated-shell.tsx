'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types/auth';
import {
  Stethoscope,
  LogOut,
  Clock,
  Shield,
  Building2,
  FileText,
  Users,
  CalendarCheck,
  Send,
  BarChart3,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentName?: string | null;
  departmentCode?: string | null;
}

interface AuthenticatedShellProps {
  user: AuthenticatedUser;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const ROLE_DISPLAY: Record<
  UserRole,
  { label: string; badgeColor: string; description: string; navIcon: React.ElementType; href: string }
> = {
  reception: {
    label: 'Reception Staff',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Patient Registration & Identity Disambiguation',
    navIcon: Users,
    href: '/reception',
  },
  assistant: {
    label: "Doctor's Assistant",
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    description: 'Clinical Intake, Scans & Form Digitisation',
    navIcon: FileText,
    href: '/assistant',
  },
  doctor: {
    label: 'Attending Doctor',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
    description: 'Clinical Review, Sign-off & Correction Proposals',
    navIcon: Stethoscope,
    href: '/doctor',
  },
  department_head: {
    label: 'Department Head',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Clinical Governance & Version Approval Authority',
    navIcon: CalendarCheck,
    href: '/department-head',
  },
  coordinator: {
    label: 'Follow-up Coordinator',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Patient Outreach, Communication & Simulated Reminders',
    navIcon: Send,
    href: '/coordinator',
  },
  follow_up_head: {
    label: 'Follow-up Head',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Hospital-Wide Coordinator Workload & Operational KPI Metrics',
    navIcon: BarChart3,
    href: '/follow-up-head',
  },
  it_admin: {
    label: 'IT Administrator',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'Identity Lifecycle, Account Approvals & Access Controls',
    navIcon: Settings,
    href: '/it-admin',
  },
};

export function AuthenticatedShell({
  user,
  title,
  subtitle,
  children,
}: AuthenticatedShellProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [istTime, setIstTime] = useState<string>('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const formatted = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setIstTime(formatted);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  }

  const roleMeta = ROLE_DISPLAY[user.role] || {
    label: user.role,
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Authorized Staff',
    navIcon: Shield,
    href: `/${user.role}`,
  };

  const initials = user.fullName
    ? user.fullName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Universal Hospital Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* System Brand */}
            <div className="flex items-center space-x-3">
              <Link
                href={roleMeta.href}
                className="flex items-center space-x-2 text-slate-900 hover:text-sky-700 transition-colors"
              >
                <div className="p-2 bg-sky-600 text-white rounded-lg shadow-xs">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-base leading-tight block">
                    Hospital Follow-Up
                  </span>
                  <span className="text-xs text-slate-500 font-medium hidden sm:block">
                    Clinical Continuity Platform
                  </span>
                </div>
              </Link>
            </div>

            {/* Center: Asia/Kolkata Timezone Clock */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-mono text-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Asia/Kolkata: {istTime || 'IST'}</span>
            </div>

            {/* Right: User Identity & Logout */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-right">
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {user.fullName || user.email}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {user.departmentName ? `${user.departmentName} Dept` : user.email}
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {initials}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-xs text-slate-600 hover:text-red-600 hover:border-red-200"
              >
                <LogOut className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Role Banner Ribbon */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center text-xs gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Active Workspace:</span>
              <span
                className={`px-2 py-0.5 rounded-sm font-semibold border text-xs ${roleMeta.badgeColor}`}
              >
                {roleMeta.label}
              </span>
              {user.departmentName && (
                <span className="inline-flex items-center text-slate-300 space-x-1">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span>{user.departmentName}</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
              <span className="hidden md:inline">{roleMeta.description}</span>
              <span className="inline-flex items-center text-emerald-400 space-x-1">
                <Shield className="w-3 h-3" />
                <span>Audited Session</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
        </div>

        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Hospital Follow-up Continuity System &bull; Active Role: {roleMeta.label}</span>
          <span className="text-slate-400">Strict PostgreSQL RLS Active &bull; Zero Clinical Leakage</span>
        </div>
      </footer>
    </div>
  );
}
