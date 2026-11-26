"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, BookOpen, Calendar, GraduationCap, Layers, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import {
  EmptyState,
  LoadingSkeleton,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/dashboard/ui";
import { PageHeader } from "@/components/ui/primitives";
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
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Student Portal" title="My programme" />
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Student Portal" title="My programme" />
        <EmptyState icon={<GraduationCap className="h-5 w-5" />} title="No programme linked" detail={error} />
      </div>
    );
  }

  const program = data!.program;
  const requirements = parseJsonList(program.requirements);
  const modules = parseJsonList(program.modules);
  const opportunities = parseJsonList(program.opportunities);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student Portal"
        title="My programme"
        description="Your admission record, programme curriculum, and enrolment details."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard/student" }, { label: "My programme" }]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Index number" value={data!.index_number} tone="brand" />
        <StatCard label="Admission number" value={data!.admission_number} />
        <StatCard
          label="Status"
          value={`${data!.admission_status} · ${data!.enrollment_status.replace("_", " ")}`}
          tone="good"
        />
      </div>

      <SectionCard
        title={program.title}
        description={`${program.category} · ${program.certificate ?? "Certificate"}${
          program.duration_weeks ? ` · ${program.duration_weeks} weeks` : ""
        } · Level ${data!.current_level}`}
        icon={<GraduationCap className="h-4 w-4" />}
        action={
          <span className="rounded-md bg-brand-50 px-2.5 py-1 font-mono text-xs font-bold text-brand-700 ring-1 ring-brand-600/15">
            {program.code}
          </span>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600">
          {program.long_description || program.description}
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Tuition
            </dt>
            <dd className="mt-1 font-semibold text-ink-900">
              {program.tuition_minor != null ? CURRENCY.format(program.tuition_minor / 100) : "—"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Admitted on
            </dt>
            <dd className="mt-1 font-semibold text-ink-900">
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
            <h3 className="text-sm font-semibold text-ink-900">Entry requirements</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        {modules.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-ink-900">Course structure</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              {modules.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ol>
          </section>
        )}

        {opportunities.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-ink-900">Career opportunities</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {opportunities.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
        )}
      </SectionCard>

      <SectionCard
        title="My enrollment"
        description="Official enrolment records from the admissions office"
        icon={<Layers className="h-4 w-4" />}
      >
        {enrollments.length === 0 ? (
          <p className="text-sm text-slate-500">
            You are not enrolled yet. Your enrolment will appear here once the admissions office confirms it.
          </p>
        ) : (
          <ul className="space-y-3">
            {enrollments.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{e.program_title}</p>
                  <p className="text-xs text-slate-500">
                    {e.enrollment_number} · {e.intake_name}
                    {e.session_name ? ` · ${e.session_name}` : ""}
                    {e.campus_name ? ` · ${e.campus_name}` : ""}
                  </p>
                </div>
                <StatusBadge status={e.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            href: "/student/courses",
            title: "My courses",
            desc: "Published course materials for your programme — lessons, resources, and completion progress.",
            cta: "Open my courses →",
            icon: <Layers className="h-4 w-4" />,
          },
          {
            href: "/student/my-learning",
            title: "My learning",
            desc: "Live academic workspace — courses, classes, attendance, results, and completion progress.",
            cta: "Open my learning →",
            icon: <BookOpen className="h-4 w-4" />,
          },
          {
            href: "/student/finance",
            title: "My finance",
            desc: "Tuition balance, invoices, installment status, and official receipts — pay online via Paystack.",
            cta: "Open my finance →",
            icon: <Wallet className="h-4 w-4" />,
          },
          {
            href: "/student/calendar",
            title: "Calendar & classes",
            desc: "Class schedule, assignment deadlines, and assessment windows in one agenda view.",
            cta: "Open calendar →",
            icon: <Calendar className="h-4 w-4" />,
          },
          {
            href: "/student/results",
            title: "Results",
            desc: "Released results with letter grades — provisional where enabled by policy.",
            cta: "Open results →",
            icon: <Award className="h-4 w-4" />,
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[var(--shadow-card-hover)]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                {card.icon}
              </span>
              <h2 className="text-sm font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">
                {card.title}
              </h2>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-500">{card.desc}</p>
            <p className="mt-3 text-xs font-semibold text-brand-600">{card.cta}</p>
          </Link>
        ))}
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
