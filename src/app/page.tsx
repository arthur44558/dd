import Link from 'next/link';
import { ShieldCheck, UserCheck, Stethoscope, Lock, FileText, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-600 text-white rounded-lg">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              Hospital Follow-up Continuity
            </h1>
            <p className="text-xs text-slate-500 font-medium">Clinical Oversight & Follow-up Platform</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href="/request-access"
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Request Access
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors shadow-xs"
          >
            Staff Login
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sky-50 text-sky-700 rounded-full text-xs font-semibold mb-6 border border-sky-200">
          <ShieldCheck className="w-4 h-4" />
          <span>Strict Clinical Governance & Immutable Versioning</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mb-6">
          Reliable Patient Follow-up, Transparent Clinical Oversight
        </h2>

        <p className="text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed">
          A dedicated institutional workflow digitising clinical follow-up orders, synchronising
          patient appointments, and maintaining tamper-evident audit trails across clinical teams.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-3 text-base font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-all"
          >
            <span>Access Operational Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/request-access"
            className="w-full sm:w-auto px-6 py-3 text-base font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs flex items-center justify-center space-x-2 transition-all"
          >
            <UserCheck className="w-4 h-4 text-slate-500" />
            <span>Request Staff Account</span>
          </Link>
        </div>

        {/* Core Pillars */}
        <div className="grid md:grid-cols-3 gap-8 text-left w-full mt-4">
          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Immutable Clinical Versions</h3>
            <p className="text-sm text-slate-600">
              Submitted clinical records are version-locked. Corrections require explicit Department
              Head review with side-by-side verification.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-4">
              <UserCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Role-Scoped Isolation</h3>
            <p className="text-sm text-slate-600">
              Six dedicated operational dashboards with PostgreSQL Row Level Security enforcing
              least-privilege boundaries at the database tier.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Authorized Access Only</h3>
            <p className="text-sm text-slate-600">
              Zero public self-signup. All accounts are vetted, approved, and provisioned by the IT
              Administration team.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 bg-slate-900 text-slate-400 text-xs text-center border-t border-slate-800">
        <p className="mb-1">
          Hospital Follow-up Continuity System &bull; Production Demonstration Release
        </p>
        <p className="text-slate-500">
          Synthetic patient data only &bull; Internal hospital use strictly restricted to authorized personnel.
        </p>
      </footer>
    </div>
  );
}
