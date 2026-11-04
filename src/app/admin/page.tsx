"use client";

import { RouteGuard } from "@/components/route-guard";
import { AppShell } from "@/components/app-shell";

function AdminInner() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Administration workspace
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          User management, applications, and admissions tooling arrive in later
          phases. Authentication, sessions, and password controls are live.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/admin/applications"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Applications inbox</h2>
          <p className="mt-2 text-sm text-slate-500">
            Review submissions, request more information, approve or reject, and
            admit approved applicants.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open inbox →</p>
        </a>
        <a
          href="/admin/students"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Students</h2>
          <p className="mt-2 text-sm text-slate-500">
            Student register with search, filters, profiles, and enrollment
            management (confirm, suspend, defer, complete, withdraw).
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open register →</p>
        </a>
        <a
          href="/admin/admissions"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Admissions register</h2>
          <p className="mt-2 text-sm text-slate-500">
            Every issued admission, index number, and provisioned student
            account — searchable in one place.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open register →</p>
        </a>
        <a
          href="/admin/academics"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Academic structure</h2>
          <p className="mt-2 text-sm text-slate-500">
            Campuses, academic sessions, and intakes — the configuration that
            drives enrollment.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Manage →</p>
        </a>
        <a
          href="/admin/courses"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Course review</h2>
          <p className="mt-2 text-sm text-slate-500">
            Review trainer course submissions, request changes, approve, and
            publish courses to enrolled students.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open review queue →</p>
        </a>
        <a
          href="/admin/curricula"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Curricula</h2>
          <p className="mt-2 text-sm text-slate-500">
            Versioned course groupings per programme — approve and activate the
            curriculum that drives what enrolled students see.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Manage curricula →</p>
        </a>
        <a
          href="/admin/finance"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Finance</h2>
          <p className="mt-2 text-sm text-slate-500">
            Invoices, installment plans, and verified payments — balances update
            only from confirmed provider transactions.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open finance →</p>
        </a>
        <a
          href="/admin/academic"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Academic operations</h2>
          <p className="mt-2 text-sm text-slate-500">
            Course offerings, trainer assignments, attendance monitoring, and
            institution-wide academic reports.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open academic ops →</p>
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Identity &amp; security</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>• Session-aware login with identifier support</li>
            <li>• Token rotation with reuse detection</li>
            <li>• Password policy, history, and reset flows</li>
            <li>• Account activation / deactivation</li>
          </ul>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-400">
            Coming in later phases
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            <li>• User administration tables</li>
            <li>• Payments &amp; enrollment</li>
            <li>• Courses, attendance, assessments</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RouteGuard allowedRoles={["SUPERADMIN", "ADMIN"]}>
      <AppShell>
        <AdminInner />
      </AppShell>
    </RouteGuard>
  );
}
