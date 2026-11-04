"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { studentsApi, type MyProgram } from "@/lib/api/admissions";
import { myEnrollmentsApi, type EnrollmentRow } from "@/lib/api/students";

const CURRENCY = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
});

function parseJsonList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function StudentInner() {
  const [data, setData] = useState<MyProgram | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await studentsApi.myProgram();
        if (!cancelled) setData(me);
        // Enrollment records (Phase 4) — empty until the institute enrolls the student.
        try {
          const enr = await myEnrollmentsApi.list();
          if (!cancelled) setEnrollments(enr);
        } catch {
          /* enrollment panel degrades to the empty state */
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError && err.status === 404
              ? "No admission record is linked to this account yet."
              : err instanceof ApiError
                ? err.message
                : "Could not load your programme. Is the API running?"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading your programme…</p>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">My programme</h1>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
          {error}
        </div>
      </div>
    );
  }

  const program = data!.program;
  const requirements = parseJsonList(program.requirements);
  const modules = parseJsonList(program.modules);
  const opportunities = parseJsonList(program.opportunities);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">My programme</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your admission record and programme details.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Index number</p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
            {data!.index_number}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Admission number</p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
            {data!.admission_number}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
          <p className="mt-1 text-sm font-semibold text-emerald-700">
            {data!.admission_status} · {data!.enrollment_status.replace("_", " ")}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{program.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {program.category} · {program.certificate ?? "Certificate"}
              {program.duration_weeks ? ` · ${program.duration_weeks} weeks` : ""}
              {` · Level ${data!.current_level}`}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {program.code}
          </span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          {program.long_description || program.description}
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Tuition</dt>
            <dd className="mt-0.5 text-slate-700">
              {program.tuition_minor != null ? CURRENCY.format(program.tuition_minor / 100) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Admitted on</dt>
            <dd className="mt-0.5 text-slate-700">
              {new Date(data!.admitted_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>

        {requirements.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Entry requirements</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        {modules.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Course structure</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              {modules.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ol>
          </section>
        )}

        {opportunities.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Career opportunities</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {opportunities.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Phase 4: enrollment status (real data, empty state until enrolled) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900">My enrollment</h3>
        {enrollments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            You are not enrolled yet. Your enrollment will appear here once the
            admissions office confirms it.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {enrollments.map((e) => (
              <li key={e.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{e.program_title}</p>
                    <p className="text-xs text-slate-500">
                      {e.enrollment_number} · {e.intake_name}
                      {e.session_name ? ` · ${e.session_name}` : ""}
                      {e.campus_name ? ` · ${e.campus_name}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      e.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : e.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/student/courses"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">My courses</h2>
          <p className="mt-2 text-sm text-slate-500">
            Published course materials for your programme — lessons, resources,
            and your completion progress.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open my courses →</p>
        </a>
        <a
          href="/student/my-learning"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">My learning</h2>
          <p className="mt-2 text-sm text-slate-500">
            Live academic dashboard — courses, classes, attendance, results,
            and completion progress.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open my learning →</p>
        </a>
        <a
          href="/student/finance"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">My finance</h2>
          <p className="mt-2 text-sm text-slate-500">
            Tuition balance, invoices, installment status, and official
            receipts — pay online via Paystack.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open my finance →</p>
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/student/calendar"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Calendar &amp; classes</h2>
          <p className="mt-2 text-sm text-slate-500">
            Class schedule, assignment deadlines, and assessment windows in one
            agenda view.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open calendar →</p>
        </a>
        <a
          href="/student/results"
          className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Results</h2>
          <p className="mt-2 text-sm text-slate-500">
            Released results with letter grades — provisional where enabled by
            policy.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-900">Open results →</p>
        </a>
      </div>
    </div>
  );
}

export default function StudentPage() {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <StudentInner />
      </AppShell>
    </RouteGuard>
  );
}
