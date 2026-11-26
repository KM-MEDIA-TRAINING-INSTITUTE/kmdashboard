"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { analyticsApi } from "@/lib/api/analytics";
import type { NotificationItem } from "@/lib/api/contracts";
import { MOTION_EASE } from "@/components/ui/motion";

/**
 * Shared notification center over the EXISTING Notification outbox.
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
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-ink-900"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: MOTION_EASE }}
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-popover)] sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Notifications</p>
              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-auto">
              {loading && (
                <div className="space-y-2 p-4">
                  <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                </div>
              )}
              {!loading && error && (
                <p className="px-4 py-6 text-center text-xs text-red-600">{error}</p>
              )}
              {!loading && !error && items.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
                  <p className="text-sm font-medium text-ink-800">All caught up</p>
                  <p className="mt-0.5 text-xs text-slate-400">No notifications yet.</p>
                </div>
              )}
              {!loading &&
                !error &&
                items.map((n) => (
                  <article
                    key={n.id}
                    className={`border-b border-slate-100 px-4 py-3 transition-colors last:border-0 ${
                      n.read ? "bg-white" : "bg-brand-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {n.subject ?? (n.channel === "SMS" ? "SMS message" : "Notification")}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.snippet}</p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {n.channel} · {new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-600 hover:bg-brand-50"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
