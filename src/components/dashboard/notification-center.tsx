"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyticsApi } from "@/lib/api/analytics";
import type { NotificationItem } from "@/lib/api/contracts";

/**
 * Shared notification center over the EXISTING Notification outbox
 * (notification_service rows addressed to the user's email/phone) — no second
 * notification system. Read-markers are per-user via the analytics API.
 */
export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsApi.notifications(25);
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      setError("Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Dashboard deep-link (?focus=notifications) opens the panel from anywhere.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("km:open-notifications", onOpen);
    return () => window.removeEventListener("km:open-notifications", onOpen);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await analyticsApi.markNotificationRead(id);
    } catch {
      void load();
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await analyticsApi.markAllNotificationsRead();
    } catch {
      void load();
    }
  };

  return (
    <div ref={popRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative rounded-lg border border-slate-300 p-2 hover:bg-slate-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {loading && <p className="px-4 py-6 text-center text-xs text-slate-400">Loading…</p>}
            {!loading && error && <p className="px-4 py-6 text-center text-xs text-red-600">{error}</p>}
            {!loading && !error && items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet.</p>
            )}
            {!loading &&
              !error &&
              items.map((n) => (
                <article
                  key={n.id}
                  className={`border-b border-slate-50 px-4 py-3 last:border-0 ${n.read ? "" : "bg-sky-50/60"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {n.subject ?? (n.channel === "SMS" ? "SMS message" : "Notification")}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.snippet}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                        {n.channel} · {new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {!n.read && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-700">new</span>}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => void markRead(n.id)}
                        className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-50"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
