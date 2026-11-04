"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import {
  studentApi,
  sessionStatusMeta,
  type CalendarEvent,
} from "@/lib/api/academic";

function ClassesInner() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await studentApi.calendar();
        if (!cancelled) setEvents(rows.filter((e) => e.event_type === "CLASS"));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load your classes.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmtDate = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">My classes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Scheduled sessions across your enrolled programme&apos;s offerings.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No classes are scheduled yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => {
            const meta = sessionStatusMeta[e.status ?? "SCHEDULED"] ?? sessionStatusMeta.SCHEDULED;
            return (
              <li key={`${e.event_type}-${e.id}`} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {e.course_title} · {fmtDate(e.date)}
                      {e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""}
                      {e.end_time ? `–${e.end_time.slice(0, 5)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.delivery_mode && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {e.delivery_mode}
                      </span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {e.location && <span className="text-slate-500">📍 {e.location}</span>}
                  {e.meeting_url && e.status === "ONGOING" && (
                    <a
                      href={e.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-slate-900 px-3 py-1 font-medium text-white hover:bg-slate-700"
                    >
                      Join class
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function StudentClassesPage() {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <ClassesInner />
      </AppShell>
    </RouteGuard>
  );
}
