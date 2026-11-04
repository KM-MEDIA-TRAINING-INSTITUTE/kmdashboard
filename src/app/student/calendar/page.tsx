"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/route-guard";
import { ApiError } from "@/lib/api/client";
import { studentApi, type CalendarEvent } from "@/lib/api/academic";

const EVENT_META: Record<CalendarEvent["event_type"], { label: string; className: string }> = {
  CLASS: { label: "Class", className: "bg-slate-100 text-slate-700" },
  ASSIGNMENT_DUE: { label: "Due", className: "bg-amber-100 text-amber-800" },
  ASSESSMENT_AVAILABLE: { label: "Assessment", className: "bg-sky-100 text-sky-800" },
};

function CalendarInner() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filter, setFilter] = useState<"ALL" | CalendarEvent["event_type"]>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await studentApi.calendar();
        if (!cancelled) setEvents(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load your calendar.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const byDate = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (filter !== "ALL" && e.event_type !== filter) continue;
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Academic calendar</h1>
          <p className="mt-1 text-sm text-slate-500">Classes, deadlines and assessment windows.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {(["ALL", "CLASS", "ASSIGNMENT_DUE", "ASSESSMENT_AVAILABLE"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                filter === f ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f === "ALL" ? "All" : EVENT_META[f].label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          Nothing scheduled.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <ul className="mt-2 space-y-2">
                {items.map((e) => (
                  <li
                    key={`${e.event_type}-${e.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${EVENT_META[e.event_type].className}`}>
                      {EVENT_META[e.event_type].label}
                    </span>
                    <span className="text-sm font-medium text-slate-900">{e.title}</span>
                    <span className="text-xs text-slate-500">{e.course_title}</span>
                    {e.start_time && (
                      <span className="ml-auto text-xs text-slate-500">
                        {e.start_time.slice(0, 5)}
                        {e.end_time ? `–${e.end_time.slice(0, 5)}` : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentCalendarPage() {
  return (
    <RouteGuard allowedRoles={["STUDENT", "TRAINER", "ADMIN", "SUPERADMIN"]}>
      <AppShell>
        <CalendarInner />
      </AppShell>
    </RouteGuard>
  );
}
